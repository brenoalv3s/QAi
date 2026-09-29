import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { ORG, PROJECT_ENC } from '../../../../runtime/lib/azure.mjs';

export { PROJECT_ROOT as ROOT } from '../../../../runtime/lib/project.mjs';
export { ORG, PROJECT, PROJECT_ENC, loadPat, authHeader } from '../../../../runtime/lib/azure.mjs';
import { authHeader } from '../../../../runtime/lib/azure.mjs';

export async function api(pat, method, path, body, contentType = 'application/json') {
  const headers = { ...authHeader(pat) };
  if (body) headers['Content-Type'] = contentType;
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}${path}`, { method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function workItemUrl(id) {
  return `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}`;
}

export async function getWorkItem(pat, id, expand = 'relations') {
  const q = expand ? `?$expand=${expand}&api-version=7.1` : '?api-version=7.1';
  return api(pat, 'GET', `/_apis/wit/workitems/${id}${q}`);
}

function relationMatches(rel, targetId) {
  const needle = `/${targetId}`;
  return String(rel?.url || '').endsWith(needle) || String(rel?.url || '').includes(`/workitems/${targetId}`);
}

export async function addWorkItemRelation(pat, fromId, rel, toId) {
  const item = await getWorkItem(pat, fromId, 'relations');
  const exists = (item.relations || []).some((r) => r.rel === rel && relationMatches(r, toId));
  if (exists) return { skipped: true, fromId, toId, rel };
  await api(
    pat,
    'PATCH',
    `/_apis/wit/workitems/${fromId}?api-version=7.1`,
    JSON.stringify([
      { op: 'add', path: '/relations/-', value: { rel, url: workItemUrl(toId) } },
    ]),
    'application/json-patch+json',
  );
  return { skipped: false, fromId, toId, rel };
}

/** Test Case "Tests" o PBI (card do cenário no Test Plans mostra o PBI). */
export async function linkPbiToTestCase(pat, pbiId, testCaseId) {
  const a = await addWorkItemRelation(pat, testCaseId, 'Microsoft.VSTS.Common.TestedBy-Reverse', pbiId);
  return { testCaseToPbi: a, pbiToTestCase: { skipped: true } };
}

/** Upload binário → attachment Azure (URL usável em AttachedFile / Test Result). */
export async function uploadWorkItemAttachment(pat, filePath) {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  const fileName = basename(filePath);
  const content = readFileSync(filePath);
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.1`,
    {
      method: 'POST',
      headers: { ...authHeader(pat), 'Content-Type': 'application/octet-stream', 'Content-Length': String(content.length) },
      body: content,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload attachment → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** Anexa arquivo já uploaded ao Work Item (PBI / Task / Bug). */
export async function attachFileToWorkItem(pat, workItemId, attachmentUrl, comment = 'Evidência de execução manual') {
  await api(
    pat,
    'PATCH',
    `/_apis/wit/workitems/${workItemId}?api-version=7.1`,
    JSON.stringify([
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'AttachedFile',
          url: attachmentUrl,
          attributes: { comment },
        },
      },
    ]),
    'application/json-patch+json',
  );
  return { workItemId, attachmentUrl };
}

/**
 * Anexa arquivo ao Test Result (cenário no Test Plans).
 * A API exige `stream` em Base64 do conteúdo — NÃO URL de attachment WIT.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/test/attachments/create-test-result-attachment
 */
export async function attachFileToTestResult(pat, runId, resultId, filePath, comment = '') {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  const fileName = basename(filePath);
  const content = readFileSync(filePath);
  if (!content.length) throw new Error(`Arquivo vazio: ${filePath}`);

  const payload = {
    attachmentType: 'GeneralAttachment',
    fileName,
    stream: content.toString('base64'),
  };
  if (comment) payload.comment = comment;

  const urls = [
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/Runs/${runId}/Results/${resultId}/attachments?api-version=7.1`,
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/Runs/${runId}/Results/${resultId}/attachments?api-version=7.1-preview.1`,
  ];

  let lastErr = '';
  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : { fileName, ok: true };
    lastErr = `${res.status}: ${text.slice(0, 400)}`;
  }
  throw new Error(`Attach Test Result #${resultId} (${fileName}) → ${lastErr}`);
}

/** Comentário no Work Item (Discussion). */
export async function addWorkItemComment(pat, workItemId, text) {
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`,
    {
      method: 'POST',
      headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Comment #${workItemId} → ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}
