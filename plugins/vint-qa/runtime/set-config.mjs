#!/usr/bin/env node
/**
 * Grava valores informados pelo usuário em .hub-projeto.json (hub.*) e .env (env.*).
 * Valores de .env nunca são impressos.
 *
 *   vqa set hub.projeto=site-x hub.email=qa@empresa.com hub.plataforma=azure
 *   vqa set hub.ambientes.tst.url=https://app-tst... hub.ambientes.tst.api=https://api-tst...
 *   vqa set env.TEST_USER=qa "env.TEST_PASSWORD=minha senha"
 *   vqa set --use-env tst        copia a URL/API do ambiente para BASE_URL/SYSTEM_URL/API_BASE_URL
 */
import { readFileSync } from 'fs';
import { ENV_FILE, HUB_FILE, pluginPath, projectPath, readHub, setPath, writeHub } from './lib/project.mjs';
import { upsertEnv } from './lib/envfile.mjs';

const argv = process.argv.slice(2);
const hubUpdates = {};
const envUpdates = {};
const errors = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') continue;
  if (a === '--use-env') {
    const name = argv[++i];
    const hub = readHub() || {};
    const amb = hub.ambientes?.[name];
    if (!amb?.url) {
      errors.push(`Ambiente "${name}" sem url em ${HUB_FILE} (ambientes.${name}.url).`);
      continue;
    }
    envUpdates.BASE_URL = amb.url;
    envUpdates.SYSTEM_URL = amb.url;
    envUpdates.API_BASE_URL = amb.api || amb.url;
    hubUpdates.ambientePadrao = name;
    continue;
  }
  const eq = a.indexOf('=');
  if (eq < 1) {
    errors.push(`Argumento inválido: ${a} (use hub.chave=valor ou env.CHAVE=valor)`);
    continue;
  }
  const key = a.slice(0, eq);
  let value = a.slice(eq + 1);
  if (key.startsWith('hub.')) {
    if (/^\s*[[{]/.test(value)) {
      try {
        value = JSON.parse(value);
      } catch {
        /* mantém string */
      }
    }
    hubUpdates[key.slice(4)] = value;
  } else if (key.startsWith('env.')) {
    envUpdates[key.slice(4)] = value;
  } else {
    errors.push(`Chave sem prefixo hub. ou env.: ${key}`);
  }
}

if (Object.keys(hubUpdates).length) {
  const hub = readHub() || JSON.parse(readFileSync(pluginPath('scaffold', 'project', 'hub-projeto.template.json'), 'utf8'));
  for (const [k, v] of Object.entries(hubUpdates)) {
    if (k === 'azure.organizacao') {
      const m = String(v).match(/dev\.azure\.com\/([^/?#]+)/i);
      setPath(hub, k, m ? decodeURIComponent(m[1]) : String(v).trim());
    } else setPath(hub, k, v);
  }
  writeHub(hub);
}

let envKeys = [];
if (Object.keys(envUpdates).length) {
  const template = readFileSync(pluginPath('scaffold', 'project', 'env.template'), 'utf8');
  envKeys = upsertEnv(projectPath(ENV_FILE), envUpdates, { templateText: template });
  const e2eEnv = projectPath('e2e', ENV_FILE);
  const syncKeys = Object.fromEntries(
    Object.entries(envUpdates).filter(([k]) => /^(BASE_URL|SYSTEM_URL|API_BASE_URL|TEST_|AUTH_)/.test(k)),
  );
  if (Object.keys(syncKeys).length) {
    try {
      readFileSync(e2eEnv);
      upsertEnv(e2eEnv, syncKeys);
    } catch {
      /* e2e/.env ainda não existe — Playwright lê o .env da raiz */
    }
  }
}

const out = {
  hub: Object.keys(hubUpdates),
  env: envKeys,
  errors,
};
console.log(JSON.stringify(out, null, 2));
if (errors.length) process.exitCode = 1;
