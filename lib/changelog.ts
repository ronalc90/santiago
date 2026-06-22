/**
 * Changelog de WinSpy. Es la FUENTE ÚNICA de la versión que se muestra en
 * Ajustes (apartado «Versión y cambios»).
 *
 * CONVENCIÓN: cada cambio relevante se agrega como una nueva entrada AL INICIO
 * del arreglo (la primera entrada es la versión actual). Versionado semver y
 * fecha en formato YYYY-MM-DD escrita a mano al publicar (no usar `new Date()`).
 * Mantener `package.json` "version" en sincronía con la primera entrada.
 */
export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.3.0',
    date: '2026-06-21',
    title: 'Apariencia',
    changes: [
      'Tres modos de tema: claro, oscuro y lectura (papel sepia, alto contraste e interlineado relajado para sesiones largas).',
      'La preferencia de tema se guarda por usuario en la base de datos y se aplica en cualquier dispositivo (antes era solo local del navegador).',
      'Selector de tema en el menú lateral y en Ajustes → Apariencia.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-06-21',
    title: 'Scoring honesto',
    changes: [
      'Winner Score con techo de longevidad: la antigüedad sube hasta un pico (justo antes de marcarse SATURADO) y luego baja; se elimina la contradicción de premiar anuncios ya saturados.',
      'Margen efectivo COD: el margen ahora descuenta devoluciones, flete de vuelta y comisión de recaudo, y se muestra el profit potential por pedido.',
      'Country/Cascade Score: detecta winners globales probados en varios países que aún no llegan a Colombia (badge 🌊 «entrar ya»).',
      'Ajustes: tasa de devolución, comisión de recaudo y flete de vuelta ahora son configurables; el endpoint tolera reglas previas sin esos campos.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-06-19',
    title: 'Base WinSpy',
    changes: [
      'Spy de anuncios (Meta Ad Library) con Winner Score y clasificación de anuncios.',
      'Motor de Oportunidad 4×25 (demanda, competencia, margen y creativos) con cobertura y trazabilidad por dimensión.',
      'Descubrimiento de candidatos en MercadoLibre con fotos y progreso en vivo.',
      'Generador de landings con IA y prompts por imagen.',
      'Integraciones Shopify (costos) y MercadoLibre (saturación/OAuth). Página de Ayuda y modo claro/oscuro.',
    ],
  },
];

/** Versión actual (primera entrada del changelog). */
export const APP_VERSION = CHANGELOG[0].version;
/** Fecha de la versión actual. */
export const APP_RELEASE_DATE = CHANGELOG[0].date;
