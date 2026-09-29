# Arquitetura — Automação regressiva Playwright

Fonte de verdade: agentes `generate-regression-automation` e `generate-regression-automation-manual`.

Robot: [ROBOT.md](ROBOT.md).

Specs **puras** (BDD). Locators, dados, `expect` e condicionais **nunca** no `.spec.ts`. Hub: `e2e/fixtures/main.ts` (equivalente ao `main.resource` do Robot).

## Ambiente

Ler o arquivo **`.env` na raiz do repositório** (`BASE_URL`, `SYSTEM_URL`, `WEB_URL`, `TEST_USER`, `TEST_PASSWORD`).

| Agente | Se faltar URL |
|--------|----------------|
| Automático (background) | **Abortar** — *"Bloqueio: URL base não encontrada no arquivo .env."* |
| Manual | **Perguntar** ao usuário e só então continuar |

## Estrutura por domínio

```
e2e/
├── fixtures/
│   ├── main.ts                       ← hub: specs UI importam só daqui
│   ├── api.ts                        ← hub das specs API
│   └── page-fixtures.ts              ← injeta listagemPage, cadastroPage, …
├── locators/{dominio}/
│   ├── listagem.locators.ts          ← só seletores
│   └── cadastro.locators.ts
├── data/
│   ├── env.ts                        ← PREFIXO_E2E
│   └── {dominio}.data.ts             ← massa (POM usa; spec não)
├── pages/{dominio}/
│   ├── listagem.page.ts              ← ações / validar* (usam locators + data)
│   ├── cadastro-drawer.page.ts
│   └── index.ts
├── tests/{dominio}/ui/
│   ├── cadastrar.spec.ts
│   ├── editar.spec.ts
│   ├── buscar.spec.ts
│   ├── excluir.spec.ts
│   └── tela-inicial.spec.ts
└── tests/{dominio}/api/
    └── … (mesma lógica por operação)
```

---

## Padrão obrigatório do `.spec.ts` (UI)

O spec é **somente orquestração** BDD (`dado` / `quando` / `entao` / `e`). Sem argumentos de massa, sem locators.

**Proibido no spec:** `page.locator()`, `expect()`, `if/else`, `for`, `while`, `try/catch` de fluxo, `new Page`, literais `E2E-QA-…`.

```typescript
import { test, dado, quando, entao, e, titulo } from '../../../fixtures/main'

test.describe('{PREFIXO} — {Dominio} (US — cadastrar)', () => {
  test(titulo('CN-01', 'Validar cadastro com sucesso'), async ({ listagemPage, cadastroPage }) => {
    await dado('que o usuário está na tela de listagem e clica em novo', async () => {
      await listagemPage.dadoQueOUsuarioEstaNaTelaDeListagemEClicaEmNovo()
    })
    await quando('preenche os dados válidos e salva', async () => {
      await cadastroPage.quandoPreencheOsDadosValidosESalva()
    })
    await entao('o sistema exibe mensagem de sucesso e retorna para listagem', async () => {
      await cadastroPage.entaoOSistemaExibeMensagemDeSucesso()
    })
    await e('o registro aparece na grid', async () => {
      await listagemPage.eORegistroApareceNaGrid()
    })
  })
})
```

| Spec pode | Spec não pode |
|-----------|---------------|
| `dado` / `quando` / `entao` / `e` | `if` / `else` / `for` / `while` |
| Fixtures de Page Object | `page.locator` / `getByRole` |
| `await pageObject.metodo()` sem args de massa | `expect(...)` direto |
| Import de `fixtures/main` | `new Page`, literais, `process.env` |

---

## Ordem de implementação

1. `locators/{dominio}/` — seletores
2. `data/{dominio}.data.ts` — massa `E2E-QA-`
3. POM usa locators + data; `if/for` só aqui
4. Injetar páginas em `page-fixtures.ts` e reexportar via `main.ts`
5. Spec: só BDD chamando a fixture

Prefixo **`E2E-QA-`** vive em `data/` — o POM aplica. Editar/excluir: criar o dado no POM (pré-condição) — nunca o 1º item da lista HML.

---

## Fontes de cenários (modo manual)

| Entrada | Ação |
|---------|------|
| Test Plan / Suite ID | `list-regression-scenarios.mjs` + `analyze-wiki-coverage-gaps.mjs` com `--plan-id` |
| URL de documentação | Ler a URL; extrair fluxos Alta/Muito Alta; criar arquivos sem depender do scaffold Azure se não houver plan-id |
| Texto ou arquivo | Extrair BDD; scaffolding via edição de arquivos |
| Não informado | Perguntar fonte e funcionalidade |

Modo automático: somente board (`discover-regression-candidates.mjs`, `eligible[0]`). Feature/URL/texto → delegar ao agente manual.

---

## Classificação (PBI → operação)

| Operação | Arquivo |
|----------|---------|
| cadastrar | `cadastrar.spec.ts` |
| editar | `editar.spec.ts` |
| buscar | `buscar.spec.ts` |
| excluir | `excluir.spec.ts` |
| tela-inicial | `tela-inicial.spec.ts` |

## Validação

```bash
cd e2e && npm install
npx tsc --noEmit
npx playwright test tests/{dominio}/ui/
```

Exit code 0. Máx. 3 ciclos de correção. `mark-regression-done.mjs` só com testes verdes e origem Test Plans.

Guia: [e2e/README.md](../../../e2e/README.md)
