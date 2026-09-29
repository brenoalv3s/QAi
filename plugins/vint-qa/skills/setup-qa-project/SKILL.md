---
name: setup-qa-project
description: Configura o projeto aberto para a esteira vint-qa — doctor (instalações), .hub-projeto.json, .env, MCP da plataforma e scaffold Playwright/Robot. Usar quando o usuário pede preparar projeto, configurar o vint-qa, instalar Playwright ou deixar o repositório pronto para DOC, cenários, testes manuais e regressão.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Setup QA Project (plugin vint-qa)

O plugin **vint-qa** é global: agentes, skills, rules, hooks e MCPs vêm da instalação do Cursor. O projeto só precisa de **configuração**:

| Arquivo | Conteúdo | Versionar? |
|---------|----------|------------|
| `.hub-projeto.json` | Identidade do projeto, plataforma, ambientes, Azure/GitLab/GitHub/Jira | Sim |
| `.env` | URLs efetivas, usuário/senha de teste, tokens (PAT) | **Nunca** |
| `.cursor/mcp.json` | MCP da plataforma (gerado por `sync-mcp`) | **Nunca** |
| `.vint-qa/learnings/` | Aprendizados do projeto (RAG) | Sim |
| `.vint-qa/cache/` | Índice RAG, token de API | Não |

## Comandos

Todos a partir da raiz do projeto:

```bash
node "$HOME/.vint-qa/vqa.mjs" doctor --install --json     # Node, npm, git, Python, uv, Chromium, ffmpeg
node "$HOME/.vint-qa/vqa.mjs" init --json                 # cria .hub-projeto.json / .env / pastas
node "$HOME/.vint-qa/vqa.mjs" validate --action manual --json
node "$HOME/.vint-qa/vqa.mjs" set hub.plataforma=azure env.TEST_USER=qa
node "$HOME/.vint-qa/vqa.mjs" set --use-env tst           # BASE_URL/API_BASE_URL a partir de ambientes.tst
node "$HOME/.vint-qa/vqa.mjs" sync-mcp --json             # MCP azure-devops / gitlab / github / atlassian / linear
node "$HOME/.vint-qa/vqa.mjs" scaffold --framework playwright --install --json
```

## `.hub-projeto.json` — chaves

| Chave | Uso |
|-------|-----|
| `projeto`, `email` | Identificação (obrigatórios em todas as ações) |
| `plataforma` | `azure` \| `gitlab` \| `github` \| `jira` \| `linear` \| `local` \| `other` |
| `frameworkAutomacao` | `playwright` \| `robot` |
| `prefixoTitulo` | Prefixo do `describe` das specs (padrão: `projeto`) |
| `ambientes.{dev,tst,hml}.{url,api}` | Menu de ambiente dos testes manuais |
| `ambientePadrao` | Ambiente recomendado no menu |
| `azure.organizacao`, `azure.projeto`, `azure.wiki` | Azure DevOps (wiki, work items, Test Plans) |
| `azure.wikiRaiz`, `azure.wikiDocumentosTeste`, `azure.wikiLogo`, `azure.modulosWiki` | Publicação do documento de teste |
| `azure.testPlans.planos`, `azure.testPlans.aliasesSuites`, `azure.camposTestCase` | Publicação de cenários |
| `azure.iterationPath` | Raiz das sprints (pipeline do board) |
| `gitlab.url`, `gitlab.projeto` / `github.repositorio` / `jira.site`, `jira.projeto` | Outras plataformas |

Exemplo completo: `{VINT_QA_ROOT}/examples/hub-projeto.sgd.json`.

## `.env` — chaves

`BASE_URL`, `SYSTEM_URL`, `API_BASE_URL`, `TEST_USER`, `TEST_PASSWORD`, `TEST_USER_INACTIVE`, `TEST_PASSWORD_INACTIVE`, `TEST_USER_DELETED`, `TEST_PASSWORD_DELETED`, `AUTH_LOGIN_PATH`, `AUTH_BODY_FORMAT`, `AZURE_DEVOPS_PAT`, `GITLAB_PERSONAL_ACCESS_TOKEN`, `GITHUB_PERSONAL_ACCESS_TOKEN`.

Nomes antigos `SGD_*` (ex.: `SGD_APP_URL`, `SGD_TEST_USER`) continuam aceitos pelos scripts.

## Regras

- Nunca gravar valores de exemplo/placeholder — só o que o usuário informar
- Nunca imprimir segredos
- Nunca copiar agentes/skills/rules para `.cursor/` do projeto
