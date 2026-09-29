*** Keywords ***
Dado que usuário acessa a listagem
    Wait For Elements State    ${LISTAGEM_TITULO}    visible

Quando pesquisa pelo registro existente
    Fill Text    ${LISTAGEM_CAMPO_PESQUISA}    ${PREFIXO_E2E}
    Press Keys    ${LISTAGEM_CAMPO_PESQUISA}    Enter

Então o registro pesquisado deve aparecer na lista
    Wait For Elements State    ${LISTAGEM_LINHA_GRID}    visible

E a mensagem de quantidade de resultados deve estar visível
    Wait For Elements State    ${LISTAGEM_MSG_RESULTADO}    visible
