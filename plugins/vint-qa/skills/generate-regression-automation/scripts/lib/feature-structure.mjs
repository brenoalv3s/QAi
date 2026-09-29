import { toSlug, toPascalCase } from './slug.mjs';
import { readHub } from '../../../../runtime/lib/project.mjs';

/** Arquivos de spec por operação (padrão do projeto e2e) */
export const OPERATION_SPEC_FILES = {
  cadastrar: 'cadastrar.spec.ts',
  editar: 'editar.spec.ts',
  buscar: 'buscar.spec.ts',
  excluir: 'excluir.spec.ts',
  'tela-inicial': 'tela-inicial.spec.ts',
};

export const OPERATION_LABELS = {
  cadastrar: 'cadastrar',
  editar: 'editar',
  buscar: 'buscar',
  excluir: 'excluir',
  'tela-inicial': 'tela inicial',
};

/** Sub-grupos dentro de buscar.spec.ts */
export const BUSCAR_SUBGROUPS = {
  'busca-normal': 'busca normal',
  'filtro-avancado': 'filtro avançado',
};

/** Sub-grupos dentro de tela-inicial.spec.ts */
export const TELA_INICIAL_SUBGROUPS = {
  listagem: 'listagem',
  historico: 'histórico',
  visualizar: 'visualizar',
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extractDomainFromTelaDe(title) {
  const m = title.match(/(?:na tela de|em|para)\s+(.+?)(?:\s*$|\s*[-–—])/i);
  if (m) return m[1].trim();
  const m2 = title.match(/(?:na tela de|em)\s+(.+)$/i);
  return m2 ? m2[1].trim() : null;
}

/**
 * Classifica a operação a partir do título do PBI / suite.
 * @returns {'cadastrar'|'editar'|'buscar'|'excluir'|'tela-inicial'}
 */
export function classifyOperation(title) {
  const n = normalize(title);

  if (/filtro\s*avancado|filtros\s*avancados/.test(n)) return 'buscar';
  if (/\bcadastr|\bcadastro|\binserir|\bcriar\b|\bnova\b/.test(n)) return 'cadastrar';
  if (/\beditar|\bedicao|\balterar|\batualizar|\binclusao de campos/.test(n)) return 'editar';
  if (/\bexcluir|\bexclusao|\bdeletar|\bremover\b/.test(n)) return 'excluir';
  if (/\bbusca\b|\bbuscar|\bconsulta\b|\bconsultar|\bpesquis|\bfiltrar|\bfiltro\b/.test(n)) return 'buscar';
  if (/tela inicial|\blistagem|\bgrid\b|\btela de consulta/.test(n)) return 'tela-inicial';
  if (/\bvisualiz|\bdetalhes\b/.test(n)) return 'tela-inicial';
  if (/\bhistorico\b/.test(n)) return 'tela-inicial';

  return 'tela-inicial';
}

/**
 * Sub-grupo opcional (describe aninhado).
 */
export function classifySubGroup(title, operation, scenario = null) {
  const sources = [title, scenario?.title, ...(scenario?.steps || [])].filter(Boolean);
  const n = normalize(sources.join(' '));

  if (operation === 'buscar') {
    if (/filtro\s*avancado|filtros\s*avancados|painel de filtros/.test(n)) return 'filtro-avancado';
    return 'busca-normal';
  }

  if (operation === 'tela-inicial') {
    if (/\bhistorico\b/.test(n)) return 'historico';
    if (/\bvisualiz|\bdetalhes\b|\bvisualizar registro/.test(n)) return 'visualizar';
    return 'listagem';
  }

  return null;
}

/**
 * Apelidos de domínio do projeto: `.hub-projeto.json` → `automacao.dominios`
 * = [{ "nome": "Pedidos", "keywords": ["pedido", "ordem de venda"] }].
 */
function domainAliases() {
  const list = readHub()?.automacao?.dominios;
  return Array.isArray(list) ? list.filter((d) => d && d.nome) : [];
}

function singular(text) {
  return normalize(text).replace(/(oes|aes)$/, 'ao').replace(/(ns)$/, 'm').replace(/([^s])s$/, '$1');
}

function normalizeDomain(name, planName = '') {
  const words = (t) => ` ${normalize(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const n = words(name);
  const alias = domainAliases().find((d) => (d.keywords || [d.nome]).some((k) => words(k).trim() && n.includes(words(k))));
  if (alias) return alias.nome;
  if (planName && singular(name) === singular(planName)) return planName;
  return String(name || '').trim();
}

/** Títulos que descrevem só a ação/tela, sem o domínio. */
const ACTION_ONLY = /^(busca(\s+avan[cç]ada)?|buscar|consulta|consultar|tela\s+inicial|listagem|visualizar|detalhes|hist[oó]rico(\s+de\s+altera[cç](ão|ões))?|filtros?(\s+avan[cç]ados?)?)$/i;

/**
 * Extrai domínio (ex.: "Pedidos") e operação a partir do título do PBI / suite.
 * Ex.: "Pedidos - Cadastrar" → { domainName: "Pedidos", operation: "cadastrar" }
 * Ex.: "Cadastrar Pedidos" → { domainName: "Pedidos", operation: "cadastrar" }
 * Ex.: "Exclusão de pedido" + planName "Pedidos" → { domainName: "Pedidos", operation: "excluir" }
 * Ex.: "Implementar filtro avançado na tela de Pedidos" → { domainName: "Pedidos", operation: "buscar" }
 * Ex.: "Busca avançada" + planName "Pedidos" → { domainName: "Pedidos", operation: "buscar" }
 * @param {string} title
 * @param {{ planName?: string }} [options] — nome do Test Plan pai (ex.: "Pedidos")
 */
export function parseFeatureTitle(title, options = {}) {
  const sourceTitle = String(title || '').trim();
  const planName = String(options.planName || '').trim();
  let domainName = sourceTitle;
  let actionPart = sourceTitle;

  const actionDomain = sourceTitle.match(/^(Cadastrar|Editar|Consultar|Buscar|Excluir|Visualizar)\s+(.+)$/i);
  const exclusion = sourceTitle.match(/^exclus[aã]o\s+de\s+(.+)$/i);
  const dashSplit = sourceTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);

  if (ACTION_ONLY.test(sourceTitle)) {
    domainName = planName || sourceTitle;
  } else if (actionDomain) {
    domainName = actionDomain[2].trim();
    actionPart = actionDomain[1].trim();
  } else if (exclusion) {
    domainName = exclusion[1].trim() || planName || sourceTitle;
  } else if (dashSplit) {
    domainName = dashSplit[1].trim();
    actionPart = dashSplit[2].trim();
  } else {
    domainName = extractDomainFromTelaDe(sourceTitle) || sourceTitle;
  }

  domainName = normalizeDomain(domainName, planName);
  const operation = classifyOperation(actionPart || sourceTitle);
  const domainSlug = toSlug(domainName);
  const pascal = toPascalCase(domainSlug);
  const subGroup = classifySubGroup(sourceTitle, operation);

  return {
    sourceTitle,
    domainName,
    domainSlug,
    pascal,
    operation,
    operationLabel: OPERATION_LABELS[operation],
    specFile: OPERATION_SPEC_FILES[operation],
    subGroup,
  };
}

/**
 * Agrupa cenários por arquivo de spec e sub-grupo (describe aninhado).
 * @returns {Map<string, Map<string|null, object[]>>} specFile → subGroup → scenarios
 */
export function groupScenariosBySpec(scenarios, featureTitle, options = {}) {
  const structure = parseFeatureTitle(featureTitle, options);
  const grouped = new Map();

  for (const scenario of scenarios) {
    const op = scenario.inferredOperation || structure.operation;
    const specFile = OPERATION_SPEC_FILES[op];
    const subGroup = classifySubGroup(featureTitle, op, scenario) || structure.subGroup;

    if (!grouped.has(specFile)) grouped.set(specFile, new Map());
    const bySub = grouped.get(specFile);
    const key = subGroup || '__default__';
    if (!bySub.has(key)) bySub.set(key, []);
    bySub.get(key).push({
      ...scenario,
      _structure: {
        domainName: structure.domainName,
        domainSlug: structure.domainSlug,
        operation: op,
        specFile,
        subGroup: subGroup || null,
      },
    });
  }

  return { structure, grouped };
}

export function subGroupLabel(operation, subGroupKey) {
  if (!subGroupKey || subGroupKey === '__default__') return null;
  if (operation === 'buscar') return BUSCAR_SUBGROUPS[subGroupKey] || subGroupKey;
  if (operation === 'tela-inicial') return TELA_INICIAL_SUBGROUPS[subGroupKey] || subGroupKey;
  return subGroupKey;
}

export function annotateScenarios(scenarios, featureTitle, options = {}) {
  const structure = parseFeatureTitle(featureTitle, options);
  return scenarios.map((s) => ({
    ...s,
    structure: {
      ...structure,
      subGroup: classifySubGroup(featureTitle, structure.operation, s),
    },
  }));
}
