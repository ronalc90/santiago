import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Resuelve el alias "@/..." igual que tsconfig (paths: { "@/*": ["./*"] })
// para que los tests puedan importar módulos que usan rutas absolutas.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      // `server-only` lanza fuera de un Server Component; en tests lo neutralizamos.
      'server-only': `${root}/tests/stubs/server-only.ts`,
    },
  },
  test: {
    // Variables de entorno mínimas para getEnv() antes de cargar cada test.
    setupFiles: [`${root}/tests/setup-env.ts`],
  },
});
