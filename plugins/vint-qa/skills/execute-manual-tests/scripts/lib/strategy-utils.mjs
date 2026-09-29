/**
 * Estratégia Técnica dos cenários (Test Plan).
 * Valores ADO: 1. API | 2. UI | 5. API + UI
 */

export { FIELD_ESTRATEGIA } from '../../../../runtime/lib/azure.mjs';

export const STRATEGY = {
  API: 'api',
  UI: 'ui',
  API_UI: 'api_ui',
};

export function parseStrategy(raw) {
  const v = String(raw || '').toLowerCase();
  if (v.includes('api + ui') || v.includes('api+ui') || v.startsWith('5.')) return STRATEGY.API_UI;
  if (v.includes('api') || v.startsWith('1.')) return STRATEGY.API;
  if (v.includes('ui') || v.startsWith('2.')) return STRATEGY.UI;
  return STRATEGY.UI;
}

export function strategyLabel(mode) {
  return { api: 'API', ui: 'UI', api_ui: 'API + UI' }[mode] || 'UI';
}

/** @returns {{ runApi: boolean, runUi: boolean }} */
export function resolveExecutionPlan(strategyMode) {
  switch (strategyMode) {
    case STRATEGY.API:
      return { runApi: true, runUi: false };
    case STRATEGY.API_UI:
      return { runApi: true, runUi: true };
    default:
      return { runApi: false, runUi: true };
  }
}

export function extractStrategyFromMd(block) {
  const m = block.match(/\|\s*\*\*Estratégia Técnica\*\*\s*\|\s*([^|\n]+)/i);
  return m ? parseStrategy(m[1]) : STRATEGY.UI;
}
