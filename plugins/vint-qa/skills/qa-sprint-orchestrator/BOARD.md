# Boards — Gates do Orquestrador QA

## Configuração do projeto

Valores lidos do `.hub-projeto.json` do projeto aberto (nunca fixos no plugin). Se algum estiver vazio, o `/vint-qa` pede ao usuário antes de executar.

| Config | Chave em `.hub-projeto.json` |
|--|--|
| Organização | `azure.organizacao` |
| Projeto | `azure.projeto` |
| Raiz das iterações (sprints) | `azure.iterationPath` (padrão: nome do projeto) |
| Board | Boards → Sprints (Taskboard da sprint ativa) |

## Hierarquia de work items

```
Product Backlog Item (PBI)          ← feature = System.Title do PBI
├── Task: Requisitos                ← gate: Done
├── Task: UX / UI (ou UI / UX)      ← gate: Done
├── Task: Documentos de Testes      ← trigger: In Progress
├── Task: Back-End
├── Task: Front-End
└── ...
```

## Títulos reconhecidos (fuzzy)

| Papel | Títulos aceitos |
|--|--|
| Documentos de Testes | `Documentos de Testes`, `Documento de Testes`, `Documentos de Teste`, `Documento de Teste` |
| Requisitos | `Requisitos`, `Requisito` |
| UX/UI | `UX / UI`, `UI / UX`, `UX/UI`, `UI/UX` |

## Colunas / estados — gate de execução

| Card | Condição | Campos verificados | Comportamento quando falha |
|--|--|--|--|
| **Documentos de Testes** | Em progresso (obrigatório) | `System.BoardColumn` ou `System.State` | PBI ignorado |
| **Requisitos** | Concluído **se existir** | `System.State` ou `System.BoardColumn` | Encontrado e não-Done → **hard-block** |
| **UX / UI** | Concluído **se existir** | `System.State` ou `System.BoardColumn` | Encontrado e não-Done → **hard-block** |
| **Requisitos** | *(ausente no PBI)* | — | Perguntar ao usuário se deseja continuar |
| **UX / UI** | *(ausente no PBI)* | — | Perguntar ao usuário se deseja continuar |

### Lógica de decisão do orquestrador

```
DocTestes em progresso?
  ├── Não → ignorar PBI
  └── Sim
        ├── Algum card (Requisitos / UX/UI) encontrado e não-Done?
        │     └── Sim → HARD-BLOCK: reportar bloqueador, não executar pipeline
        └── Algum card ausente (não encontrado no PBI)?
              ├── Sim → PERGUNTAR AO USUÁRIO:
              │         "O card {X} não existe neste PBI. Deseja continuar?"
              │           ├── Usuário confirma → prosseguir como elegível
              │           └── Usuário recusa → registrar como bloqueado
              └── Não → ELEGÍVEL: prosseguir normalmente
```

### Saída do script `discover-board-candidates.mjs`

| Campo | Significado |
|--|--|
| `eligible[]` | Todos os gates satisfeitos → pipeline pode iniciar |
| `pendingConfirmation[]` | Cards ausentes → requer confirmação do usuário |
| `blocked[]` | Cards encontrados mas não-Done → hard-block |
| `skipped[]` | Já processados |

### Valores aceitos — Em progresso (Documentos de Testes)

`In Progress`, `Active`, `Doing`, `Em andamento`, `Em Progresso`

### Valores aceitos — Done (Requisitos e UX/UI)

`Done`, `Closed`, `Resolved`, `Complete`, `Concluído`

> Se `System.BoardColumn` estiver vazio, usa-se apenas `System.State`.

## Extração da feature

1. Localizar task **Documentos de Testes** elegível
2. Subir para o PBI pai (`System.Parent` ou link `Hierarchy-Reverse`)
3. Usar `System.Title` do PBI como nome da feature para `/create-test-doc` e `/create-test-scenarios`

Exemplo:

| PBI #1234 | `Implementar Histórico de dados na Funcionalidade de Produtos` |
|--|--|
| Feature para agentes | `Implementar Histórico de dados na Funcionalidade de Produtos` |

## Idempotência

Antes de executar, verificar se o PBI já foi processado:

1. Tag `qa-orchestrator-done` no PBI ou na task Documentos de Testes
2. Ou arquivo local `docs/test-docs/{slug}/documento-de-teste.md` + `docs/test-scenarios/{slug}/cenarios-de-teste.md` gerados na mesma sprint

Pular com status `skipped` se já processado (usar `--force` para reprocessar).

## Pós-execução (opcional)

Após sucesso:
- Comentar no work item Documentos de Testes com links wiki + Test Plan
- Adicionar tag `qa-orchestrator-done`
- Mover task para `Done` (somente se `--mark-done` ou variável `QA_ORCHESTRATOR_MARK_DONE=true`)

## Agentes

| Modo | Agente | Gates desta página |
|--|--|--|
| Automático / cron | `qa-sprint-orchestrator` | **Sim** |
| Sob demanda (feature ou URL wiki) | `qa-sprint-orchestrator-manual` | **Não** — ver [MANUAL.md](MANUAL.md) |

## Script de descoberta

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs
node "$HOME/.vint-qa/vqa.mjs" skills/qa-sprint-orchestrator/scripts/discover-board-candidates.mjs --work-item 1240
```

Variáveis opcionais:

| Variável | Descrição |
|--|--|
| `AZURE_DEVOPS_PAT` | PAT com Work Items Read |
| `QA_SPRINT_ITERATION` | Filtrar sprint específica (ex.: `Sprint 13 (V2)`) |
| `QA_ORCHESTRATOR_MARK_DONE` | `true` para marcar task como Done após pipeline |
