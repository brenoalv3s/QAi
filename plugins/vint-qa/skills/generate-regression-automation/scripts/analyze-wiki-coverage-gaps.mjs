#!/usr/bin/env node
/**
 * Cruza Test Plans com wiki/docs locais e identifica cenários Muito Alta/Alta
 * documentados mas ausentes no Test Plans — candidatos à automação regressiva.
 */
import { loadPat } from '../../execute-manual-tests/scripts/lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  testPlanOptionsFromArgs,
} from '../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';
import { analyzeWikiCoverageGaps } from './lib/wiki-coverage.mjs';

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

async function loadTestPlanScenarios(feature, planOptions) {
  const pat = loadPat();
  const { plan, targetSuite } = await resolveFeatureSuite(pat, feature, planOptions);
  const suiteCases = await getSuiteTestCases(pat, plan.id, targetSuite.id);
  const all = [];
  for (const tc of suiteCases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    all.push(await getTestCaseDetails(pat, id));
  }
  return all;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature;
  const jsonOnly = args.json === true;

  if (!feature) {
    console.error(
      'Uso: node analyze-wiki-coverage-gaps.mjs --feature "Nome" [--plan-id N] [--suite-id N] [--json]',
    );
    process.exit(1);
  }

  const planOptions = testPlanOptionsFromArgs(args);
  const testPlanScenarios = await loadTestPlanScenarios(feature, planOptions);
  const analysis = analyzeWikiCoverageGaps(feature, testPlanScenarios);

  if (jsonOnly) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  console.log('ANÁLISE WIKI — Gaps de cobertura (Muito Alta / Alta)');
  console.log(`Feature: ${feature}`);
  console.log(`Test Plans: ${analysis.testPlanHighCriticity} cenários Muito Alta/Alta`);
  console.log(`Gaps encontrados: ${analysis.gapCount}`);
  console.log('\nFontes consultadas:');
  for (const s of analysis.sourcesConsulted) {
    console.log(`  [${s.kind}] ${s.path}`);
  }
  if (!analysis.sourcesConsulted.length) {
    console.log('  (nenhuma — consulte wiki via MCP ou verifique docs/test-scenarios/)');
  }
  console.log('\nCenários wiki/docs não cobertos no Test Plans:');
  for (const g of analysis.gapScenarios) {
    console.log(`  ${g.cnId} [${g.criticidadeRaw}] — ${g.title}`);
    console.log(`    origem: ${g.source} | ${g.rationale || ''}`);
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
