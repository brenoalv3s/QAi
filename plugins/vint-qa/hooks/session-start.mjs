#!/usr/bin/env node
/**
 * Hook sessionStart do vint-qa: mantém $HOME/.vint-qa/vqa.mjs apontando para a versão instalada
 * e informa ao agente como chamar os scripts do plugin. Nunca falha a sessão.
 */
let output = {};
try {
  const { installLauncher } = await import('../runtime/install-launcher.mjs');
  const info = installLauncher();
  output = {
    env: { VINT_QA_PLUGIN_ROOT: info.pluginRoot },
    additional_context:
      `Plugin vint-qa ${info.version} instalado em: ${info.pluginRoot} ` +
      '(referido nos agentes/skills como {VINT_QA_ROOT}). ' +
      'Scripts do plugin: node "$HOME/.vint-qa/vqa.mjs" <comando|skills/...> — sempre a partir da raiz do projeto aberto. ' +
      'Menu da esteira de QA: /vint-qa.',
  };
} catch {
  output = {};
}
process.stdout.write(JSON.stringify(output));
