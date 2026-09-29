/** Massa e constantes E2E. Specs não declaram literais — usam métodos do POM/data. */
export const PREFIXO_E2E = 'E2E-QA-'

export function nomeRegistroE2E(sufixo: string): string {
  return `${PREFIXO_E2E}${sufixo}`
}
