#!/usr/bin/env node
/**
 * Indica se DOC e cenários locais já existem para a feature.
 *   node inspect-feature-artifacts.mjs --feature "Cadastro de Produtos" --json
 */
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';

function toSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-/g, '_');
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature || args.f || '';
  if (!feature || feature === true) {
    console.error('Uso: --feature "Nome da feature"');
    process.exit(1);
  }
  const slug = toSlug(feature);
  const docPath = join(ROOT, 'docs', 'test-docs', slug, 'documento-de-teste.md');
  const scenariosPath = join(ROOT, 'docs', 'test-scenarios', slug, 'cenarios-de-teste.md');
  const output = {
    feature,
    slug,
    docLocal: existsSync(docPath),
    docPath: existsSync(docPath) ? docPath : null,
    scenariosLocal: existsSync(scenariosPath),
    scenariosPath: existsSync(scenariosPath) ? scenariosPath : null,
  };
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log('Feature:', feature);
  console.log('DOC:', output.docLocal ? docPath : '(não encontrado)');
  console.log('Cenários:', output.scenariosLocal ? scenariosPath : '(não encontrado)');
}

main();
