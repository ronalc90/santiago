/**
 * Cruce de nombres de producto (catálogo Dropi ↔ candidatos descubiertos). Puro,
 * sin dependencias de servidor (testeable).
 */

/**
 * Similitud por CONTENCIÓN de tokens: intersección / tamaño del nombre más corto.
 * Mejor que Jaccard cuando un nombre es más largo que el otro — el caso real: los
 * títulos de ML/Meta son verbosos ("Masajeador Cervical Eléctrico 3D Recargable")
 * y el del catálogo es corto ("Masajeador Cervical"). Jaccard daría 0.4 (no cruza);
 * contención da 1.0. Devuelve el score y cuántos tokens comparten.
 */
export function nameSimilarity(a: string, b: string): { score: number; shared: number } {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return { score: 0, shared: 0 };
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared += 1;
  return { score: shared / Math.min(sa.size, sb.size), shared };
}

/**
 * ¿Dos nombres normalizados son el mismo producto? Coincidencia exacta, o ≥2
 * tokens compartidos (evita falsos por una sola palabra genérica) con contención
 * ≥ 0.6. Prioriza el recall: mejor mostrar de más (el usuario verifica vía el
 * link a Dropi) que ocultar coincidencias reales.
 */
export function namesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const { score, shared } = nameSimilarity(a, b);
  return shared >= 2 && score >= 0.6;
}
