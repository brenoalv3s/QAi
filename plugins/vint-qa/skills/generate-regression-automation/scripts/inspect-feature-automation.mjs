#!/usr/bin/env node
/**
 * Lista artefatos de automação já existentes para uma feature (reuso).
 *   node inspect-feature-automation.mjs --feature "Produtos" --json
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { PROJECT_ROOT as ROOT } from '../../../runtime/lib/project.mjs';

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

function toSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function walk(dir, acc = [], depth = 0) {
  if (depth > 8 || !existsSync(dir)) return acc;
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'test-results') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc, depth + 1);
    else acc.push(full);
  }
  return acc;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const feature = args.feature || args.title || '';
  if (!feature || feature === true) {
    console.error('Uso: --feature "Nome" [--json]');
    process.exit(1);
  }
  const slug = toSlug(feature);
  const needle = slug.replace(/-/g, '');
  const files = walk(join(ROOT, 'e2e')).concat(walk(join(ROOT, 'docs', 'regression-automation')));
  const related = files.filter((f) => {
    const rel = relative(ROOT, f).replace(/\\/g, '/').toLowerCase();
    const compact = rel.replace(/[^a-z0-9]/g, '');
    return rel.includes(slug) || compact.includes(needle);
  });

  const playwright = related.filter(
    (f) =>
      /\.(spec\.ts|page\.ts|client\.ts|locators\.ts)$/.test(f) ||
      /page-fixtures\.ts$/.test(f) ||
      /fixtures\/(main|api)\.ts$/.test(f) ||
      /\/data\/.*\.ts$/.test(f),
  );
  const robot = related.filter((f) => /\.(robot|resource)$/.test(f));
  const manifests = related.filter((f) => /manifest\.json$/.test(f));

  const output = {
    feature,
    slug,
    exists: related.length > 0,
    reuse: related.length > 0,
    playwrightFiles: playwright.map((f) => relative(ROOT, f).replace(/\\/g, '/')),
    robotFiles: robot.map((f) => relative(ROOT, f).replace(/\\/g, '/')),
    other: related
      .filter((f) => !playwright.includes(f) && !robot.includes(f))
      .map((f) => relative(ROOT, f).replace(/\\/g, '/')),
    manifests: manifests.map((f) => relative(ROOT, f).replace(/\\/g, '/')),
  };

  if (args.json === true) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(output.exists ? `Reusar (${related.length} arquivo(s))` : 'Nada existente — criar do zero');
  for (const f of related) console.log(' ', relative(ROOT, f));
}

main();
