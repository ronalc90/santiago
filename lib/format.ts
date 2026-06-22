/**
 * Formato de moneda de la app. Por defecto COP (pesos colombianos) sin
 * decimales, que es como se manejan los precios en Colombia. Se cachea el
 * Intl.NumberFormat (crearlo es caro) — práctica recomendada.
 */
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** "$ 89.900" — pesos colombianos, sin decimales. 0/NaN → "$ 0". */
export function formatCop(amount: number | null | undefined): string {
  return copFormatter.format(typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
}

/** Moneda genérica (default COP). Para otras monedas usa 2 decimales. */
export function formatMoney(amount: number | null | undefined, currency = 'COP'): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  if (currency === 'COP') return formatCop(value);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
