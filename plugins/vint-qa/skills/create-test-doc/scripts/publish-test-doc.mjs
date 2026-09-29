#!/usr/bin/env node
/**
 * Publica documento-de-teste.md na wiki Azure DevOps (Documentos de Testes).
 * Uso: node publish-test-doc.mjs <caminho-documento-de-teste.md>
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import {
  ORG,
  PROJECT,
  PROJECT_ENC,
  loadPat,
  assertAzureConfig,
  WIKI_ID,
  DOCS_BASE,
  WIKI_LOGO,
  WIKI_MODULE_HINTS as US_MODULE_HINTS,
} from '../../../runtime/lib/azure.mjs';

const PARENT_INDEX_CONTENT = `${WIKI_LOGO ? `${WIKI_LOGO}\n\n` : ''}[[_TOC_]]
`;

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function encodeWikiPath(path) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function wikiGet(pat, pagePath) {
  const enc = encodeWikiPath(pagePath);
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wiki/wikis/${WIKI_ID}/pages?path=${enc}&includeContent=false&api-version=7.1`,
    { headers: authHeader(pat) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET wiki page ${pagePath} → ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return { ...data, eTag: res.headers.get('etag') };
}

async function wikiPut(pat, pagePath, content, eTag = null, comment = '') {
  const enc = encodeWikiPath(pagePath);
  const headers = { ...authHeader(pat), 'Content-Type': 'application/json' };
  if (eTag) headers['If-Match'] = eTag;

  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wiki/wikis/${WIKI_ID}/pages?path=${enc}&api-version=7.1`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content, comment: comment || undefined }),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT wiki page ${pagePath} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function listChildPages(pat, parentPath) {
  const enc = encodeWikiPath(parentPath);
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wiki/wikis/${WIKI_ID}/pages?path=${enc}&recursionLevel=oneLevel&includeContent=false&api-version=7.1`,
    { headers: authHeader(pat) }
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LIST wiki pages ${parentPath} → ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.subPages || [];
}

function extractMetadata(md) {
  const meta = {};
  const func = md.match(/\*\*Funcionalidade:\*\*\s*(.+)/);
  const us = md.match(/\*\*US de referência:\*\*\s*(US\s*[\d.]+[^|\n]*)/i);
  const wikiDoc = md.match(/\*\*Wiki \(DOC\):\*\*\s*(DOC\s*[\d.]+[^|\n]*)/i);
  if (func) meta.funcionalidade = func[1].trim();
  if (us) meta.usRef = us[1].trim();
  if (wikiDoc) meta.wikiDoc = wikiDoc[1].trim();
  return meta;
}

function extractUsNumber(md) {
  const meta = extractMetadata(md);
  if (meta.usRef) {
    const m = meta.usRef.match(/US\s*(\d+)(?:\.(\d+))?/i);
    if (m) return { major: m[1], minor: m[2] || null, full: m[2] ? `${m[1]}.${m[2]}` : m[1] };
  }

  const testPlan = md.match(/\[Link do Azure Test Plans:\s*US\s*(\d+)(?:\.(\d+))?\s*[-—]/i);
  if (testPlan) {
    return {
      major: testPlan[1],
      minor: testPlan[2] || null,
      full: testPlan[2] ? `${testPlan[1]}.${testPlan[2]}` : testPlan[1],
    };
  }

  const objective = md.match(/\(US\s*(\d+)(?:\.(\d+))?/i);
  if (objective) {
    return {
      major: objective[1],
      minor: objective[2] || null,
      full: objective[2] ? `${objective[1]}.${objective[2]}` : objective[1],
    };
  }

  return null;
}

function extractFeatureTitle(md, us) {
  const meta = extractMetadata(md);
  if (meta.wikiDoc) {
    return meta.wikiDoc.replace(/^DOC\s*[\d.]+\s*-\s*/i, '').trim();
  }

  const testPlan = md.match(/\[Link do Azure Test Plans:\s*US\s*[\d.]+\s*[-—]\s*([^\]]+)\]/i);
  if (testPlan) return testPlan[1].trim();

  if (meta.funcionalidade) return meta.funcionalidade;

  const objective = md.match(/Validar que[^(]+/i);
  if (objective) {
    const text = objective[0].replace(/^Validar que\s*/i, '').slice(0, 80).trim();
    if (text) return text;
  }

  return us?.full ? `US ${us.full}` : 'Documento de Teste';
}

function resolveHint(us) {
  if (!us?.minor) return null;
  const prefix = `${us.major}.`;
  return US_MODULE_HINTS.find((h) => prefix.startsWith(h.usPrefix) || h.usPrefix.startsWith(prefix));
}

function buildDocPageName(docParentNum, us, title) {
  if (us.minor) {
    const sub = `${docParentNum}.${us.minor}`;
    return `DOC ${sub} - ${title}`;
  }
  return `DOC ${docParentNum} - ${title}`;
}

async function walkWikiPages(pat, parentPath, acc = []) {
  const children = await listChildPages(pat, parentPath);
  for (const page of children) {
    acc.push(page);
    await walkWikiPages(pat, page.path, acc);
  }
  return acc;
}

function pageMatchesUs(pagePath, us) {
  const name = normalize(pagePath.split('/').pop() || '');
  if (us.minor) {
    const variants = [
      `doc ${us.major}.${us.minor}`,
      `doc ${us.major}.${us.minor}`,
      `doc ${Number(us.major)}.${us.minor}`,
    ];
    const hint = resolveHint(us);
    if (hint?.docParentNum && hint.docParentNum !== us.major) variants.push(`doc ${hint.docParentNum}.${us.minor}`);
    return variants.some((v) => name.includes(v));
  }
  return name.includes(`doc ${us.major}`) || name.includes(`doc ${Number(us.major)}`);
}

async function findExistingPageByUs(pat, us) {
  const allPages = await walkWikiPages(pat, DOCS_BASE);
  const matches = allPages.filter((p) => pageMatchesUs(p.path, us));
  if (matches.length === 1) return matches[0].path;
  if (matches.length > 1) {
    const withSub = matches.find((p) => p.path.includes('/') && p.path.split('/').length > DOCS_BASE.split('/').length + 1);
    return (withSub || matches[0]).path;
  }
  return null;
}

async function resolveTargetPath(pat, md) {
  if (process.env.AZURE_DEVOPS_WIKI_PAGE_PATH) {
    return { path: process.env.AZURE_DEVOPS_WIKI_PAGE_PATH, created: false, parentPath: null };
  }

  const meta = extractMetadata(md);
  if (meta.wikiDoc) {
    const hint = resolveHint(extractUsNumber(md));
    const pageName = meta.wikiDoc.trim();
    if (hint && extractUsNumber(md)?.minor) {
      return {
        path: `${DOCS_BASE}/${hint.parentFolder}/${pageName}`,
        parentPath: `${DOCS_BASE}/${hint.parentFolder}`,
        created: false,
      };
    }
    return { path: `${DOCS_BASE}/${pageName}`, parentPath: null, created: false };
  }

  const us = extractUsNumber(md);
  if (!us) throw new Error('Não foi possível extrair US do documento. Adicione metadados **US de referência:** e **Wiki (DOC):**');

  const existing = await findExistingPageByUs(pat, us);
  if (existing) return { path: existing, created: false, parentPath: null };

  const title = extractFeatureTitle(md, us);
  const hint = resolveHint(us);

  if (us.minor && hint) {
    const pageName = buildDocPageName(hint.docParentNum, us, title);
    return {
      path: `${DOCS_BASE}/${hint.parentFolder}/${pageName}`,
      parentPath: `${DOCS_BASE}/${hint.parentFolder}`,
      created: true,
    };
  }

  if (us.minor) {
    const pageName = `DOC ${us.full} - ${title}`;
    return { path: `${DOCS_BASE}/DOC ${us.major} - ${title.split(' ')[0]}/${pageName}`, parentPath: null, created: true };
  }

  const pageName = `DOC ${us.major} - ${title}`;
  return { path: `${DOCS_BASE}/${pageName}`, parentPath: null, created: true };
}

async function ensureParentExists(pat, parentPath) {
  const existing = await wikiGet(pat, parentPath);
  if (existing) return { existed: true };

  const parentName = parentPath.split('/').pop();
  await wikiPut(pat, parentPath, PARENT_INDEX_CONTENT, null, `Índice criado — Agent — ${new Date().toLocaleDateString('pt-BR')}`);
  return { existed: false, name: parentName };
}

function wikiPageUrl(pagePath) {
  const enc = pagePath.split('/').map(encodeURIComponent).join('/');
  return `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_wiki/wikis/${WIKI_ID}?pagePath=${enc}`;
}

async function main() {
  const mdPath = process.argv[2];
  if (!mdPath) {
    console.error('Uso: node publish-test-doc.mjs <documento-de-teste.md>');
    process.exit(1);
  }

  const absPath = resolve(process.cwd(), mdPath);
  const md = readFileSync(absPath, 'utf8');

  if (!md.includes('[[_TOC_]]')) {
    console.error('Documento inválido: [[_TOC_]] ausente.');
    process.exit(1);
  }
  if (!md.includes('# 1. Análise de Escopo e Objetivos')) {
    console.error('Documento inválido: seção 1 ausente.');
    process.exit(1);
  }

  assertAzureConfig({ requireWiki: true });
  const pat = loadPat();
  const { path: targetPath, parentPath, created } = await resolveTargetPath(pat, md);

  let parentCreated = false;
  if (parentPath) {
    const parentResult = await ensureParentExists(pat, parentPath);
    parentCreated = !parentResult.existed;
  }

  const existing = await wikiGet(pat, targetPath);
  const today = new Date().toLocaleDateString('pt-BR');
  const comment = `Documento de Teste — Agent — ${today}`;
  const action = existing ? 'atualizada' : 'criada';

  await wikiPut(pat, targetPath, md, existing?.eTag, comment);

  const pageName = targetPath.split('/').pop();

  console.log('WIKI — Publicação concluída');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Página: ${pageName}`);
  console.log(`Path: ${targetPath}`);
  console.log(`Ação: ${action}`);
  if (parentCreated) console.log(`Pasta pai criada: ${parentPath}`);
  console.log(`URL: ${wikiPageUrl(targetPath)}`);
  if (created && !existing) console.log('Nota: página nova inferida — revise o path na wiki se necessário');
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
