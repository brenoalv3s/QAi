# Execução manual — Generate Regression Automation

Gerar automação da feature **sob demanda** (Playwright ou Robot), com pasta `e2e/` pronta, `.env` e execução dos testes no final.

---

## Quando usar

| Situação | Caminho recomendado |
|----------|---------------------|
| Automatizar a partir de **URL**, texto ou arquivo | `@generate-regression-automation-manual` + origem |
| Executar Teste ainda **não** está Done | Modo manual — sem `--validate-gates` |
| Só cenários do Test Plans (sem gaps wiki) | `--no-wiki-gaps` |
| Não atualizar Status da Automação no Test Plans | `--skip-mark-done` |
| Conferir elegibilidade antes de gerar | `--validate-gates` |
| Feature fora dos módulos conhecidos (Login, etc.) | `--plan-id <id>` em todos os scripts |
| ID da URL do Test Plans (plan **ou** suite) | `--plan-id 24344` — detecta suite automaticamente |
| Nome da suite ≠ nome da feature | `--suite-id <id>` explícito |

Para execução **automática** (cron + gate Executar Teste Done), use o agente `generate-regression-automation` — ver [AUTOMATION.md](AUTOMATION.md).

---

## Caminho A — Chat no Cursor (recomendado)

### Agente dedicado (foreground)

```
@generate-regression-automation-manual Login do sistema --plan-id 24344
@generate-regression-automation-manual {URL da documentação}
@generate-regression-automation-manual Demandas - Cadastrar
```

O agente lê **`.env` na raiz**. Se não houver URL do sistema, **pergunta**. Se a origem não for Test Plan, gera specs/POMs/fixtures sem os scripts Azure.

Antes de listar o Test Plans: `preflight-mcp.mjs`. Se faltar Playwright/Robot, recarregar os MCPs do plugin vint-qa. Se faltar Azure, pedir org/projeto/PAT.

### Skill (mesmo fluxo)

```
/generate-regression-automation "Login do sistema" --plan-id 24344
/generate-regression-automation Demandas - Cadastrar
```

### Opções

```
/generate-regression-automation {feature} --plan-id {id}
/generate-regression-automation {feature} --plan-id {id} --suite-id {id}
/generate-regression-automation {feature} --validate-gates
/generate-regression-automation {feature} --skip-mark-done
/generate-regression-automation {feature} --no-wiki-gaps
```

---

## Caminho B — Automação sob demanda (Cloud / Agents Window)

Não há prefill próprio. Use a **esteira**:

[`{VINT_QA_ROOT}/automations/qa-sprint-orchestrator-manual.prefill.json`](../../automations/qa-sprint-orchestrator-manual.prefill.json)

No menu, escolha **Automatizar a feature**. No chat: `@generate-regression-automation-manual {feature}` ou `@qa-sprint-orchestrator-manual {feature}`.

O cron (`generate-regression-automation.prefill.json`) continua sendo o modo automático com gates do board.

---

## Caminho C — Loop local (sem GitHub)

Com Cursor aberto e MCPs locais ativos:

```
/loop 1d /generate-regression-automation Demandas - Cadastrar
```

---

## Pré-requisitos

| Item | Local |
|------|-------|
| Cenários no Test Plans (Muito Alta/Alta) | `list-regression-scenarios.mjs` |
| Wiki SPEC/US/RN | MCP `azure-devops` |
| UI / API | `.env` na **raiz do repositório** + MCP `playwright` |
| Código gerado | `e2e/tests/{dominio}/`, `e2e/locators/`, `e2e/pages/`, `e2e/fixtures/main.ts` (ou `e2e/robot/` se Robot) |

```bash
# Listar cenários antes de automatizar
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/list-regression-scenarios.mjs \
  --feature "Login do sistema" --plan-id 24344 --include-wiki-gaps --json
```

---

## Ciclo (1 feature)

1. Resolver origem (Test Plan **ou** URL **ou** texto) + URL do sistema (`.env` raiz)
2. Implementar: locators → data → POM → spec BDD (`fixtures/main`); scaffold Azure só se houver Test Plan
3. `npx tsc --noEmit` + `npx playwright test tests/{dominio}/` — **gate obrigatório**
4. `mark-regression-done.mjs` — só se origem Test Plans, testes verdes e sem `--skip-mark-done`
5. `push-automation-branch.mjs` — só com testes verdes; devolver `createPrUrl` para o QA abrir o PR

---

## Agentes

| Agente | Modo | `is_background` |
|--------|------|-----------------|
| `generate-regression-automation-manual` | Sob demanda — feature obrigatória | `false` (interativo) |
| `generate-regression-automation` | Automático — gates + cron | `true` |

Ambos usam a mesma skill: `{VINT_QA_ROOT}/skills/generate-regression-automation/SKILL.md`.

---

## Troubleshooting

| Sintoma | Solução |
|---------|---------|
| `Não foi possível inferir Test Plan` | Passar `--plan-id <id>` ou definir `AZURE_DEVOPS_PLAN_ID` |
| `Suite da feature não encontrada` | Conferir nome da suite ou usar `--suite-id` |
| Agente pede feature | Informar título exato do PBI / suite no Test Plans |
| Nenhum cenário Muito Alta/Alta | Publicar cenários com `/create-test-scenarios` |
| Testes falham após scaffold | `/heal-test` ou corrigir POM/spec |
| Não quero atualizar Test Plans | Usar `--skip-mark-done` |
| Quer validar gates antes | Usar `--validate-gates` (Executar Teste = Done) |
