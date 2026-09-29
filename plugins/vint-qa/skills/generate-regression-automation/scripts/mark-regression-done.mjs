#!/usr/bin/env node
/**
 * ÚNICA escrita permitida no Azure DevOps por generate-regression-automation:
 * atualiza somente Status da Automação = Concluído nos Test Cases do Test Plans.
 * Não altera wiki, PBI, cards, steps nem demais campos. Ver READONLY-POLICY.md.
 *
 * Uso:
 *   node mark-regression-done.mjs --feature "Demandas - Cadastrar"
 *   node mark-regression-done.mjs --feature "Demandas - Cadastrar" --cn-ids "CN-01,CN-02"
 */
import { loadPat, authHeader, ORG, PROJECT_ENC } from '../../execute-manual-tests/scripts/lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  FIELD_STATUS_AUTO,
  STATUS_AUTO,
  isAutomationConcluido,
  testPlanOptionsFromArgs,
} from '../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';

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

async function getWorkItem(pat, id) {
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}?api-version=7.1`,
    { headers: authHeader(pat) },
  );
  if (!res.ok) throw new Error(`Work item #${id} → ${res.status}`);
  return res.json();
}

async function patchWorkItem(pat, id, ops) {
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}?api-version=7.1`,
    {
      method: 'PATCH',
      headers: { ...authHeader(pat), 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Patch #${id} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function setAutomationConcluido(pat, testCaseId) {
  const item = await getWorkItem(pat, testCaseId);
  const current = item.fields[FIELD_STATUS_AUTO];
  if (isAutomationConcluido(current)) {
    return { id: testCaseId, action: 'skipped', reason: 'já Concluído' };
  }
  const op = current ? 'replace' : 'add';
  await patchWorkItem(pat, testCaseId, [
    { op, path: `/fields/${FIELD_STATUS_AUTO}`, value: STATUS_AUTO.CONCLUIDO },
  ]);
  return { id: testCaseId, action: 'updated', cnId: null };
}

async function loadHighCriticityScenarios(pat, feature, planOptions) {
  const { plan, targetSuite } = await resolveFeatureSuite(pat, feature, planOptions);
  const cases = await getSuiteTestCases(pat, plan.id, targetSuite.id);
  const all = [];
  for (const tc of cases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    all.push(await getTestCaseDetails(pat, id));
  }
  return all.filter((s) => s.highCriticity);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { feature, cn_ids: cnIdsArg, summary } = args;

  if (!feature) {
    console.error(
      'Uso: node mark-regression-done.mjs --feature "Demandas - Cadastrar" [--plan-id N] [--suite-id N] [--cn-ids "CN-01,CN-02"] [--summary "..."]',
    );
    process.exit(1);
  }

  const planOptions = testPlanOptionsFromArgs(args);

  const pat = loadPat();
  const scenarios = await loadHighCriticityScenarios(pat, feature, planOptions);
  const cnFilter = cnIdsArg
    ? cnIdsArg.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  let targets = scenarios;
  if (cnFilter?.length) {
    targets = scenarios.filter((s) => s.cnId && cnFilter.includes(s.cnId));
    const missing = cnFilter.filter((cn) => !targets.some((t) => t.cnId === cn));
    if (missing.length) {
      console.warn(`⚠️ CNs não encontrados na suite: ${missing.join(', ')}`);
    }
  }

  if (!targets.length) {
    console.error('Nenhum Test Case elegível para atualizar Status da Automação.');
    process.exit(2);
  }

  const results = [];
  for (const scenario of targets) {
    const result = await setAutomationConcluido(pat, scenario.id);
    result.cnId = scenario.cnId;
    result.title = scenario.title;
    results.push(result);
  }

  const updated = results.filter((r) => r.action === 'updated');
  const skipped = results.filter((r) => r.action === 'skipped');

  console.log('STATUS DA AUTOMAÇÃO — Test Plans');
  console.log(`Feature: ${feature}`);
  console.log(`Campo: ${FIELD_STATUS_AUTO} → ${STATUS_AUTO.CONCLUIDO}`);
  for (const r of updated) {
    console.log(`  ✅ #${r.id} ${r.cnId || ''} — Status da Automação atualizado`);
  }
  for (const r of skipped) {
    console.log(`  ⏭️ #${r.id} ${r.cnId || ''} — ${r.reason}`);
  }
  console.log(`\nResumo: ${updated.length} atualizado(s), ${skipped.length} ignorado(s)`);
  if (summary) console.log(summary);

  process.exit(updated.length ? 0 : skipped.length === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
