import { type Page } from '@playwright/test'

export class BasePage {
  constructor(protected readonly page: Page) {}

  async aguardarCarregamento() {
    await this.page.waitForLoadState('domcontentloaded')
  }
}
