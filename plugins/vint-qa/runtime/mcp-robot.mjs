#!/usr/bin/env node
/**
 * Inicia o MCP do Robot Framework (rf-mcp) sem depender do PATH do Cursor.
 *
 *   1. uvx --from rf-mcp robotmcp   (uvx do PATH ou das pastas de instalação conhecidas)
 *   2. python -m robotmcp.server    (quando rf-mcp já está instalado no Python)
 *   3. servidor reserva: responde ao protocolo MCP com a tool robotmcp_status, que explica o que falta.
 *
 * Se o servidor real encerrar antes de responder, as mensagens recebidas são repassadas ao servidor reserva,
 * então o Cursor nunca vê "Connection closed" por falta de instalação.
 * stdout é exclusivo do protocolo; logs vão para stderr.
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { PassThrough } from 'stream';
import { pluginVersion } from './lib/project.mjs';
import { IS_WIN, run } from './lib/sys.mjs';
import { findUvx } from './lib/uv.mjs';

const log = (msg) => process.stderr.write(`[vint-qa robotmcp] ${msg}\n`);

function pythonWithRobotMcp() {
  for (const py of IS_WIN ? ['python', 'py', 'python3'] : ['python3', 'python']) {
    if (run(py, ['-c', 'import robotmcp.server'], { timeout: 20_000 }).ok) return py;
  }
  return null;
}

function resolveServer() {
  const uvx = findUvx();
  if (uvx) return { cmd: uvx, args: ['--from', 'rf-mcp', 'robotmcp'] };
  const py = pythonWithRobotMcp();
  if (py) return { cmd: py, args: ['-m', 'robotmcp.server'] };
  return null;
}

const HOW_TO_FIX = [
  'Como ativar:',
  '1. Rode /vint-qa num chat (o preflight instala o uv) ou, no terminal: node "$HOME/.vint-qa/vqa.mjs" doctor --install --force',
  '2. Em Customize → vint-qa → MCPs, desligue e ligue o robotmcp (ou reinicie o Cursor).',
  'Alternativa sem uv: python -m pip install --user rf-mcp',
].join('\n');

function startFallback(reason, input) {
  log(`servidor reserva ativo: ${reason}`);
  const status = `O MCP do Robot Framework (rf-mcp) não está disponível nesta máquina.\nMotivo: ${reason}\n\n${HOW_TO_FIX}`;
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });

  const handle = (msg) => {
    if (!msg || typeof msg !== 'object' || !msg.method) return;
    const { id, method, params } = msg;
    const isNotification = id === undefined || id === null;
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'robotmcp (vint-qa)', version: pluginVersion() },
          instructions: `robotmcp indisponível. Chame robotmcp_status para ver o motivo. ${reason}`,
        });
      case 'ping':
        return reply(id, {});
      case 'tools/list':
        return reply(id, {
          tools: [
            {
              name: 'robotmcp_status',
              description:
                'O MCP do Robot Framework não está disponível nesta máquina (falta uv/uvx ou rf-mcp). Chame para ver o motivo e como ativar antes de automatizar com Robot.',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        });
      case 'tools/call':
        return reply(id, { content: [{ type: 'text', text: status }], isError: params?.name !== 'robotmcp_status' });
      case 'resources/list':
        return reply(id, { resources: [] });
      case 'prompts/list':
        return reply(id, { prompts: [] });
      default:
        if (!isNotification) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método não suportado: ${method}` } });
    }
  };

  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const s = line.trim();
    if (!s) return;
    try {
      const msg = JSON.parse(s);
      if (Array.isArray(msg)) msg.forEach(handle);
      else handle(msg);
    } catch {
      /* linha inválida */
    }
  });
  rl.on('close', () => process.exit(0));
}

function startReal(server) {
  const received = [];
  let answered = false;
  let inputEnded = false;
  let fellBack = false;
  let stderrTail = '';

  const child = spawn(server.cmd, server.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

  const onInput = (chunk) => {
    if (!answered) received.push(chunk);
    if (child.stdin.writable) child.stdin.write(chunk);
  };
  process.stdin.on('data', onInput);
  process.stdin.on('end', () => {
    inputEnded = true;
    child.stdin.end();
  });
  child.stdin.on('error', () => {});

  child.stdout.on('data', (chunk) => {
    answered = true;
    received.length = 0;
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    stderrTail = (stderrTail + chunk.toString()).slice(-600);
  });

  const fallback = (reason) => {
    if (fellBack) return;
    fellBack = true;
    process.stdin.off('data', onInput);
    const replay = new PassThrough();
    for (const chunk of received) replay.write(chunk);
    if (inputEnded) replay.end();
    else process.stdin.pipe(replay);
    startFallback(reason, replay);
  };

  child.on('error', (err) => {
    if (!answered) fallback(`não foi possível iniciar ${server.cmd}: ${err.message}`);
  });
  child.on('close', (code, signal) => {
    if (answered) process.exit(code ?? (signal ? 1 : 0));
    const detail = stderrTail.trim().split(/\r?\n/).slice(-3).join(' | ');
    fallback(`o servidor encerrou ao iniciar (código ${code ?? signal})${detail ? `: ${detail}` : ''}`);
  });

  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
}

const server = resolveServer();
if (server) startReal(server);
else startFallback('uv/uvx não encontrado e o pacote rf-mcp não está instalado no Python.', process.stdin);
