import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea un número como moneda. */
export function formatCurrency(value: number, currency = 'USD', locale = 'es-CO') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/** Formatea una fecha de forma legible. */
export function formatDate(date: Date | string, locale = 'es-CO') {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
}
