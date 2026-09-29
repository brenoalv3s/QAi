# Troubleshooting da esteira vint-qa

## Launcher não encontrado (`~/.vint-qa/vqa.mjs`)

**Sintoma:** `Cannot find module ...\.vint-qa\vqa.mjs`.

**Causa:** o hook `sessionStart` do plugin ainda não rodou (plugin recém-instalado) ou foi bloqueado.

**Como resolver:** abrir um chat novo (o hook roda no início da sessão) ou rodar `node "{raiz-do-plugin}/runtime/install-launcher.mjs"`. Ver `rules/vint-qa-runtime.mdc`.

## Azure DevOps responde 401 ou 203 com HTML

**Causa:** PAT ausente, expirado ou sem escopo.

**Como resolver:** gerar um PAT com escopos Work Items (Read & Write), Wiki (Read & Write), Test Management (Read & Write) e Code (Read) e gravar em `.env` → `AZURE_DEVOPS_PAT`. Depois `vqa sync-mcp` e recarregar os MCPs.

## `Configuração do Azure DevOps incompleta`

**Causa:** falta `azure.organizacao`, `azure.projeto` ou `azure.wiki` no `.hub-projeto.json`.

**Como resolver:** `vqa validate --action doc --json` lista exatamente o que falta; gravar com `vqa set hub.azure.organizacao=... hub.azure.projeto="..." hub.azure.wiki=...`.

## MCP playwright / robotmcp / vint-qa-rag não aparecem

**Como resolver:** Cursor Settings → MCP → conferir se os servidores do plugin vint-qa estão habilitados; recarregar. `robotmcp` depende de `uvx` (instalar `uv`: `vqa doctor --install --force`). `playwright` depende de `npx`.

## Chromium do Playwright ausente

**Sintoma:** `browserType.launch: Executable doesn't exist`.

**Como resolver:** `npx playwright install chromium` dentro de `e2e/` (ou `vqa doctor --install --force`).

## Variáveis antigas `SGD_*`

Projetos anteriores ao plugin usam `SGD_APP_URL`, `SGD_TEST_USER` etc. Os scripts aceitam os dois formatos (aliases). Para migrar, gravar os nomes novos com `vqa set env.BASE_URL=... env.TEST_USER=...`; os antigos podem ser removidos depois.

## Evidência sem GIF

**Causa:** `ffmpeg` ausente. A execução continua com PNG.

**Como resolver:** `vqa doctor --install --force` (winget / brew / apt).

## Teste Playwright instável (flaky)

- Nunca usar `waitForTimeout` fixo nem `networkidle`
- Esperar pelo estado observável: `expect(locator).toBeVisible()`, `toHaveText`, `waitForResponse` da API que carrega a tela
- Preferir `getByRole` / `getByLabel`; CSS só como último recurso
- Registrar a causa como aprendizado (`categoria: flaky`) para os próximos agentes
