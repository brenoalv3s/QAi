#!/usr/bin/env node
/**
 * Lista cenários de uma feature no Test Plans (modo Execute).
 * Uso: node list-feature-scenarios.mjs --feature "Gerar Relatório de Vendas"
 */
import { loadPat } from './lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  testPlanOptionsFromArgs,
} from './lib/test-plan-utils.mjs';

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
      'Uso: node list-feature-scenarios.mjs --feature "Nome da feature" [--plan-id N] [--suite-id N] [--json]',
    );
    process.exit(1);
  }

  const pat = loadPat();
  const planOptions = testPlanOptionsFromArgs(args);
  const { plan, featureSuite, targetSuite, executeUrl } = await resolveFeatureSuite(pat, feature, planOptions);
  const suiteCases = await getSuiteTestCases(pat, plan.id, targetSuite.id);

  const scenarios = [];
  for (const tc of suiteCases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    const details = await getTestCaseDetails(pat, id);
    scenarios.push(details);
  }

  const output = {
    feature,
    plan: { id: plan.id, name: plan.name },
    featureSuite: { id: featureSuite.id, name: featureSuite.name },
    targetSuite: { id: targetSuite.id, name: targetSuite.name },
    executeUrl,
    total: scenarios.length,
    scenarios,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('CENÁRIOS — Test Plans (Execute)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Feature: ${feature}`);
  console.log(`Plano: ${plan.name} (#${plan.id})`);
  console.log(`Suite: ${targetSuite.name} (#${targetSuite.id})`);
  console.log(`Execute: ${executeUrl}`);
  console.log(`Total: ${scenarios.length}\n`);

  for (const s of scenarios) {
    const exec = s.execution || {};
    const modes = [exec.runApi && 'API', exec.runUi && 'UI'].filter(Boolean).join(' + ') || 'UI';
    console.log(`  ${s.cnId || '—'} #${s.id} [${s.strategyLabel || modes}] — ${s.title}`);
    for (const step of s.steps) console.log(`    • ${step}`);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
