/**
 * Autenticação da API da aplicação sob teste — POST {API_BASE_URL}{AUTH_LOGIN_PATH}
 * Token usado nas chamadas Swagger/API. Lê o .env do projeto (nomes SGD_* antigos continuam aceitos).
 */
import '../../../../runtime/lib/project.mjs';

function baseUrl() {
  const url = process.env.API_BASE_URL || process.env.BASE_URL || '';
  if (!url) throw new Error('Defina API_BASE_URL ou BASE_URL no .env do projeto');
  return url.replace(/\/$/, '');
}

function loginPath() {
  return process.env.AUTH_LOGIN_PATH || '/api/auth/login';
}

export function buildLoginBody() {
  if (process.env.AUTH_BODY) {
    return JSON.parse(process.env.AUTH_BODY);
  }
  const user = process.env.TEST_USER;
  const pass = process.env.TEST_PASSWORD;
  if (!user || !pass) throw new Error('Defina TEST_USER e TEST_PASSWORD no .env do projeto (ou AUTH_BODY)');

  const format = (process.env.AUTH_BODY_FORMAT || 'login').toLowerCase();
  if (format === 'email') {
    return { email: user, password: pass };
  }
  if (format === 'usuario' || format === 'user') {
    return { usuario: user, senha: pass };
  }
  return { login: user, senha: pass };
}

/**
 * @returns {Promise<{ token: string, raw: object, baseUrl: string }>}
 */
export async function fetchAuthToken() {
  const url = `${baseUrl()}${loginPath()}`;
  const body = buildLoginBody();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Login não retornou JSON (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`Login falhou (${res.status}): ${text.slice(0, 300)}`);
  }

  const token =
    data.token ||
    data.accessToken ||
    data.access_token ||
    data.data?.token ||
    data.data?.accessToken;

  if (!token) {
    throw new Error(`Token não encontrado na resposta de login. Chaves: ${Object.keys(data).join(', ')}`);
  }

  return { token, raw: data, baseUrl: baseUrl() };
}

export function swaggerUrl() {
  const explicit = process.env.SWAGGER_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return `${baseUrl()}/swagger`;
}

export function swaggerOpenApiUrl() {
  if (process.env.OPENAPI_URL) return process.env.OPENAPI_URL;
  return `${baseUrl()}/swagger/v1/swagger.json`;
}
