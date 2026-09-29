/**
 * Mescla conteúdo de specs quando o mesmo arquivo de operação já existe
 * (ex.: buscar.spec.ts recebendo cenários de "Buscar" e "Filtro avançado").
 */

export function extractCnIds(content) {
  const ids = new Set();
  const re = /test\s*\(\s*['"](CN-[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) ids.add(m[1]);
  return ids;
}

function extractTestBlocks(content) {
  const blocks = [];
  const re = /  test\s*\(\s*['"](CN-[^'"]+)['"][\s\S]*?\n  \}\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    blocks.push({ cnId: m[1], block: m[0] });
  }
  return blocks;
}

function extractNestedDescribe(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `test\\.describe\\(['"]${escaped}['"],\\s*\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n  \\}\\)`,
    'i',
  );
  const m = content.match(re);
  return m ? m[0] : null;
}

/**
 * Anexa blocos test() ao spec existente, criando describe aninhado se necessário.
 */
export function mergeUiSpecContent(existingContent, incomingContent, { subGroupLabel }) {
  const existingIds = extractCnIds(existingContent);
  const incomingBlocks = extractTestBlocks(incomingContent).filter((b) => !existingIds.has(b.cnId));

  if (!incomingBlocks.length) return { content: existingContent, action: 'skipped', added: 0 };

  const toAppend = incomingBlocks.map((b) => b.block).join('\n\n');

  if (!subGroupLabel) {
    const merged = existingContent.replace(/\n\}\)\s*\n?\s*$/, `\n\n${toAppend}\n})\n`);
    return { content: merged, action: 'merged', added: incomingBlocks.length };
  }

  const nested = extractNestedDescribe(existingContent, subGroupLabel);
  if (nested) {
    const updatedNested = nested.replace(/\n  \}\)\s*$/, `\n\n${toAppend}\n  })`);
    const merged = existingContent.replace(nested, updatedNested);
    return { content: merged, action: 'merged', added: incomingBlocks.length };
  }

  const nestedBlock = `  test.describe('${subGroupLabel}', () => {
${toAppend}
  })`;
  const merged = existingContent.replace(/\n\}\)\s*\n?\s*$/, `\n\n${nestedBlock}\n})\n`);
  return { content: merged, action: 'merged', added: incomingBlocks.length };
}

export function mergeManifest(existing, incoming) {
  const base = existing || {};
  const cnIds = [...new Set([...(base.cnIds || []), ...(incoming.cnIds || [])])];
  const files = [...new Set([...(base.files || []), ...(incoming.files || [])])];

  const subFeatureEntry = {
    sourceTitle: incoming.sourceTitle,
    operation: incoming.operation,
    specFile: incoming.specFile,
    subGroup: incoming.subGroup,
    cnIds: incoming.cnIds,
    ui: incoming.ui,
    api: incoming.api,
    generatedAt: incoming.generatedAt,
  };

  const bySource = new Map((base.subFeatures || []).map((sf) => [sf.sourceTitle, sf]));
  bySource.set(incoming.sourceTitle, subFeatureEntry);
  const subFeatures = [...bySource.values()];

  return {
    ...base,
    feature: incoming.domainName || base.feature || base.domainName,
    domainName: incoming.domainName || base.domainName,
    domainSlug: incoming.domainSlug || base.domainSlug,
    slug: incoming.domainSlug || base.domainSlug || base.slug,
    generatedAt: incoming.generatedAt,
    total: cnIds.length,
    ui: subFeatures.reduce((sum, sf) => sum + (sf.ui || 0), 0),
    api: subFeatures.reduce((sum, sf) => sum + (sf.api || 0), 0),
    cnIds,
    files,
    subFeatures,
    structure: incoming.structure || base.structure,
  };
}
