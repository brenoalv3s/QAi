*** Keywords ***
Preparar Ambiente De Teste
    Abrir Aplicacao
    Fazer Login

Capturar Screenshot Se Teste Falhou
    Run Keyword If    '${TEST_STATUS}' == 'FAIL'    Take Screenshot

Encerrar Sessao
    Close Browser
