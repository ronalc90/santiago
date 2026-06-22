/**
 * Temas de la app: claro, oscuro y lectura. La preferencia se guarda por
 * usuario en la BD (User.theme) y se cachea en localStorage para pintar sin
 * parpadeo. El módulo es agnóstico de framework; `applyTheme` solo se invoca
 * en el cliente.
 */
export const THEMES = ['light', 'dark', 'reading'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';
export const THEME_STORAGE_KEY = 'winspy-theme';

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  reading: 'Lectura',
};

/** Normaliza cualquier entrada a un tema válido (default si no coincide). */
export function asTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

/**
 * Aplica el tema al <html>: el modo claro es la ausencia de clase; oscuro y
 * lectura usan su propia clase. Solo cliente (usa `document`).
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.classList.remove('dark', 'reading');
  if (theme === 'dark') el.classList.add('dark');
  else if (theme === 'reading') el.classList.add('reading');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* sin localStorage: el tema solo persiste en BD */
  }
}
