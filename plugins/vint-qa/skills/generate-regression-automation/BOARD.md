# Board — Gates para automação regressiva

O agente `generate-regression-automation` dispara **após** a execução manual dos testes, quando o card **Executar Teste** está **Done**.

## Modo automático (schedule)

| Card / condição | Estado exigido |
|-----------------|----------------|
| **Executar Teste** | **Done** (Closed / Concluído / coluna Done) |
| PBI pai | Identificável via hierarquia da task |
| **Status da Automação** (Test Plans) | Ao menos 1 cenário Muito Alta/Alta com valor **Planejado** (ou vazio) |
| **Por execução** | **1 PBI** (`eligible[0]`) — nunca lote |

> Diferente de `execute-manual-tests`, que exige **Executar Teste em In Progress**.

Ignorado (`skipped`) quando **todos** os cenários Muito Alta/Alta da feature já estão com **Status da Automação = Concluído**.

## Gate de qualidade (antes de finalizar)

| Condição | Obrigatório |
|----------|-------------|
| Implementação sem `// TODO` | Sim |
| `npx playwright test tests/{dominio}/` | Exit code 0 |
| Falhas | Corrigir via `/heal-test` e reexecutar — **não** atualizar Test Plans |
| Finalização | `mark-regression-done.mjs --feature` → **Concluído** nos Test Cases |

## Modo manual

Usuário informa a feature — **sem gates obrigatórios**.

Agente: `generate-regression-automation-manual` · Guia: [MANUAL.md](MANUAL.md)

```
@generate-regression-automation-manual Pedidos - Cadastrar
/generate-regression-automation Pedidos - Cadastrar --skip-mark-done
```

Opcional: `--validate-gates` | `--skip-mark-done` | `--no-wiki-gaps`

**Cobertura wiki:** o agente também analisa SPEC/US/RN da wiki e `docs/test-scenarios/` para automatizar cenários Muito Alta/Alta não previstos no Test Plans. Ver [WIKI-COVERAGE.md](WIKI-COVERAGE.md).

## Fluxo na sprint

```
Documentos de Testes (In Progress)
    → qa-sprint-orchestrator → DOC + Cenários no Test Plans

Executar Teste (In Progress)
    → execute-manual-tests → Passed/Failed + Bugs

Executar Teste (Done)
    → generate-regression-automation → Playwright UI + API
    → Status da Automação = Concluído (por cenário no Test Plans)
```

## Idempotência — métrica QA (não tag)

Após automação com testes verdes:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/mark-regression-done.mjs \
  --feature "{feature}" \
  --cn-ids "CN-01,CN-02" \
  --summary "Automação regressiva: {N} cenários — testes OK"
```

| Campo | Valor |
|-------|-------|
| `Custom.757c52eb-8ac8-4e4d-985e-e662c5adc29b` (Status da Automação) | `1. Concluído` |

Aplicado em cada **Test Case** automatizado.

**Somente leitura** em todo o resto: wiki, steps/criticidade dos cenários, PBI, card Executar Teste, tasks — sem comentários nem tags. Ver [READONLY-POLICY.md](READONLY-POLICY.md).

## Descobrir candidatos

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/discover-regression-candidates.mjs --json
```

| Campo JSON | Significado |
|------------|-------------|
| `eligible[]` | PBIs com cenários pendentes de automação (Status = Planejado) |
| `eligible[].automationSummary` | `{ totalHighCriticity, pending, concluido, pendingCnIds }` |
| `blocked[]` | Executar Teste ainda não Done ou suite inválida |
| `skipped[]` | Todos os cenários Muito Alta/Alta já **Concluídos** na automação |
