#!/usr/bin/env node
/**
 * Dispatcher do vint-qa. Normalmente chamado pelo lançador estável:
 *
 *   node "$HOME/.vint-qa/vqa.mjs" <comando> [args]
 *
 * Comandos:
 *   --root | --version | help
 *   startup | doctor | init | validate | set | sync-mcp | scaffold
 *   rag <index|search|learn|stats> ...
 *   skills/<skill>/scripts/<script>.mjs [args]     executa um script de skill no projeto atual
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { isAbsolute, join, normalize, relative } from 'path';
import { PLUGIN_ROOT, PROJECT_ROOT, pluginVersion } from './lib/project.mjs';

const COMMANDS = {
  startup: 'runtime/startup.mjs',
  doctor: 'runtime/doctor.mjs',
  init: 'runtime/init-project.mjs',
  validate: 'runtime/validate.mjs',
  set: 'runtime/set-config.mjs',
  'sync-mcp': 'runtime/sync-mcp.mjs',
  scaffold: 'runtime/scaffold.mjs',
  rag: 'rag/cli.mjs',
};

const [cmd, ...rest] = process.argv.slice(2);

function help() {
  console.log(`vint-qa ${pluginVersion()}
Plugin:  ${PLUGIN_ROOT}
Projeto: ${PROJECT_ROOT}

Uso: node "$HOME/.vint-qa/vqa.mjs" <comando> [args]
  startup [--install]        doctor + init + validate (antes do menu)
  doctor [--install]         verifica/instala ferramentas
  init                       cria .hub-projeto.json, .env e pastas
  validate --action <id>     confere o que a ação do menu exige
  set hub.x=y env.X=y        grava configuração
  sync-mcp                   gera o MCP da plataforma no .cursor/mcp.json
  scaffold --framework playwright|robot [--install]
  rag index|search|learn|stats
  skills/<skill>/scripts/<script>.mjs [args]`);
}

if (!cmd || cmd === 'help' || cmd === '--help') {
  help();
  process.exit(0);
}
if (cmd === '--root') {
  console.log(PLUGIN_ROOT);
  process.exit(0);
}
if (cmd === '--version') {
  console.log(pluginVersion());
  process.exit(0);
}

let target = COMMANDS[cmd];
if (!target) {
  const rel = normalize(cmd.replace(/^[\\/]+/, '').replace(/^\{VINT_QA_ROOT\}[\\/]/, ''));
  const abs = isAbsolute(cmd) ? cmd : join(PLUGIN_ROOT, rel);
  if (relative(PLUGIN_ROOT, abs).startsWith('..') || !existsSync(abs)) {
    console.error(`vint-qa: comando ou script desconhecido: ${cmd}`);
    help();
    process.exit(2);
  }
  target = relative(PLUGIN_ROOT, abs);
}

const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, target), ...rest], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  env: { ...process.env, VINT_QA_PLUGIN_ROOT: PLUGIN_ROOT, VINT_QA_PROJECT_DIR: PROJECT_ROOT },
});
process.exit(r.status ?? 1);
