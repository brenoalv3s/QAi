# Wiki — Resolução de Caminhos (Documentos de Teste)

## Configuração do projeto

Valores lidos do `.hub-projeto.json` do projeto aberto (nunca fixos no plugin). Se algum estiver vazio, o `/vint-qa` pede ao usuário antes de executar.

| Config | Chave em `.hub-projeto.json` |
|--|--|
| Organização | `azure.organizacao` |
| Projeto | `azure.projeto` |
| Wiki | `azure.wiki` |
| Raiz da wiki | `azure.wikiRaiz` (ex.: `/Nome do Projeto`) |
| Pasta dos DOCs de teste | `azure.wikiDocumentosTeste` (padrão `Testes/Documentos de Testes` quando vazio) |
| Módulos (US → pasta DOC) | `azure.modulosWiki`: `[{ "usPrefix": "12.", "parentFolder": "DOC 11 - Central de Relatórios", "docParentNum": "11" }]` |
| Logo no índice das pastas | `azure.wikiLogo` (markdown de imagem, opcional) |
| URL base | `https://dev.azure.com/{azure.organizacao}/{azure.projeto}/_wiki/wikis/{azure.wiki}` |

## Hierarquia na wiki

```
{azure.wikiRaiz}
└── {azure.wikiDocumentosTeste}   (padrão: Testes/Documentos de Testes)
            ├── DOC {N} - {Módulo}                    ← módulo simples (1 DOC)
            └── DOC {N} - {Módulo}                    ← pasta pai (módulo com sub-US)
                ├── DOC {N}.{sub} - {Funcionalidade}
                └── DOC {N}.{sub} - {Funcionalidade}
```

### Exemplos

| US | Caminho wiki |
|--|--|
| US 12.1 | `.../Documentos de Testes/DOC 11 - Central de Relatórios/DOC 11.1 - Gerar Relatório de Vendas` |
| US 12.2 | `.../Documentos de Testes/DOC 11 - Central de Relatórios/DOC 11.2 - Gerar Relatório de Estoque` |
| US 05.3 | `.../Documentos de Testes/DOC 05 - Produtos/DOC 5.3 - Produtos - Editar` |
| — | `.../Documentos de Testes/DOC 20 - Categorias` (sem subpasta) |

**Observação:** o número do DOC nem sempre coincide com o da US (ex.: US 12.x → pasta `DOC 11`). Priorizar busca na wiki antes de inferir.

---

## Algoritmo de resolução (`publish-test-doc.mjs`)

### 1. Extrair referência da US do `.md`

Ordem de extração:

1. Metadados explícitos (se presentes após `[[_TOC_]]`):
   - `**US de referência:** US 12.1 — ...`
   - `**Wiki (DOC):** DOC 11.1 - Gerar Relatório de Vendas`
2. Linha **Casos de Teste (Azure DevOps):** `[Link do Azure Test Plans: US 12.1 - Nome]`
3. Primeira ocorrência de `US (\d+)\.(\d+)` no Objetivo Principal

### 2. Listar páginas existentes

API: `GET _apis/wiki/wikis/{wikiId}/pages?recursionLevel=oneLevel&path={base}&api-version=7.1` (recursivo por subpastas)

Filtrar paths sob `{azure.wikiDocumentosTeste}`.

### 3. Localizar página alvo

| Prioridade | Estratégia |
|--|--|
| 1 | Metadado `**Wiki (DOC):**` → path exato sob Documentos de Testes |
| 2 | Página existente cujo path contém `DOC {N}.{sub}` e cujo conteúdo ou path referencia a mesma US |
| 3 | Inferência via `US_MODULE_HINTS` (tabela abaixo) + título extraído do Test Plans |
| 4 | DOC simples `{BASE}/DOC {N} - {Título}` quando US não tem subnúmero |

### 4. Criar estrutura ausente

**Pasta pai ausente** → criar página índice mínima:

```markdown
{azure.wikiLogo}   (linha omitida se vazio)
[[_TOC_]]
```

**Página da feature ausente** → criar sob pasta pai com conteúdo completo do `.md`.

### 5. Publicar conteúdo

1. `GET` página alvo → obter `eTag` (se existir)
2. `PUT` com conteúdo do `documento-de-teste.md`
   - Página nova: sem `If-Match`
   - Página existente: header `If-Match: {eTag}`
3. Comentário: `Documento de Teste — Agent — {DD/MM/AAAA}`

---

## Mapeamento US → pasta pai (hints)

Usado somente quando a wiki não tem página correspondente.

| Prefixo US | Pasta pai | Número DOC pai |
|--|--|--|
Vem de `azure.modulosWiki` no `.hub-projeto.json`. Exemplo:

| Prefixo US | Pasta pai | Número DOC pai |
|--|--|--|
| `12.` | `DOC 11 - Central de Relatórios` | `11` |
| `05.` / `5.` | `DOC 05 - Produtos` | `05` |
| `14.` | `DOC 14 - Pedidos` | `14` |

Para US `12.{sub}`: página filha `DOC 11.{sub} - {Título}`.

---

## Metadados opcionais no `.md` (recomendado)

Inserir após `[[_TOC_]]` — usados pelo script de publicação, não alteram o template visual:

```markdown
**Funcionalidade:** Gerar Relatório de Vendas
**US de referência:** US 12.1 — Gerar Relatório de Vendas por Período
**Wiki (DOC):** DOC 11.1 - Gerar Relatório de Vendas
```

---

## Script

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-doc/scripts/publish-test-doc.mjs \
  docs/test-docs/{feature-slug}/documento-de-teste.md
```

Variáveis de ambiente (opcional):

| Variável | Descrição |
|--|--|
| `AZURE_DEVOPS_PAT` | PAT com escopo Wiki (Read & Write) |
| `AZURE_DEVOPS_WIKI_PAGE_PATH` | Forçar path completo da página |

PAT: `AZURE_DEVOPS_PAT` ou `.cursor/mcp.json`.
