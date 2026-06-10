import { describe, it, expect } from 'vitest';
import { effectivePrompts, PROMPT_DEFS, PROMPT_KEYS } from '../lib/services/prompts';

const defaultOf = (key: string) => PROMPT_DEFS.find((d) => d.key === key)!.default;

describe('effectivePrompts', () => {
  it('devuelve los defaults cuando no hay overrides', () => {
    const p = effectivePrompts(null);
    expect(p[PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM]).toBe(defaultOf(PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM));
    expect(p[PROMPT_KEYS.LANDING_COPY_SYSTEM]).toBe(defaultOf(PROMPT_KEYS.LANDING_COPY_SYSTEM));
  });

  it('aplica un override válido y deja el resto en default', () => {
    const p = effectivePrompts({ [PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM]: 'Mi prompt custom' });
    expect(p[PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM]).toBe('Mi prompt custom');
    expect(p[PROMPT_KEYS.LANDING_COPY_SYSTEM]).toBe(defaultOf(PROMPT_KEYS.LANDING_COPY_SYSTEM));
  });

  it('ignora overrides vacíos o de claves desconocidas', () => {
    const p = effectivePrompts({ [PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM]: '   ', desconocida: 'x' } as Record<string, unknown>);
    expect(p[PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM]).toBe(defaultOf(PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM));
    expect((p as Record<string, unknown>).desconocida).toBeUndefined();
  });
});
