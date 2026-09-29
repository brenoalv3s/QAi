#!/usr/bin/env node
/**
 * Lançador estável do plugin vint-qa — copiado para $HOME/.vint-qa/vqa.mjs pelo hook de sessão.
 *
 * O Cursor instala plugins em pastas que mudam a cada versão (~/.cursor/plugins/cache/<marketplace>/vint-qa/<sha>).
 * Este arquivo fica num caminho fixo e descobre a instalação atual para os agentes chamarem:
 *
 *   node "$HOME/.vint-qa/vqa.mjs" <comando> [args]
 *
 * Ordem: VINT_QA_PLUGIN_ROOT > ~/.vint-qa/runtime.json (gravado pelo hook) > busca nas pastas de plugins do Cursor.
 */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';

const NAME = 'vint-qa';
const HOME_DIR = join(homedir(), '.vint-qa');

function isPluginRoot(dir) {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, '.cursor-plugin', 'plugin.json'), 'utf8'));
    return manifest.name === NAME && existsSync(join(dir, 'runtime', 'cli.mjs'));
  } catch {
    return false;
  }
}

function scan(base, depth, found) {
  if (depth < 0 || !existsSync(base)) return;
  let entries;
  try {
    entries = readdirSync(base, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(base, e.name);
    if (isPluginRoot(full)) {
      let mtime = 0;
      try {
        mtime = statSync(join(full, '.cursor-plugin', 'plugin.json')).mtimeMs;
      } catch {
        /* ignore */
      }
      found.push({ dir: full, mtime });
    } else scan(full, depth - 1, found);
  }
}

function projectDirFromCwd() {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 25; i++) {
    if (existsSync(join(dir, '.hub-projeto.json')) || existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
}

function resolvePluginRoot() {
  if (process.env.VINT_QA_PLUGIN_ROOT && isPluginRoot(process.env.VINT_QA_PLUGIN_ROOT)) return process.env.VINT_QA_PLUGIN_ROOT;
  try {
    const rt = JSON.parse(readFileSync(join(HOME_DIR, 'runtime.json'), 'utf8'));
    if (rt.pluginRoot && isPluginRoot(rt.pluginRoot)) return rt.pluginRoot;
  } catch {
    /* sem runtime.json */
  }
  const found = [];
  const cursorPlugins = join(homedir(), '.cursor', 'plugins');
  scan(join(cursorPlugins, 'local'), 2, found);
  scan(join(cursorPlugins, 'cache'), 4, found);
  scan(join(projectDirFromCwd(), '.cursor', 'plugins'), 4, found);
  const local = found.find((f) => f.dir.includes(join('plugins', 'local')));
  if (local) return local.dir;
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0]?.dir || null;
}

const root = resolvePluginRoot();
if (!root) {
  console.error(
    'vint-qa: plugin não encontrado. Instale o plugin "vint-qa" pelo marketplace do time no Cursor (Customize → Plugins) e recarregue a janela.',
  );
  process.exit(3);
}

const r = spawnSync(process.execPath, [join(root, 'runtime', 'cli.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VINT_QA_PLUGIN_ROOT: root },
});
process.exit(r.status ?? 1);
