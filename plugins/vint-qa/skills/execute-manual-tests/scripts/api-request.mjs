#!/usr/bin/env node
/**
 * Executa chamada API autenticada (Swagger).
 * Uso:
 *   node api-request.mjs --method GET --path /api/contratos
 *   node api-request.mjs --method POST --path /api/relatorios/carteira --body '{"filtro":{}}'
 *   node api-request.mjs --method GET --path /api/x --token "eyJ..." --save docs/test-evidence/.../response.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fetchAuthToken } from './lib/api-auth.mjs';

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

async function resolveToken(explicit) {
  if (explicit) return explicit;
  const cache = process.env.TOKEN_CACHE || '.vint-qa/cache/auth-token.json';
  if (existsSync(cache)) {
    const cached = JSON.parse(readFileSync(cache, 'utf8'));
    if (cached.token) return cached.token;
  }
  const auth = await fetchAuthToken();
  return auth.token;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const method = (args.method || 'GET').toUpperCase();
  const path = args.path;
  const save = args.save;
  const jsonOnly = args.json === true;

  if (!path) {
    console.error(`Uso: node api-request.mjs --method GET|POST|PUT|PATCH|DELETE --path /api/... \\
  [--body '{"k":"v"}'] [--token "..."] [--save path.json] [--json]`);
    process.exit(1);
  }

  const auth = await fetchAuthToken();
  const token = await resolveToken(args.token);
  const url = `${auth.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let body;
  if (args.body) {
    headers['Content-Type'] = 'application/json';
    body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
  }

  const started = Date.now();
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  const elapsed = Date.now() - started;

  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  const result = {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    method,
    url,
    elapsedMs: elapsed,
    body: parsed,
  };

  if (save) {
    const abs = resolve(save);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(result, null, 2));
    result.savedTo = abs;
  }

  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(res.ok ? 0 : 1);
  }

  console.log(`API ${method} ${path} → ${res.status} (${elapsed}ms)`);
  if (!res.ok) {
    console.error(typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500));
    process.exit(1);
  }
  if (save) console.log(`Salvo: ${result.savedTo}`);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
