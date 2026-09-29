*** Variables ***
# Apenas seletores. Keywords usam estas variáveis — nunca o arquivo .robot de teste.
${LOGIN_CAMPO_USUARIO}    css=input >> nth=0
${LOGIN_CAMPO_SENHA}      css=input[type="password"]
${LOGIN_BOTAO_ENTRAR}     css=button >> nth=0
${LOGIN_PAGINA_LOGADA}    css=body
