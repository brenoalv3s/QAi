#!/usr/bin/env node
/**
 * Tudo o que o /vint-qa precisa antes de mostrar o menu, numa chamada:
 *   1. doctor (instala o que faltar com --install; usa cache de 24h)
 *   2. init   (cria .hub-projeto.json / .env / pastas se faltarem)
 *   3. validate --action startup
 *   4. resumo dos artefatos do projeto (docs, e2e, robot)
 *
 *   vqa startup --json [--install] [--force]
 */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { PLUGIN_ROOT, PROJECT_ROOT, pluginVersion, projectPath, readHub } from './lib/project.mjs';

const argv = process.argv.slice(2);
const passthrough = ['--install', '--force'].filter((f) => argv.includes(f));

function runJson(script, args = []) {
  const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, 'runtime', script), ...args, '--json'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, VINT_QA_PROJECT_DIR: PROJECT_ROOT },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 1_800_000,
  });
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { error: (r.stderr || r.stdout || '').slice(-800), status: r.status };
  }
}

function countDirs(rel) {
  const p = projectPath(rel);
  if (!existsSync(p)) return 0;
  try {
    return readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  } catch {
    return 0;
  }
}

const doctor = runJson('doctor.mjs', passthrough);
const init = runJson('init-project.mjs');
const validate = runJson('validate.mjs', ['--action', 'startup']);
const hub = readHub() || {};

const artifacts = {
  testDocs: countDirs('docs/test-docs'),
  testScenarios: countDirs('docs/test-scenarios'),
  playwright: existsSync(projectPath('e2e', 'playwright.config.ts')) || existsSync(projectPath('playwright.config.ts')),
  robot: existsSync(projectPath('robot')),
  learnings: existsSync(projectPath('.vint-qa', 'learnings'))
    ? readdirSync(projectPath('.vint-qa', 'learnings')).filter((f) => f.endsWith('.md') && f !== 'README.md').length
    : 0,
};

const next = doctor?.missingRequired?.length
  ? 'ask-user-install'
  : init?.hub === 'invalid-json'
    ? 'fix-hub-json'
    : doctor?.needsRestart
      ? 'restart-cursor'
      : 'show-menu';

console.log(
  JSON.stringify(
    {
      plugin: { version: pluginVersion(), root: PLUGIN_ROOT },
      projectRoot: PROJECT_ROOT,
      project: { nome: hub.projeto || null, plataforma: hub.plataforma || null, framework: hub.frameworkAutomacao || null },
      doctor: {
        ready: doctor?.ready ?? false,
        fromCache: Boolean(doctor?.fromCache),
        missingRequired: doctor?.missingRequired || [],
        missingRecommended: doctor?.missingRecommended || [],
        installed: (doctor?.install?.actions || []).filter((a) => a.ok).map((a) => a.tool),
        failed: (doctor?.install?.actions || []).filter((a) => !a.ok).map((a) => ({ tool: a.tool, how: a.how, error: a.error })),
        manual: doctor?.manual || [],
        reloadMcp: doctor?.reloadMcp || [],
        error: doctor?.error || null,
      },
      files: { hub: init?.hub, env: init?.env, gitignore: init?.gitignore },
      suggestions: init?.suggestions || {},
      artifacts,
      next,
    },
    null,
    2,
  ),
);
