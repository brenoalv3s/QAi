#!/usr/bin/env node
/**
 * Cria ou atualiza .cursor/mcp.json + .cursor/qa-platform.json.
 * Playwright + Robot sempre. ALM conforme --platform (azure, github, gitlab, jira, linear, local, other).
 *
 *   node write-mcp.mjs --ensure-tools
 *   node write-mcp.mjs --platform azure --org-url "https://dev.azure.com/ORG" --project "Proj" --pat "..."
 *   node write-mcp.mjs --platform github --token "..."
 *   node write-mcp.mjs --platform gitlab --token "..." --api-url "https://gitlab.com/api/v4"
 *   node write-mcp.mjs --platform jira
 *   node write-mcp.mjs --platform linear
 *   node write-mcp.mjs --platform local
 *   node write-mcp.mjs --platform other --server-name youtrack --mcp-url "https://..." --token "..."
 *   node write-mcp.mjs --platform other --server-name foo --command npx --args "-y,@org/mcp" --env KEY=VAL
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PLATFORMS, buildServer } from './lib/platforms.mjs';

import { PROJECT_ROOT as ROOT, PLUGIN_ROOT } from '../../../runtime/lib/project.mjs';
const KIT_TOOL_SERVERS = ['playwright', 'robotmcp'];

function parseArgs(argv) {
  const args = { platforms: [], envPairs: {} };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2).replace(/-/g, '_');
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    if (key === 'platform') {
      args.platforms.push(String(val));
    } else if (key === 'env' && typeof val === 'string' && val.includes('=')) {
      const eq = val.indexOf('=');
      args.envPairs[val.slice(0, eq)] = val.slice(eq + 1);
    } else {
      args[key] = val;
    }
  }
  return args;
}

function findExample() {
  const candidates = [
    join(PLUGIN_ROOT, 'scaffold', 'project', 'mcp.json.example'),
    join(ROOT, '.cursor', 'mcp.json.example'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function run(cmd, args, timeout = 15000) {
  if (process.platform === 'win32') {
    const line = [cmd, ...args].map((a) => (/\s/.test(String(a)) ? `"${a}"` : a)).join(' ');
    return spawnSync(line, { encoding: 'utf8', timeout, shell: true, windowsHide: true });
  }
  return spawnSync(cmd, args, { encoding: 'utf8', timeout, windowsHide: true });
}

function commandOk(cmd, args = ['--version']) {
  try {
    return run(cmd, args).status === 0;
  } catch {
    return false;
  }
}

function pythonBin() {
  for (const c of ['python', 'py', 'python3']) {
    if (commandOk(c, ['--version'])) return c;
  }
  return null;
}

function resolveRobotServer(exampleServer) {
  if (commandOk('uvx')) {
    return { type: 'stdio', command: 'uvx', args: ['--from', 'rf-mcp', 'robotmcp'] };
  }
  const py = pythonBin();
  if (py) {
    const imported = run(py, ['-c', 'import robotmcp'], 20000);
    if (imported.status !== 0) {
      const inst = run(py, ['-m', 'pip', 'install', '-q', 'rf-mcp'], 180000);
      if (inst.status !== 0) return JSON.parse(JSON.stringify(exampleServer));
    }
    return { type: 'stdio', command: py, args: ['-m', 'robotmcp.server'] };
  }
  return JSON.parse(JSON.stringify(exampleServer));
}

function mergeKitTools(mcpServers, example) {
  const added = [];
  if (!process.argv.includes('--project-tools')) return added;
  for (const name of KIT_TOOL_SERVERS) {
    const fromExample = example.mcpServers?.[name];
    if (!fromExample) continue;
    if (mcpServers[name]) continue;
    if (name === 'robotmcp' && mcpServers.robot) continue;
    mcpServers[name] =
      name === 'robotmcp' ? resolveRobotServer(fromExample) : JSON.parse(JSON.stringify(fromExample));
    added.push(name);
  }
  return added;
}

function parseArgsList(raw) {
  if (!raw || raw === true) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ensureOnly = Boolean(args.ensure_tools);
  const platforms = args.platforms.filter((id) => id && id !== 'true');

  const legacyAzure =
    args.org_url &&
    args.org_url !== true &&
    args.project &&
    args.project !== true &&
    args.pat &&
    args.pat !== true;
  if (legacyAzure && !platforms.includes('azure')) platforms.push('azure');

  if (!ensureOnly && platforms.length === 0) {
    console.error(
      'Uso:\n  --ensure-tools\n  --platform azure --org-url ... --project ... --pat ...\n  --platform github --token ...\n  --platform gitlab --token ... [--api-url ...]\n  --platform jira | linear | local\n  --platform other --server-name NOME (--mcp-url URL | --command npx --args "-y,pkg")'
    );
    process.exit(1);
  }

  for (const id of platforms) {
    if (!PLATFORMS[id]) {
      console.error('Plataforma desconhecida:', id);
      process.exit(1);
    }
  }

  const examplePath = findExample();
  if (!examplePath) {
    console.error('mcp.json.example não encontrado.');
    process.exit(1);
  }

  const destDir = join(ROOT, '.cursor');
  const dest = join(destDir, 'mcp.json');
  mkdirSync(destDir, { recursive: true });

  const example = readJson(examplePath);
  const current = existsSync(dest) ? readJson(dest) : { mcpServers: {} };
  const mcpServers = { ...(current.mcpServers || {}) };
  const addedTools = mergeKitTools(mcpServers, example);
  const configured = [];
  let otherMeta = null;

  for (const id of platforms) {
    if (id === 'local') {
      configured.push('local');
      continue;
    }
    if (id === 'other') {
      const serverName = args.server_name;
      if (!serverName || serverName === true) {
        console.error('--platform other exige --server-name');
        process.exit(1);
      }
      const other = {
        serverName,
        mcpUrl: args.mcp_url || args.url || '',
        token: args.token || '',
        command: args.command || 'npx',
        args: parseArgsList(args.args),
        package: args.package || '',
        env: { ...args.envPairs },
      };
      const server = buildServer('other', {}, other);
      if (!server) {
        console.error('Informe --mcp-url ou --command/--args para a outra ferramenta.');
        process.exit(1);
      }
      mcpServers[serverName] = server;
      configured.push('other');
      otherMeta = { name: args.name || serverName, serverName };
      continue;
    }
    const spec = PLATFORMS[id];
    const creds = {
      org_url: args.org_url || args.org,
      project: args.project,
      pat: args.pat,
      token: args.token,
      api_url: args.api_url,
    };
    if (id === 'azure' && (!creds.org_url || creds.org_url === true || !creds.project || !creds.pat || creds.pat === true)) {
      console.error('Azure exige --org-url --project --pat');
      process.exit(1);
    }
    if (id === 'github' && (!creds.token || creds.token === true)) {
      console.error('GitHub exige --token');
      process.exit(1);
    }
    if (id === 'gitlab' && (!creds.token || creds.token === true)) {
      console.error('GitLab exige --token');
      process.exit(1);
    }
    mcpServers[spec.serverName] = buildServer(id, creds);
    configured.push(id);
  }

  writeFileSync(dest, JSON.stringify({ mcpServers }, null, 2) + '\n');

  const platformPath = join(destDir, 'qa-platform.json');
  let platformState = existsSync(platformPath) ? readJson(platformPath) : { platforms: [] };
  if (configured.length) {
    const set = new Set(platformState.platforms || []);
    for (const id of configured) set.add(id);
    if (configured.includes('local') && configured.length === 1) {
      platformState = { platforms: ['local'] };
    } else {
      set.delete('local');
      platformState = { platforms: [...set], ...(otherMeta ? { other: otherMeta } : {}) };
    }
    writeFileSync(platformPath, JSON.stringify(platformState, null, 2) + '\n');
  }

  const exampleDest = join(destDir, 'mcp.json.example');
  if (!existsSync(exampleDest)) writeFileSync(exampleDest, readFileSync(examplePath));

  const out = {
    wrote: '.cursor/mcp.json',
    platformFile: configured.length ? '.cursor/qa-platform.json' : null,
    platforms: platformState.platforms || [],
    addedTools,
    configured,
    hasPlaywright: Boolean(mcpServers.playwright),
    hasRobot: Boolean(mcpServers.robotmcp),
    reloadMcp: addedTools.length > 0 || configured.some((id) => id !== 'local'),
    oauthHint: configured.filter((id) => PLATFORMS[id]?.oauth),
  };
  console.log(JSON.stringify(out, null, 2));
  if (out.reloadMcp) {
    console.log('Recarregue os MCPs no Cursor (MCP: Reload).');
  }
  if (out.oauthHint.length) {
    console.log('Complete o login OAuth no Cursor para:', out.oauthHint.join(', '));
  }
}

main();
