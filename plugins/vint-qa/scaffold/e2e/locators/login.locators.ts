import type { Page } from '@playwright/test'

/** Somente seletores. Ações ficam no POM (`pages/login.page.ts`). */
export const loginLocators = (page: Page) => ({
  campoUsuario: page
    .getByLabel(/usu[aá]rio|e-?mail/i)
    .or(page.getByRole('textbox', { name: /usu[aá]rio|e-?mail/i }))
    .first(),
  campoSenha: page
    .getByLabel(/senha|password/i)
    .or(page.getByRole('textbox', { name: /senha|password/i }))
    .first(),
  botaoEntrar: page.getByRole('button', { name: /entrar|login/i }).first(),
})
