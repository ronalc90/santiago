import { describe, it, expect } from 'vitest';
import { buildLandingHtml } from '../lib/services/landing-html';
import type { LandingInputs } from '../lib/services/landing-spec';

const inputs: LandingInputs = {
  productName: 'Masajeador Cervical',
  offerPrice: 49900,
  regularPrice: 99900,
  country: 'CO',
  currency: 'COP',
  audience: 'Adultos con dolor de cuello',
  description: 'Alivio rápido del dolor cervical en casa.',
  offerType: '2x1',
  angle: 'Alivio sin fisioterapeuta',
  sectionsCopy: [{ slot: 5, headline: 'Beneficios', bullets: ['Alivia el dolor', 'Portátil'] }],
};
const images = [
  { slot: 2, type: 'precio', url: 'https://cdn.test/2.webp' },
  { slot: 1, type: 'hero', url: 'https://cdn.test/1.webp' },
];

describe('buildLandingHtml', () => {
  const html = buildLandingHtml(inputs, images);

  it('es un documento HTML con título y meta description', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>Masajeador Cervical</title>');
    expect(html).toContain('Alivio rápido del dolor cervical');
  });

  it('apila las imágenes ordenadas por slot (hero primero)', () => {
    const h1 = html.indexOf('https://cdn.test/1.webp');
    const h2 = html.indexOf('https://cdn.test/2.webp');
    expect(h1).toBeGreaterThan(-1);
    expect(h1).toBeLessThan(h2); // slot 1 (hero) antes que slot 2
  });

  it('incluye CTA, precio de oferta y precio tachado', () => {
    expect(html).toContain('Comprar ahora');
    expect(html).toContain('49.900 COP');
    expect(html).toContain('99.900 COP'); // compare-at
  });

  it('incluye capa de conversión: contador, CTA fija y popup de salida', () => {
    expect(html).toContain('id="cd"');
    expect(html).toContain('class="sticky"');
    expect(html).toContain('id="pop"');
  });

  it('incluye SEO: OpenGraph image (hero) y JSON-LD Product', () => {
    expect(html).toContain('og:image" content="https://cdn.test/1.webp"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"priceCurrency":"COP"');
  });

  it('escapa el contenido de texto (sin inyección)', () => {
    const x = buildLandingHtml({ ...inputs, productName: 'Pro<script>x</script>' }, images);
    expect(x).not.toContain('<script>x</script>');
    expect(x).toContain('Pro&lt;script&gt;');
  });

  it('escapa la moneda (sin inyección HTML vía currency)', () => {
    const x = buildLandingHtml({ ...inputs, currency: '"<b' }, images);
    expect(x).not.toContain('49.900 "<b');
    expect(x).toContain('&lt;b');
  });

  it('neutraliza un buyUrl con esquema peligroso (javascript:) al ancla segura', () => {
    const x = buildLandingHtml(inputs, images, { buyUrl: 'javascript:alert(1)' });
    expect(x).not.toContain('javascript:alert');
    expect(x).toContain('href="#oferta"');
  });

  it('conserva un buyUrl https válido', () => {
    const x = buildLandingHtml(inputs, images, { buyUrl: 'https://mitienda.com/checkout' });
    expect(x).toContain('https://mitienda.com/checkout');
  });

  it('omite el precio tachado cuando no hay oferta', () => {
    const x = buildLandingHtml({ ...inputs, regularPrice: 49900 }, images);
    expect((x.match(/49.900 COP/g) || []).length).toBeGreaterThan(0);
    expect(x).not.toContain('class="old"');
  });
});
