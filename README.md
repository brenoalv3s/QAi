# vint-qa — marketplace de plugins de QA da Vint Global

Repositório do plugin **vint-qa** para o Cursor. Depois de publicado no marketplace do time, qualquer pessoa da equipe abre **qualquer projeto**, digita `/vint-qa` no chat e tem a esteira de QA completa, sem copiar pastas `.cursor/` nem baixar este repositório.

```text
.
├── .cursor-plugin/marketplace.json   # catálogo do marketplace (lido pelo Cursor)
├── plugins/vint-qa/                  # o plugin (ver plugins/vint-qa/README.md)
├── tools/
│   ├── validate-plugin.mjs           # validação estática (manifestos, frontmatter, segredos, sintaxe)
│   ├── smoke-test.mjs                # fluxo completo num projeto e HOME temporários
│   └── install-local.mjs             # instalação local sem marketplace
├── .github/workflows/validate.yml    # roda validate + smoke em PRs e na branch main
└── CHANGELOG.md
```

## Publicar para toda a empresa (uma vez, por um admin do Cursor)

Repositório: [github.com/brenoalv3s/QAi](https://github.com/brenoalv3s/QAi). Exige plano **Teams** (1 marketplace) ou **Enterprise** (ilimitados) no Cursor.

1. Instalar o **GitHub App do Cursor** com acesso ao repositório `brenoalv3s/QAi` (necessário para repositório privado e para o Auto Refresh).
2. No [dashboard do Cursor](https://cursor.com/dashboard) → **Plugins & MCPs** → **Team Marketplaces** → **Add Marketplace** → **Import from Repo** → colar `https://github.com/brenoalv3s/QAi`.
3. No plugin `vint-qa` detectado → **Add to Marketplace**.
4. Em **Marketplace Settings**:
   - **Marketplace Access**: toda a organização (ou os grupos desejados)
   - **Enable Auto Refresh**: ligado — cada push na `main` publica a nova versão para todos (em até ~10 min)
   - Se o repositório for privado e nem todos tiverem acesso a ele no GitHub, ativar **Serve marketplace from Cursor**
5. Política de instalação do `vint-qa`:
   - **Required** — instalado para todos, sem opção de remover (recomendado para o squad de QA)
   - **Default On** — instalado para todos, cada pessoa pode desligar
   - **Default Off** — disponível em **Customize** para quem quiser instalar
6. Salvar. Cada pessoa: reiniciar o Cursor, abrir um projeto e rodar `/vint-qa` num chat novo.

### Publicar uma nova versão

1. Pull request com as mudanças → CI verde (`validate-plugin` + `smoke-test`).
2. Subir `version` em `plugins/vint-qa/.cursor-plugin/plugin.json` e registrar no `CHANGELOG.md`.
3. Merge na `main`. Com Auto Refresh, o time recebe a versão sozinho; sem ele, **Team Marketplaces** → **Refresh**.

## Sem plano Teams/Enterprise

Cada pessoa pode adicionar o marketplace pela CLI do Cursor e instalar o plugin com `/plugin`:

```bash
agent plugin marketplace add https://github.com/brenoalv3s/QAi
```

Ou usar a instalação local abaixo.

## Instalação local (sem marketplace)

Para testar antes de publicar, ou para quem ainda não tem acesso ao marketplace do time:

```bash
git clone https://github.com/brenoalv3s/QAi.git
cd QAi
node tools/install-local.mjs          # copia para ~/.cursor/plugins/local/vint-qa
node tools/install-local.mjs --link   # link para desenvolver o plugin (mudanças valem na hora)
node tools/install-local.mjs --uninstall
```

Depois: reiniciar o Cursor (ou **Developer: Reload Window**) e rodar `/vint-qa` num chat novo.

## Desenvolvimento

```bash
node tools/validate-plugin.mjs   # deve terminar com 0 erro(s)
node tools/smoke-test.mjs        # deve terminar com 0 falha(s); --keep preserva a pasta temporária
```

Regras do repositório:

- Nenhum valor de projeto fixo em código: tudo vem de `.hub-projeto.json` e `.env` do projeto do usuário (o validador acusa `vintglobal`, `SGD - Sistema` etc. em `.mjs`)
- Caminhos do plugin em Markdown usam `{VINT_QA_ROOT}`; scripts são chamados via `node "$HOME/.vint-qa/vqa.mjs" skills/...`
- Nunca commitar `.env`, tokens, `.cursor/mcp.json` ou `.vint-qa/cache/`
- Arquivos de texto com fim de linha LF (`.gitattributes`)

## Requisitos de quem usa

- Cursor com acesso ao marketplace do time (ou instalação local)
- Node.js 18+ (o `/vint-qa` verifica e instala o restante: git, Python, uv, Chromium do Playwright, ffmpeg)
