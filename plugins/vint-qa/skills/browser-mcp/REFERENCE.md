# Referência — Browser MCP para e2e

## Tools do `cursor-ide-browser` — referência rápida

| Tool | Quando usar |
|------|-------------|
| `browser_navigate` | Abrir URL no browser MCP |
| `browser_snapshot` | Capturar árvore de acessibilidade (principal fonte de locators) |
| `browser_take_screenshot` | Capturar imagem visual da tela |
| `browser_click` | Clicar em elemento pelo `ref` do snapshot |
| `browser_fill` | Preencher campo de texto pelo `ref` |
| `browser_select_option` | Selecionar opção de `<select>` ou combobox |
| `browser_press_key` | Pressionar tecla (ex.: `Enter`, `Tab`, `Escape`) |
| `browser_scroll` | Rolar a página |
| `browser_highlight` | Destacar elemento visualmente para identificação |
| `browser_get_bounding_box` | Obter coordenadas de um elemento |
| `browser_cdp` | Executar comando Chrome DevTools Protocol |
| `browser_lock` | Travar o tab antes de automação longa |

---

## Ciclo lock/unlock para automação de múltiplos passos

Sempre que executar uma sequência de interações num tab existente:

```
browser_tabs → { action: "list" }         ← verificar tab existente
browser_lock → { action: "lock" }         ← travar antes de interagir
browser_navigate / browser_click / ...    ← interações
browser_lock → { action: "unlock" }       ← liberar ao terminar
```

---

## Interpretar um snapshot — exemplo

Dado este snapshot:
```yaml
- role: dialog
  name: Cadastrar Usuário
  children:
    - role: textbox
      name: Nome completo
    - role: combobox
      name: Perfil
    - role: button
      name: Salvar
    - role: button
      name: Cancelar
```

Locators correspondentes para o POM:

```typescript
// constructor
this.modal = page.getByRole('dialog', { name: /Cadastrar Usuário/i })

// métodos privados
private campoNome = () => this.modal.getByRole('textbox', { name: /Nome completo/i })
private campoPerfil = () => this.modal.getByRole('combobox', { name: /Perfil/i })

// métodos públicos
async preencherNome(nome: string) {
  await this.campoNome().fill(nome)
}

async selecionarPerfil(perfil: string) {
  await this.campoPerfil().selectOption(perfil)
}

async acionarSalvar() {
  await this.modal.getByRole('button', { name: /Salvar/i }).click()
}
```

---

## Descobrir locator de elemento sem role semântico

Quando `browser_snapshot` não exibe o elemento desejado (componentes customizados, ícones, etc.):

```
browser_cdp → {
  method: "Runtime.evaluate",
  params: {
    expression: "document.querySelector('[data-testid]')?.getAttribute('data-testid')"
  }
}
```

Ou inspecionar atributos diretamente:

```
browser_cdp → {
  method: "Runtime.evaluate",
  params: {
    expression: "JSON.stringify([...document.querySelectorAll('button')].map(el => ({ text: el.textContent?.trim(), id: el.id, class: el.className })))"
  }
}
```

---

## Validar locator antes de escrever o POM

Usar `Runtime.evaluate` para testar um seletor sem rodar o Playwright:

```
browser_cdp → {
  method: "Runtime.evaluate",
  params: {
    expression: "document.querySelectorAll('[role=button]').length"
  }
}
```

Ou verificar acessibilidade de um texto:

```
browser_cdp → {
  method: "Runtime.evaluate",
  params: {
    expression: "[...document.querySelectorAll('*')].filter(el => el.textContent?.trim() === 'Salvar').map(el => el.tagName + ' role=' + el.getAttribute('role'))"
  }
}
```

---

## Configuração playwright-mcp — opções completas

```json
{
  "browser": {
    "browserName": "chromium",
    "contextOptions": {
      "baseURL": "http://localhost:5173",
      "locale": "pt-BR",
      "timezoneId": "America/Sao_Paulo"
    }
  },
  "capabilities": ["core", "devtools"],
  "outputDir": "test-results/mcp",
  "console": { "level": "warning" }
}
```

| Campo | Descrição |
|-------|-----------|
| `browserName` | `chromium`, `firefox` ou `webkit` |
| `baseURL` | URL base; deve coincidir com `playwright.config.ts` |
| `locale` | Locale do browser (afeta formatação de datas e textos) |
| `capabilities` | `core` = navegação + snapshot; `devtools` = `browser_evaluate` |
| `outputDir` | Pasta para screenshots e traces das chamadas MCP |

---

## Sincronizar `baseURL` entre playwright.config.ts e playwright-mcp.config.json

Ambos os arquivos devem usar a mesma URL. A fonte da verdade é o `.env`:

```
# e2e/.env
BASE_URL=http://localhost:5173
```

`playwright.config.ts` já lê `process.env.BASE_URL`. Para o playwright-mcp, editar `e2e/mcp/playwright-mcp.config.json` manualmente ou criar um script de geração.

---

## Diagnóstico rápido

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Snapshot retorna vazio ou página em branco | App não está rodando | Rodar `npm run dev` na raiz do projeto |
| `ref` inválido após interação | Snapshot desatualizado | Tirar novo `browser_snapshot` |
| Elemento não aparece no snapshot | Elemento dentro de iframe ou shadow DOM | Usar `browser_cdp` com `Runtime.evaluate` para inspecionar |
| Locator funciona no snapshot mas falha no teste | Timing diferente | Adicionar `await expect(locator).toBeVisible()` antes da ação |
| playwright-mcp não aparece no Cursor | mcp.json não recarregado | Settings → MCP → Reload all servers |
