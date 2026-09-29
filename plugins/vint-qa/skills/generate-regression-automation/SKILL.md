---
name: generate-regression-automation
description: Gera automação da feature (Playwright ou Robot) a partir do Test Plans. Cria/reusa e2e/, instala o framework se faltar, .env e executa os testes. Modo manual (esteira: Automatizar a feature) ou automático (Executar Teste Done). Usar com /generate-regression-automation.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Generate Regression Automation — Playwright ou Robot (specs/suítes BDD)

Converte cenários de **alta criticidade** em suíte **Playwright** ou **Robot**: cenários só em BDD; locators, dados e lógica nas camadas certas.

Fonte de verdade do padrão de código: agentes `{VINT_QA_ROOT}/agents/generate-regression-automation.md` e `generate-regression-automation-manual.md`. Detalhe: [ARCHITECTURE.md](ARCHITECTURE.md) · [ROBOT.md](ROBOT.md) · [FRAMEWORK.md](FRAMEWORK.md).

**Cobertura (quando a origem for Azure):** Test Plans + wiki (SPEC/US/RN) + gaps. Ver [WIKI-COVERAGE.md](WIKI-COVERAGE.md).

**Somente leitura no Azure:** wiki, PBI, cards e cenários **apenas consultados** — única escrita: **Status da Automação** via `mark-regression-done.mjs` após testes verdes. Ver [READONLY-POLICY.md](READONLY-POLICY.md).

---

## Ambiente (obrigatório)

Ler **`.env` na raiz** e **`e2e/.env`** (`BASE_URL`, `SYSTEM_URL`, `TEST_USER`, `TEST_PASSWORD`). Modelo: `e2e/.env.example`.

No modo **manual / esteira**: se faltar, perguntar e gravar com `write-env.mjs`. Sem `.env` válido não gerar specs.

Framework: [FRAMEWORK.md](FRAMEWORK.md) — detectar Playwright/Robot; se nenhum, AskQuestion. Reusar arquivos da feature (`inspect-feature-automation.mjs`). Executar os testes ao final.

---

## Organização por domínio (obrigatória)

Cenários são agrupados pelo **domínio** (ex.: `Pedidos`), **não** por PBI filho.

```
e2e/fixtures/main.ts
e2e/locators/{dominio}/listagem.locators.ts
e2e/data/{dominio}.data.ts
e2e/pages/{dominio}/listagem.page.ts
e2e/pages/{dominio}/cadastro-drawer.page.ts
e2e/tests/{dominio}/ui/{operacao}.spec.ts
e2e/tests/{dominio}/api/…
```

Detalhes: [ARCHITECTURE.md](ARCHITECTURE.md) · classificação: `scripts/lib/feature-structure.mjs`

---

## Modos

| Modo | Entrada | Agente | Gate | Por execução |
|------|---------|--------|------|--------------|
| **Manual** | Feature, **URL de doc**, **texto/arquivo**, Test Plan ID | `generate-regression-automation-manual` | Nenhum | **1 feature** |
| **Automático** | `/generate-regression-automation --auto` | `generate-regression-automation` | **Executar Teste = Done** | **1 PBI** (`eligible[0]`) |
| **Agendado** | [AUTOMATION.md](AUTOMATION.md) — cron `0 18 * * 1-5` | `generate-regression-automation` | Done | **1 PBI** por trigger |
| **Sob demanda (cloud)** | Esteira: [qa-sprint-orchestrator/MANUAL.md](../qa-sprint-orchestrator/MANUAL.md) — `qa-sprint-orchestrator-manual.prefill.json` | `generate-regression-automation-manual` (delegado) | Opcional |

Guia completo do modo manual: [MANUAL.md](MANUAL.md).

---

## Processamento sequencial (obrigatório)

**Nunca** gerar scaffold ou implementação para múltiplos PBIs na mesma execução.

Fluxo por feature:

1. Cenários (Test Plans **+ wiki gaps**) → Scaffold → Implementar (sem TODOs)
2. **`playwright test tests/{dominio}/`** — gate obrigatório
3. Se falhar → `/heal-test` ou correção → reexecutar testes
4. **Somente com testes verdes** → `mark-regression-done.mjs` (Azure) **e** `push-automation-branch.mjs` (commit + push + link do PR)
5. Próxima feature → **nova execução** do agente (automático) ou continuar fila (manual explícito)

Modo automático: após concluir `eligible[0]`, **encerrar** — não processar `eligible[1..n]` na mesma sessão.

---

## Passo 0 — Ambiente + Gates (automático)

1. Validar URL no `.env` da **raiz** (abortar se ausente).
2. Gates do board:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/discover-regression-candidates.mjs --json
```

- `eligible[]` vazio → abortar com `blocked[]` e `skipped[]`
- **Processar somente `eligible[0]`** — uma feature por execução
- `feature` = `pbiTitle` do item selecionado (ex.: `Pedidos - Cadastrar`)

Regras: [BOARD.md](BOARD.md)

---

## Passo 1 — Cenários (Test Plans + wiki)

### 1a — Consultar wiki (somente leitura)

MCP: `search_wiki` + `get_wiki_page`. Complementar com `e2e/docs/wiki/` e `docs/test-scenarios/` se existirem localmente.

### 1b — Listar cenários unificados

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/list-regression-scenarios.mjs \
  --feature "{feature}" --plan-id {planId} --include-wiki-gaps --json
```

> Features sem dica em `azure.testPlans.planos` (`.hub-projeto.json`) **exigem** `--plan-id` ou `AZURE_DEVOPS_PLAN_ID`.

Filtro: **Muito Alta** + **Alta** (`highCriticity: true`) — Test Plans **e** gaps wiki.

### 1c — Relatório de gaps (opcional, detalhado)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/analyze-wiki-coverage-gaps.mjs \
  --feature "{feature}" --json
```

### 1d — Análise qualitativa wiki (MCP — obrigatório, somente leitura)

```
search_wiki → "{feature}"          ← permitido
get_wiki_page → SPEC, US, RN, ALI  ← permitido
```

**Proibido:** `create_wiki_page`, `update_wiki_page`, `create_wiki`, `update_work_item`, comentários em PBI/card.

Cruzar critérios **C.x** da US e **RN_xx** com `testPlanScenarios[]` e `wikiGapScenarios[]`. Se a wiki descrever fluxo crítico (Muito Alta/Alta) sem cobertura, adicionar à lista de implementação — **sem inventar** requisitos ausentes.

Saída relevante (`list-regression-scenarios --include-wiki-gaps`):

| Campo | Uso |
|-------|-----|
| `testPlanScenarios[]` | CNs formais do Test Plans |
| `wikiGapScenarios[]` | Cenários wiki/docs não previstos no Test Plans |
| `wikiCoverage.sourcesConsulted` | Fontes analisadas |
| `structure.domainSlug` | Pasta em `tests/{dominio}/` e POM |
| `uiScenarios[]` / `apiScenarios[]` | União Test Plans + gaps |
| `cnId`, `steps[]` | Um `test()` + `test.step()` por cenário |

Detalhes: [WIKI-COVERAGE.md](WIKI-COVERAGE.md)

---

## Passo 2 — Scaffold Playwright

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/scaffold-regression.mjs \
  --feature "{feature}" --include-wiki-gaps
```

Gera ou mescla (se não existir; use `--force` para sobrescrever):

- `e2e/locators/{dominio}/listagem.locators.ts` / `cadastro.locators.ts`
- `e2e/data/{dominio}.data.ts`
- `e2e/pages/{dominio}/listagem.page.ts` / `cadastro-drawer.page.ts`
- `e2e/fixtures/page-fixtures.ts` — injetar as páginas; specs importam `fixtures/main.ts`
- `e2e/tests/{dominio}/ui/{operacao}.spec.ts` — **somente** BDD (`dado`/`quando`/`entao`/`e`)
- `e2e/tests/{dominio}/api/{operacao}.spec.ts` — se houver cenários API
- `docs/regression-automation/{dominio}/manifest.json`

Se a origem for **URL ou texto** (modo manual): **não** exigir os scripts Azure; criar os arquivos na mesma árvore.

**Não** criar pastas por PBI (`pedidos-cadastrar/`) nem `regressao.spec.ts` monolítico por ação.

---

## Passo 3 — Enriquecer (wiki + código + browser)

### Documentação (MCP azure-devops)

SPEC, US, RN, MSG, ALI — mapear campos, mensagens, endpoints e **validar gaps** do Passo 1d.

### Frontend (`src/` — somente leitura)

Rotas, componentes, schemas Zod, hooks de API — conforme `{VINT_QA_ROOT}/rules/e2e-agent-workflow.mdc`.

### UI — browser MCP

```
/browser-mcp → validar locators no POM do domínio
```

Seguir `/create-pom` para implementar **todos** os métodos do Page Object (cadastrar, editar, buscar, excluir, tela inicial).

### API — Swagger

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/fetch-swagger.mjs --json
```

Implementar métodos em `{dominio}.client.ts` — token via `POST /api/auth/login`.

---

## Passo 4 — Implementar cenários (obrigatório)

### Padrão do spec (UI)

O `.spec.ts` é **somente orquestração** com `test.step` e fixtures de POM — ver [ARCHITECTURE.md](ARCHITECTURE.md).

```typescript
import { test, dado, quando, entao, e, titulo } from '../../../fixtures/main'

test.describe('{PREFIXO} — {Dominio} (US — {operação})', () => {
  test(titulo('CN-XX', 'Validar fluxo'), async ({ listagemPage, cadastroPage }) => {
    await dado('que o usuário acessa a listagem', async () => {
      await listagemPage.dadoQueOUsuarioAcessaAListagem()
    })
    await quando('preenche e salva o formulário', async () => {
      await cadastroPage.quandoPreencheESalvaOFormulario()
    })
    await entao('o sistema exibe mensagem de sucesso', async () => {
      await cadastroPage.entaoOSistemaExibeMensagemDeSucesso()
    })
  })
})
```

### Isolamento de dados — regra obrigatória

**Specs `editar` e `excluir` nunca operam sobre dados existentes do ambiente (HML/PRD).** Todo registro manipulado deve ter sido criado pela própria automação.

#### Prefixo obrigatório `E2E-QA-`

Todos os registros criados pela automação iniciam com `E2E-QA-` para busca e limpeza assertivas:

```typescript
// ✅ client — padrão obrigatório
nome: `E2E-QA-${sufixo}-${Date.now()}`
email: `e2e.qa.${sufixo}.${Date.now()}@automacao.test`
```

#### Método `executarPreCondicao*ParaEdicao` — padrão obrigatório nos POMs

Todo POM de listagem que suporta edição **deve implementar** este método:

```typescript
async executarPreCondicaoClienteParaEdicao(sufixo: string): Promise<ClienteLinha> {
  const client = new ClientesApiClient(this.page.request)
  await client.login()
  const criado = await client.executarCriarClienteE2E(`editar-${sufixo}`)
  await this.abrir()
  await this.executarBuscaPorNome(criado.nome)
  await expect(async () => {
    const linha = this.tabela().getByRole('row').filter({ hasText: criado.nome })
    await expect(linha.first()).toBeVisible()
    await expect(linha.getByRole('button', { name: /^Editar$/i }).first()).toBeEnabled()
  }).toPass({ timeout: 30_000 })
  await this.executarAbrirEditarPorNome(criado.nome)
  return { nome: criado.nome, email: criado.email, id: criado.id }
}
```

#### Estratégia por operação

| Spec | Estratégia |
|------|------------|
| `cadastrar` | Cria durante o teste (`E2E-QA-*`) |
| `editar` | `executarPreCondicao*ParaEdicao(sufixo)` antes de qualquer step |
| `excluir` | `executarPreCondicao*ParaExclusao(sufixo)` antes de qualquer step |
| `buscar` | Pode ler HML (somente leitura) + criar para busca pós-exclusão |
| `tela-inicial` | Pode ler HML (somente leitura) |

> Dados HML existentes podem ser **lidos** (ex.: obter nome de outro cliente para teste de duplicidade), mas **jamais editados ou excluídos** pelos testes automatizados.

### Divisão spec × POM × client

| Camada | Responsabilidade |
|--------|------------------|
| **Spec** | Só BDD; chama métodos da fixture **sem** args de massa |
| **Locators** | Seletores em `locators/{dominio}/` |
| **Data** | Prefixo `E2E-QA-` e massa em `data/` |
| **POM** | Ações, `validar*` com `expect`, `if/for` |
| **Fixture** | `page-fixtures.ts` injeta; `main.ts` é o hub |

Para cada `// TODO`:

1. **UI** — implementar métodos no POM; no spec, **apenas** `await pom.metodo()`
2. **API** — implementar métodos no client; no spec, **apenas** `await client.metodo()`
3. **API + UI** — ambas as camadas

Regras do spec (proibido):

- `if` / `else` / `switch` / ternário / `for` / `while` / `for…of` / `.forEach` com lógica de teste
- `page.locator`, `getByRole`, `expect` direto, `request.post`, `try/catch` de fluxo

Regras gerais:

- **Nunca** modificar `src/` ou `public/`
- **Nunca** usar `waitForTimeout` ou `networkidle`
- **Nunca** encerrar com TODOs pendentes

Detalhes e exemplo canônico: [ARCHITECTURE.md](ARCHITECTURE.md). Seguir `/create-spec` e `/review-spec`.

---

## Passo 5 — Validar (obrigatório — gate antes de marcar Done)

```bash
cd e2e
npm install
npx tsc --noEmit
npx playwright test tests/{dominio}/ui/
npx playwright test tests/{dominio}/api/   # se aplicável
```

**Exit code 0** em todos os projetos aplicáveis. Se falhar:

1. Diagnosticar (DRIFT / BUG / FALSO_POSITIVO)
2. `/heal-test` ou correção mínima no POM/spec/client
3. Reexecutar os comandos acima (até passar ou reportar bloqueio)

Opcional: `/review-spec` em cada `{operacao}.spec.ts` **antes** da primeira execução.

**Proibido** chamar Passo 6 com testes falhando.

---

## Passo 6 — Pós-processamento (somente após testes OK)

Atualizar **Status da Automação** nos Test Cases do Test Plans — **não** usar tags no PBI/card.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/mark-regression-done.mjs \
  --feature "{feature}" \
  --cn-ids "{CN-01,CN-02,...}" \
  --summary "Automação: {dominio} — {N} cenários — testes OK"
```

Em seguida, **sempre** publicar a branch para o QA abrir o PR (o agente **não** cria o PR):

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/push-automation-branch.mjs \
  --feature "{feature}" --json
```

No relatório final incluir `pushUrl` e `createPrUrl`. Não commitar `.env` nem `.cursor/mcp.json`.

| Campo Test Case | Valor após automação |
|-----------------|----------------------|
| Status da Automação (`Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b`) | `1. Concluído` |

**Não** comentar nem alterar PBI, card ou tasks — relatório somente na saída do agente. Ver [READONLY-POLICY.md](READONLY-POLICY.md).

Se modo automático e restarem itens em `eligible[]`: informar quantos faltam — serão processados em **execuções futuras**, uma por vez.

---

## Scripts disponíveis

| Script | Função |
|--------|--------|
| `list-regression-scenarios.mjs` | Cenários Muito Alta/Alta + `--include-wiki-gaps` |
| `analyze-wiki-coverage-gaps.mjs` | Gaps wiki/docs vs Test Plans |
| `discover-regression-candidates.mjs` | Gates: Executar Teste Done |
| `scaffold-regression.mjs` | POM/specs + `--include-wiki-gaps` |
| `mark-regression-done.mjs` | Status da Automação = Concluído nos Test Cases |
| `push-automation-branch.mjs` | Branch + commit + push; URL para o QA criar o PR |
| `lib/feature-structure.mjs` | Classificação PBI → domínio + operação + sub-grupo |

---

## Relação com outros agentes

| Agente | Quando | Gate Executar Teste |
|--------|--------|---------------------|
| `execute-manual-tests` | QA manual no Test Plans | **In Progress** |
| `generate-regression-automation` | Automação Playwright | **Done** |

Pipeline ideal: manual primeiro → automação depois.
