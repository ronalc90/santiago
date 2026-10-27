import type { Prisma } from '@prisma/client';

/**
 * Campos de `User` que se pueden devolver en respuestas de la API (p. ej. el
 * dueño de un producto). Usar SIEMPRE este select en lugar de `include: { owner:
 * true }`, que trae la fila entera con `passwordHash`.
 */
export const PUBLIC_USER_SELECT = { id: true, name: true, email: true } satisfies Prisma.UserSelect;
