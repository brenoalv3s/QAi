# Template — Documento de Teste (Wiki Azure DevOps)

> **Referência canônica:** documentos publicados em `{azure.wikiDocumentosTeste}` na wiki do projeto (`azure.wiki`).
> O agente **não deve alterar** a estrutura abaixo — apenas preencher os valores entre colchetes ou substituí-los por conteúdo real.

---

## Estrutura obrigatória do documento gerado

O arquivo `.md` de saída deve conter **exatamente** estas seções, nesta ordem, com estes títulos e formatação:

```markdown
{azure.wikiLogo}
<table>
<tr></th>
<td><b>Número do projeto </b> [Número do Projeto] </td>
<td><b>Cliente: </b> [Cliente] </td>
<td><b>Versão: </b> [Versão] </td>
<td><b>Data: </b>[DD/MM/AAAA] </td>
</tr>
</table>

[[_TOC_]]

**Funcionalidade:** [Nome da feature]
**US de referência:** [US XX.X — título]
**Wiki (DOC):** [DOC XX.X - Título conforme pasta na wiki]

# 1. Análise de Escopo e Objetivos
---

**Objetivo Principal:** 

[Parágrafo com resumo da meta da validação]

**Em Escopo:**
*   **[Tópico 1]:** [Descrição do que será validado]
*   **[Tópico 2]:** [Descrição do que será validado]
    
**Fora de Escopo (Limites do Teste):**
*   **[Limite 1]:** [O que não será validado nesta rodada]
*   **[Limite 2]:** [O que não será validado nesta rodada]
    

# 2. Análise de Risco e Pontos de Atenção (QA)
---

| **Risco Identificado** | **Impacto (Alto/Médio/Baixo)** | **Mitigação / Ação Requerida** |
| --- | --- | --- |
| **[Título do risco]:** [Descrição do risco] | **[Alto]** | **Ação (QA):** [Mitigação] |
| **[Título do risco]:** [Descrição do risco] | **[Médio]** | **Ação (QA):** [Mitigação] |

# 3. Estratégia e Cobertura de Teste
---

**Abordagem Geral:** 

[Parágrafo descrevendo tipos de teste e foco principal]

**Frentes de Cobertura:**
*   **Cobertura de Funcionalidade (UI/Fluxo):**
    *   [Item de cobertura de tela/fluxo]
    *   [Item de cobertura de tela/fluxo]
        
*   **Cobertura de Integração (Dados):**
    *   [Item de cobertura de backend/BD/ALI]
        
*   **Cobertura de Segurança:**
    *   [Item de controle de acesso, BOLA, permissões — omitir bloco inteiro se não aplicável]
        
*   **Cobertura de Regressão:**
    *   [Módulos adjacentes que podem quebrar — omitir bloco inteiro se não aplicável]
        
**Casos de Teste (Azure DevOps):**
*   [Link do Azure Test Plans: US XX.X - Nome da funcionalidade]
    

# 4. Critérios de Aceite de QA (Definição de "Pronto")
---

*   [ ] [Critério 1 — verificável e objetivo]
*   [ ] [Critério 2 — verificável e objetivo]
*   [ ] [Critério 3 — verificável e objetivo]
*   [ ] [Critério 4 — verificável e objetivo]
*   [ ] [Critério 5 — verificável e objetivo]
```

---

## O que cada seção deve conter (guia de preenchimento)

> Texto abaixo é **orientação para o agente**. **Não incluir** estes parágrafos no documento final.

### Cabeçalho (logo + tabela HTML + TOC)

| Campo | Fonte / regra |
|--|--|
| Logo | Valor de `azure.wikiLogo` do `.hub-projeto.json` (Markdown da imagem já anexada na wiki). Se vazio, omitir a linha da logo |
| Número do projeto | Nome do projeto Azure DevOps (`azure.projeto` do `.hub-projeto.json`) |
| Cliente | Nome do cliente do projeto; senão `VINT GLOBAL` se constar na wiki |
| Versão | Versão da US/SPEC ou `1.0` se não houver |
| Data | Data atual no formato `DD/MM/AAAA` |
| TOC | Sempre incluir `[[_TOC_]]` após a tabela HTML |

**Não** incluir título `# {Feature} — Documento de Teste` — o nome da feature fica implícito no caminho do arquivo e no Test Plan.

### Seção 1 — Análise de Escopo e Objetivos

- Título: `# 1.` (H1, não `##`)
- Separador `---` imediatamente após o título
- **Objetivo Principal:** em negrito, seguido de linha em branco e parágrafo (não bullet)
- **Em Escopo:** lista com `*   **[Tópico]:** descrição` — agrupar por área funcional (campos, botões, RNs, mensagens)
- **Fora de Escopo (Limites do Teste):** mesmo formato de lista; referenciar US/RNs de outros módulos quando aplicável

### Seção 2 — Análise de Risco e Pontos de Atenção (QA)

- Título: `# 2.` com `---` abaixo
- Tabela GFM com separador `| --- | --- | --- |`
- Cabeçalhos em negrito: `**Risco Identificado**`, `**Impacto (Alto/Médio/Baixo)**`, `**Mitigação / Ação Requerida**`
- Cada risco: título em negrito no início da célula (`**Erro de X:** descrição`)
- Impacto entre colchetes: `[Alto]`, `[Médio]`, `[Baixo]` ou `[Crítico]` quando aplicável
- Mitigação sempre prefixada com `**Ação (QA):**`
- Mínimo **2 linhas** de risco

### Seção 3 — Estratégia e Cobertura de Teste

- Título: `# 3.` com `---` abaixo
- **Abordagem Geral:** parágrafo descritivo (manual, exploratório, E2E Playwright, etc.)
- **Frentes de Cobertura:** blocos obrigatórios:
  - `Cobertura de Funcionalidade (UI/Fluxo)` — sempre presente
  - `Cobertura de Integração (Dados)` — sempre presente
  - `Cobertura de Segurança` — quando houver controle de acesso, BOLA ou permissões
  - `Cobertura de Regressão` — quando houver módulos adjacentes impactados
- Sub-itens indentados com `    *   ` (4 espaços + asterisco)
- **Casos de Teste (Azure DevOps):** link ou placeholder `[Link do Azure Test Plans: US XX.X - Nome]`

### Seção 4 — Critérios de Aceite de QA

- Título: `# 4.` com `---` abaixo
- Checklist com `*   [ ]` (asterisco + 3 espaços + checkbox) — **não** usar `- [ ]`
- Mínimo **4 itens**; preferir 5–6 itens verificáveis
- Incluir critérios de acesso, dados, mensagens e bugs P0/P1 quando aplicável

---

## Formatação — padrão wiki Azure DevOps do projeto

### Cabeçalho: tabela HTML (obrigatório)

O cabeçalho do documento usa **HTML**, não Markdown:

```html
<table>
<tr></th>
<td><b>Número do projeto </b> {azure.projeto} </td>
<td><b>Cliente: </b> VINT GLOBAL</td>
<td><b>Versão: </b> 1.0 </td>
<td><b>Data: </b>06/06/2026 </td>
</tr>
</table>
```

### Tabela de riscos: separador GFM (obrigatório)

A tabela de riscos da seção 2 usa separador GFM `| --- |`:

```
| **Risco Identificado** | **Impacto (Alto/Médio/Baixo)** | **Mitigação / Ação Requerida** |
| --- | --- | --- |
| **Risco:** descrição | **[Alto]** | **Ação (QA):** mitigação |
```

Negrito é permitido e esperado nas células desta tabela.

### Seções: H1 numeradas com separador

```
# 1. Análise de Escopo e Objetivos
---
```

Usar `# 1.` a `# 4.` — nunca `## 1.`.

### Listas

- Em Escopo / Fora de Escopo: `*   **[Tópico]:** texto`
- Frentes de Cobertura (sub-itens): `    *   texto` (4 espaços de indentação)
- Critérios de aceite: `*   [ ] critério`

## Proibições de formatação

- **Não** incluir `# {Feature} — Documento de Teste` como título
- **Não** usar `## 1.` (H2) para as seções principais — usar `# 1.` (H1)
- **Não** renomear seções ou reordenar blocos
- **Não** trocar `Fora de Escopo (Limites do Teste):` por `Fora de Escopo:`
- **Não** usar `- [ ]` na seção 4 — usar `*   [ ]`
- **Não** omitir logo, tabela HTML, `[[_TOC_]]` ou separadores `---`
- **Não** incluir parágrafos de orientação do template no documento final
- Metadados após `[[_TOC_]]` (**Funcionalidade**, **US de referência**, **Wiki (DOC)**) são obrigatórios para publicação automática na wiki
