/**
 * Normaliza el nombre de un producto para deduplicar el mismo candidato entre
 * fuentes y países: sin acentos, minúsculas, sin signos, espacios colapsados.
 * Pura y sin dependencias (testeable).
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
