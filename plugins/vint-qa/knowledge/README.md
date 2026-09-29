# Base de conhecimento do vint-qa

Esta pasta é a **camada de conhecimento compartilhada do time**. Ela é indexada pelo RAG (`vint-qa-rag`) junto com as skills, rules e agentes do plugin e com o conteúdo de cada projeto.

## Como os agentes "aprendem"

O plugin não treina pesos de modelo. O comportamento melhora em três camadas, todas em texto versionado:

| Camada | Onde | Quem alimenta | Alcance |
|--------|------|---------------|---------|
| Instruções | `agents/`, `skills/`, `rules/` | Mantenedores do plugin (pull request) | Todos os projetos |
| Conhecimento curado | `knowledge/` (esta pasta) | Aprendizados promovidos dos projetos (pull request) | Todos os projetos |
| Aprendizados do projeto | `.vint-qa/learnings/*.md` no repositório do projeto | Agentes e QAs durante o trabalho (`rag_add_learning`) | Só aquele projeto |

Fluxo:

1. Durante uma execução, o agente descobre algo reutilizável (locator estável, regra implícita, instabilidade de ambiente) e registra com `rag_add_learning` → vira um arquivo em `.vint-qa/learnings/` do projeto, versionado junto com o código.
2. Nas próximas execuções, os agentes consultam `rag_search` antes de agir e reutilizam o aprendizado.
3. Quando um aprendizado vale para **qualquer** projeto, ele é promovido para cá via pull request (skill `vint-qa-rag` → "Promover ao plugin"). Depois do merge e do refresh do marketplace, todo o time passa a usar.

## Organização

| Arquivo / pasta | Conteúdo |
|-----------------|----------|
| `troubleshooting.md` | Falhas comuns da esteira e como resolver |
| `heuristicas-qa.md` | Heurísticas de teste usadas na execução manual e na geração de cenários |
| `learnings/` | Aprendizados promovidos dos projetos (um arquivo por aprendizado, formato de `learnings/_modelo.md`) |

## Regras para contribuir

- Um assunto por arquivo; título específico ("Drawer do Ant Design fecha ao pressionar Esc antes do save" e não "Dica de drawer")
- Nada de segredos, URLs internas de clientes, dados pessoais ou massa real
- Escrever o **contexto**, o **sintoma** e **como aplicar** — o agente precisa saber quando o aprendizado vale
- Revisar se o conteúdo não contradiz uma rule; se contradiz, a rule deve ser atualizada no mesmo pull request
