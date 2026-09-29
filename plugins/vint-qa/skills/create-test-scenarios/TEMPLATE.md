# Template — Cenários de Teste (Wiki Azure DevOps)

> **Referência canônica:** `Template Cenários de Teste.pdf` na raiz do repositório e imagens em `template-page-1.png` / `template-page-2.png`.
> O agente **não deve alterar** a estrutura de cada cenário — apenas preencher conteúdo derivado da wiki.

---

## Estrutura do documento gerado (feature completa)

O arquivo `.md` de saída deve conter **cabeçalho wiki do projeto** + **um ou mais blocos de cenário** repetindo o padrão abaixo.

```markdown
{azure.wikiLogo}
<table>
<tr></th>
<td><b>Número do projeto </b> {azure.projeto} </td>
<td><b>Cliente: </b> {cliente}</td>
<td><b>Versão: </b> [Versão] </td>
<td><b>Data: </b> [DD/MM/AAAA] </td>
</tr>
</table>

[[_TOC_]]

**Funcionalidade:** [Nome da feature]
**US de referência:** [US XX.X — título]
**Fontes consultadas:** [SPEC / RN / MSG / ALI — listar páginas encontradas]

---

## [CN-XX.X.01] [Funcionalidade] - [Ação realizada] - [Resultado esperado]

**Descritivo do Cenário (Steps)**

*   **Dado** [contexto ou pré-condição necessária para o teste iniciar];
*   **Quando** [ação específica que o usuário ou o sistema executa];
*   **E** [condição ou restrição adicional que complementa a ação];
*   **Então** [resultado esperado, validação visual ou alteração no banco de dados].

**Informações de Gestão e Técnica (Métrica QA)**

| **Campo** | **Definição / Valor Esperado** |
| --- | --- |
| **Criticidade** | [Muito Alta / Alta / Média / Baixa] — [justificativa breve] |
| **Estratégia Técnica** | [API / UI / API+UI / UI + BD (SQL)] — [onde a validação ocorre] |
| **Status da Automação** | [Concluído / Planejado / Não Automatizado / Não se Aplica] — **obrigatório** para publicação no Test Plan |

---

## [CN-XX.X.02] [Funcionalidade] - [Ação] - [Resultado]

(repetir bloco para cada cenário)
```

---

## Padrão do título do cenário

| Elemento | Regra |
|--|--|
| Identificador | `[CN-{US}.{seq}]` — ex.: `CN-12.2.01`, `CN-05.2.03` |
| Formato | `[Identificador] Funcionalidade - Ação realizada - Resultado esperado` |
| Exemplo | `[CN-01] Login - Credenciais Válidas - Sucesso no acesso` |

A numeração `{seq}` é sequencial com 2 dígitos (`01`, `02`, …) dentro da mesma US.

---

## Descritivo do Cenário (Steps) — regras

- Usar palavras-chave Gherkin em português: **Dado**, **Quando**, **E** / **Mas**, **Então**
- Cada passo em linha separada com `*   **Palavra-chave** texto;`
- Referenciar códigos da wiki quando aplicável: **RN_xx**, **MSA_xx**, **MSC_xx**, critérios **C.x**
- Campos de banco e valores técnicos em crase: `` `deletado` ``, `` `true` ``
- Mínimo **3 passos** por cenário (Dado + Quando + Então); incluir **E** quando houver confirmação, filtro ou pré-requisito adicional

---

## Tabela Métrica QA — valores permitidos

### Criticidade

| Valor | Quando usar |
|--|--|
| Muito Alta | Caminho feliz, fluxos financeiros, cálculos críticos, smoke |
| Alta | Regras de negócio (RN), permissões, integrações de dados |
| Média | Validações de campo, mensagens de feedback, filtros |
| Baixa | Borda, estados vazios, cenários exploratórios complementares |

### Estratégia Técnica

| Valor | Quando usar |
|--|--|
| UI | Validação exclusiva de interface e fluxo navegável |
| API | Endpoints sem tela (domínio, integrações) |
| API+UI | Ação na UI com validação de payload/resposta |
| UI + BD (SQL) | UI com conferência de persistência ou cálculo no banco |

### Status da Automação

| Valor | Quando usar |
|--|--|
| Planejado | Padrão para cenários recém-criados |
| Concluído | Já existe spec Playwright cobrindo o cenário |
| Não Automatizado | Manual por natureza (exploratório, visual, BD ad-hoc) |
| Não se Aplica | Cenário puramente documental ou bloqueado |

---

## Categorias obrigatórias de cobertura

Gerar cenários para **todas** as categorias aplicáveis à feature (ver [CATEGORIES.md](CATEGORIES.md)):

1. Caminho feliz
2. Validação de campos
3. Regras de negócio (um cenário por RN)
4. Mensagens de feedback
5. Autenticação / permissão
6. Estados de UI
7. Segurança
8. Dados de borda
9. Regressão E2E (quando CRUD completo existir)

Omitir categoria **somente** quando explicitamente fora de escopo na US/SPEC — registrar lacuna no bloco de fontes.

---

## Proibições de formatação

- **Não** renomear seções `Descritivo do Cenário (Steps)` ou `Informações de Gestão e Técnica (Métrica QA)`
- **Não** trocar tabela para formato sem separador GFM `| --- |`
- **Não** usar `- [ ]` ou checklists — este template é de cenários, não de documento de teste
- **Não** inventar RNs, mensagens ou critérios ausentes na wiki
- **Não** publicar na wiki de requisitos — salvar em `docs/test-scenarios/`; Test Plans via `publish-test-scenarios.mjs`
- **Não** omitir métricas QA — cenário sem Criticidade, Estratégia ou Status da Automação não será criado no Test Plan
- **Não** incluir parágrafos de orientação deste arquivo no documento final
