#!/usr/bin/env node
/**
 * Lista cenários Muito Alta + Alta do Test Plans para automação regressiva.
 */
import { loadPat } from '../../execute-manual-tests/scripts/lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  testPlanOptionsFromArgs,
} from '../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';
import { parseFeatureTitle, annotateScenarios } from './lib/feature-structure.mjs';
import {
  analyzeWikiCoverageGaps,
  mergeRegressionScenarios,
} from './lib/wiki-coverage.mjs';

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
  const includeAll = args.all === true;
  const includeWikiGaps = args.include_wiki_gaps === true;

  if (!feature) {
    console.error(
      'Uso: node list-regression-scenarios.mjs --feature "Nome" [--plan-id N] [--suite-id N] [--parent-suite "Nome"] [--json] [--all] [--include-wiki-gaps]',
    );
    process.exit(1);
  }

  const pat = loadPat();
  const planOptions = testPlanOptionsFromArgs(args);
  const { plan, featureSuite, targetSuite } = await resolveFeatureSuite(pat, feature, planOptions);
  const suiteCases = await getSuiteTestCases(pat, plan.id, targetSuite.id);

  const all = [];
  for (const tc of suiteCases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    const details = await getTestCaseDetails(pat, id);
    all.push(details);
  }

  const testPlanFiltered = includeAll ? all : all.filter((s) => s.highCriticity);

  let wikiAnalysis = null;
  let gapScenarios = [];
  if (includeWikiGaps) {
    wikiAnalysis = analyzeWikiCoverageGaps(feature, all);
    gapScenarios = wikiAnalysis.gapScenarios;
  }

  const filtered = includeWikiGaps
    ? mergeRegressionScenarios(testPlanFiltered, gapScenarios)
    : testPlanFiltered;

  const uiScenarios = filtered.filter((s) => s.execution.runUi);
  const apiScenarios = filtered.filter((s) => s.execution.runApi);

  const parseOpts = { planName: plan.name };
  const structure = parseFeatureTitle(feature, parseOpts);
  const annotated = annotateScenarios(filtered, feature, parseOpts);

  const output = {
    feature,
    structure,
    plan: { id: plan.id, name: plan.name },
    targetSuite: { id: targetSuite.id, name: targetSuite.name },
    totalInSuite: all.length,
    totalHighCriticity: all.filter((s) => s.highCriticity).length,
    testPlanSelected: testPlanFiltered.length,
    wikiGapCount: gapScenarios.length,
    selected: filtered.length,
    uiCount: uiScenarios.length,
    apiCount: apiScenarios.length,
    uiScenarios: annotateScenarios(uiScenarios, feature, parseOpts),
    apiScenarios: annotateScenarios(apiScenarios, feature, parseOpts),
    scenarios: annotated,
    testPlanScenarios: annotateScenarios(testPlanFiltered, feature, parseOpts),
    wikiGapScenarios: annotateScenarios(gapScenarios, feature, parseOpts),
    wikiCoverage: wikiAnalysis
      ? {
          sourcesConsulted: wikiAnalysis.sourcesConsulted,
          coveredRefs: wikiAnalysis.coveredRefs,
          gapCount: wikiAnalysis.gapCount,
        }
      : null,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('REGRESSÃO — Cenários elegíveis (Muito Alta + Alta)');
  console.log(
    `Feature: ${feature} | Test Plans: ${testPlanFiltered.length} | Wiki gaps: ${gapScenarios.length} | Total: ${filtered.length}`,
  );
  for (const s of filtered) {
    const src = s.source && s.source !== 'test-plans' ? ` [${s.source}]` : '';
    console.log(`  ${s.cnId} [${s.criticidadeRaw}] [${s.strategyLabel}]${src} — ${s.title}`);
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
