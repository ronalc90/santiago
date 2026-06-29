/**
 * Extrae un mensaje legible de un error desconocido. Centraliza el patrón
 * `err instanceof Error ? err.message : ...` repetido en route handlers y
 * servicios, para no tener que decidir el fallback en cada sitio.
 */
export function getErrorMessage(err: unknown, fallback = 'Error desconocido'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}
