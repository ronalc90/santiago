import { describe, it, expect } from 'vitest';
import { parseCop, formatCop } from '@/lib/format';

describe('parseCop — precios en pesos colombianos', () => {
  it('"70.000" (separador de miles) → 70000, NO 70 (el bug reportado)', () => {
    expect(parseCop('70.000')).toBe(70000);
  });
  it('tolera símbolo y moneda: "$ 70.000 COP" → 70000', () => {
    expect(parseCop('$ 70.000 COP')).toBe(70000);
  });
  it('número entero se respeta; sin centavos', () => {
    expect(parseCop(70000)).toBe(70000);
    expect(parseCop(89900.6)).toBe(89901);
  });
  it('vacío/no numérico → 0', () => {
    expect(parseCop('')).toBe(0);
    expect(parseCop(null)).toBe(0);
    expect(parseCop('abc')).toBe(0);
  });
});

describe('formatCop', () => {
  it('formatea en COP sin decimales', () => {
    expect(formatCop(70000)).toContain('70.000');
    expect(formatCop(0)).toContain('0');
  });
});
