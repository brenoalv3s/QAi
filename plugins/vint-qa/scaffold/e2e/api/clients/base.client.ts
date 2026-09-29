import { APIRequestContext, expect } from '@playwright/test'

export class BaseApiClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected apiUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path
    const base = (process.env.API_BASE_URL ?? '').replace(/\/$/, '')
    if (!base) return path
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
  }

  protected async parseJson<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    expect(response.ok(), `HTTP ${response.status()} — ${response.url()}`).toBeTruthy()
    return response.json() as Promise<T>
  }
}
