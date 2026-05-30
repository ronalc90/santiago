import { describe, it, expect } from 'vitest';
import { LANDING_SLOTS, getSlot, buildImagePrompt, LandingInputs } from '../lib/services/landing-spec';

const inputs: LandingInputs = {
  productName: 'Masajeador cervical',
  offerPrice: 89900,
  regularPrice: 159900,
  country: 'CO',
  currency: 'COP',
  audience: 'Adultos con dolor de cuello',
  description: 'Masajeador con calor.',
  offerType: '2x1',
  angle: 'Alivio rápido',
};

describe('landing spec', () => {
  it('define exactamente 9 slots con números 1..9', () => {
    expect(LANDING_SLOTS).toHaveLength(9);
    expect(LANDING_SLOTS.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('getSlot devuelve el slot correcto', () => {
    expect(getSlot(1)?.type).toBe('hero');
    expect(getSlot(99)).toBeUndefined();
  });

  it('el prompt incluye el contexto del producto y exige texto en español', () => {
    const p = buildImagePrompt(LANDING_SLOTS[0], inputs, null, false);
    expect(p).toContain('Masajeador cervical');
    expect(p).toContain('SPANISH');
  });

  it('añade reglas de compliance cuando se activa', () => {
    const withCompliance = buildImagePrompt(LANDING_SLOTS[0], inputs, null, true);
    const without = buildImagePrompt(LANDING_SLOTS[0], inputs, null, false);
    expect(withCompliance).toContain('COMPLIANCE');
    expect(without).not.toContain('COMPLIANCE');
  });

  it('incorpora la paleta del análisis de estilo cuando existe', () => {
    const p = buildImagePrompt(LANDING_SLOTS[0], inputs, {
      visualStyle: 'premium', palette: ['#000000', '#FFFFFF'], atmosphere: 'luz suave',
      typography: 'sans', iconStyle: 'líneas', effects: 'sombras', layout: 'centrado', editorialDetails: 'badges',
    }, false);
    expect(p).toContain('#000000');
    expect(p).toContain('premium');
  });
});
