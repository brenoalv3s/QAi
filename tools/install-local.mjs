#!/usr/bin/env node
/**
 * Instala o plugin vint-qa localmente (sem marketplace) em ~/.cursor/plugins/local/vint-qa.
 *
 *   node tools/install-local.mjs            # copia a versão atual
 *   node tools/install-local.mjs --link     # link (junction no Windows) para desenvolver o plugin
 *   node tools/install-local.mjs --uninstall
 *
 * Depois: reiniciar o Cursor (ou Developer: Reload Window) e rodar /vint-qa num chat novo.
 */
import { spawnSync } from 'child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(REPO, 'plugins', 'vint-qa');
const DEST_DIR = join(homedir(), '.cursor', 'plugins', 'local');
const DEST = join(DEST_DIR, 'vint-qa');
const args = process.argv.slice(2);

function removeExisting() {
  if (!existsSync(DEST) && !isLink(DEST)) return;
  rmSync(DEST, { recursive: true, force: true });
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

if (args.includes('--uninstall')) {
  removeExisting();
  rmSync(join(homedir(), '.vint-qa', 'vqa.mjs'), { force: true });
  rmSync(join(homedir(), '.vint-qa', 'runtime.json'), { force: true });
  console.log(`Removido: ${DEST}\nReinicie o Cursor para concluir.`);
  process.exit(0);
}

if (!existsSync(join(SRC, '.cursor-plugin', 'plugin.json'))) {
  console.error(`Plugin não encontrado em ${SRC}`);
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });
removeExisting();

if (args.includes('--link')) {
  symlinkSync(SRC, DEST, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`Link criado: ${DEST} → ${SRC}`);
} else {
  cpSync(SRC, DEST, {
    recursive: true,
    filter: (p) => !/[\\/](node_modules|\.vint-qa|cache)([\\/]|$)/.test(p.slice(SRC.length)),
  });
  console.log(`Copiado para ${DEST}`);
}

const r = spawnSync(process.execPath, [join(DEST, 'runtime', 'install-launcher.mjs')], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status || 1);
}
console.log(`Launcher: ${join(homedir(), '.vint-qa', 'vqa.mjs')}`);
console.log('Reinicie o Cursor (ou Developer: Reload Window) e rode /vint-qa num chat novo.');
