# Boards — Gates do Execute Manual Tests

## Hierarquia

```
Product Backlog Item (PBI)     ← feature = System.Title
├── Task: Requisitos           ← Done
├── Task: UX / UI              ← Done
├── Task: Documentos de Testes  ← Done
├── Task: Back-End             ← Done
├── Task: Front-End            ← Done
├── Task: Executar Teste       ← trigger: In Progress
└── ...
```

## Gate automático

O agente **só executa automaticamente** quando:

| Condição | Detalhe |
|--|--|
| **Executar Teste** em progresso | `In Progress`, `Active`, `Doing`, `Em andamento` |
| **Todos os demais cards** Done | Requisitos, UX/UI, Documentos de Testes, Back, Front, etc. |
| **Nenhum card em coluna anterior** | Nada em `To Do`, `New`, `Backlog`, `Blocked` |

### Títulos reconhecidos — Executar Teste

`Executar Teste`, `Executar Testes`, `Execução de Testes`, `Execução Testes`

## Modo manual

Usuário informa o nome da feature — **não valida gates** (a menos que `--validate-gates`).

Agente: `execute-manual-tests-manual` · Guia: [MANUAL.md](MANUAL.md)

```
@execute-manual-tests-manual Gerar Relatório de Vendas
/execute-manual-tests Gerar Relatório de Vendas --skip-board
```

## Idempotência

Tag `qa-manual-tests-done` no PBI ou task Executar Teste → pular (`skipped`).

## Script de descoberta

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/discover-execute-candidates.mjs --json
```
