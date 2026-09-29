#!/usr/bin/env node
/**
 * Verifica (e opcionalmente instala) as ferramentas que a esteira vint-qa usa.
 *
 *   vqa doctor --json              só verifica
 *   vqa doctor --install --json    instala o que faltar e for instalável sem intervenção
 *   vqa doctor --force             ignora o cache de 24h
 *
 * Obrigatórias: Node >= 18, npm/npx, git.
 * Recomendadas: Python 3 + uv/uvx (MCP Robot), navegador Chromium do Playwright, ffmpeg (GIF de evidência).
 */
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { USER_HOME_DIR, pluginVersion, readJson, writeJson } from './lib/project.mjs';
import { IS_MAC, IS_WIN, majorOf, run, version } from './lib/sys.mjs';
import { uvxVersion } from './lib/uv.mjs';

const args = process.argv.slice(2);
const JSON_ONLY = args.includes('--json');
const INSTALL = args.includes('--install');
const FORCE = args.includes('--force');
const CACHE = join(USER_HOME_DIR, 'doctor.json');
const TTL_MS = 24 * 60 * 60 * 1000;

function log(...a) {
  if (!JSON_ONLY) console.log(...a);
  else console.error(...a);
}

function playwrightBrowsersDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (IS_WIN) return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (IS_MAC) return join(homedir(), 'Library', 'Caches', 'ms-playwright');
  return join(homedir(), '.cache', 'ms-playwright');
}

function hasChromium() {
  const dir = playwrightBrowsersDir();
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((n) => /^chromium(-|_headless_shell-)\d+/.test(n));
  } catch {
    return false;
  }
}

function pythonCmd() {
  for (const c of IS_WIN ? ['python', 'py', 'python3'] : ['python3', 'python']) {
    const v = version(c);
    if (v && majorOf(v) >= 3) return { cmd: c, version: v };
  }
  return null;
}

function packageManager() {
  if (IS_WIN) return version('winget', ['--version']) ? 'winget' : null;
  if (IS_MAC) return version('brew', ['--version']) ? 'brew' : null;
  for (const pm of ['apt-get', 'dnf', 'yum']) if (version(pm, ['--version'])) return pm;
  return null;
}

const PKG = {
  git: { winget: 'Git.Git', brew: 'git', 'apt-get': 'git', dnf: 'git', yum: 'git' },
  python: { winget: 'Python.Python.3.12', brew: 'python@3.12', 'apt-get': 'python3 python3-pip', dnf: 'python3 python3-pip', yum: 'python3 python3-pip' },
  uv: { winget: 'astral-sh.uv', brew: 'uv' },
  ffmpeg: { winget: 'Gyan.FFmpeg', brew: 'ffmpeg', 'apt-get': 'ffmpeg', dnf: 'ffmpeg', yum: 'ffmpeg' },
  node: { winget: 'OpenJS.NodeJS.LTS', brew: 'node@20' },
};

function installWithPm(pm, name) {
  const pkg = PKG[name]?.[pm];
  if (!pm || !pkg) return { ok: false, how: null };
  log(`→ instalando ${name} via ${pm} (${pkg})...`);
  let r;
  if (pm === 'winget') {
    r = run('winget', ['install', '--id', pkg, '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements'], { timeout: 900_000 });
  } else if (pm === 'brew') {
    r = run('brew', ['install', ...pkg.split(' ')], { timeout: 900_000 });
  } else {
    r = run('sudo', ['-n', pm, 'install', '-y', ...pkg.split(' ')], { timeout: 900_000 });
  }
  return { ok: r.ok, how: `${pm} ${pkg}`, error: r.ok ? null : (r.stderr || r.stdout).slice(-400) };
}

function check() {
  const nodeV = process.versions.node;
  const py = pythonCmd();
  return {
    node: { required: true, version: nodeV, ok: majorOf(nodeV) >= 18, hint: 'Node.js 18 ou superior (https://nodejs.org)' },
    npm: { required: true, version: version('npm'), get ok() { return Boolean(this.version); }, hint: 'Vem junto com o Node.js' },
    npx: { required: true, version: version('npx'), get ok() { return Boolean(this.version); }, hint: 'Vem junto com o Node.js' },
    git: { required: true, version: version('git'), get ok() { return Boolean(this.version); }, hint: 'Git (https://git-scm.com)' },
    python: { required: false, version: py?.version || null, cmd: py?.cmd || null, ok: Boolean(py), hint: 'Python 3 — necessário para Robot Framework e MCP robotmcp' },
    uv: { required: false, version: uvxVersion(), get ok() { return Boolean(this.version); }, hint: 'uv/uvx — inicia o MCP robotmcp' },
    chromium: { required: false, version: null, ok: hasChromium(), path: playwrightBrowsersDir(), hint: 'Navegador do Playwright (npx playwright install chromium)' },
    ffmpeg: { required: false, version: version('ffmpeg', ['-version']), get ok() { return Boolean(this.version); }, hint: 'ffmpeg — gera o GIF das evidências de teste manual' },
  };
}

function flatten(tools) {
  const out = {};
  for (const [k, v] of Object.entries(tools)) out[k] = { ...v, ok: Boolean(v.ok) };
  return out;
}

function install(tools) {
  const pm = packageManager();
  const actions = [];

  if (!tools.node.ok) actions.push({ tool: 'node', ...installWithPm(pm, 'node'), restart: true });
  if (!tools.git.ok) actions.push({ tool: 'git', ...installWithPm(pm, 'git'), restart: true });

  if (!tools.python.ok) actions.push({ tool: 'python', ...installWithPm(pm, 'python'), restart: true });

  if (!tools.uv.ok) {
    const py = pythonCmd();
    let res = { ok: false, how: null };
    if (pm && PKG.uv[pm]) res = installWithPm(pm, 'uv');
    if (!res.ok && py) {
      log('→ instalando uv via pip...');
      const r = run(py.cmd, ['-m', 'pip', 'install', '--user', '--upgrade', 'uv'], { timeout: 600_000 });
      res = { ok: r.ok, how: `${py.cmd} -m pip install --user uv`, error: r.ok ? null : r.stderr.slice(-400) };
    }
    if (!res.ok || !uvxVersion()) {
      log('→ instalando uv pelo instalador oficial (astral.sh)...');
      const r = IS_WIN
        ? run('powershell', ['-NoProfile', '-ExecutionPolicy', 'ByPass', '-Command', 'irm https://astral.sh/uv/install.ps1 | iex'], { timeout: 600_000 })
        : run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], { timeout: 600_000 });
      const ok = r.ok && Boolean(uvxVersion());
      res = { ok, how: 'instalador oficial do uv (astral.sh)', error: ok ? null : (r.stderr || r.stdout).slice(-400) || 'uvx não encontrado após a instalação' };
    }
    actions.push({ tool: 'uv', ...res, restart: false, reloadMcp: 'robotmcp' });
  }

  if (!tools.chromium.ok) {
    log('→ instalando Chromium do Playwright (pode levar alguns minutos)...');
    const r = run('npx', ['-y', 'playwright@latest', 'install', 'chromium'], { timeout: 900_000 });
    actions.push({ tool: 'chromium', ok: r.ok, how: 'npx playwright install chromium', error: r.ok ? null : (r.stderr || r.stdout).slice(-400) });
  }

  if (!tools.ffmpeg.ok) actions.push({ tool: 'ffmpeg', ...installWithPm(pm, 'ffmpeg'), restart: true });

  return { packageManager: pm, actions };
}

function main() {
  const cached = readJson(CACHE, null);
  const fresh =
    !FORCE &&
    cached?.ready &&
    cached?.pluginVersion === pluginVersion() &&
    Date.now() - Date.parse(cached.checkedAt || 0) < TTL_MS;

  if (fresh && !INSTALL) {
    const out = { ...cached, fromCache: true };
    if (JSON_ONLY) console.log(JSON.stringify(out, null, 2));
    else log('vint-qa doctor: ambiente OK (cache de', cached.checkedAt + ')');
    return;
  }

  let tools = flatten(check());
  let installReport = null;

  if (INSTALL && Object.values(tools).some((t) => !t.ok)) {
    installReport = install(tools);
    tools = flatten(check());
  }

  const missingRequired = Object.entries(tools).filter(([, t]) => t.required && !t.ok).map(([k]) => k);
  const missingRecommended = Object.entries(tools).filter(([, t]) => !t.required && !t.ok).map(([k]) => k);
  const needsRestart = Boolean(installReport?.actions.some((a) => a.ok && a.restart));

  const out = {
    pluginVersion: pluginVersion(),
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    tools,
    missingRequired,
    missingRecommended,
    ready: missingRequired.length === 0,
    install: installReport,
    needsRestart,
    reloadMcp: [...new Set((installReport?.actions || []).filter((a) => a.ok && a.reloadMcp).map((a) => a.reloadMcp))],
    next: missingRequired.length
      ? 'ask-user-install'
      : needsRestart
        ? 'restart-cursor'
        : 'ok',
    manual: [...missingRequired, ...missingRecommended].map((k) => ({ tool: k, hint: tools[k].hint })),
  };

  writeJson(CACHE, out);

  if (JSON_ONLY) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log('vint-qa doctor');
  for (const [k, t] of Object.entries(tools)) {
    console.log(`${t.ok ? '✅' : t.required ? '❌' : '⚠️ '} ${k.padEnd(9)} ${t.version || (t.ok ? 'ok' : '— ' + t.hint)}`);
  }
  console.log('next:', out.next);
}

main();
