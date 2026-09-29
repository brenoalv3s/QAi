export function titulo(cn: string, descricao: string, referencia?: string): string {
  const ref = referencia ? ` (${referencia})` : ''
  return `${cn} — ${descricao}${ref}`
}
