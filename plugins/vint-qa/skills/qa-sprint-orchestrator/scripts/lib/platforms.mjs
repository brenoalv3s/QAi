/**
 * Catálogo de plataformas ALM / documentação / tickets.
 * Sem segredos. Credenciais entram só em .cursor/mcp.json.
 */
export const PLATFORM_FILE = '.cursor/qa-platform.json';

export const PLACEHOLDER = /sua_org|seu_projeto|seu_pat_aqui|seu_token|your_|changeme|placeholder|todo|xxx/i;

export const PLATFORMS = {
  azure: {
    id: 'azure',
    label: 'Azure DevOps',
    serverName: 'azure-devops',
    capabilities: { wiki: true, workItems: true, testPlans: true, bugs: true },
    credentials: [
      { flag: 'org_url', env: 'AZURE_DEVOPS_ORG_URL', ask: 'URL da organização (ex.: https://dev.azure.com/minha-org)' },
      { flag: 'project', env: 'AZURE_DEVOPS_DEFAULT_PROJECT', ask: 'Nome do projeto no Azure' },
      { flag: 'pat', env: 'AZURE_DEVOPS_PAT', secret: true, ask: 'PAT (wiki, work items e Test Plans)' },
    ],
  },
  github: {
    id: 'github',
    label: 'GitHub',
    serverName: 'github',
    capabilities: { wiki: false, workItems: true, testPlans: false, bugs: true },
    credentials: [
      { flag: 'token', env: 'GITHUB_PERSONAL_ACCESS_TOKEN', secret: true, ask: 'Personal Access Token do GitHub (repo + issues)' },
    ],
  },
  gitlab: {
    id: 'gitlab',
    label: 'GitLab',
    serverName: 'gitlab',
    capabilities: { wiki: false, workItems: true, testPlans: false, bugs: true },
    credentials: [
      { flag: 'token', env: 'GITLAB_PERSONAL_ACCESS_TOKEN', secret: true, ask: 'Personal Access Token do GitLab (api + issues)' },
      {
        flag: 'api_url',
        env: 'GITLAB_API_URL',
        optional: true,
        ask: 'URL da API (Enter = https://gitlab.com/api/v4)',
      },
    ],
  },
  jira: {
    id: 'jira',
    label: 'Jira / Atlassian',
    serverName: 'atlassian',
    oauth: true,
    capabilities: { wiki: true, workItems: true, testPlans: false, bugs: true },
    credentials: [],
  },
  linear: {
    id: 'linear',
    label: 'Linear',
    serverName: 'linear',
    oauth: true,
    capabilities: { wiki: false, workItems: true, testPlans: false, bugs: true },
    credentials: [],
  },
  local: {
    id: 'local',
    label: 'Somente arquivos locais',
    serverName: null,
    capabilities: { wiki: false, workItems: false, testPlans: false, bugs: false },
    credentials: [],
  },
  other: {
    id: 'other',
    label: 'Outra ferramenta',
    serverName: null,
    capabilities: { wiki: false, workItems: true, testPlans: false, bugs: true },
    credentials: [],
  },
};

export const ASK_PLATFORM_OPTIONS = [
  { id: 'azure', label: 'Azure DevOps' },
  { id: 'github', label: 'GitHub' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'jira', label: 'Jira / Atlassian (Jira e Confluence)' },
  { id: 'linear', label: 'Linear' },
  { id: 'local', label: 'Somente arquivos locais (sem Azure, Jira, etc.)' },
  { id: 'other', label: 'Outra ferramenta' },
];

export function isBad(val) {
  if (val == null || String(val).trim() === '') return true;
  return PLACEHOLDER.test(String(val).trim());
}

export function mergeCapabilities(ids) {
  const cap = { wiki: false, workItems: false, testPlans: false, bugs: false };
  for (const id of ids || []) {
    const p = PLATFORMS[id];
    if (!p) continue;
    for (const k of Object.keys(cap)) {
      if (p.capabilities[k]) cap[k] = true;
    }
  }
  return cap;
}

export function detectPlatformsFromMcp(mcp) {
  const servers = mcp?.mcpServers || {};
  const found = [];
  const azure = servers['azure-devops']?.env || {};
  if (
    servers['azure-devops'] &&
    !isBad(azure.AZURE_DEVOPS_ORG_URL) &&
    !isBad(azure.AZURE_DEVOPS_DEFAULT_PROJECT) &&
    !isBad(azure.AZURE_DEVOPS_PAT)
  ) {
    found.push('azure');
  }
  if (servers.github && githubReady(servers.github)) found.push('github');
  if (servers.gitlab && gitlabReady(servers.gitlab)) found.push('gitlab');
  if (servers.atlassian || servers.jira) found.push('jira');
  if (servers.linear) found.push('linear');
  return found;
}

function githubReady(server) {
  const token = server.env?.GITHUB_PERSONAL_ACCESS_TOKEN || bearer(server);
  return !isBad(token) || Boolean(server.url);
}

function gitlabReady(server) {
  return !isBad(server.env?.GITLAB_PERSONAL_ACCESS_TOKEN);
}

function bearer(server) {
  const h = server.headers?.Authorization || server.headers?.authorization || '';
  return String(h).replace(/^Bearer\s+/i, '');
}

export function platformReady(id, mcp, other = null) {
  const p = PLATFORMS[id];
  if (!p) return false;
  if (id === 'local') return true;
  if (id === 'other') {
    const name = other?.serverName;
    return Boolean(name && mcp?.mcpServers?.[name]);
  }
  if (p.oauth) return Boolean(mcp?.mcpServers?.[p.serverName]);
  const server = mcp?.mcpServers?.[p.serverName];
  if (!server) return false;
  if (id === 'azure') {
    const env = server.env || {};
    return !isBad(env.AZURE_DEVOPS_ORG_URL) && !isBad(env.AZURE_DEVOPS_DEFAULT_PROJECT) && !isBad(env.AZURE_DEVOPS_PAT);
  }
  if (id === 'github') return githubReady(server);
  if (id === 'gitlab') return gitlabReady(server);
  return true;
}

export function missingCredentials(id, mcp) {
  const p = PLATFORMS[id];
  if (!p || p.oauth || id === 'local' || id === 'other') return [];
  const env = mcp?.mcpServers?.[p.serverName]?.env || {};
  const missing = [];
  for (const c of p.credentials) {
    if (c.optional) continue;
    if (isBad(env[c.env])) missing.push(c.env);
  }
  return missing;
}

export function buildServer(id, creds = {}, other = null) {
  if (id === 'azure') {
    return {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@tiberriver256/mcp-server-azure-devops'],
      env: {
        AZURE_DEVOPS_ORG_URL: String(creds.org_url || creds.orgUrl || '').replace(/\/$/, ''),
        AZURE_DEVOPS_DEFAULT_PROJECT: String(creds.project || ''),
        AZURE_DEVOPS_AUTH_METHOD: 'pat',
        AZURE_DEVOPS_PAT: String(creds.pat || ''),
      },
    };
  }
  if (id === 'github') {
    return {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: String(creds.token || creds.pat || ''),
      },
    };
  }
  if (id === 'gitlab') {
    return {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
      env: {
        GITLAB_PERSONAL_ACCESS_TOKEN: String(creds.token || creds.pat || ''),
        GITLAB_API_URL: String(creds.api_url || creds.apiUrl || 'https://gitlab.com/api/v4'),
      },
    };
  }
  if (id === 'jira') {
    return { url: 'https://mcp.atlassian.com/v1/mcp' };
  }
  if (id === 'linear') {
    return { url: 'https://mcp.linear.app/mcp' };
  }
  if (id === 'other' && other) {
    if (other.mcpUrl || other.url) {
      const server = { url: other.mcpUrl || other.url };
      if (other.token) server.headers = { Authorization: `Bearer ${other.token}` };
      return server;
    }
    const args = Array.isArray(other.args)
      ? other.args
      : String(other.args || '-y')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const env = other.env && typeof other.env === 'object' ? other.env : {};
    return {
      type: 'stdio',
      command: other.command || 'npx',
      args: args.length ? args : ['-y', other.package].filter(Boolean),
      ...(Object.keys(env).length ? { env } : {}),
    };
  }
  return null;
}
