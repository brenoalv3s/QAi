#!/usr/bin/env node
/**
 * Gera/atualiza o servidor MCP da plataforma de gestão em `.cursor/mcp.json` do projeto,
 * usando `.hub-projeto.json` (plataforma, organização, projeto) + `.env` (tokens).
 *
 * Playwright, RobotMCP e o RAG já vêm do plugin — não são gravados no projeto.
 *
 *   vqa sync-mcp --json
 */
import { existsSync } from 'fs';
import { isFilled, projectPath, readHub, readJson, writeJson } from './lib/project.mjs';
import { ORG_URL, PROJECT } from './lib/azure.mjs';
import { PLATFORMS, buildServer } from '../skills/qa-sprint-orchestrator/scripts/lib/platforms.mjs';

const hub = readHub() || {};
const platform = hub.plataforma || '';
const mcpPath = projectPath('.cursor', 'mcp.json');
const current = readJson(mcpPath, { mcpServers: {} }) || { mcpServers: {} };
const servers = { ...(current.mcpServers || {}) };
const missing = [];
let serverName = null;
let server = null;

if (platform === 'azure') {
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!ORG_URL) missing.push('hub.azure.organizacao');
  if (!PROJECT) missing.push('hub.azure.projeto');
  if (!isFilled(pat)) missing.push('env.AZURE_DEVOPS_PAT');
  if (!missing.length) {
    serverName = PLATFORMS.azure.serverName;
    server = buildServer('azure', { org_url: ORG_URL, project: PROJECT, pat });
  }
} else if (platform === 'gitlab') {
  const token = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
  if (!isFilled(token)) missing.push('env.GITLAB_PERSONAL_ACCESS_TOKEN');
  if (!missing.length) {
    serverName = PLATFORMS.gitlab.serverName;
    const base = String(hub.gitlab?.url || 'https://gitlab.com').replace(/\/+$/, '');
    server = buildServer('gitlab', { token, api_url: `${base}/api/v4` });
  }
} else if (platform === 'github') {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!isFilled(token)) missing.push('env.GITHUB_PERSONAL_ACCESS_TOKEN');
  if (!missing.length) {
    serverName = PLATFORMS.github.serverName;
    server = buildServer('github', { token });
  }
} else if (platform === 'jira' || platform === 'linear') {
  serverName = PLATFORMS[platform].serverName;
  server = buildServer(platform, {});
} else if (!platform) {
  missing.push('hub.plataforma');
}

let changed = false;
if (serverName && server && JSON.stringify(servers[serverName]) !== JSON.stringify(server)) {
  servers[serverName] = server;
  writeJson(mcpPath, { ...current, mcpServers: servers });
  changed = true;
}

const platformFile = projectPath('.cursor', 'qa-platform.json');
if (platform && PLATFORMS[platform]) {
  const saved = readJson(platformFile, null);
  if (!saved || JSON.stringify(saved.platforms) !== JSON.stringify([platform])) {
    writeJson(platformFile, { platforms: [platform], ...(saved?.other ? { other: saved.other } : {}) });
  }
}

console.log(
  JSON.stringify(
    {
      platform: platform || null,
      server: serverName,
      mcpPath: existsSync(mcpPath) ? mcpPath : null,
      changed,
      missing,
      reloadMcp: changed,
      oauth: ['jira', 'linear'].includes(platform),
      next: missing.length ? 'ask-user' : changed ? 'reload-mcp' : 'ok',
    },
    null,
    2,
  ),
);
