// Stub no-op de `server-only` para el entorno de tests (Node). En la app real,
// `server-only` garantiza que el módulo no se incluya en el bundle de cliente;
// en vitest ese guardia lanzaría, así que aquí lo reemplazamos por un módulo vacío.
export {};
