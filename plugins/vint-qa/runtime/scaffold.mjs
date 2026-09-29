#!/usr/bin/env node
/**
 * Cria a suíte de automação no projeto a partir do scaffold do plugin (só arquivos novos, salvo --force).
 *
 *   vqa scaffold --framework playwright [--install] [--force]
 *   vqa scaffold --framework robot [--install] [--force]
 *
 * --install: npm install + playwright install chromium (Playwright) | pip install -r e2e/robot/requirements.txt (Robot)
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { PROJECT_ROOT, pluginPath, projectPath, readHub } from './lib/project.mjs';
import { run } from './lib/sys.mjs';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const framework = val('--framework') || readHub()?.frameworkAutomacao || 'playwright';
const force = flag('--force');
const install = flag('--install');
const created = [];
const skipped = [];

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const a = join(from, name);
    const b = join(to, name);
    if (statSync(a).isDirectory()) copyDir(a, b);
    else if (force || !existsSync(b)) {
      mkdirSync(dirname(b), { recursive: true });
      cpSync(a, b);
      created.push(b.replace(PROJECT_ROOT, '').replace(/^[\\/]/, ''));
    } else skipped.push(b.replace(PROJECT_ROOT, '').replace(/^[\\/]/, ''));
  }
}

const folder = framework === 'robot' ? join('e2e', 'robot') : 'e2e';
copyDir(pluginPath('scaffold', framework === 'robot' ? 'robot' : 'e2e'), projectPath(folder));

const steps = [];
if (install) {
  if (framework === 'robot') {
    const py = ['python', 'py', 'python3'].find((c) => run(c, ['--version']).ok);
    if (py) {
      const r = run(py, ['-m', 'pip', 'install', '-r', join('e2e', 'robot', 'requirements.txt')], { cwd: PROJECT_ROOT, timeout: 900_000 });
      steps.push({ step: 'pip install -r e2e/robot/requirements.txt', ok: r.ok, error: r.ok ? null : r.stderr.slice(-400) });
      if (r.ok) {
        const b = run(py, ['-m', 'Browser.entry', 'init', 'chromium'], { cwd: PROJECT_ROOT, timeout: 900_000 });
        steps.push({ step: 'rfbrowser init chromium', ok: b.ok, error: b.ok ? null : b.stderr.slice(-400) });
      }
    } else steps.push({ step: 'python', ok: false, error: 'Python não encontrado — rode vqa doctor --install' });
  } else {
    const e2e = projectPath('e2e');
    const r = run('npm', ['install'], { cwd: e2e, timeout: 900_000 });
    steps.push({ step: 'npm install (e2e)', ok: r.ok, error: r.ok ? null : r.stderr.slice(-400) });
    if (r.ok) {
      const b = run('npx', ['playwright', 'install', 'chromium'], { cwd: e2e, timeout: 900_000 });
      steps.push({ step: 'playwright install chromium', ok: b.ok, error: b.ok ? null : b.stderr.slice(-400) });
    }
  }
}

console.log(
  JSON.stringify(
    { framework, folder, created: created.length, skipped: skipped.length, createdFiles: created.slice(0, 60), install: steps, ok: steps.every((s) => s.ok) },
    null,
    2,
  ),
);
