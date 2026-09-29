# Categorias de Cenários — Guia de Geração

Mapeamento entre categorias de cobertura QA e cenários no template `[CN-xx]`.

**Missão do designer:** o happy path sozinho **não** é cobertura. Antes de escrever, inventariar a SPEC e gerar cenários que tentem **quebrar** a feature (validação, borda, negativo).

---

## Inventário obrigatório (antes de gerar)

Extrair da SPEC/US/RN/MSG e listar no chat (e no cabeçalho do `.md` se útil):

| Fonte na doc | O que extrair | Cenários mínimos |
|--------------|---------------|------------------|
| Campos obrigatórios | nome do campo | 1× vazio/omitido por campo (ou grupo no mesmo form, se MSG única) |
| Máx./mín. de caracteres / maxlength | limite N | 1× no limite (N) + 1× acima (N+1) — rejeitar ou truncar conforme RN |
| Formato (CPF, e-mail, telefone, máscara) | regra | 1× inválido |
| Datas / períodos | campos data | 1× inválida (ex.: 32/13/2020, texto) + 1× fora do range se RN houver (início > fim) |
| Upload / anexo | limite MB, tipos | 1× acima do limite (ex.: **> 25MB** se SPEC disser 25MB) + 1× tipo não permitido se documentado |
| Valores numéricos | min/max | 1× no limite + 1× além do limite |
| Listas / enums | opções | 1× valor fora da lista se a UI permitir digitar |
| RN_xx | cada regra | 1× por RN |
| MSA/MSC | cada mensagem citada | 1× por código |
| Perfis / C.2 | permissão | ≥ 1 sem permissão |

Se a SPEC **não** informar o limite (ex.: “tamanho máximo”), **não inventar** o número — gerar cenário genérico só se a US/RN mencionar validação, ou registrar lacuna `⚠️ limite de {campo} não documentado — validar com PO`.

---

## 1. Caminho feliz

| Atributo | Valor |
|--|--|
| Quantidade | ≥ 1 por US/sub-funcionalidade |
| Criticidade | Muito Alta |
| Estratégia | UI (ou API+UI se integração) |
| Título | `{Feature} - {Ação principal} - Sucesso` |
| Steps | Dado perfil autorizado + massa válida → Quando ação principal → Então resultado conforme C.x da US |

---

## 2. Validação de campos (obrigatória se houver formulário/filtros na SPEC)

| Atributo | Valor |
|--|--|
| Quantidade | Conforme inventário (não “1 genérico por feature”) |
| Criticidade | Média (Alta se campo crítico: CPF, valor, upload) |
| Estratégia | UI (API+UI se a validação for de contrato) |
| Título | `{Feature} - Campo {nome} {vazio\|inválido\|acima do limite} - Mensagem/bloqueio` |

### Subtipos obrigatórios quando a SPEC descreve o campo

| Subtipo | Quando gerar | Exemplo de Então |
|---------|--------------|------------------|
| **Obrigatório vazio** | Campo marcado obrigatório | Mensagem MSA/inline; não salva |
| **Formato inválido** | Máscara/tipo (CPF, e-mail, etc.) | Rejeita + mensagem |
| **Tamanho de caracteres** | maxlength / “até N caracteres” na SPEC | N aceito (se RN); N+1 bloqueado ou conforme RN |
| **Data inválida** | Campo data/período | Não aceita data impossível / formato errado |
| **Período inconsistente** | Data início/fim | Início > fim → erro |
| **Upload tamanho** | Limite em MB (ex.: 25MB) | Arquivo **maior que o limite** → bloqueio + mensagem |
| **Upload tipo** | Extensões permitidas | Tipo fora da lista → bloqueio |

**Proibido** entregar só happy path + 1 “campo vazio” genérico quando a SPEC lista vários campos com limites.

---

## 3. Regras de negócio

| Atributo | Valor |
|--|--|
| Quantidade | 1 por **RN_xx** identificada na wiki |
| Criticidade | Alta |
| Estratégia | UI ou UI + BD (SQL) quando persistência importa |
| Título | `{Feature} - {Comportamento RN_xx} - {Resultado}` |
| Steps | Referenciar **RN_xx** no Dado ou Então; massa que force a regra |

---

## 4. Mensagens de feedback

| Atributo | Valor |
|--|--|
| Quantidade | 1 por **MSA_xx**, **MSC_xx** ou toast documentado |
| Criticidade | Média |
| Estratégia | UI |
| Título | `{Feature} - {Ação} - Exibe {código mensagem}` |
| Steps | Quando ação dispara mensagem → Então texto conforme catálogo Mensagens de Alerta/Confirmação |

---

## 5. Autenticação / permissão

| Atributo | Valor |
|--|--|
| Quantidade | ≥ 1 se US mencionar perfil, C.2 ou controle de acesso |
| Criticidade | Alta |
| Estratégia | UI |
| Título | `{Feature} - Acesso sem permissão - Bloqueio MSA_02` |
| Steps | Dado usuário sem perfil → Quando acessar rota/menu → Então bloqueio ou redirecionamento |

---

## 6. Estados de UI

| Atributo | Valor |
|--|--|
| Quantidade | ≥ 1 para busca vazia (MSA_09) e loading quando aplicável |
| Criticidade | Média / Baixa |
| Estratégia | UI |
| Título | `{Feature} - Busca sem resultados - Exibe MSA_09` |
| Steps | Dado filtros que não retornam dados → Quando buscar → Então mensagem MSA_09 |

---

## 7. Segurança

| Atributo | Valor |
|--|--|
| Quantidade | ≥ 1 se houver campo texto livre ou busca |
| Criticidade | Alta |
| Estratégia | UI |
| Título | `{Feature} - Entrada XSS em {campo} - Script não executado` |
| Steps | Quando inserir payload `<script>alert(1)</script>` → Então exibido como texto, não executado |

---

## 8. Dados de borda / partição (obrigatória se SPEC tiver limites)

| Atributo | Valor |
|--|--|
| Quantidade | Por campo com limite documentado: **no limite** + **além do limite** (mín. 2) |
| Criticidade | Média (Alta se valor financeiro / upload / chave) |
| Estratégia | UI |
| Título | `{Feature} - {Campo} limite {N} / acima de {N} - Aceito/Rejeitado` |

Exemplos típicos (só se documentados):

- Texto com exatamente N caracteres vs N+1
- Arquivo com tamanho = limite vs limite+1 byte/MB
- Data no range vs fora do range
- Quantidade 0 / 1 / máximo

---

## 9. Regressão E2E

| Atributo | Valor |
|--|--|
| Quantidade | 1 smoke completo quando feature tem CRUD |
| Criticidade | Muito Alta |
| Estratégia | UI ou UI + BD (SQL) |
| Título | `{Feature} - Fluxo completo CRUD - Dados consistentes` |
| Steps | Criar → consultar → editar → excluir (ou subconjunto documentado na US) |

---

## 10. Negativo / abuso (quando aplicável)

| Atributo | Valor |
|--|--|
| Quantidade | ≥ 1 se houver Salvar/Enviar crítico |
| Criticidade | Média / Alta |
| Estratégia | UI |
| Título | `{Feature} - Double-submit em Salvar - Sem duplicar` |
| Steps | Quando clicar Salvar duas vezes rápido → Então um registro (ou bloqueio) conforme RN |

---

## Fidelidade aos requisitos

Todo CN novo **deve** apontar para fonte da wiki (C.x, RN_xx, MSA/MSC, campo SPEC).  
**Proibido** gerar cenário “por hábito de QA” sem o requisito documentado.  
Item do inventário sem documentação → `⚠️ lacuna` — **não** inventar o comportamento.

## Cenários já existentes → só gaps

Quando `analyze-existing-scenarios.mjs` retornar `append-gaps`:

1. Não recriar o arquivo nem renumerar CNs antigos.
2. Cruzar inventário × CNs existentes (título/steps/`coverageHints`).
3. Gerar **apenas** o que falta **e** está na wiki.
4. Continuar numeração em `nextCnHint`.
5. Se o gate já passar → zero CNs novos (reportar cobertura completa).


---

## 11. Filtros, buscas e pesquisas (obrigatória se SPEC descrever filtro/busca novo ou modificado)

| Atributo | Valor |
|--|--|
| Quantidade | ≥1 inclusão + ≥1 exclusão (grupo de controle) + limpar filtro + busca sem resultados + combinação (se SPEC definir múltiplos filtros) |
| Criticidade | Alta (dados sensíveis: Muito Alta) |
| Estratégia | UI (+ API se endpoint de busca documentado no ALI/Swagger) |
| Risco | **P1 mínimo** para filtro novo/modificado; **P0** se controlar acesso ou visibilidade de dados |

### Sub-cenários obrigatórios

| Sub-cenário | Título modelo | Quando gerar |
|--|--|--|
| **Inclusão** | `{Feature} - Filtrar por {critério} - Todos os resultados correspondem` | Sempre que SPEC descrever filtro/busca novo ou modificado |
| **Exclusão** | `{Feature} - Filtrar por {critério} - Dados fora do critério não são exibidos` | Sempre — criar registro de controle propositalmente diferente do filtro |
| **Contagem** | `{Feature} - Filtrar por {critério} - Total exibido corresponde à lista retornada` | Quando UI exibir contador ou paginação |
| **Limpar filtro** | `{Feature} - Remover filtro - Lista retorna ao estado original` | Quando houver botão limpar/resetar |
| **Busca vazia** | `{Feature} - Busca sem correspondência - Exibe estado vazio / MSA_09` | Quando SPEC mencionar estado vazio ou MSA_09 |
| **Combinação** | `{Feature} - Aplicar {N} filtros simultaneamente - Resultados respeitam todos os critérios` | Quando SPEC descrever 2+ filtros simultâneos |
| **API cross-check** | `{Feature} - Endpoint de busca com critério - Retorno API coincide com UI` | Quando ALI/Swagger documentar endpoint de pesquisa |

### Steps-modelo (inclusão + exclusão)

```gherkin
Dado que existem registros com {critério X} e registros com {critério Y ≠ X}
Quando o usuário aplica o filtro por {critério X}
Então todos os registros exibidos possuem {critério X}
E registros com {critério Y} não aparecem na listagem
E o contador exibido corresponde ao número de registros listados
```

> **Proibido:** gerar apenas o cenário feliz de filtro (“filtro retorna resultados”) sem o cenário de exclusão. A ausência do cenário de exclusão é o gap que permite que bugs de filtro passem despercebidos.
## Gate de cobertura (antes de salvar o `.md`)

Não entregar se falhar algum item aplicável **ainda não coberto**:

- [ ] Inventário de campos/limites/uploads/datas feito a partir da SPEC
- [ ] ≥ 1 caminho feliz (existente ou novo)
- [ ] Validações: vazios + formatos + **tamanhos de caracteres** citados na SPEC
- [ ] **Datas inválidas / período** se houver campo data
- [ ] **Upload acima do limite MB** se houver anexo com tamanho na SPEC
- [ ] 1 cenário por RN_xx
- [ ] MSA/MSC citados cobertos
- [ ] Permissão se US/C.2
- [ ] Relatório de cobertura por categoria no final (incluir contagem de validação/borda)
- [ ] **Filtros/buscas (se SPEC descrever filtro/busca novo ou modificado):** ≥1 cenário de inclusão + ≥1 de exclusão (grupo de controle) + limpar filtro; API cross-check se endpoint documentado
- [ ] Gaps listados com fonte wiki; nenhum CN especulativo

No relatório final, explicitar:

```
Validação/borda:
  Campos obrigatórios cobertos: {n}/{total}
  Limites de caracteres: {n}
  Datas inválidas/período: {n}
  Upload (tamanho/tipo): {n}
  Lacunas (não documentado na wiki): {lista}
```

---

## Priorização quando a wiki é parcial

1. Critérios **C.x** da US — sempre gerar cenário
2. **RN_xx** listadas — sempre gerar cenário
3. **MSA_xx / MSC_xx** citados — sempre gerar cenário
4. Categorias **1 (feliz)**, **2 (validação)**, **8 (borda)** — obrigatórias quando a SPEC descreve formulário, campos, datas ou upload
5. Categorias 5 e 9 — obrigatórias para features com UI / CRUD
6. Demais — gerar quando aplicável

Lacunas: incluir no cabeçalho do documento `⚠️ {página ou limite} não encontrada — validar com PO`.
**Nunca inventar** o valor do limite (ex.: 25MB) se a wiki não disser — usar o valor **somente** se estiver na SPEC/RN/US.
