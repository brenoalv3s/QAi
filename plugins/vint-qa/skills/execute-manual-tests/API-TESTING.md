# Testes via API — Swagger da aplicação

Cenários com **Estratégia Técnica** `API` ou `API + UI` devem ser validados também (ou exclusivamente) via chamadas HTTP diretas, usando o **Swagger** como referência de endpoints.

---

## Roteamento por estratégia

| Estratégia (Test Plan) | Valor ADO | Execução |
|--|--|--|
| **UI** | `2. UI` | Somente browser MCP |
| **API** | `1. API` | Somente chamadas HTTP (Swagger) |
| **API + UI** | `5. API + UI` | API **e** browser MCP — ambos devem passar |

O campo vem do Test Case: `Custom.e3b1ecaf-933e-421c-9e1e-cfb8311b4b16`.

`list-feature-scenarios.mjs` retorna por cenário:

```json
{
  "strategy": "api_ui",
  "strategyLabel": "API + UI",
  "execution": { "runApi": true, "runUi": true }
}
```

---

## Autenticação (obrigatória para API)

Token obtido em **`POST /api/auth/login`** com JSON de usuário e senha:

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/api-auth.mjs --json
```

### Variáveis de ambiente

| Variável | Descrição | Padrão |
|--|--|--|
| `API_BASE_URL` | Base da API HML | `BASE_URL` |
| `AUTH_LOGIN_PATH` | Path de login | `/api/auth/login` |
| `TEST_USER` | Usuário de teste | — |
| `TEST_PASSWORD` | Senha de teste | — |
| `AUTH_BODY_FORMAT` | `email` ou `usuario` | `email` |
| `AUTH_BODY` | JSON customizado (substitui user/pass) | — |

**Body padrão (email):**

```json
{ "email": "gestor@teste", "password": "senha" }
```

**Body alternativo (usuario):**

```json
{ "usuario": "gestor@teste", "senha": "senha" }
```

Defina `AUTH_BODY_FORMAT=usuario` ou passe `AUTH_BODY` completo.

---

## Swagger / OpenAPI

| Variável | Descrição | Padrão |
|--|--|--|
| `SWAGGER_URL` | UI Swagger | `{base}/swagger` |
| `OPENAPI_URL` | JSON OpenAPI | `{base}/swagger/v1/swagger.json` |

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/fetch-swagger.mjs --json
```

O agente deve:
1. Consultar OpenAPI para localizar endpoint do cenário (SPEC/ALI + Swagger)
2. Montar request (method, path, body, query) conforme documentação
3. Executar via `api-request.mjs`

---

## Executar chamada API

```bash
node "$HOME/.vint-qa/vqa.mjs" skills/execute-manual-tests/scripts/api-request.mjs \
  --method POST \
  --path /api/relatorios/vendas \
  --body '{"produtoId":1}' \
  --save docs/test-evidence/{slug}/{cn-id}/api-response.json \
  --json
```

Token: reutiliza cache em `.cache/auth-token.json` ou obtém novo via `api-auth.mjs`.

---

## Fluxo por cenário

### Estratégia API

1. `api-auth.mjs` → token
2. `fetch-swagger.mjs` → localizar endpoint
3. Executar steps do cenário como chamadas HTTP
4. Validar status + body contra RN/SPEC/US
5. Evidência: `api-response.json` (+ screenshot do Swagger opcional)
6. `record-test-result.mjs` com evidência JSON

### Estratégia API + UI

1. **API primeiro** — validar contrato/dados no backend
2. **UI depois** — validar que a tela reflete o mesmo comportamento
3. **Passed** somente se **ambos** passarem
4. Evidências: `api-response.json` **e** screenshot da UI

### Estratégia UI

Somente browser MCP (fluxo anterior).

---

## Bug em falha de API

- `--layer BE` quando falha for só na API
- `--layer FE` quando falha for só na UI
- API + UI com falha em ambos: preferir **BE** se dados/contrato incorretos; **FE** se UI não reflete API correta
- `--endpoint` com method + path executado
- `--logs` com trecho do response JSON

---

## Checklist API

- [ ] Token obtido via `/api/auth/login`
- [ ] Endpoint identificado no Swagger/OpenAPI
- [ ] Request com Bearer token
- [ ] Response validado contra RN/SPEC
- [ ] Evidência JSON salva e anexada ao Test Run
- [ ] API + UI: ambas as camadas validadas antes de Passed
