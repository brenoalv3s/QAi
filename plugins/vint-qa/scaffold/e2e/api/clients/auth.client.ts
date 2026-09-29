import { APIRequestContext, expect } from '@playwright/test'
import { BaseApiClient } from './base.client'

export type LoginBody =
  | { login: string; senha: string }
  | { email: string; password: string }
  | { usuario: string; senha: string }

export function buildLoginBody(user: string, password: string): LoginBody {
  const format = (process.env.AUTH_BODY_FORMAT ?? 'login').toLowerCase()
  if (format === 'email') return { email: user, password }
  if (format === 'usuario' || format === 'user') return { usuario: user, senha: password }
  return { login: user, senha: password }
}

export function extractTokenFromLoginResponse(data: Record<string, unknown>): string | undefined {
  const nested = data.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d = nested as Record<string, unknown>
    const fromNested = d.token ?? d.accessToken ?? d.access_token
    if (typeof fromNested === 'string') return fromNested
  }
  const direct = data.token ?? data.accessToken ?? data.access_token
  return typeof direct === 'string' ? direct : undefined
}

export class AuthApiClient extends BaseApiClient {
  private token: string | null = null

  constructor(request: APIRequestContext) {
    super(request)
  }

  private loginPath() {
    return process.env.AUTH_LOGIN_PATH ?? '/api/auth/login'
  }

  async executarLogin(credentials?: LoginBody) {
    const user = process.env.TEST_USER ?? ''
    const password = process.env.TEST_PASSWORD ?? ''
    const body = credentials ?? buildLoginBody(user, password)
    return this.request.post(this.apiUrl(this.loginPath()), { data: body })
  }

  async login(credentials?: LoginBody) {
    let token: string | undefined
    await expect(async () => {
      const res = await this.executarLogin(credentials)
      if (!res.ok()) {
        const text = await res.text()
        throw new Error(`Login falhou HTTP ${res.status()}: ${text.slice(0, 300)}`)
      }
      const data = (await res.json()) as Record<string, unknown>
      token = extractTokenFromLoginResponse(data)
      if (!token) throw new Error('Token não retornado pelo login')
    }).toPass({ timeout: 90_000, intervals: [1000, 2000, 3000, 5000] })
    this.token = token!
    return this.token
  }

  authHeaders() {
    if (!this.token) throw new Error('Chame login() antes das requisições autenticadas')
    return { Authorization: `Bearer ${this.token}` }
  }
}
