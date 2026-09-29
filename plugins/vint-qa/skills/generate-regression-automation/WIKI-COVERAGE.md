# Cobertura ampliada — Wiki + Test Plans

O agente `generate-regression-automation` automatiza cenários de **Muito Alta** e **Alta** de duas fontes:

1. **Test Plans** — cenários formais com CN e métricas QA
2. **Wiki / documentação** — requisitos (SPEC, US, RN, MSG, ALI) e `docs/test-scenarios/` local que revelam lacunas não previstas no Test Plans

Objetivo: **maximizar cobertura regressiva** sem reduzir criticidade.

---

## Quando analisar a wiki

**Sempre** no Passo 1, após listar cenários do Test Plans — **antes** do scaffold.

Ordem recomendada:

1. MCP `search_wiki` + `get_wiki_page` (somente leitura)
2. `list-regression-scenarios.mjs --include-wiki-gaps`
3. `analyze-wiki-coverage-gaps.mjs` — relatório detalhado de gaps
4. MCP `search_wiki` + `get_wiki_page` (**somente leitura**) — complementar se wiki local estiver vazia

---

## Fontes consultadas (automático)

| Fonte | Caminho | O que extrai |
|-------|---------|--------------|
| Cenários locais | `docs/test-scenarios/{dominio}/cenarios-de-teste.md` | CNs Muito Alta/Alta ausentes no Test Plans |
| Wiki sincronizada | `e2e/docs/wiki/**/*.md` | RN, US, MSA (acesso), critérios C.1 |
| Documento de teste | `docs/test-docs/{dominio}/documento-de-teste.md` | Contexto e referências |
| Azure DevOps MCP | `search_wiki`, `get_wiki_page` | SPEC, US, RN, MSG, ALI em tempo real |

---

## O que vira cenário automatizável (wiki)

Somente itens com criticidade inferida **Muito Alta** ou **Alta**:

| Origem wiki | Criticidade | Exemplo |
|-------------|-------------|---------|
| US / caminho feliz / C.1 | Muito Alta | Fluxo principal da US |
| RN_xx | Alta | Regra de negócio documentada |
| MSA (acesso/permissão) | Alta | Bloqueio sem perfil |
| CN no `.md` local não publicado no Test Plans | Conforme métrica do .md | Gap de publicação |

**Ignorados** (não automatizar neste agente): validações de campo (Média), mensagens toast genéricas (Média), estados UI Baixa.

---

## Identificação de gaps

Um gap existe quando:

- `RN_xx` / `US x.x` / `MSA_xx` (acesso) aparece na wiki **e não** em título/steps de nenhum cenário Muito Alta/Alta do Test Plans; **ou**
- `[CN-xx]` com Muito Alta/Alta existe em `docs/test-scenarios/` mas **não** na suite do Test Plans

Cenários wiki recebem ID sintético `WIKI-RN15`, `WIKI-US-09-1`, etc.

---

## Comandos

```bash
# Lista unificada (Test Plans + gaps wiki)
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/list-regression-scenarios.mjs \
  --feature "Demandas - Cadastrar" --include-wiki-gaps --json

# Relatório detalhado de gaps
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/analyze-wiki-coverage-gaps.mjs \
  --feature "Demandas - Cadastrar" --json

# Scaffold incluindo cenários wiki
node "$HOME/.vint-qa/vqa.mjs" skills/generate-regression-automation/scripts/scaffold-regression.mjs \
  --feature "Demandas - Cadastrar" --include-wiki-gaps
```

---

## Papel do agente (análise qualitativa)

O script cobre matching por referências (RN/US/CN). O agente deve **complementar** com leitura semântica da wiki via MCP:

1. Buscar `{feature} SPEC`, `{feature} US`, `Regra-de-negócio`, `Mensagens`
2. Cruzar critérios **C.x** da US com cenários já listados
3. Identificar fluxos críticos descritos na SPEC sem CN/RN explícito
4. Propor cenários adicionais **somente** se criticidade for Muito Alta ou Alta
5. Documentar no relatório final: `wikiGapScenarios[]` implementados

**Proibido** inventar RNs ou mensagens ausentes na wiki — mesma regra de `create-test-scenarios`.

**Proibido** alterar páginas da wiki (Azure ou local), cenários no Test Plans, PBI ou cards — ver [READONLY-POLICY.md](READONLY-POLICY.md).

---

## Implementação e mark-regression-done

| Origem | Spec Playwright | Status no Test Plans |
|--------|-----------------|----------------------|
| Test Plans (`CN-xx`) | Sim | `mark-regression-done.mjs --cn-ids CN-xx` |
| Wiki gap (`WIKI-*`) | Sim | Não atualiza Test Case (inexistente); registrar **apenas no relatório do agente** |
| Local `.md` não publicado (`CN-xx`) | Sim | Atualizar Status da Automação **somente** se CN existir no Test Plans |

---

## Relatório final — seção obrigatória

Incluir:

- Cenários do Test Plans automatizados (CN + IDs)
- Cenários wiki/docs adicionais (`WIKI-*` ou CN local) — título, referência wiki, arquivo spec
- Referências wiki ainda sem automação (se houver) e motivo
- Fontes consultadas (`sourcesConsulted`)
