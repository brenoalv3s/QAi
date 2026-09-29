# Execução manual — QA Sprint Orchestrator

Gerar **Documento de Teste** e/ou **Cenários** **sob demanda**, ou ir direto para testes manuais / automação se já existirem — a partir do **nome da feature**, da **URL da wiki**, do **nome do PBI** ou do **ID do PBI**.

---

## Quando usar

| Situação | Caminho recomendado |
|----------|---------------------|
| QA quer DOC + cenários **agora**, de uma feature | Menu: **Gerar documento de teste e cenários** |
| DOC e cenários **já existem** | Menu: testes manuais ou **Automatizar a feature** — não gerar de novo |
| QA informa o **PBI** (título ou `#id`) | `resolve-pbi.mjs` → `feature` + `pbiId` |
| Board ainda não está no gate (Documentos de Testes In Progress / Requisitos-UX Done) | Modo manual — sem `--validate-gates` |
| Só gerar `.md` locais (sem wiki / Test Plans) | `--skip-publish` |
| Marcar PBI/task após sucesso | `--mark-processed` (exige `pbiId` + `docTaskId`) |
| Conferir se o PBI está elegível antes de gerar | `--validate-gates` |

Para execução **automática** (cron + gates do board), use o agente `qa-sprint-orchestrator` — ver [AUTOMATION.md](AUTOMATION.md) e [BOARD.md](BOARD.md).

---

## Caminho A — Chat no Cursor (recomendado)

### Agente dedicado (foreground)

```
@qa-sprint-orchestrator-manual Cadastro de Produtos
@qa-sprint-orchestrator-manual PBI Cadastro de Produtos
@qa-sprint-orchestrator-manual 1234
@qa-sprint-orchestrator-manual https://dev.azure.com/.../_wiki/wikis/{azure.wiki}?pagePath=/.../Cadastro%20de%20Produtos%20US
```

Ou: *"Gere o documento de teste e os cenários da feature X / do PBI Y"* — nesse caso o menu inicial é pulado e a ação pedida roda na hora.

O agente **pergunta** feature, URL ou PBI se nada for informado. Depois mostra o menu **O que você deseja executar?**

### Skill (mesmo fluxo)

```
/qa-sprint-orchestrator Cadastro de Produtos
/qa-sprint-orchestrator {url-da-wiki}
```

### Opções

```
/qa-sprint-orchestrator {feature} --skip-publish
/qa-sprint-orchestrator {feature} --validate-gates
/qa-sprint-orchestrator {feature} --mark-processed
```

---

## Caminho B — Automação sob demanda (Cloud / Agents Window)

Rascunho: [`{VINT_QA_ROOT}/automations/qa-sprint-orchestrator-manual.prefill.json`](../../automations/qa-sprint-orchestrator-manual.prefill.json)

Sem cron. Substitua o placeholder pela feature, URL ou PBI e dispare. O agente pergunta a ferramenta do projeto se faltar MCP e mostra o menu (**DOC / cenários / testes manuais / automatizar**). Não gera DOC/cenários sem escolha no menu.

---

## Fluxo (igual ao automático, sem Passo 0 de board)

0. MCP: `preflight-mcp.mjs` — Playwright/Robot; se `ask-platform`, perguntar a ferramenta ([PLATFORM.md](PLATFORM.md))
1. Resolver `feature` — **nome da feature**, **URL da wiki**, **nome do PBI** ou **ID** (`resolve-pbi.mjs`)
2. `inspect-feature-artifacts.mjs` + AskQuestion **O que você deseja executar?**
3. Só então, conforme a escolha: wiki + DOC e/ou cenários, **ou** testes manuais (AskQuestion do ambiente DEV/TST/HML), **ou** automação, **ou** encerrar
4. Após a ação (exceto Encerrar): o mesmo menu de novo

**Não** gerar DOC/cenários sem escolha no menu (eles podem já existir). Se gerar os dois: DOC antes de cenários.

Scripts:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-mcp.mjs --json
node "$HOME/.vint-qa/vqa.mjs" sync-mcp --json
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --org-url "..." --project "..." --pat "..."
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/inspect-feature-artifacts.mjs --feature "..." --json
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-qa-pipeline.mjs --json
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-env.mjs --base-url "..." --test-user "..." --test-password "..."
```

Skills canônicas: `{VINT_QA_ROOT}/skills/create-test-doc/` e `{VINT_QA_ROOT}/skills/create-test-scenarios/` (plugin vint-qa).

## Flags

| Flag | Efeito |
|--|--|
| (nenhuma) | Menu de execução (não gera DOC/cenários sozinho) |
| `--skip-publish` | Só Markdown em `docs/test-docs/` e `docs/test-scenarios/` |
| `--validate-gates` | Roda `discover-board-candidates.mjs` e aborta se não elegível |
| `--mark-processed` | Chama `mark-processed.mjs` se `pbiId` e `docTaskId` estiverem resolvidos |

---

## Plugin vint-qa

Todos os agentes da esteira vêm do plugin **vint-qa** (instalado pelo marketplace do time). Ponto de entrada: `/vint-qa`.

O agente vivo é `{VINT_QA_ROOT}/agents/qa-sprint-orchestrator-manual.md` e usa as skills em `{VINT_QA_ROOT}/skills/`.