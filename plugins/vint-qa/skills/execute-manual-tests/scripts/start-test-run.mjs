#!/usr/bin/env node
/**
 * Cria Test Run (modo Execute) para a suite da feature.
 * Uso: node start-test-run.mjs --feature "Gerar Relatório de Vendas"
 */
import { loadPat, api } from './lib/azure-api.mjs';
import { resolveFeatureSuite, getTestPoints, testPlanOptionsFromArgs } from './lib/test-plan-utils.mjs';

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature;
  const jsonOnly = args.json === true;

  if (!feature) {
    console.error(
      'Uso: node start-test-run.mjs --feature "Nome da feature" [--plan-id N] [--suite-id N] [--json]',
    );
    process.exit(1);
  }

  const pat = loadPat();
  const planOptions = testPlanOptionsFromArgs(args);
  const { plan, targetSuite, executeUrl } = await resolveFeatureSuite(pat, feature, planOptions);
  const points = await getTestPoints(pat, plan.id, targetSuite.id);

  if (!points.length) {
    throw new Error(`Nenhum test point na suite ${targetSuite.name}`);
  }

  const pointIds = points.map((p) => p.id);
  const today = new Date().toLocaleDateString('pt-BR');
  const runName = `Manual QA — ${feature} — ${today}`;

  const run = await api(pat, 'POST', '/_apis/test/runs?api-version=7.1', JSON.stringify({
    name: runName,
    plan: { id: String(plan.id) },
    pointIds,
    isAutomated: false,
    comment: 'Execução manual via agente execute-manual-tests',
  }));

  const results = await api(pat, 'GET', `/_apis/test/runs/${run.id}/results?api-version=7.1`);

  const mapping = (results.value || []).map((r) => ({
    resultId: r.id,
    testCaseId: r.testCase?.id,
    testCaseTitle: r.testCaseTitle,
    cnId: (r.testCaseTitle || '').match(/\[(CN-[^\]]+)\]/)?.[1] || null,
    pointId: r.testPoint?.id,
  }));

  const output = {
    feature,
    runId: run.id,
    runName,
    planId: plan.id,
    suiteId: targetSuite.id,
    executeUrl,
    webRunUrl: run.webAccessUrl || executeUrl,
    mapping,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('TEST RUN — Execute iniciado');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Run: #${run.id} — ${runName}`);
  console.log(`Cenários: ${mapping.length}`);
  console.log(`Execute URL: ${executeUrl}`);
  console.log('\nMapping resultId → testCase:');
  for (const m of mapping) console.log(`  ${m.cnId || '—'} result #${m.resultId} → case #${m.testCaseId}`);
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
