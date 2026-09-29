import type { Page } from '@playwright/test'

/** Copie para locators/{dominio}/listagem.locators.ts e ajuste os seletores. */
export const listagemLocators = (page: Page) => ({
  titulo: page.getByRole('heading').first(),
  campoPesquisa: page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|pesquisar/i)),
  linhaGrid: page.getByRole('row'),
  mensagemResultado: page.getByRole('status'),
})
