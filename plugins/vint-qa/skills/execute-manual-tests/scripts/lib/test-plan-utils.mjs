import { api, normalize, PROJECT_ENC } from './azure-api.mjs';
import { FIELD_ESTRATEGIA, parseStrategy, resolveExecutionPlan, strategyLabel } from './strategy-utils.mjs';
import { ORG, PLAN_HINTS, FEATURE_SUITE_ALIASES, FIELD_CRITICIDADE, FIELD_STATUS_AUTO } from '../../../../runtime/lib/azure.mjs';

export { FIELD_CRITICIDADE, FIELD_STATUS_AUTO, PLAN_HINTS, FEATURE_SUITE_ALIASES };

export const STATUS_AUTO = {
  CONCLUIDO: '1. Concluído',
  PLANEJADO: '2. Planejado',
  NAO_AUTOMATIZADO: '3. Não Automatizado',
  NAO_SE_APLICA: '4. Não se Aplica',
};

const HIGH_CRITICIDADE = new Set(['1. muito alta', '2. alta', 'muito alta', 'alta']);

export function normalizeAutomationStatus(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Cenário ainda elegível para automação regressiva (Planejado ou vazio). */
export function needsAutomation(raw) {
  const v = normalizeAutomationStatus(raw);
  if (!v) return true;
  if (v.includes('planejado') || v.startsWith('2.')) return true;
  return false;
}

export function isAutomationConcluido(raw) {
  const v = normalizeAutomationStatus(raw);
  return v.includes('concluido') || v.startsWith('1.');
}

export function parseCriticidade(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (v.includes('muito alta') || v.startsWith('1.')) return 'muito_alta';
  if (v.includes('alta') && !v.includes('muito') || v.startsWith('2.')) return 'alta';
  if (v.includes('media') || v.includes('média') || v.startsWith('3.')) return 'media';
  if (v.includes('baixa') || v.startsWith('4.')) return 'baixa';
  return 'desconhecida';
}

export function isHighCriticity(raw) {
  const v = String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return HIGH_CRITICIDADE.has(v) || v.includes('muito alta') || (v.includes('alta') && !v.includes('muito'));
}

export function resolveFeatureSuiteName(feature) {
  const func = normalize(feature);
  for (const alias of FEATURE_SUITE_ALIASES) {
    if ((alias.keywords || []).some((k) => func.includes(normalize(k)))) return alias.suiteName;
  }
  return feature.trim();
}

/** Extrai opções de Test Plan a partir de args CLI (--plan-id, --parent-suite, --suite-id). */
export function testPlanOptionsFromArgs(args = {}) {
  const options = {};
  if (args.plan_id != null && args.plan_id !== true) {
    const planId = Number(args.plan_id);
    if (!Number.isNaN(planId)) options.planId = planId;
  }
  if (args.parent_suite && args.parent_suite !== true) {
    options.parentSuite = String(args.parent_suite);
  }
  if (args.suite_id != null && args.suite_id !== true) {
    const suiteId = Number(args.suite_id);
    if (!Number.isNaN(suiteId)) options.suiteId = suiteId;
  }
  return options;
}

export function resolvePlanHint(feature, cnId = '', options = {}) {
  if (options.planId) {
    return {
      planName: null,
      planId: Number(options.planId),
      parentSuite: options.parentSuite || null,
    };
  }
  if (process.env.AZURE_DEVOPS_PLAN_ID) {
    return {
      planName: null,
      planId: Number(process.env.AZURE_DEVOPS_PLAN_ID),
      parentSuite: process.env.AZURE_DEVOPS_PARENT_SUITE || null,
    };
  }
  const usMatch = cnId.match(/CN-(\d+\.\d+)/) || feature.match(/US\s*(\d+\.\d+)/i);
  const usPrefix = usMatch ? usMatch[1] + '.' : null;
  if (usPrefix) {
    const hint = PLAN_HINTS.find((h) => h.usPrefix && usPrefix.startsWith(h.usPrefix));
    if (hint) return { planName: hint.planName, parentSuite: hint.parentSuite || null };
  }
  const func = normalize(feature);
  const byKeyword = PLAN_HINTS.find((h) => (h.keywords || []).some((k) => func.includes(normalize(k))));
  if (byKeyword) return { planName: byKeyword.planName, parentSuite: byKeyword.parentSuite || null };
  return null;
}

export async function listPlans(pat) {
  const data = await api(pat, 'GET', '/_apis/testplan/plans?api-version=7.1');
  return data.value || [];
}

export async function listSuites(pat, planId) {
  const data = await api(pat, 'GET', `/_apis/testplan/plans/${planId}/suites?api-version=7.1`);
  return data.value || [];
}

export function findSuite(suites, name) {
  const target = normalize(name);
  return (
    suites.find((s) => normalize(s.name) === target) ||
    suites.find((s) => normalize(s.name).includes(target) || target.includes(normalize(s.name)))
  );
}

export async function resolveFeatureSuite(pat, feature, options = {}) {
  const hint = resolvePlanHint(feature, options.cnId || '', options);
  if (!hint) {
    throw new Error(
      'Não foi possível inferir Test Plan. Informe --plan-id <id> ou defina AZURE_DEVOPS_PLAN_ID.',
    );
  }

  const plans = await listPlans(pat);
  let plan = hint.planId ? plans.find((p) => p.id === hint.planId) : null;
  let resolvedOptions = { ...options };

  // ID informado pode ser suite-id (comum confundir com plan-id na URL do Azure)
  if (!plan && hint.planId && !options.suiteId) {
    for (const candidate of plans) {
      const candidateSuites = await listSuites(pat, candidate.id);
      const suite = candidateSuites.find((s) => s.id === hint.planId);
      if (suite) {
        plan = candidate;
        resolvedOptions.suiteId = hint.planId;
        break;
      }
    }
  }

  if (!plan && hint.planName) plan = plans.find((p) => normalize(p.name) === normalize(hint.planName));
  if (!plan) {
    throw new Error(
      `Test Plan não encontrado (${hint.planName || hint.planId}). Verifique --plan-id ou use --suite-id se o valor for ID de suite.`,
    );
  }

  const suites = await listSuites(pat, plan.id);

  if (resolvedOptions.suiteId) {
    const targetSuite = suites.find((s) => s.id === Number(resolvedOptions.suiteId));
    if (!targetSuite) {
      throw new Error(`Suite #${resolvedOptions.suiteId} não encontrada no plano ${plan.name} (#${plan.id})`);
    }
    const parentId = targetSuite.parentSuite?.id;
    const featureSuite = parentId ? suites.find((s) => s.id === parentId) || targetSuite : targetSuite;
    return {
      plan,
      featureSuite,
      targetSuite,
      executeUrl: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_testPlans/execute?planId=${plan.id}&suiteId=${targetSuite.id}`,
      defineUrl: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_testPlans/define?planId=${plan.id}&suiteId=${targetSuite.id}`,
    };
  }

  const featureSuiteName = resolveFeatureSuiteName(feature);
  let featureSuite = findSuite(suites, featureSuiteName);
  if (!featureSuite) {
    throw new Error(
      `Suite da feature não encontrada: ${featureSuiteName}. Use --suite-id <id> se o nome divergir.`,
    );
  }

  const childSuites = suites.filter((s) => s.parentSuite?.id === featureSuite.id);
  const batchSuites = childSuites
    .filter((s) => normalize(s.name).includes('cenarios') || normalize(s.name).includes('cenários'))
    .sort((a, b) => (b.id || 0) - (a.id || 0));

  const targetSuite = batchSuites[0] || featureSuite;

  return {
    plan,
    featureSuite,
    targetSuite,
    executeUrl: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_testPlans/execute?planId=${plan.id}&suiteId=${targetSuite.id}`,
    defineUrl: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_testPlans/define?planId=${plan.id}&suiteId=${targetSuite.id}`,
  };
}

export async function getSuiteTestCases(pat, planId, suiteId) {
  const data = await api(pat, 'GET', `/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?api-version=7.1`);
  return data.value || [];
}

export async function getTestPoints(pat, planId, suiteId) {
  const data = await api(pat, 'GET', `/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestPoint?api-version=7.1`);
  return data.value || [];
}

export function parseStepsXml(xml) {
  if (!xml) return [];
  const steps = [];
  const re = /<step[^>]*>[\s\S]*?<parameterizedString[^>]*>(?:&lt;DIV&gt;&lt;P&gt;)?([\s\S]*?)(?:&lt;\/P&gt;&lt;\/DIV&gt;)?<\/parameterizedString>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (raw) steps.push(raw);
  }
  return steps;
}

export async function getTestCaseDetails(pat, testCaseId) {
  const item = await api(pat, 'GET', `/_apis/wit/workitems/${testCaseId}?api-version=7.1`);
  const title = item.fields['System.Title'] || '';
  const stepsXml = item.fields['Microsoft.VSTS.TCM.Steps'] || '';
  const cnMatch = title.match(/\[(CN-[^\]]+)\]/);
  const strategyRaw = item.fields[FIELD_ESTRATEGIA] || '2. UI';
  const criticidadeRaw = item.fields[FIELD_CRITICIDADE] || '';
  const automationStatusRaw = item.fields[FIELD_STATUS_AUTO] || '';
  const strategy = parseStrategy(strategyRaw);
  const execution = resolveExecutionPlan(strategy);
  return {
    id: testCaseId,
    title,
    cnId: cnMatch ? cnMatch[1] : null,
    steps: parseStepsXml(stepsXml),
    strategyRaw,
    strategy,
    strategyLabel: strategyLabel(strategy),
    execution,
    criticidadeRaw,
    criticidade: parseCriticidade(criticidadeRaw),
    highCriticity: isHighCriticity(criticidadeRaw),
    automationStatusRaw,
    automationPending: needsAutomation(automationStatusRaw),
    automationConcluido: isAutomationConcluido(automationStatusRaw),
  };
}
