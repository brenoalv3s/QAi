# Test Plans — Resolução de Suites

## Configuração do projeto

Valores lidos do `.hub-projeto.json` do projeto aberto (nunca fixos no plugin). Se algum estiver vazio, o `/vint-qa` pede ao usuário antes de executar.

| Config | Chave em `.hub-projeto.json` |
|--|--|
| Organização | `azure.organizacao` |
| Projeto | `azure.projeto` |
| Planos por US/palavra-chave | `azure.testPlans.planos`: `[{ "usPrefix": "09.", "keywords": ["colaborador"], "planName": "Colaboradores", "parentSuite": "Colaboradores" }]` |
| Apelidos de suíte | `azure.testPlans.aliasesSuites`: `[{ "keywords": ["carteira de contratos"], "suiteName": "Relatório Carteira de Contratos" }]` |
| Campos do Test Case | `azure.camposTestCase` (`criticidade`, `estrategia`, `statusAutomacao`) |
| Plano fixo (opcional) | `.env`: `AZURE_DEVOPS_PLAN_ID`, `AZURE_DEVOPS_PARENT_SUITE` |
| URL base | `https://dev.azure.com/{azure.organizacao}/{azure.projeto}/_testPlans` |

## Hierarquia esperada

```
Test Plan (módulo)
└── Suite pai (área funcional)
    └── Suite da feature
        └── Suite de execução (lote do agente) ← cenários criados aqui
```

Exemplo US 38.1:

```
PMO (planId: 25350)
└── Central de Relatórios da Área PMO (25576)
    └── Relatório Carteira de Contratos (25578)
        └── Cenários — Agent — 08/06/2026 ← test cases
```

## Algoritmo de resolução

### 1. Identificar Test Plan

Buscar plano cujo nome corresponda ao módulo da US:

| US / feature | Test Plan |
|--|--|
| US 38.x (Central de Relatórios) | `PMO` |
| US 08.x | `Tecnologias` |
| US 09.x | `Colaboradores` |
| Demais | Buscar plano com nome similar ao módulo pai da wiki |

API: `GET _apis/testplan/plans?api-version=7.1`

### 2. Localizar suite da feature

Listar suites do plano: `GET _apis/testplan/plans/{planId}/suites?api-version=7.1`

Matching fuzzy (case-insensitive) por palavras-chave:

| Feature informada | Suite alvo |
|--|--|
| Carteira de Contratos | `Relatório Carteira de Contratos` |
| Financeiro dos Contratos | `Relatório Financeiro dos Contratos` |
| Roadmap Executivo | `Relatório Roadmap Executivo de Demandas` |

### 3. Criar suites ausentes

**Suite pai não encontrada** → criar sob a suite raiz do plano (`parentSuite.id` = root suite id).

**Suite da feature não encontrada** → criar sob suite pai:

```http
POST _apis/testplan/Plans/{planId}/suites/{parentSuiteId}?api-version=7.1
{
  "suiteType": "staticTestSuite",
  "name": "{nome da feature}",
  "parentSuite": { "id": {parentSuiteId} }
}
```

### 4. Suite de execução (lote do agente)

Quando a **suite da feature já existe**, criar sub-suite para o lote:

```
Cenários — Agent — {DD/MM/AAAA}
```

Sob a suite da feature. Se já existir com o mesmo nome no dia, reutilizar.

Quando a **suite da feature foi criada nesta execução**, adicionar cenários diretamente nela (sem sub-suite extra).

### 5. Publicar Test Cases

1. Criar work item `Test Case` com steps XML + métricas obrigatórias
2. Adicionar à suite: `POST _apis/test/Plans/{planId}/suites/{suiteId}/testcases/{ids}?api-version=7.1`
3. Pular se já existir caso com mesmo `[CN-xx]` no título na suite alvo

## Script

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-scenarios/scripts/publish-test-scenarios.mjs \
  docs/test-scenarios/{feature-slug}/cenarios-de-teste.md
```

Variáveis de ambiente (opcional):

| Variável | Descrição |
|--|--|
| `AZURE_DEVOPS_PAT` | PAT com escopo Test + Work Items (senão lê `.cursor/mcp.json`) |
| `AZURE_DEVOPS_PLAN_ID` | Forçar planId |
| `AZURE_DEVOPS_PARENT_SUITE` | Forçar nome da suite pai |
