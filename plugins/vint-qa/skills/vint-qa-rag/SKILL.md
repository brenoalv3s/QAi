---
name: vint-qa-rag
description: Base de conhecimento de QA do vint-qa (RAG local) — consultar aprendizados, documentos, cenários, código e2e e a base curada do plugin; registrar aprendizados do projeto; promover aprendizados para o time via pull request. Usar antes de escrever POM/spec, antes de executar testes manuais, ao investigar falhas e quando o usuário escolhe "Base de conhecimento" no /vint-qa.
---

# Base de conhecimento (vint-qa-rag)

Duas interfaces com o mesmo motor (BM25 local, índice em `.vint-qa/cache/`):

| Interface | Uso |
|-----------|-----|
| MCP `vint-qa-rag` | `rag_search`, `rag_add_learning`, `rag_reindex`, `rag_stats` |
| CLI | `node "$HOME/.vint-qa/vqa.mjs" rag search\|learn\|index\|stats ... --json` |

Preferir o MCP. Se ele não estiver disponível, usar a CLI.

## O que está indexado

| `kind` | Origem |
|--------|--------|
| `learning` | `.vint-qa/learnings/*.md` do projeto (peso maior) |
| `test-doc`, `scenario` | `docs/test-docs/`, `docs/test-scenarios/` |
| `regression` | `docs/regression-automation/` (manifestos) |
| `wiki` | `e2e/docs/wiki/` (espelho local de requisitos) |
| `code` | `e2e/`, `robot/` (POMs, locators, specs, resources) |
| `knowledge` | `{VINT_QA_ROOT}/knowledge/` — base curada do time (peso maior) |
| `skill`, `rule`, `agent`, `command` | Instruções do próprio plugin |

A reindexação é incremental e automática a cada busca (arquivos alterados desde a última).

## Quando consultar (`rag_search`)

| Momento | Exemplo de consulta |
|---------|---------------------|
| Antes de criar POM/locators | `"{tela} locator drawer salvar"` com `kinds: ["learning","code"]` |
| Antes de executar testes manuais | `"{feature} massa de dados ambiente"` com `kinds: ["learning","scenario"]` |
| Ao investigar falha | Mensagem de erro principal + nome da tela |
| Ao gerar cenários | `"{feature} regra"` com `kinds: ["learning","test-doc","wiki"]` |
| Dúvida de processo da esteira | `scope: "plugin"` |

Citar a fonte (`path:lines`) quando usar um resultado. Um aprendizado **não** substitui a documentação oficial: se contradizer o requisito, seguir o requisito e apontar a divergência ao usuário.

## Registrar aprendizado

Registrar quando a descoberta **vai economizar tempo na próxima execução** e não está óbvia no código ou na documentação:

- Locator estável não trivial (ou armadilha: componente que re-renderiza, portal, iframe)
- Regra de negócio implícita confirmada no sistema
- Instabilidade de ambiente (horário de deploy, serviço lento, dados resetados)
- Massa de dados necessária e como criá-la
- Comportamento de API (autenticação, paginação, códigos de erro)

Não registrar: o que já está na rule/skill, resultados de execução pontuais, nada com senha, token, PAT, dados pessoais ou massa real de cliente (o motor recusa textos com padrão de segredo).

```json
{
  "title": "Drawer de cadastro fecha ao clicar fora antes de salvar",
  "categoria": "locator",
  "tags": ["drawer", "ant-design"],
  "feature": "Cadastro de Clientes",
  "content": "## Contexto\n...\n## Sintoma\n...\n## Como aplicar\n..."
}
```

Categorias: `locator`, `regra-de-negocio`, `ambiente`, `massa-de-dados`, `flaky`, `api`, `processo`, `geral`.

Pelo menu `/vint-qa` → Base de conhecimento → Registrar: perguntar título, categoria (AskQuestion) e conteúdo; mostrar o texto final e pedir confirmação antes de gravar.

Os arquivos em `.vint-qa/learnings/` **devem ser commitados** no repositório do projeto — assim todo o time daquele projeto herda o aprendizado.

## Promover ao plugin

Quando um aprendizado vale para **qualquer** projeto (ex.: comportamento de um componente de UI comum, padrão de autenticação, armadilha do Playwright):

1. Listar os candidatos: arquivos de `.vint-qa/learnings/` escolhidos pelo usuário (AskQuestion múltipla).
2. Reescrever cada um no formato de `{VINT_QA_ROOT}/knowledge/learnings/_modelo.md`, **removendo** nomes de cliente, URLs internas e detalhes específicos do projeto. Mostrar o resultado ao usuário.
3. Obter o repositório do plugin: campo `repository` de `{VINT_QA_ROOT}/.cursor-plugin/plugin.json` (ou `git -C "{VINT_QA_ROOT}" remote get-url origin` se for um clone). Clonar numa pasta temporária.
4. Criar a branch `learning/{slug}`, adicionar o arquivo em `plugins/vint-qa/knowledge/learnings/{slug}.md`, commit (`docs(knowledge): {título}`), push e informar o link para abrir o pull request.
5. Nunca fazer push direto na branch principal.

Depois do merge na branch principal, o Auto Refresh do marketplace do time publica a nova versão em até ~10 minutos (sem Auto Refresh: Dashboard → Plugins & MCPs → Team Marketplaces → Refresh).
