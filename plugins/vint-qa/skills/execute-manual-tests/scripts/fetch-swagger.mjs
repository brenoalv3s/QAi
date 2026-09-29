#!/usr/bin/env node
/**
 * Baixa OpenAPI/Swagger para consulta de endpoints.
 * Uso: node fetch-swagger.mjs [--json] [--save path.json]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { swaggerOpenApiUrl, swaggerUrl } from './lib/api-auth.mjs';

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const saveIdx = args.indexOf('--save');
const savePath = saveIdx >= 0 ? args[saveIdx + 1] : '.vint-qa/cache/openapi.json';

async function main() {
  const openApiUrl = swaggerOpenApiUrl();
  const res = await fetch(openApiUrl, { headers: { Accept: 'application/json' } });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`OpenAPI ${openApiUrl} → ${res.status}. Tente definir OPENAPI_URL no .env ou consultar ${swaggerUrl()}`);
  }

  const spec = JSON.parse(text);
  const paths = Object.keys(spec.paths || {});
  const output = {
    openApiUrl,
    swaggerUi: swaggerUrl(),
    title: spec.info?.title,
    version: spec.info?.version,
    pathCount: paths.length,
    paths: paths.slice(0, 100),
    spec,
  };

  mkdirSync(dirname(resolve(savePath)), { recursive: true });
  writeFileSync(savePath, JSON.stringify(spec, null, 2));

  if (jsonOnly) {
    console.log(JSON.stringify({ ...output, spec: undefined, specSavedTo: savePath }, null, 2));
    return;
  }

  console.log('SWAGGER');
  console.log('━━━━━━━');
  console.log(`${spec.info?.title || 'API'} v${spec.info?.version || '?'}`);
  console.log(`UI: ${swaggerUrl()}`);
  console.log(`OpenAPI: ${openApiUrl}`);
  console.log(`Endpoints: ${paths.length} (cache: ${savePath})`);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
