*** Settings ***
Documentation    Hub da suíte Robot. Toda suíte .robot importa só este arquivo.
...              Bibliotecas, variáveis, locators (web) e keywords ficam aqui.
...              Ao criar um domínio novo, acrescente os Resources abaixo — não
...              importe locators/variáveis direto no arquivo de teste.

Library          Browser
Library          OperatingSystem
Library          Collections
Library          String

# Variáveis (URLs, credenciais, massa E2E-QA)
Resource         ../variables/env.resource

# Locators web (somente seletores — sem ações)
Resource         ../locators/login.resource

# Keywords (ações / BDD). IF/ELSE e locators não vão para o .robot de teste.
Resource         ../keywords/setup.resource
Resource         ../keywords/login.resource

# Domínios — descomente / acrescente ao gerar a feature:
# Resource         ../locators/{dominio}/listagem.resource
# Resource         ../locators/{dominio}/cadastro.resource
# Resource         ../keywords/{dominio}/listagem.resource
# Resource         ../keywords/{dominio}/cadastro.resource
