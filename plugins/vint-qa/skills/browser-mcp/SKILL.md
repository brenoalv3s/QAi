---
name: browser-mcp
description: Usa o browser MCP (cursor-ide-browser) para explorar a aplicação antes de escrever POMs e specs Playwright — descobre locators reais via snapshot de acessibilidade, valida interações e documenta comportamento da UI. Também cobre como adicionar o playwright-mcp ao projeto. Usar quando o usuário precisa descobrir seletores, inspecionar a UI da aplicação, validar um locator antes de criar um POM, ou configurar MCP de browser para o projeto e2e.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Browser MCP — e2e Playwright

Usa o MCP `cursor-ide-browser` para explorar a aplicação real antes de escrever qualquer locator ou spec.

---

## Quando usar

| Situação | O que fazer |
|----------|-------------|
| Criar um POM novo | Navegar até a tela e tirar snapshot antes de escrever qualquer locator |
| Locator não encontrado no teste | Tirar snapshot para verificar role, name ou label real do elemento |
| Validar fluxo interativo | Usar `browser_click` / `browser_fill` para confirmar que a UI se comporta como esperado |
| Documentar comportamento | Usar `browser_take_screenshot` após interações importantes |

---

## Workflow de descoberta de locator

### 1. Navegar até a tela

```
browser_navigate → { url: "http://localhost:5173/rota-alvo" }
```

> Sempre verificar se o app está rodando (`npm run dev` no projeto raiz) antes de navegar.

### 2. Tirar snapshot de acessibilidade

```
browser_snapshot
```

O snapshot retorna a árvore de acessibilidade da página. Procurar:

- `role` — `button`, `textbox`, `heading`, `link`, `dialog`, `alert`, `table`, `row`, `cell`
- `name` — o texto ou aria-label do elemento  
- `ref` — handle opaco para interação imediata (válido apenas até o próximo snapshot)

### 3. Mapear para locators Playwright

| Snapshot | Locator correspondente |
|----------|----------------------|
| `role=button name="Salvar"` | `page.getByRole('button', { name: /Salvar/i })` |
| `role=textbox name="Nome completo"` | `page.getByRole('textbox', { name: /Nome completo/i })` |
| `role=combobox name="Categoria"` | `page.getByRole('combobox', { name: /Categoria/i })` |
| `role=dialog name="Cadastrar Usuário"` | `page.getByRole('dialog', { name: /Cadastrar Usuário/i })` |
| `role=alert` | `page.getByRole('alert')` |
| `name` via label de campo | `page.getByLabel(/texto do label/i)` |

### 4. Interagir para validar

```
browser_fill  → { ref: "...", value: "texto" }
browser_click → { ref: "..." }
browser_snapshot                  ← verificar estado após interação
browser_take_screenshot           ← documentar se necessário
```

---

## Fluxo completo: criar POM para uma tela nova

```
[ ] 1. browser_navigate → URL da tela
[ ] 2. browser_snapshot → identificar heading, campos, botões
[ ] 3. Se houver modal/drawer: browser_click no botão de abertura
[ ] 4. browser_snapshot → capturar estrutura do modal
[ ] 5. Mapear roles/names para locators (tabela acima)
[ ] 6. Criar o POM em `pages/{dominio}/listagem.page.ts` (+ `cadastro-drawer.page.ts` se necessário)
[ ] 7. browser_take_screenshot → anexar como referência (opcional)
```

---

## Dicas de snapshot

- **Elementos dentro de modal**: tirar snapshot *depois* de abrir o modal — o snapshot captura o estado atual da DOM.
- **Listas/tabelas**: o snapshot mostra `role=row` com células; usar `.nth(1)` para a primeira linha de dados (nth(0) é o cabeçalho).
- **Spinners/loading**: se o snapshot retornar `role=status` ou texto "Carregando", aguardar a tela carregar e tirar novo snapshot.
- **Campos sem label visível**: procurar `placeholder` no snapshot; usar `page.getByPlaceholder(/texto/i)`.

---

## Adicionar playwright-mcp ao projeto (opcional)

O `@playwright/mcp` permite que o Cursor navegue e interaja com o browser Playwright diretamente. Para adicionar:

**1. Instalar como servidor MCP:**

Criar ou editar `.cursor/mcp.json` na raiz do workspace:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@playwright/mcp",
        "--config", "${workspaceFolder}/e2e/mcp/playwright-mcp.config.json"
      ],
      "cwd": "${workspaceFolder}/e2e"
    }
  }
}
```

**2. Criar o arquivo de config** em `e2e/mcp/playwright-mcp.config.json`:

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
  "outputDir": "test-results/mcp"
}
```

**3. Recarregar** no Cursor: **Settings → MCP → Reload all servers**.

> `baseURL` deve ser a mesma do `playwright.config.ts` e do `.env`.

---

## Checklist antes de criar POM

- [ ] App rodando localmente (`npm run dev`)
- [ ] Snapshot tirado da tela alvo
- [ ] Snapshot tirado de cada modal/drawer relevante
- [ ] Roles e names mapeados para locators Playwright
- [ ] Locators validados com interação no browser MCP (se necessário)

## Recursos adicionais

- Referência dos tools do browser MCP e configuração playwright-mcp: [REFERENCE.md](REFERENCE.md)
