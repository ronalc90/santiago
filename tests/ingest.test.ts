import { describe, it, expect } from 'vitest';
import { normalizeIngestPayload, ingestAdSchema } from '../lib/validation/ads';

describe('normalizeIngestPayload', () => {
  const valid = {
    store_name: 'GadgetPro',
    country: 'co',
    ad_id: 'AD-1',
    ad_library_url: 'https://facebook.com/ads/library/?id=AD-1',
    days_active: '12',
    estimated_spend: '18000',
  };

  it('acepta { ads: [...] }', () => {
    const out = normalizeIngestPayload({ ads: [valid] });
    expect(out).toHaveLength(1);
    expect(out[0].ad_id).toBe('AD-1');
  });

  it('acepta un array directo', () => {
    const out = normalizeIngestPayload([valid]);
    expect(out).toHaveLength(1);
  });

  it('coacciona strings numéricos a number', () => {
    const out = normalizeIngestPayload([valid]);
    expect(out[0].days_active).toBe(12);
    expect(out[0].estimated_spend).toBe(18000);
  });

  it('rechaza payloads sin ad_id', () => {
    expect(() => normalizeIngestPayload([{ ...valid, ad_id: '' }])).toThrow();
  });

  it('rechaza URL inválida', () => {
    const parsed = ingestAdSchema.safeParse({ ...valid, ad_library_url: 'no-es-url' });
    expect(parsed.success).toBe(false);
  });

  it('rechaza lista vacía', () => {
    expect(() => normalizeIngestPayload({ ads: [] })).toThrow();
  });
});
