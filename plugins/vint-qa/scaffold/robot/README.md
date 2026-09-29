# Robot Framework (esteira QA)

Suíte em `e2e/robot/`. Variáveis vêm de `e2e/.env` (modelo `e2e/.env.example`).

## Estrutura

```
e2e/robot/
├── resources/
│   ├── fixtures/main.resource     ← hub: Library + Resource de tudo
│   ├── variables/env.resource     ← URLs, credenciais, PREFIXO_E2E
│   ├── locators/                  ← só seletores (projeto web)
│   │   ├── login.resource
│   │   └── {dominio}/listagem.resource
│   └── keywords/                  ← ações BDD (Dado/Quando/Então/E)
│       ├── setup.resource
│       ├── login.resource
│       └── {dominio}/listagem.resource
└── tests/{dominio}/{operacao}.robot   ← só BDD; Resource = main
```

Todo `.robot` de teste importa **somente** `../../resources/fixtures/main.resource`.
Ao criar um domínio, acrescente os `Resource` de locators e keywords **na main** — nunca no arquivo de teste.

## Proibido no `.robot` de teste

IF/ELSE, locators, variáveis, `Fill Text` / `Click`, literais de massa.

## Executar

```bash
python -m pip install -r e2e/robot/requirements.txt
python -m Browser.entry init
node e2e/robot/run.mjs tests/{dominio}
```
