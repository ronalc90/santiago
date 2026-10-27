import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Regresión de seguridad: la guarda del layout `app/(app)/layout.tsx` NO protege
 * las páginas. Next renderiza layout y página en paralelo (la página viaja en el
 * payload RSC aunque el layout redirija) y una petición RSC con
 * `Next-Router-State-Tree` ni siquiera ejecuta el layout. Como el middleware solo
 * mira que exista la cookie, cualquiera con `winspy_session=<lo que sea>` leía
 * los datos de las páginas. Cada página debe exigir sesión ANTES de tocar datos.
 */

const APP_DIR = path.resolve(__dirname, '..', 'app', '(app)');

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return findPages(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

/** Cuerpo del `export default function` (desde la llave de apertura). */
function defaultExportBody(src: string): string {
  const m = src.match(/export default (?:async )?function \w*\s*\(/);
  if (!m || m.index === undefined) throw new Error('sin export default function');
  // Salta la lista de parámetros (puede tener tipos con llaves) hasta su ')'.
  let i = m.index + m[0].length;
  let depth = 1;
  while (depth > 0 && i < src.length) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') depth -= 1;
    i += 1;
  }
  return src.slice(src.indexOf('{', i) + 1);
}

/** Páginas que solo redirigen a otra ruta (no leen datos). */
function isRedirectOnly(body: string): boolean {
  return /^\s*redirect\([^)]*\);\s*\}/.test(body);
}

const pages = findPages(APP_DIR);

describe('auth en las páginas del dashboard', () => {
  it('encuentra las páginas de app/(app)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of pages) {
    const rel = path.relative(path.resolve(__dirname, '..'), file);
    it(`${rel} exige sesión como primera instrucción`, () => {
      const src = readFileSync(file, 'utf8');
      const body = defaultExportBody(src);
      if (isRedirectOnly(body)) return;
      expect(src).toMatch(/import \{ requireUser \} from '@\/lib\/auth\/guard';/);
      // Nada (ni searchParams, ni Prisma, ni servicios) puede ir antes de la guarda.
      expect(body).toMatch(/^\s*(?:const \w+ = )?await requireUser\(\);/);
    });
  }
});
