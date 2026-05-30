import { TextGenerator } from '@/lib/text/types';

/** Generador MOCK de texto: devuelve JSON/َtexto canned para probar sin gastar créditos. */
export class MockTextGenerator implements TextGenerator {
  async complete(_system: string, user: string, jsonMode = false): Promise<string> {
    if (!jsonMode) return 'Texto de ejemplo generado en modo mock.';
    // Heurística simple: si piden producto vs landing, devolvemos un esqueleto coherente.
    if (/landing|secciones|sections/i.test(user)) {
      const sections = Array.from({ length: 9 }, (_, i) => ({
        slot: i + 1,
        headline: `Titular sección ${i + 1} (mock)`,
        bullets: ['Beneficio uno', 'Beneficio dos', 'Beneficio tres'],
      }));
      return JSON.stringify({
        audience: 'Público objetivo de ejemplo (mock)',
        description: 'Descripción de producto generada en modo mock.',
        angle: 'Ángulo de venta de ejemplo',
        sections,
      });
    }
    return JSON.stringify({
      name: 'Producto de ejemplo (mock)',
      description: 'Descripción generada en modo mock a partir del anuncio.',
      audience: 'Adultos interesados en el producto',
      angle: 'Solución rápida a un problema cotidiano',
    });
  }
}
