import sharp from 'sharp';
import { ImageGenerator, RefImage } from '@/lib/images/types';
import { StyleAnalysis } from '@/lib/services/landing-spec';

/**
 * Generador MOCK: no llama a ninguna API. Crea placeholders con sharp para
 * poder probar todo el pipeline (cola, compresión, descarga) sin gastar créditos.
 */
export class MockImageGenerator implements ImageGenerator {
  async analyzeReference(_image: RefImage): Promise<StyleAnalysis> {
    return {
      visualStyle: 'mock minimalista',
      palette: ['#0EA5E9', '#0F172A', '#F8FAFC'],
      atmosphere: 'luz neutra de estudio',
      typography: 'sans-serif',
      iconStyle: 'líneas',
      effects: 'sombras suaves',
      layout: 'centrado',
      editorialDetails: 'badges de oferta',
    };
  }

  async generateImage(prompt: string, _refs?: RefImage[]): Promise<Buffer> {
    const label = prompt.slice(0, 40).replace(/[<&>]/g, ' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200">
      <rect width="100%" height="100%" fill="#0F172A"/>
      <rect x="40" y="40" width="920" height="1120" fill="none" stroke="#0EA5E9" stroke-width="4"/>
      <text x="500" y="560" fill="#F8FAFC" font-family="sans-serif" font-size="42" text-anchor="middle">MOCK</text>
      <text x="500" y="620" fill="#94A3B8" font-family="sans-serif" font-size="22" text-anchor="middle">${label}</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}
