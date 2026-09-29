# Automação agendada — QA Sprint Orchestrator

Pipeline automático que roda em horário comercial e executa `create-test-doc` → `create-test-scenarios` quando os gates do board estão satisfeitos.

## Por que o Cursor pede GitHub?

As **Cursor Automations** (agendamento na nuvem) precisam clonar o código de um repositório remoto. O projeto:

- **Não é um repositório Git** (não existe pasta `.git`)
- **Não está no GitHub** nem em outro remote acessível pelo Cursor

Por isso o editor pede para **conectar uma conta GitHub** e selecionar um repositório — sem isso, o agente cloud não tem de onde baixar os scripts e skills.

> **Azure DevOps Repos não substitui GitHub** neste fluxo. O agendamento do Cursor usa GitHub (ou GitLab) como origem do checkout.

### Caminho A — Publicar no GitHub (recomendado para automação cloud)

1. Crie um repositório **privado** no GitHub (ex.: `minha-org/meu-projeto`)
2. Na pasta local, inicialize e envie:

```bash
cd "<pasta-do-projeto>"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SUA-ORG/SEU-PROJETO.git
git push -u origin main
```

3. No Cursor: **Settings → GitHub → Connect** (autorize a org/conta)
4. Na automação, selecione `SUA-ORG/SEU-PROJETO` + branch `main`
5. Configure o secret `AZURE_DEVOPS_PAT` no [Cloud Agent dashboard](https://cursor.com/dashboard?tab=cloud-agents)

**Importante:** não commite `.cursor/mcp.json` se contiver PAT. Adicione ao `.gitignore`:

```
.cursor/mcp.json
e2e/.env
```

### Caminho B — Sem GitHub (execução local)

Se não quiser subir o projeto ao GitHub, use o pipeline **localmente** enquanto o Cursor estiver aberto:

```
/loop 1h /qa-sprint-orchestrator
```

Ou dispare manualmente quando mover o card para In Progress:

```
/qa-sprint-orchestrator
```

O `/loop` roda na sua máquina — não precisa de GitHub, mas exige sessão do Cursor ativa.

---

## Rascunho pronto

Arquivo de prefill: [`{VINT_QA_ROOT}/automations/qa-sprint-orchestrator.prefill.json`](../../automations/qa-sprint-orchestrator.prefill.json)

## Configuração no Cursor (Agents Window)

1. Abra **Cursor → Automations** (Agents Window)
2. Clique em **Create automation**
3. Importe ou copie os valores do arquivo `qa-sprint-orchestrator.prefill.json`
4. Ajuste os campos marcados abaixo
5. Salve e ative a automação

## Campos a configurar no editor

| Campo | Valor sugerido | Obrigatório |
|--|--|--|
| **Repositório** | Repositório do projeto | Sim |
| **Branch** | `main` ou branch padrão do repo | Sim |
| **Agendamento** | `0 9-18 * * 1-5` — a cada hora, 9h–18h, seg–sex | Sim |
| **Secret `AZURE_DEVOPS_PAT`** | PAT com permissão Work Items + Wiki + Test Plans | Sim |
| **MCP Azure DevOps** | Conectar no dashboard Cursor (se disponível) | Recomendado |

> O agendamento usa cron sem timezone explícito. Ajuste o horário no picker do editor conforme seu fuso (ex.: BRT = UTC−3).

**Sob demanda (sem cron, sem gates):** [MANUAL.md](MANUAL.md) e `{VINT_QA_ROOT}/automations/qa-sprint-orchestrator-manual.prefill.json`.

## Pré-requisitos

### 1. Secret do Azure DevOps

No [Cloud Agent dashboard](https://cursor.com/dashboard?tab=cloud-agents), adicione:

```
AZURE_DEVOPS_PAT = <seu PAT>
```

O PAT precisa de acesso a:
- Work Items (ler/atualizar)
- Wiki (ler/escrever)
- Test Plans (criar test cases)

### 2. Repositório

A automação precisa do checkout deste projeto para acessar:
- Scripts em `{VINT_QA_ROOT}/skills/qa-sprint-orchestrator/scripts/`
- Skills `create-test-doc` e `create-test-scenarios`
- Templates em `docs/test-docs/` e `docs/test-scenarios/`

### 3. MCP Azure DevOps (opcional mas recomendado)

O MCP local do projeto (`azure-devops`) **não** é elegível para prefill no editor de automações. Configure o servidor Azure DevOps no **dashboard Cursor** (Integrations → MCP) para o agente cloud acessar wiki e Test Plans via MCP.

Se o MCP não estiver disponível no cloud, os scripts `publish-*.mjs` ainda funcionam via REST API usando `AZURE_DEVOPS_PAT`.

## Comportamento em cada execução

```
Cron dispara
    ↓
discover-board-candidates.mjs --json
    ↓
eligible vazio? → relatório de bloqueios, encerra
    ↓
Para cada PBI elegível:
    create-test-doc → publish-test-doc.mjs → wiki
    create-test-scenarios → publish-test-scenarios.mjs → Test Plans
    mark-processed.mjs → tag + comentário
```

## Ajustar frequência

| Necessidade | Cron |
|--|--|
| A cada hora (horário comercial) | `0 9-18 * * 1-5` |
| 2× ao dia (9h e 15h) | `0 9,15 * * 1-5` |
| 1× ao dia (9h) | `0 9 * * 1-5` |
| A cada 30 min (horário comercial) | `*/30 9-18 * * 1-5` |

## Variáveis opcionais

| Variável | Efeito |
|--|--|
| `QA_SPRINT_ITERATION` | Limita busca a uma sprint (ex.: `Sprint 13 (V2)`) |
| `QA_ORCHESTRATOR_MARK_DONE` | `true` → move card Documentos de Testes para Done após sucesso |

## Teste manual antes de ativar

```bash
# Ver candidatos sem executar pipeline
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs

# Validar um card específico
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs --work-item 25867

# Executar pipeline manualmente
/qa-sprint-orchestrator
```

## Troubleshooting

| Sintoma | Causa provável | Ação |
|--|--|--|
| **Pede conectar GitHub** | Projeto local sem `.git` / sem remote | Caminho A (publicar no GitHub) ou Caminho B (`/loop` local) |
| Repositório não aparece na lista | GitHub não conectado ou repo privado sem permissão | Conectar conta + autorizar org no Cursor |
| Nenhum candidato elegível | Cards não nas colunas certas | Mover Documentos de Testes → In Progress; Requisitos e UX/UI → Done |
| PAT inválido | Secret ausente ou expirado | Renovar PAT no dashboard |
| Publicação wiki falha | Path DOC não resolvido | Verificar metadados no `.md` gerado |
| Reprocessamento | Tag `qa-orchestrator-done` | Remover tag no PBI para reprocessar |
