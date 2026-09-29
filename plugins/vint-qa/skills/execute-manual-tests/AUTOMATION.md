# Automação agendada — Execute Manual Tests

Executa o agente `execute-manual-tests` automaticamente quando o card **Executar Teste** está em progresso e os demais cards do PBI estão Done.

## Rascunho pronto

[`{VINT_QA_ROOT}/automations/execute-manual-tests.prefill.json`](../../automations/execute-manual-tests.prefill.json)

---

## Pré-requisito: repositório no GitHub

As Cursor Automations (nuvem) precisam clonar o código de um repositório GitHub/GitLab.

Se o projeto ainda é pasta local sem `.git`, publique primeiro:

```bash
cd "<pasta-do-projeto>"
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SUA-ORG/SEU-PROJETO.git
git push -u origin main
```

No Cursor: **Settings → GitHub → Connect**

> `.cursor/mcp.json` já está no `.gitignore` — o PAT não vai para o GitHub.

---

## Passo a passo no editor de Automations

### 1. Abrir o editor

**Agents Window → Automations → Create automation**

### 2. Preencher cada campo (não cole o JSON inteiro em Agent Instructions)

| Campo no editor | Valor do prefill |
|--|--|
| **Name** | `Execute Manual Tests — Automático` |
| **Description** | Texto do campo `description` no JSON |
| **Trigger / Schedule** | `0 9,11,13,15,17 * * 1-5` (5× ao dia, seg–sex) |
| **Repository** | `SUA-ORG/SEU-PROJETO` |
| **Branch** | `main` |
| **Agent Instructions** | **Somente** o texto de `workflow.prompts[0].prompt` |

### 3. Secrets no Cloud Agent dashboard

[cursor.com/dashboard → Cloud Agents → Secrets](https://cursor.com/dashboard?tab=cloud-agents)

| Secret | Obrigatório | Descrição |
|--|--|--|
| `AZURE_DEVOPS_PAT` | Sim | Work Items + Test Plans + Wiki |
| `BASE_URL` | Sim | URL HML da aplicação (ex.: `https://hml.sgd...`) |
| `API_BASE_URL` | Recomendado | Base da API (padrão: `BASE_URL`) |
| `TEST_USER` | Sim | Login — usado em `/api/auth/login` e UI |
| `TEST_PASSWORD` | Sim | Senha — usado em `/api/auth/login` e UI |
| `AUTH_BODY_FORMAT` | Opcional | `email` (padrão) ou `usuario` |
| `SWAGGER_URL` | Opcional | UI Swagger (padrão: `{base}/swagger`) |

### 4. Salvar e ativar

Ative a automação após configurar repositório e secrets.

---

## O que dispara a execução

```
Cron (9h, 11h, 13h, 15h, 17h — dias úteis)
    ↓
discover-execute-candidates.mjs
    ↓
Executar Teste em In Progress + demais cards Done?
    ↓ Não → relatório de bloqueios, encerra
    ↓ Sim
list-feature-scenarios → start-test-run
    ↓
Por estratégia: UI (browser) | API (Swagger) | API+UI (ambos)
    ↓
Passed + evidência  |  Failed + Bug (Template Bug.pdf)
    ↓
mark-execution-done
```

---

## Gates do board (automático)

| Card | Estado exigido |
|--|--|
| **Executar Teste** | In Progress |
| **Todos os outros** (Requisitos, UX/UI, Doc, Back, Front…) | Done |
| **Nenhum card** | Em To Do / colunas anteriores |

---

## Ajustar frequência

| Necessidade | Cron |
|--|--|
| 5× ao dia (padrão) | `0 9,11,13,15,17 * * 1-5` |
| A cada hora (comercial) | `0 9-18 * * 1-5` |
| 2× ao dia | `0 9,15 * * 1-5` |
| 1× ao dia (9h) | `0 9 * * 1-5` |

---

## Limitação importante: browser MCP na nuvem

O agente precisa do **browser MCP** para simular o QA clicando na aplicação.

- O MCP local `cursor-ide-browser` **não** roda automaticamente na automação cloud
- Para execução **completa** (UI real + screenshots), use uma destas opções:

### Opção A — Automação cloud + browser no dashboard Cursor

Configure o browser MCP / integração de browser no [dashboard Cursor](https://cursor.com/dashboard) se disponível para Cloud Agents.

### Opção B — Execução local com `/loop` (sem GitHub)

Com o Cursor aberto na sua máquina:

```
/loop 2h /execute-manual-tests --auto
```

Roda localmente com browser MCP — não precisa de GitHub.

### Opção C — Híbrido

Automação cloud só valida gates e lista cenários elegíveis; execução UI fica no `/loop` local.

---

## Execução manual (sob demanda)

Para rodar **uma feature** sem cron nem gates do board, use a esteira ou o agente no chat — ver [MANUAL.md](MANUAL.md).

| Recurso | Caminho |
|---------|---------|
| Esteira (cloud) | `qa-sprint-orchestrator-manual.prefill.json` → menu **Executar os testes manuais** |
| Agente | `execute-manual-tests-manual` |
| Chat | `@execute-manual-tests-manual {feature}` |

## Teste antes de ativar o cron

```bash
# Verificar gates (modo automático)
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/discover-execute-candidates.mjs

# Executar uma feature sob demanda
@execute-manual-tests-manual Gerar Relatório Carteira de Contratos
```

---

## Troubleshooting

| Sintoma | Solução |
|--|--|
| Pede GitHub | Publicar repo e conectar conta |
| Nenhum candidato elegível | Mover Executar Teste → In Progress; demais → Done |
| Sem browser na cloud | Usar `/loop` local ou configurar MCP no dashboard |
| PAT inválido | Renovar secret `AZURE_DEVOPS_PAT` |
| Login falha | Verificar `BASE_URL`, `TEST_USER`, `TEST_PASSWORD` |
