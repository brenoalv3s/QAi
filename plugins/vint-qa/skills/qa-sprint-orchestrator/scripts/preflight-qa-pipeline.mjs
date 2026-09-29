#!/usr/bin/env node
/**
 * Valida o ambiente da esteira QA (env, Playwright, Robot).
 * Uso:
 *   node preflight-qa-pipeline.mjs --json
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

import { PROJECT_ROOT as ROOT, PLUGIN_ROOT } from '../../../runtime/lib/project.mjs';

const REQUIRED = ['BASE_URL', 'TEST_USER', 'TEST_PASSWORD'];
const RECOMMENDED = ['API_BASE_URL', 'AUTH_LOGIN_PATH', 'AUTH_BODY_FORMAT'];
const PLACEHOLDER_RE =
  /exemplo\.com|seu_usuario|sua_senha|change-me|changeme|placeholder|todo|xxx|senha_inativo|usuario_inativo|usuario_excluido/i;

function parseEnv(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readEnvFile(path) {
  if (!existsSync(path)) return null;
  return parseEnv(readFileSync(path, 'utf8'));
}

function isPlaceholder(key, value) {
  if (value == null || String(value).trim() === '') return true;
  if (PLACEHOLDER_RE.test(String(value))) return true;
  if (key.includes('URL') && /localhost|127\.0\.0\.1/.test(value) === false && /exemplo/i.test(value)) return true;
  return false;
}

function walkFiles(dir, acc = [], depth = 0) {
  if (depth > 6 || !existsSync(dir)) return acc;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'playwright-report' || name === 'test-results') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, acc, depth + 1);
    else acc.push(full);
  }
  return acc;
}

function cmdOk(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true, timeout: 20_000 });
  return r.status === 0;
}

function findEnvExample() {
  const candidates = [
    join(ROOT, 'e2e', '.env.example'),
    join(ROOT, '.env.example'),
    join(PLUGIN_ROOT, 'scaffold', 'project', 'env.template'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function main() {
  const jsonOnly = process.argv.includes('--json');
  const examplePath = findEnvExample();
  const example = examplePath ? readEnvFile(examplePath) : {};
  const e2eEnvPath = join(ROOT, 'e2e', '.env');
  const rootEnvPath = join(ROOT, '.env');
  const e2eEnv = readEnvFile(e2eEnvPath) || {};
  const rootEnv = readEnvFile(rootEnvPath) || {};
  const merged = { ...example, ...rootEnv, ...e2eEnv };

  const missingKeys = [];
  const placeholderKeys = [];
  for (const key of REQUIRED) {
    let val = merged[key];
    if (key === 'BASE_URL' && (!val || String(val).trim() === '')) val = merged.SYSTEM_URL;
    if (!val || String(val).trim() === '') missingKeys.push(key);
    else if (isPlaceholder(key, val)) placeholderKeys.push(key);
  }

  const recommendedMissing = RECOMMENDED.filter((k) => !merged[k] || isPlaceholder(k, merged[k]));

  const files = walkFiles(ROOT);
  const robotFiles = files.filter((f) => f.endsWith('.robot'));
  const reqFiles = [
    join(ROOT, 'requirements.txt'),
    join(ROOT, 'requirements-dev.txt'),
    join(ROOT, 'robot', 'requirements.txt'),
    join(ROOT, 'e2e', 'robot', 'requirements.txt'),
  ].filter((p) => existsSync(p));
  const robotInReqs = reqFiles.some((p) => /robotframework/i.test(readFileSync(p, 'utf8')));

  const playwrightConfig = [
    join(ROOT, 'e2e', 'playwright.config.ts'),
    join(ROOT, 'e2e', 'playwright.config.js'),
    join(ROOT, 'playwright.config.ts'),
    join(ROOT, 'playwright.config.js'),
  ].find((p) => existsSync(p));

  const e2ePkg = join(ROOT, 'e2e', 'package.json');
  const e2eModules = join(ROOT, 'e2e', 'node_modules', '@playwright', 'test');
  const playwrightInstalled = existsSync(e2eModules) || existsSync(join(ROOT, 'node_modules', '@playwright', 'test'));

  const hasPlaywright = Boolean(playwrightConfig || existsSync(e2ePkg));
  const hasRobot = robotFiles.length > 0 || robotInReqs;
  let stack = 'none';
  if (hasPlaywright && hasRobot) stack = 'playwright+robot';
  else if (hasPlaywright) stack = 'playwright';
  else if (hasRobot) stack = 'robot';

  const robotInstalled = hasRobot ? cmdOk('python', ['-m', 'robot', '--version'], ROOT) || cmdOk('robot', ['--version'], ROOT) : false;

  const envReady = missingKeys.length === 0 && placeholderKeys.length === 0;
  const toolReady =
    stack === 'none'
      ? false
      : stack.includes('playwright')
        ? Boolean(playwrightConfig) && playwrightInstalled
        : robotInstalled;

  const ready = envReady && (stack === 'none' ? false : toolReady);

  const output = {
    root: ROOT,
    envExample: examplePath,
    envFiles: {
      e2e: existsSync(e2eEnvPath) ? e2eEnvPath : null,
      root: existsSync(rootEnvPath) ? rootEnvPath : null,
    },
    exampleKeys: Object.keys(example),
    missingKeys,
    placeholderKeys,
    recommendedMissing,
    stack,
    playwright: {
      config: playwrightConfig || null,
      packageJson: existsSync(e2ePkg),
      nodeModules: playwrightInstalled,
    },
    robot: {
      files: robotFiles.length,
      requirements: robotInReqs,
      installed: robotInstalled,
    },
    envReady,
    toolReady,
    ready,
    next: !envReady
      ? 'ask-env'
      : stack === 'none' || (hasPlaywright && !playwrightInstalled) || (hasRobot && !robotInstalled)
        ? 'install-tools'
        : 'ok',
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('PREFLIGHT — Esteira QA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Exemplo .env:', examplePath || '(não encontrado — use e2e/.env.example)');
  console.log('Stack:', stack);
  console.log('Env ready:', envReady);
  console.log('Missing:', missingKeys.join(', ') || '—');
  console.log('Placeholder:', placeholderKeys.join(', ') || '—');
  console.log('Playwright config:', playwrightConfig || 'não');
  console.log('Playwright modules:', playwrightInstalled);
  console.log('Robot files:', robotFiles.length, '| installed:', robotInstalled);
  console.log('Next:', output.next);
  console.log('Ready:', ready);
}

main();
