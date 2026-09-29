# Framework da automação (esteira)

Usado por `@generate-regression-automation-manual` após **Automatizar a feature**.

## Detectar

Antes de escrever testes: os MCPs **playwright** e **robotmcp** já devem estar no `.cursor/mcp.json` (vêm do plugin vint-qa). Usar o MCP do framework escolhido para descobrir locators e validar a UI — não pedir isso ao usuário.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/preflight-qa-pipeline.mjs --json
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/inspect-feature-automation.mjs --feature "{feature}" --json
```

| `stack` | Ação |
|---------|------|
| `playwright` | Seguir Playwright. Não perguntar. |
| `robot` | Seguir Robot. Não perguntar. |
| `playwright+robot` | Preferir o que **já tem arquivos da feature** (`inspect`). Se nenhum, perguntar. |
| `none` | AskQuestion **Qual o framework deseja utilizar?** — Playwright \| Robot Framework |

## Instalar (depois da escolha ou da detecção)

**Playwright** — pasta `e2e/` com config, fixtures, BasePage:

```bash
node "$HOME/.vint-qa/vqa.mjs" scaffold --framework playwright
cd e2e && npm install && npx playwright install chromium
```

Sem `--force` se `e2e/` já existir.

**Robot** — copiar `{VINT_QA_ROOT}/scaffold/robot/` (ou `node "$HOME/.vint-qa/vqa.mjs" scaffold --framework robot`) → `e2e/robot/` (não apagar Playwright). Hub: `resources/fixtures/main.resource`. Ver [ROBOT.md](ROBOT.md).

```bash
python -m pip install -r e2e/robot/requirements.txt
python -m Browser.entry init
```

## Reuso

Se `inspect` retornar `exists: true`: **estender** POMs/specs/resources existentes. Não recriar `page-fixtures.ts`, `BasePage` ou `main.resource` do zero. Só criar arquivos que faltam.

## .env

Modelo **`e2e/.env.example`**. Se faltar URL/usuário/senha → perguntar → `write-env.mjs`. Não começar specs sem `.env` válido.

## Fonte: Test Plans

Na esteira, cenários já publicados: `list-regression-scenarios.mjs --feature "{feature}"`. Criticidade Alta / Muito Alta.

## Validar (obrigatório)

Playwright: `cd e2e && npx tsc --noEmit && npx playwright test tests/{dominio}/`

Robot: `node e2e/robot/run.mjs tests/{dominio}`

Corrigir até passar (até 3 tentativas) ou reportar bloqueio.

Com testes verdes: `push-automation-branch.mjs --feature "{feature}" --json` e devolver `pushUrl` + `createPrUrl` ao QA (ele cria o PR). Sem testes verdes: **não** commitar nem dar push.
