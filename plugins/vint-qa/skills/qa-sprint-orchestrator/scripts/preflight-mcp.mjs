#!/usr/bin/env node
/**
 * Valida Playwright/Robot + plataforma ALM (.cursor/qa-platform.json / mcp.json).
 *   node preflight-mcp.mjs --json
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  PLATFORMS,
  detectPlatformsFromMcp,
  mergeCapabilities,
  missingCredentials,
  platformReady,
} from './lib/platforms.mjs';

import { PROJECT_ROOT as ROOT, PLUGIN_ROOT, readHub } from '../../../runtime/lib/project.mjs';

function findExample() {
  const candidates = [
    join(PLUGIN_ROOT, 'scaffold', 'project', 'mcp.json.example'),
    join(ROOT, '.cursor', 'mcp.json.example'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const jsonOnly = process.argv.includes('--json');
  const examplePath = findExample();
  const mcpPath = join(ROOT, '.cursor', 'mcp.json');
  const platformPath = join(ROOT, '.cursor', 'qa-platform.json');
  const exists = existsSync(mcpPath);
  const mcp = exists ? readJson(mcpPath) : null;
  const saved = existsSync(platformPath) ? readJson(platformPath) : null;

  const pluginMcp = readJson(join(PLUGIN_ROOT, 'mcp.json'))?.mcpServers || {};
  const hasPlaywright = Boolean(mcp?.mcpServers?.playwright || pluginMcp.playwright);
  const hasRobot = Boolean(mcp?.mcpServers?.robotmcp || mcp?.mcpServers?.robot || pluginMcp.robotmcp);
  const kitServersMissing = [];
  if (!hasPlaywright) kitServersMissing.push('playwright');
  if (!hasRobot) kitServersMissing.push('robotmcp');
  const toolsReady = kitServersMissing.length === 0;

  let platforms = Array.isArray(saved?.platforms) ? saved.platforms.filter((id) => PLATFORMS[id]) : [];
  const detected = detectPlatformsFromMcp(mcp);
  const hubPlatform = readHub()?.plataforma;
  if (!platforms.length && hubPlatform && PLATFORMS[hubPlatform]) platforms = [hubPlatform];
  if (!platforms.length && detected.length) {
    platforms = detected;
    writeFileSync(platformPath, JSON.stringify({ platforms, other: saved?.other || null }, null, 2) + '\n');
  }

  const other = saved?.other || null;
  const notReady = platforms.filter((id) => !platformReady(id, mcp, other));
  const missingKeys = [];
  for (const id of platforms) missingKeys.push(...missingCredentials(id, mcp));
  const capabilities = mergeCapabilities(platforms);

  const platformChosen = platforms.length > 0;
  const almReady = platformChosen && notReady.length === 0;
  const ready = toolsReady && almReady;

  let next = 'ok';
  if (!toolsReady) next = 'ensure-tools';
  else if (!platformChosen) next = 'ask-platform';
  else if (!almReady) next = 'ask-credentials';

  const output = {
    example: examplePath,
    mcpPath: exists ? mcpPath : null,
    platformFile: existsSync(platformPath) ? platformPath : null,
    exists,
    platforms,
    detected,
    capabilities,
    notReady,
    missingKeys,
    hasPlaywright,
    hasRobot,
    kitServersMissing,
    hasAzureServer: Boolean(mcp?.mcpServers?.['azure-devops']),
    toolsReady,
    platformChosen,
    almReady,
    ready,
    next,
    askOptions: [
      { id: 'azure', label: 'Azure DevOps' },
      { id: 'github', label: 'GitHub' },
      { id: 'gitlab', label: 'GitLab' },
      { id: 'jira', label: 'Jira / Atlassian (Jira e Confluence)' },
      { id: 'linear', label: 'Linear' },
      { id: 'local', label: 'Somente arquivos locais (sem Azure, Jira, etc.)' },
      { id: 'other', label: 'Outra ferramenta' },
    ],
  };

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log('PREFLIGHT — MCP');
  console.log('Plataformas:', platforms.join(', ') || '(não escolhidas)');
  console.log('Playwright:', hasPlaywright, 'RobotMCP:', hasRobot);
  console.log('Next:', output.next);
}

main();
