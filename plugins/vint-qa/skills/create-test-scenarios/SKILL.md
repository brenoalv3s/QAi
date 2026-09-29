---
name: create-test-scenarios
description: Busca documentação de uma feature na wiki do Azure DevOps (SPEC, US, RN, MSG, ALI), gera Cenários de Teste em Markdown seguindo Template Cenários de Teste.pdf, salva em docs/test-scenarios/ e publica no Azure Test Plans com métricas QA obrigatórias. Usar quando o usuário pede cenários de teste, casos de teste, CT, test cases por feature, ou menciona /create-test-scenarios.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Create Test Scenarios — Cenários de Teste por Feature

Gera **Cenários de Teste** numerados `[CN-xx]` a partir da wiki do Azure DevOps, seguindo [TEMPLATE.md](TEMPLATE.md) (padrão `Template Cenários de Teste.pdf`).

Se já existir `docs/test-scenarios/{slug}/cenarios-de-teste.md`, **não** recriar o arquivo: analisar cobertura, gerar **somente gaps** alinhados à wiki e **anexar** ao `.md` existente.

## Plataforma (não só Azure)

`preflight-mcp.mjs` + [PLATFORM.md](../qa-sprint-orchestrator/PLATFORM.md). Sem `capabilities.testPlans`: **não** chamar `publish-test-scenarios.mjs` — só o Markdown local. Sem wiki Azure: requisitos na fonte do projeto (Git, Confluence, arquivo).

---

## Passo 0 — Coletar a feature

Obter o **nome da funcionalidade** (ex.: "Financeiro dos Contratos", "Cadastro de Colaboradores").

Se não informado, perguntar antes de continuar.

---

## Passo 0b — Detectar cenários existentes

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-scenarios/scripts/analyze-existing-scenarios.mjs \
  --feature "{feature}" --json
```

| `mode` | Comportamento |
|--------|----------------|
| `create-new` | Criar `docs/test-scenarios/{slug}/cenarios-de-teste.md` do zero |
| `append-gaps` | Preservar o arquivo; numerar a partir de `nextCnHint`; **append** só dos faltantes |

Também procurar cenários já publicados na wiki de Testes & QA / Test Plans como referência de IDs — **não** duplicar o mesmo `[CN-xx]`.

**Proibido** sobrescrever o `.md` existente com um lote novo que apague CNs anteriores.

---

## Passo 1 — Buscar documentação na wiki (Azure DevOps MCP)

Usar MCP `azure-devops` (MCP do projeto, gerado por `vqa sync-mcp`):

```
search_wiki     → searchText: "{feature}"
list_wiki_pages → mapear estrutura (se necessário)
get_wiki_page   → páginas encontradas
```

Buscar páginas relacionadas, nesta ordem:

| Sufixo | Conteúdo |
|--|--|
| `{feature} SPEC` | Campos, botões, fluxos, critérios |
| `{feature} US` | Critérios C.x, objetivo, perfis |
| `{feature} RN` | Regras RN_xx |
| `{feature} MSG` | MSA_xx, MSC_xx, textos de alerta/confirmação |
| `{feature} ALI` | Integrações, persistência, domínios |
| Cenários existentes | Referência de formato (não copiar conteúdo) |

**Variações de nome:** tentar sem acentos, slug e nome parcial se busca exata falhar.

Complementar com `e2e/docs/wiki/` se sincronizado.

Consultar catálogo global quando necessário:
- `Mensagens de Alerta` / `Mensagens de Confirmação` na wiki

---

## Passo 2 — Planejar cobertura (inventário obrigatório)

Antes de escrever, mapear (detalhes em [CATEGORIES.md](CATEGORIES.md)):

1. **US e sub-US** — número (ex.: US 38.2) → prefixo `CN-38.2.xx`
2. **Critérios C.x** — um cenário por critério quando testável
3. **RN_xx** — um cenário por regra
4. **Mensagens** — MSA_xx / MSC_xx com texto da wiki
5. **Inventário SPEC** — campos obrigatórios, **maxlength/limites de caracteres**, **datas**, **upload (MB/tipos)**, numéricos min/max, **filtros/campos de busca (novos ou modificados)**
6. **Categorias** — feliz + **validação** + **borda** (obrigatórias se houver formulário/limites) + permissão + segurança + E2E + **filtros/buscas (Categoria 11 — obrigatória se SPEC descrever filtro novo ou modificado)**

Publicar o inventário no chat antes de gerar, incluindo **já cobertos** e **gaps a gerar**. **Proibido** entregar só happy path quando a SPEC descreve campos, tamanhos, datas ou anexos **e** ainda faltam CNs.

Usar limites (ex.: 25MB, 100 caracteres) **somente** se estiverem na wiki — senão registrar `⚠️ lacuna` (**não** gerar CN inventado).

Se página ausente, **documentar lacuna** no cabeçalho — **não inventar** regras nem cenários.

### Gap analysis (quando `mode=append-gaps`)

1. Mapear inventário exigido pela wiki (CATEGORIES.md).
2. Marcar o que os CNs existentes já cobrem (título, steps, `coverageHints` do script).
3. Listar **somente** gaps com referência a C.x / RN / campo SPEC.
4. Se não houver gap → parar geração; reportar cobertura completa.

**Nunca** criar cenário sem respaldo explícito em SPEC/US/RN/MSG/ALI/DOC.

---

## Passo 3 — Gerar cenários

Ler [TEMPLATE.md](TEMPLATE.md).

### Modo `create-new`

Produzir o `.md` completo:

### Cabeçalho do documento

- Logo do projeto (`azure.wikiLogo`, se configurado) + tabela HTML + `[[_TOC_]]`
- Metadados: Funcionalidade, US de referência, Fontes consultadas

### Bloco por cenário (repetir)

```
## [CN-{US}.{seq}] Funcionalidade - Ação - Resultado

**Descritivo do Cenário (Steps)**
*   **Dado** ...
*   **Quando** ...
*   **E** ... (quando aplicável)
*   **Então** ...

**Informações de Gestão e Técnica (Métrica QA)**
| Campo | Definição / Valor Esperado |
| Criticidade | ...
| Estratégia Técnica | ...
| Status da Automação | Planejado (padrão) |
```

**Numeração:** `CN-38.2.01`, `CN-38.2.02`, … sequencial por US. Em `append-gaps`, continuar de `nextCnHint`.

**Título:** `[Identificador] Funcionalidade - Ação realizada - Resultado esperado`

**Métricas (obrigatórias):** preencher **sempre** as 3 linhas da tabela Métrica QA. Cenário **sem métricas completas não será publicado** no Test Plan. Valores e mapeamento em [METRICS.md](METRICS.md).

Separar cada cenário com `---`.

### Modo `append-gaps`

1. Abrir o `.md` existente.
2. Gerar **apenas** os blocos dos gaps (mesmo formato TEMPLATE).
3. **Anexar** ao final do arquivo (após o último cenário), sem apagar CNs anteriores.
4. Opcional: atualizar **Fontes consultadas** no cabeçalho.

---

## Passo 4 — Salvar arquivo

```
docs/test-scenarios/{feature-slug}/cenarios-de-teste.md
```

`{feature-slug}` = kebab-case sem acentos (ex.: `financeiro-dos-contratos`).

Criar diretório se não existir. **Nunca** substituir um arquivo existente por um “novo do zero”.

---

## Passo 5 — Publicar no Azure Test Plans

Após salvar o `.md`, executar:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-scenarios/scripts/publish-test-scenarios.mjs \
  docs/test-scenarios/{feature-slug}/cenarios-de-teste.md
```

Só os novos (recomendado em `append-gaps`):

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-scenarios/scripts/publish-test-scenarios.mjs \
  docs/test-scenarios/{feature-slug}/cenarios-de-teste.md \
  --only-cn CN-xx.yy,CN-xx.zz
```

### Resolução de suites (ver [TEST-PLAN.md](TEST-PLAN.md))

1. **Localizar Test Plan** do módulo (ex.: US 38.x → plano `PMO`)
2. **Buscar suite da feature** (ex.: `Relatório Carteira de Contratos`)
3. **Se suite da feature não existir** → criar sob suite pai (ex.: `Central de Relatórios da Área PMO`)
4. **Se suite da feature já existir** → criar sub-suite `Cenários — Agent — {DD/MM/AAAA}` e adicionar cenários nela
5. **Criar Test Cases** com steps Gherkin + métricas mapeadas ([METRICS.md](METRICS.md))
6. **Pular duplicatas** — mesmo `[CN-xx]` já presente na **suite da feature ou qualquer sub-suite**

### Métricas obrigatórias no Test Plan

| Campo | `referenceName` |
|--|--|
| Criticidade | `Custom.Criticidade` |
| Estratégia Técnica | `Custom.e3b1ecaf-933e-421c-9e1e-cfb8311b4b16` |
| Status da Automação | `Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b` |

Se qualquer métrica estiver vazia ou sem mapeamento → **abortar** aquele cenário (não criar work item). Listar abortados no relatório.

PAT: `AZURE_DEVOPS_PAT` ou `.cursor/mcp.json`. Escopo necessário: Work Items + Test Plans (Read & Write).

---

## Passo 6 — Validar antes de entregar

- [ ] Logo + tabela HTML + `[[_TOC_]]` presentes
- [ ] Metadados de funcionalidade e US no cabeçalho
- [ ] Inventário SPEC feito (campos, limites, datas, upload)
- [ ] ≥ 1 cenário de caminho feliz (Criticidade Muito Alta)
- [ ] Validações: vazios + formatos + **tamanhos de caracteres** quando na SPEC
- [ ] **Data inválida / período** se houver campo data
- [ ] **Upload acima do limite MB** (+ tipo inválido) se houver anexo na SPEC
- [ ] Cenário por cada RN_xx encontrada na wiki
- [ ] Cenários para MSA_xx / MSC_xx citados na US ou RN
- [ ] Cenário de permissão quando US menciona perfil/C.2
- [ ] Gate de cobertura de [CATEGORIES.md](CATEGORIES.md) passou
- [ ] **Filtros/buscas:** se SPEC descrever filtro/busca novo ou modificado → Categoria 11 gerada com ≥1 cenário de inclusão + ≥1 de exclusão (grupo de controle)
- [ ] Cada cenário com título `[CN-xx] Func - Ação - Resultado`
- [ ] Steps em Gherkin PT: Dado / Quando / E / Então
- [ ] Tabela Métrica QA com 3 linhas preenchidas (Criticidade, Estratégia, Automação)
- [ ] Nenhum parágrafo de orientação do template incluído
- [ ] Arquivo salvo em `docs/test-scenarios/{feature-slug}/cenarios-de-teste.md`
- [ ] Script `publish-test-scenarios.mjs` executado sem abortados
- [ ] Test Cases criados no Test Plan com métricas validadas

---

## Relatório final

```
CENÁRIOS DE TESTE — {feature}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modo: create-new | append-gaps | cobertura-completa
Arquivo: docs/test-scenarios/{feature-slug}/cenarios-de-teste.md
Total no arquivo: {N} | Preservados: {P} | Novos nesta execução: {K}

Fontes consultadas:
  ✅ {página} — encontrada
  ⚠️  {página} — não encontrada

Cobertura por categoria:
  Caminho feliz: {n} | Validação: {n} | Borda: {n} | RN: {n} | Mensagens: {n} | Permissão: {n} | Filtros/Buscas: {n} | ...

Validação/borda:
  Campos obrigatórios cobertos: {n}/{total}
  Limites de caracteres: {n}
  Datas inválidas/período: {n}
  Upload (tamanho/tipo): {n}
  Lacunas (sem CN — wiki ausente): {lista ou nenhuma}

Test Plan:
  Plano: {nome} ({planId})
  Suite feature: {nome} ({suiteId})
  Suite alvo: {nome} ({suiteId})
  URL: https://dev.azure.com/{azure.organizacao}/.../ _testPlans/define?planId=...&suiteId=...
  Criados: {n} | Ignorados: {n} | Abortados: {n}

Próximo passo: QA revisa cenários no Test Plan e publica o .md na wiki se necessário
```

---

## Regras absolutas

- Seguir [TEMPLATE.md](TEMPLATE.md) — **nunca** alterar estrutura de cada bloco de cenário
- Seguir [CATEGORIES.md](CATEGORIES.md) — **nunca** omitir validação/borda quando a SPEC descreve campos, limites, datas ou upload **e** o gap ainda não está coberto
- **Nunca** sobrescrever `.md` existente — só **append** de gaps
- **Nunca** criar cenário sem respaldo em SPEC/US/RN/MSG/ALI/DOC
- **Nunca** inventar limites (MB, maxlength), RNs, mensagens ou critérios ausentes na wiki — registrar lacuna
- **Nunca** publicar na wiki de requisitos (`create_wiki_page` / `update_wiki_page` proibidos)
- **Nunca** criar Test Case sem as 3 métricas QA mapeadas ([METRICS.md](METRICS.md))
- **Nunca** modificar `src/` ou `e2e/tests/` — este skill produz documentação + Test Plans
- Se PAT indisponível: gerar/atualizar `.md` local e alertar — publicação no Test Plan fica pendente
