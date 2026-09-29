# Métricas QA — Mapeamento para Azure Test Plans

Campos **obrigatórios** no work item `Test Case` do projeto (IDs dos campos em `azure.camposTestCase` do `.hub-projeto.json`). O agente **não deve criar** o cenário no Test Plan se qualquer métrica estiver ausente ou sem mapeamento.

## Campos no Azure DevOps

| Campo template | `referenceName` no Test Case | Obrigatório API |
|--|--|--|
| Criticidade | `Custom.Criticidade` | Sim (`alwaysRequired`) |
| Estratégia Técnica | `Custom.e3b1ecaf-933e-421c-9e1e-cfb8311b4b16` | Sim (`alwaysRequired`) |
| Status da Automação | `Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b` | Sim (regra do projeto QA) |

## Valores permitidos (picklist)

### Criticidade

| Template `.md` | Valor Test Plan |
|--|--|
| Muito Alta | `1. Muito Alta` |
| Alta | `2. Alta` |
| Média | `3. Média` |
| Baixa | `4. Baixa` |

### Estratégia Técnica

| Template `.md` | Valor Test Plan |
|--|--|
| API | `1. API` |
| UI | `2. UI` |
| API+UI | `5. API + UI` |
| UI + BD (SQL) | `5. API + UI` (mapeamento mais próximo — picklist sem opção UI+BD) |

### Status da Automação

| Template `.md` | Valor Test Plan |
|--|--|
| Planejado | `2. Planejado` |
| Concluído | `1. Concluído` |
| Não Automatizado | `3. Não Automatizado` |
| Não se Aplica | `4. Não se Aplica` |

## Extração do `.md`

Na tabela **Informações de Gestão e Técnica (Métrica QA)**, extrair o valor antes do `—`:

```markdown
| **Criticidade** | Muito Alta — caminho feliz |
| **Estratégia Técnica** | UI — validação na tela |
| **Status da Automação** | Planejado |
```

## Validação pré-publicação

Antes de `create_work_item` / API:

```
✗ Criticidade vazia ou não mapeada → ABORTAR cenário
✗ Estratégia Técnica vazia ou não mapeada → ABORTAR cenário
✗ Status da Automação vazio ou não mapeado → ABORTAR cenário
```

Registrar cenários abortados no relatório final com motivo.
