#!/usr/bin/env node
/**
 * Servidor MCP (stdio) da base de conhecimento vint-qa. Sem dependências.
 *
 * Tools: rag_search, rag_add_learning, rag_reindex, rag_stats.
 * O projeto é resolvido por: argumento projectDir → VINT_QA_PROJECT_DIR → roots/list do cliente → cwd.
 * stdout é exclusivo do protocolo; logs vão para stderr.
 */
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { pluginVersion } from '../runtime/lib/project.mjs';
import { LEARNING_CATEGORIES, addLearning, reindex, search, setRootsHint, stats } from './lib/engine.mjs';

const SERVER_INFO = { name: 'vint-qa-rag', version: pluginVersion() };
const DEFAULT_PROTOCOL = '2025-06-18';

const PROJECT_DIR_PROP = {
  type: 'string',
  description: 'Pasta raiz do projeto (opcional; por padrão usa o workspace aberto no Cursor).',
};

const TOOLS = [
  {
    name: 'rag_search',
    description:
      'Busca na base de conhecimento de QA: aprendizados do projeto (.vint-qa/learnings), documentos de teste, cenários, manifestos de regressão, código e2e e a base curada do plugin (skills, rules, knowledge). Use antes de escrever POM/spec, executar testes manuais ou investigar falhas.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'O que procurar (palavras-chave ou pergunta).' },
        k: { type: 'number', description: 'Quantidade de resultados (1-20, padrão 6).' },
        scope: { type: 'string', enum: ['all', 'project', 'plugin'], description: 'Onde buscar (padrão all).' },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['learning', 'test-doc', 'scenario', 'regression', 'wiki', 'code', 'knowledge', 'skill', 'rule', 'agent', 'command'],
          },
          description: 'Filtrar por tipo de conteúdo.',
        },
        projectDir: PROJECT_DIR_PROP,
      },
      required: ['query'],
    },
  },
  {
    name: 'rag_add_learning',
    description:
      'Registra um aprendizado reutilizável do projeto (locator estável, regra de negócio implícita, instabilidade de ambiente, massa de dados, comportamento de API). Grava em .vint-qa/learnings/ e reindexa. Nunca inclua senhas, tokens ou dados pessoais.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto e específico.' },
        content: { type: 'string', description: 'Contexto, o que foi descoberto e como aplicar (Markdown).' },
        categoria: { type: 'string', enum: LEARNING_CATEGORIES },
        tags: { type: 'array', items: { type: 'string' } },
        feature: { type: 'string', description: 'Feature relacionada (opcional).' },
        projectDir: PROJECT_DIR_PROP,
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'rag_reindex',
    description: 'Reindexa a base (incremental; force=true reconstrói tudo).',
    inputSchema: { type: 'object', properties: { force: { type: 'boolean' }, projectDir: PROJECT_DIR_PROP } },
  },
  {
    name: 'rag_stats',
    description: 'Mostra o que está indexado (projeto, arquivos por tipo, data do índice).',
    inputSchema: { type: 'object', properties: { projectDir: PROJECT_DIR_PROP } },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function toolResult(data, isError = false) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

function callTool(name, args = {}) {
  switch (name) {
    case 'rag_search': {
      if (!args.query || !String(args.query).trim()) return toolResult('Informe "query".', true);
      const r = search(String(args.query), { projectDir: args.projectDir, k: args.k, scope: args.scope || 'all', kinds: args.kinds });
      if (!r.results.length) {
        return toolResult({ ...r, hint: 'Nada encontrado. Tente outros termos, scope "all" ou rag_reindex.' });
      }
      return toolResult(r);
    }
    case 'rag_add_learning':
      return toolResult(addLearning(args));
    case 'rag_reindex':
      return toolResult(reindex({ projectDir: args.projectDir, force: Boolean(args.force) }));
    case 'rag_stats':
      return toolResult(stats({ projectDir: args.projectDir }));
    default:
      return null;
  }
}

let clientCaps = {};
let nextRequestId = 1;
const pending = new Map();

function requestRoots() {
  if (!clientCaps.roots) return;
  const id = `vint-qa-roots-${nextRequestId++}`;
  pending.set(id, (result) => {
    const uri = result?.roots?.find((r) => typeof r.uri === 'string' && r.uri.startsWith('file:'))?.uri;
    if (!uri) return;
    try {
      setRootsHint(fileURLToPath(uri));
    } catch {
      /* URI inválida */
    }
  });
  send({ jsonrpc: '2.0', id, method: 'roots/list' });
}

function handle(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.id !== undefined && !msg.method && (msg.result !== undefined || msg.error !== undefined)) {
    const cb = pending.get(msg.id);
    pending.delete(msg.id);
    if (cb && msg.result) cb(msg.result);
    return;
  }

  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize':
        clientCaps = params?.capabilities || {};
        return reply(id, {
          protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            'Base de conhecimento de QA do plugin vint-qa. Use rag_search antes de escrever automação, executar testes manuais ou investigar falhas; use rag_add_learning para registrar descobertas reutilizáveis (sem segredos).',
        });
      case 'notifications/initialized':
      case 'notifications/roots/list_changed':
        return requestRoots();
      case 'ping':
        return reply(id, {});
      case 'tools/list':
        return reply(id, { tools: TOOLS });
      case 'tools/call': {
        let result;
        try {
          result = callTool(params?.name, params?.arguments || {});
        } catch (e) {
          result = toolResult(e?.message || String(e), true);
        }
        if (!result) return replyError(id, -32602, `Tool desconhecida: ${params?.name}`);
        return reply(id, result);
      }
      case 'resources/list':
        return reply(id, { resources: [] });
      case 'prompts/list':
        return reply(id, { prompts: [] });
      default:
        if (!isNotification) replyError(id, -32601, `Método não suportado: ${method}`);
    }
  } catch (e) {
    process.stderr.write(`[vint-qa-rag] ${e?.stack || e}\n`);
    if (!isNotification) replyError(id, -32603, e?.message || 'Erro interno');
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try {
    msg = JSON.parse(s);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } });
  }
  if (Array.isArray(msg)) msg.forEach(handle);
  else handle(msg);
});
rl.on('close', () => process.exit(0));
