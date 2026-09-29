/**
 * Gera HTML de ReproSteps conforme templates/Template Bug.pdf.
 * Imagens de referência: template-bug-page-1.png, template-bug-page-2.png
 */

const H3 = 'style="font-family:Google Sans, sans-serif !important;margin-top:0px !important;"';
const P = 'style="margin-top:0px !important;"';
const DIV = 'style="font-family:Google Sans Text, sans-serif !important;margin-top:0px !important;" dir=ltr';

export const SEVERITY_ADO = {
  alta: { ado: '2 - High', label: 'Alta (Critical) / High', rationale: 'Funcionalidade importante quebrada sem workaround simples, ou fluxo principal bloqueado.' },
  critical: { ado: '1 - Critical', label: 'Alta (Critical) / High', rationale: 'Sistema indisponível ou perda de dados — fluxo principal totalmente bloqueado.' },
  high: { ado: '2 - High', label: 'Alta (Critical) / High', rationale: 'Funcionalidade importante quebrada sem workaround simples.' },
  media: { ado: '3 - Medium', label: 'Média (Major) / Medium', rationale: 'Erro funcional com workaround ou perda de informação secundária.' },
  major: { ado: '3 - Medium', label: 'Média (Major) / Medium', rationale: 'Erro funcional com workaround ou perda de informação secundária.' },
  medium: { ado: '3 - Medium', label: 'Média (Major) / Medium', rationale: 'Erro funcional com workaround ou perda de informação secundária.' },
  baixa: { ado: '4 - Low', label: 'Baixa (Minor) / Low', rationale: 'Erro estético, ortográfico ou de layout — sem impacto funcional direto.' },
  minor: { ado: '4 - Low', label: 'Baixa (Minor) / Low', rationale: 'Erro estético, ortográfico ou de layout.' },
  low: { ado: '4 - Low', label: 'Baixa (Minor) / Low', rationale: 'Erro estético, ortográfico ou de layout.' },
};

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeSeverity(raw) {
  const key = String(raw || 'media')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return SEVERITY_ADO[key] || SEVERITY_ADO.media;
}

/**
 * @param {object} data
 * @param {string} data.description - Resumo do problema, impacto e contexto
 * @param {string} data.steps - Passos separados por |
 * @param {string} data.expected - Resultado esperado (SPEC/US/RN)
 * @param {string} data.actual - Resultado atual observado
 * @param {string} data.environment - Desenvolvimento | Homologação | Produção
 * @param {string} data.browser - Browser/Versão
 * @param {string} data.user - Usuário/Login utilizado
 * @param {string} [data.endpoint] - Endpoint/API
 * @param {string} [data.logs] - Logs do console ou servidor
 * @param {string} [data.evidenceUrl] - URL do attachment (print)
 * @param {string} data.severity - alta | media | baixa
 * @param {string} data.cnId - [CN-xx]
 * @param {string} data.feature - Nome da feature/PBI
 * @param {string} [data.references] - RN/SPEC/US violadas
 */
export function buildBugReproStepsHtml(data) {
  const sev = normalizeSeverity(data.severity);

  const stepsList = (data.steps || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<li ${P}><p ${P}>${esc(s)}</p></li>`)
    .join('');

  const endpointLine = data.endpoint
    ? `<li ${P}><p ${P}><b ${P}>Endpoint/API:</b> ${esc(data.endpoint)}</p></li>`
    : '';

  const logsBlock = data.logs
    ? `<li ${P}><p ${P}><b ${P}>Logs:</b></p><pre ${P}>${esc(data.logs)}</pre></li>`
    : '';

  const evidenceBlock = data.evidenceUrl
    ? `<h3 ${H3}>Evidências</h3>
<ul ${P}>
<li ${P}><p ${P}><b ${P}>Prints:</b> Screenshot do defeito (destaque na área com falha).</p></li>
</ul>
<div style="margin-top:0px;margin-bottom:14px;"><img src="${data.evidenceUrl}" alt="Evidência ${esc(data.cnId)}"><br></div>`
    : `<h3 ${H3}>Evidências</h3>
<ul ${P}>
<li ${P}><p ${P}><b ${P}>Prints:</b> Evidência pendente — anexar screenshot com destaque no erro.</p></li>
<li ${P}><p ${P}><b ${P}>Vídeos:</b> N/A</p></li>
<li ${P}><p ${P}><b ${P}>Logs:</b> ${data.logs ? esc(data.logs) : 'N/A'}</p></li>
</ul>`;

  const refs = data.references ? `<p ${P}><b ${P}>Referências violadas:</b> ${esc(data.references)}</p>` : '';
  const meta = `<p ${P}><b ${P}>Cenário de teste:</b> ${esc(data.cnId)} | <b ${P}>Feature:</b> ${esc(data.feature)}</p>`;

  return `<div ${DIV}>
<h3 ${H3}>Descrição</h3>
<p ${P}>${esc(data.description)}</p>
${meta}
${refs}
<h3 ${H3}>Passos para Reproduzir</h3>
<ol start=1 ${P}>${stepsList}</ol>
<h3 ${H3}>Resultado Esperado</h3>
<p ${P}>${esc(data.expected)}</p>
<h3 ${H3}>Resultado Atual</h3>
<p ${P}>${esc(data.actual)}</p>
<h3 ${H3}>Detalhes Técnicos e Ambiente</h3>
<ul ${P}>
<li ${P}><p ${P}><b ${P}>Ambiente:</b> ${esc(data.environment || 'Homologação')}</p></li>
<li ${P}><p ${P}><b ${P}>Browser/Versão:</b> ${esc(data.browser || 'Chrome (via agente browser MCP)')}</p></li>
<li ${P}><p ${P}><b ${P}>Usuário/Login utilizado:</b> ${esc(data.user || 'Usuário de teste HML')}</p></li>
${endpointLine}
${logsBlock}
</ul>
${evidenceBlock}
<h3 ${H3}>Severidade</h3>
<ul ${P}>
<li ${P}><p ${P}><b ${P}>${esc(sev.label)}:</b> ${esc(sev.rationale)}</p></li>
</ul>
</div>`;
}

export function buildBugTitle(layer, titleSuffix) {
  const l = String(layer || 'FE').toUpperCase();
  const suffix = String(titleSuffix || '').trim();
  if (/^\[(FE|BE)\]/i.test(suffix)) return suffix;
  return `[${l}] ${suffix}`;
}

export function resolveSeverityAdo(severity) {
  return normalizeSeverity(severity).ado;
}
