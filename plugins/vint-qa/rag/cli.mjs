#!/usr/bin/env node
/**
 * CLI da base de conhecimento (mesmo motor do MCP vint-qa-rag).
 *
 *   vqa rag search "login com usuário inativo" [--k 8] [--scope project|plugin|all] [--kind learning,code] [--json]
 *   vqa rag index [--force] [--json]
 *   vqa rag stats [--json]
 *   vqa rag learn --title "..." --content "..." [--categoria locator] [--tags a,b] [--feature "..."] [--json]
 */
import { LEARNING_CATEGORIES, addLearning, reindex, search, stats } from './lib/engine.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    flags[key] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  } else positional.push(a);
}
const JSON_OUT = Boolean(flags.json);

function print(data, human) {
  if (JSON_OUT) console.log(JSON.stringify(data, null, 2));
  else human(data);
}

function usage() {
  console.log(`Uso:
  vqa rag search "<texto>" [--k 8] [--scope all|project|plugin] [--kind learning,code] [--json]
  vqa rag index [--force] [--json]
  vqa rag stats [--json]
  vqa rag learn --title "..." --content "..." [--categoria ${LEARNING_CATEGORIES.join('|')}] [--tags a,b] [--feature "..."] [--json]`);
}

try {
  switch (cmd) {
    case 'search': {
      const q = positional.join(' ') || flags.q;
      if (!q) {
        usage();
        process.exit(2);
      }
      const kinds = typeof flags.kind === 'string' ? flags.kind.split(',') : null;
      const r = search(q, { k: Number(flags.k) || 6, scope: flags.scope || 'all', kinds, maxAgeMs: 0 });
      print(r, ({ projectDir, results }) => {
        console.log(`Projeto: ${projectDir || '(nenhum — só a base do plugin)'}\n`);
        if (!results.length) console.log('Nada encontrado.');
        for (const x of results) {
          console.log(`■ ${x.title}  [${x.kind} · ${x.score}]\n  ${x.path}:${x.lines}\n${x.snippet.replace(/^/gm, '    ')}\n`);
        }
      });
      break;
    }
    case 'index':
    case 'reindex': {
      const r = reindex({ force: Boolean(flags.force) });
      print(r, (x) =>
        console.log(`Índice: ${x.indexPath}\nArquivos: ${x.files} · trechos: ${x.chunks} · novos ${x.added} · alterados ${x.updated} · removidos ${x.removed}`),
      );
      break;
    }
    case 'stats': {
      const r = stats();
      print(r, (x) => {
        console.log(`Projeto: ${x.projectDir || '(nenhum)'}\nÍndice: ${x.indexPath} (${x.builtAt})\nArquivos: ${x.files} · trechos: ${x.chunks}`);
        for (const [k, v] of Object.entries(x.filesByKind)) console.log(`  ${k.padEnd(11)} ${v}`);
      });
      break;
    }
    case 'learn': {
      const r = addLearning({
        title: flags.title,
        content: flags.content,
        categoria: flags.categoria,
        tags: typeof flags.tags === 'string' ? flags.tags.split(',') : [],
        feature: typeof flags.feature === 'string' ? flags.feature : '',
      });
      print(r, (x) => console.log(`Aprendizado gravado em ${x.file} (${x.categoria}).`));
      break;
    }
    default:
      usage();
      process.exit(cmd ? 2 : 0);
  }
} catch (e) {
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
  else console.error(`Erro: ${e.message}`);
  process.exit(1);
}
