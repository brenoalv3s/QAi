import { expect, type Page } from '@playwright/test'
import { BasePage } from './base.page'
import { loginLocators } from '../locators/login.locators'

export class LoginPage extends BasePage {
  private readonly locators

  constructor(page: Page) {
    super(page)
    this.locators = loginLocators(page)
  }

  async abrir() {
    await this.page.goto('/login')
    await this.aguardarCarregamento()
  }

  async fazerLogin() {
    const user = process.env.TEST_USER ?? ''
    const password = process.env.TEST_PASSWORD ?? ''
    await this.locators.campoUsuario.fill(user)
    await this.locators.campoSenha.fill(password)
    await this.locators.botaoEntrar.click()
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 20_000,
      waitUntil: 'domcontentloaded',
    })
  }

  async assertFormularioVisivel() {
    await expect(this.locators.campoUsuario).toBeVisible()
    await expect(this.locators.campoSenha).toBeVisible()
    await expect(this.locators.botaoEntrar).toBeVisible()
  }
}
