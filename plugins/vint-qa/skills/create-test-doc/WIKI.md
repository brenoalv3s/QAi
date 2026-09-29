# Wiki — Resolução de Caminhos (Documentos de Teste)

## Configuração do projeto

Valores lidos do `.hub-projeto.json` do projeto aberto (nunca fixos no plugin). Se algum estiver vazio, o `/vint-qa` pede ao usuário antes de executar.

| Config | Chave em `.hub-projeto.json` |
|--|--|
| Organização | `azure.organizacao` |
| Projeto | `azure.projeto` |
| Wiki | `azure.wiki` |
| Raiz da wiki | `azure.wikiRaiz` (ex.: `/Nome do Projeto`) |
| Pasta dos DOCs de teste | `azure.wikiDocumentosTeste` (padrão `Squads/Testes & QA/Documentos de Testes`) |
| Módulos (US → pasta DOC) | `azure.modulosWiki`: `[{ "usPrefix": "38.", "parentFolder": "DOC 37 - Central de Relatórios", "docParentNum": "37" }]` |
| Logo no índice das pastas | `azure.wikiLogo` (markdown de imagem, opcional) |
| URL base | `https://dev.azure.com/{azure.organizacao}/{azure.projeto}/_wiki/wikis/{azure.wiki}` |

## Hierarquia na wiki

```
{azure.wikiRaiz}
└── {azure.wikiDocumentosTeste}   (padrão: Squads/Testes & QA/Documentos de Testes)
            ├── DOC {N} - {Módulo}                    ← módulo simples (1 DOC)
            └── DOC {N} - {Módulo}                    ← pasta pai (módulo com sub-US)
                ├── DOC {N}.{sub} - {Funcionalidade}
                └── DOC {N}.{sub} - {Funcionalidade}
```

### Exemplos (projeto de referência — `{VINT_QA_ROOT}/examples/hub-projeto.sgd.json`)

| US | Caminho wiki |
|--|--|
| US 38.1 | `.../Documentos de Testes/DOC 37 - Central de Relatórios/DOC 37.1 - Gerar Relatório Carteira de Contratos` |
| US 38.2 | `.../Documentos de Testes/DOC 37 - Central de Relatórios/DOC 37.2 - Gerar Relatório Financeiro dos Contratos PMO` |
| US 15.3 | `.../Documentos de Testes/DOC 15 - Contratos/DOC 15.3 - Contratos - Editar` |
| US 08.1 | `.../Documentos de Testes/DOC 08 - Tecnologia/DOC 8.1 - Tecnologias - Tela Inicial` |
| — | `.../Documentos de Testes/DOC 11 - Tipos de Serviços` (sem subpasta) |

**Observação:** o número do DOC nem sempre coincide com o da US (ex.: US 38.x → pasta `DOC 37`). Priorizar busca na wiki antes de inferir.

---

## Algoritmo de resolução (`publish-test-doc.mjs`)

### 1. Extrair referência da US do `.md`

Ordem de extração:

1. Metadados explícitos (se presentes após `[[_TOC_]]`):
   - `**US de referência:** US 38.1 — ...`
   - `**Wiki (DOC):** DOC 37.1 - Gerar Relatório Carteira de Contratos`
2. Linha **Casos de Teste (Azure DevOps):** `[Link do Azure Test Plans: US 38.1 - Nome]`
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
![vint-marca-2.png](...)
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
| `38.` | `DOC 37 - Central de Relatórios` | `37` |
| `15.` | `DOC 15 - Contratos` | `15` |
| `13.` | `DOC 13 - Clientes` | `13` |
| `14.` | `DOC 14 - Demandas` | `14` |
| `26.` / `28.` | `DOC 26 - Ausências` | `26` |
| `10.` | `DOC 10 - Apontamentos` | `10` |
| `09.` / `9.` | `DOC 09 - Colaboradores` | `09` |
| `08.` / `8.` | `DOC 08 - Tecnologia` | `08` |

Para US `38.{sub}`: página filha `DOC 37.{sub} - {Título}`.

---

## Metadados opcionais no `.md` (recomendado)

Inserir após `[[_TOC_]]` — usados pelo script de publicação, não alteram o template visual:

```markdown
**Funcionalidade:** Gerar Relatório Carteira de Contratos
**US de referência:** US 38.1 — Gerar Relatório Carteira de Contratos PMO
**Wiki (DOC):** DOC 37.1 - Gerar Relatório Carteira de Contratos
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
