/** Aliases comuns (SGD_* / SYSTEM_URL / WEB_URL) → BASE_URL, TEST_USER, etc. */
export function applyEnvAliases(): void {
  const url = process.env.BASE_URL || process.env.SYSTEM_URL || process.env.WEB_URL || process.env.SGD_APP_URL
  if (url) process.env.BASE_URL = url
  if (!process.env.API_BASE_URL) {
    process.env.API_BASE_URL = process.env.SGD_API_BASE_URL || process.env.BASE_URL
  }
  if (!process.env.TEST_USER) {
    process.env.TEST_USER = process.env.USERNAME || process.env.SGD_TEST_USER || ''
  }
  if (!process.env.TEST_PASSWORD) {
    process.env.TEST_PASSWORD = process.env.SGD_TEST_PASSWORD || ''
  }
  if (!process.env.AUTH_LOGIN_PATH && process.env.SGD_AUTH_LOGIN_PATH) {
    process.env.AUTH_LOGIN_PATH = process.env.SGD_AUTH_LOGIN_PATH
  }
  if (!process.env.AUTH_BODY_FORMAT && process.env.SGD_AUTH_BODY_FORMAT) {
    process.env.AUTH_BODY_FORMAT = process.env.SGD_AUTH_BODY_FORMAT
  }
}
