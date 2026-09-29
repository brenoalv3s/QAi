#!/usr/bin/env node
/**
 * Resolve PBI no Azure DevOps por ID ou título (nome).
 * Uso:
 *   node resolve-pbi.mjs --id 25862 --json
 *   node resolve-pbi.mjs --title "Cadastro de Colaboradores" --json
 *   node resolve-pbi.mjs --title "25862" --json
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';
import { ORG, PROJECT, PROJECT_ENC, loadPat } from '../../../runtime/lib/azure.mjs';

const PBI_TYPES = ['Product Backlog Item', 'User Story', 'Feature'];

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

function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

async function api(pat, path, options = {}) {
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, {
    headers: { ...authHeader(pat), 'Content-Type': 'application/json', ...options.headers },
    method: options.method || 'GET',
    body: options.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function stripPbiPrefix(raw) {
  return String(raw || '')
    .replace(/^\s*(pbi|product backlog item|item)\s*[:#-]?\s*/i, '')
    .replace(/^#/, '')
    .trim();
}

function extractFeatureFromTitle(title) {
  const t = String(title || '').trim();
  const func = t.match(/funcionalidade(?:\s+de)?\s*[:\-]?\s*(.+)$/i);
  if (func) return func[1].replace(/\s+/g, ' ').trim();
  return t
    .replace(/^(implementar|criar|incluir|adicionar|desenvolver)\s+/i, '')
    .replace(/\s+na funcionalidade\s+.+$/i, '')
    .trim() || t;
}

function summarize(item) {
  const title = item.fields?.['System.Title'] || '';
  return {
    pbiId: item.id,
    pbiTitle: title,
    workItemType: item.fields?.['System.WorkItemType'] || '',
    state: item.fields?.['System.State'] || '',
    feature: extractFeatureFromTitle(title),
    url: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_workitems/edit/${item.id}`,
  };
}

async function getById(pat, id) {
  const item = await api(pat, `/_apis/wit/workitems/${id}?api-version=7.1`);
  return item;
}

async function searchByTitle(pat, title) {
  const escaped = String(title).replace(/'/g, "''");
  const typeClause = PBI_TYPES.map((t) => `'${t}'`).join(', ');
  const wiql = {
    query: `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
FROM WorkItems
WHERE [System.TeamProject] = '${PROJECT.replace(/'/g, "''")}'
AND [System.WorkItemType] IN (${typeClause})
AND [System.Title] CONTAINS '${escaped}'
ORDER BY [System.ChangedDate] DESC`,
  };
  const result = await api(pat, '/_apis/wit/wiql?api-version=7.1', {
    method: 'POST',
    body: JSON.stringify(wiql),
  });
  const ids = (result.workItems || []).map((w) => w.id).slice(0, 25);
  if (!ids.length) return [];
  const batch = await api(
    pat,
    `/_apis/wit/workitems?ids=${ids.join(',')}&api-version=7.1`,
  );
  return batch.value || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonOnly = args.json === true;
  let raw = args.id || args.pbi || args.title || args.feature || '';
  if (raw === true) raw = '';
  raw = stripPbiPrefix(raw);
  if (!raw) {
    console.error('Uso: --id N  |  --title "Nome do PBI"  [--json]');
    process.exit(1);
  }

  const pat = loadPat();
  let matches = [];

  if (/^\d+$/.test(raw)) {
    try {
      matches = [summarize(await getById(pat, raw))];
    } catch (err) {
      matches = [];
      if (!jsonOnly) console.error(err.message);
    }
  } else {
    const items = await searchByTitle(pat, raw);
    matches = items.map(summarize);
    const exact = matches.filter((m) => m.pbiTitle.toLowerCase() === raw.toLowerCase());
    if (exact.length === 1) matches = exact;
  }

  const output = {
    query: raw,
    found: matches.length,
    matches,
    pbiId: matches.length === 1 ? matches[0].pbiId : null,
    feature: matches.length === 1 ? matches[0].feature : null,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (!matches.length) {
    console.log(`Nenhum PBI encontrado para: ${raw}`);
    process.exit(2);
  }
  for (const m of matches) {
    console.log(`#${m.pbiId} [${m.workItemType}] ${m.pbiTitle} → feature: ${m.feature}`);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
