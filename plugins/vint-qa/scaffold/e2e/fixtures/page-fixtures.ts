import { test as base, type Page } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

/**
 * Injeta páginas. Locators não entram aqui — só em `locators/`.
 * Ao criar um domínio, acrescente a fixture (ex.: listagemPage) e reexporte via `main.ts`.
 */
type PageFixtures = {
  authenticatedPage: Page
  loginPage: LoginPage
}

export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
  authenticatedPage: async ({ page, loginPage }, use) => {
    await loginPage.abrir()
    await loginPage.fazerLogin()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  },
})

export { expect } from '@playwright/test'
