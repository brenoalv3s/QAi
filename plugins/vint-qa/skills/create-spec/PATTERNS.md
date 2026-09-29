# Padrões de referência — create-spec

Specs importam **somente** o hub. Locators, dados e `expect` ficam fora.

## Hub UI

```typescript
// e2e/fixtures/main.ts
export { test, expect } from './page-fixtures'
export { dado, quando, entao, e } from '../tests/helpers/bdd'
export { titulo } from '../tests/helpers/cenario'
```

## Spec canônica (UI)

```typescript
import { test, dado, quando, entao, e, titulo } from '../../../fixtures/main'

test.describe('{PREFIXO} — Clientes (US — buscar)', () => {
  test(titulo('CN-01', 'Busca por nome com sucesso'), async ({ listagemPage }) => {
    await dado('usuário autenticado na listagem de clientes', async () => {
      await listagemPage.dadoUsuarioAutenticadoNaListagemDeClientes()
    })
    await quando('busca pelo nome do cliente', async () => {
      await listagemPage.quandoBuscaPeloNomeDoCliente()
    })
    await entao('cliente aparece nos resultados', async () => {
      await listagemPage.entaoClienteApareceNosResultados()
    })
  })
})
```

## Spec API

```typescript
import { test, dado, quando, entao, titulo } from '../../../fixtures/api'

test.describe('{PREFIXO} — Clientes (US — cadastrar) — API', () => {
  test(titulo('CN-02', 'Cadastrar cliente via API'), async ({ clientesApiClient }) => {
    await dado('cliente autenticado na API', async () => {
      await clientesApiClient.dadoClienteAutenticadoNaApi()
    })
    await quando('envia o cadastro mínimo', async () => {
      await clientesApiClient.quandoEnviaOCadastroMinimo()
    })
    await entao('o contrato responde sucesso', async () => {
      await clientesApiClient.entaoOContratoRespondeSucesso()
    })
  })
})
```

## Proibido (não copiar para o spec)

- `new ClientesListagemPage(page)`
- `page.getByRole` / `expect(...)` / `if` / `for`
- `preencherFormularioNovoRegistro('E2E-QA-NomeTeste')` — massa no POM/`data/`
- `process.env` no corpo do step

## Skip no topo (único `process.env` aceitável)

```typescript
test.skip(!process.env.TEST_USER, 'TEST_USER e TEST_PASSWORD não definidos no .env')
```
