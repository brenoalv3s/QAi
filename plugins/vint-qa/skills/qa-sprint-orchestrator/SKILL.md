---
name: qa-sprint-orchestrator
description: Orquestra a esteira QA. Modo manual: menu clicável (gerar DOC, gerar cenários, testes manuais ou automatizar — não cria DOC/cenários sem o usuário pedir). Modo automático: board + DOC + cenários. Usar com /qa-sprint-orchestrator.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# QA Sprint Orchestrator — Pipeline de documentação de testes

Executa o pipeline completo de QA:

1. **create-test-doc** — gerar DOC + publicar na wiki
2. **create-test-scenarios** — gerar cenários + publicar no Test Plans
3. **Menu da esteira** (modo manual) — o usuário escolhe gerar DOC, gerar cenários, testes manuais, automatizar ou encerrar — [PIPELINE.md](PIPELINE.md)

---

## Modos de execução

| Modo | Como acionar | Agente | Gates |
|--|--|--|--|
| **Manual** | `@qa-sprint-orchestrator-manual` com feature, PBI (nome/ID) ou URL | `qa-sprint-orchestrator-manual` | Nenhum (opcional `--validate-gates`) |
| **Automático** | `/qa-sprint-orchestrator --auto` ou `/qa-sprint-orchestrator` sem feature | `qa-sprint-orchestrator` | Obrigatório — ver [BOARD.md](BOARD.md) |
| **Agendado** | [AUTOMATION.md](AUTOMATION.md) — cron `0 9-18 * * 1-5` | `qa-sprint-orchestrator` | Obrigatório |
| **Sob demanda (cloud)** | [MANUAL.md](MANUAL.md) — prefill sem cron | `qa-sprint-orchestrator-manual` | Opcional |

Guia completo do modo manual: [MANUAL.md](MANUAL.md). Plataformas: [PLATFORM.md](PLATFORM.md).

Plugin **vint-qa** — todos os agentes da esteira. Ponto de entrada: `/vint-qa`.

Esteira (DOC → cenários → menu): [PIPELINE.md](PIPELINE.md).

---

## Quando usar (automático)

- Card **Documentos de Testes** em **In Progress** (ou equivalente)
- Cards **Requisitos** e **UX/UI** em **Done**
- Usuário pede execução automática do pipeline QA da sprint
- Invocação: `/qa-sprint-orchestrator --auto` ou agente `qa-sprint-orchestrator`
- **Automação agendada:** ver [AUTOMATION.md](AUTOMATION.md)

## Quando NÃO executar (automático)

- Cards **encontrados mas não-Done** (Requisitos ou UX/UI): **abortar** e reportar hard-blocker — não gerar DOC nem cenários.
- Cards **ausentes**: perguntar ao usuário antes de prosseguir (ver Passo 0 — Cenário B).
- Usuário informou **nome da feature**, **URL da wiki**, **nome do PBI** ou **ID do PBI**: **não** validar board — delegar a `qa-sprint-orchestrator-manual`.

---

## Passo 0 — Descobrir candidatos

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs --json
```

Ou validar um card específico:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs --work-item {id} --json
```

Interpretar saída JSON:

| Campo | Significado |
|--|--|
| `eligible[]` | PBIs prontos para pipeline (todos os gates satisfeitos) |
| `pendingConfirmation[]` | PBIs com Documentos de Testes em progresso, mas um ou mais cards (Requisitos / UX/UI) **não encontrados** no PBI — requer confirmação do usuário |
| `blocked[]` | Gates hard-blocked: cards **encontrados** mas **não-Done** — não prosseguir |
| `skipped[]` | Já processados (tag `qa-orchestrator-done`) |

Regras de gate: [BOARD.md](BOARD.md)

### Decisão após descoberta

**Cenário A — `eligible` não vazio:** prosseguir normalmente para o Passo 1.

**Cenário B — `pendingConfirmation` não vazio (e `eligible` vazio ou após processar elegíveis):**

Para cada PBI em `pendingConfirmation`, perguntar ao usuário:

> Os cards **{missingCards}** não foram encontrados no PBI #**{pbiId}** — **{feature}**.
> Deseja prosseguir com o pipeline mesmo assim?

- **Usuário confirma ("sim"):** tratar o PBI como elegível e continuar para o Passo 1.
- **Usuário recusa ("não"):** registrar como `blocked` com motivo "Cards ausentes — execução cancelada pelo usuário" e não gerar documentação.

**Cenário C — apenas `blocked` (sem eligible e sem pendingConfirmation):** encerrar com relatório dos hard-blockers — os cards existem mas não estão Done; o time deve mover os cards antes de nova execução.

**Cenário D — tudo vazio:** nenhum candidato encontrado na sprint — encerrar com relatório informativo.

---

## Passo 1 — Para cada candidato elegível

Extrair da saída:

- `feature` — título do PBI (nome da funcionalidade)
- `pbiId`, `docTaskId`
- `iteration`

Processar **um PBI por vez**, em ordem da lista `eligible`.

---

## Passo 2 — Executar create-test-doc

Seguir integralmente `{VINT_QA_ROOT}/skills/create-test-doc/SKILL.md` com `feature` do PBI.

Checklist obrigatório:

1. Pesquisar wiki (SPEC, US, RN, MSG, ALI)
2. Gerar `docs/test-docs/{feature-slug}/documento-de-teste.md`
3. Publicar:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-doc/scripts/publish-test-doc.mjs \
  docs/test-docs/{feature-slug}/documento-de-teste.md
```

**Se publicação falhar:** abortar pipeline deste PBI — não executar create-test-scenarios.

---

## Passo 3 — Executar create-test-scenarios

Seguir integralmente `{VINT_QA_ROOT}/skills/create-test-scenarios/SKILL.md` com a **mesma** `feature`.

Checklist obrigatório:

1. Pesquisar wiki (reutilizar contexto do passo 2 quando possível)
2. Gerar `docs/test-scenarios/{feature-slug}/cenarios-de-teste.md`
3. Publicar:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/create-test-scenarios/scripts/publish-test-scenarios.mjs \
  docs/test-scenarios/{feature-slug}/cenarios-de-teste.md
```

---

## Passo 4 — Pós-processamento

Após sucesso de ambos os passos:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/mark-processed.mjs \
  --pbi {pbiId} \
  --doc-task {docTaskId} \
  --wiki-url "{url}" \
  --test-plan-url "{url}"
```

O script:
- Adiciona tag `qa-orchestrator-done` no PBI e na task Documentos de Testes
- Comenta links do DOC wiki e suite Test Plan
- Opcionalmente move task para `Done` se `QA_ORCHESTRATOR_MARK_DONE=true`

---

## Passo 5 — Relatório consolidado

Para cada PBI processado, informar:

| Item | Detalhe |
|--|--|
| PBI | `#id` — título |
| Gates | ✅ satisfeitos |
| DOC local | caminho |
| DOC wiki | URL + criada/atualizada |
| Cenários | total + categorias |
| Test Plan | plano, suite, URL |
| Publicação | criados / ignorados / abortados |
| Status final | `success` / `blocked` / `skipped` / `failed` |

---

## Delegação via agentes filhos (alternativa)

Quando em modo agente delegável, pode-se usar `Task` sequencialmente:

1. `create-test-doc` com prompt: `Gerar documento de teste para: {feature}`
2. `create-test-scenarios` com prompt: `Gerar cenários de teste para: {feature}`

No modo **automático**, o orquestrador **sempre** valida gates antes de delegar e executa `mark-processed.mjs` ao final.

No modo **manual**, pular gates; `mark-processed.mjs` só com `--mark-processed`. Após identificar a feature: menu da esteira ([PIPELINE.md](PIPELINE.md)) — o usuário escolhe o que executar (DOC/cenários podem já existir).

---

## Regras absolutas

- **Nunca** executar quando cards Requisitos ou UX/UI existem e **não estão Done** (hard-block) — modo automático
- **Sempre perguntar** ao usuário quando algum card não for encontrado no PBI — nunca assumir automaticamente — modo automático
- Feature, URL, nome do PBI ou ID informado → delegar a `qa-sprint-orchestrator-manual` (sem gates)
- Modo **automático:** **nunca** pular create-test-doc e ir direto para cenários
- Modo **manual:** só gerar DOC/cenários se o usuário escolher no menu
- **Nunca** modificar `src/`, `e2e/tests/` ou código de produção
- **Nunca** inventar feature — usar apenas `System.Title` do PBI pai
- Reprocessar somente com `--force` ou remoção da tag `qa-orchestrator-done`
