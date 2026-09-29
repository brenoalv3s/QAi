#!/usr/bin/env node
/**
 * Garante os arquivos-base do vint-qa no projeto aberto (idempotente, nunca sobrescreve valores):
 *   - .hub-projeto.json  (a partir do modelo; mescla chaves novas sem apagar as existentes)
 *   - .env               (a partir do modelo; valores vazios — sem placeholders)
 *   - .gitignore         (.env, .cursor/mcp.json, .vint-qa/cache/)
 *   - docs/test-docs, docs/test-scenarios, docs/test-evidence, docs/regression-automation, .vint-qa/learnings
 *
 *   vqa init --json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { ENV_FILE, HUB_FILE, PROJECT_ROOT, pluginPath, projectPath, readJson, writeJson } from './lib/project.mjs';
import { run } from './lib/sys.mjs';

const JSON_ONLY = process.argv.includes('--json');

function deepMergeMissing(target, template) {
  let changed = false;
  for (const [k, v] of Object.entries(template)) {
    if (!(k in target)) {
      target[k] = JSON.parse(JSON.stringify(v));
      changed = true;
    } else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      changed = deepMergeMissing(target[k], v) || changed;
    }
  }
  return changed;
}

function ensureHub() {
  const path = projectPath(HUB_FILE);
  const template = readJson(pluginPath('scaffold', 'project', 'hub-projeto.template.json'), {});
  if (!existsSync(path)) {
    writeJson(path, template);
    return 'created';
  }
  const current = readJson(path, null);
  if (!current || typeof current !== 'object') return 'invalid-json';
  const ordered = { ...current };
  if (deepMergeMissing(ordered, template)) {
    writeJson(path, ordered);
    return 'updated';
  }
  return 'ok';
}

function ensureEnv() {
  const path = projectPath(ENV_FILE);
  const template = readFileSync(pluginPath('scaffold', 'project', 'env.template'), 'utf8');
  if (!existsSync(path)) {
    writeFileSync(path, template);
    return 'created';
  }
  const current = readFileSync(path, 'utf8');
  const have = new Set(
    current
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => l.slice(0, l.indexOf('=')).trim()),
  );
  const missing = template
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .filter((l) => !have.has(l.slice(0, l.indexOf('=')).trim()));
  if (!missing.length) return 'ok';
  writeFileSync(path, current.replace(/\s*$/, '\n') + `\n# --- adicionado pelo vint-qa ---\n${missing.join('\n')}\n`);
  return 'updated';
}

function ensureGitignore() {
  const path = projectPath('.gitignore');
  const wanted = ['.env', 'e2e/.env', '*.env.local', '.cursor/mcp.json', '.cursor/qa-platform.json', '.vint-qa/cache/'];
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()));
  const add = wanted.filter((w) => !have.has(w));
  if (!add.length) return 'ok';
  const base = current.replace(/\s*$/, '');
  writeFileSync(path, `${base ? base + '\n\n' : ''}# --- vint-qa ---\n${add.join('\n')}\n`);
  return current ? 'updated' : 'created';
}

function ensureDirs() {
  const dirs = ['docs/test-docs', 'docs/test-scenarios', 'docs/test-evidence', 'docs/regression-automation', '.vint-qa/learnings'];
  for (const d of dirs) mkdirSync(projectPath(d), { recursive: true });
  const keep = projectPath('.vint-qa', 'learnings', 'README.md');
  if (!existsSync(keep)) {
    writeFileSync(
      keep,
      '# Aprendizados do projeto (vint-qa)\n\nCada arquivo `.md` aqui é um aprendizado registrado pela esteira (correções do QA, particularidades da aplicação).\nO RAG do vint-qa indexa esta pasta e os agentes consultam antes de gerar artefatos. Versione esta pasta com o projeto.\n',
    );
  }
  return dirs;
}

function suggestions() {
  const email = run('git', ['config', 'user.email'], { cwd: PROJECT_ROOT }).stdout || '';
  return { projeto: basename(PROJECT_ROOT), email };
}

const out = {
  projectRoot: PROJECT_ROOT,
  hub: ensureHub(),
  env: ensureEnv(),
  gitignore: ensureGitignore(),
  dirs: ensureDirs(),
  suggestions: suggestions(),
};

if (JSON_ONLY) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`vint-qa init em ${PROJECT_ROOT}`);
  console.log(`.hub-projeto.json: ${out.hub} | .env: ${out.env} | .gitignore: ${out.gitignore}`);
}
if (out.hub === 'invalid-json') process.exitCode = 2;
