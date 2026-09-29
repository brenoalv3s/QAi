#!/usr/bin/env node
/**
 * Cria ou mescla e2e/.env e .env da raiz a partir de e2e/.env.example + valores informados.
 * Não imprime senhas. Mescla com o .env existente (chaves novas/informadas).
 *
 *   node write-env.mjs --base-url https://hml... --test-user qa --test-password "segredo"
 *   node write-env.mjs --api-base-url https://hml... --auth-login-path /api/auth/login --auth-body-format login
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { PROJECT_ROOT as ROOT, PLUGIN_ROOT } from '../../../runtime/lib/project.mjs';

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

function parseEnv(text) {
  const order = [];
  const map = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      order.push({ comment: line });
      continue;
    }
    const i = t.indexOf('=');
    if (i < 1) {
      order.push({ comment: line });
      continue;
    }
    const key = t.slice(0, i).trim();
    order.push({ key });
    map[key] = t.slice(i + 1);
  }
  return { order, map };
}

function formatValue(val) {
  const v = String(val ?? '');
  if (/[\s#"']/.test(v)) return JSON.stringify(v);
  return v;
}

function findExample() {
  const candidates = [
    join(ROOT, 'e2e', '.env.example'),
    join(ROOT, '.env.example'),
    join(PLUGIN_ROOT, 'scaffold', 'project', 'env.template'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

const KEY_MAP = {
  base_url: 'BASE_URL',
  system_url: 'SYSTEM_URL',
  api_base_url: 'API_BASE_URL',
  test_user: 'TEST_USER',
  test_password: 'TEST_PASSWORD',
  test_user_inactive: 'TEST_USER_INACTIVE',
  test_password_inactive: 'TEST_PASSWORD_INACTIVE',
  test_user_deleted: 'TEST_USER_DELETED',
  test_password_deleted: 'TEST_PASSWORD_DELETED',
  auth_login_path: 'AUTH_LOGIN_PATH',
  auth_body_format: 'AUTH_BODY_FORMAT',
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const examplePath = findExample();
  if (!examplePath) {
    console.error('Modelo de .env não encontrado (e2e/.env.example ou modelo do plugin).');
    process.exit(1);
  }

  const example = parseEnv(readFileSync(examplePath, 'utf8'));
  const incoming = {};
  for (const [flag, envKey] of Object.entries(KEY_MAP)) {
    if (args[flag] && args[flag] !== true) incoming[envKey] = String(args[flag]);
  }
  if (incoming.BASE_URL && !incoming.SYSTEM_URL) incoming.SYSTEM_URL = incoming.BASE_URL;
  if (incoming.BASE_URL && !incoming.API_BASE_URL) incoming.API_BASE_URL = incoming.BASE_URL;

  if (!Object.keys(incoming).length) {
    console.error('Informe ao menos --base-url, --test-user e --test-password');
    process.exit(1);
  }

  const dests = [join(ROOT, 'e2e', '.env'), join(ROOT, '.env')];
  mkdirSync(join(ROOT, 'e2e'), { recursive: true });

  for (const dest of dests) {
    const existing = existsSync(dest) ? parseEnv(readFileSync(dest, 'utf8')) : { order: example.order.slice(), map: { ...example.map } };
    const map = { ...example.map, ...existing.map };
    for (const [k, v] of Object.entries(incoming)) {
      map[k] = formatValue(v);
    }
    const seen = new Set();
    const lines = [];
    const sourceOrder = existing.order.length ? existing.order : example.order;
    for (const item of sourceOrder) {
      if (item.comment != null) {
        lines.push(item.comment);
        continue;
      }
      seen.add(item.key);
      lines.push(`${item.key}=${map[item.key] ?? ''}`);
    }
    for (const [k, v] of Object.entries(map)) {
      if (seen.has(k)) continue;
      lines.push(`${k}=${v}`);
    }
    writeFileSync(dest, lines.join('\n').replace(/\n*$/, '\n'));
    console.log('OK', dest.replace(ROOT, '').replace(/^[\\/]/, ''));
  }

  const filled = Object.keys(incoming);
  console.log(JSON.stringify({ wrote: dests.map((p) => p.replace(ROOT + '\\', '').replace(ROOT + '/', '')), keys: filled }, null, 2));
}

main();
