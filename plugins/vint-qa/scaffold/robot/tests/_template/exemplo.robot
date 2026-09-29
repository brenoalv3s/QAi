*** Settings ***
Documentation    Exemplo de suíte BDD. Copie para tests/{dominio}/{operacao}.robot.
...              Proibido neste arquivo: IF/ELSE, locators, variáveis, Fill/Click.
Resource         ../../resources/fixtures/main.resource

Suite Setup       Preparar Ambiente De Teste
Test Teardown     Capturar Screenshot Se Teste Falhou
Suite Teardown    Encerrar Sessao

*** Test Cases ***
Buscar registro existente retorna resultado
    [Documentation]    Valida pesquisa na listagem.
    ...                Pré-condição: usuário autenticado (Suite Setup).
    [Tags]             exemplo    pesquisa    smoke
    Dado que usuário acessa a listagem
    Quando pesquisa pelo registro existente
    Então o registro pesquisado deve aparecer na lista
    E a mensagem de quantidade de resultados deve estar visível
