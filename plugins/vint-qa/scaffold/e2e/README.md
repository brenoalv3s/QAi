# e2e — Playwright

Suíte isolada. Specs importam só `fixtures/main.ts` (BDD). Locators em `locators/`, dados em `data/`, ações no POM.

```
e2e/
├── fixtures/main.ts              ← hub (libs + reexport das páginas)
├── locators/{dominio}/           ← só seletores
├── data/                         ← massa E2E-QA (não vai no spec)
├── pages/{dominio}/              ← ações e asserts
└── tests/{dominio}/ui|api/       ← só Dado / Quando / Então / E
```

```bash
cp .env.example .env   # ou use o .env da raiz do repo
npm install
npx playwright install chromium
npx playwright test
```

Não commitar `.env`.
