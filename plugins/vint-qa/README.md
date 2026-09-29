# Plugin vint-qa

Esteira de QA da Vint Global para **qualquer projeto** aberto no Cursor.

## Uso

No chat do Cursor, com o modelo **Auto**:

```text
/vint-qa
```

1. Verifica as instalações (Node, npm, git, Python, uv, Chromium do Playwright, ffmpeg) e instala o que faltar.
2. Cria `.hub-projeto.json` e `.env` no projeto, se não existirem, e protege os segredos no `.gitignore`.
3. Mostra o menu clicável:

| Opção | Quem executa |
|-------|--------------|
| Gerar documento de teste e cenários | agentes `create-test-doc` → `create-test-scenarios` |
| Só gerar o documento de teste | `create-test-doc` |
| Só gerar os cenários | `create-test-scenarios` |
| Executar os testes manuais | `execute-manual-tests-manual` |
| Automatizar a feature | `generate-regression-automation-manual` (Playwright ou Robot) |
| Rodar o pipeline da sprint (board) | `qa-sprint-orchestrator`, `execute-manual-tests`, `generate-regression-automation` |
| Revisar ou reparar testes automatizados | skills `review-spec`, `heal-test` |
| Base de conhecimento (RAG e aprendizados) | MCP `vint-qa-rag`, skill `vint-qa-rag` |
| Configurar projeto (.env / .hub-projeto.json / MCP) | `setup-qa-project` |

4. Antes de cada ação, valida se `.hub-projeto.json` e `.env` têm o que aquela ação precisa e pede ao usuário o que faltar (segredos: preferencialmente direto no `.env`).

Também dá para pedir direto: `/vint-qa testes manuais do Cadastro de Clientes`.

## Configuração por projeto

| Arquivo | Conteúdo | Commitar? |
|---------|----------|-----------|
| `.hub-projeto.json` | Projeto, plataforma (Azure / GitLab / GitHub / Jira / Linear / local), ambientes, dados da wiki e do Test Plans | Sim |
| `.env` | `BASE_URL`, `API_BASE_URL`, `TEST_USER`, `TEST_PASSWORD`, `AZURE_DEVOPS_PAT`, tokens | **Nunca** |
| `.cursor/mcp.json` | MCP da plataforma (gerado pelo plugin) | **Nunca** |
| `.vint-qa/learnings/` | Aprendizados do projeto (RAG) | Sim |

Exemplos: [`examples/hub-projeto.azure.json`](examples/hub-projeto.azure.json) (Azure DevOps completo) e [`examples/hub-projeto.gitlab-local.json`](examples/hub-projeto.gitlab-local.json).

## Componentes

| Pasta | Conteúdo |
|-------|----------|
| `commands/vint-qa.md` | Ponto de entrada: preflight, menu, validação, delegação |
| `agents/` | Agentes da esteira (todos com `model: inherit` → seguem o Auto do chat) |
| `skills/` | Procedimentos, templates e scripts (Azure DevOps, Playwright, Robot, evidências) |
| `rules/` | Convenções (nenhuma com `alwaysApply`; as de e2e ativam por `globs: e2e/**`) |
| `hooks/` | `sessionStart`: instala o launcher `~/.vint-qa/vqa.mjs` e informa o caminho do plugin |
| `mcp.json` | MCPs `vint-qa-rag`, `playwright`, `robotmcp` |
| `runtime/` | CLI `vqa`: `startup`, `doctor`, `init`, `validate`, `set`, `sync-mcp`, `scaffold`, `rag` |
| `rag/` | Motor de busca BM25 + servidor MCP (sem dependências) |
| `knowledge/` | Base curada do time (troubleshooting, heurísticas, aprendizados promovidos) |
| `scaffold/` | Modelos de `e2e/` (Playwright), `e2e/robot/`, `.hub-projeto.json`, `.env` |
| `automations/` | Modelos de Cursor Automations (cron) para a esteira do board |

## CLI `vqa`

```bash
node "$HOME/.vint-qa/vqa.mjs" startup --install --json
node "$HOME/.vint-qa/vqa.mjs" validate --action manual --json
node "$HOME/.vint-qa/vqa.mjs" set hub.plataforma=azure env.TEST_USER=qa
node "$HOME/.vint-qa/vqa.mjs" set --use-env tst
node "$HOME/.vint-qa/vqa.mjs" sync-mcp --json
node "$HOME/.vint-qa/vqa.mjs" scaffold --framework playwright --install
node "$HOME/.vint-qa/vqa.mjs" rag search "login usuário inativo"
node "$HOME/.vint-qa/vqa.mjs" --root
```

## "Fine-tuning" (aprendizado contínuo)

O plugin não treina pesos de modelo. Os agentes melhoram por contexto versionado, em três camadas: instruções (`agents/`, `skills/`, `rules/`), base curada do time (`knowledge/`) e aprendizados de cada projeto (`.vint-qa/learnings/`). Os agentes consultam tudo via RAG antes de agir e registram descobertas novas; o que vale para todos os projetos é promovido para `knowledge/` por pull request. Detalhes em [`knowledge/README.md`](knowledge/README.md).

## Limitações conhecidas

- O modelo do chat não pode ser forçado por um plugin: o `/vint-qa` confere se está no **Auto** e, se não estiver, pede para trocar antes de continuar.
- Novas versões chegam ao time pelo Auto Refresh do marketplace (exige o GitHub App do Cursor no repositório); sem ele, é preciso clicar em Refresh no dashboard.
- O MCP `robotmcp` depende do `uv`/`uvx`; o `/vint-qa` tenta instalar, mas em máquinas sem permissão de instalação pode ser preciso fazer manualmente.
