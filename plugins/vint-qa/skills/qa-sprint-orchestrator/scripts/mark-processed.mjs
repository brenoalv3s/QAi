#!/usr/bin/env node
/**
 * Marca PBI/task como processados pelo orquestrador QA.
 * Uso:
 *   node mark-processed.mjs --pbi 1234 --doc-task 1240 --wiki-url "..." --test-plan-url "..."
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import { ORG, PROJECT, PROJECT_ENC, loadPat } from '../../../runtime/lib/azure.mjs';

const TAG = 'qa-orchestrator-done';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-/g, '_');
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

async function api(pat, path, options = {}) {
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, {
    headers: { ...authHeader(pat), 'Content-Type': 'application/json-patch+json', ...options.headers },
    method: options.method || 'GET',
    body: options.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function getWorkItem(pat, id) {
  return api(pat, `/_apis/wit/workitems/${id}?api-version=7.1`);
}

function mergeTags(existing) {
  const tags = (existing || '').split(';').map((t) => t.trim()).filter(Boolean);
  if (!tags.includes(TAG)) tags.push(TAG);
  return tags.join('; ');
}

function buildComment(wikiUrl, testPlanUrl) {
  const lines = [
    '**QA Orchestrator** — pipeline concluído automaticamente.',
    '',
    wikiUrl ? `- **Documento de Teste (wiki):** ${wikiUrl}` : '- Documento de Teste publicado na wiki',
    testPlanUrl ? `- **Cenários (Test Plan):** ${testPlanUrl}` : '- Cenários publicados no Test Plan',
    '',
    `_Processado em ${new Date().toISOString()}_`,
  ];
  return lines.join('\n');
}

async function patchWorkItem(pat, id, ops) {
  return api(pat, `/_apis/wit/workitems/${id}?api-version=7.1`, {
    method: 'PATCH',
    body: JSON.stringify(ops),
  });
}

async function addComment(pat, id, text) {
  return api(pat, `/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pbiId = Number(args.pbi);
  const docTaskId = Number(args.doc_task);
  const wikiUrl = args.wiki_url || '';
  const testPlanUrl = args.test_plan_url || '';
  const markDone = process.env.QA_ORCHESTRATOR_MARK_DONE === 'true' || args.mark_done === true;

  if (!pbiId || !docTaskId) {
    console.error('Uso: --pbi <id> --doc-task <id> [--wiki-url ...] [--test-plan-url ...]');
    process.exit(1);
  }

  const pat = loadPat();
  const comment = buildComment(wikiUrl, testPlanUrl);

  for (const id of [pbiId, docTaskId]) {
    const item = await getWorkItem(pat, id);
    const ops = [{ op: 'add', path: '/fields/System.Tags', value: mergeTags(item.fields['System.Tags']) }];
    if (id === docTaskId && markDone) {
      ops.push({ op: 'add', path: '/fields/System.State', value: 'Done' });
    }
    await patchWorkItem(pat, id, ops);
    await addComment(pat, id, comment);
    console.log(`✅ #${id} — tag ${TAG}${id === docTaskId && markDone ? ' + Done' : ''}`);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
