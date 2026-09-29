# Esteira QA — um agente chama o outro

A esteira começa em **`qa-sprint-orchestrator-manual`**. Entrada: **nome da feature**, **URL da wiki**, **nome do PBI** ou **ID do PBI**. Depois do MCP e da feature, o orquestrador **mostra um menu clicável** e executa **só** o que o usuário escolheu. Documento e cenários **podem já existir** — não gerar de novo a menos que o usuário peça.

Plugin: **vint-qa** (todos os agentes, skills e rules). Ponto de entrada: `/vint-qa`.

---

## Ordem

```
preflight mcp.json (Playwright + Robot + plataforma do projeto)
    → identificar a feature
    → menu clicável (AskQuestion)
         ├─ Gerar documento de teste e cenários
         ├─ Só gerar o documento de teste
         ├─ Só gerar os cenários
         ├─ Executar os testes manuais     → AskQuestion ambiente (DEV/TST/HML) → execute-manual-tests-manual
         ├─ Automatizar a feature          → generate-regression-automation-manual
         └─ Encerrar a esteira de QA
    → após cada ação (exceto Encerrar): o mesmo menu de novo
```

---

## Passo A0 — MCP (primeiro)

Seguir [PLATFORM.md](PLATFORM.md). O projeto **pode não** usar Azure.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-mcp.mjs --json
```

| `next` | Ação |
|--------|------|
| `ensure-tools` | Recarregar os MCPs do plugin vint-qa (Playwright + Robot) e repetir o preflight |
| `ask-platform` | AskQuestion **Qual ferramenta o projeto utiliza?** (várias opções). Depois `write-mcp.mjs --platform ...` |
| `ask-credentials` | Pedir tokens/URL que faltam |
| `ok` | Seguir |

```bash
node "$HOME/.vint-qa/vqa.mjs" sync-mcp --json
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform azure --org-url "..." --project "..." --pat "..."
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform github --token "..."
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-mcp.mjs --platform local
```

Pedir reload se `reloadMcp`. Não commitar `.cursor/mcp.json`. Não imprimir token.

## Passo A — Preflight `.env` (antes de manuais ou automação)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-qa-pipeline.mjs --json
```

Interpretar `next`:

| `next` | Ação |
|--------|------|
| `ask-env` | Pedir ao usuário URL e credenciais. Modelo: **`e2e/.env.example`**. Gravar com `write-env.mjs`. Não inventar senha. |
| `install-tools` | Instalar o que o projeto usa (ver abaixo). Depois rodar o preflight de novo. |
| `ok` | Seguir para o agente escolhido no menu. |

### `.env` (fonte: `e2e/.env.example`)

Chaves **obrigatórias**: `BASE_URL` (ou `SYSTEM_URL`), `TEST_USER`, `TEST_PASSWORD`.

Recomendadas (usar default do example se o usuário não informar): `API_BASE_URL` (= `BASE_URL`), `AUTH_LOGIN_PATH`, `AUTH_BODY_FORMAT`.

Opcionais do example: `TEST_USER_INACTIVE`, `TEST_PASSWORD_INACTIVE`, `TEST_USER_DELETED`, `TEST_PASSWORD_DELETED`.

Valores como `seu_usuario`, `sua_senha`, `exemplo.com` = **placeholder** — pedir de novo.

Gravar **os dois** arquivos (mesmo conteúdo preenchido):

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/write-env.mjs \
  --base-url "{url}" \
  --api-base-url "{url}" \
  --test-user "{user}" \
  --test-password "{senha}" \
  --auth-login-path /api/auth/login \
  --auth-body-format login
```

**Nunca** commitar `.env`. **Nunca** logar a senha.

### Ferramentas de automação

Detectar pelo preflight `stack`:

| Stack | Se faltar | O que instalar |
|-------|-----------|----------------|
| **playwright** (há `e2e/playwright.config.ts` ou `e2e/package.json`) | `nodeModules: false` | `cd e2e && npm install && npx playwright install chromium` |
| **robot** (`*.robot` ou `robotframework` em requirements) | `installed: false` | `python -m pip install robotframework` (e a lib do projeto: Browser ou SeleniumLibrary, se já estiver no requirements) |
| **none** | usuário escolheu **Automatizar a feature** | Perguntar Playwright vs Robot; bootstrap `e2e/` (Playwright) ou `e2e/robot/` (Robot) |
| **playwright+robot** | o que estiver false | Instalar os dois |

Se o usuário escolheu **testes manuais**, o preflight de Playwright/Robot pode ser só aviso; ainda assim o `.env` é obrigatório (login na UI).

---

## Passo B — Menu de execução (obrigatório)

Depois de identificar a feature:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/inspect-feature-artifacts.mjs --feature "{feature}" --json
```

Dizer se DOC/cenários locais já existem. **Não** gerar nada até o clique.

Usar **AskQuestion**. Título e labels **exatos**:

**Título:** `O que você deseja executar?`

| id | label |
|----|--------|
| `doc-and-scenarios` | Gerar documento de teste e cenários |
| `doc` | Só gerar o documento de teste |
| `scenarios` | Só gerar os cenários |
| `manual` | Executar os testes manuais |
| `automated` | Automatizar a feature |
| `end` | Encerrar a esteira de QA |

Uma opção só. Se AskQuestion não estiver disponível, listar as seis frases e esperar a resposta.

Se a mensagem já pediu uma ação clara, executar essa e **depois** mostrar o menu.

DOC + cenários na wiki só se o usuário escolheu gerar. Ao delegar via `Task`, incluir: `Não mostrar o menu da esteira; o orquestrador fará o handoff.`

Se gerar os dois: wiki → `create-test-doc` → `create-test-scenarios`. Se o DOC falhar, não gerar cenários.

---

## Passo C — Delegação (manuais / automação)

Antes de `manual` ou `automated`: preflight de `.env`. Se for **testes manuais**, AskQuestion **Em qual ambiente deseja executar os testes manuais?** (ambientes do `.hub-projeto.json`), gravar URLs com `write-env.mjs` e só então delegar. Se for **Automatizar a feature**, o agente de automação detecta o framework, pergunta se não houver nenhum, instala `e2e/`, preenche `.env` e **executa** os testes.

**Não** gerar DOC/cenários nesses caminhos.

### Delegação

**Manuais** — AskQuestion do ambiente, depois `Task` → `execute-manual-tests-manual`:

**Título:** `Em qual ambiente deseja executar os testes manuais?`

As opções vêm de `.hub-projeto.json` → `ambientes` (somente os que têm `url`). Label de cada opção: `{ID em maiúsculas} — {url}`; o `ambientePadrao` vem primeiro com ` (Recomendado)`. Se nenhum ambiente tiver URL, pedir as URLs ao usuário e gravar com `node "$HOME/.vint-qa/vqa.mjs" set hub.ambientes.{id}.url=... hub.ambientes.{id}.api=...` antes de continuar.

API: `ambientes.{id}.api` (ou a própria url). Gravar com `node "$HOME/.vint-qa/vqa.mjs" set --use-env {id}`.

```
Esteira QA — feature: {feature}
pbiId: {pbiId ou "desconhecido"}
ambiente: {DEV|TST|HML}
URL: {appUrl}
API: {apiUrl}
Wiki DOC: {wikiUrl}
Test Plan: {testPlanUrl}
Execute os testes manuais desta feature (Test Plans + Browser MCP) no ambiente {DEV|TST|HML}.
Não perguntar o ambiente de novo; já foi escolhido. Não mostrar o menu da esteira.
Mark Outcome por cenário.
```

**Automatizar a feature** — `Task` → `generate-regression-automation-manual`:

```
Esteira QA — Automatizar a feature: {feature}
Fonte: Test Plans já publicados.
Siga FRAMEWORK.md: detectar Playwright/Robot; se nenhum, perguntar (Playwright | Robot Framework).
Reusar e2e existente da feature; senão criar. .env via e2e/.env.example. Executar os testes ao final.
Se passarem: commit + push (push-automation-branch.mjs) e devolver createPrUrl para o QA abrir o PR.
```

**Encerrar:** relatório final da esteira, sem chamar outros agentes.

---

## Relatório da esteira

Incluir: feature, escolha do menu, DOC wiki (ou não gerado), Test Plan (ou não gerado), preflight se aplicável (`ready` / o que foi preenchido no `.env` **sem senha**), agente seguinte (ou encerrado).
