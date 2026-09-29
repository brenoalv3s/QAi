# Automação agendada — Generate Regression Automation

Gera automação Playwright quando o card **Executar Teste** está **Done** (execução manual concluída).

## Rascunho pronto

[`{VINT_QA_ROOT}/automations/generate-regression-automation.prefill.json`](../../automations/generate-regression-automation.prefill.json)

---

## Pré-requisito: repositório no GitHub

Igual aos outros agentes — Cursor Automations precisam de repo GitHub. Ver `execute-manual-tests/AUTOMATION.md` para setup.

---

## Passo a passo no editor

| Campo | Valor |
|-------|-------|
| **Name** | `Generate Regression Automation — Automático` |
| **Description** | Campo `description` do JSON |
| **Trigger** | `0 18 * * 1-5` (18h, seg–sex — após janela de testes manuais) |
| **Repository** | `SUA-ORG/SEU-PROJETO` |
| **Branch** | `main` |
| **Agent Instructions** | Somente `workflow.prompts[0].prompt` |

### Secrets

| Secret | Obrigatório |
|--------|-------------|
| `AZURE_DEVOPS_PAT` | Sim |
| `BASE_URL` / `BASE_URL` | Sim (Playwright UI) |
| `API_BASE_URL` | Recomendado (Playwright API) |
| `TEST_USER` / `TEST_USER` | Sim |
| `TEST_PASSWORD` / `TEST_PASSWORD` | Sim |

---

## Pipeline na sprint

```
qa-sprint-orchestrator     → DOC + cenários (Executar Teste ainda não iniciado)
execute-manual-tests       → Executar Teste In Progress → Passed/Failed
generate-regression-automation → Executar Teste Done → Playwright regressivo
```

---

## Gates

| Card | Estado |
|------|--------|
| **Executar Teste** | **Done** |
| Tag `qa-regression-automation-done` | Ausente — usar **Status da Automação** no Test Case |

---

## Ajustar frequência

| Necessidade | Cron |
|-------------|------|
| 1× ao dia (18h, padrão) | `0 18 * * 1-5` |
| 2× ao dia | `0 12,18 * * 1-5` |
| Após cada ciclo manual | `0 9,12,15,18 * * 1-5` |

---

## Execução manual (sob demanda)

Para rodar **uma feature** sem cron nem gates do board, use a esteira ou o agente no chat — ver [MANUAL.md](MANUAL.md).

| Recurso | Caminho |
|---------|---------|
| Esteira (cloud) | `qa-sprint-orchestrator-manual.prefill.json` → menu **Automatizar a feature** |
| Agente | `generate-regression-automation-manual` |
| Chat | `@generate-regression-automation-manual {feature}` |

## Teste antes de ativar o cron

```bash
# Verificar gates (modo automático)
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/discover-regression-candidates.mjs

# Automatizar uma feature sob demanda
@generate-regression-automation-manual Gerar Relatório Carteira de Contratos
```

---

## Execução local (sem GitHub)

```
/loop 1d /generate-regression-automation --auto
@generate-regression-automation-manual Demandas - Cadastrar
```
