# Template Bug — Azure DevOps

> **Referência canônica:** [`Template Bug.pdf`](Template%20Bug.pdf)  
> **Imagens:** `template-bug-page-1.png`, `template-bug-page-2.png`  
> **Campo ADO:** `Microsoft.VSTS.TCM.ReproSteps` (HTML)  
> **Gerador:** `scripts/lib/build-bug-html.mjs`

O agente **deve** preencher **todas** as seções abaixo. Não omitir campos.

---

## Título (`System.Title`)

```
[FE/BE] [Título conciso e direto sobre o erro]
```

| Prefixo | Quando usar |
|--|--|
| `[FE]` | Problemas visuais, interface, UX, layout, mensagens na tela |
| `[BE]` | Processamento, API, persistência, dados incorretos no servidor |

O título deve deixar claro:
1. **O que** está acontecendo
2. **Onde** está acontecendo (tela/módulo)
3. **Em que condição** (ação/gatilho)

**Exemplo (do template):**  
`[FE] Lista de Contratos - Coluna Gerente vazia ao expandir registro.`

---

## 1. Descrição

Resumo do problema em linguagem clara:
- Impacto para o usuário
- Contexto em que o erro ocorre
- Padrão específico, se houver (ex.: "só ocorre com contratos do cliente X")

Incluir metadados do teste:
- **Cenário de teste:** `[CN-xx.x.yy]`
- **Feature:** nome do PBI
- **Referências violadas:** RN, SPEC, US, MSG (da wiki)

---

## 2. Passos para Reproduzir

Lista **numerada**, passo a passo a partir do zero, com nomes exatos de botões e telas:

1. Passo inicial — ex.: Fazer login no Delivery Tech
2. Ação específica — ex.: Acessar menu Central de Relatórios
3. Gatilho do bug — ex.: Clicar em Buscar sem preencher filtros obrigatórios

Derivar dos steps Gherkin do cenário executado (`Dado` / `Quando` / `Então`).

---

## 3. Resultado Esperado

Comportamento **correto** conforme:
- Regras de negócio (RN)
- SPEC / protótipo
- US (critérios C.x)
- Documento de teste (DOC)
- Cenário `[CN-xx]`

**Exemplo:** `A coluna deve exibir o nome do Gerente retornado pela API.`

---

## 4. Resultado Atual

O que **realmente** aconteceu, destacando a falha.

**Exemplo:** `A coluna permanece vazia, embora o JSON da API traga o valor "João Silva".`

---

## 5. Detalhes Técnicos e Ambiente

| Campo | Obrigatório | Exemplo |
|--|--|--|
| **Ambiente** | Sim | Homologação |
| **Browser/Versão** | Sim | Chrome v.142 |
| **Usuário/Login utilizado** | Sim | gestor.pmo@teste (perfil Gestor PMO) |
| **Endpoint/API** | Se aplicável | `GET /api/v1/contratos/123/demandas` |
| **Logs** | Se disponível | Erros do console (F12) ou servidor |

---

## 6. Evidências

Descrever **onde** o bug aparece:

| Tipo | Quando incluir |
|--|--|
| **Prints** | Sempre — screenshot com destaque na área do erro |
| **Vídeos** | Bugs intermitentes ou de navegação |
| **Logs** | Erros de console (F12) ou servidor |

O print deve ser anexado ao Bug **e** referenciado no HTML (`<img src="...">`).

---

## 7. Severidade

Classificar por **impacto técnico** (campo `Microsoft.VSTS.Common.Severity`):

| Template | Campo ADO | Quando usar |
|--|--|--|
| Alta (Critical) / High | `2 - High` ou `1 - Critical` | Funcionalidade importante quebrada sem workaround; fluxo principal bloqueado; sistema indisponível |
| Média (Major) / Medium | `3 - Medium` | Erro funcional com workaround ou perda de informação secundária |
| Baixa (Minor) / Low | `4 - Low` | Estético, ortográfico, layout — sem impacto funcional direto |

---

## Vínculo com PBI

- Bug como **filho** do PBI (`System.LinkTypes.Hierarchy-Reverse`)
- `System.IterationPath` herdado do PBI

---

## Script de criação (obrigatório)

O agente **não** deve criar Bug via texto livre — usar sempre:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/create-bug-from-failure.mjs \
  --pbi {pbiId} \
  --cn {cnId} \
  --layer FE \
  --title "Tela - Resumo conciso do erro" \
  --description "Resumo do problema, impacto e contexto..." \
  --steps "Fazer login no Delivery Tech|Acessar menu X|Clicar em Y" \
  --expected "Comportamento esperado conforme RN/SPEC..." \
  --actual "Comportamento observado na UI..." \
  --environment "Homologação" \
  --browser "Chrome v.142" \
  --user "perfil@teste" \
  --endpoint "GET /api/..." \
  --logs "Console: ..." \
  --severity media \
  --references "RN-15, US 38.1 C.1, MSA_02" \
  --evidence docs/test-evidence/{slug}/{cn-id}/screenshot.png \
  --feature "{feature}"
```

---

## Checklist antes de abrir o Bug

- [ ] Título no formato `[FE/BE] Tela - O que/onde/condição`
- [ ] Descrição com impacto e contexto
- [ ] Passos numerados e reproduzíveis
- [ ] Resultado Esperado da wiki/cenário
- [ ] Resultado Atual observado na execução
- [ ] Ambiente + Browser + Usuário preenchidos
- [ ] Print anexado como evidência
- [ ] Severidade coerente com o impacto
- [ ] Bug vinculado ao PBI da feature
