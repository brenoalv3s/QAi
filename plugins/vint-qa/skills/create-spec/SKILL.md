---
name: create-spec
description: Cria arquivos .spec.ts Playwright com specs puras BDD (dado/quando/entao/e), Page Objects injetados via fixtures/main, sem locators, expect, if/else nem massa no spec. Usar quando o usuário pede um novo cenário, spec ou teste automatizado neste projeto.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Create Spec — e2e Playwright

Gera specs alinhadas aos agentes de regressão: **BDD**, hub `e2e/fixtures/main.ts`, lógica só no POM / locators / data.

Guia: [e2e/README.md](../../../e2e/README.md) · [ARCHITECTURE.md](../generate-regression-automation/ARCHITECTURE.md)

## Antes de escrever código

1. Garantir URL no `.env` da **raiz**.
2. Identificar domínio e operação → `tests/{dominio}/ui/` ou `api/`.
3. Criar locators + data + POM e **injetar** em `page-fixtures.ts` **antes** da spec.

## Estrutura

```
e2e/fixtures/main.ts
e2e/locators/{dominio}/listagem.locators.ts
e2e/data/{dominio}.data.ts
e2e/pages/{dominio}/listagem.page.ts
e2e/tests/{dominio}/ui/{operacao}.spec.ts
```

## Regras de conteúdo

- **BDD** — `dado` / `quando` / `entao` / `e` (passos extras com `e` são permitidos).
- **Sem** locators, expect, if/for, `new Page`, literais de massa no spec.
- Prefixo **`E2E-QA-`** em `data/` — o POM aplica.
- `test.skip` com mensagem no topo, se necessário.

## Template

```typescript
import { test, dado, quando, entao, e, titulo } from '../../../fixtures/main'

test.describe('{PREFIXO} — {Dominio} (US — {operacao})', () => {
  test(titulo('CN-01', 'Validar fluxo'), async ({ listagemPage, cadastroPage }) => {
    await dado('que o usuário acessa a listagem', async () => {
      await listagemPage.dadoQueOUsuarioAcessaAListagem()
    })
    await quando('preenche e salva o formulário', async () => {
      await cadastroPage.quandoPreencheESalvaOFormulario()
    })
    await entao('o sistema exibe mensagem de sucesso', async () => {
      await cadastroPage.entaoOSistemaExibeMensagemDeSucesso()
    })
    await e('o registro aparece na grid', async () => {
      await listagemPage.eORegistroApareceNaGrid()
    })
  })
})
```

## Checklist

- [ ] Import de `fixtures/main` (API: `fixtures/api`)
- [ ] Fixture atualizada com as páginas do domínio
- [ ] Nenhum `expect` / locator / `if` / literal no spec
- [ ] Editar/excluir não usam 1º item de HML
