import { test } from '@playwright/test'

type Acao = () => void | Promise<void>

export async function dado(descricao: string, acao: Acao): Promise<void> {
  await test.step(`Dado ${descricao}`, acao)
}

export async function quando(descricao: string, acao: Acao): Promise<void> {
  await test.step(`Quando ${descricao}`, acao)
}

export async function entao(descricao: string, acao: Acao): Promise<void> {
  await test.step(`Então ${descricao}`, acao)
}

export async function e(descricao: string, acao: Acao): Promise<void> {
  await test.step(`E ${descricao}`, acao)
}
