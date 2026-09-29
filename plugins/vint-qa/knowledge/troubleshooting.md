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

**Como resolver:** Cursor Settings → MCP → conferir se os servidores do plugin vint-qa estão habilitados; recarregar. `playwright` depende de `npx`.

## MCP robotmcp só mostra a tool `robotmcp_status`

**Sintoma:** o `robotmcp` aparece conectado, mas com uma única tool, `robotmcp_status`.
**Causa:** o plugin inicia o MCP por `runtime/mcp-robot.mjs`, que procura o `uvx` (PATH e pastas de instalação do winget, pip `--user` e instalador oficial) ou o pacote `rf-mcp` no Python. Sem nenhum dos dois, ele sobe um servidor reserva em vez de falhar.
**Como resolver:** `node "$HOME/.vint-qa/vqa.mjs" doctor --install --force` (ou rodar `/vint-qa`) e depois desligar e ligar o `robotmcp` em Customize → vint-qa → MCPs. Sem permissão de instalação: `python -m pip install --user rf-mcp`. A tool `robotmcp_status` mostra o motivo exato.

## Chromium do Playwright ausente

**Sintoma:** `browserType.launch: Executable doesn't exist`.

**Como resolver:** `npx playwright install chromium` dentro de `e2e/` (ou `vqa doctor --install --force`).


## Evidência sem GIF

**Causa:** `ffmpeg` ausente. A execução continua com PNG.

**Como resolver:** `vqa doctor --install --force` (winget / brew / apt).

## Teste Playwright instável (flaky)

- Nunca usar `waitForTimeout` fixo nem `networkidle`
- Esperar pelo estado observável: `expect(locator).toBeVisible()`, `toHaveText`, `waitForResponse` da API que carrega a tela
- Preferir `getByRole` / `getByLabel`; CSS só como último recurso
- Registrar a causa como aprendizado (`categoria: flaky`) para os próximos agentes
