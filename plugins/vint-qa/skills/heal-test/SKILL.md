---
name: heal-test
description: Subagente de auto-reparo que analisa testes Playwright quebrados, identifica a causa raiz (BUG no produto, DRIFT de locator ou FALSO_POSITIVO de timing) e propõe ou aplica a correção mínima. Usar quando um teste que antes passava começa a falhar, após refactoring do frontend, ou após receber um relatório de falha de CI.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Heal Test — Auto-reparo de Testes Quebrados

Diagnóstica e corrige testes Playwright que estão falhando sem perder a intenção do cenário.

---

## Passo 0 — Identificar o teste alvo

Perguntar ao usuário (ou inferir do contexto):
- Nome do teste ou arquivo (ex.: `cadastro-produto.spec.ts`, `deve rejeitar CPF duplicado`)
- Caminho do relatório de falha, se disponível (`e2e/playwright-report/` ou `e2e/test-results/`)

Se não houver arquivo específico: listar specs com `e2e_find_tests` e pedir seleção.

---

## Fase 1 — Coleta de evidências (subagentes paralelos)

> Lançar os dois subagentes **simultaneamente** e aguardar ambos antes de prosseguir.

### Subagente A — Análise do relatório de falha

Ler o relatório de falha em `e2e/test-results/` ou `e2e/playwright-report/`:

```
# Procurar por:
- Mensagem de erro exata (ex.: "locator.click: Element not found")
- Seletor que falhou (ex.: getByRole('button', { name: /Salvar/i }))
- Screenshot de falha (capturado automaticamente pelo Playwright)
- Trace (se disponível): sequência de ações até a falha
- Linha do arquivo que gerou o erro
```

Extrair:
- **Tipo de falha**: `TimeoutError` / `strict mode violation` / `assertion failed` / `navigation error`
- **Locator envolvido**: qual seletor estava sendo usado
- **Passo BDD** em que ocorreu (Dado / Quando / Então)
- **URL** da página no momento da falha

### Subagente B — Inspeção do estado atual da UI

```
[ ] browser_navigate  → URL que falhou (extraída do relatório)
[ ] browser_snapshot  → estrutura atual da tela
[ ] browser_take_screenshot → evidência do estado atual
[ ] browser_snapshot  → snapshot específico do elemento que falhou
```

Se o locator envolvia um modal/drawer:
```
[ ] browser_click     → abrir o modal
[ ] browser_snapshot  → estrutura interna atual do modal
```

---

## Fase 2 — Diagnóstico: classificar a falha

Cruzar o relatório (Subagente A) com o snapshot atual (Subagente B):

### Árvore de decisão

```
O elemento existe na UI atual?
├── NÃO → O texto/role/name mudou?
│   ├── SIM → DRIFT de locator (frontend refatorou o componente)
│   └── NÃO → O elemento foi removido?
│       ├── SIM → BUG ou mudança intencional de comportamento
│       └── NÃO → Timing: elemento existe mas não estava pronto → FALSO_POSITIVO
│
└── SIM → O comportamento mudou (assert falha mas elemento existe)?
    ├── SIM, mensagem mudou → DRIFT de mensagem
    ├── SIM, fluxo mudou → BUG (comportamento diferente da spec)
    └── SIM, só timing → FALSO_POSITIVO (wait insuficiente)
```

### Classificação final

| Tipo | Significado | Ação |
|------|-------------|------|
| `DRIFT` | Locator ou texto do componente mudou no frontend | Corrigir POM |
| `BUG` | Comportamento diferente do esperado pela spec/RN | Reportar; não alterar assert |
| `FALSO_POSITIVO` | Timing ou race condition — teste instável | Estabilizar wait no POM |

---

## Fase 3 — Plano de correção por tipo

### DRIFT — Corrigir o POM

1. Ler o POM atual (`pages/{dominio}/listagem.page.ts` ou `cadastro-drawer.page.ts`)
2. Identificar o locator desatualizado
3. Gerar o locator corrigido baseado no snapshot atual (hierarquia: role → label → testid → CSS)
4. Apresentar o diff antes de aplicar:

```
DRIFT detectado em: pages/cadastro-produto.page.ts

ANTES:
  this.btnSalvar = page.getByRole('button', { name: /Salvar/i })

DEPOIS (baseado no snapshot atual):
  this.btnSalvar = page.getByRole('button', { name: /Confirmar cadastro/i })

Razão: botão renomeado de "Salvar" para "Confirmar cadastro"
```

5. Perguntar: `Aplicar correção? (s/n)`
6. Se sim: editar o POM e executar `e2e_rebuild_index`

### BUG — Gerar relatório de evidência

Não alterar o assert. Gerar relatório de bug:

```
BUG DETECTADO: {feature} — {cenário}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Spec:    e2e/tests/{feature}.spec.ts:{linha}
Cenário: deve {comportamento esperado}
RN:      RN_XX (se aplicável, extraído da wiki)

COMPORTAMENTO ESPERADO (conforme spec/wiki):
  {descrição}

COMPORTAMENTO ATUAL (evidência do snapshot):
  {descrição}

Screenshot: e2e/test-results/{screenshot}.png
URL: {url da falha}

AÇÃO RECOMENDADA:
  Abrir issue no Azure DevOps para correção no produto.
  NÃO alterar o teste — o teste está correto.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### FALSO_POSITIVO — Estabilizar o wait no POM

1. Identificar o método do POM envolvido
2. Substituir `waitForTimeout` ou wait insuficiente por estratégia robusta:

```typescript
// ANTES (instável)
async acionarSalvar(): Promise<void> {
  await this.btnSalvar.click()
}

// DEPOIS (estável)
async acionarSalvar(): Promise<void> {
  await expect(this.btnSalvar).toBeEnabled({ timeout: 10_000 })
  await this.btnSalvar.click()
  // Aguardar feedback visual para confirmar que a ação foi processada
  await this.page.getByText(/carregando/i)
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => {})
}
```

---

## Fase 4 — Verificação pós-correção

Após aplicar qualquer correção:

```
[ ] Executar apenas o teste corrigido:
    npx playwright test {arquivo} --grep "{título do teste}"

[ ] Confirmar que passou: relatar resultado

[ ] Se ainda falhar: repetir diagnóstico com nova evidência

[ ] e2e_rebuild_index → reindexar
```

---

## Checklist de entrega

- [ ] **Nenhum arquivo fora de `e2e/` foi modificado** (regra inviolável)
- [ ] Tipo de falha classificado (DRIFT / BUG / FALSO_POSITIVO)
- [ ] Evidência do snapshot atual incluída
- [ ] DRIFT: diff do POM apresentado antes de aplicar
- [ ] BUG: relatório de evidência gerado (não alterar assert, não corrigir em `src/`)
- [ ] FALSO_POSITIVO: wait estabilizado no POM
- [ ] Verificação pós-correção executada
