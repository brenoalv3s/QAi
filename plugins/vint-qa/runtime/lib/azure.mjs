/**
 * Configuração Azure DevOps do projeto aberto.
 *
 * Ordem de resolução (primeiro valor preenchido vence):
 *   1. process.env / .env  (AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_DEFAULT_PROJECT, AZURE_DEVOPS_PAT)
 *   2. .hub-projeto.json   (azure.organizacao, azure.projeto, azure.wiki, ...)
 *   3. .cursor/mcp.json    (servidor azure-devops)
 */
import { existsSync, readFileSync } from 'fs';
import { isFilled, projectPath, readHub, readJson } from './project.mjs';

const hub = readHub() || {};
const az = hub.azure || {};
const mcpServer = readJson(projectPath('.cursor', 'mcp.json'), {})?.mcpServers?.['azure-devops']?.env || {};

function first(...values) {
  for (const v of values) if (isFilled(v)) return String(v).trim();
  return '';
}

function orgFrom(value) {
  const v = String(value || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  const dev = v.match(/dev\.azure\.com\/([^/]+)/i);
  if (dev) return decodeURIComponent(dev[1]);
  const vs = v.match(/^https?:\/\/([^.]+)\.visualstudio\.com/i);
  if (vs) return vs[1];
  return v.replace(/^https?:\/\//, '');
}

export const ORG = orgFrom(first(process.env.AZURE_DEVOPS_ORG_URL, az.organizacao, az.orgUrl, mcpServer.AZURE_DEVOPS_ORG_URL));
export const ORG_URL = ORG ? `https://dev.azure.com/${ORG}` : '';
export const PROJECT = first(
  process.env.AZURE_DEVOPS_PROJECT,
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT,
  az.projeto,
  mcpServer.AZURE_DEVOPS_DEFAULT_PROJECT,
);
export const PROJECT_ENC = encodeURIComponent(PROJECT);
export const BASE_URL = ORG && PROJECT ? `${ORG_URL}/${PROJECT_ENC}` : '';

export const WIKI_ID = first(process.env.AZURE_DEVOPS_WIKI, az.wiki);
export const WIKI_ROOT = first(az.wikiRaiz).replace(/\/+$/, '');
export const WIKI_TEST_DOCS_PATH = first(az.wikiDocumentosTeste, 'Testes/Documentos de Testes').replace(/^\/+|\/+$/g, '');
export const DOCS_BASE = WIKI_ROOT ? `${WIKI_ROOT}/${WIKI_TEST_DOCS_PATH}` : `/${WIKI_TEST_DOCS_PATH}`;
export const WIKI_LOGO = first(az.wikiLogo);
export const ITERATION_ROOT = first(process.env.AZURE_DEVOPS_ITERATION_ROOT, az.iterationPath, PROJECT);

export const WIKI_MODULE_HINTS = Array.isArray(az.modulosWiki) ? az.modulosWiki : [];
export const PLAN_HINTS = Array.isArray(az.testPlans?.planos) ? az.testPlans.planos : [];
export const FEATURE_SUITE_ALIASES = Array.isArray(az.testPlans?.aliasesSuites) ? az.testPlans.aliasesSuites : [];

const campos = az.camposTestCase || {};
export const FIELD_CRITICIDADE = first(campos.criticidade, 'Custom.Criticidade');
export const FIELD_ESTRATEGIA = first(campos.estrategia, 'Custom.e3b1ecaf-933e-421c-9e1e-cfb8311b4b16');
export const FIELD_STATUS_AUTO = first(campos.statusAutomacao, 'Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b');

export function missingAzureConfig({ requireWiki = false } = {}) {
  const missing = [];
  if (!ORG) missing.push('azure.organizacao (.hub-projeto.json) ou AZURE_DEVOPS_ORG_URL (.env)');
  if (!PROJECT) missing.push('azure.projeto (.hub-projeto.json) ou AZURE_DEVOPS_DEFAULT_PROJECT (.env)');
  if (requireWiki && !WIKI_ID) missing.push('azure.wiki (.hub-projeto.json)');
  return missing;
}

export function assertAzureConfig(opts) {
  const missing = missingAzureConfig(opts);
  if (missing.length) {
    throw new Error(
      `Configuração Azure DevOps incompleta: ${missing.join('; ')}. Rode /vint-qa → "Configurar projeto" ou preencha os arquivos.`,
    );
  }
}

export function loadPat() {
  assertAzureConfig();
  const pat = first(process.env.AZURE_DEVOPS_PAT, mcpServer.AZURE_DEVOPS_PAT);
  if (pat) return pat;
  const mcpPath = projectPath('.cursor', 'mcp.json');
  if (existsSync(mcpPath)) {
    const match = readFileSync(mcpPath, 'utf8').match(/AZURE_DEVOPS_PAT":\s*"([^"]+)"/);
    if (match && isFilled(match[1])) return match[1];
  }
  throw new Error('AZURE_DEVOPS_PAT não encontrado. Preencha AZURE_DEVOPS_PAT no .env do projeto (nunca commitar).');
}

export function authHeader(pat) {
  return { Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') };
}

export function workItemEditUrl(id) {
  return `${BASE_URL}/_workitems/edit/${id}`;
}
