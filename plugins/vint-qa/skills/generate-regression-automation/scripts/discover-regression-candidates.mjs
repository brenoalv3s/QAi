#!/usr/bin/env node
/**
 * Gates para automação regressiva: card Executar Teste em DONE
 * e ao menos um cenário Muito Alta/Alta com Status da Automação pendente.
 */
import { loadPat, authHeader, ORG, PROJECT, PROJECT_ENC } from '../../execute-manual-tests/scripts/lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  needsAutomation,
  isAutomationConcluido,
} from '../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';

const EXEC_TITLES = ['executar teste', 'executar testes', 'execucao de testes', 'execução de testes'];
const DONE = new Set(['done', 'closed', 'resolved', 'complete', 'concluido', 'concluído']);

function normalize(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function matchesExec(title) {
  const n = normalize(title);
  return EXEC_TITLES.some((t) => n === t || n.includes(t));
}

function isDone(fields) {
  const s = normalize(fields['System.State']);
  const c = normalize(fields['System.BoardColumn']);
  if (fields['System.BoardColumnDone'] === true) return true;
  return DONE.has(s) || DONE.has(c);
}

async function api(pat, path, opts = {}) {
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, {
    headers: { ...authHeader(pat), ...opts.headers },
    method: opts.method || 'GET',
    body: opts.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return text ? JSON.parse(text) : null;
}

async function wiql(pat, query) {
  return api(pat, '/_apis/wit/wiql?api-version=7.1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

async function getItem(pat, id) {
  return api(pat, `/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`);
}

function parentId(item) {
  if (item.fields?.['System.Parent']) return item.fields['System.Parent'];
  const rel = (item.relations || []).find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
  const m = rel?.url?.match(/workItems\/(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function loadAutomationSummary(pat, feature) {
  const { plan, targetSuite } = await resolveFeatureSuite(pat, feature);
  const cases = await getSuiteTestCases(pat, plan.id, targetSuite.id);
  const high = [];
  for (const tc of cases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    const details = await getTestCaseDetails(pat, id);
    if (!details.highCriticity) continue;
    high.push(details);
  }
  const pending = high.filter((s) => needsAutomation(s.automationStatusRaw));
  const concluido = high.filter((s) => isAutomationConcluido(s.automationStatusRaw));
  return { high, pending, concluido };
}

async function evaluate(pat, task) {
  const f = task.fields;
  const id = task.id;
  const result = {
    execTaskId: id,
    execTaskTitle: f['System.Title'],
    execState: f['System.State'],
    pbiId: parentId(task),
    pbiTitle: null,
    feature: null,
    eligible: false,
    blockers: [],
    skipped: false,
    automationSummary: null,
  };

  if (!isDone(f)) {
    result.blockers.push(`Executar Teste #${id} não está Done (state=${f['System.State']})`);
    return result;
  }

  const parent = result.pbiId ? await getItem(pat, result.pbiId) : null;
  if (!parent) {
    result.blockers.push('PBI pai não encontrado');
    return result;
  }

  result.pbiTitle = parent.fields['System.Title'];
  result.feature = parent.fields['System.Title'];

  try {
    const summary = await loadAutomationSummary(pat, result.feature);
    result.automationSummary = {
      totalHighCriticity: summary.high.length,
      pending: summary.pending.length,
      concluido: summary.concluido.length,
      pendingCnIds: summary.pending.map((s) => s.cnId).filter(Boolean),
    };

    if (!summary.high.length) {
      result.blockers.push('Nenhum cenário Muito Alta/Alta na suite do Test Plans');
      return result;
    }

    if (!summary.pending.length) {
      result.skipped = true;
      result.skipReason = 'Todos os cenários Muito Alta/Alta já têm Status da Automação = Concluído';
      return result;
    }
  } catch (e) {
    result.blockers.push(`Test Plans: ${e.message}`);
    return result;
  }

  result.eligible = true;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const workItem = args.includes('--work-item') ? Number(args[args.indexOf('--work-item') + 1]) : null;

  const pat = loadPat();
  let ids = [];

  if (workItem) ids = [workItem];
  else {
    const q = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.TeamProject] = '${PROJECT}'
      AND [System.WorkItemType] = 'Task'
      AND [System.Title] CONTAINS 'Executar'
      ORDER BY [System.ChangedDate] DESC`;
    const data = await wiql(pat, q);
    ids = (data.workItems || []).map((w) => w.id);
  }

  const results = [];
  for (const id of ids) {
    const item = await getItem(pat, id);
    if (!matchesExec(item.fields['System.Title'])) continue;
    results.push(await evaluate(pat, item));
  }

  const eligible = results.filter((r) => r.eligible);
  const blocked = results.filter((r) => !r.eligible && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  const output = { scanned: results.length, eligible, blocked, skipped };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    process.exit(eligible.length ? 0 : 2);
  }

  console.log(`REGRESSÃO AUTO — Elegíveis: ${eligible.length} | Bloqueados: ${blocked.length} | Ignorados: ${skipped.length}`);
  for (const e of eligible) {
    const p = e.automationSummary?.pending ?? '?';
    console.log(`  ✅ PBI #${e.pbiId} — ${e.feature} (${p} cenário(s) pendente(s) de automação)`);
  }
  for (const s of skipped) {
    console.log(`  ⏭️ PBI #${s.pbiId} — ${s.feature}: ${s.skipReason}`);
  }
  for (const b of blocked) {
    console.log(`  ⛔ #${b.execTaskId}`);
    b.blockers.forEach((x) => console.log(`     • ${x}`));
  }
  process.exit(eligible.length ? 0 : 2);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
