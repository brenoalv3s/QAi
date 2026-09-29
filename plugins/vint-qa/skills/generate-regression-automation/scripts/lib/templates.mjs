import { readHub } from '../../../../runtime/lib/project.mjs';
import {
  OPERATION_LABELS,
  subGroupLabel,
} from './feature-structure.mjs';

const TITLE_PREFIX = (() => {
  const hub = readHub() || {};
  return String(hub.prefixoTitulo || hub.projeto || 'QA').trim();
})();

function escapeJsString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '');
}

function escapeRobot(value) {
  return String(value || '').replace(/\s+$/g, '');
}

function toCamel(pascal) {
  const s = String(pascal || '');
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : 'page';
}

/** Garante prefixo Dado / Quando / Então / E nos steps do Test Plans. */
function normalizeBddStep(step, index, total) {
  const raw = String(step || '').trim();
  if (!raw) return 'Dado pré-condição do cenário';
  if (/^(Dado|Quando|Então|E)\b/i.test(raw)) return raw;
  if (index === 0) return `Dado ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`;
  if (index >= total - 1) return `Então ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`;
  return `Quando ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`;
}

function bddStepLabel(step) {
  const raw = String(step || '').trim();
  if (!raw) return 'pré-condição do cenário';
  return raw.replace(/^(Dado|Quando|Então|E)\s+/i, '');
}

function bddHelperName(step, index, total) {
  const raw = String(step || '').trim();
  if (/^E\b/i.test(raw)) return 'e';
  if (/^Então\b/i.test(raw) || index >= total - 1) return 'entao';
  if (/^Quando\b/i.test(raw)) return 'quando';
  if (index === 0 || /^Dado\b/i.test(raw)) return 'dado';
  return 'quando';
}

function stepToMethodName(step) {
  const label = bddStepLabel(step)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const words = label.split(/\s+/).filter(Boolean).slice(0, 10);
  if (!words.length) return 'executarPasso';
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

function fixtureNamesForOperation(operation, pascal) {
  const camel = toCamel(pascal);
  const names = [`${camel}ListagemPage`];
  if (['cadastrar', 'editar', 'excluir'].includes(operation)) {
    names.push(`${camel}CadastroPage`);
  }
  return names;
}

function pomTargetForStep(operation, pascal, index) {
  const camel = toCamel(pascal);
  if (['cadastrar', 'editar', 'excluir'].includes(operation) && index > 0) {
    return `${camel}CadastroPage`;
  }
  return `${camel}ListagemPage`;
}

function collectMethodNames(scenarios) {
  const names = new Set();
  for (const s of scenarios || []) {
    const rawSteps = s.steps?.length ? s.steps : ['pré-condição', 'ação do usuário', 'resultado esperado'];
    for (const step of rawSteps) names.add(stepToMethodName(step));
  }
  return [...names];
}

function buildUiTestBlocks(scenarios, pascal, operation) {
  const fixtures = fixtureNamesForOperation(operation, pascal).join(', ');
  return scenarios
    .map((s) => {
      const rawSteps = s.steps.length ? s.steps : ['pré-condição', 'ação do usuário', 'resultado esperado'];
      const steps = rawSteps
        .map((step, index, arr) => {
          const helper = bddHelperName(step, index, arr.length);
          const label = escapeJsString(bddStepLabel(step));
          const target = pomTargetForStep(operation, pascal, index);
          const method = stepToMethodName(step);
          return `    await ${helper}('${label}', async () => {
      await ${target}.${method}()
    })`;
        })
        .join('\n\n');
      const shortTitle = escapeJsString(s.title.replace(/^\[CN-\d+\]\s*/i, '').slice(0, 80));
      const cnId = escapeJsString(s.cnId);
      const tags = [pascal, operation, s.cnId].filter(Boolean).map((t) => `'@${String(t).replace(/\s+/g, '-').toLowerCase()}'`);
      return `  test(titulo('${cnId}', '${shortTitle}'), { tag: [${tags.join(', ')}] }, async ({ ${fixtures} }) => {
${steps}
  })`;
    })
    .join('\n\n');
}

function buildApiTestBlocks(scenarios, pascal) {
  const camel = toCamel(pascal);
  const clientFix = `${camel}ApiClient`;
  return scenarios
    .map((s) => {
      const rawSteps = s.steps.length ? s.steps : ['autenticação', 'requisição', 'validação'];
      const steps = rawSteps
        .map((step, index, arr) => {
          const helper = bddHelperName(step, index, arr.length);
          const label = escapeJsString(bddStepLabel(step));
          const method = stepToMethodName(step);
          return `    await ${helper}('${label}', async () => {
      await ${clientFix}.${method}()
    })`;
        })
        .join('\n\n');
      const shortTitle = escapeJsString(s.title.replace(/^\[CN-\d+\]\s*/i, '').slice(0, 80));
      const cnId = escapeJsString(s.cnId);
      return `  test(titulo('${cnId}', '${shortTitle}'), async ({ ${clientFix} }) => {
${steps}
  })`;
    })
    .join('\n\n');
}

/**
 * Spec UI por operação — ex.: tests/demandas/ui/cadastrar.spec.ts
 * Spec = só BDD; lógica, locators, dados e expect ficam fora.
 */
export function buildUiSpecFile({
  domainName,
  domainSlug,
  pascal,
  operation,
  subGroups,
  sourceFeature,
}) {
  const operationLabel = OPERATION_LABELS[operation] || operation;
  const entries = [...subGroups.entries()].filter(([, scenarios]) => scenarios.length);
  const needsNested = entries.length > 1 || (entries[0]?.[0] && entries[0][0] !== '__default__');

  let body;
  if (!needsNested) {
    const scenarios = entries[0]?.[1] || [];
    body = buildUiTestBlocks(scenarios, pascal, operation);
  } else {
    body = entries
      .map(([subKey, scenarios]) => {
        const label = subGroupLabel(operation, subKey) || subKey;
        const tests = buildUiTestBlocks(scenarios, pascal, operation);
        return `  test.describe('${escapeJsString(label)}', () => {
${tests}
  })`;
      })
      .join('\n\n');
  }

  const describeTitle = `${escapeJsString(TITLE_PREFIX)} — ${domainName} (US — ${operationLabel})`;

  return `import { test, dado, quando, entao, e, titulo } from '../../../fixtures/main'

/**
 * Regressão UI — ${domainName} — ${operationLabel}
 * Origem PBI: ${escapeJsString(sourceFeature)}
 *
 * Este arquivo é só BDD. Proibido: locators, expect, if/else, for, literais, new Page.
 */
test.describe('${escapeJsString(describeTitle)}', () => {
${body}
})
`;
}

export function buildApiSpecFile({
  domainName,
  domainSlug,
  pascal,
  operation,
  subGroups,
  sourceFeature,
}) {
  const operationLabel = OPERATION_LABELS[operation] || operation;
  const entries = [...subGroups.entries()].filter(([, scenarios]) => scenarios.length);
  const needsNested = entries.length > 1 || (entries[0]?.[0] && entries[0][0] !== '__default__');

  let body;
  if (!needsNested) {
    body = buildApiTestBlocks(entries[0]?.[1] || [], pascal);
  } else {
    body = entries
      .map(([subKey, scenarios]) => {
        const label = subGroupLabel(operation, subKey) || subKey;
        const tests = buildApiTestBlocks(scenarios, pascal);
        return `  test.describe('${escapeJsString(label)}', () => {
${tests}
  })`;
      })
      .join('\n\n');
  }

  const describeTitle = `${escapeJsString(TITLE_PREFIX)} — ${domainName} (US — ${operationLabel}) — API`;

  return `import { test, dado, quando, entao, e, titulo } from '../../../fixtures/api'

/**
 * Regressão API — ${domainName} — ${operationLabel}
 * Origem PBI: ${escapeJsString(sourceFeature)}
 * Spec = só BDD; lógica no client.
 */
test.describe('${escapeJsString(describeTitle)}', () => {
${body}
})
`;
}

export function buildListagemLocators({ domainName }) {
  return `import type { Page } from '@playwright/test'

/** Somente seletores de ${escapeJsString(domainName)} — listagem. Ações ficam no POM. */
export const listagemLocators = (page: Page) => ({
  titulo: page.getByRole('heading', { name: /${escapeJsString(domainName.slice(0, 40))}/i }),
  campoPesquisa: page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|pesquisar/i)),
  linhaGrid: page.getByRole('row'),
  mensagemResultado: page.getByRole('status'),
})
`;
}

export function buildCadastroLocators({ domainName }) {
  return `import type { Page } from '@playwright/test'

/** Somente seletores de ${escapeJsString(domainName)} — cadastro/edição. */
export const cadastroLocators = (page: Page) => ({
  drawer: page.getByRole('dialog'),
  botaoSalvar: page.getByRole('button', { name: /salvar|confirmar/i }),
  botaoCancelar: page.getByRole('button', { name: /cancelar|fechar/i }),
})
`;
}

export function buildListagemPageObject({ domainName, domainSlug, pascal, methodNames = [] }) {
  const methods = (methodNames.length ? methodNames : ['assertTelaListagemCarregada'])
    .map(
      (name) => `  async ${name}() {
    await this.aguardarCarregamento()
    await expect(this.locators.titulo).toBeVisible()
  }`,
    )
    .join('\n\n');

  return `import { expect, type Page } from '@playwright/test'
import { BasePage } from '../base.page'
import { listagemLocators } from '../../locators/${domainSlug}/listagem.locators'

/**
 * Page Object — ${domainName} — listagem.
 * Locators em locators/${domainSlug}/; massa em data/; spec só chama estes métodos.
 */
export class ${pascal}ListagemPage extends BasePage {
  private readonly locators

  constructor(page: Page) {
    super(page)
    this.locators = listagemLocators(page)
  }

${methods}
}
`;
}

export function buildCadastroDrawerPageObject({ domainName, domainSlug, pascal, methodNames = [] }) {
  const methods = (methodNames.length ? methodNames : ['executarCadastroMinimoComSucesso'])
    .map(
      (name) => `  async ${name}() {
    await this.aguardarCarregamento()
    await expect(this.locators.drawer).toBeVisible()
  }`,
    )
    .join('\n\n');

  return `import { expect, type Page } from '@playwright/test'
import { BasePage } from '../base.page'
import { cadastroLocators } from '../../locators/${domainSlug}/cadastro.locators'

/**
 * Page Object — ${domainName} — drawer/modal.
 * Fluxos e if/for ficam aqui — spec só chama o método, sem argumentos de massa.
 */
export class ${pascal}CadastroDrawerPage extends BasePage {
  private readonly locators

  constructor(page: Page) {
    super(page)
    this.locators = cadastroLocators(page)
  }

${methods}
}
`;
}

export function buildDomainPageIndex({ pascal }) {
  return `export { ${pascal}ListagemPage } from './listagem.page'
export { ${pascal}CadastroDrawerPage } from './cadastro-drawer.page'
`;
}

export function buildApiClient({ domainName, domainSlug, pascal, methodNames = [] }) {
  const methods = (methodNames.length ? methodNames : ['login'])
    .map(
      (name) => `  async ${name}() {
    await super.login()
  }`,
    )
    .join('\n\n');

  return `import { APIRequestContext } from '@playwright/test'
import { AuthApiClient } from './auth.client'

/**
 * API Client — ${domainName}
 * Toda lógica de requisição e assert de contrato fica aqui — não no spec.
 */
export class ${pascal}ApiClient extends AuthApiClient {
  constructor(request: APIRequestContext) {
    super(request)
  }

${methods}
}
`;
}

export function buildDomainData({ domainName, domainSlug }) {
  const ident = String(domainSlug || 'dominio').replace(/-/g, '');
  return `import { PREFIXO_E2E, nomeRegistroE2E } from './env'

/** Massa E2E de ${domainName}. Specs não importam este arquivo — o POM usa. */
export const ${ident}Data = {
  prefixo: PREFIXO_E2E,
  nomeNovo: () => nomeRegistroE2E('${domainSlug}'),
}
`;
}

function robotSteps(scenarios, domainSlug, operation) {
  return scenarios
    .map((s) => {
      const rawSteps = s.steps?.length ? s.steps : ['pré-condição', 'ação do usuário', 'resultado esperado'];
      const steps = rawSteps
        .map((step, index, arr) => `    ${escapeRobot(normalizeBddStep(step, index, arr.length))}`)
        .join('\n');
      const title = escapeRobot(s.title.replace(/^\[CN-\d+\]\s*/i, '') || 'Cenário');
      const cnId = escapeRobot(s.cnId || '');
      const tags = [domainSlug, operation, cnId.toLowerCase().replace(/\s+/g, '-')].filter(Boolean).join('    ');
      return `${title}
    [Documentation]    ${cnId} — ${title}
    [Tags]             ${tags}
${steps}`;
    })
    .join('\n\n');
}

/**
 * Suíte Robot BDD — tests/{dominio}/{operacao}.robot
 * Só Settings + casos Dado/Quando/Então/E. Resource = main.
 */
export function buildRobotSuiteFile({
  domainName,
  domainSlug,
  operation,
  scenarios,
  sourceFeature,
}) {
  const cases = robotSteps(scenarios || [], domainSlug, operation);
  return `*** Settings ***
Documentation    ${escapeRobot(domainName)} — ${escapeRobot(operation)}.
...              Origem: ${escapeRobot(sourceFeature || domainName)}.
Resource         ../../resources/fixtures/main.resource

Suite Setup       Preparar Ambiente De Teste
Test Teardown     Capturar Screenshot Se Teste Falhou
Suite Teardown    Encerrar Sessao

*** Test Cases ***
${cases}
`;
}

export function buildRobotLocatorsFile({ domainName }) {
  return `*** Variables ***
# Somente seletores de ${escapeRobot(domainName)}. Keywords usam estas variáveis.
\${LISTAGEM_TITULO}           css=h1
\${LISTAGEM_CAMPO_PESQUISA}   css=input[type="search"]
\${LISTAGEM_LINHA_GRID}       css=table tbody tr
\${LISTAGEM_MSG_RESULTADO}    css=[role="status"]
`;
}

export function buildRobotKeywordsFile({ domainName, scenarios }) {
  const names = new Set();
  for (const s of scenarios || []) {
    const rawSteps = s.steps?.length ? s.steps : ['pré-condição', 'ação do usuário', 'resultado esperado'];
    rawSteps.forEach((step, index, arr) => names.add(normalizeBddStep(step, index, arr.length)));
  }
  if (!names.size) {
    names.add('Dado que usuário acessa a listagem');
  }
  const keywords = [...names]
    .map(
      (name) => `${name}
    Wait For Elements State    \${LISTAGEM_TITULO}    visible`,
    )
    .join('\n\n');
  return `*** Keywords ***
# Keywords BDD de ${escapeRobot(domainName)}. IF/ELSE e locators não vão para o .robot de teste.
${keywords}
`;
}

export function robotMainResourceLines({ domainSlug }) {
  return [
    `Resource         ../locators/${domainSlug}/listagem.resource`,
    `Resource         ../keywords/${domainSlug}/listagem.resource`,
  ];
}

/** @deprecated Use buildUiSpecFile */
export function buildUiSpec(opts) {
  return buildUiSpecFile({
    domainName: opts.feature,
    domainSlug: opts.slug,
    pascal: opts.pascal,
    operation: 'tela-inicial',
    subGroups: new Map([['__default__', opts.scenarios || []]]),
    sourceFeature: opts.feature,
  });
}

/** @deprecated Use buildApiSpecFile */
export function buildApiSpec(opts) {
  return buildApiSpecFile({
    domainName: opts.feature,
    domainSlug: opts.slug,
    pascal: opts.pascal,
    operation: 'tela-inicial',
    subGroups: new Map([['__default__', opts.scenarios || []]]),
    sourceFeature: opts.feature,
  });
}

export { collectMethodNames, stepToMethodName, toCamel };
