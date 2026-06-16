import { DiscoverySource } from './types';

/**
 * Fuente de prueba: candidatos fijos, sin red ni gasto. Se usa cuando
 * DISCOVERY_MOCK=true para probar el pipeline (dedupe, score, UI) en seco.
 * El 3er candidato (CO) deduplica con el 1º para ejercitar el cruce con Colombia.
 */
export const mockSource: DiscoverySource = {
  id: 'mock',
  esGratis: true,
  estaActiva: () => true,
  async buscar() {
    return [
      {
        name: 'Masajeador Cervical',
        category: 'salud',
        country: 'US',
        source: 'mock',
        metrics: { interest: 80, listingsCount: 1200, daysActive: 60 },
        creatives: [{ url: 'https://example.com/masajeador.jpg', type: 'image', country: 'US' }],
      },
      {
        name: 'Lámpara de Luna 3D',
        category: 'hogar',
        country: 'MX',
        source: 'mock',
        metrics: { interest: 65, listingsCount: 300, daysActive: 90 },
      },
      {
        name: 'masajeador cervical',
        category: 'salud',
        country: 'CO',
        source: 'mock',
        metrics: { listingsCount: 5000 },
      },
    ];
  },
};
