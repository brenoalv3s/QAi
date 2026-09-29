import { test as base } from '@playwright/test'
import { AuthApiClient } from '../../api/clients/auth.client'

type ApiFixtures = {
  authClient: AuthApiClient
  apiToken: string
}

export const test = base.extend<ApiFixtures>({
  authClient: async ({ request }, use) => {
    await use(new AuthApiClient(request))
  },
  apiToken: async ({ authClient }, use) => {
    const token = await authClient.login()
    await use(token)
  },
})

export { expect } from '@playwright/test'
