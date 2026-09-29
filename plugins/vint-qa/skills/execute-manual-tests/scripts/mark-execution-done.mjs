#!/usr/bin/env node
/**
 * Marca execução manual como concluída (tag + comentário).
 */
import { loadPat, authHeader, ORG, PROJECT_ENC } from './lib/azure-api.mjs';
const TAG = 'qa-manual-tests-done';

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

async function patch(pat, id, ops) {
  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}?api-version=7.1`, {
    method: 'PATCH',
    headers: { ...authHeader(pat), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(ops),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function comment(pat, id, text) {
  await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.3`, {
    method: 'POST',
    headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pbiId = Number(args.pbi);
  const execTaskId = Number(args.exec_task);
  const summary = args.summary || 'Execução manual concluída.';
  const markDone = process.env.QA_MANUAL_TESTS_MARK_DONE === 'true';

  if (!pbiId || !execTaskId) {
    console.error('Uso: --pbi N --exec-task N [--summary "..."]');
    process.exit(1);
  }

  const pat = loadPat();
  for (const id of [pbiId, execTaskId]) {
    const item = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${id}?api-version=7.1`, { headers: authHeader(pat) }).then((r) => r.json());
    const tags = (item.fields['System.Tags'] || '').split(';').map((t) => t.trim()).filter(Boolean);
    if (!tags.includes(TAG)) tags.push(TAG);
    const ops = [{ op: 'add', path: '/fields/System.Tags', value: tags.join('; ') }];
    if (id === execTaskId && markDone) ops.push({ op: 'add', path: '/fields/System.State', value: 'Done' });
    await patch(pat, id, ops);
    await comment(pat, id, `**Execute Manual Tests** — ${summary}`);
    console.log(`✅ #${id} tag ${TAG}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
