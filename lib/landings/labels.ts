/**
 * Etiquetas canónicas de estado de landing y de cada imagen generada. Fuente
 * única para que el listado y el detalle muestren el mismo texto en español
 * (en vez del valor crudo "QUEUED"/"PENDING").
 */

type BadgeVariant = 'green' | 'destructive' | 'secondary';

export const LANDING_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  QUEUED: { label: 'En cola', variant: 'secondary' },
  PROCESSING: { label: 'Generando', variant: 'secondary' },
  COMPLETED: { label: 'Completada', variant: 'green' },
  FAILED: { label: 'Fallida', variant: 'destructive' },
};

export const LANDING_IMAGE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  PROCESSING: { label: 'Generando', variant: 'secondary' },
  COMPLETED: { label: 'Lista', variant: 'green' },
  FAILED: { label: 'Error', variant: 'destructive' },
};
