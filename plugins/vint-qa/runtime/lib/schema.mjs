/**
 * O que cada ação do menu /vint-qa exige em `.hub-projeto.json` e `.env`.
 * `validate.mjs` usa estas definições para dizer ao agente exatamente o que perguntar ao usuário.
 */

export const PLATFORM_CHOICES = [
  { id: 'azure', label: 'Azure DevOps' },
  { id: 'gitlab', label: 'GitLab' },
  { id: 'github', label: 'GitHub' },
  { id: 'jira', label: 'Jira / Confluence' },
  { id: 'linear', label: 'Linear' },
  { id: 'local', label: 'Somente arquivos locais' },
  { id: 'other', label: 'Outra ferramenta' },
];

export const FRAMEWORK_CHOICES = [
  { id: 'playwright', label: 'Playwright (TypeScript)' },
  { id: 'robot', label: 'Robot Framework' },
];

export const MENU = [
  { id: 'doc-and-scenarios', label: 'Gerar documento de teste e cenários' },
  { id: 'doc', label: 'Só gerar o documento de teste' },
  { id: 'scenarios', label: 'Só gerar os cenários' },
  { id: 'manual', label: 'Executar os testes manuais' },
  { id: 'automated', label: 'Automatizar a feature' },
  { id: 'sprint', label: 'Rodar o pipeline da sprint (board)' },
  { id: 'maintenance', label: 'Revisar ou reparar testes automatizados' },
  { id: 'knowledge', label: 'Base de conhecimento (RAG e aprendizados)' },
  { id: 'config', label: 'Configurar projeto (.env / .hub-projeto.json / MCP)' },
  { id: 'end', label: 'Encerrar a esteira de QA' },
];

/** Campos conhecidos. file: hub | env. */
export const FIELDS = {
  'hub.projeto': { label: 'Nome do projeto', example: 'meu-projeto' },
  'hub.email': { label: 'E-mail do QA responsável', example: 'nome@empresa.com.br' },
  'hub.plataforma': { label: 'Ferramenta de gestão do projeto', choices: PLATFORM_CHOICES },
  'hub.frameworkAutomacao': { label: 'Framework de automação', choices: FRAMEWORK_CHOICES },
  'hub.ambientes': {
    label: 'URLs dos ambientes (DEV / TST / HML) — ao menos um',
    example: 'hub.ambientes.tst.url=https://app-tst.empresa.com.br hub.ambientes.tst.api=https://api-tst.empresa.com.br',
    check: (hub) => Object.values(hub?.ambientes || {}).some((a) => a && typeof a === 'object' && filled(a.url)),
  },
  'hub.azure.organizacao': { label: 'Organização do Azure DevOps', example: 'minha-org (de https://dev.azure.com/minha-org)' },
  'hub.azure.projeto': { label: 'Projeto do Azure DevOps', example: 'Nome exato do projeto' },
  'hub.azure.wiki': { label: 'Nome da wiki do Azure DevOps', example: 'MeuProjeto.wiki' },
  'hub.gitlab.url': { label: 'URL do GitLab', example: 'https://gitlab.com' },
  'hub.gitlab.projeto': { label: 'Projeto no GitLab (grupo/projeto)', example: 'vint/site' },
  'hub.github.repositorio': { label: 'Repositório no GitHub (owner/repo)', example: 'vint/site' },
  'hub.jira.site': { label: 'Site do Jira', example: 'empresa.atlassian.net' },
  'hub.jira.projeto': { label: 'Chave do projeto no Jira', example: 'PROJ' },
  'env.AZURE_DEVOPS_PAT': { label: 'PAT do Azure DevOps (wiki, work items, Test Plans)', secret: true },
  'env.GITLAB_PERSONAL_ACCESS_TOKEN': { label: 'Token pessoal do GitLab (escopo api)', secret: true },
  'env.GITHUB_PERSONAL_ACCESS_TOKEN': { label: 'Token pessoal do GitHub (repo + issues)', secret: true },
  'env.TEST_USER': { label: 'Usuário de teste da aplicação' },
  'env.TEST_PASSWORD': { label: 'Senha do usuário de teste', secret: true },
  'env.BASE_URL': {
    label: 'URL da aplicação sob teste (ou escolha um ambiente)',
    example: 'https://app-tst.empresa.com.br',
    check: (hub, env) => filled(env.BASE_URL) || filled(env.SYSTEM_URL),
  },
};

export function filled(v) {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && !/exemplo\.com|seu_usuario|sua_senha|seu_pat|seu_token|change-?me|placeholder|<<|>>/i.test(s);
}

const BASE = ['hub.projeto', 'hub.email', 'hub.plataforma'];

function platformFields(platform, { requirements = false, workItems = false } = {}) {
  switch (platform) {
    case 'azure':
      return ['hub.azure.organizacao', 'hub.azure.projeto', 'env.AZURE_DEVOPS_PAT', ...(requirements ? ['hub.azure.wiki'] : [])];
    case 'gitlab':
      return ['hub.gitlab.url', 'hub.gitlab.projeto', 'env.GITLAB_PERSONAL_ACCESS_TOKEN'];
    case 'github':
      return ['hub.github.repositorio', 'env.GITHUB_PERSONAL_ACCESS_TOKEN'];
    case 'jira':
      return requirements || workItems ? ['hub.jira.site', 'hub.jira.projeto'] : [];
    default:
      return [];
  }
}

/** Lista de campos exigidos pela ação, considerando a plataforma escolhida. */
export function requiredFor(action, hub = {}) {
  const platform = hub?.plataforma || '';
  switch (action) {
    case 'doc-and-scenarios':
    case 'doc':
    case 'scenarios':
      return [...BASE, ...platformFields(platform, { requirements: true })];
    case 'manual':
      return [...BASE, ...platformFields(platform, { workItems: true }), 'hub.ambientes', 'env.TEST_USER', 'env.TEST_PASSWORD'];
    case 'automated':
      return [...BASE, 'hub.frameworkAutomacao', 'env.BASE_URL', 'env.TEST_USER', 'env.TEST_PASSWORD'];
    case 'sprint':
      return [...BASE, ...platformFields(platform, { requirements: true, workItems: true })];
    case 'maintenance':
      return [...BASE, 'env.BASE_URL', 'env.TEST_USER', 'env.TEST_PASSWORD'];
    case 'knowledge':
      return ['hub.projeto'];
    case 'config':
    case 'end':
    case 'startup':
      return [];
    default:
      return BASE;
  }
}
