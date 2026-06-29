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

// Cachea un formatter por moneda: crear Intl.NumberFormat es caro y formatMoney
// se llama en bucles de tabla. La ruta COP reutiliza copFormatter.
const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Moneda genérica (default COP). Para otras monedas usa 2 decimales. */
export function formatMoney(amount: number | null | undefined, currency = 'COP'): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  if (currency === 'COP') return formatCop(value);
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 2 });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(value);
}

/**
 * Parsea un monto en COP a ENTERO. El peso colombiano no usa centavos y emplea
 * "." como separador de miles, así que "70.000", "$ 70.000 COP" y 70000 → 70000
 * (nunca 70). Quita TODO lo no numérico. Evita el clásico bug de Number("70.000")=70.
 */
export function parseCop(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.round(input) : 0;
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
