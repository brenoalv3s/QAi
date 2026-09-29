# Padrões de referência — create-pom

Locators em arquivo separado. POM só orquestra ações + `expect`.

```typescript
// locators/{dominio}/listagem.locators.ts
import type { Page } from '@playwright/test'

export const listagemLocators = (page: Page) => ({
  titulo: page.getByRole('heading', { name: /{Título}/i }),
  campoBusca: page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|pesquisar/i)),
  tabela: page.getByRole('table').or(page.getByRole('grid')),
})
```

## Tipos de POM e quando criar

| Tipo | Arquivo | Quando criar |
|------|---------|-------------|
| Base | `pages/base.page.ts` | Uma vez; todas as classes herdam |
| Tela / listagem | `pages/{dominio}/listagem.page.ts` | Tabela, busca, paginação, ações por linha |
| Formulário / drawer | `pages/{dominio}/cadastro-drawer.page.ts` | Formulário em drawer ou modal |
| Barrel | `pages/{dominio}/index.ts` | Export das classes do domínio |

---

## `base.page.ts` — criar antes de qualquer outro POM

```typescript
// pages/base.page.ts
import { type Page } from '@playwright/test'

export abstract class BasePage {
  constructor(protected page: Page) {}

  async aguardarCarregamento(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded')
    const spinner = this.page.getByText(/carregando/i)
    if (await spinner.first().isVisible({ timeout: 400 }).catch(() => false)) {
      await spinner.first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
    }
  }
}
```

---

## POM de listagem completo

```typescript
// pages/{dominio}/listagem.page.ts
import { expect, type Locator, type Page } from '@playwright/test'
import { BasePage } from '../base.page'

export class {Feature}ListagemPage extends BasePage {
  readonly titulo: Locator
  readonly campoBusca: Locator
  readonly tabela: Locator

  constructor(page: Page) {
    super(page)
    this.titulo = page.getByRole('heading', { name: /{Título}/i })
    this.campoBusca = page
      .getByRole('searchbox')
      .or(page.getByPlaceholder(/buscar|pesquisar/i))
    this.tabela = page.getByRole('table').or(page.getByRole('grid'))
  }

  async assertTelaCarregada(): Promise<void> {
    await expect(this.titulo).toBeVisible({ timeout: 15_000 })
  }

  async assertListaTemDados(): Promise<void> {
    const linhas = this.tabela.getByRole('row')
    await expect(linhas.nth(1)).toBeVisible({ timeout: 20_000 })
  }

  async assertItemNaLista(texto: string): Promise<void> {
    const esc = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await expect(
      this.tabela.getByText(new RegExp(esc, 'i')).first()
    ).toBeVisible({ timeout: 15_000 })
  }

  async assertItemAusenteNaLista(texto: string): Promise<void> {
    const esc = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await expect(
      this.tabela.getByText(new RegExp(esc, 'i')).first()
    ).toBeHidden({ timeout: 15_000 })
  }

  async executarBusca(termo: string): Promise<void> {
    await this.campoBusca.first().fill(termo)
    await this.campoBusca.first().press('Enter')
    await this.aguardarCarregamento()
  }

  async executarExclusaoPrimeiraLinha(): Promise<void> {
    await this.tabela
      .getByRole('row')
      .nth(1)
      .getByRole('button', { name: /excluir|remover/i })
      .click()
    await this.aguardarCarregamento()
  }

  async ler{Dado}PrimeiraLinha(): Promise<string> {
    return this.tabela.getByRole('row').nth(1)
      .getByRole('cell').first().innerText()
  }
}
```

---

## POM de formulário / modal

```typescript
// pages/{dominio}/cadastro-drawer.page.ts
import { BasePage } from '../base.page'
import { expect, type Locator, type Page } from '@playwright/test'
import { BasePage } from './base.page'

export class {Feature}FormPage extends BasePage {
  readonly modal: Locator

  constructor(page: Page) {
    super(page)
    this.modal = page
      .getByRole('dialog', { name: /{Título}/i })
      .or(page.getByRole('dialog').filter({ hasText: /{Título}/i }))
  }

  async assertModalAberto(): Promise<void> {
    await expect(this.modal.first()).toBeVisible({ timeout: 15_000 })
  }

  async assertModalFechado(): Promise<void> {
    await expect(this.modal.first()).toBeHidden({ timeout: 12_000 })
  }

  // Locators privados — contextualizados no modal
  private campo(rotulo: RegExp): Locator {
    return this.modal
      .getByLabel(rotulo)
      .or(this.modal.getByRole('textbox', { name: rotulo }))
  }

  async preencherCampoA(valor: string): Promise<void> {
    await this.campo(/Campo A/i).fill(valor)
  }

  async preencherCampoB(valor: string): Promise<void> {
    await this.campo(/Campo B/i).fill(valor)
  }

  async acionarSalvar(): Promise<void> {
    const btn = this.modal.getByRole('button', { name: /Salvar|Confirmar|Cadastrar/i })
    try {
      await btn.click({ timeout: 8_000 })
    } catch {
      await btn.evaluate((el) => (el as HTMLElement).click())
    }
  }

  async acionarCancelar(): Promise<void> {
    const btn = this.modal.getByRole('button', { name: /^Cancelar$|^Fechar$/i })
    await btn.evaluate((el) => (el as HTMLElement).click()).catch(() => {})
    await this.modal.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {})
  }

  async assertSucesso(): Promise<void> {
    const toast = this.page.getByText(/sucesso|salvo|cadastrado/i)
    try {
      await expect(toast.first()).toBeVisible({ timeout: 10_000 })
    } catch {
      await expect(this.modal.first()).toBeHidden({ timeout: 20_000 })
    }
  }

  async assertCamposObrigatorios(): Promise<void> {
    await expect(
      this.page.getByText(/obrigatório|preencha|informe/i).first()
    ).toBeVisible({ timeout: 10_000 })
  }

  /** Fluxo E2E completo de criação mínima válida. */
  async executarCriacaoMinima(dados: { campoA: string }): Promise<void> {
    await this.assertModalAberto()
    await this.preencherCampoA(dados.campoA)
    await this.acionarSalvar()
    await this.assertSucesso()
  }

  /** Retorna false se dados insuficientes no ambiente. */
  async tentarSelecionarOpcaoDisponivel(): Promise<boolean> {
    const opt = this.page.getByRole('option').first()
    if (!(await opt.isVisible({ timeout: 2_000 }).catch(() => false))) return false
    await opt.click()
    return true
  }
}
```

---

## POM de diálogo de confirmação (reutilizável)

```typescript
// pages/confirmacao.page.ts
import { expect, type Locator, type Page } from '@playwright/test'
import { BasePage } from './base.page'

export class ConfirmacaoPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  private dialogo(): Locator {
    return this.page
      .getByRole('alertdialog')
      .or(this.page.getByRole('dialog').filter({ hasText: /confirma|excluir|remover/i }))
  }

  async assertDialogoVisivel(): Promise<void> {
    await expect(this.dialogo().first()).toBeVisible({ timeout: 10_000 })
  }

  async confirmar(): Promise<void> {
    await this.dialogo()
      .getByRole('button', { name: /confirmar|sim|excluir|ok/i })
      .click()
  }

  async cancelar(): Promise<void> {
    await this.dialogo()
      .getByRole('button', { name: /cancelar|não|fechar/i })
      .click()
  }
}
```

---

## Usando dois POMs numa spec (E2E cria + valida + exclui)

```typescript
import { test, expect } from './fixtures/base.fixture'
import { {Dominio}ListagemPage, {Dominio}CadastroDrawerPage } from '../../../pages/{dominio}'
import { ConfirmacaoPage } from './pages/confirmacao.page'

test.describe('{Módulo} — exclusão após cadastro', () => {
  test('deve excluir item recém-cadastrado', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    const lista = new {Feature}ListagemPage(page)
    const form = new {Feature}FormPage(page)
    const confirmacao = new ConfirmacaoPage(page)
    let nomeItem = ''

    await test.step('Dado um item criado apenas para o teste', async () => {
      await page.goto('/{rota}')
      await lista.assertTelaCarregada()
      await page.getByRole('button', { name: /novo|cadastrar/i }).click()
      nomeItem = `Teste E2E ${Date.now()}`
      await form.executarCriacaoMinima({ campoA: nomeItem })
      await lista.assertItemNaLista(nomeItem)
    })

    await test.step('Quando confirma a exclusão', async () => {
      await lista.executarExclusaoPrimeiraLinha()
      await confirmacao.assertDialogoVisivel()
      await confirmacao.confirmar()
      await lista.aguardarCarregamento()
    })

    await test.step('Então o item não aparece mais na lista', async () => {
      await lista.assertItemAusenteNaLista(nomeItem)
    })
  })
})
```

---

## Anti-padrões a evitar

| ❌ Errado | ✅ Correto |
|-----------|-----------|
| `page.locator('#btn-salvar')` sem evidência | `getByRole('button', { name: /Salvar/i })` |
| `expect(...)` na spec diretamente | método `assert*()` no POM |
| `.or()` sem `.first()` no expect/click | sempre `.first()` quando `.or()` pode resolver múltiplos |
| `waitForTimeout(2000)` fixo | `waitFor({ state: 'hidden' })` ou `expect.toPass` |
| `networkidle` na navegação | `domcontentloaded` + spinner check |
| Locator dinâmico como `readonly` no constructor | `private method(): Locator` |
