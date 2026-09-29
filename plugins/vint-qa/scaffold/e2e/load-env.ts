/** Aliases comuns (SYSTEM_URL / WEB_URL / USERNAME) → BASE_URL, API_BASE_URL, TEST_USER. */
export function applyEnvAliases(): void {
  const url = process.env.BASE_URL || process.env.SYSTEM_URL || process.env.WEB_URL
  if (url) process.env.BASE_URL = url
  if (!process.env.API_BASE_URL) {
    process.env.API_BASE_URL = process.env.BASE_URL
  }
  if (!process.env.TEST_USER) {
    process.env.TEST_USER = process.env.USERNAME || ''
  }
  if (!process.env.TEST_PASSWORD) {
    process.env.TEST_PASSWORD = ''
  }
}
