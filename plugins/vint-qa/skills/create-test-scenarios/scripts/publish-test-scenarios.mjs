#!/usr/bin/env node
/**
 * Publica cenários de docs/test-scenarios/*.md no Azure DevOps Test Plans.
 * Uso: node publish-test-scenarios.mjs <caminho-cenarios-de-teste.md>
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import {
  PROJECT,
  ORG,
  PROJECT_ENC,
  loadPat,
  FIELD_CRITICIDADE,
  FIELD_ESTRATEGIA,
  FIELD_STATUS_AUTO,
  PLAN_HINTS,
  FEATURE_SUITE_ALIASES,
} from '../../../runtime/lib/azure.mjs';

const CRITICIDADE_MAP = {
  'muito alta': '1. Muito Alta',
  alta: '2. Alta',
  média: '3. Média',
  media: '3. Média',
  baixa: '4. Baixa',
};

const ESTRATEGIA_MAP = {
  api: '1. API',
  ui: '2. UI',
  'api+ui': '5. API + UI',
  'api + ui': '5. API + UI',
  'ui + bd (sql)': '5. API + UI',
  'ui + bd': '5. API + UI',
};

const STATUS_AUTO_MAP = {
  planejado: '2. Planejado',
  concluído: '1. Concluído',
  concluido: '1. Concluído',
  'não automatizado': '3. Não Automatizado',
  'nao automatizado': '3. Não Automatizado',
  'não se aplica': '4. Não se Aplica',
  'nao se aplica': '4. Não se Aplica',
};

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

async function api(pat, method, path, body, contentType = 'application/json') {
  const headers = { ...authHeader(pat) };
  if (body) headers['Content-Type'] = contentType;
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, { method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseScenarios(md) {
  const scenarios = [];
  const blocks = md.split(/^---\s*$/m);
  for (const block of blocks) {
    const titleMatch = block.match(/^##\s*\[(CN-[^\]]+)\]\s*(.+)$/m);
    if (!titleMatch) continue;

    const cnId = titleMatch[1];
    const titleSuffix = titleMatch[2].trim();
    const title = `[${cnId}] ${titleSuffix}`;

    const stepsSection = block.match(/\*\*Descritivo do Cenário \(Steps\)\*\*\s*([\s\S]*?)\*\*Informações de Gestão/s);
    if (!stepsSection) continue;

    const steps = [];
    for (const line of stepsSection[1].split('\n')) {
      const stepMatch = line.match(/\*\s+\*\*(Dado|Quando|E|Então|Mas)\*\*\s*(.+)/);
      if (stepMatch) steps.push({ keyword: stepMatch[1], text: stepMatch[2].replace(/;\s*$/, '').trim() });
    }

    const metrics = {};
    const criticidade = block.match(/\|\s*\*\*Criticidade\*\*\s*\|\s*([^|\n]+)/);
    const estrategia = block.match(/\|\s*\*\*Estratégia Técnica\*\*\s*\|\s*([^|\n]+)/);
    const statusAuto = block.match(/\|\s*\*\*Status da Automação\*\*\s*\|\s*([^|\n]+)/);
    if (criticidade) metrics['Criticidade'] = criticidade[1].trim();
    if (estrategia) metrics['Estratégia Técnica'] = estrategia[1].trim();
    if (statusAuto) metrics['Status da Automação'] = statusAuto[1].trim();

    scenarios.push({ cnId, title, steps, metrics });
  }
  return scenarios;
}

function extractMetricValue(raw) {
  if (!raw) return '';
  const emDash = raw.split('—')[0].trim();
  const hyphen = emDash.split(' - ')[0].trim();
  return hyphen;
}

function mapMetric(label, raw, map) {
  const key = normalize(extractMetricValue(raw));
  const value = map[key];
  if (!value) return { ok: false, error: `${label} "${raw}" sem mapeamento para Test Plan` };
  return { ok: true, value };
}

function buildStepsXml(steps) {
  const items = steps.map((s, i) => {
    const text = `${s.keyword} ${s.text}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const id = i + 1;
    return `<step id="${id}" type="ActionStep"><parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${text}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString><parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;&lt;BR/&gt;&lt;/P&gt;&lt;/DIV&gt;</parameterizedString><description/></step>`;
  });
  const last = items.length;
  return `<steps id="0" last="${last}">${items.join('')}</steps>`;
}

function resolvePlanHint(scenarios, md) {
  if (process.env.AZURE_DEVOPS_PLAN_ID) {
    return { planName: null, planId: Number(process.env.AZURE_DEVOPS_PLAN_ID), parentSuite: process.env.AZURE_DEVOPS_PARENT_SUITE || null };
  }
  const cn = scenarios[0]?.cnId || '';
  const usMatch = cn.match(/CN-(\d+\.\d+)/);
  const usPrefix = usMatch ? usMatch[1] + '.' : null;
  if (usPrefix) {
    const hint = PLAN_HINTS.find((h) => h.usPrefix && usPrefix.startsWith(h.usPrefix));
    if (hint) return { planName: hint.planName, parentSuite: hint.parentSuite || null };
  }
  const funcMatch = md.match(/\*\*Funcionalidade:\*\*\s*(.+)/);
  if (funcMatch) {
    const func = normalize(funcMatch[1]);
    const byKeyword = PLAN_HINTS.find((h) => (h.keywords || []).some((k) => func.includes(normalize(k))));
    if (byKeyword) return { planName: byKeyword.planName, parentSuite: byKeyword.parentSuite || null };
  }
  return null;
}

function resolveFeatureSuiteName(scenarios, md) {
  const funcMatch = md.match(/\*\*Funcionalidade:\*\*\s*(.+)/);
  const func = funcMatch ? normalize(funcMatch[1]) : '';
  for (const alias of FEATURE_SUITE_ALIASES) {
    if ((alias.keywords || []).some((k) => func.includes(normalize(k)))) return alias.suiteName;
  }
  if (funcMatch) return funcMatch[1].trim();
  const cn = scenarios[0]?.title || 'Cenários';
  return cn.replace(/\[CN-[^\]]+\]\s*/, '').split(' - ')[0] || 'Cenários';
}

async function listPlans(pat) {
  const data = await api(pat, 'GET', '/_apis/testplan/plans?api-version=7.1');
  return data.value || [];
}

async function listSuites(pat, planId) {
  const data = await api(pat, 'GET', `/_apis/testplan/plans/${planId}/suites?api-version=7.1`);
  return data.value || [];
}

function findSuite(suites, name) {
  const target = normalize(name);
  return suites.find((s) => normalize(s.name) === target) || suites.find((s) => normalize(s.name).includes(target) || target.includes(normalize(s.name)));
}

async function createSuite(pat, planId, parentId, name) {
  return api(pat, 'POST', `/_apis/testplan/Plans/${planId}/suites/${parentId}?api-version=7.1`, JSON.stringify({
    suiteType: 'staticTestSuite',
    name,
    parentSuite: { id: parentId },
  }));
}

async function getSuiteTestCaseTitles(pat, planId, suiteId) {
  const data = await api(pat, 'GET', `/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?api-version=7.1`);
  return (data.value || []).map((tc) => tc.workItem?.name || '');
}

async function createTestCase(pat, scenario) {
  const crit = mapMetric('Criticidade', scenario.metrics['Criticidade'], CRITICIDADE_MAP);
  const est = mapMetric('Estratégia Técnica', scenario.metrics['Estratégia Técnica'], ESTRATEGIA_MAP);
  const stat = mapMetric('Status da Automação', scenario.metrics['Status da Automação'], STATUS_AUTO_MAP);

  if (!crit.ok) return { ok: false, error: crit.error };
  if (!est.ok) return { ok: false, error: est.error };
  if (!stat.ok) return { ok: false, error: stat.error };
  if (!scenario.steps.length) return { ok: false, error: 'Cenário sem steps Gherkin' };

  const patch = [
    { op: 'add', path: '/fields/System.Title', value: scenario.title },
    { op: 'add', path: '/fields/Microsoft.VSTS.TCM.Steps', value: buildStepsXml(scenario.steps) },
    { op: 'add', path: `/fields/${FIELD_CRITICIDADE}`, value: crit.value },
    { op: 'add', path: `/fields/${FIELD_ESTRATEGIA}`, value: est.value },
    { op: 'add', path: `/fields/${FIELD_STATUS_AUTO}`, value: stat.value },
  ];

  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/$Test%20Case?api-version=7.1`, {
    method: 'POST',
    headers: { ...authHeader(pat), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `API Work Item: ${text.slice(0, 300)}` };
  return { ok: true, id: JSON.parse(text).id };
}

async function addTestCaseToSuite(pat, planId, suiteId, testCaseId) {
  await api(pat, 'POST', `/_apis/test/Plans/${planId}/suites/${suiteId}/testcases/${testCaseId}?api-version=7.1`);
}

async function resolveTargetSuite(pat, hint, featureSuiteName) {
  const plans = await listPlans(pat);
  let plan = hint?.planId ? plans.find((p) => p.id === hint.planId) : null;
  if (!plan && hint?.planName) plan = plans.find((p) => normalize(p.name) === normalize(hint.planName));
  if (!plan) throw new Error(`Test Plan não encontrado (${hint?.planName || hint?.planId || 'sem hint'})`);

  const suites = await listSuites(pat, plan.id);
  const rootSuite = suites.find((s) => !s.parentSuite) || suites[0];

  let parentSuite = hint?.parentSuite ? findSuite(suites, hint.parentSuite) : null;
  if (!parentSuite && hint?.parentSuite) {
    parentSuite = await createSuite(pat, plan.id, rootSuite.id, hint.parentSuite);
    suites.push(parentSuite);
  }
  const parentId = parentSuite?.id || rootSuite.id;

  let featureSuite = findSuite(suites, featureSuiteName);
  let featureSuiteCreated = false;
  if (!featureSuite) {
    featureSuite = await createSuite(pat, plan.id, parentId, featureSuiteName);
    featureSuiteCreated = true;
  }

  let targetSuite = featureSuite;
  if (!featureSuiteCreated) {
    const today = new Date().toLocaleDateString('pt-BR');
    const batchName = `Cenários — Agent — ${today}`;
    let batchSuite = suites.find((s) => s.parentSuite?.id === featureSuite.id && normalize(s.name) === normalize(batchName));
    if (!batchSuite) {
      batchSuite = await createSuite(pat, plan.id, featureSuite.id, batchName);
    }
    targetSuite = batchSuite;
  }

  return { plan, targetSuite, featureSuite };
}

async function main() {
  const mdPath = process.argv[2];
  if (!mdPath) {
    console.error('Uso: node publish-test-scenarios.mjs <cenarios-de-teste.md>');
    process.exit(1);
  }

  const absPath = resolve(process.cwd(), mdPath);
  const md = readFileSync(absPath, 'utf8');
  const scenarios = parseScenarios(md);
  if (!scenarios.length) {
    console.error('Nenhum cenário encontrado no arquivo.');
    process.exit(1);
  }

  const pat = loadPat();
  const hint = resolvePlanHint(scenarios, md);
  if (!hint) {
    console.error('Não foi possível inferir Test Plan. Defina AZURE_DEVOPS_PLAN_ID e AZURE_DEVOPS_PARENT_SUITE.');
    process.exit(1);
  }

  const featureSuiteName = resolveFeatureSuiteName(scenarios, md);
  const { plan, targetSuite, featureSuite } = await resolveTargetSuite(pat, hint, featureSuiteName);

  const existingTitles = await getSuiteTestCaseTitles(pat, plan.id, targetSuite.id);
  const report = { created: [], skipped: [], aborted: [] };

  for (const scenario of scenarios) {
    const cnPattern = `[${scenario.cnId}]`;
    if (existingTitles.some((t) => t.includes(cnPattern))) {
      report.skipped.push({ cnId: scenario.cnId, reason: 'Já existe na suite' });
      continue;
    }

    const result = await createTestCase(pat, scenario);
    if (!result.ok) {
      report.aborted.push({ cnId: scenario.cnId, reason: result.error });
      continue;
    }

    await addTestCaseToSuite(pat, plan.id, targetSuite.id, result.id);
    report.created.push({ cnId: scenario.cnId, id: result.id, title: scenario.title });
  }

  const suiteUrl = `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_testPlans/define?planId=${plan.id}&suiteId=${targetSuite.id}`;

  console.log('TEST PLAN — Publicação concluída');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Plano: ${plan.name} (${plan.id})`);
  console.log(`Suite feature: ${featureSuite.name} (${featureSuite.id})`);
  console.log(`Suite alvo: ${targetSuite.name} (${targetSuite.id})`);
  console.log(`URL: ${suiteUrl}`);
  console.log(`Criados: ${report.created.length} | Ignorados: ${report.skipped.length} | Abortados: ${report.aborted.length}`);

  if (report.created.length) {
    console.log('\nCriados:');
    for (const c of report.created) console.log(`  ✅ ${c.cnId} → #${c.id}`);
  }
  if (report.skipped.length) {
    console.log('\nIgnorados (duplicata):');
    for (const s of report.skipped) console.log(`  ⏭️  ${s.cnId} — ${s.reason}`);
  }
  if (report.aborted.length) {
    console.log('\nAbortados (métricas inválidas):');
    for (const a of report.aborted) console.log(`  ❌ ${a.cnId} — ${a.reason}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
