# Changelog

## 1.0.0

Primeira versão do plugin.

- Comando `/vint-qa`: preflight de instalações, criação e validação de `.hub-projeto.json` e `.env`, menu clicável e delegação aos agentes
- Configuração por projeto (`.hub-projeto.json` + `.env`): organização, projeto e wiki do Azure DevOps, ambientes, cliente, logo da wiki, dicas de módulos da wiki, planos e suítes do Test Plans, campos customizados do Test Case, prefixo dos títulos das specs e apelidos de domínio da automação
- Suporte a Azure DevOps, GitLab, GitHub, Jira, Linear ou apenas arquivos locais (MCP da plataforma gerado por `vqa sync-mcp`)
- CLI `vqa` (launcher em `~/.vint-qa/vqa.mjs`, instalado pelo hook `sessionStart`)
- RAG local sem dependências (MCP `vint-qa-rag` + `vqa rag`) com aprendizados por projeto e base curada do time
- Correção: `feature-structure.mjs` tinha um erro de sintaxe (faltava `} else`) que impedia a detecção da estrutura de features
