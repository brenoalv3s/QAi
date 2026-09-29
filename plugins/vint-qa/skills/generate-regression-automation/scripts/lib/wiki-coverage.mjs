import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  isHighCriticity,
  parseCriticidade,
} from '../../../execute-manual-tests/scripts/lib/test-plan-utils.mjs';
import {
  parseStrategy,
  strategyLabel,
  resolveExecutionPlan,
  extractStrategyFromMd,
} from '../../../execute-manual-tests/scripts/lib/strategy-utils.mjs';
import { classifyOperation, parseFeatureTitle } from './feature-structure.mjs';
import { toSlug } from './slug.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../../runtime/lib/project.mjs';

const REF_PATTERNS = {
  rn: /\bRN[_\s-]?(\d+)\b/gi,
  us: /\bUS[_\s-]?(\d+\.\d+)\b/gi,
  msa: /\bMSA[_\s-]?(\d+)\b/gi,
  msc: /\bMSC[_\s-]?(\d+)\b/gi,
  crit: /\bC\.(\d+)\b/gi,
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function uniqueRefs(text) {
  const refs = { rn: new Set(), us: new Set(), msa: new Set(), msc: new Set(), crit: new Set() };
  for (const [key, re] of Object.entries(REF_PATTERNS)) {
    const copy = new RegExp(re.source, re.flags);
    let m;
    while ((m = copy.exec(text)) !== null) {
      const token =
        key === 'rn'
          ? `RN${m[1]}`
          : key === 'us'
            ? `US${m[1]}`
            : key === 'msa'
              ? `MSA_${m[1]}`
              : key === 'msc'
                ? `MSC_${m[1]}`
                : `C.${m[1]}`;
      refs[key].add(token);
    }
  }
  return refs;
}

function flattenRefs(refs) {
  return [...refs.rn, ...refs.us, ...refs.msa, ...refs.msc, ...refs.crit];
}

function extractCriticidadeFromMd(block) {
  const m = block.match(/\|\s*\*\*Criticidade\*\*\s*\|\s*([^|\n]+)/i);
  return m ? m[1].trim() : '';
}

function extractStepsFromMd(block) {
  const steps = [];
  const re = /\*\s+\*\*(Dado|Quando|E|Então)\*\*\s+(.+)/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    const prefix = m[1].toLowerCase().startsWith('e') ? 'Então' : m[1];
    steps.push(`${prefix} ${m[2].trim()}`);
  }
  return steps;
}

function parseScenariosFromMarkdown(content, sourcePath) {
  const scenarios = [];
  const blocks = content.split(/\n---\n/);
  for (const block of blocks) {
    const header = block.match(/^##\s+\[(CN-[^\]]+)\]\s+(.+)$/m);
    if (!header) continue;
    const cnId = header[1];
    const title = header[2].trim();
    const criticidadeRaw = extractCriticidadeFromMd(block);
    if (!isHighCriticity(criticidadeRaw)) continue;
    const strategy = extractStrategyFromMd(block);
    const execution = resolveExecutionPlan(strategy);
    const steps = extractStepsFromMd(block);
    const refs = uniqueRefs(block);
    scenarios.push({
      cnId,
      title: `[${cnId}] ${title}`,
      steps,
      strategyRaw: strategy === 'api' ? '1. API' : strategy === 'api_ui' ? '5. API + UI' : '2. UI',
      strategy,
      strategyLabel: strategyLabel(strategy),
      execution,
      criticidadeRaw,
      criticidade: parseCriticidade(criticidadeRaw),
      highCriticity: true,
      source: 'local-scenarios-md',
      sourcePath,
      wikiRefs: flattenRefs(refs),
      inferredOperation: classifyOperation(title),
    });
  }
  return scenarios;
}

function walkMarkdownFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdownFiles(full, acc);
    else if (entry.endsWith('.md')) acc.push(full);
  }
  return acc;
}

function scoreWikiPage(path, feature, domainName) {
  const hay = normalize(`${path} ${readFileSync(path, 'utf8').slice(0, 500)}`);
  const terms = [feature, domainName, 'spec', 'us ', 'regra']
    .map(normalize)
    .filter((t) => t.length > 2);
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 1;
  }
  if (/spec|\.us\.|regra-de-negocio|mensagens/i.test(path)) score += 2;
  return score;
}

export function findWikiDocuments(feature) {
  const structure = parseFeatureTitle(feature);
  const slug = toSlug(feature);
  const domainSlug = structure.domainSlug;
  const docs = [];

  const localScenarios = resolve(ROOT, `docs/test-scenarios/${domainSlug}/cenarios-de-teste.md`);
  if (existsSync(localScenarios)) {
    docs.push({ path: localScenarios, kind: 'local-scenarios-md', score: 100 });
  }
  const altSlug = resolve(ROOT, `docs/test-scenarios/${slug}/cenarios-de-teste.md`);
  if (existsSync(altSlug) && altSlug !== localScenarios) {
    docs.push({ path: altSlug, kind: 'local-scenarios-md', score: 95 });
  }

  const wikiDir = resolve(ROOT, 'e2e/docs/wiki');
  for (const file of walkMarkdownFiles(wikiDir)) {
    const score = scoreWikiPage(file, feature, structure.domainName);
    if (score >= 2) docs.push({ path: file, kind: 'wiki-sync', score });
  }

  const testDocs = resolve(ROOT, `docs/test-docs/${domainSlug}/documento-de-teste.md`);
  if (existsSync(testDocs)) {
    docs.push({ path: testDocs, kind: 'test-doc', score: 80 });
  }

  return docs.sort((a, b) => b.score - a.score);
}

export function collectCoveredRefs(testPlanScenarios) {
  const cnIds = new Set();
  const refs = { rn: new Set(), us: new Set(), msa: new Set(), msc: new Set(), crit: new Set() };
  for (const s of testPlanScenarios) {
    if (s.cnId) cnIds.add(s.cnId);
    const blob = `${s.title}\n${(s.steps || []).join('\n')}`;
    const found = uniqueRefs(blob);
    for (const key of Object.keys(refs)) {
      for (const r of found[key]) refs[key].add(r);
    }
  }
  return { cnIds, refs };
}

function inferCriticidadeFromWikiContext(text, refType) {
  if (refType === 'us' || /caminho feliz|c\.1|smoke/i.test(text)) {
    return { raw: '1. Muito Alta', level: 'muito_alta' };
  }
  if (refType === 'rn') return { raw: '2. Alta', level: 'alta' };
  if (refType === 'msa' && /acesso|permiss|autoriz/i.test(text)) {
    return { raw: '2. Alta', level: 'alta' };
  }
  if (refType === 'crit' && /\bc\.1\b/i.test(text)) {
    return { raw: '1. Muito Alta', level: 'muito_alta' };
  }
  return null;
}

function buildWikiGapScenario({ ref, refType, excerpt, feature, sourcePath }) {
  const crit = inferCriticidadeFromWikiContext(excerpt, refType);
  if (!crit) return null;
  const strategy = STRATEGY_UI();
  const title = `${feature} - Cobertura wiki ${ref} - Comportamento documentado`;
  const steps = [
    `Dado pré-condição conforme ${ref} na documentação wiki`,
    `Quando o usuário executa o fluxo associado a ${ref}`,
    `Então o sistema se comporta conforme ${ref} descrito na wiki`,
  ];
  return {
    id: null,
    cnId: `WIKI-${ref.replace(/\./g, '-')}`,
    title,
    steps,
    strategyRaw: '2. UI',
    strategy: strategy.strategy,
    strategyLabel: strategy.strategyLabel,
    execution: strategy.execution,
    criticidadeRaw: crit.raw,
    criticidade: crit.level,
    highCriticity: true,
    automationPending: true,
    source: 'wiki-inferred',
    sourcePath,
    wikiRefs: [ref],
    rationale: `${ref} presente na wiki sem cenário equivalente no Test Plans (Muito Alta/Alta)`,
    inferredOperation: classifyOperation(`${feature} ${excerpt}`),
  };
}

function STRATEGY_UI() {
  const strategy = parseStrategy('2. UI');
  return { strategy, strategyLabel: strategyLabel(strategy), execution: resolveExecutionPlan(strategy) };
}

export function analyzeWikiCoverageGaps(feature, testPlanScenarios) {
  const docs = findWikiDocuments(feature);
  const { cnIds: coveredCnIds, refs: coveredRefs } = collectCoveredRefs(testPlanScenarios);
  const gaps = [];
  const sourcesConsulted = [];
  const localHighCrit = [];

  for (const doc of docs) {
    sourcesConsulted.push({ path: doc.path.replace(/\\/g, '/'), kind: doc.kind, score: doc.score });
    const content = readFileSync(doc.path, 'utf8');

    if (doc.kind === 'local-scenarios-md') {
      const parsed = parseScenariosFromMarkdown(content, doc.path);
      for (const s of parsed) {
        localHighCrit.push(s);
        if (!coveredCnIds.has(s.cnId)) {
          gaps.push({
            ...s,
            rationale: `${s.cnId} com criticidade Muito Alta/Alta no .md local mas ausente no Test Plans`,
          });
        }
      }
      continue;
    }

    const pageRefs = uniqueRefs(content);
    for (const [refType, set] of Object.entries(pageRefs)) {
      for (const ref of set) {
        if (coveredRefs[refType]?.has(ref)) continue;
        const idx = content.search(new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        const excerpt = idx >= 0 ? content.slice(Math.max(0, idx - 120), idx + 200) : content.slice(0, 300);
        const scenario = buildWikiGapScenario({
          ref,
          refType,
          excerpt,
          feature,
          sourcePath: doc.path,
        });
        if (!scenario) continue;
        const dup = gaps.some((g) => g.cnId === scenario.cnId);
        if (!dup) gaps.push(scenario);
      }
    }
  }

  return {
    feature,
    sourcesConsulted,
    testPlanCount: testPlanScenarios.length,
    testPlanHighCriticity: testPlanScenarios.filter((s) => s.highCriticity).length,
    localScenariosHighCriticity: localHighCrit.length,
    gapCount: gaps.length,
    gapScenarios: gaps,
    coveredRefs: {
      cnIds: [...coveredCnIds],
      rn: [...coveredRefs.rn],
      us: [...coveredRefs.us],
      msa: [...coveredRefs.msa],
      msc: [...coveredRefs.msc],
    },
  };
}

export function mergeRegressionScenarios(testPlanHigh, gapScenarios) {
  const byCn = new Map();
  for (const s of testPlanHigh) {
    if (s.cnId) byCn.set(s.cnId, { ...s, source: s.source || 'test-plans' });
  }
  for (const g of gapScenarios) {
    if (!byCn.has(g.cnId)) byCn.set(g.cnId, g);
  }
  return [...byCn.values()];
}
