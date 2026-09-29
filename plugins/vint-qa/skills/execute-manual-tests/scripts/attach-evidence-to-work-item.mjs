#!/usr/bin/env node
/**
 * Anexa evidência(s) ao card do Azure (PBI e/ou Task) + comentário da execução.
 *
 * Uso:
 *   node attach-evidence-to-work-item.mjs \
 *     --pbi 25518 \
 *     --evidence docs/test-evidence/.../fluxo.gif \
 *     --cn CN-15.9.01 \
 *     --outcome Passed \
 *     --comment "Massa AUTORIZADO criada na sessão; cenário validado." \
 *     [--exec-task 12345] \
 *     [--run-id 2917]
 */
import { basename } from 'path';
import {
  loadPat,
  uploadWorkItemAttachment,
  attachFileToWorkItem,
  addWorkItemComment,
} from './lib/azure-api.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-/g, '_');
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      if (args[key] !== undefined) {
        args[key] = Array.isArray(args[key]) ? [...args[key], val] : [args[key], val];
      } else {
        args[key] = val;
      }
    }
  }
  return args;
}

function fileList(raw) {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts
    .flatMap((p) => String(p).split(','))
    .map((p) => p.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pbiId = args.pbi && args.pbi !== true ? Number(args.pbi) : null;
  const execTaskId = args.exec_task && args.exec_task !== true ? Number(args.exec_task) : null;
  const files = fileList(args.evidence);
  const cn = typeof args.cn === 'string' ? args.cn : '';
  const outcome = typeof args.outcome === 'string' ? args.outcome : '';
  const runId = args.run_id && args.run_id !== true ? String(args.run_id) : '';
  const extra = typeof args.comment === 'string' ? args.comment : '';

  if (!pbiId && !execTaskId) {
    console.error('Uso: --pbi N e/ou --exec-task N --evidence path[,path] [--cn CN-xx] [--outcome Passed] [--comment "..."] [--run-id N]');
    process.exit(1);
  }
  if (!files.length) {
    console.error('Informe ao menos um arquivo em --evidence');
    process.exit(1);
  }

  const pat = loadPat();
  const targets = [...new Set([pbiId, execTaskId].filter(Boolean))];
  const uploaded = [];

  for (const filePath of files) {
    const att = await uploadWorkItemAttachment(pat, filePath);
    uploaded.push({ fileName: basename(filePath), url: att.url });
    const label = [cn, outcome, basename(filePath)].filter(Boolean).join(' — ');
    for (const id of targets) {
      await attachFileToWorkItem(pat, id, att.url, label || 'Evidência de execução manual');
      console.log(`📎 #${id} ← ${basename(filePath)}`);
    }
  }

  const lines = [
    '**Execute Manual Tests — evidência no card**',
    cn ? `- Cenário: \`${cn}\`` : null,
    outcome ? `- Outcome: **${outcome}**` : null,
    runId ? `- Test Run: #${runId}` : null,
    uploaded.length ? `- Anexos: ${uploaded.map((u) => u.fileName).join(', ')}` : null,
    extra ? `- Obs.: ${extra}` : null,
  ].filter(Boolean);

  for (const id of targets) {
    await addWorkItemComment(pat, id, lines.join('\n'));
    console.log(`💬 Comentário em #${id}`);
  }

  console.log(JSON.stringify({ ok: true, targets, uploaded }, null, 2));
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
