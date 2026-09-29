*** Keywords ***
Abrir Aplicacao
    New Browser    chromium    headless=True
    New Context    viewport={'width': ${VIEWPORT_LARGURA}, 'height': ${VIEWPORT_ALTURA}}
    New Page       ${BASE_URL}

Fazer Login
    Fill Text    ${LOGIN_CAMPO_USUARIO}    ${TEST_USER}
    Fill Text    ${LOGIN_CAMPO_SENHA}      ${TEST_PASSWORD}
    Click        ${LOGIN_BOTAO_ENTRAR}
    Wait For Elements State    ${LOGIN_PAGINA_LOGADA}    visible
