#!/usr/bin/env node
/**
 * Instala/atualiza $HOME/.vint-qa/vqa.mjs e $HOME/.vint-qa/runtime.json apontando para esta instalação do plugin.
 * Chamado pelo hook sessionStart; pode ser executado manualmente:
 *
 *   node "<raiz-do-plugin>/runtime/install-launcher.mjs"
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PLUGIN_ROOT, USER_HOME_DIR, pluginVersion } from './lib/project.mjs';

export function installLauncher() {
  mkdirSync(USER_HOME_DIR, { recursive: true });
  const src = join(PLUGIN_ROOT, 'runtime', 'launcher.mjs');
  const dest = join(USER_HOME_DIR, 'vqa.mjs');
  const srcText = readFileSync(src, 'utf8');
  if (!existsSync(dest) || readFileSync(dest, 'utf8') !== srcText) copyFileSync(src, dest);
  const runtime = { pluginRoot: PLUGIN_ROOT, version: pluginVersion(), updatedAt: new Date().toISOString() };
  writeFileSync(join(USER_HOME_DIR, 'runtime.json'), JSON.stringify(runtime, null, 2) + '\n');
  return { launcher: dest, ...runtime };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('runtime/install-launcher.mjs')) {
  console.log(JSON.stringify(installLauncher(), null, 2));
}
