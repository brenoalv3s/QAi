#!/usr/bin/env node
/**
 * Após testes da automação regressiva passarem: branch, commit (sem segredos), push.
 * Imprime JSON com URL para o QA abrir o PR. Não cria o PR.
 *
 *   node push-automation-branch.mjs --feature "Cadastro de Colaboradores" --json
 */
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { toSlug } from './lib/slug.mjs';

import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';

const BLOCKED = [
  /(^|[\\/])\.env(\.|$)/i,
  /(^|[\\/])mcp\.json$/i,
  /(^|[\\/])qa-platform\.json$/i,
  /node_modules/,
  /test-results/,
  /playwright-report/,
  /blob-report/,
  /\.cache/,
];

const ALLOW_PREFIX = ['e2e/', 'e2e\\', 'docs/regression-automation/', 'docs\\regression-automation\\'];
const PROTECTED_BASE = new Set(['main', 'master', 'develop', 'dev', 'trunk']);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-/g, '_');
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

function git(args, extra = {}) {
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...extra,
  });
}

function gitOk(args) {
  const r = git(args);
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim();
    throw new Error(err || `git ${args.join(' ')} falhou`);
  }
  return (r.stdout || '').trim();
}

function isBlocked(path) {
  const n = path.replace(/^\?\? /, '').replace(/^.. /, '').trim();
  return BLOCKED.some((re) => re.test(n));
}

function isAllowed(path) {
  const n = path.replace(/\\/g, '/');
  return ALLOW_PREFIX.some((p) => n.replace(/\\/g, '/').startsWith(p.replace(/\\/g, '/')));
}

function porcelainPaths() {
  const out = gitOk(['status', '--porcelain']);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).trim().replace(/^"|"$/g, '');
      const renamed = path.includes(' -> ') ? path.split(' -> ').pop() : path;
      return renamed;
    });
}

function httpsRemote(raw) {
  let u = String(raw || '').trim().replace(/\.git$/, '');
  if (!u) return null;
  if (u.startsWith('git@')) {
    const m = u.match(/^git@([^:]+):(.+)$/);
    if (m) u = `https://${m[1]}/${m[2]}`;
  }
  if (u.startsWith('ssh://git@')) {
    u = u.replace(/^ssh:\/\/git@/, 'https://').replace(/:(\d+)\//, '/');
  }
  const azSsh = u.match(/^git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/(.+)$/);
  if (azSsh) return { host: 'azure', https: `https://dev.azure.com/${azSsh[1]}/${azSsh[2]}/_git/${azSsh[3]}`, org: azSsh[1], project: azSsh[2], repo: azSsh[3] };
  if (/dev\.azure\.com/i.test(u)) {
    const m = u.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)/i);
    if (m) return { host: 'azure', https: `https://dev.azure.com/${m[1]}/${m[2]}/_git/${m[3]}`, org: m[1], project: m[2], repo: m[3] };
  }
  if (/github\.com/i.test(u)) {
    const m = u.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
    if (m) return { host: 'github', https: `https://github.com/${m[1]}/${m[2]}`, org: m[1], repo: m[2] };
  }
  if (/gitlab/i.test(u)) {
    return { host: 'gitlab', https: u.replace(/git@[^:]+:/, 'https://').replace(/^git@/, 'https://') };
  }
  return { host: 'other', https: u };
}

function createPrUrl(info, base, branch) {
  if (!info?.https) return null;
  const b = encodeURIComponent(branch);
  const t = encodeURIComponent(base);
  if (info.host === 'github') return `${info.https}/compare/${t}...${b}?expand=1`;
  if (info.host === 'azure') return `${info.https}/pullrequestcreate?sourceRef=${b}&targetRef=${t}`;
  if (info.host === 'gitlab') return `${info.https}/-/merge_requests/new?merge_request[source_branch]=${b}&merge_request[target_branch]=${t}`;
  return `${info.https}`;
}

function detectBase() {
  for (const name of ['main', 'master', 'develop']) {
    const r = git(['rev-parse', '--verify', `origin/${name}`]);
    if (r.status === 0) return name;
    const l = git(['rev-parse', '--verify', name]);
    if (l.status === 0) return name;
  }
  return 'main';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature || args.f || '';
  const jsonOnly = process.argv.includes('--json');
  if (!feature || feature === true) {
    console.error('Uso: --feature "Nome da feature"');
    process.exit(1);
  }

  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0) {
    console.error(JSON.stringify({ ok: false, error: 'Não é um repositório git.' }, null, 2));
    process.exit(1);
  }

  const slug = toSlug(feature) || 'feature';
  const wantBranch = `qa/automacao-${slug}`.slice(0, 80);
  const current = gitOk(['rev-parse', '--abbrev-ref', 'HEAD']);
  let branch = current;
  if (PROTECTED_BASE.has(current.toLowerCase())) {
    const exists = git(['rev-parse', '--verify', wantBranch]);
    if (exists.status === 0) gitOk(['checkout', wantBranch]);
    else gitOk(['checkout', '-b', wantBranch]);
    branch = wantBranch;
  }

  const paths = porcelainPaths().filter((p) => isAllowed(p) && !isBlocked(p));
  if (!paths.length) {
    const remote = git(['config', '--get', 'remote.origin.url']);
    const info = httpsRemote((remote.stdout || '').trim());
    const out = {
      ok: true,
      skipped: true,
      reason: 'Nada novo para commitar em e2e/ ou docs/regression-automation/.',
      branch,
      createPrUrl: info ? createPrUrl(info, detectBase(), branch) : null,
      pushUrl: info ? `${info.https}/tree/${encodeURIComponent(branch)}` : null,
    };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  gitOk(['add', '--', ...paths]);
  const staged = gitOk(['diff', '--cached', '--name-only']);
  const stagedList = staged ? staged.split(/\r?\n/).filter(Boolean) : [];
  if (stagedList.some(isBlocked)) {
    git(['reset', 'HEAD', '--', ...stagedList.filter(isBlocked)]);
  }
  const still = gitOk(['diff', '--cached', '--name-only']);
  if (!still) {
    console.log(JSON.stringify({ ok: false, error: 'Nenhum arquivo permitido ficou no stage.' }, null, 2));
    process.exit(1);
  }

  const msg = `test(e2e): automação regressiva — ${feature}`;
  const commit = git(['commit', '-m', msg]);
  if (commit.status !== 0) {
    console.error(JSON.stringify({ ok: false, error: (commit.stderr || commit.stdout || 'commit falhou').trim() }, null, 2));
    process.exit(1);
  }
  const sha = gitOk(['rev-parse', '--short', 'HEAD']);

  const remote = git(['config', '--get', 'remote.origin.url']);
  if (remote.status !== 0 || !String(remote.stdout || '').trim()) {
    console.log(
      JSON.stringify(
        { ok: true, pushed: false, branch, commit: sha, error: 'Sem remote origin. Commit local feito; configure origin e faça push.' },
        null,
        2
      )
    );
    return;
  }

  const push = git(['push', '-u', 'origin', 'HEAD']);
  if (push.status !== 0) {
    console.error(
      JSON.stringify(
        { ok: false, branch, commit: sha, error: (push.stderr || push.stdout || 'push falhou').trim() },
        null,
        2
      )
    );
    process.exit(1);
  }

  const info = httpsRemote((remote.stdout || '').trim());
  const base = detectBase();
  const createPrUrlValue = createPrUrl(info, base, branch);
  const pushUrl =
    info?.host === 'github'
      ? `${info.https}/tree/${branch}`
      : info?.host === 'azure'
        ? `${info.https}?version=GB${encodeURIComponent(branch)}`
        : info?.host === 'gitlab'
          ? `${info.https}/-/tree/${encodeURIComponent(branch)}`
          : info?.https || null;

  const out = {
    ok: true,
    pushed: true,
    branch,
    commit: sha,
    files: still.split(/\r?\n/).filter(Boolean),
    pushUrl,
    createPrUrl: createPrUrlValue,
    message: 'QA: abra o link createPrUrl, crie o PR e faça a revisão. O agente não abre o PR.',
  };
  console.log(JSON.stringify(out, null, 2));
  if (!jsonOnly) {
    console.log('\nBranch:', branch);
    console.log('Push:', pushUrl || '(veja o remote)');
    console.log('Criar PR:', createPrUrlValue || '(abra o repositório na branch)');
  }
}

try {
  main();
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e.message || String(e) }, null, 2));
  process.exit(1);
}
