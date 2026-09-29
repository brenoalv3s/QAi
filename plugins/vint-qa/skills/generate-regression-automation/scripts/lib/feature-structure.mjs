import { toSlug, toPascalCase } from './slug.mjs';

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

function normalizeDomainFromFragment(fragment) {
  const n = normalize(fragment);
  if (/demanda/.test(n)) return 'Demandas';
  if (/contrato/.test(n)) return 'Contratos';
  if (/cliente/.test(n)) return 'Clientes';
  if (/colaborador/.test(n)) return 'Colaboradores';
  if (/alocac/.test(n)) return 'Alocações';
  if (/reales|release/.test(n)) return 'Releases';
  return String(fragment || '').trim();
}

/**
 * Extrai domínio (ex.: "Demandas") e operação a partir do título do PBI / suite.
 * Ex.: "Demandas - Cadastrar" → { domainName: "Demandas", operation: "cadastrar" }
 * Ex.: "Cadastrar Demandas" → { domainName: "Demandas", operation: "cadastrar" }
 * Ex.: "Exclusão de demanda" + planName "Demandas" → { domainName: "Demandas", operation: "excluir" }
 * Ex.: "Implementar filtro avançado na tela de Demandas" → { domainName: "Demandas", operation: "buscar" }
 * @param {string} title
 * @param {{ planName?: string }} [options] — nome do Test Plan pai (ex.: "Demandas")
 */
export function parseFeatureTitle(title, options = {}) {
  const sourceTitle = String(title || '').trim();
  const planName = String(options.planName || '').trim();
  let domainName = sourceTitle;
  let actionPart = '';

  const actionDomain = sourceTitle.match(/^(Cadastrar|Editar|Consultar|Buscar|Excluir)\s+(.+)$/i);
  if (actionDomain) {
    domainName = actionDomain[2].trim();
    actionPart = actionDomain[1].trim();
  } else if (/^exclus[aã]o\s+de\s+/i.test(sourceTitle)) {
    const frag = sourceTitle.replace(/^exclus[aã]o\s+de\s+/i, '').trim();
    domainName = normalizeDomainFromFragment(frag) || planName || sourceTitle;
    actionPart = sourceTitle;
  } else if (/^busca\s+avan[cç]ada$/i.test(sourceTitle)) {
    domainName = planName || 'Demandas';
    actionPart = sourceTitle;
  } else if (/^tela\s+inicial$/i.test(sourceTitle)) {
    domainName = planName || sourceTitle;
    actionPart = sourceTitle;
  } else if (/^demandas$/i.test(sourceTitle)) {
    domainName = 'Demandas';
    actionPart = sourceTitle;
  } else if (/^aloca[cç][õo]es$/i.test(sourceTitle)) {
    domainName = 'Alocações';
    actionPart = sourceTitle;
  } else if (/^cadastrar aloca[cç][ãa]o$/i.test(sourceTitle)) {
    domainName = 'Alocações';
    actionPart = sourceTitle;
  } else if (/^editar aloca[cç][ãa]o$/i.test(sourceTitle)) {
    domainName = 'Alocações';
    actionPart = sourceTitle;
  } else if (/^excluir aloca[cç][ãa]o$/i.test(sourceTitle)) {
    domainName = 'Alocações';
    actionPart = sourceTitle;
  } else if (/^realeses$/i.test(sourceTitle) || /^reales$/i.test(sourceTitle)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else if (/^f[eé]rias$/i.test(sourceTitle) || /f[eé]rias/.test(normalize(sourceTitle))) {
    domainName = 'Férias';
    actionPart = sourceTitle;
  } else if (/^cadastrar reales/i.test(sourceTitle)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else if (/^editar reales/i.test(sourceTitle)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else if (/^excluir reales/i.test(sourceTitle)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else if (/historico.*release|release.*historico|obrigatoriedade.*observa|historico de alteracao/i.test(sourceTitle)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else if (/^busca avan[cç]ada$/i.test(sourceTitle) && /reales/i.test(planName)) {
    domainName = 'Releases';
    actionPart = sourceTitle;
  } else {
    const dashSplit = sourceTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashSplit) {
      domainName = dashSplit[1].trim();
      actionPart = dashSplit[2].trim();
    } else {
      const fromTela = extractDomainFromTelaDe(sourceTitle);
      if (fromTela) domainName = fromTela;
      actionPart = sourceTitle;
    }
  }

  const operation = classifyOperation(actionPart || sourceTitle);
  if (/alocac/.test(normalize(domainName))) domainName = 'Alocações';
  if (/reales|release/.test(normalize(domainName))) domainName = 'Releases';
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
