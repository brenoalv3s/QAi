#!/usr/bin/env node
/**
 * Descobre PBIs elegíveis para execução manual de testes (gates do board).
 * Uso:
 *   node discover-execute-candidates.mjs
 *   node discover-execute-candidates.mjs --work-item 25870 --json
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import { ORG, PROJECT, PROJECT_ENC, loadPat, ITERATION_ROOT } from '../../../runtime/lib/azure.mjs';


const EXEC_TITLES = ['executar teste', 'executar testes', 'execucao de testes', 'execução de testes', 'execucao testes'];
const TRIGGER_SELF = new Set(EXEC_TITLES);

const IN_PROGRESS = new Set(['in progress', 'active', 'doing', 'em andamento', 'em progresso']);
const DONE = new Set(['done', 'closed', 'resolved', 'complete', 'concluido', 'concluído']);
const BLOCKED_STATES = new Set(['to do', 'new', 'proposed', 'backlog', 'reopened', 'blocked']);

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

function normalize(text) {
  return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function matchesExecTitle(title) {
  const n = normalize(title);
  return EXEC_TITLES.some((t) => n === t || n.includes(t));
}

function isTriggerTask(title) {
  return TRIGGER_SELF.has(normalize(title)) || matchesExecTitle(title);
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

function isBlockedState(fields) {
  const state = normalize(fields['System.State']);
  const col = normalize(fields['System.BoardColumn']);
  return BLOCKED_STATES.has(state) || BLOCKED_STATES.has(col);
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
  const data = await api(pat, '/_apis/wit/workitemsbatch?api-version=7.1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      fields: ['System.Id', 'System.Title', 'System.State', 'System.BoardColumn', 'System.BoardColumnDone', 'System.Parent', 'System.IterationPath', 'System.Tags', 'System.WorkItemType'],
    }),
  });
  return data.value || [];
}

function getParentId(item) {
  if (item.fields?.['System.Parent']) return item.fields['System.Parent'];
  const parentRel = (item.relations || []).find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
  const m = parentRel?.url?.match(/workItems\/(\d+)/i);
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
  return normalize(tags || '').includes('qa-manual-tests-done');
}

async function evaluateCandidate(pat, execTaskItem) {
  const fields = execTaskItem.fields;
  const execId = execTaskItem.id;
  const parentId = getParentId(execTaskItem);

  const result = {
    execTaskId: execId,
    execTaskTitle: fields['System.Title'],
    execState: fields['System.State'],
    pbiId: parentId,
    pbiTitle: null,
    feature: null,
    iteration: fields['System.IterationPath'],
    eligible: false,
    gates: { executarTeste: false, siblingsDone: false, noEarlierColumns: false },
    blockers: [],
    skipped: false,
    siblings: [],
  };

  if (!isInProgress(fields)) {
    result.blockers.push(`Executar Teste #${execId} não está em progresso (state=${fields['System.State']})`);
    return result;
  }
  result.gates.executarTeste = true;

  if (!parentId) {
    result.blockers.push(`Task #${execId} sem PBI pai`);
    return result;
  }

  const parent = await getWorkItem(pat, parentId);
  result.pbiTitle = parent.fields['System.Title'];
  result.feature = parent.fields['System.Title'];

  if (hasProcessedTag(parent.fields['System.Tags']) || hasProcessedTag(fields['System.Tags'])) {
    result.skipped = true;
    result.skipReason = 'Tag qa-manual-tests-done presente';
    return result;
  }

  const childIds = getChildIds(parent);
  const siblings = await getWorkItemsBatch(pat, childIds);

  for (const s of siblings) {
    const title = s.fields['System.Title'];
    const state = s.fields['System.State'];
    result.siblings.push({ id: s.id, title, state });

    if (s.id === execId) continue;

    if (!isDone(s.fields)) {
      if (isBlockedState(s.fields)) {
        result.blockers.push(`#${s.id} "${title}" em coluna anterior (${state}) — deve estar Done`);
        result.gates.noEarlierColumns = false;
      } else if (!isInProgress(s.fields)) {
        result.blockers.push(`#${s.id} "${title}" não está Done (state=${state})`);
      }
    }
  }

  const others = siblings.filter((s) => s.id !== execId);
  result.gates.siblingsDone = others.every((s) => isDone(s.fields));
  result.gates.noEarlierColumns = !result.blockers.some((b) => b.includes('coluna anterior'));

  result.eligible =
    result.gates.executarTeste &&
    result.gates.siblingsDone &&
    result.gates.noEarlierColumns &&
    result.blockers.length === 0 &&
    !result.skipped;

  return result;
}

async function findExecTasks(pat) {
  const iterationFilter = process.env.QA_SPRINT_ITERATION
    ? `AND [System.IterationPath] UNDER '${ITERATION_ROOT}\\${process.env.QA_SPRINT_ITERATION}'`
    : `AND [System.IterationPath] UNDER '${ITERATION_ROOT}'`;

  const query = `
    SELECT [System.Id], [System.Title], [System.State]
    FROM WorkItems
    WHERE [System.TeamProject] = '${PROJECT}'
    AND [System.WorkItemType] = 'Task'
    ${iterationFilter}
    AND [System.Title] CONTAINS 'Executar'
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
  const ids = workItemArg ? [workItemArg] : await findExecTasks(pat);

  const results = [];
  for (const id of ids) {
    const item = await getWorkItem(pat, id);
    if (!matchesExecTitle(item.fields['System.Title'])) continue;
    results.push(await evaluateCandidate(pat, item));
  }

  const eligible = results.filter((r) => r.eligible);
  const blocked = results.filter((r) => !r.eligible && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  const output = { scanned: results.length, eligible, blocked, skipped, timestamp: new Date().toISOString() };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    process.exit(eligible.length ? 0 : 2);
  }

  console.log('EXECUTE MANUAL TESTS — Descoberta');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Escaneados: ${results.length} | Elegíveis: ${eligible.length} | Bloqueados: ${blocked.length}`);

  if (eligible.length) {
    console.log('\n✅ Elegíveis:');
    for (const e of eligible) console.log(`  PBI #${e.pbiId} — ${e.feature}`);
  }
  if (blocked.length) {
    console.log('\n⛔ Bloqueados:');
    for (const b of blocked) {
      console.log(`  #${b.execTaskId} — ${b.execTaskTitle}`);
      for (const r of b.blockers) console.log(`    • ${r}`);
    }
  }

  process.exit(eligible.length ? 0 : 2);
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
