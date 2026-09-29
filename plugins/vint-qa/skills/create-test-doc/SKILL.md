---
name: create-test-doc
description: Busca documentação de uma feature na wiki do Azure DevOps (SPEC, US, RN, MSG, ALI) e gera um Documento de Teste em Markdown seguindo o padrão publicado na wiki do projeto (`azure.wiki`). Salva em docs/test-docs/ e publica automaticamente em {azure.wikiDocumentosTeste}. Usar quando o usuário pede documento de teste, DOC de teste, plano de teste por feature, ou menciona /create-test-doc.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Create Test Doc — Documento de Teste por Feature

Gera um **Documento de Teste** preenchido a partir da wiki do Azure DevOps, seguindo o template em [TEMPLATE.md](TEMPLATE.md) (padrão dos DOCs em `{azure.wikiDocumentosTeste}`).

## Plataforma (não só Azure)

No início: `preflight-mcp.mjs`. Se `next` = `ask-platform`, seguir [PLATFORM.md](../qa-sprint-orchestrator/PLATFORM.md). Sem `capabilities.wiki` do Azure: buscar requisitos na fonte do projeto e **não** chamar `publish-test-doc.mjs`. Sempre salvar `docs/test-docs/{feature-slug}/documento-de-teste.md`.

---

## Passo 0 — Coletar a feature

Obter o **nome da funcionalidade** (ex.: "Cadastro de Produtos", "Login").

Se não informado, usar `AskQuestion` ou perguntar diretamente. Aguardar resposta antes de continuar.

---

## Passo 1 — Buscar documentação na wiki (Azure DevOps MCP)

Usar MCP `azure-devops` (MCP do projeto, gerado por `vqa sync-mcp`):

```
search_wiki          → searchText: "{feature}"
list_wiki_pages      → mapear estrutura da wiki (se necessário)
get_wiki_page        → páginas encontradas
```

Buscar **todas** as páginas relacionadas à feature, nesta ordem de prioridade:

| Sufixo | Conteúdo esperado |
|--|--|
| `{feature} SPEC` | Especificação funcional, objetivo, escopo |
| `{feature} US` | User Stories (C.x, US-xx.x) |
| `{feature} RN` | Regras de negócio (RN_xx, MSA_xx, MSC_xx) |
| `{feature} MSG` | Mensagens de validação e feedback |
| `{feature} ALI` | Alinhamento, contexto de negócio |
| `{feature} DOC` | Documento de teste existente (se houver — usar como referência de formato, não copiar conteúdo) |

**Variações de nome:** tentar também sem acentos, slug kebab-case e nome parcial se a busca exata falhar.

Se wiki local existir (`e2e/docs/wiki/`), complementar com leitura dos `.md` sincronizados.

**Referência de formato:** consultar um DOC existente na wiki (ex.: `DOC 11.1`) para validar o padrão visual antes de gerar.

---

## Passo 2 — Consolidar inteligência

Antes de escrever, extrair e organizar:

1. **Objetivo** — da US/SPEC (parágrafo, não bullet)
2. **Em escopo** — funcionalidades, campos, botões, RNs listadas na wiki (tópicos com `*   **[Nome]:**`)
3. **Fora de escopo** — inferir do que não está na US atual ou explicitar limites
4. **Riscos** — integrações, validações críticas, dependências entre módulos
5. **Estratégia** — manual vs automático (Playwright e2e se aplicável)
6. **Frentes de cobertura** — UI/fluxo (incluir **validações**: obrigatórios, tamanho de caracteres, datas inválidas, upload/limites MB quando a SPEC citar), integração/dados, segurança (se aplicável), regressão (se aplicável), **filtros/buscas (obrigatório quando a SPEC descrever campos de filtro ou pesquisa novos/modificados — incluir como frente de cobertura explícita e risco de integridade de dados)**.
7. **Critérios de aceite** — derivados das RNs e US

Se alguma página wiki estiver ausente, **documentar a lacuna** no conteúdo (ex.: "RN não disponível na wiki — validar com PO") mas **não inventar** regras de negócio.

---

## Passo 3 — Gerar o documento

Ler [TEMPLATE.md](TEMPLATE.md) e produzir o `.md` **seguindo a estrutura literal**:

- Logo do projeto (`azure.wikiLogo`, se configurado) + tabela HTML de cabeçalho (4 colunas) + `[[_TOC_]]`
- Metadados após TOC: **Funcionalidade**, **US de referência**, **Wiki (DOC)** (obrigatórios para publicação)
- Seções `# 1.` a `# 4.` (H1) com `---` após cada título
- Seção 1: Objetivo em parágrafo; Em Escopo e Fora de Escopo como listas `*   **[Tópico]:**`
- Seção 2: tabela de riscos GFM com impacto `[Alto]`/`[Médio]`/`[Baixo]`/`[Crítico]` e mitigação `**Ação (QA):**`; quando a feature incluir filtros/buscas novos/modificados: risco **"Integridade dos dados retornados pelo filtro"** obrigatório com impacto `[Alto]` e ação de validação de inclusão/exclusão/contagem
- Seção 3: Abordagem Geral em parágrafo; Frentes de Cobertura com sub-listas indentadas
- Seção 4: checklist `*   [ ]` (mínimo 4 itens)

**Não** incluir título `# {Feature} — Documento de Teste`.

### Formatação — padrão wiki Azure DevOps do projeto (obrigatório)

| Elemento | Padrão |
|--|--|
| Cabeçalho | Tabela **HTML** com `<b>Número do projeto</b>`, `<b>Cliente:</b>`, `<b>Versão:</b>`, `<b>Data:</b>` |
| Logo | `{azure.wikiLogo}` do `.hub-projeto.json` (omitir a linha se vazio) |
| TOC | `[[_TOC_]]` após cabeçalho |
| Seções | `# N. Título` + `---` (H1, não H2) |
| Tabela de riscos | Separador GFM `\| --- \| --- \| --- \|`; negrito nas células permitido |
| Em Escopo | `*   **[Tópico]:** descrição` |
| Critérios | `*   [ ] critério` (não `- [ ]`) |

Detalhes completos em [TEMPLATE.md](TEMPLATE.md).

---

## Passo 4 — Salvar arquivo

Caminho de saída:

```
docs/test-docs/{feature-slug}/documento-de-teste.md
```

Onde `{feature-slug}` é kebab-case sem acentos (ex.: `cadastro-de-produtos`).

Criar diretório se não existir.

---

## Passo 5 — Publicar na wiki (Documentos de Testes)

Após salvar o `.md`, executar:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-doc/scripts/publish-test-doc.mjs \
  docs/test-docs/{feature-slug}/documento-de-teste.md
```

### Resolução de caminho (ver [WIKI.md](WIKI.md))

1. **Extrair US** dos metadados ou do Objetivo / Casos de Teste
2. **Buscar página existente** sob `{azure.wikiDocumentosTeste}`
3. **Se pasta pai ausente** → criar índice mínimo (ex.: `DOC 11 - Central de Relatórios`)
4. **Se página da feature ausente** → criar em `{pasta pai}/DOC {N}.{sub} - {Título}`
5. **Se página já existe** → atualizar conteúdo (PUT com eTag)

### Metadados obrigatórios para publicação

```markdown
**Funcionalidade:** Gerar Relatório de Vendas
**US de referência:** US 12.1 — Gerar Relatório de Vendas por Período
**Wiki (DOC):** DOC 11.1 - Gerar Relatório de Vendas
```

O campo **Wiki (DOC)** deve seguir o padrão de nomenclatura das páginas existentes na wiki (consultar `list_wiki_pages` ou `search_wiki` antes de preencher).

PAT: `AZURE_DEVOPS_PAT` ou `.cursor/mcp.json`. Escopo necessário: Wiki (Read & Write).

---

## Passo 6 — Validar antes de entregar

Checklist obrigatório:

- [ ] Estrutura idêntica ao [TEMPLATE.md](TEMPLATE.md)
- [ ] Logo + tabela HTML + `[[_TOC_]]` presentes
- [ ] Metadados Funcionalidade, US de referência e Wiki (DOC) após TOC
- [ ] Seções `# 1.` a `# 4.` (H1) com `---` após cada título
- [ ] Sem título `# {Feature} — Documento de Teste`
- [ ] Objetivo Principal em parágrafo (não bullet)
- [ ] Em Escopo e Fora de Escopo (Limites do Teste) com listas `*   **[Tópico]:**`
- [ ] Tabela de riscos GFM com ≥ 2 linhas; impacto `[Alto]`/`[Médio]`/`[Baixo]`; mitigação `**Ação (QA):**`
- [ ] Seção 3 com Abordagem Geral + Frentes de Cobertura (UI/Fluxo e Integração obrigatórios)
- [ ] Se SPEC descrever filtro/busca novo ou modificado: **Frente "Filtros e Buscas"** presente + risco de integridade de dados na seção 2
- [ ] Seção 4 com ≥ 4 checkboxes `*   [ ]`
- [ ] RNs e US referenciadas quando disponíveis na wiki
- [ ] Nenhum parágrafo de orientação do template incluído no documento
- [ ] Arquivo salvo em `docs/test-docs/{feature-slug}/documento-de-teste.md`
- [ ] Script `publish-test-doc.mjs` executado com sucesso
- [ ] Página criada/atualizada na wiki com path correto

---

## Relatório final

```
DOCUMENTO DE TESTE — {feature}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arquivo: docs/test-docs/{feature-slug}/documento-de-teste.md

Fontes consultadas:
  ✅ {página} — encontrada
  ⚠️  {página} — não encontrada

Wiki:
  Path: {wikiPagePath}
  URL: https://dev.azure.com/{azure.organizacao}/.../_wiki/wikis/{azure.wiki}?pagePath=...
  Ação: criada | atualizada

Próximo passo: QA revisa conteúdo na wiki e no arquivo local
```

---

## Regras absolutas

- Seguir [TEMPLATE.md](TEMPLATE.md) — **nunca** alterar estrutura, títulos ou ordem das seções
- **Nunca** publicar na wiki de requisitos — apenas em `{azure.wikiDocumentosTeste}`
- Publicação via `publish-test-doc.mjs` (não via MCP `create_wiki_page` manual no chat)
- **Nunca** modificar `src/` ou `e2e/tests/` — este skill produz apenas documentação
- Se PAT indisponível: gerar `.md` local e alertar — publicação na wiki fica pendente
