#!/usr/bin/env node
/**
 * Validação do repositório de plugins (roda no CI do GitLab e localmente).
 *
 *   node tools/validate-plugin.mjs
 *
 * Verifica: marketplace/plugin.json, frontmatter de agents/skills/rules/commands, sintaxe de todos os .mjs,
 * import das libs, referências a caminhos de projeto antigos (.cursor/skills), valores fixos de um projeto
 * específico e possíveis segredos versionados.
 */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => relative(REPO, p).split(sep).join('/');

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, acc);
    else acc.push(f);
  }
  return acc;
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    err(`${rel(p)}: JSON inválido (${e.message})`);
    return null;
  }
}

function frontmatter(p) {
  const text = readFileSync(p, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const KEBAB = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

const marketplacePath = join(REPO, '.cursor-plugin', 'marketplace.json');
const marketplace = existsSync(marketplacePath) ? readJson(marketplacePath) : (err('.cursor-plugin/marketplace.json ausente'), null);
const plugins = marketplace?.plugins || [];
if (marketplace && !KEBAB.test(marketplace.name || '')) err('marketplace.name deve ser kebab-case');
if (marketplace && !marketplace.owner?.name) err('marketplace.owner.name é obrigatório');

for (const entry of plugins) {
  const root = join(REPO, entry.source);
  const manifestPath = join(root, '.cursor-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    err(`${entry.name}: ${rel(manifestPath)} não encontrado`);
    continue;
  }
  const manifest = readJson(manifestPath);
  if (!manifest) continue;
  if (manifest.name !== entry.name) err(`${entry.name}: nome difere do plugin.json (${manifest.name})`);
  if (!KEBAB.test(manifest.name)) err(`${manifest.name}: nome deve ser kebab-case`);
  if (!/^\d+\.\d+\.\d+/.test(manifest.version || '')) err(`${manifest.name}: version semver obrigatória`);

  for (const key of ['commands', 'agents', 'skills', 'rules', 'hooks', 'mcpServers', 'logo']) {
    const v = manifest[key];
    if (typeof v !== 'string') continue;
    if (v.includes('..') || /^([a-z]:|\/)/i.test(v)) err(`${manifest.name}: caminho "${key}" deve ser relativo sem ".."`);
    else if (!existsSync(join(root, v))) err(`${manifest.name}: "${key}" aponta para ${v}, que não existe`);
  }

  const mcp = manifest.mcpServers ? readJson(join(root, manifest.mcpServers)) : null;
  const hooks = manifest.hooks ? readJson(join(root, manifest.hooks)) : null;
  if (hooks && typeof hooks.hooks !== 'object') err(`${manifest.name}: hooks.json sem objeto "hooks"`);
  if (mcp && typeof mcp.mcpServers !== 'object') err(`${manifest.name}: mcp.json sem "mcpServers"`);

  const files = walk(root);

  for (const f of files.filter((x) => rel(x).includes('/skills/') && x.endsWith('SKILL.md'))) {
    const fm = frontmatter(f);
    const folder = dirname(f).split(sep).pop();
    if (!fm?.name || !fm?.description) err(`${rel(f)}: frontmatter precisa de name e description`);
    else if (fm.name !== folder) err(`${rel(f)}: name "${fm.name}" deve ser igual à pasta "${folder}"`);
  }
  for (const f of files.filter((x) => /\/(agents|commands)\/[^/]+\.md$/.test(rel(x)))) {
    const fm = frontmatter(f);
    if (!fm?.name || !fm?.description) err(`${rel(f)}: frontmatter precisa de name e description`);
    if (fm?.model && !/^(inherit|[a-z0-9.-]+(\[.*\])?)$/.test(fm.model)) err(`${rel(f)}: model inválido "${fm.model}"`);
  }
  for (const f of files.filter((x) => rel(x).includes('/rules/') && x.endsWith('.mdc'))) {
    const fm = frontmatter(f);
    if (!fm?.description) err(`${rel(f)}: rule precisa de description`);
    if (fm?.alwaysApply === 'true') warn(`${rel(f)}: alwaysApply true afeta todos os chats de todos os projetos`);
  }

  const textFiles = files.filter((x) => /\.(md|mdc|mjs|json|txt|ts|robot|resource)$/.test(x) && !rel(x).includes('/scaffold/e2e/node_modules/'));
  for (const f of textFiles) {
    const text = readFileSync(f, 'utf8');
    const r = rel(f);
    if (/\.(md|mdc)$/.test(f) && /(^|[^{/\w])\.cursor\/(skills|rules|agents)\//m.test(text)) {
      err(`${r}: referência a .cursor/skills|rules|agents do projeto — use {VINT_QA_ROOT}/... ou "$HOME/.vint-qa/vqa.mjs"`);
    }
    if (/\.mjs$/.test(f) && /'vintglobal'|SGD - Sistema Gest|sgd-(dev|tst|hml)\.vintglobal/.test(text)) {
      err(`${r}: valor fixo de projeto em script — mova para .hub-projeto.json`);
    }
    if (/\b(sgd|api-sgd|site)-(dev|tst|hml)\.vintglobal\.com\.br/.test(text) && !r.includes('/examples/')) {
      warn(`${r}: URL de ambiente de um projeto específico`);
    }
    if (/AZURE_DEVOPS_PAT"\s*:\s*"(?!SEU_PAT|\$\{)[A-Za-z0-9]{40,}"|glpat-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(text)) {
      err(`${r}: possível segredo versionado`);
    }
  }
  for (const f of files) {
    const r = rel(f);
    if (/(^|\/)\.env$|auth-token\.json$|\/\.cache\//.test(r)) err(`${r}: arquivo sensível/cache não deve ser versionado`);
  }

  const scripts = files.filter((x) => x.endsWith('.mjs') && !rel(x).includes('/scaffold/'));
  for (const f of scripts) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) err(`${rel(f)}: erro de sintaxe\n${r.stderr.split('\n').slice(0, 4).join('\n')}`);
  }
  const libs = scripts.filter((x) => /[\\/]lib[\\/]/.test(x));
  for (const f of libs) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(f).href)})`], {
      encoding: 'utf8',
      cwd: REPO,
      env: { ...process.env, VINT_QA_PROJECT_DIR: join(REPO, 'tools', 'fixtures', 'empty-project') },
    });
    if (r.status !== 0) err(`${rel(f)}: falha ao importar\n${r.stderr.split('\n').filter(Boolean).slice(0, 4).join('\n')}`);
  }
}

for (const w of warnings) console.log(`⚠️  ${w}`);
for (const e of errors) console.log(`❌ ${e}`);
console.log(`\n${errors.length ? '❌' : '✅'} ${plugins.length} plugin(s) — ${errors.length} erro(s), ${warnings.length} aviso(s)`);
process.exit(errors.length ? 1 : 0);
