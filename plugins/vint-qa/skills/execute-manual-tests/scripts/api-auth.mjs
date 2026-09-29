#!/usr/bin/env node
/**
 * Obtém token JWT via POST /api/auth/login (Swagger).
 * Uso: node api-auth.mjs [--json]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fetchAuthToken, swaggerUrl, swaggerOpenApiUrl } from './lib/api-auth.mjs';

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const savePath = process.env.TOKEN_CACHE || '.vint-qa/cache/auth-token.json';

async function main() {
  const auth = await fetchAuthToken();
  const output = {
    token: auth.token,
    baseUrl: auth.baseUrl,
    swaggerUrl: swaggerUrl(),
    openApiUrl: swaggerOpenApiUrl(),
    obtainedAt: new Date().toISOString(),
  };

  try {
    mkdirSync(dirname(resolve(savePath)), { recursive: true });
    writeFileSync(savePath, JSON.stringify({ ...output, loginResponse: auth.raw }, null, 2));
  } catch {
    /* cache opcional */
  }

  if (jsonOnly) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('AUTH — Token obtido');
  console.log('━━━━━━━━━━━━━━━━━━');
  console.log(`Base URL: ${output.baseUrl}`);
  console.log(`Swagger: ${output.swaggerUrl}`);
  console.log(`Token: ${auth.token.slice(0, 20)}...`);
  console.log(`Cache: ${savePath}`);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
