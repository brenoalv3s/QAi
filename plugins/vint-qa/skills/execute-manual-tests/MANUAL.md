# Execução manual — Execute Manual Tests

Rodar testes manuais assistidos **sob demanda**, sem aguardar o schedule automático nem validar gates do board (por padrão).

---

## Quando usar

| Situação | Caminho recomendado |
|----------|---------------------|
| QA quer testar **uma feature agora** | Agente manual ou skill com nome da feature |
| Board ainda não está no gate (Executar Teste In Progress) | Modo manual — sem `--validate-gates` |
| Validar **só alguns cenários** | `--cn CN-01,CN-02` |
| Não mover card/tag no board após execução | `--skip-board` |
| Conferir se o PBI está elegível antes de executar | `--validate-gates` |

Para execução **automática** (cron + gates do board), use o agente `execute-manual-tests` — ver [AUTOMATION.md](AUTOMATION.md).

---

## Caminho A — Chat no Cursor (recomendado)

### Agente dedicado (foreground)

```
@execute-manual-tests-manual Central de Relatórios - Carteira de Contratos
```

Ou delegue: *"Execute os testes manuais da feature X"*.

O agente **pergunta** o nome da feature se não for informado. Em seguida mostra o menu clicável **Em qual ambiente deseja executar os testes manuais?** (ambientes do `.hub-projeto.json`, o `ambientePadrao` recomendado) e só então abre o browser na URL escolhida.

A cada cenário: Mark Outcome (**Passed** / **Failed** / **NotApplicable**), anúncio curto no chat, **preparação de massa** se o CN exigir, **Bug Hunter** (console + network), **Quality Gate** antes de Passed, evidência **GIF** no Test Plans **e no card do PBI**. Docs carregadas **1×** (ficha de validação); ordem **P0→P1→P2**. Olhar crítico: riscos fora do plano viram **ADHOC**. N/A só quando **nenhuma** documentação tratar o cenário — **nunca** por “não tem massa”. Detalhes: [SENIOR-QA.md](SENIOR-QA.md).

### Skill (mesmo fluxo)

```
/execute-manual-tests Central de Relatórios - Carteira de Contratos
```

### Opções

```
/execute-manual-tests {feature} --cn CN-38.1.01,CN-38.1.02
/execute-manual-tests {feature} --validate-gates
/execute-manual-tests {feature} --skip-board
```

---

## Caminho B — Automação sob demanda (Cloud / Agents Window)

Não há prefill próprio. Use a **esteira**:

[`{VINT_QA_ROOT}/automations/qa-sprint-orchestrator-manual.prefill.json`](../../automations/qa-sprint-orchestrator-manual.prefill.json)

No menu, escolha **Executar os testes manuais**. No chat: `@execute-manual-tests-manual {feature}` ou `@qa-sprint-orchestrator-manual {feature}`.

O cron (`execute-manual-tests.prefill.json`) continua sendo o modo automático com gates do board.

---

## Caminho C — Loop local (sem GitHub)

Com Cursor aberto e MCPs locais ativos:

```
/loop 2h /execute-manual-tests Central de Relatórios - Carteira de Contratos
```

Útil para reexecutar a mesma feature periodicamente durante homologação.

---

## Pré-requisitos

| Item | Local |
|------|-------|
| Cenários no Test Plans | `list-feature-scenarios.mjs` |
| Wiki SPEC/US/RN | MCP `azure-devops` |
| UI | MCP `playwright` + `BASE_URL` |
| API | `API_BASE_URL`, `TEST_USER`, `TEST_PASSWORD` |
| Evidências | `docs/test-evidence/{feature-slug}/{cn-id}/` + anexos no PBI |

Guia de massa e postura: [SENIOR-QA.md](SENIOR-QA.md).

```bash
# Listar cenários antes de executar
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/list-feature-scenarios.mjs \
  --feature "Central de Relatórios - Carteira de Contratos" --json
```

---

## Agentes

| Agente | Modo | `is_background` |
|--------|------|-----------------|
| `execute-manual-tests-manual` | Sob demanda — feature obrigatória | `false` (interativo) |
| `execute-manual-tests` | Automático — gates do board + cron | `true` |

Ambos usam a mesma skill: `{VINT_QA_ROOT}/skills/execute-manual-tests/SKILL.md`.

---

## Troubleshooting

| Sintoma | Solução |
|---------|---------|
| Agente pede feature | Informar título exato do PBI / suite no Test Plans |
| Nenhum cenário listado | Verificar publicação com `/create-test-scenarios` |
| Browser não abre | MCP `playwright` local ou secrets `BASE_URL` na cloud |
| Não quero mover o card Executar Teste | Usar `--skip-board` |
| Quer validar gates antes | Usar `--validate-gates` |
