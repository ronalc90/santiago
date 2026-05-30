import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Resuelve el alias "@/..." igual que tsconfig (paths: { "@/*": ["./*"] })
// para que los tests puedan importar módulos que usan rutas absolutas.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
});
