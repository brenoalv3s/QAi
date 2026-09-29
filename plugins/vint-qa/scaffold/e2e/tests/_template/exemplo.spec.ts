import { test, dado, quando, entao, e, titulo } from '../../fixtures/main'

/**
 * Exemplo de spec BDD. Copie para tests/{dominio}/ui/{operacao}.spec.ts.
 * Proibido neste arquivo: locators, expect, if/else, for, literais de massa, new Page.
 */
test.describe('Projeto — Exemplo (US — buscar)', () => {
  test(titulo('CN-01', 'Buscar registro existente retorna resultado'), async ({ listagemPage }) => {
    await dado('que usuário acessa a listagem', async () => {
      await listagemPage.dadoQueUsuarioAcessaAListagem()
    })
    await quando('pesquisa pelo registro existente', async () => {
      await listagemPage.quandoPesquisaPeloRegistroExistente()
    })
    await entao('o registro pesquisado deve aparecer na lista', async () => {
      await listagemPage.entaoORegistroPesquisadoDeveAparecerNaLista()
    })
    await e('a mensagem de quantidade de resultados deve estar visível', async () => {
      await listagemPage.eAMensagemDeQuantidadeDeResultadosDeveEstarVisivel()
    })
  })
})
