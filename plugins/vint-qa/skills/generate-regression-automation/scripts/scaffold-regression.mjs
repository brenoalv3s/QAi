#!/usr/bin/env node
/**
 * Gera estrutura Playwright regressiva agrupada por domínio (ex.: demandas/)
 * com um arquivo por operação: cadastrar, editar, buscar, excluir, tela-inicial.
 *
 * Uso: node scaffold-regression.mjs --feature "Pedidos - Cadastrar"
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPat } from '../../execute-manual-tests/scripts/lib/azure-api.mjs';
import {
  resolveFeatureSuite,
  getSuiteTestCases,
  getTestCaseDetails,
  testPlanOptionsFromArgs,
} from '../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';
import { parseFeatureTitle, groupScenariosBySpec, subGroupLabel } from './lib/feature-structure.mjs';
import {
  analyzeWikiCoverageGaps,
  mergeRegressionScenarios,
} from './lib/wiki-coverage.mjs';
import {
  buildUiSpecFile,
  buildApiSpecFile,
  buildListagemPageObject,
  buildCadastroDrawerPageObject,
  buildDomainPageIndex,
  buildApiClient,
  buildListagemLocators,
  buildCadastroLocators,
  buildDomainData,
  collectMethodNames,
  stepToMethodName,
} from './lib/templates.mjs';
import { mergeUiSpecContent, mergeManifest, extractCnIds } from './lib/merge-spec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
const E2E = resolve(ROOT, 'e2e');

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

function rel(path) {
  return path.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/') + '/', '');
}

function writeOnce(path, content, force) {
  if (existsSync(path) && !force) {
    return { path, action: 'skipped' };
  }
  mkdirSync(dirname(path), { recursive: true });
  const existed = existsSync(path);
  writeFileSync(path, content, 'utf8');
  return { path, action: existed ? 'updated' : 'created' };
}

function writeSpecFile(path, content, force, mergeOptions) {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
    return { path, action: 'created', added: extractCnIds(content).size };
  }
  if (force) {
    writeFileSync(path, content, 'utf8');
    return { path, action: 'updated', added: extractCnIds(content).size };
  }

  const existing = readFileSync(path, 'utf8');
  const incomingIds = extractCnIds(content);
  const existingIds = extractCnIds(existing);
  const allExist = [...incomingIds].every((id) => existingIds.has(id));
  if (allExist) return { path, action: 'skipped', added: 0 };

  const { content: merged, action, added } = mergeUiSpecContent(existing, content, mergeOptions);
  writeFileSync(path, merged, 'utf8');
  return { path, action, added };
}

async function loadScenarios(feature, includeAll, includeWikiGaps, planOptions) {
  const pat = loadPat();
  const { plan, targetSuite } = await resolveFeatureSuite(pat, feature, planOptions);
  const cases = await getSuiteTestCases(pat, plan.id, targetSuite.id);
  const all = [];
  for (const tc of cases) {
    const id = tc.workItem?.id;
    if (!id) continue;
    all.push(await getTestCaseDetails(pat, id));
  }
  const testPlan = includeAll ? all : all.filter((s) => s.highCriticity);
  if (!includeWikiGaps) return testPlan;
  const analysis = analyzeWikiCoverageGaps(feature, all);
  return mergeRegressionScenarios(testPlan, analysis.gapScenarios);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature;
  const force = args.force === true;
  const dryRun = args['dry_run'] === true;
  const includeWikiGaps = args.include_wiki_gaps === true;

  if (!feature) {
    console.error(
      'Uso: node scaffold-regression.mjs --feature "Pedidos - Cadastrar" [--plan-id N] [--suite-id N] [--force] [--dry-run] [--include-wiki-gaps]',
    );
    process.exit(1);
  }

  const planOptions = testPlanOptionsFromArgs(args);
  const pat = loadPat();
  const { plan } = await resolveFeatureSuite(pat, feature, planOptions);
  const parseOpts = { planName: plan.name };
  const scenarios = await loadScenarios(feature, false, includeWikiGaps, planOptions);
  const uiScenarios = scenarios.filter((s) => s.execution.runUi);
  const apiScenarios = scenarios.filter((s) => s.execution.runApi);

  if (!scenarios.length) {
    console.error('Nenhum cenário Muito Alta/Alta encontrado para esta feature.');
    process.exit(2);
  }

  const structure = parseFeatureTitle(feature, parseOpts);
  const { domainName, domainSlug, pascal, operation } = structure;

  const files = [];
  const report = [];

  if (uiScenarios.length) {
    const { grouped } = groupScenariosBySpec(uiScenarios, feature, parseOpts);
    for (const [specFile, subGroups] of grouped) {
      const specPath = resolve(E2E, `tests/${domainSlug}/ui/${specFile}`);
      const content = buildUiSpecFile({
        domainName,
        domainSlug,
        pascal,
        operation,
        subGroups,
        sourceFeature: feature,
      });
      files.push({ path: specPath, content, kind: 'ui-spec', specFile, subGroups });
    }

    const listagemMethods = [];
    const cadastroMethods = [];
    for (const s of uiScenarios) {
      const steps = s.steps?.length ? s.steps : ['pré-condição', 'ação do usuário', 'resultado esperado'];
      steps.forEach((step, index) => {
        const name = stepToMethodName(step);
        if (['cadastrar', 'editar', 'excluir'].includes(operation) && index > 0) {
          cadastroMethods.push(name);
        } else {
          listagemMethods.push(name);
        }
      });
    }

    files.push({
      path: resolve(E2E, `locators/${domainSlug}/listagem.locators.ts`),
      content: buildListagemLocators({ domainName }),
      kind: 'locators-listagem',
    });
    files.push({
      path: resolve(E2E, `data/${domainSlug}.data.ts`),
      content: buildDomainData({ domainName, domainSlug }),
      kind: 'data',
    });
    files.push({
      path: resolve(E2E, `pages/${domainSlug}/listagem.page.ts`),
      content: buildListagemPageObject({
        domainName,
        domainSlug,
        pascal,
        methodNames: [...new Set(listagemMethods.length ? listagemMethods : collectMethodNames(uiScenarios))],
      }),
      kind: 'pom-listagem',
    });

    if (['cadastrar', 'editar', 'excluir'].includes(operation)) {
      files.push({
        path: resolve(E2E, `locators/${domainSlug}/cadastro.locators.ts`),
        content: buildCadastroLocators({ domainName }),
        kind: 'locators-cadastro',
      });
      files.push({
        path: resolve(E2E, `pages/${domainSlug}/cadastro-drawer.page.ts`),
        content: buildCadastroDrawerPageObject({
          domainName,
          domainSlug,
          pascal,
          methodNames: [...new Set(cadastroMethods)],
        }),
        kind: 'pom-drawer',
      });
      files.push({
        path: resolve(E2E, `pages/${domainSlug}/index.ts`),
        content: buildDomainPageIndex({ pascal }),
        kind: 'pom-index',
      });
    }
  }

  if (apiScenarios.length) {
    const { grouped } = groupScenariosBySpec(apiScenarios, feature, parseOpts);
    for (const [specFile, subGroups] of grouped) {
      const specPath = resolve(E2E, `tests/${domainSlug}/api/${specFile}`);
      const content = buildApiSpecFile({
        domainName,
        domainSlug,
        pascal,
        operation,
        subGroups,
        sourceFeature: feature,
      });
      files.push({ path: specPath, content, kind: 'api-spec', specFile, subGroups });
    }

    files.push({
      path: resolve(E2E, `api/clients/${domainSlug}.client.ts`),
      content: buildApiClient({
        domainName,
        domainSlug,
        pascal,
        methodNames: collectMethodNames(apiScenarios),
      }),
      kind: 'api-client',
    });
  }

  const incomingManifest = {
    sourceTitle: feature,
    domainName,
    domainSlug,
    operation,
    specFile: structure.specFile,
    subGroup: structure.subGroup,
    generatedAt: new Date().toISOString(),
    total: scenarios.length,
    ui: uiScenarios.length,
    api: apiScenarios.length,
    cnIds: scenarios.map((s) => s.cnId),
    files: files.map((f) => rel(f.path)),
    structure: {
      layout: 'domain-operation',
      operations: ['cadastrar', 'editar', 'buscar', 'excluir', 'tela-inicial'],
    },
  };

  const manifestPath = resolve(ROOT, `docs/regression-automation/${domainSlug}/manifest.json`);
  let manifest = incomingManifest;
  if (existsSync(manifestPath)) {
    try {
      manifest = mergeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')), incomingManifest);
    } catch {
      manifest = incomingManifest;
    }
  }
  files.push({ path: manifestPath, content: JSON.stringify(manifest, null, 2), kind: 'manifest' });

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          feature,
          structure,
          manifest,
          wouldWrite: files.map((f) => ({ path: rel(f.path), kind: f.kind })),
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const f of files) {
    if (f.kind === 'ui-spec') {
      const subKeys = [...f.subGroups.keys()].filter((k) => k !== '__default__');
      const label = subKeys.length === 1 ? subGroupLabel(operation, subKeys[0]) : null;
      report.push(writeSpecFile(f.path, f.content, force, { subGroupLabel: label }));
    } else if (f.kind === 'api-spec') {
      report.push(writeOnce(f.path, f.content, force));
    } else if (f.kind === 'manifest') {
      mkdirSync(dirname(f.path), { recursive: true });
      writeFileSync(f.path, f.content, 'utf8');
      report.push({ path: f.path, action: existsSync(f.path) ? 'updated' : 'created' });
    } else {
      report.push(writeOnce(f.path, f.content, force));
    }
  }

  console.log('SCAFFOLD REGRESSÃO — concluído');
  console.log(`PBI: ${feature}`);
  console.log(`Domínio: ${domainName} (${domainSlug}) | Operação: ${operation}`);
  console.log(`Cenários: ${scenarios.length} | UI: ${uiScenarios.length} | API: ${apiScenarios.length}`);
  console.log('\nEstrutura alvo:');
  console.log(`  e2e/fixtures/main.ts (hub — specs só importam daqui)`);
  console.log(`  e2e/locators/${domainSlug}/listagem.locators.ts`);
  console.log(`  e2e/data/${domainSlug}.data.ts`);
  console.log(`  e2e/pages/${domainSlug}/listagem.page.ts`);
  console.log(`  e2e/pages/${domainSlug}/cadastro-drawer.page.ts (cadastrar/editar/excluir)`);
  console.log(`  e2e/tests/${domainSlug}/ui/{cadastrar|editar|buscar|excluir|tela-inicial}.spec.ts`);
  console.log(`  e2e/tests/${domainSlug}/api/... (se houver cenários API)`);
  for (const r of report) {
    const extra = r.added != null && r.added > 0 ? ` (+${r.added} CN)` : '';
    console.log(`  ${r.action === 'skipped' ? '⏭️' : '✅'} ${rel(r.path)}${extra}`);
  }
  console.log('\nPróximo: implementar POM/clients (Passo 3), substituir TODOs, rodar cd e2e && npm test');
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
