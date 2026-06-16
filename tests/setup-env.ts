// Variables de entorno mínimas para que getEnv() valide en los tests (sin estos
// valores, cualquier test que toque la capa de config fallaría). Solo se fijan si
// no venían ya del entorno, para no pisar configuraciones reales locales.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test';
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'x'.repeat(16);
process.env.INGEST_API_TOKEN = process.env.INGEST_API_TOKEN ?? 'x'.repeat(8);
// Este equipo corre con NODE_ENV=production, donde getEnv() exige un APP_URL https
// público (no localhost). Fijamos uno válido para no disparar ese guard en los tests.
process.env.APP_URL = process.env.APP_URL ?? 'https://winspy.test';
