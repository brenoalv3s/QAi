---
name: review-spec
description: Subagente revisor que analisa um arquivo .spec.ts existente e emite um relatório estruturado de cobertura e conformidade. Verifica se a spec segue as convenções do projeto (BDD, fixtures, nomenclatura) e se cobre categorias de alta criticidade. Usar após /generate-regression-automation ou para auditar um teste existente.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Review Spec — Revisor de Qualidade

Analisa uma spec Playwright e emite relatório de cobertura + conformidade, com lista de correções priorizadas.

---

## Passo 0 — Identificar o arquivo alvo

Perguntar ao usuário (ou inferir do contexto):
- Caminho da spec a revisar (ex.: `e2e/tests/cadastro-colaborador.spec.ts`)
- Se não fornecido, listar specs disponíveis com `e2e_find_tests` e pedir seleção

---

## Passo 1 — Ler e entender a spec

1. Ler o arquivo `{feature}.spec.ts` integralmente
2. Se houver POM, ler `pages/{dominio}/listagem.page.ts` e `cadastro-drawer.page.ts`
3. Usar `e2e_get_wiki_page "{feature}"` para recuperar RNs e MSAs esperados da documentação

---

## Passo 2 — Análise de conformidade estrutural

Verificar **linha a linha** contra as rules `e2e-spec-conventions`:

| Check | Critério | Status |
|-------|----------|--------|
| Import correto | `base.fixture` + helpers `bdd`/`cenario` para telas autenticadas | ✅/❌ |
| Import POM | Barrel `pages/{dominio}` | ✅/❌ |
| BDD enxuto | Usa `dado`/`quando`/`entao`; máx. ~3 passos; sem asserts duplicados | ✅/❌ |
| Título do teste | `titulo('CN-XX', 'desc', 'RN_xx')` | ✅/❌ |
| Sem locators raw | Nenhum `page.getByRole` / `page.locator` direto na spec | ✅/❌ |
| Nomenclatura describe | `{PREFIXO} — {Domínio} (US — {operação})` | ✅/❌ |
| test.skip com mensagem | Nunca `test.skip(true)` sem string | ✅/❌ |
| Variáveis entre steps | `let` declarado fora dos helpers | ✅/❌ |

---

## Passo 3 — Análise de cobertura

Para cada categoria relevante (ver `create-test-scenarios/CATEGORIES.md`), verificar se existe ao menos um `test()` ou `test.skip()` documentado:

| Categoria | Cenários encontrados | Status |
|-----------|---------------------|--------|
| Caminho feliz | lista de títulos | ✅/⚠️/❌ |
| Validação de campos | lista de títulos | ✅/⚠️/❌ |
| Regras de negócio | lista com código RN_XX | ✅/⚠️/❌ |
| Mensagens de feedback | lista com MSA/MSC | ✅/⚠️/❌ |
| Autenticação / Permissão | lista de títulos | ✅/⚠️/❌ |
| Estados de UI | lista de títulos | ✅/⚠️/❌ |
| Segurança | lista de títulos | ✅/⚠️/❌ |
| Dados de borda | lista de títulos | ✅/⚠️/❌ |
| Regressão E2E (smoke) | lista de títulos | ✅/⚠️/❌ |

**Legenda:**
- ✅ Coberto adequadamente
- ⚠️ Parcial — existe mas incompleto (ex.: só um campo validado de três)
- ❌ Ausente — nenhum cenário desta categoria

---

## Passo 4 — Análise de RNs da wiki vs cobertura

Cruzar as RNs encontradas na wiki com os títulos de `test()` na spec:

```
RN_00 — Unicidade de CPF               → ✅ coberta  (linha 42)
RN_04 — Limite de 10 colaboradores     → ❌ ausente
RN_07 — Desligamento exige data futura → ❌ ausente
MSA_03 — Mensagem de duplicidade       → ✅ coberta  (linha 67)
MSC_03 — Diálogo de confirmação        → ⚠️ cenário de confirmação existe, cancelamento não
```

---

## Passo 5 — Relatório final

Emitir o relatório no formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REVIEW: e2e/tests/{feature}.spec.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFORMIDADE ESTRUTURAL
  ✅ Import correto (base.fixture)
  ✅ BDD em português
  ❌ Locator raw na linha 58: page.getByRole('button', …)
  ⚠️  test.skip sem mensagem na linha 91

COBERTURA POR CATEGORIA
  ✅ Caminho feliz         (2 cenários)
  ✅ Validação de campos   (4 cenários)
  ⚠️  Regras de negócio   (2 de 4 RNs cobertas)
  ✅ Mensagens de feedback (3 cenários)
  ❌ Autenticação          (0 cenários)
  ⚠️  Estados de UI        (loading coberto, erro de API ausente)
  ❌ Segurança             (0 cenários)
  ✅ Dados de borda        (2 cenários)
  ✅ Regressão E2E         (1 smoke test)

SCORE DE COBERTURA: 6/9 categorias  (67%)

ITENS PRIORITÁRIOS PARA CORREÇÃO
  [P1] Mover locator raw da linha 58 para o POM
  [P1] Adicionar cenário de acesso sem login
  [P2] Cobrir RN_04 e RN_07 da wiki
  [P2] Adicionar cenário de XSS no campo "Observação"
  [P3] Adicionar mensagem no test.skip da linha 91
  [P3] Adicionar cenário de erro de API (mock 500)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Passo 6 — Oferecer correção automática

Após exibir o relatório, perguntar:

```
Deseja que eu aplique as correções [P1] agora?
(a) Sim, corrigir itens P1 automaticamente
(b) Sim, corrigir todos os itens (P1 + P2 + P3)
(c) Não, apenas o relatório
```

Se o usuário confirmar:
- Itens P1 de conformidade → editar a spec e o POM diretamente
- Itens P1/P2 de cobertura → gerar os cenários faltantes usando os padrões de `create-spec`
- Após edição: `e2e_rebuild_index` para reindexar

---

## Checklist de entrega do relatório

- [ ] Conformidade estrutural verificada linha a linha
- [ ] Cada RN da wiki cruzada contra os títulos dos testes
- [ ] Score de cobertura calculado (N/9 categorias)
- [ ] Itens de correção priorizados (P1 crítico, P2 importante, P3 melhoria)
- [ ] Oferta de correção automática apresentada ao usuário
