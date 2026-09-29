---
name: execute-manual-tests
description: QA investigador sênior via Browser MCP. Prepara massa (cadastrar/editar/buscar/excluir/visualizar/histórico) quando o CN exigir; anuncia no chat o que verifica; ADHOC se a tela revelar risco; Mark Outcome com evidências GIF no Test Plans e no card PBI; vincula PBI/Bug. Consentimento para bugs no agente execute-manual-tests. Modo pontual: execute-manual-tests-manual.
---

> **Runtime vint-qa:** `{VINT_QA_ROOT}` = pasta do plugin (`node "$HOME/.vint-qa/vqa.mjs" --root`). Scripts rodam na raiz do projeto com `node "$HOME/.vint-qa/vqa.mjs" skills/...`. Configuração do projeto: `.hub-projeto.json` + `.env`. Se o launcher não existir, ver `{VINT_QA_ROOT}/rules/vint-qa-runtime.mdc`.

# Execute Manual Tests — QA investigador sênior

Fonte de verdade: `{VINT_QA_ROOT}/agents/execute-manual-tests.md`.

Atua como **QA Sênior especialista**: Browser MCP, cenários formais **e** exploração crítica, **preparação de massa** quando o CN depende de dados, transparência no chat, evidências em **GIF** no Test Plans **e no PBI**. Origem: **Azure DevOps**, **arquivo**, **URL** ou **texto livre**.

**A cada cenário**, no Test Plans (Mark Outcome): **Passed**, **Failed** ou **NotApplicable**, com `fluxo.gif` (UI) anexado ao resultado **e ao card do PBI**. PBI existente no board é vinculado ao Test Case. Bug (após consentimento neste agente) é vinculado ao card do cenário.

Guia de postura e massa: [SENIOR-QA.md](SENIOR-QA.md).

Agente pontual Test Plans (feature informada, sem perguntar Bug): `{VINT_QA_ROOT}/agents/execute-manual-tests-manual.md`.

---

## Ambiente (obrigatório)

Ler **`.env` na raiz do repositório**: usuário (`TEST_USER`, `USERNAME`), senha (`TEST_PASSWORD`). Sem credenciais: **parar e perguntar**. Não abrir o browser sem isso.

### Modo manual — escolher o ambiente (clicável)

No agente `execute-manual-tests-manual` (e na esteira, ao escolher testes manuais): **antes** de abrir o browser, usar **AskQuestion**. **Não** assumir a URL do `.env`.

**Título / prompt:** `Em qual ambiente deseja executar os testes manuais?`

As opções vêm de `.hub-projeto.json` → `ambientes` (somente os que têm `url`). Label de cada opção: `{ID em maiúsculas} — {url}`; o `ambientePadrao` vem primeiro com ` (Recomendado)`. Se nenhum ambiente tiver URL, pedir as URLs ao usuário e gravar com `node "$HOME/.vint-qa/vqa.mjs" set hub.ambientes.{id}.url=... hub.ambientes.{id}.api=...` antes de continuar.

Uma opção só. Sem AskQuestion: listar as opções e esperar. Se o prompt já trouxer `ambiente: DEV|TST|HML`, não perguntar de novo.

| id | App (`BASE_URL` / `SYSTEM_URL`) | API (`API_BASE_URL`) | `--environment` (Bug) |
|----|--------------------------------|----------------------|------------------------|
| `dev` | `ambientes.dev.url` | `ambientes.dev.api` (ou a url) | Desenvolvimento |
| `tst` | `ambientes.tst.url` | `ambientes.tst.api` (ou a url) | Teste |
| `hml` | `ambientes.hml.url` | `ambientes.hml.api` (ou a url) | Homologação |

Após a escolha, gravar as URLs (credenciais permanecem) e navegar só na `{appUrl}`:

```bash
node "$HOME/.vint-qa/vqa.mjs" set --use-env {id}
```

### Modo automático (cron / `--auto`)

Usar `BASE_URL` / `SYSTEM_URL` do `.env`. **Não** perguntar o ambiente (execução em background).

---

## Modos de execução

| Modo | Como acionar | Agente | Gates |
|--|--|--|--|
| **Manual** | `/execute-manual-tests {feature}` ou `@execute-manual-tests-manual` | `execute-manual-tests-manual` | Opcional (`--validate-gates`) |
| **Automático** | `/execute-manual-tests --auto` | `execute-manual-tests` | Obrigatório — ver [BOARD.md](BOARD.md) |
| **Automação agendada** | [AUTOMATION.md](AUTOMATION.md) — cron `0 9,11,13,15,17 * * 1-5` | `execute-manual-tests` | Obrigatório |
| **Automação sob demanda** | Esteira: [qa-sprint-orchestrator/MANUAL.md](../qa-sprint-orchestrator/MANUAL.md) — `qa-sprint-orchestrator-manual.prefill.json` | `execute-manual-tests-manual` (delegado) | Opcional |

Guia completo do modo manual: [MANUAL.md](MANUAL.md).

---

## Passo 0 — Ambiente + alvo

1. Validar `.env` na raiz — credenciais (perguntar se incompleto).
2. **Modo manual:** AskQuestion **Em qual ambiente deseja executar os testes manuais?** (DEV / TST / HML). Gravar URLs e só então abrir o browser. **Modo automático:** URL do `.env`.
3. Identificar origem:

| Origem | Comportamento |
|--------|----------------|
| **Azure DevOps (PBI / --auto)** | `discover-execute-candidates.mjs` ou feature informada. Wiki SPEC/US/RN/MSG/ALI. |
| **Arquivo / texto / URL** | Ler o conteúdo; extrair Gherkin ou regras; executar sem exigir Test Run se não houver Azure. |

### Modo automático (board)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/discover-execute-candidates.mjs --json
```

Se `eligible` vazio → abortar com `blocked`. `feature` = `pbiTitle`.

### Agente `execute-manual-tests-manual`

Feature = nome informado. Scripts Test Plans (`list-feature-scenarios`, `start-test-run`). Não usar `discover-execute-candidates` salvo `--validate-gates`.

---

## Passo 1 — Carregar cenários do Test Plans

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/list-feature-scenarios.mjs --feature "{feature}" --json
```

Retorno: `scenarios[]` com `cnId`, `id` (test case), `title`, `steps[]`, `executeUrl`.

### Iniciar Test Run (modo Execute)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/start-test-run.mjs --feature "{feature}" --json
```

Guardar: `runId`, `mapping[]` (resultId ↔ testCaseId ↔ cnId), `executeUrl`.

> A URL muda de `define` para `execute` — o run representa a execução ativa.

---

## Passo 2 — Carregar documentação de referência (Azure DevOps MCP)

Usar `azure-devops` (MCP do projeto, gerado por `vqa sync-mcp`):

```
search_wiki → {feature}
get_wiki_page → SPEC, US, RN, MSG (Alertas / Confirmação / Erro — **Descrição** de cada código), ALI
get_wiki_page → DOC de teste da feature
```

Complementar com `docs/test-docs/` e `docs/test-scenarios/` locais se existirem.

**Carregar a documentação uma vez.** Em seguida gerar a **Ficha de validação** e ordenar CNs por risco (P0→P1→P2) — ver [SENIOR-QA.md](SENIOR-QA.md). Não re-buscar wiki a cada CN.

**Obrigatório na ficha:** para cada MSA/MSC/MSE citada na US, DOC ou CN, registrar o texto **canônico** = **Descrição** do catálogo MSG (com `<Registro>` → feature). Ver SENIOR-QA.md — *Resolução do texto esperado de mensagens*.

**Fontes de validação por cenário:**

| Fonte | O que validar |
|--|--|
| Catálogo **MSG** (wiki) | Texto canônico do toast/alerta (**Descrição**, não o título do código) |
| Steps do cenário `[CN-xx]` | Fluxo Dado/Quando/Então; códigos MSG a aplicar |
| US / C.x | Critérios de aceite; citações MSG (rótulo ≠ texto do toast) |
| RN | Regras de negócio |
| SPEC | Campos, botões, fluxos |
| DOC (`docs/test-docs/` + wiki) | Escopo, mensagens aplicáveis, lacunas US↔MSG |

---

## Postura crítica e analítica (obrigatória)

O agente **não** é um executor cego de steps. Atua como **QA Sênior / Quality Engineer** cuja missão é **provar que a feature NÃO funciona** (com evidência):

1. **Seguir os cenários** do Test Plans / `.md` (fonte formal), na ordem **P0 → P1 → P2**.
2. **Questionar o esperado** contra a **ficha** (SPEC/US/RN/MSG/ALI/DOC) antes de julgar.
3. **Preparar massa** quando o CN exigir cadastrar / editar / buscar / excluir / visualizar / histórico / estado específico — ver [SENIOR-QA.md](SENIOR-QA.md).
4. **Explorar a tela 1× por rota** na sessão; nos CNs seguintes na mesma tela, focar no fluxo + gate.
5. Após a ação crítica: **Bug Hunter** (console + network) e, se P0/P1, até **1 sonda** negativa.
6. **Quality Gate** completo antes de Passed — proibido Passed por “parece ok”.
7. Se a UI revelar risco não coberto por CN → **ADHOC** (máx. 5/sessão).

**Proibido** Failed/N/A só por “não tem massa” se ainda for possível criar/ajustar o registro na UI/API.

Checklist mental (Bug Hunter) em toda ação crítica:

| Olhar | O que caçar |
|-------|-------------|
| UI/UX | Alinhamento, textos cortados, labels inconsistentes, estados disabled sem motivo |
| Regras | Validações, bloqueios, mensagens MSA/MSC no momento certo |
| Segurança | XSS em inputs, IDOR/BOLA ao trocar IDs, dados de outro usuário |
| Erros silenciosos | Loading infinito, toast sumindo, HTTP 4xx/5xx sem feedback |
| Console / Network | `browser_console_messages` + `browser_network_requests` após save/ação |
| Dados | Massa inconsistente, campos obrigatórios faltando, histórico ausente; persistência pós-create |
| API (se estratégia) | Status, payload, contrato Swagger |

Login **uma vez** com credenciais do `.env`; reutilizar sessão.

Detalhes de velocidade, ficha, Risk Engine, Quality Gate e veredito estruturado: [SENIOR-QA.md](SENIOR-QA.md).

---

## Transparência ao usuário (obrigatória, curta)

**Antes** de cada cenário (formal ou ad-hoc):

```markdown
### Em execução: {CN-id ou ADHOC-xx} [{P0|P1|P2}]
**Verificando:** {1 linha} | **Massa:** ok | vou criar {x}
**Gate foco:** esperado + RN + console/network
```

Durante o fluxo, se mudar o foco:

> Pausa analítica: encontrei {X}. Vou validar agora como ADHOC-{n} antes de seguir o próximo CN.

Ao fechar o cenário, veredito com Gate:

```markdown
**Resultado {CN}:** Passed | Failed | N/A
**Gate:** esperado ✓/✗ | RN ✓/✗ | msg ✓/✗|n/a | persistência ✓/✗|n/a | console ✓/✗ | network ✓/✗
**Findings:** {nenhum | lista curta}
```

---

## Cenários ad-hoc (descobertos na tela)

| Regra | Comportamento |
|-------|----------------|
| Origem | Exploração após snapshot / interação real |
| Critério para executar | Impacto em qualidade (perda de dados, RN quebrada, segurança, bloqueio de fluxo principal) |
| Identificador | `ADHOC-01`, `ADHOC-02`, … (sequencial na sessão) |
| Evidência | Mesmo padrão GIF + pasta `docs/test-evidence/{slug}/adhoc-xx/` |
| Test Plans | **Não** marcar Passed/Failed de CN formal com resultado ad-hoc. Relatar à parte; se falhar, sugerir Bug / novo CN |
| Limite | Máx. **5** ad-hoc por feature/sessão, salvo o usuário pedir mais |

---

## Evidências em GIF (obrigatório para UI)

Screenshots isolados **não bastam** para UI: o usuário precisa **ver o fluxo**.

### Como gerar

1. Em cada passo crítico do cenário, salvar PNG em:
   `docs/test-evidence/{slug}/{cn-id}/frames/01-login.png`, `02-listagem.png`, …
2. Ao final do cenário (passou ou falhou), gerar o GIF:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/make-evidence-gif.mjs \
  --dir docs/test-evidence/{slug}/{cn-id}/frames \
  --out docs/test-evidence/{slug}/{cn-id}/fluxo.gif
```

3. Anexar **`fluxo.gif` e/ou `fluxo.png`** no Mark Outcome (`--evidence`) — **obrigatório no Test Result do cenário** no Test Plans **e** no card do PBI (`--pbi` + `--cn`). Pode somar `api-response.json` se API.
4. Manter os PNGs da pasta `frames/` (auditoria). Em falha, o GIF deve incluir o frame do erro.

Mínimo: **2 frames** (antes/depois). Máximo recomendado: **5 frames**/CN (exceto falha: incluir frame do erro). Ideal: antes→ação→resultado (+ massa se preparou). Login não precisa repetir frames em todo CN.

| Tipo | Arquivo | Quando |
|------|---------|--------|
| UI | `fluxo.gif` + `fluxo.png` | **Obrigatório** em Passed/Failed com `runUi` — anexo no **Test Result (Test Plans)** **e** no PBI |
| API | `api-response.json` | Obrigatório com `runApi` — idem |
| Extra | PNG avulso | Opcional; não substitui o GIF na UI |

---


## Passo 3 — Roteamento por Estratégia Técnica

Cada cenário retorna `strategy`, `strategyLabel` e `execution: { runApi, runUi }`.

Guia completo de API: [API-TESTING.md](API-TESTING.md).

| Estratégia | `runApi` | `runUi` | Como validar |
|--|--|--|--|
| **UI** | false | true | Somente browser MCP |
| **API** | true | false | Somente HTTP via Swagger |
| **API + UI** | true | true | API **e** UI — Passed só se **ambos** passarem |

### 3a — Autenticação API (quando `runApi`)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/api-auth.mjs --json
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/fetch-swagger.mjs --json
```

Token: `POST /api/auth/login` com JSON `{ email, password }` (ou `AUTH_BODY`).

### 3b — Execução API (quando `runApi`)

1. Localizar endpoint no Swagger/OpenAPI + SPEC/ALI
2. Montar request conforme steps do cenário
3. Executar:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/api-request.mjs \
  --method POST --path /api/... --body '{...}' \
  --save docs/test-evidence/{slug}/{cn-id}/api-response.json --json
```

4. Validar `status` + body contra RN/SPEC/US
5. Evidência API: `api-response.json` (obrigatório em Passed para estratégia API)

### 3c — Execução UI (quando `runUi`)

Seguir `/browser-mcp` (`playwright` / cursor-ide-browser):

1. Anunciar no chat o bloco **Em execução** (transparência + massa)
2. `browser_navigate` → URL do ambiente escolhido (`BASE_URL` / `SYSTEM_URL`)
3. Login na UI (ou reutilizar sessão após token API)
4. **Pré-condição:** se o CN depende de registro/estado e ele não existe → cadastrar/editar/gerar massa (incluir nos frames)
5. Em **cada passo crítico** (2–5 no total): `browser_take_screenshot` → `docs/test-evidence/{slug}/{cn-id}/frames/{NN}-{passo}.png`
6. Executar steps Gherkin; validar contra a **ficha** (RN/SPEC/US/MSG)
6a. **Após ação crítica:** `browser_navigate` para a mesma rota (reload) ou navegar à listagem — confirmar persistência **antes** de declarar Passed; toast de sucesso não é evidência suficiente
6b. **Tabela de prova por cláusula "Então":** mapear cada resultado observado com o frame correspondente (Protocolo Anti-Falso-Positivo em SENIOR-QA.md)
7. **Se CN envolve filtro/busca → FILTRO-GATE** (SENIOR-QA.md): preparar grupo de controle (1 item que corresponde + 1 que não), aplicar filtro, inspecionar **todos** os resultados (F3 inclusão), verificar que excluído não aparece (F4), conferir contagem (F5), limpar filtro (F6), API cross-check se P0/P1 (F7)
8. **Bug Hunter:** `browser_console_messages` + `browser_network_requests` após a ação crítica; 1 sonda se P0/P1
9. **Quality Gate** (SENIOR-QA) — só então decidir Passed/Failed
10. Se a tela revelar risco não coberto → **ADHOC** (máx. 5)
11. Gerar `fluxo.gif` com `make-evidence-gif.mjs` (Test Plans + PBI)

### 3d — API + UI (ambos obrigatórios)

Ordem recomendada: **API primeiro** (contrato/dados) → **UI depois** (reflexo na tela).

- Falha só na API → Bug `[BE]` + `--endpoint` + `--logs` com response JSON
- Falha só na UI (API ok) → Bug `[FE]`
- Evidências: `api-response.json` **e** `fluxo.gif`

### Decisão por cenário (Mark Outcome na hora)

Consultar wiki SPEC/US/RN/MSG/ALI/DOC **antes** de julgar. Registrar **assim que** o cenário terminar — não deixar para o final.

| Outcome | Quando | Evidência | Vínculos |
|--|--|--|--|
| **Passed** | Docs tratam o cenário **e** Quality Gate completo + Protocolo Anti-Falso-Positivo (reload + tabela de prova por Então + network P0/P1); **se CN envolve filtro/busca: FILTRO-GATE completo (F1–F6; F7 se P0/P1)** | `fluxo.gif` (UI) e/ou `api-response.json` (API) | `--pbi` + `--test-case-id` se houver PBI |
| **Failed** | Docs tratam **e** app diverge / gate falha / finding técnico (console/HTTP) / uma camada falha em API+UI | Idem | PBI no card; Bug no card **depois** do cadastro |
| **NotApplicable** | **Nenhuma** fonte documental menciona o cenário | `--comment` obrigatório (fontes consultadas); GIF/wiki opcional | `--pbi` + `--test-case-id` se houver PBI |

**Não confundir N/A:** ambiente fora, sem permissão, tela não abriu, “ainda não desenvolvido” com RN/US existindo → **Failed** (ou bloqueio no comment). **Nunca** N/A. Em dúvida Failed vs N/A → Failed (ou perguntar). Se a doc tratar o comportamento, **proibido** N/A — execute.

---

## Passo 4 — Registrar no Test Plans (Mark Outcome)

Registrar **por cenário**, imediatamente.

### Cenário passou

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/record-test-result.mjs \
  --run-id {runId} \
  --result-id {resultId} \
  --outcome Passed \
  --evidence docs/test-evidence/{slug}/{cn-id}/fluxo.gif,docs/test-evidence/{slug}/{cn-id}/fluxo.png \
  --comment "Cenário validado — massa preparada se necessário; conforme SPEC/US/RN" \
  --pbi {pbiId} \
  --test-case-id {testCaseId} \
  --cn {cnId}
```

O script **anexa obrigatoriamente** a evidência ao **Test Result do cenário** (Test Plans, Base64) **e** ao Work Item (PBI).  
`make-evidence-gif.mjs` gera `fluxo.png` sempre e `fluxo.gif` só se o ffmpeg produzir GIF válido.  
Passed/Failed **falham** (exit 2) se nenhuma evidência entrar no Test Plans — salvo `--allow-missing-testplan-evidence`.

### Cenário falhou

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/record-test-result.mjs \
  --run-id {runId} \
  --result-id {resultId} \
  --outcome Failed \
  --evidence docs/test-evidence/{slug}/{cn-id}/fluxo.gif,docs/test-evidence/{slug}/{cn-id}/fluxo.png \
  --comment "Falha: {descrição objetiva}" \
  --pbi {pbiId} \
  --test-case-id {testCaseId} \
  --cn {cnId}
```

### Não se aplica (somente se a doc não tratar o cenário)

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/record-test-result.mjs \
  --run-id {runId} \
  --result-id {resultId} \
  --outcome NotApplicable \
  --comment "Não se aplica: sem menção em SPEC/US/RN/MSG/ALI/DOC. Fontes: {lista}." \
  --pbi {pbiId} \
  --test-case-id {testCaseId} \
  --cn {cnId}
```

`--pbi` + `--test-case-id` vinculam o PBI ao card (Tested By) e anexam evidência ao PBI. Sem PBI no board, omitir `--pbi` (evidência fica só no Test Result / pasta local).

Depois **formatar** o Bug no padrão [`Template Bug.pdf`](Template%20Bug.pdf) / `templates/Template Bug.md`.

### Agente `execute-manual-tests` (investigador)

**Não cadastrar no Azure imediatamente.** Mostrar a lista formatada e perguntar:

> Encontrei os bugs acima durante a investigação. Deseja que eu cadastre esses bugs automaticamente no Azure DevOps (vinculados à PBI em execução), ou prefere apenas manter esta lista para repasse manual?

Só então, se o usuário **confirmar**, rodar `create-bug-from-failure.mjs` com `--test-case`, `--run-id` e `--result-id` para o Bug ficar filho do PBI **e** vinculado ao card do cenário. Sem PBI: avisar que o cadastro exige o ID.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/create-bug-from-failure.mjs \
  --pbi {pbiId} --cn {cnId} --layer FE \
  --title "..." --evidence {path} \
  --test-case {testCaseId} --run-id {runId} --result-id {resultId}
```

Vínculo tardio (Bug já criado):

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/record-test-result.mjs \
  --run-id {runId} --result-id {resultId} \
  --bug-id {bugId} --test-case-id {testCaseId} --pbi {pbiId}
```

### Agente `execute-manual-tests-manual`

Criar Bug via script após Failed (sem perguntar), como abaixo.

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/create-bug-from-failure.mjs \
  --pbi {pbiId} \
  --cn {cnId} \
  --layer FE \
  --title "{Tela} - {O que/onde/condição}" \
  --description "{impacto + contexto + padrão}" \
  --steps "Fazer login|Acessar menu X|Gatilho do bug" \
  --expected "{conforme SPEC/US/RN/DOC}" \
  --actual "{comportamento observado}" \
  --environment "{Desenvolvimento|Teste|Homologação conforme DEV/TST/HML}" \
  --browser "Chrome v.x" \
  --user "{perfil de teste usado}" \
  --endpoint "{API se BE}" \
  --logs "{console F12 se houver}" \
  --severity alta|media|baixa \
  --references "RN-xx, US x.x C.x, MSA_xx" \
  --evidence docs/test-evidence/{slug}/{cn-id}/fluxo.gif \
  --feature "{feature}" \
  --test-case {testCaseId} \
  --run-id {runId} \
  --result-id {resultId}
```

**Nunca** usar `create_work_item` com HTML improvisado — o script gera o `ReproSteps` conforme [TEMPLATE-BUG.md](TEMPLATE-BUG.md).

### Checklist do Bug (Template Bug.pdf)

| Seção | Obrigatório |
|--|--|
| Título `[FE/BE] Tela - resumo` | Sim |
| Descrição (impacto + contexto) | Sim |
| Passos para Reproduzir (numerados) | Sim |
| Resultado Esperado | Sim |
| Resultado Atual | Sim |
| Ambiente + Browser + Usuário | Sim |
| Endpoint/API | Se BE ou erro de API |
| Evidências (print anexado) | Sim |
| Severidade (Alta/Média/Baixa) | Sim |

---

## Passo 4b — Regressão e Integração (após o último CN)

Após marcar o último cenário, executar a **Fase de Regressão e Integração** (SENIOR-QA.md):

1. Mapear integrações da feature (módulos que exibem dados, que consomem dados, fluxos encadeados, endpoints compartilhados) a partir da SPEC/ALI/US já carregados
2. Executar REG-xx — smoke-test em módulos relacionados (máx. 5): dados corretos, sem erro de console/network
3. Executar INT-xx — verificar que alterações da feature refletem nos módulos de destino (máx. 5)
4. Bug [INTEGRACAO] se REG ou INT falhar — incluir ambos os módulos no título
5. Publicar veredito REG/INT no chat; incluir tabela no relatório

---

## Passo 5 — Pós-processamento

Após todos os cenários:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/mark-execution-done.mjs \
  --pbi {pbiId} \
  --exec-task {execTaskId} \
  --summary "Passed: N | Failed: M | N/A: K | Bugs: M"
```

---

## Passo 6 — Relatório

| Campo | Valor |
|--|--|
| Ambiente | DEV / TST / HML + URL usada |
| Feature / PBI | título + #id |
| Test Run | #runId + executeUrl |
| Cenários | total / passed / failed / not applicable |
| Evidências | `fluxo.gif` por CN UI + anexos no Test Plan **e no PBI** |
| Massa | pré-condições criadas/ajustadas na sessão (resumo) |
| Ad-hoc | lista ADHOC-xx executados (objetivo + resultado) |
| Vínculos | PBI↔Test Case; Bug↔resultado (se cadastrado) |
| Bugs | #id + URL por falha |
| Gates | status (modo auto) |

---

## Regras absolutas

- **Modo manual:** **sempre** AskQuestion do ambiente (DEV/TST/HML) antes de abrir o browser — salvo se já veio no prompt
- **Sempre** ficha de validação **1×** + ordem **P0→P1→P2** + login **1×** — [SENIOR-QA.md](SENIOR-QA.md)
- **Sempre** na ficha: buscar mensagens no **catálogo MSG** (Descrição) + **US** + **DOC** + **cenários**; esperado UI = Descrição MSG com `<Registro>`/`registro(s)` → feature + concordância — **nunca** Failed só porque a UI ≠ título `MSC_xx - …` da US
- **Sempre** Quality Gate antes de Passed — **nunca** Passed só porque a UI “parece ok”
- **Sempre** nas mensagens de requisito (MSG/MSA/MSC/RN/US/DOC/CN): trocar `<Registro>` / `registro(s)` pelo **nome da funcionalidade** com **concordância** (ex.: `Nenhum registro do filtro encontrada` + feature Ata → `Nenhuma ata do filtro encontrada`). Validar a UI **sem** exigir maiúscula/minúscula. Ver [SENIOR-QA.md](SENIOR-QA.md)
- **Sempre** Bug Hunter (console + network) após ação crítica de CN UI
- **Sempre** anunciar no chat (curto) o que está verificando **antes** de cada CN/ADHOC
- **Sempre** preparar massa quando o CN depender disso — [SENIOR-QA.md](SENIOR-QA.md)
- **Nunca** Failed/N/A só por “não tem massa” se ainda for possível criar/ajustar
- **Sempre** olhar crítico: risco importante fora do plano → ADHOC (máx. 5/sessão)
- **Sempre** Mark Outcome na hora + anexar evidência ao **Test Result do cenário no Test Plans** (`record-test-result.mjs --evidence …`) **e** ao card do PBI (`--pbi` + `--cn`)
- **Nunca** considerar Passed/Failed UI concluído se o script reportar zero anexos no Test Plans (exit 2) — corrigir evidência (preferir `fluxo.png`) e reenviar
- **Nunca** ignorar `execution.runApi` / `runUi` — respeitar estratégia do Test Case
- **Nunca** marcar Passed em **API + UI** se apenas uma camada passou
- **Nunca** marcar Passed UI sem `fluxo.gif` (mín. 2, máx. ~5 frames); API exige `api-response.json`
- **Nunca** usar NotApplicable se SPEC/US/RN/MSG/ALI/DOC tratarem o cenário; N/A só quando **não houver nada** nas docs
- **Nunca** usar N/A para ambiente, permissão, tela que não abriu, “sem massa” ou feature incompleta com RN/US
- **Nunca** usar N/A para ambiente, permissão, tela que não abriu, “sem massa” ou feature incompleta com RN/US
- **Sempre** Protocolo Anti-Falso-Positivo antes de Passed: reload de página + tabela de prova por Então + network check (P0/P1) — SENIOR-QA.md
- **Nunca** Passed apenas porque toast de sucesso apareceu — reload obrigatório para confirmar persistência
- **Sempre** executar Fase de Regressão e Integração (REG-xx + INT-xx) após o último CN — SENIOR-QA.md
- **Nunca** encerrar execução sem publicar lista de integrações verificadas
- **Nunca** abrir Bug fora do padrão [`Template Bug.pdf`](Template%20Bug.pdf) — usar `create-bug-from-failure.mjs` quando for cadastrar no Azure
- **Agente `execute-manual-tests`:** **nunca** criar Bug no Azure **antes** do consentimento do usuário; depois do sim, vincular Bug ao card (`--test-case` / `--bug-id`)
- **Agente `execute-manual-tests-manual`:** não pular Bug em Failed com divergência de RN/SPEC/US ou finding técnico relevante
- **Nunca** modificar `src/` ou código de produção (nem `e2e/` na execução manual)
- **Nunca** inventar comportamento esperado — usar wiki/DOC/cenário/texto fornecido
- Comparar UI real com documentação; se wiki ausente, documentar lacuna no Bug
- Usar modo **Execute** do Test Plans (não apenas Define)
