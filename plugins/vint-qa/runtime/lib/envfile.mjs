import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function formatValue(val) {
  const v = String(val ?? '');
  if (/[\s#"']/.test(v)) return JSON.stringify(v);
  return v;
}

/**
 * Atualiza (ou cria) um arquivo .env preservando comentários e ordem.
 * Chaves novas vão para o fim. Nunca imprime valores.
 */
export function upsertEnv(path, values, { templateText = '' } = {}) {
  const base = existsSync(path) ? readFileSync(path, 'utf8') : templateText;
  const lines = String(base || '').split(/\r?\n/);
  const pending = new Map(Object.entries(values).filter(([, v]) => v != null));
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const i = t.indexOf('=');
    if (i < 1) return line;
    const key = t.slice(0, i).trim();
    if (!pending.has(key)) return line;
    const v = pending.get(key);
    pending.delete(key);
    return `${key}=${formatValue(v)}`;
  });
  for (const [k, v] of pending) out.push(`${k}=${formatValue(v)}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out.join('\n').replace(/\n*$/, '\n'));
  return Object.keys(values);
}
