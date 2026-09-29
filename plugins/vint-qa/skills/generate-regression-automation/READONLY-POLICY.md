# Política de somente leitura — Azure DevOps

Durante todo o ciclo de `generate-regression-automation`, o agente **consulta** artefatos do Azure DevOps e da documentação — **não os altera**, com **uma única exceção** no Test Plans.

---

## Única escrita permitida no Azure DevOps

| O quê | Como | Campo |
|-------|------|-------|
| **Status da Automação** nos Test Cases | `mark-regression-done.mjs` **somente após** `playwright test` verde | `Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b` → `1. Concluído` |

**Proibido** chamar `update_work_item` (MCP ou API) para qualquer outro campo ou work item.

---

## Somente leitura (obrigatório)

### Wiki (Azure DevOps)

| Permitido | Proibido |
|-----------|----------|
| `search_wiki`, `get_wiki_page`, `list_wiki_pages`, `get_wikis` | `create_wiki_page`, `update_wiki_page`, `create_wiki` |

A wiki no Azure **nunca** é criada, editada ou publicada por este agente.

### Test Plans e cenários

| Permitido | Proibido |
|-----------|----------|
| Listar suites, Test Cases, steps, métricas QA (scripts + MCP leitura) | Criar/alterar Test Cases, steps, Criticidade, Estratégia Técnica |
| Atualizar **apenas** Status da Automação via `mark-regression-done.mjs` | `publish-test-scenarios.mjs`, criar suites, duplicar cenários |

### PBI, cards e work items

| Permitido | Proibido |
|-----------|----------|
| `get_work_item`, `list_work_items`, `search_work_items` (leitura) | `update_work_item`, `create_work_item`, `manage_work_item_link` |
| Ler estado do card **Executar Teste**, tags, comentários existentes | Comentários novos no PBI, task ou card |
| Ler hierarquia PBI pai | Alterar `System.State`, `System.Tags`, descrição, assignee |

### Documentação local (consulta)

Somente **leitura** durante o ciclo:

| Caminho | Papel |
|---------|-------|
| `e2e/docs/wiki/` | Espelho da wiki — **não editar** arquivos manualmente |
| `docs/test-scenarios/` | Cenários de teste — **não editar** |
| `docs/test-docs/` | Documentos de teste — **não editar** |

Consulta wiki via MCP (`search_wiki`, `get_wiki_page`) — **nunca** publicar ou editar páginas.

---

## O que o agente PODE escrever (repositório)

Artefatos de automação Playwright — **somente** em:

| Caminho | Conteúdo |
|---------|----------|
| `e2e/tests/`, `e2e/pages/`, `e2e/api/` | Specs, POMs, clients |
| `docs/regression-automation/{dominio}/` | `manifest.json` de geração |

**Nunca** modificar `src/`, `public/`, `docs/test-scenarios/`, `docs/test-docs/` nem páginas em `e2e/docs/wiki/`.

---

## Relatório final

Resultado da automação vai **apenas** no relatório do agente (chat/saída da execução) — **não** em comentários de PBI, wiki ou cards.

---

## Checklist antes de encerrar

- [ ] Nenhuma chamada MCP de escrita em wiki ou work items (exceto script `mark-regression-done.mjs`)
- [ ] Nenhum comentário adicionado em PBI/card/task
- [ ] Nenhum cenário criado ou editado no Test Plans (exceto Status da Automação)
- [ ] Código Playwright e manifesto local atualizados conforme escopo
