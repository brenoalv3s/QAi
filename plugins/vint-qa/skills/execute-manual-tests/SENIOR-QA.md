# Postura QA Sênior — execução real, não checklist cego

O agente **não** marca Failed/bloqueado só porque “não tinha massa”. Um QA sênior **prepara o pré-requisito** e **executa o cenário**.

---

## Missão (obrigatória)

**Objetivo:** tentar **provar que a funcionalidade NÃO funciona** — com evidência. Não “confirmar que a tela parece ok”.

- Nunca marcar **Passed** só porque o fluxo “andou” ou a UI “parece correta”.
- Nunca inventar evidência nem resultado esperado (usar SPEC/US/RN/MSG/ALI/DOC/CN).
- Em dúvida entre Passed e Failed → **Failed** (ou Inconclusivo tratado como Failed com comment).
- Passed exige **Quality Gate** completo (seção abaixo).

---

## Protocolo de velocidade (obrigatório)

Meta: menos tokens/tempo **sem** perder profundidade de validação.

| Regra | Como |
|-------|------|
| **Docs 1×** | Carregar wiki/DOC **uma vez** no início. Extrair **ficha de validação** (abaixo). Não re-buscar SPEC/RN a cada CN. |
| **Login 1×** | Autenticar uma vez; reutilizar a sessão do Browser MCP em todos os CNs. |
| **Ordem por risco** | Executar CNs na ordem P0 → P1 → P2 (Risk Engine abaixo). Não seguir ordem aleatória do Test Plan se houver risco alto pendente. |
| **Tela 1×** | Exploração ampla da rota/tela **uma vez** na sessão. Nos CNs seguintes na mesma tela: só o fluxo do CN + Quality Gate. |
| **Transparência curta** | Bloco de 3–4 linhas (não ensaio). Veredito em 1 linha + Quality Gate compacto. |
| **Frames enxutos** | Mín. **2**, máx. **5** frames/CN (exceto falha: incluir frame do erro). Ideal: antes → ação → resultado. |
| **Sonda limitada** | No máx. **1 sonda negativa** por CN (campo vazio / inválido / double-click), se a RN/risco do CN justificar. Não explodir em 10 variações. |
| **ADHOC com freio** | Máx. **5**/sessão; só se impacto real (perda de dados, RN, segurança, bloqueio do fluxo principal). |
| **Mark Outcome na hora** | Registrar e seguir — não acumular vereditos no final. |

### Ficha de validação (gerar 1× após ler a doc)

Antes do 1º CN, publicar no chat (e manter em memória) um resumo estruturado:

```markdown
## Ficha de validação — {feature}
**CAs críticos:** {lista curta US/C.x}
**RNs que quebram fluxo:** {RN-xx …}
**Mensagens esperadas (texto canônico da Descrição MSG):**
| Código | Descrição (req) → esperado UI | Fontes |
|--------|-------------------------------|--------|
| MSC_01 | … | MSG ✅ US ✅ DOC ✅ CN ✅ |
| MSA_01 | … | … |
**Campos obrigatórios / limites:** {resumo SPEC/US/DOC}
**Riscos P0:** {o que mais pode falhar}
**Ordem de execução:** CN-.. (P0), CN-.. (P1), …
```

Usar essa ficha em **todo** Quality Gate. Não reler a wiki inteira.

### Resolução do texto esperado de mensagens (obrigatório)

Para **cada** MSA / MSC / MSE / MSA citada no CN, na US ou no DOC: **buscar o texto completo** nas fontes abaixo **antes** do 1º CN — não improvisar a partir do rótulo curto nem só do Gherkin.

| Ordem | Fonte | O que extrair |
|-------|--------|----------------|
| **1 (canônica)** | Catálogo de requisitos **Mensagens** (wiki MSG: Alertas / Confirmação / Erro) | Campo **Descrição** do código (ex.: `MSC_01`) — **não** só o título `MSC_01 - Cadastro com Sucesso` |
| **2** | **US** da feature | Citação MSA/MSC/MSE e texto literal, se houver |
| **3** | **Documento de teste (DOC)** — wiki + `docs/test-docs/{slug}/` | Mensagens aplicáveis, lacunas de texto |
| **4** | **Cenários de teste** — Test Plans + `docs/test-scenarios/{slug}/` | Código MSG no Então; lacunas / variantes a validar |

**Regras de julgamento:**

1. **Esperado na UI** = **Descrição** do catálogo MSG (ordem 1), após placeholder `<Registro>` / `Registro` → nome da feature + concordância.
2. O **título** da mensagem (`MSC_01 - Cadastro com Sucesso`) **não** é o texto do toast — **proibido** Failed só porque a UI ≠ esse título.
3. Se US/DOC/CN citarem variante diferente da Descrição MSG: anotar na ficha; **gate de mensagem** usa a Descrição MSG; a divergência US↔MSG vira finding/ADHOC ou alinhamento com PO — **não** Failed da UI se ela bater com a Descrição.
4. Se o CN disser só “exibir MSC_01” sem texto: usar o texto já resolvido na ficha (Descrição MSG).
5. Sem catálogo MSG na wiki: usar US → DOC → CN, nessa ordem, e registrar lacuna na ficha.

**Exemplo:** Descrição MSG `MSC_01` = `<Registro> cadastrado com sucesso.` + feature Produto → esperado UI `Produto cadastrado com sucesso.` — toast igual = **Passed** no gate de mensagem.

### Placeholder "Registro" / `<Registro>` nas mensagens (obrigatório)

Nas mensagens de requisito (MSG / MSA / MSC / RN / US / DOC / steps do CN), **`<Registro>`** / **Registro** / **registro** / **Registros** / **registros** é placeholder da entidade. Ao montar a ficha e ao validar a UI: **substituir pelo nome da funcionalidade** e **ajustar a concordância** (gênero e número) das palavras que batem com esse substantivo.

#### 1) Substituir a entidade

| Doc | Feature | Entidade esperada |
|-----|---------|-------------------|
| `registro` / `Registro` / `<Registro>` | Ata | `ata` / `Ata` |
| `registros` / `Registros` / `<Registros>` | Ata | `atas` / `Atas` |
| `registro` / `<Registro>` | Produto | `produto` / `Produto` |

Nome curto da feature (ex.: **Ata**, **Produto**), não o título longo do PBI — salvo se a UI usar o nome longo.

#### 2) Concordância (gênero e número) — obrigatória

Inferir o gênero do nome da feature em português (ex.: **Ata** = feminino; **Produto** / **Pedido** = masculino). Ajustar determinantes, indefinidos e adjetivos que se referem à entidade:

| Padrão (doc, com "registro") | Feature feminina (Ata) | Feature masculina (Produto) |
|------------------------------|------------------------|-----------------------------|
| Nenhum registro … encontrada/o | Nenhuma ata … encontrada | Nenhum produto … encontrado |
| O registro foi … | A ata foi … | O produto foi … |
| Registro cadastrado … | Ata cadastrada … | Produto cadastrado … |
| Registro atualizado / excluído | Ata atualizada / excluída | Produto atualizado / excluído |
| Este registro / Todos os registros | Esta ata / Todas as atas | Este produto / Todos os produtos |

**Exemplos práticos:**

| Na documentação | Feature | Esperado (sentido) |
|-----------------|---------|--------------------|
| `<Registro> cadastrado com sucesso.` | Produto | Produto cadastrado com sucesso. |
| `Registro cadastrado com sucesso` | Produto | Produto cadastrado com sucesso |
| `Nenhum registro do filtro encontrada` | Ata | Nenhuma ata do filtro encontrada |
| `Nenhum registro encontrado` | Produto | Nenhum produto encontrado |
| `Registro atualizado com sucesso` | Ata | Ata atualizada com sucesso |

Lista típica a ajustar junto com a troca: `nenhum/nenhuma`, `o/a`, `os/as`, `este/esta`, `estes/estas`, `todo/toda`, `todos/todas`, `cadastrado(a)`, `atualizado(a)`, `excluído(a)`, `encontrado(a)`, `criado(a)`, `salvo(a)`, `inativado(a)`, etc.

#### 3) Validação na UI — sem exigir maiúscula/minúscula

Ao comparar toast/alerta/confirmação com o esperado:

1. **Ignorar diferenças de caixa** (maiúscula/minúscula). `ATA`, `Ata` e `ata` são equivalentes.
2. Critério de aceite da mensagem: a UI deve exibir o **nome da funcionalidade no lugar de "registro(s)"**, com **concordância coerente** — não o literal genérico “registro”.
3. **Não** marcar Failed só porque a capitalização divergiu da doc ou do exemplo da ficha.
4. **Não** marcar Failed só porque a doc diz “Registro …” e a UI mostra “{Feature} …” (com concordância).
5. **Failed** se a UI ainda mostrar “registro(s)” genérico **ou** o nome da feature sem concordância que mude o sentido (ex.: `Nenhum ata`, `Nenhuma produto`).

**Não** aplicar essa troca em prosa genérica do agente (“criar o registro de massa”); só em **textos de mensagem** vindos dos requisitos.

### Risk Engine (priorização)

Classificar cada CN **antes** de executar (heurística rápida):

| Prioridade | Quando |
|------------|--------|
| **P0** | Bloqueia fluxo principal; validação crítica (CPF, permissão, duplicidade); RN de segurança; perda de dados; **filtro/busca que controla visibilidade de dados sensíveis ou acesso** |
| **P1** | Happy path principal; edição/exclusão; mensagens MSA obrigatórias; API+UI; **filtro/busca novo ou modificado na feature** — exige FILTRO-GATE completo |
| **P2** | Cosmético, opcional, edge de baixo impacto; filtro/histórico já existente e **sem alteração** na entrega atual |

> **Regra crítica — filtros:** qualquer filtro/busca **novo ou modificado** na feature em teste é automaticamente **P1** (nunca P2). Se controlar acesso ou visibilidade de dados confidenciais → **P0**. Classificação P2 para filtros só vale para filtros estáveis sem nenhuma modificação na entrega.

Executar **todos** os CNs informados, mas **nessa ordem**. Se o tempo apertar e o usuário pedir “só o crítico”, fazer só P0+P1.

---

## Protocolo Anti-Falso-Positivo (OBRIGATÓRIO antes de todo Passed)

> **Regra de ouro:** "parece ok" não é evidência. Passed exige prova objetiva e verificável de cada cláusula "Então" do cenário.

### Verificação dupla de estado (obrigatória após qualquer ação crítica)

Após salvar / editar / excluir / transicionar:

1. **Recarregar a página** (`browser_navigate` para a mesma rota) ou **sair e voltar** para a listagem — antes de declarar persistência.
2. Confirmar que o registro aparece (ou desapareceu) na listagem **após o reload**.
3. Se houver detalhe do registro, abrir e confirmar cada campo com o valor esperado.
4. Só então prosseguir para o Quality Gate.

> **Proibido** assumir persistência porque um toast de sucesso apareceu. Toast ≠ dado gravado no banco.

### Prova explícita por cláusula "Então"

Para cada cláusula "Então" do cenário Gherkin, registrar **no chat** antes de marcar Passed:

```markdown
| Cláusula "Então"           | Elemento/valor observado              | Frame      |
|----------------------------|---------------------------------------|------------|
| {texto do Então 1}         | {campo X = valor Y, mensagem Z…}      | frame-03   |
| {texto do Então 2}         | {…}                                   | frame-04   |
```

**Proibido** declarar Passed sem mapear cada cláusula com evidência. Cláusula sem evidência = inconclusivo = **Failed**.

### Verificação de network obrigatória em P0/P1

Para P0 e P1, independente de `runApi`:
- `browser_network_requests` após a ação crítica
- Confirmar que o request retornou **2xx** e que o response é coerente com a UI
- Discrepância entre response da API e o que a UI mostra → **Failed [FE/BE]**

---

## Quality Gate / QA Judge (antes de Passed)

O **executor** (Browser MCP) **não** decide sozinho. Após os steps **e após o Protocolo Anti-Falso-Positivo**, aplicar o gate. **Passed só se todos os itens aplicáveis passarem.**

| # | Sinal | Como checar | Falhou? |
|---|-------|-------------|---------|
| 1 | **Esperado do CN** | Cada “Então” mapeado na tabela de prova explícita (Protocolo Anti-Falso-Positivo) com evidência inequívoca | → Failed |
| 2 | **RN / CA** | Regra da ficha aplicável ao CN respeitada | → Failed |
| 3 | **Mensagem** | MSA/MSC/MSE (se a doc exigir) no momento certo; comparar UI com a **Descrição MSG** da ficha (não o título MSC/MSA); `<Registro>`/`registro(s)` → feature + **concordância**; **case-insensitive** | → Failed |
| 4 | **Persistência** | Reload / re-navegação **após** a ação confirma o estado — toast sozinho não basta | → Failed |
| 5 | **Console** | `browser_console_messages` — sem erro JS **novo** ligado à ação | → Failed ou finding (Bug Hunter) |
| 6 | **Network** | `browser_network_requests` — sem 4xx/5xx inesperado; body coerente com a UI (P0/P1: obrigatório mesmo sem `runApi`) | → Failed ou finding |
| 7 | **API** (se `runApi`) | Status + body conforme RN/Swagger | → Failed |
| 8 | **Consistência de dados** (se filtro/busca) | **Todos** os registros retornados correspondem ao critério aplicado; registros que **não** deveriam aparecer estão ausentes; contagem da UI bate com a lista real — ver **FILTRO-GATE** | → Failed |

**Proibido Passed se:**

- só “não deu erro visível”;
- toast sumiu **sem reload confirmando persistência**;
- POST 201 mas GET/listagem inconsistente;
- console com `TypeError` / uncaught na ação;
- uma camada falhou em estratégia **API + UI**;
- alguma cláusula “Então” sem evidência mapeada na tabela de prova explícita.

**Inconclusivo** (não conseguiu observar o esperado com evidência) → tratar como **Failed** com comment “inconclusivo: {motivo}”, nunca Passed.

### Veredito estruturado (chat, a cada CN)

```markdown
**Resultado {CN}:** Passed | Failed | N/A
**Gate:** esperado ✓/✗ | RN ✓/✗ | msg ✓/✗|n/a | persistência ✓/✗|n/a | console ✓/✗ | network ✓/✗
**Findings:** {nenhum | lista curta}
**Evidência:** fluxo.gif (+ api-response.json se API)
```

---

## Bug Hunter (obrigatório em todo CN com UI)

Depois da ação crítica do CN (salvar, excluir, transição, busca), **antes** do Mark Outcome:

1. `browser_console_messages` — erros/warnings relevantes à ação
2. `browser_network_requests` — falhas HTTP / respostas incoerentes com a UI

Mesmo que o cenário funcional “passe”, registrar finding e abrir Bug (ou listar para consentimento) quando houver:

| Tipo | Exemplos |
|------|----------|
| **Funcional** | Esperado do CN não ocorreu; RN quebrada; mensagem errada/ausente |
| **Técnico** | JS error; HTTP 4xx/5xx; POST ok + listagem vazia; payload inconsistente |
| **UX** | Label cortado que impede uso; disabled sem motivo; loading infinito; feedback ausente |

Sondas rápidas (máx. 1 por CN, se RN/risco P0–P1):

- campo obrigatório vazio → deve bloquear + mensagem;
- dado inválido previsto na RN → deve rejeitar;
- double-click em Salvar → sem duplicar registro (se aplicável).

Finding fora do CN formal → **ADHOC-xx** (respeitar limite) ou Bug avulso com evidência.

---

## FILTRO-GATE — Protocolo obrigatório para filtros e buscas

Sempre que um CN aplicar **filtro, busca ou pesquisa**, executar este protocolo **antes** de marcar Passed. É uma extensão do Quality Gate, não opcional.

### Por que este protocolo existe

O risco real de filtros não é "o filtro não funcionou" — é **"o filtro funcionou superficialmente mas retornou dados incorretos"**. Um humano detecta isso porque confere os resultados; um agente sem este protocolo apenas verifica se a lista não ficou vazia.

### Passo a passo (obrigatório)

| # | Ação | Como verificar | Falhou? |
|---|------|----------------|---------|
| F1 | **Preparar grupo de controle** | Garantir ao menos **1 registro que CORRESPONDE** ao filtro + **1 registro que NÃO corresponde** (criar via UI/API se necessário) | Sem grupo de controle → criar antes de prosseguir |
| F2 | **Aplicar o filtro** | Usar o critério exato do CN (valor, status, data, combo…) | Filtro não aplica / trava → Failed |
| F3 | **Verificar inclusão** | Inspecionar **cada item** retornado (ou amostra de ≥3 em paginação) — todos devem corresponder ao critério | Qualquer item fora do critério → **Failed** |
| F4 | **Verificar exclusão** | O registro do grupo de controle que NÃO corresponde **não deve aparecer** na lista filtrada | Apareceu → **Failed** |
| F5 | **Verificar contagem** | Contador/total exibido na UI bate com o número real de itens listados | Divergência → Failed ou finding |
| F6 | **Limpar filtro** | Remover/resetar o filtro → **todos** os registros devem voltar (incluindo o do grupo de controle) | Itens sumiram → Failed |
| F7 | **API cross-check** (se runApi ou P0/P1) | Chamar o endpoint de busca/filtro diretamente com o mesmo critério; comparar quantidade e conteúdo com a UI | Divergência API×UI → Failed [BE] |
| F8 | **Filtros combinados** (se o CN ou SPEC definir múltiplos filtros) | Testar ao menos 1 combinação de 2+ filtros simultaneamente | Combinação retorna dados errados → Failed |

### Comportamentos obrigatórios

- **Proibido** marcar Passed em CN de filtro sem ter executado F1–F6 (F7 obrigatório se P0/P1).
- Se a lista retornada estiver vazia após o filtro: verificar se é ausência de massa (criar e refiltrar) ou bug real (filtro descarta registros válidos).
- Se a paginação existir: verificar ao menos a 1ª e 2ª páginas — bugs de filtro frequentemente afetam só páginas subsequentes.
- Registrar no veredito quais passos do FILTRO-GATE foram executados e o resultado de cada um.

### Veredito FILTRO-GATE (acrescentar ao veredito Gate padrão)



---

## Princípio — preparação de massa

| Situação no cenário | O que fazer |
|---------------------|-------------|
| **Cadastrar / criar** | Abrir o fluxo de cadastro, preencher campos obrigatórios (SPEC/US), salvar, capturar evidência do registro criado |
| **Editar / alterar** | Localizar o registro (buscar/filtrar); se não existir, **criar** primeiro; então editar |
| **Buscar / filtrar** | Usar a busca da listagem com o critério do CN; se a massa não existir, criar e buscar de novo |
| **Excluir / cancelar** | Garantir registro elegível (criar se preciso), executar exclusão/cancelamento, validar listagem/mensagem |
| **Visualizar / detalhe** | Abrir o registro; criar massa se a listagem estiver vazia para o critério |
| **Histórico** | Abrir histórico do registro; se vazio, provocar uma alteração (edição) e reabrir |
| **Estado / situação específica** (ex.: pedido **Aprovado**) | Se não houver nenhum na listagem → **cadastrar** (ou alterar) até obter esse estado; **só então** validar o CN |
| **Transição de status** | Partir do estado de origem exigido (criar/ajustar massa) e executar a transição |

**Proibido** concluir com Failed/N/A apenas por “não há registro Autorizado” / “não há massa” quando a UI/API **permite** criar ou ajustar esse registro.

**Permitido** Failed/bloqueio somente se, **depois** de tentar criar/ajustar a massa, a aplicação impedir de forma definitiva (bug de combo, 401, RN de permissão, API fora) — documentar a tentativa na evidência e no comment.

---

## Fluxo mental por cenário

```
1. Ler Dado/Quando/Então (usar ficha — não reler wiki)
2. Mapear verbos: cadastrar | editar | **buscar/filtrar** | excluir | visualizar | histórico | transição
3. Checar massa/pré-condição — se CN envolve filtro: **preparar grupo de controle** (1 item que corresponde + 1 que não corresponde)
4. Se faltar → PREPARAR MASSA
5. Executar steps do CN (frames enxutos)
6. Se CN envolve filtro/busca → **FILTRO-GATE** (F1–F6 obrigatório; F7 se P0/P1)
7. BUG HUNTER: console + network (+ 1 sonda se P0/P1)
8. QUALITY GATE → só então Passed/Failed
9. Evidenciar (fluxo.gif) + Mark Outcome + card PBI
```

No chat, ao preparar massa:

```markdown
### Preparação de massa (pré-condição de {CN-id})
**Falta:** {ex.: pedido com situação = Aprovado}
**Ação:** vou cadastrar/ajustar via UI (ou API) antes de validar o cenário.
```

---

## Exemplos

### Reformular a situação de um pedido

- CN pede validar pedido **Aprovado** e a listagem não tem nenhum → **cadastrar pedido** com situação Aprovado (ou o caminho que a RN/SPEC definir) → depois validar o CN.
- CN pede editar situação Aprovado → Faturado → garantir Aprovado (criar se preciso) → editar → evidenciar.
- CN pede histórico → criar/alterar pedido, abrir Histórico, evidenciar.

### Genérico

- “Dado que existe um produto ativo” e a lista está vazia → cadastrar produto ativo.
- “Quando excluo o registro X” e X não existe → criar X → excluir.
- “Então o filtro por status Y retorna…” → criar ao menos um Y se a busca vier vazia por falta de dados, não por bug de filtro.

### Quality Gate (exemplo)

- Cadastro “ok” na UI, mas console `TypeError` no save → **Failed** + Bug técnico (não Passed).
- Toast de sucesso, mas registro não aparece na listagem → **Failed** (persistência).
- CN de CPF inválido: campo aceita e salva → **Failed** (RN).

### FILTRO-GATE (exemplos — caso real que motivou este protocolo)

- CN valida novos filtros de status. Agente aplica filtro, lista retorna itens → **não marcar Passed ainda**. Inspecionar cada item retornado: se algum tiver status diferente do filtrado → **Failed** (F3 inclusão quebrada) + Bug.
- Filtro por data: aplicar, verificar datas de **todos** os registros visíveis; limpar filtro e confirmar que registros fora do range voltam (F6) → qualquer falha = **Failed**.
- Filtro combinado (status + período): criar massa para cada combinação; verificar que a intersecção é correta; API deve retornar o mesmo conjunto que a UI (F7).
- Lista filtrada mostra 5 itens mas contador exibe "8 registros" → **Failed** (F5 — contagem divergente) mesmo que os 5 itens sejam corretos.
- Após limpar filtro, 1 registro que existia antes desaparece da lista → **Failed** (F6 — filtro corrompeu o estado da listagem).

---

## Limites (não forçar o impossível)

- **JOB / batch noturno** (ex.: RN de job diário): N/A ou Failed com comment claro — não inventar execução do job.
- **Permissão inexistente** no perfil de teste após tentativa real de login/ação → Failed + evidência (não N/A se a RN exige a ação).
- **Ambiente quebrado** (login 401, API down) após retry → Failed com bloqueio documentado; tentar perfil alternativo do `.env` se houver.
- **Não** usar dados de produção sensíveis nem destruir massa crítica de outros testers sem necessidade — preferir prefixo QA/`E2E-` no identificador.

---

## Evidência no card (obrigatório a cada CN)

Além do Mark Outcome no Test Plans, **sempre** anexar `fluxo.gif` / `fluxo.png` (e `api-response.json` se API) ao **resultado do cenário no Test Plans** e ao **PBI** da feature:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/record-test-result.mjs \
  --run-id {runId} --result-id {resultId} --outcome Passed|Failed|NotApplicable \
  --evidence docs/test-evidence/{slug}/{cn-id}/fluxo.gif,docs/test-evidence/{slug}/{cn-id}/fluxo.png \
  --pbi {pbiId} --test-case-id {testCaseId} --cn {cnId} \
  [--exec-task {execTaskId}] [--comment "..."]
```

O script anexa no Test Result (Base64, obrigatório em Passed/Failed) **e** no Work Item (PBI). Exit 2 = falha no Test Plans — corrigir e reenviar.

Fallback (só card):

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/attach-evidence-to-work-item.mjs \
  --pbi {pbiId} --evidence docs/test-evidence/{slug}/{cn-id}/fluxo.gif \
  --cn {cnId} --outcome Passed --run-id {runId} [--exec-task {execTaskId}]
```

---

## Fase de Regressão e Integração (obrigatória após todos os CNs da feature)

> **Por que existe:** uma alteração em uma feature pode quebrar funcionalidades que dependem dos mesmos dados, endpoints ou fluxos. Esta fase detecta esses efeitos colaterais antes de encerrar a sessão.

### Quando executar

Após marcar o último CN da feature (todos com Passed, Failed ou N/A), executar esta fase **sempre**, independente dos resultados anteriores.

### Passo 1 — Mapeamento de integrações (a partir da documentação)

Da SPEC / ALI / US carregados na Ficha de Validação, extrair:

| Tipo | O que buscar |
|------|-------------|
| **Módulos que exibem dados** | Listagens, relatórios, dashboards que mostram dados gerados/alterados pela feature |
| **Módulos que consomem dados** | Features que dependem do estado de registros criados/editados por esta feature |
| **Fluxos encadeados** | Transições de status, aprovações, notificações ou jobs que disparam a partir da feature |
| **Endpoints compartilhados** | APIs reutilizadas entre a feature testada e outras telas |

Publicar no chat a lista de integrações identificadas antes de executar os checks.

### Passo 2 — Checks de Regressão (REG-xx)

Para cada módulo/funcionalidade relacionada identificado no passo anterior, executar um **smoke-test rápido** (não um full-test):

```
### REG-{nn} — {Módulo/Funcionalidade Relacionada}
**Integração:** {como se relaciona com a feature testada}
**Check:** {o que verificar em 1–2 steps}
**Resultado:** Passou / Falhou / Não Aplicável
**Evidência:** frame-reg-{nn}.png
```

**O que verificar em cada REG:**

- Dados criados/editados na feature testada **aparecem corretamente** no módulo relacionado
- Dados excluídos na feature **não aparecem mais** no módulo relacionado
- Contagens / totais / agregações foram atualizados corretamente
- Nenhum erro de console/network ao navegar para o módulo relacionado

**Limite:** máx. **5 REG** por sessão (smoke-test, não full-test). Se houver mais integrações, documentar as não verificadas no relatório.

### Passo 3 — Checks de Integração (INT-xx)

Para fluxos **encadeados** (aprovação → pedido, produto → relatório, etc.):

```
### INT-{nn} — {Nome do Fluxo de Integração}
**De:** {feature testada / ação}  →  **Para:** {módulo de destino}
**Check:** {verificar reflexo da alteração no destino}
**Resultado:** Refletiu corretamente / Não refletiu / Não Aplicável
**Evidência:** frame-int-{nn}.png
```

**Critérios de falha em INT:**

- Alteração na feature testada **não refletiu** no módulo de destino
- Módulo de destino exibe dado desatualizado (cache não invalidado, sync falhou)
- API do módulo de destino retorna dado inconsistente com o estado atual da feature

**Se INT falhar:** abrir Bug com contexto de integração (layer: **[INTEGRACAO]**, incluir ambos os módulos no título e na descrição).

### Passo 4 — API cross-check de integrações (se P0/P1 envolvido)

Para qualquer integração crítica (P0/P1), além do check de UI, chamar diretamente a API do módulo relacionado e confirmar que os dados estão sincronizados:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/api-request.mjs \
  --method GET --path /api/{modulo-relacionado}/{id-ou-filtro} \
  --save docs/test-evidence/{slug}/reg-{nn}/api-response.json --json
```

### Veredito de Regressão e Integração (incluir no Relatório final)

```
## Fase Regressão & Integração
**Integrações mapeadas:** {lista}
| Check  | Módulo/Fluxo    | Resultado     | Observação  |
|--------|-----------------|---------------|-------------|
| REG-01 | {módulo}        | OK / FALHOU   | {detalhe}   |
| INT-01 | {fluxo}         | OK / FALHOU   | {detalhe}   |
**Bugs de integração:** {nenhum | lista}
```

### Regras desta fase

- **Sempre** executar após os CNs formais — mesmo que todos passaram
- **Nunca** pular por "não tenho tempo"; reduzir escopo (máx. 3 REG + 2 INT) mas não omitir
- **REG/INT com falha** → Bug marcado como **[INTEGRACAO]** + evidência
- **REG/INT Passed** → screenshot estático (1 frame) basta; GIF não obrigatório
- **Não** encerrar a execução sem ao menos publicar a lista de integrações verificadas
