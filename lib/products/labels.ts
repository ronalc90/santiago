/**
 * Etiquetas canónicas de producto (estado del pipeline y disponibilidad Dropi).
 * Fuente única para Selects y Badges: evita que cada vista defina su propio mapa
 * y que al usuario le aparezca el valor crudo del enum (p. ej. "LANDING_CREADA").
 */

export const PRODUCT_STATUSES = [
  { value: 'DETECTADO', label: 'Detectado' },
  { value: 'VALIDADO', label: 'Validado' },
  { value: 'LANDING_CREADA', label: 'Landing creada' },
  { value: 'LANZADO', label: 'Lanzado' },
  { value: 'ESCALANDO', label: 'Escalando' },
] as const;

export const PRODUCT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_STATUSES.map((s) => [s.value, s.label]),
);

/**
 * Disponibilidad en Dropi. `label` es la versión descriptiva (para Selects);
 * `short` es la versión compacta para Badges en listados.
 */
export const DROPI_OPTIONS = [
  { value: 'DISPONIBLE', label: 'Disponible en Dropi', short: 'Dropi' },
  { value: 'NO_DISPONIBLE', label: 'No disponible', short: 'No Dropi' },
  { value: 'A_IMPORTAR', label: 'A importar', short: 'A importar' },
  { value: 'DESCONOCIDO', label: 'Desconocido', short: '—' },
] as const;

export const DROPI_BADGE_LABEL: Record<string, string> = Object.fromEntries(
  DROPI_OPTIONS.map((d) => [d.value, d.short]),
);
