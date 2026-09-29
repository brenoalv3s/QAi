# Robot Framework — arquitetura BDD

Usado por `@generate-regression-automation-manual` quando o framework é **Robot**.

Template: `{VINT_QA_ROOT}/scaffold/robot/` (ou `node "$HOME/.vint-qa/vqa.mjs" scaffold --framework robot`).

## Estrutura

```
e2e/robot/
├── resources/
│   ├── fixtures/main.resource      ← hub: Library + todos os Resource
│   ├── variables/env.resource      ← URLs, credenciais, PREFIXO_E2E
│   ├── locators/                   ← só seletores (projeto web)
│   │   ├── login.resource
│   │   └── {dominio}/listagem.resource
│   └── keywords/                   ← ações BDD (podem ter IF/ELSE)
│       ├── setup.resource
│       ├── login.resource
│       └── {dominio}/listagem.resource
└── tests/{dominio}/{operacao}.robot
```

API Robot (sem UI): não criar `locators/`. Keywords de request em `keywords/{dominio}/`.

## Arquivo `main.resource` (obrigatório)

Concentra **libs**, caminhos de **variáveis**, **locators** e **keywords**. Toda suíte `.robot` importa **somente** este arquivo:

```
Resource         ../../resources/fixtures/main.resource
```

Ao criar um domínio, **acrescente** na main (não no teste):

```
Resource         ../locators/{dominio}/listagem.resource
Resource         ../keywords/{dominio}/listagem.resource
```

## Arquivo de teste (só BDD)

```
*** Settings ***
Documentation    …
Resource         ../../resources/fixtures/main.resource

Suite Setup       Preparar Ambiente De Teste
Test Teardown     Capturar Screenshot Se Teste Falhou
Suite Teardown    Encerrar Sessao

*** Test Cases ***
Buscar convênio existente retorna resultado e aviso de cobertura
    [Documentation]    Card 427829 — …
    [Tags]             convenios    pesquisa    smoke    card-427829
    Dado que usuário acessa página de convênios
    Quando digita nome de convênio na barra de pesquisa (ex: Bradesco Saude)
    Então a busca deve retornar o convênio pesquisado
    E deve ser possível visualizar mensagem "1 resultado encontrado"
    E o aviso de cobertura 'A cobertura varia de acordo com o seu plano' deve estar visível
```

## Proibido no `.robot` de teste

- IF / ELSE / Run Keyword If
- Locators (`css=`, `xpath=`, `${LISTAGEM_…}`)
- `*** Variables ***`
- `Fill Text`, `Click`, `Wait For Elements State`
- Literais de massa (URL, usuário, `E2E-QA-…`) — ficam em `variables/` ou keywords

Esses itens vivem em `locators/`, `variables/` e `keywords/`.

## Reuso

Não recriar `main.resource`, `setup.resource` ou `login.resource`. Só criar o que falta e apontar na main.
