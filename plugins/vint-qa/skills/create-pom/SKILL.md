---
name: create-pom
description: Cria e edita Page Objects (POM) para o projeto e2e Playwright deste repositório, seguindo o padrão estabelecido (BasePage, prefixos de método, locators semânticos, modais). Usar quando o usuário pede um novo POM, nova página, novo modal, nova classe de Page Object, ou quando uma spec precisa de métodos que ainda não existem no POM.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Create POM — e2e Playwright

Gera ou edita Page Objects Playwright/TypeScript para o projeto `e2e/`.

## Antes de escrever código

1. Verificar se `pages/base.page.ts` já existe; se não existir, criá-lo primeiro (template em [PATTERNS.md](PATTERNS.md)).
1. Verificar se já existe POM para o domínio em `pages/{dominio}/`.
3. Ler a spec correspondente (se existir) para entender quais métodos são necessários.

---

## Estrutura de arquivos

```
e2e/
├── locators/{dominio}/
│   ├── listagem.locators.ts
│   └── cadastro.locators.ts
├── data/{dominio}.data.ts
├── pages/
│   ├── base.page.ts
│   ├── login.page.ts
│   └── {dominio}/
│       ├── listagem.page.ts
│       ├── cadastro-drawer.page.ts
│       └── index.ts
└── fixtures/page-fixtures.ts     ← injetar; specs usam fixtures/main.ts
```

**Arquivo locators:** `locators/{dominio}/listagem.locators.ts` (só seletores)  
**Arquivo listagem:** `pages/{dominio}/listagem.page.ts`  
**Arquivo cadastro:** `pages/{dominio}/cadastro-drawer.page.ts`  
**Classe:** `{Dominio}ListagemPage` / `{Dominio}CadastroDrawerPage extends BasePage`

Injetar em `e2e/fixtures/page-fixtures.ts`. Locators no arquivo de locators, não no spec. Métodos `validar*`, `navegar*`, `clicar*`, `preencher*`, `salvar*`. Massa em `data/`.

Guia completo: [e2e/README.md](../../../e2e/README.md)

---

## Esqueleto obrigatório

```typescript
import { expect, type Page } from '@playwright/test'
import { BasePage } from '../base.page'
import { listagemLocators } from '../../locators/{dominio}/listagem.locators'

export class {Dominio}ListagemPage extends BasePage {
  private readonly locators

  constructor(page: Page) {
    super(page)
    this.locators = listagemLocators(page)
  }
}
```

---

## Prefixos de método

| Prefixo | Papel | Visibilidade |
|---------|-------|-------------|
| `assert*` | `expect(...)` — nunca nas specs | public |
| `executar*` | Fluxo E2E completo (combina vários passos) | public |
| `preencher*` | Preencher um campo | public |
| `abrir*` | Abrir modal/drawer/rota | public |
| `acionar*` | Clicar em botão/ação | public |
| `aguardar*` | Wait sem assert | public/private |
| `selecionar*` | Combobox / select | public |
| `obter*` / `ler*` | Ler estado para a spec | public |
| `tentar*` | Ação opcional; retorna `boolean` | public |
| locators, scroll, internals | Tudo que a spec não chama diretamente | **private** |

---

## Hierarquia de locators

```typescript
// 1ª opção — role semântico
page.getByRole('button', { name: /Salvar/i })
page.getByRole('textbox', { name: /Nome/i })

// 2ª opção — label
page.getByLabel(/e-mail/i)

// 3ª opção — .or() para variantes de label
page.getByRole('textbox', { name: /Nome/i })
  .or(page.getByLabel(/nome completo/i))

// Âncora em container quando há vários widgets idênticos
this.modal.getByRole('combobox', { name: /Categoria/i })

// 4ª opção — data-testid (quando não há alternativa semântica)
page.getByTestId('campo-cpf')

// CSS apenas como último recurso
page.locator('.toast-error')
```

**Regras:**
- Sempre `.first()` em locators com `.or()` no `expect` ou `.click()`.
- Nomes com regex `/…/i` para resiliência a capitalização.
- Locators que dependem de contexto ou estado → `private` method retornando `Locator`, não `readonly`.

---

## Modais e drawers

```typescript
// Root do modal — ancorar por role + nome
this.modal = page
  .getByRole('dialog', { name: /Cadastrar .*/i })
  .or(page.getByRole('dialog').filter({ hasText: /Cadastrar/i }))

// Salvar com fallback de evaluate
async acionarSalvar(): Promise<void> {
  const btn = this.modal.getByRole('button', { name: /Salvar|Confirmar/i })
  try {
    await btn.click({ timeout: 8_000 })
  } catch {
    await btn.evaluate((el) => (el as HTMLElement).click())
  }
}

// Fechar sem Escape global
async acionarFechar(): Promise<void> {
  const btn = this.modal.getByRole('button', { name: /^Fechar$|^Cancelar$/i })
  await btn.evaluate((el) => (el as HTMLElement).click()).catch(() => {})
  await this.modal.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {})
}
```

---

## `expect` e assert

```typescript
// Simples
async assertTelaCarregada(): Promise<void> {
  await expect(this.titulo).toBeVisible({ timeout: 15_000 })
}

// Com mensagem de contexto
async assertListaTemDados(): Promise<void> {
  const n = await this.page.getByRole('row').count()
  expect(n, 'tabela deve ter pelo menos uma linha').toBeGreaterThan(1)
}

// Toast de sucesso com fallback estrutural
async assertSucesso(): Promise<void> {
  const toast = this.page.getByText(/sucesso|salvo|cadastrado/i)
  try {
    await expect(toast.first()).toBeVisible({ timeout: 10_000 })
  } catch {
    await expect(this.modal.first()).toBeHidden({ timeout: 20_000 })
  }
}

// Validação com expect.toPass (feedback assíncrono)
async assertMensagemValidacao(): Promise<void> {
  await expect(async () => {
    const visivel = await this.page.getByText(/obrigatório|inválido/i)
      .isVisible().catch(() => false)
    if (!visivel) throw new Error('Mensagem de validação ainda não visível')
  }).toPass({ timeout: 12_000 })
}
```

---

## Waits de rede

```typescript
// Aguardar spinner desaparecer após submit ou navegação
async aguardarCarregamento(): Promise<void> {
  await this.page.waitForLoadState('domcontentloaded')
  await this.page
    .getByText(/carregando/i)
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => {})
}

// Aguardar resposta de API (apenas quando necessário)
private aguardarResposta(urlParcial: RegExp): Promise<void> {
  return this.page.waitForResponse(
    (r) => urlParcial.test(r.url()) && r.status() < 400,
    { timeout: 30_000 }
  ).then(() => {}).catch(() => {})
}
```

---

## Checklist antes de entregar

- [ ] **Nenhum arquivo fora de `e2e/` foi modificado** — `src/`, `public/` e demais diretórios do projeto são somente leitura
- [ ] Classe estende `BasePage`; constructor chama `super(page)`
- [ ] Nenhum `expect` exposto para fora da classe (tudo em `assert*`)
- [ ] Locators com `.or()` usam `.first()` no `expect` ou `.click()`
- [ ] Locators dinâmicos ou dependentes de contexto são `private` methods
- [ ] Sem `waitForTimeout` fixo — usar `waitFor` ou `expect.toPass`
- [ ] Sem `networkidle` — usar `domcontentloaded` + spinner check

## Recursos adicionais

- Templates completos (BasePage, listagem, formulário, modal): [PATTERNS.md](PATTERNS.md)
