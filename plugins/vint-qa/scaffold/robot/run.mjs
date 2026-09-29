#!/usr/bin/env node
/** Carrega e2e/.env e .env da raiz, depois executa Robot. */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E2E = resolve(HERE, '..');
const ROOT = resolve(E2E, '..');

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(join(ROOT, '.env'));
loadEnv(join(E2E, '.env'));

const extra = process.argv.slice(2);
const r = spawnSync('python', ['-m', 'robot', ...extra], {
  cwd: HERE,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(r.status ?? 1);
