/**
 * Resolução de caminhos e leitura de configuração do projeto aberto no Cursor.
 *
 * - PLUGIN_ROOT: pasta onde o plugin vint-qa está instalado (cache do Cursor ou ~/.cursor/plugins/local).
 * - PROJECT_ROOT: raiz do projeto do usuário (VINT_QA_PROJECT_DIR > CURSOR_PROJECT_DIR > busca a partir do cwd).
 *
 * Nenhum valor de projeto é fixo aqui: tudo vem de `.hub-projeto.json` (configuração) e `.env` (segredos/URLs).
 */
import { existsSync, readFileSync, realpathSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HUB_FILE = '.hub-projeto.json';
export const ENV_FILE = '.env';
export const USER_HOME_DIR = join(homedir(), '.vint-qa');

const PROJECT_MARKERS = [HUB_FILE, '.git', '.cursor', 'package.json', 'e2e', 'robot'];
const IS_WIN = process.platform === 'win32';

/** Caminho canônico (expande nomes curtos 8.3 do Windows e links). */
function canonical(p) {
  let r;
  try {
    r = realpathSync.native(p);
  } catch {
    r = resolve(p);
  }
  return IS_WIN ? r.toLowerCase() : r;
}

/** A pasta pessoal do usuário e as pastas acima dela nunca são raiz de projeto. */
function isHomeOrAbove(dir) {
  const d = canonical(dir);
  const home = canonical(homedir());
  return d === home || home.startsWith(d.endsWith(sep) ? d : d + sep);
}

export function findProjectRoot(start = process.cwd()) {
  const origin = realpathOrResolve(start);
  for (const markers of [[HUB_FILE], PROJECT_MARKERS]) {
    let dir = origin;
    for (let i = 0; i < 25; i++) {
      if (isHomeOrAbove(dir)) break;
      if (markers.some((m) => existsSync(join(dir, m)))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return origin;
}

function realpathOrResolve(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return resolve(p);
  }
}

/** Ignora valores não interpolados (ex.: "${workspaceFolder}") e pastas inexistentes. */
export function usableDir(value) {
  return value && !value.includes('${') && existsSync(value) ? realpathOrResolve(value) : null;
}

export const PROJECT_ROOT =
  usableDir(process.env.VINT_QA_PROJECT_DIR) || usableDir(process.env.CURSOR_PROJECT_DIR) || findProjectRoot(process.cwd());

export function projectPath(...parts) {
  return join(PROJECT_ROOT, ...parts);
}

export function pluginPath(...parts) {
  return join(PLUGIN_ROOT, ...parts);
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function pluginVersion() {
  return readJson(pluginPath('.cursor-plugin', 'plugin.json'), {})?.version || '0.0.0';
}

/* ------------------------------------------------------------------ .env */

export function parseEnvText(text) {
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
    } else {
      const hash = val.indexOf(' #');
      if (hash >= 0) val = val.slice(0, hash).trim();
    }
    out[key] = val;
  }
  return out;
}

export function readEnvFile(path = projectPath(ENV_FILE)) {
  if (!existsSync(path)) return null;
  return parseEnvText(readFileSync(path, 'utf8'));
}

/** Variáveis efetivas: e2e/.env < .env da raiz < process.env. */
export function readProjectEnv() {
  return {
    ...(readEnvFile(projectPath('e2e', ENV_FILE)) || {}),
    ...(readEnvFile(projectPath(ENV_FILE)) || {}),
  };
}

const ENV_ALIASES = {
  SGD_APP_URL: 'BASE_URL',
  SGD_API_BASE_URL: 'API_BASE_URL',
  SGD_TEST_USER: 'TEST_USER',
  SGD_TEST_PASSWORD: 'TEST_PASSWORD',
  SGD_AUTH_LOGIN_PATH: 'AUTH_LOGIN_PATH',
  SGD_AUTH_BODY_FORMAT: 'AUTH_BODY_FORMAT',
  SGD_AUTH_BODY: 'AUTH_BODY',
  SGD_SWAGGER_URL: 'SWAGGER_URL',
  SGD_OPENAPI_URL: 'OPENAPI_URL',
  SGD_TOKEN_CACHE: 'TOKEN_CACHE',
};

/** Carrega o .env do projeto em process.env sem sobrescrever variáveis já definidas. */
export function loadEnvIntoProcess() {
  const env = readProjectEnv();
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
  for (const [legacy, modern] of Object.entries(ENV_ALIASES)) {
    if (!process.env[modern] && process.env[legacy]) process.env[modern] = process.env[legacy];
    if (!process.env[legacy] && process.env[modern]) process.env[legacy] = process.env[modern];
  }
  if (!process.env.BASE_URL && process.env.SYSTEM_URL) process.env.BASE_URL = process.env.SYSTEM_URL;
  if (!process.env.SYSTEM_URL && process.env.BASE_URL) process.env.SYSTEM_URL = process.env.BASE_URL;
  return env;
}

/* ------------------------------------------------------- .hub-projeto.json */

export function readHub() {
  return readJson(projectPath(HUB_FILE), null);
}

export function writeHub(data) {
  writeJson(projectPath(HUB_FILE), data);
}

export function getPath(obj, dotted) {
  return String(dotted)
    .split('.')
    .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

export function setPath(obj, dotted, value) {
  const keys = String(dotted).split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

const PLACEHOLDER_RE =
  /exemplo\.com|seu_usuario|sua_senha|sua_org|seu_projeto|seu_pat|seu_token|your_|change-?me|placeholder|<<|>>|^todo$|^xxx|senha_inativo|usuario_inativo|usuario_excluido/i;

export function isFilled(value) {
  if (value == null) return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  const s = String(value).trim();
  return s !== '' && !PLACEHOLDER_RE.test(s);
}

/** Slug usado em docs/test-docs/{slug}, docs/test-scenarios/{slug}. */
export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

loadEnvIntoProcess();
