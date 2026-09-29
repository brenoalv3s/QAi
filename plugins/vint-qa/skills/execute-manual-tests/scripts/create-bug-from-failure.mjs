#!/usr/bin/env node
/**
 * Cria Bug filho do PBI seguindo Template Bug.pdf.
 * Uso:
 *   node create-bug-from-failure.mjs --pbi 25862 --cn CN-38.1.01 --layer FE \
 *     --title "Lista de Contratos - Coluna Gerente vazia" \
 *     --description "..." --steps "Login|Menu|Ação" \
 *     --expected "..." --actual "..." \
 *     --environment Homologação --browser "Chrome" --user "qa@..." \
 *     --severity media --references "RN-15, US 38.1 C.1" \
 *     --evidence path.png
 */
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { loadPat, authHeader, ORG, PROJECT_ENC, addWorkItemRelation } from './lib/azure-api.mjs';
import { buildBugReproStepsHtml, buildBugTitle, resolveSeverityAdo } from './lib/build-bug-html.mjs';

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

async function uploadAttachment(pat, filePath) {
  const fileName = basename(filePath);
  const content = readFileSync(filePath);
  const res = await fetch(
    `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=7.1`,
    {
      method: 'POST',
      headers: { ...authHeader(pat), 'Content-Type': 'application/octet-stream', 'Content-Length': String(content.length) },
      body: content,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function createBug(pat, { title, reproSteps, pbiId, iterationPath, evidenceUrl, severityAdo }) {
  const patch = [
    { op: 'add', path: '/fields/System.Title', value: title },
    { op: 'add', path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: reproSteps },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.Severity', value: severityAdo },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: 2 },
    { op: 'add', path: '/fields/Microsoft.VSTS.Common.ValueArea', value: 'Business' },
    { op: 'add', path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${pbiId}` } },
  ];

  if (iterationPath) {
    patch.push({ op: 'add', path: '/fields/System.IterationPath', value: iterationPath });
  }

  if (evidenceUrl) {
    patch.push({
      op: 'add',
      path: '/relations/-',
      value: { rel: 'AttachedFile', url: evidenceUrl, attributes: { comment: 'Print — evidência do cenário' } },
    });
  }

  const res = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/$Bug?api-version=7.1`, {
    method: 'POST',
    headers: { ...authHeader(pat), 'Content-Type': 'application/json-patch+json' },
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create Bug → ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pbiId = Number(args.pbi);
  const cnId = args.cn;
  const layer = args.layer || 'FE';
  const titleSuffix = args.title;
  const feature = args.feature || '';

  if (!pbiId || !cnId || !titleSuffix) {
    console.error(`Uso: node create-bug-from-failure.mjs \\
  --pbi N --cn CN-xx --layer FE|BE --title "Tela - Resumo do erro" \\
  --description "..." --steps "Passo 1|Passo 2|Passo 3" \\
  --expected "..." --actual "..." \\
  --environment Homologação --browser "Chrome v.x" --user "login@teste" \\
  [--endpoint "GET /api/..."] [--logs "..."] [--severity alta|media|baixa] \\
  [--references "RN-xx, US x.x"] [--evidence path.png] [--feature "..."] \\
  [--test-case N] [--run-id N --result-id N]`);
    process.exit(1);
  }

  const pat = loadPat();
  const pbi = await fetch(`https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/wit/workitems/${pbiId}?api-version=7.1`, {
    headers: authHeader(pat),
  }).then((r) => r.json());

  let evidenceUrl = null;
  if (args.evidence && existsSync(args.evidence)) {
    const uploaded = await uploadAttachment(pat, args.evidence);
    evidenceUrl = uploaded.url;
  }

  const featureName = feature || pbi.fields['System.Title'];
  const reproSteps = buildBugReproStepsHtml({
    description: args.description || `Falha identificada no cenário ${cnId} durante execução manual na feature ${featureName}.`,
    steps: args.steps || '',
    expected: args.expected || 'Conforme regras de negócio, SPEC, US e documento de teste.',
    actual: args.actual || 'Comportamento divergente do esperado na aplicação.',
    environment: args.environment || 'Homologação',
    browser: args.browser || 'Chrome (agente browser MCP)',
    user: args.user || 'Usuário de teste HML',
    endpoint: args.endpoint || '',
    logs: args.logs || '',
    evidenceUrl,
    severity: args.severity || 'media',
    cnId,
    feature: featureName,
    references: args.references || '',
  });

  const title = buildBugTitle(layer, titleSuffix);
  const severityAdo = resolveSeverityAdo(args.severity || 'media');

  const bug = await createBug(pat, {
    title,
    reproSteps,
    pbiId,
    iterationPath: pbi.fields['System.IterationPath'],
    evidenceUrl,
    severityAdo,
  });

  const testCaseId = args.test_case && args.test_case !== true ? Number(args.test_case) : null;
  const runId = args.run_id && args.run_id !== true ? Number(args.run_id) : null;
  const resultId = args.result_id && args.result_id !== true ? Number(args.result_id) : null;

  if (testCaseId) {
    try {
      await addWorkItemRelation(pat, bug.id, 'System.LinkTypes.Related', testCaseId);
    } catch (err) {
      console.warn(`⚠️  Bug criado, mas não relacionado ao Test Case #${testCaseId}: ${err.message}`);
    }
  }

  if (runId && resultId) {
    try {
      await fetch(
        `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/runs/${runId}/results?api-version=7.1`,
        {
          method: 'PATCH',
          headers: { ...authHeader(pat), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ id: resultId, associatedBugs: [{ id: bug.id }] }]),
        },
      );
      const assoc = await fetch(
        `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/test/Runs/${runId}/Results/${resultId}/WorkItems/${bug.id}?api-version=7.1`,
        { method: 'POST', headers: { ...authHeader(pat), 'Content-Type': 'application/json' } },
      );
      if (!assoc.ok) {
        await fetch(
          `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_apis/testresults/runs/${runId}/results/${resultId}/workitems/${bug.id}?api-version=7.1`,
          { method: 'POST', headers: { ...authHeader(pat), 'Content-Type': 'application/json' } },
        );
      }
    } catch (err) {
      console.warn(`⚠️  Bug criado, mas não associado ao resultado #${resultId}: ${err.message}`);
    }
  }

  const bugUrl = `https://dev.azure.com/${ORG}/${PROJECT_ENC}/_workitems/edit/${bug.id}`;
  console.log(JSON.stringify({ bugId: bug.id, title, severity: severityAdo, bugUrl, pbiId, cnId, testCaseId, runId, resultId }, null, 2));
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
