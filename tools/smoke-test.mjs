#!/usr/bin/env node
/**
 * Teste de fumaça do plugin: roda o fluxo do /vint-qa num projeto e num HOME temporários.
 *
 *   node tools/smoke-test.mjs [--keep]
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(REPO, 'plugins', 'vint-qa');
const TMP = mkdtempSync(join(tmpdir(), 'vint-qa-smoke-'));
const HOME = join(TMP, 'home');
const PROJECT = join(TMP, 'projeto-exemplo');
const LAUNCHER = join(HOME, '.vint-qa', 'vqa.mjs');

const baseEnv = { ...process.env, HOME, USERPROFILE: HOME };
for (const k of ['VINT_QA_PLUGIN_ROOT', 'VINT_QA_PROJECT_DIR', 'CURSOR_PROJECT_DIR', 'AZURE_DEVOPS_PAT', 'BASE_URL', 'TEST_USER', 'TEST_PASSWORD']) {
  delete baseEnv[k];
}

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? '✅' : '❌'} ${name}${!cond && detail ? `\n   ${detail}` : ''}`);
  if (!cond) failures++;
}

function node(args, { cwd = PROJECT, input, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, { cwd, input, encoding: 'utf8', env: { ...baseEnv, ...env }, timeout: 120_000 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

function vqa(...args) {
  const r = node([LAUNCHER, ...args]);
  let json = null;
  try {
    json = JSON.parse(r.out);
  } catch {
    /* saída não JSON */
  }
  return { ...r, json };
}

mkdirSync(HOME, { recursive: true });
mkdirSync(PROJECT, { recursive: true });

// 1. Hook sessionStart instala o launcher
const hook = node([join(PLUGIN, 'hooks', 'session-start.mjs')], { cwd: PROJECT, input: '{}', env: { CURSOR_PLUGIN_ROOT: PLUGIN } });
let hookOut = {};
try {
  hookOut = JSON.parse(hook.out);
} catch {
  /* inválido */
}
check('hook sessionStart devolve JSON com env e contexto', Boolean(hookOut.env?.VINT_QA_PLUGIN_ROOT && hookOut.additional_context), hook.out + hook.err);
check('launcher instalado em ~/.vint-qa/vqa.mjs', existsSync(LAUNCHER));

// 2. Launcher
const ver = vqa('--version');
check('vqa --version', ver.code === 0 && /\d+\.\d+\.\d+/.test(ver.out), ver.out + ver.err);

// 3. init
const init = vqa('init', '--json');
check('init cria .hub-projeto.json e .env', existsSync(join(PROJECT, '.hub-projeto.json')) && existsSync(join(PROJECT, '.env')), init.out + init.err);
const gi = existsSync(join(PROJECT, '.gitignore')) ? readFileSync(join(PROJECT, '.gitignore'), 'utf8') : '';
check('init protege .env e .cursor/mcp.json no .gitignore', /^\.env$/m.test(gi) && gi.includes('.cursor/mcp.json'));

// 4. validate com arquivos vazios
const v1 = vqa('validate', '--action', 'manual', '--json');
check('validate aponta campos faltantes', v1.json?.ok === false && v1.json?.next === 'ask-user' && v1.json.missing.some((m) => m.key === 'hub.projeto'), v1.out);

// 5. set
const s1 = vqa(
  'set',
  'hub.projeto=projeto-exemplo',
  'hub.email=qa@example.org',
  'hub.plataforma=local',
  'hub.ambientes.tst.url=https://tst.example.org',
  'hub.ambientes.tst.api=https://api-tst.example.org',
  'env.TEST_USER=usuario.teste',
  'env.TEST_PASSWORD=Segredo#123',
);
check('set grava hub e env', s1.code === 0, s1.out + s1.err);
check('set não imprime segredos', !s1.out.includes('Segredo#123') && !s1.err.includes('Segredo#123'));
const s2 = vqa('set', '--use-env', 'tst');
const envText = readFileSync(join(PROJECT, '.env'), 'utf8');
check('set --use-env copia URL do ambiente para BASE_URL', s2.code === 0 && /^BASE_URL=https:\/\/tst\.example\.org$/m.test(envText), s2.out + s2.err);

// 6. validate ok
const v2 = vqa('validate', '--action', 'manual', '--json');
check('validate manual ok após preencher', v2.json?.ok === true, v2.out);
const v3 = vqa('validate', '--action', 'automated', '--json');
check('validate automated pede o framework', v3.json?.missing?.some((m) => m.key === 'hub.frameworkAutomacao' && m.choices?.length), v3.out);

// 7. sync-mcp (plataforma local não precisa de MCP)
const sm = vqa('sync-mcp', '--json');
check('sync-mcp com plataforma local', sm.code === 0 && sm.json?.next === 'ok', sm.out + sm.err);

// 8. scaffold Playwright sem instalar dependências
const sc = vqa('scaffold', '--framework', 'playwright', '--json');
check('scaffold playwright cria e2e/', existsSync(join(PROJECT, 'e2e', 'playwright.config.ts')), sc.out + sc.err);

// 9. RAG via CLI
const learn = vqa('rag', 'learn', '--title', 'Botão salvar fica desabilitado até validar CPF', '--content', 'Na tela de cadastro o botão Salvar só habilita após o blur do campo CPF.', '--categoria', 'regra-de-negocio', '--json');
check('rag learn grava aprendizado', learn.json?.file?.startsWith('.vint-qa/learnings/'), learn.out + learn.err);
const leak = vqa('rag', 'learn', '--title', 'x', '--content', 'token=abc123XYZ987 do ambiente', '--json');
check('rag learn recusa segredo', leak.code !== 0 && leak.json?.ok === false, leak.out);
const rs = vqa('rag', 'search', 'salvar desabilitado CPF', '--json');
check('rag search encontra o aprendizado', rs.json?.results?.[0]?.kind === 'learning', rs.out + rs.err);

// 10. RAG via MCP (stdio)
const msgs = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'rag_search', arguments: { query: 'CPF salvar', projectDir: PROJECT } } },
];
const mcp = node([join(PLUGIN, 'rag', 'server.mjs')], { input: msgs.map((m) => JSON.stringify(m)).join('\n') + '\n' });
const replies = mcp.out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
check('MCP initialize', byId[1]?.result?.serverInfo?.name === 'vint-qa-rag', mcp.out + mcp.err);
check('MCP tools/list', byId[2]?.result?.tools?.length === 4);
check('MCP rag_search', /learning/.test(byId[3]?.result?.content?.[0]?.text || ''), JSON.stringify(byId[3]));
check('MCP não escreve lixo no stdout', replies.every((r) => r.jsonrpc === '2.0'));

// 11. MCP robotmcp numa máquina sem uv nem Python: sobe o servidor reserva em vez de falhar
const robotMsgs = [msgs[0], { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'robotmcp_status', arguments: {} } }];
const bare = { PATH: dirname(process.execPath), LOCALAPPDATA: HOME, APPDATA: HOME, UV_INSTALL_DIR: '' };
const robot = node([join(PLUGIN, 'runtime', 'mcp-robot.mjs')], { input: robotMsgs.map((m) => JSON.stringify(m)).join('\n') + '\n', env: bare });
let robotReplies = [];
try {
  robotReplies = robot.out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
} catch {
  /* inválido */
}
const robotById = Object.fromEntries(robotReplies.map((r) => [r.id, r]));
check('MCP robotmcp sem uv responde initialize', Boolean(robotById[1]?.result?.serverInfo), robot.out + robot.err);
check('MCP robotmcp sem uv expõe robotmcp_status', robotById[2]?.result?.tools?.[0]?.name === 'robotmcp_status');
check('robotmcp_status explica como ativar', /doctor --install/.test(robotById[3]?.result?.content?.[0]?.text || ''));

// 12. startup (sem instalar nada)
const st = vqa('startup', '--json');
check('startup devolve next', typeof st.json?.next === 'string', st.out + st.err);

console.log(`\n${failures ? '❌' : '✅'} smoke test — ${failures} falha(s)  [${TMP}]`);
if (!process.argv.includes('--keep')) rmSync(TMP, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
