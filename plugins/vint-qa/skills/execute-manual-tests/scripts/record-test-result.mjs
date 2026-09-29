#!/usr/bin/env node
/**
 * Mark Outcome no Test Run + evidências no Test Plans (cenário) e no PBI.
 *
 *   --outcome Passed|Failed|NotApplicable
 *   --evidence path.gif[,path.png][,api-response.json]
 *   --pbi N --test-case-id N     → vincula PBI ao Test Case + anexa evidência ao card
 *   --cn CN-xx                  → rótulo no anexo/comentário do PBI
 *   --exec-task N               → também anexa evidência na Task de execução
 *   --bug-id N                  → associa Bug ao resultado (e Related no Test Case)
 *   --skip-pbi-attach           → não anexar evidência no Work Item (só no Test Result)
 *   --allow-missing-testplan-evidence → não falhar se anexo no Test Result falhar (padrão: falha em Passed/Failed)
 *
 * Uso:
 *   node record-test-result.mjs --run-id 123 --result-id 456 --outcome Passed \
 *     --evidence path/fluxo.gif,path/fluxo.png --pbi 1234 --test-case-id 30001 --cn CN-01
 */
import { existsSync, readdirSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import {
  loadPat,
  authHeader,
  ORG,
  PROJECT_ENC,
  linkPbiToTestCase,
  addWorkItemRelation,
  uploadWorkItemAttachment,
  attachFileToWorkItem,
  attachFileToTestResult,
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

function normalizeOutcome(raw) {
  const v = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (['passed', 'pass', 'ok', 'sucesso'].includes(v)) return 'Passed';
  if (['failed', 'fail', 'falha', 'falhou'].includes(v)) return 'Failed';
  if (
    v === 'notapplicable' ||
    v === 'not applicable' ||
    v === 'n/a' ||
    v === 'na' ||
    v === 'n.a.' ||
    v.includes('nao se aplica')
  ) {
    return 'NotApplicable';
  }
  return null;
}

function evidenceList(raw) {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts
    .flatMap((p) => String(p).split(','))
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Expande evidências: se só .gif, tenta .png irmão e frames/ do mesmo CN. */
function expandEvidenceFiles(files) {
  const out = [];
  const seen = new Set();
  const add = (p) => {
    if (!p || !existsSync(p) || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };

  for (const filePath of files) {
    add(filePath);
    const ext = extname(filePath).toLowerCase();
    const dir = dirname(filePath);
    const base = basename(filePath, ext);

    if (ext === '.gif') {
      add(join(dir, `${base}.png`));
      add(join(dir, 'fluxo.png'));
    }

    const framesDir = join(dir, 'frames');
    if (existsSync(framesDir)) {
      const frames = readdirSync(framesDir)
        .filter((f) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(f).toLowerCase()))
        .sort();
      if (frames.length) add(join(framesDir, frames[frames.length - 1]));
    }
  }
  return out;
}

async function patchResult(pat, runId, resultId, { outcome, comment, bugIds }) {
  const payload = {
    id: Number(resultId),
    state: 'Completed',
  };
  if (outcome) payload.outcome = outcome;
  if (comment) payload.comment = comment;
  if (bugIds?.length) {
    payload.associatedBugs = bugIds.map((id) => ({ id: Number(id) }));
  }
  if (!payload.comment && outcome) {
    payload.comment = `Resultado registrado pelo agente execute-manual-tests — ${outcome}`;
  }

  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/runs/${runId}/results?api-version=7.1`,
    {
      method: 'PATCH',
      headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Patch result → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function associateWorkItemToResult(pat, runId, resultId, workItemId) {
  const attempts = [
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/Runs/${runId}/Results/${resultId}/WorkItems/${workItemId}?api-version=7.1`,
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/testresults/runs/${runId}/results/${resultId}/workitems/${workItemId}?api-version=7.1`,
  ];
  for (const url of attempts) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
    });
    if (res.ok) return true;
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = Number(args.run_id);
  const resultId = Number(args.result_id);
  const outcome = args.outcome ? normalizeOutcome(args.outcome) : null;
  const filesRaw = evidenceList(args.evidence);
  const files = expandEvidenceFiles(filesRaw);
  const comment = typeof args.comment === 'string' ? args.comment : '';
  const pbiId = args.pbi && args.pbi !== true ? Number(args.pbi) : null;
  const execTaskId = args.exec_task && args.exec_task !== true ? Number(args.exec_task) : null;
  const testCaseId = args.test_case_id && args.test_case_id !== true ? Number(args.test_case_id) : null;
  const cnId = typeof args.cn === 'string' ? args.cn : '';
  const skipPbiAttach = args.skip_pbi_attach === true || args.skip_pbi_attach === 'true';
  const allowMissingTp =
    args.allow_missing_testplan_evidence === true || args.allow_missing_testplan_evidence === 'true';
  const bugIds = evidenceList(args.bug_id).map(Number).filter(Boolean);

  if (!runId || !resultId) {
    console.error(
      'Uso: --run-id N --result-id N [--outcome Passed|Failed|NotApplicable] [--evidence path] [--comment "..."] [--pbi N --test-case-id N] [--cn CN-xx] [--exec-task N] [--bug-id N]',
    );
    process.exit(1);
  }

  if (args.outcome && !outcome) {
    console.error('outcome deve ser Passed, Failed ou NotApplicable (não se aplica)');
    process.exit(1);
  }

  if (!outcome && !files.length && !pbiId && !bugIds.length) {
    console.error('Informe --outcome, --evidence, --pbi ou --bug-id');
    process.exit(1);
  }

  if (outcome === 'NotApplicable' && !comment.trim()) {
    console.error(
      'NotApplicable exige --comment listando as fontes consultadas (SPEC, US, RN, MSG, ALI, DOC) e por que o cenário não aparece nelas.',
    );
    process.exit(1);
  }

  if ((outcome === 'Passed' || outcome === 'Failed') && !files.length) {
    console.error(
      `ERRO: ${outcome} exige --evidence (fluxo.gif e/ou fluxo.png / frames) anexado ao Test Result do cenário.`,
    );
    process.exit(1);
  }

  const pat = loadPat();
  const cardTargets = [...new Set([pbiId, execTaskId].filter(Boolean))];
  const attachedToCard = [];
  const attachedToTestPlan = [];
  const testPlanErrors = [];

  for (const filePath of files) {
    const label = [cnId, outcome, basename(filePath)].filter(Boolean).join(' — ') || 'Evidência de execução manual';

    // 1) Test Plans (cenário) — Base64 stream (obrigatório)
    try {
      await attachFileToTestResult(pat, runId, resultId, filePath, label);
      attachedToTestPlan.push(basename(filePath));
      console.log(`📎 Evidência anexada ao cenário (Test Plans Result #${resultId}): ${basename(filePath)}`);
    } catch (err) {
      testPlanErrors.push(`${basename(filePath)}: ${err.message}`);
      console.warn(`⚠️  Anexo no Test Result falhou (${basename(filePath)}): ${err.message}`);
    }

    // 2) PBI / Task — upload WIT + AttachedFile
    if (!skipPbiAttach && cardTargets.length) {
      try {
        const uploaded = await uploadWorkItemAttachment(pat, filePath);
        for (const id of cardTargets) {
          try {
            await attachFileToWorkItem(pat, id, uploaded.url, label);
            attachedToCard.push({ id, file: basename(filePath) });
            console.log(`📎 Evidência anexada ao card #${id}: ${basename(filePath)}`);
          } catch (err) {
            console.warn(`⚠️  Não foi possível anexar ao card #${id}: ${err.message}`);
          }
        }
      } catch (err) {
        console.warn(`⚠️  Upload WIT falhou (${basename(filePath)}): ${err.message}`);
      }
    }
  }

  if (outcome || comment || bugIds.length) {
    await patchResult(pat, runId, resultId, { outcome, comment, bugIds });
    if (outcome) console.log(`✅ Mark Outcome Result #${resultId} → ${outcome}`);
  }

  if (!skipPbiAttach && cardTargets.length && (files.length || outcome || comment)) {
    const lines = [
      '**Execute Manual Tests — evidência no card**',
      cnId ? `- Cenário: \`${cnId}\`` : null,
      outcome ? `- Outcome: **${outcome}**` : null,
      `- Test Run / Result: #${runId} / #${resultId}`,
      attachedToTestPlan.length
        ? `- Anexos Test Plans: ${[...new Set(attachedToTestPlan)].join(', ')}`
        : files.length
          ? `- Anexos Test Plans: falhou (${testPlanErrors.join('; ') || 'sem detalhe'})`
          : null,
      attachedToCard.length
        ? `- Anexos PBI: ${[...new Set(attachedToCard.map((a) => a.file))].join(', ')}`
        : null,
      comment ? `- Obs.: ${comment}` : null,
    ].filter(Boolean);
    for (const id of cardTargets) {
      try {
        await addWorkItemComment(pat, id, lines.join('\n'));
        console.log(`💬 Comentário de evidência em #${id}`);
      } catch (err) {
        console.warn(`⚠️  Comentário em #${id} falhou: ${err.message}`);
      }
    }
  }

  if (pbiId && testCaseId) {
    try {
      const linked = await linkPbiToTestCase(pat, pbiId, testCaseId);
      const skipped = linked.testCaseToPbi.skipped && linked.pbiToTestCase.skipped;
      console.log(
        skipped
          ? `🔗 PBI #${pbiId} já vinculado ao Test Case #${testCaseId}`
          : `🔗 PBI #${pbiId} vinculado ao Test Case #${testCaseId}`,
      );
    } catch (err) {
      console.warn(`⚠️  Não foi possível vincular PBI #${pbiId} ao Test Case #${testCaseId}: ${err.message}`);
    }
  } else if (pbiId && !testCaseId) {
    console.warn('⚠️  --pbi informado sem --test-case-id — vínculo PBI↔card não aplicado.');
  }

  for (const bugId of bugIds) {
    try {
      const associated = await associateWorkItemToResult(pat, runId, resultId, bugId);
      if (associated) console.log(`🐛 Bug #${bugId} associado ao resultado #${resultId}`);
      if (testCaseId) {
        const rel = await addWorkItemRelation(pat, bugId, 'System.LinkTypes.Related', testCaseId);
        console.log(
          rel.skipped
            ? `🔗 Bug #${bugId} já relacionado ao Test Case #${testCaseId}`
            : `🔗 Bug #${bugId} relacionado ao Test Case #${testCaseId}`,
        );
      }
    } catch (err) {
      console.warn(`⚠️  Não foi possível vincular Bug #${bugId}: ${err.message}`);
    }
  }

  const summary = {
    runId,
    resultId,
    outcome,
    evidenceRequested: filesRaw,
    evidenceExpanded: files.map((f) => basename(f)),
    attachedToTestPlan: [...new Set(attachedToTestPlan)],
    attachedToCard: attachedToCard.map((a) => ({ id: a.id, file: a.file })),
    testPlanErrors,
  };
  console.log(JSON.stringify(summary, null, 2));

  // Passed/Failed exigem pelo menos 1 anexo no Test Plans (cenário)
  if (
    (outcome === 'Passed' || outcome === 'Failed') &&
    attachedToTestPlan.length === 0 &&
    !allowMissingTp
  ) {
    console.error(
      'ERRO: nenhuma evidência foi anexada ao Test Result do cenário. Corrija o upload (Base64) ou passe PNG válido. Use --allow-missing-testplan-evidence só em emergência.',
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
