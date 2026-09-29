# Heurísticas de QA

Referência rápida usada ao gerar cenários e ao executar testes manuais. Complementa `skills/create-test-scenarios/CATEGORIES.md` e `skills/execute-manual-tests/SENIOR-QA.md`.

## Campos de formulário

- Obrigatoriedade: vazio, só espaços, valor removido após preenchido
- Limites: mínimo, máximo, máximo + 1; colar texto maior que o limite
- Formato: máscara (CPF, CNPJ, telefone, data), caracteres especiais, acentos, emoji
- Unicidade: duplicado exato, duplicado com caixa/acentos/espaços diferentes

## Listagem e busca

- Filtro sem resultado deve mostrar estado vazio, não erro
- Filtro precisa realmente restringir: comparar a lista antes e depois; nunca aprovar só porque a lista não ficou vazia
- Combinação de filtros, limpar filtros, paginação após filtrar, ordenação por coluna
- Busca parcial, com acento e sem acento, maiúsculas e minúsculas

## Fluxos de CRUD

- Cadastrar → aparece na listagem com os valores exatos
- Editar → persiste após recarregar a página
- Excluir → confirmação; item some; exclusão de item em uso (vínculos)
- Cancelar em cada etapa não deve persistir nada

## Permissões e sessão

- Usuário sem permissão não vê o botão **e** a API recusa (403)
- Usuário inativo ou excluído não autentica
- Sessão expirada durante o preenchimento de um formulário

## API

- Status esperado por cenário (200/201/204/400/401/403/404/409/422)
- Corpo de erro com mensagem compreensível
- Campos obrigatórios ausentes no payload; tipos errados; IDs inexistentes

## Evidência

- Um GIF ou print por cenário, mostrando o estado final que prova o resultado
- Em falha: passos exatos, massa usada, ambiente, resultado esperado × obtido
