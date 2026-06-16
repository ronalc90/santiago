/**
 * Contratos del módulo de descubrimiento. El orquestador solo conoce estas
 * interfaces; cada fuente (ML, Trends, Meta…) es un módulo que las implementa.
 */

/** Candidato crudo tal como lo produce una fuente. */
export interface DiscoveryCandidate {
  name: string;
  category?: string | null;
  /** País ISO-2 (CO, US, MX…). */
  country: string;
  /** id de la fuente que lo trajo. */
  source: string;
  metrics?: {
    interest?: number | null; // 0-100 (tendencia)
    salesCount?: number | null;
    listingsCount?: number | null; // saturación de la fuente
    daysActive?: number | null;
  };
  creatives?: { url: string; type: 'image' | 'video'; country?: string | null }[];
}

export interface DiscoveryParams {
  /** Sitios/Países a consultar (cada fuente interpreta según su API). */
  countries: string[];
  keywords: string[];
  limit: number;
}

/**
 * Una fuente de descubrimiento. `estaActiva()` decide si entra al orquestador
 * (gating por env/conexión); `buscar()` nunca debe lanzar para no tumbar al
 * resto (devuelve [] si falla).
 */
export interface DiscoverySource {
  id: string;
  esGratis: boolean;
  estaActiva(): boolean;
  buscar(params: DiscoveryParams): Promise<DiscoveryCandidate[]>;
}
