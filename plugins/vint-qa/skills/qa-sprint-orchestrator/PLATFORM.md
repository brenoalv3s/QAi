# Plataforma do projeto (não só Azure)

O plugin vint-qa atende **qualquer** repositório. Caminho preferido: `.hub-projeto.json` → `plataforma` + `node "$HOME/.vint-qa/vqa.mjs" sync-mcp` (o menu `/vint-qa` já faz isso); `write-mcp.mjs` continua disponível para o fluxo detalhado abaixo. Azure DevOps é **uma** opção. Playwright e Robot entram sempre; a ferramenta de gestão (wiki, issues, Test Plans) o usuário escolhe.

Arquivo persistido (sem segredos): `.cursor/qa-platform.json`. Credenciais só em `.cursor/mcp.json` (não commitar).

---

## Passo — escolher a ferramenta

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-mcp.mjs --json
```

| `next` | Ação |
|--------|------|
| `ensure-tools` | Playwright + Robot vêm do plugin vint-qa: pedir para recarregar os MCPs (Cursor Settings → MCP) e repetir o preflight |
| `ask-platform` | AskQuestion **Qual ferramenta o projeto utiliza?** (pode marcar **mais de uma**) |
| `ask-credentials` | Pedir só o que falta da(s) plataforma(s) em `notReady` / `missingKeys` |
| `ok` | Seguir (feature + menu de execução) |

Se `platforms` já vier preenchido (arquivo ou Azure/GitHub detectados no `mcp.json`): **não** perguntar de novo.

**Título AskQuestion:** `Qual ferramenta o projeto utiliza?`

| id | label (texto exato) |
|----|---------------------|
| `azure` | Azure DevOps |
| `github` | GitHub |
| `gitlab` | GitLab |
| `jira` | Jira / Atlassian (Jira e Confluence) |
| `linear` | Linear |
| `local` | Somente arquivos locais (sem Azure, Jira, etc.) |
| `other` | Outra ferramenta |

`allow_multiple`: **true** (ex.: GitHub + Jira). Se marcar **Somente arquivos locais** junto com outra, ignorar `local`.

Não inventar a ferramenta. Não assumir Azure.

---

## Credenciais e comando para gravar

**Nunca** imprimir tokens no chat.

### Azure DevOps

Perguntar: URL da org, nome do projeto, PAT.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs \
  --platform azure --org-url "https://dev.azure.com/{org}" --project "{projeto}" --pat "{pat}"
```

### GitHub

Perguntar: PAT (escopos `repo` e `issues`).

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform github --token "{token}"
```

### GitLab

Perguntar: token (`api`). URL da API opcional (padrão `https://gitlab.com/api/v4`; self-hosted: `https://gitlab.empresa.com/api/v4`).

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs \
  --platform gitlab --token "{token}" --api-url "https://gitlab.com/api/v4"
```

### Jira / Atlassian

Sem PAT no JSON — MCP remoto. Gravar e pedir para o usuário **autorizar no Cursor** (MCP → atlassian → Connect).

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform jira
```

### Linear

Igual Jira (OAuth no Cursor).

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform linear
```

### Somente arquivos locais

Não pede credencial de ALM. DOC e cenários ficam em `docs/`. Sem wiki/Test Plans remotos.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform local
```

### Outra ferramenta

Perguntar: nome da ferramenta; **URL MCP** **ou** comando `npx` (pacote); token se a URL exigir.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs \
  --platform other --server-name "{nome}" --mcp-url "https://..." --token "{token}"

node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs \
  --platform other --server-name "{nome}" --command npx --args "-y,@org/mcp" --env API_KEY="{token}"
```

Várias plataformas de uma vez: repetir `--platform` no mesmo comando, ou chamar o script uma vez por plataforma (o arquivo acumula).

Depois: recarregar MCPs se `reloadMcp`. Completar OAuth se `oauthHint` não estiver vazio.

---

## Como cada plataforma muda a esteira

Usar `capabilities` do preflight.

| Capability | true | false |
|------------|------|--------|
| `wiki` | Buscar requisitos no MCP (Azure wiki ou Confluence) | Pedir URL/arquivo ao usuário; ou GitHub/GitLab README/wiki via MCP de código |
| `testPlans` | Publicar cenários no Azure Test Plans | Só `docs/test-scenarios/{slug}/cenarios-de-teste.md` |
| `workItems` / `bugs` | Abrir bug/issue na ferramenta | Bug só local em `docs/` — não inventar Azure |

**Azure:** fluxo atual (wiki do projeto, Test Plans, PBI).

**GitHub / GitLab:** requisitos no repo (README, `/docs`, wiki do Git). DOC/cenários **locais**. Bugs → Issue. Sem `publish-test-doc.mjs` / `publish-test-scenarios.mjs`.

**Jira / Atlassian:** requisitos no Confluence (MCP atlassian). Cenários locais. Bugs → issue Jira.

**Linear:** requisitos que o usuário passar (URL ou texto). Cenários locais. Bugs → issue Linear.

**Local / sem ALM:** gerar só Markdown. Manuais a partir do `.md` local. Automação Playwright/Robot segue igual (`.env` da aplicação).

Se `testPlans` for false, testes manuais leem `docs/test-scenarios/` (não Azure Test Plans). Se o `.md` não existir, pedir para gerar cenários ou informar o arquivo.

---

## Feature sem PBI Azure

Se a plataforma **não** for Azure: aceitar nome da feature, URL de doc, número de issue (`#12`, `PROJ-44`) e resolver no MCP correspondente. **Não** chamar `resolve-pbi.mjs` nem `discover-board-candidates.mjs`.
