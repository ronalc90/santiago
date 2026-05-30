import { describe, it, expect, vi, afterEach } from 'vitest';

// Variables mínimas para que getEnv() valide al construir ApifyAdSource.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test';
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'x'.repeat(16);
process.env.INGEST_API_TOKEN = process.env.INGEST_API_TOKEN ?? 'x'.repeat(8);
process.env.APIFY_TOKEN = process.env.APIFY_TOKEN ?? 'test-token';
process.env.AD_SOURCE_PROVIDER = 'apify';

import { MockAdSource } from '@/lib/ad-sources/mock';
import { ApifyAdSource } from '@/lib/ad-sources/apify';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MockAdSource', () => {
  it('devuelve fixtures con imagen descargable, normaliza país y respeta el limit', async () => {
    const ads = await new MockAdSource().fetchAds({ country: 'co', query: 'masajeador', limit: 2 });
    expect(ads).toHaveLength(2);
    expect(ads[0].country).toBe('CO');
    expect(ads[0].imageUrls[0]).toMatch(/^https:\/\/placehold\.co/);
    expect(ads[0].adLibraryUrl).toContain('ad_type=all');
    expect(ads[0].adLibraryUrl).not.toContain('political_and_issue_ads');
  });
});

describe('ApifyAdSource', () => {
  it('mapea el snapshot del actor a RawAd (imágenes, video, carrusel, fechas)', async () => {
    const sample = [
      {
        ad_archive_id: '123456789012345',
        is_active: true,
        start_date: 1735689600, // epoch en segundos
        publisher_platform: ['facebook', 'instagram'],
        snapshot: {
          page_name: 'GadgetPro CO',
          body: { text: 'Masajeador cervical recargable' },
          cta_text: 'Comprar ahora',
          link_url: 'https://shop.example/p',
          images: [{ original_image_url: 'https://cdn.fb/i.jpg' }],
          videos: [{ video_hd_url: 'https://cdn.fb/v.mp4' }],
          cards: [{ original_image_url: 'https://cdn.fb/card.jpg' }],
        },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    vi.stubGlobal('fetch', fetchMock);

    const ads = await new ApifyAdSource().fetchAds({ country: 'CO', query: 'masajeador', limit: 10 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    const calledOpts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(calledUrl).toContain('curious_coder~facebook-ads-library-scraper');
    // El token va en el header Authorization, NO en la query string (CWE-598).
    expect(calledUrl).not.toContain('test-token');
    expect(calledOpts.headers.Authorization).toBe('Bearer test-token');

    expect(ads).toHaveLength(1);
    const ad = ads[0];
    expect(ad.adId).toBe('123456789012345');
    expect(ad.pageName).toBe('GadgetPro CO');
    expect(ad.copyText).toBe('Masajeador cervical recargable');
    expect(ad.ctaText).toBe('Comprar ahora');
    expect(ad.videoUrls).toContain('https://cdn.fb/v.mp4');
    expect(ad.imageUrls).toContain('https://cdn.fb/i.jpg');
    expect(ad.imageUrls).toContain('https://cdn.fb/card.jpg');
    expect(ad.isActive).toBe(true);
    expect(ad.startDate?.getTime()).toBe(1735689600 * 1000);
  });

  it('extrae el rango de impresiones (números, texto "10K-15K" y videos en cards)', async () => {
    const sample = [
      {
        ad_archive_id: '1',
        snapshot: { page_name: 'A', impressions: { lower_bound: 1000, upper_bound: 5000 } },
      },
      {
        ad_archive_id: '2',
        snapshot: { page_name: 'B' },
        impressions: { lower_bound: '1,000', upper_bound: '5K' },
      },
      {
        ad_archive_id: '3',
        snapshot: {
          page_name: 'C',
          cards: [{ video_hd_url: 'https://cdn.fb/cardvid.mp4', original_image_url: 'https://cdn.fb/cardimg.jpg' }],
        },
        impressionsWithIndex: { impressions_text: '10K-15K' },
      },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sample }));
    const ads = await new ApifyAdSource().fetchAds({ country: 'CO', query: 'x', limit: 10 });
    expect(ads).toHaveLength(3);
    expect(ads[0].impressionsRange).toEqual([1000, 5000]);
    expect(ads[1].impressionsRange).toEqual([1000, 5000]);
    expect(ads[2].impressionsRange).toEqual([10000, 15000]);
    // Video dentro de card debe recolectarse.
    expect(ads[2].videoUrls).toContain('https://cdn.fb/cardvid.mp4');
    expect(ads[2].imageUrls).toContain('https://cdn.fb/cardimg.jpg');
  });

  it('descarta items sin ad id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ snapshot: { page_name: 'sin id' } }] }),
    );
    const ads = await new ApifyAdSource().fetchAds({ country: 'CO', query: 'x', limit: 5 });
    expect(ads).toHaveLength(0);
  });

  it('lanza un error claro si el actor responde con error no transitorio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'token inválido' }),
    );
    await expect(new ApifyAdSource().fetchAds({ country: 'CO', query: 'x', limit: 5 })).rejects.toThrow(/401/);
  });
});
