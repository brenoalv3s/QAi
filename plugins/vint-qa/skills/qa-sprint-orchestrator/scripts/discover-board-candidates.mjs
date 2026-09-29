#!/usr/bin/env node
/**
 * Descobre PBIs elegíveis para o orquestrador QA (gates do board).
 * Uso:
 *   node discover-board-candidates.mjs
 *   node discover-board-candidates.mjs --work-item 25867
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import { ORG, PROJECT, PROJECT_ENC, loadPat, ITERATION_ROOT } from '../../../runtime/lib/azure.mjs';


const DOC_TITLES = ['documentos de testes', 'documento de testes', 'documentos de teste', 'documento de teste'];
const REQ_TITLES = ['requisitos', 'requisito'];
const UX_TITLES = ['ux / ui', 'ui / ux', 'ux/ui', 'ui/ux'];

const IN_PROGRESS = new Set(['in progress', 'active', 'doing', 'em andamento', 'em progresso']);
const DONE = new Set(['done', 'closed', 'resolved', 'complete', 'concluido', 'concluído']);

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchesTitle(title, allowed) {
  const n = normalize(title);
  return allowed.some((a) => n === a || n.includes(a));
}

function isInProgress(fields) {
  const state = normalize(fields['System.State']);
  const col = normalize(fields['System.BoardColumn']);
  return IN_PROGRESS.has(state) || IN_PROGRESS.has(col);
}

function isDone(fields) {
  const state = normalize(fields['System.State']);
  const col = normalize(fields['System.BoardColumn']);
  if (fields['System.BoardColumnDone'] === true) return true;
  return DONE.has(state) || DONE.has(col);
}

async function api(pat, path, options = {}) {
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, {
    headers: { ...authHeader(pat), ...options.headers },
    method: options.method || 'GET',
    body: options.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function wiql(pat, query) {
  return api(pat, '/_apis/wit/wiql?api-version=7.1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

async function getWorkItem(pat, id) {
  return api(pat, `/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`);
}

async function getWorkItemsBatch(pat, ids) {
  if (!ids.length) return [];
  const body = { ids, fields: ['System.Id', 'System.Title', 'System.State', 'System.BoardColumn', 'System.BoardColumnDone', 'System.Parent', 'System.IterationPath', 'System.Tags', 'System.WorkItemType'] };
  const data = await api(pat, '/_apis/wit/workitemsbatch?api-version=7.1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return data.value || [];
}

function getParentId(item) {
  if (item.fields?.['System.Parent']) return item.fields['System.Parent'];
  const parentRel = (item.relations || []).find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
  if (!parentRel?.url) return null;
  const m = parentRel.url.match(/workItems\/(\d+)/i);
  return m ? Number(m[1]) : null;
}

function getChildIds(item) {
  return (item.relations || [])
    .filter((r) => r.rel === 'System.LinkTypes.Hierarchy-Forward')
    .map((r) => {
      const m = r.url.match(/workItems\/(\d+)/i);
      return m ? Number(m[1]) : null;
    })
    .filter(Boolean);
}

function hasProcessedTag(tags) {
  const t = normalize(tags || '');
  return t.includes('qa-orchestrator-done');
}

async function evaluateCandidate(pat, docTaskItem) {
  const docFields = docTaskItem.fields;
  const docId = docTaskItem.id;
  const parentId = getParentId(docTaskItem);

  const result = {
    docTaskId: docId,
    docTaskTitle: docFields['System.Title'],
    docState: docFields['System.State'],
    docBoardColumn: docFields['System.BoardColumn'] || null,
    pbiId: parentId,
    pbiTitle: null,
    feature: null,
    iteration: docFields['System.IterationPath'],
    eligible: false,
    // pendingConfirmation: DocTestes em progresso, cards ausentes (não encontrados),
    // sem hard-blockers (nenhum card encontrado e não-Done). Requer confirmação do usuário.
    pendingConfirmation: false,
    gates: { documentosDeTestes: false, requisitos: null, uxUi: null },
    missingCards: [],   // cards não encontrados no PBI
    blockers: [],       // hard-blockers: cards encontrados mas não-Done
    skipped: false,
    skipReason: null,
  };

  if (!isInProgress(docFields)) {
    result.blockers.push(`Documentos de Testes #${docId} não está em progresso (state=${docFields['System.State']}, column=${docFields['System.BoardColumn'] || '—'})`);
    return result;
  }
  result.gates.documentosDeTestes = true;

  if (!parentId) {
    result.blockers.push(`Task #${docId} sem PBI pai`);
    return result;
  }

  const parent = await getWorkItem(pat, parentId);
  result.pbiTitle = parent.fields['System.Title'];
  result.feature = parent.fields['System.Title'];

  if (hasProcessedTag(parent.fields['System.Tags']) || hasProcessedTag(docFields['System.Tags'])) {
    result.skipped = true;
    result.skipReason = 'Tag qa-orchestrator-done presente';
    return result;
  }

  const childIds = getChildIds(parent);
  const siblings = await getWorkItemsBatch(pat, childIds);

  const req = siblings.find((s) => matchesTitle(s.fields['System.Title'], REQ_TITLES));
  const ux = siblings.find((s) => matchesTitle(s.fields['System.Title'], UX_TITLES));

  // Requisitos: null=ausente, false=encontrado mas não-Done, true=Done
  if (!req) {
    result.missingCards.push('Requisitos');
  } else if (!isDone(req.fields)) {
    result.gates.requisitos = false;
    result.blockers.push(`Requisitos #${req.id} não está Done (state=${req.fields['System.State']})`);
  } else {
    result.gates.requisitos = true;
  }

  // UX/UI: null=ausente, false=encontrado mas não-Done, true=Done
  if (!ux) {
    result.missingCards.push('UX/UI');
  } else if (!isDone(ux.fields)) {
    result.gates.uxUi = false;
    result.blockers.push(`UX/UI #${ux.id} não está Done (state=${ux.fields['System.State']})`);
  } else {
    result.gates.uxUi = true;
  }

  const hasHardBlocker = result.blockers.length > 0;
  const hasMissingCards = result.missingCards.length > 0;

  // Elegível: todos os gates explicitamente satisfeitos
  result.eligible =
    result.gates.documentosDeTestes &&
    result.gates.requisitos === true &&
    result.gates.uxUi === true &&
    !result.skipped;

  // Pendente de confirmação: sem hard-blockers, mas algum card ausente — agente deve perguntar ao usuário
  result.pendingConfirmation =
    result.gates.documentosDeTestes &&
    !hasHardBlocker &&
    hasMissingCards &&
    !result.skipped;

  return result;
}

async function findDocTasks(pat) {
  const iterationFilter = process.env.QA_SPRINT_ITERATION
    ? `AND [System.IterationPath] UNDER '${ITERATION_ROOT}\\${process.env.QA_SPRINT_ITERATION}'`
    : `AND [System.IterationPath] UNDER '${ITERATION_ROOT}'`;

  const query = `
    SELECT [System.Id], [System.Title], [System.State], [System.BoardColumn], [System.Parent]
    FROM WorkItems
    WHERE [System.TeamProject] = '${PROJECT}'
    AND [System.WorkItemType] = 'Task'
    ${iterationFilter}
    AND (
      [System.Title] CONTAINS 'Documento de Teste'
      OR [System.Title] CONTAINS 'Documentos de Teste'
    )
    ORDER BY [System.ChangedDate] DESC
  `;

  const data = await wiql(pat, query);
  return (data.workItems || []).map((w) => w.id);
}

async function main() {
  const args = process.argv.slice(2);
  const workItemArg = args.includes('--work-item') ? Number(args[args.indexOf('--work-item') + 1]) : null;
  const jsonOnly = args.includes('--json');

  const pat = loadPat();
  let docIds = [];

  if (workItemArg) {
    docIds = [workItemArg];
  } else {
    docIds = await findDocTasks(pat);
  }

  const results = [];
  for (const id of docIds) {
    const item = await getWorkItem(pat, id);
    if (!matchesTitle(item.fields['System.Title'], DOC_TITLES)) continue;
    results.push(await evaluateCandidate(pat, item));
  }

  const eligible = results.filter((r) => r.eligible);
  const pendingConfirmation = results.filter((r) => r.pendingConfirmation);
  const blocked = results.filter((r) => !r.eligible && !r.pendingConfirmation && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  const output = {
    scanned: results.length,
    eligible,
    pendingConfirmation,
    blocked,
    skipped,
    timestamp: new Date().toISOString(),
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    process.exit((eligible.length || pendingConfirmation.length) ? 0 : 2);
  }

  console.log('ORQUESTRADOR QA — Descoberta de candidatos');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `Escaneados: ${results.length} | Elegíveis: ${eligible.length} | Aguardando confirmação: ${pendingConfirmation.length} | Bloqueados: ${blocked.length} | Ignorados: ${skipped.length}`,
  );

  if (eligible.length) {
    console.log('\n✅ Elegíveis:');
    for (const e of eligible) {
      console.log(`  PBI #${e.pbiId} — ${e.feature}`);
      console.log(`    Doc task: #${e.docTaskId} | Sprint: ${e.iteration}`);
    }
  }

  if (pendingConfirmation.length) {
    console.log('\n⚠️  Aguardando confirmação do usuário (cards ausentes):');
    for (const p of pendingConfirmation) {
      console.log(`  PBI #${p.pbiId} — ${p.feature}`);
      console.log(`    Doc task: #${p.docTaskId} | Cards ausentes: ${p.missingCards.join(', ')}`);
    }
  }

  if (blocked.length) {
    console.log('\n⛔ Bloqueados (cards encontrados mas não-Done):');
    for (const b of blocked) {
      console.log(`  #${b.docTaskId} — ${b.docTaskTitle}`);
      for (const reason of b.blockers) console.log(`    • ${reason}`);
    }
  }

  if (skipped.length) {
    console.log('\n⏭️  Ignorados (já processados):');
    for (const s of skipped) console.log(`  #${s.docTaskId} — ${s.skipReason}`);
  }

  process.exit((eligible.length || pendingConfirmation.length) ? 0 : 2);
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
