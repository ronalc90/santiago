import { AdSourceProvider } from '@/lib/ad-sources/types';
import { MockAdSource } from '@/lib/ad-sources/mock';
import { ApifyAdSource } from '@/lib/ad-sources/apify';
import { getEnv } from '@/lib/config/env';

/** Devuelve la fuente de anuncios según AD_SOURCE_PROVIDER (mock | apify). */
export function getAdSource(): AdSourceProvider {
  const env = getEnv();
  return env.AD_SOURCE_PROVIDER === 'apify' ? new ApifyAdSource() : new MockAdSource();
}

export type { AdSourceProvider, FetchAdsInput, RawAd } from '@/lib/ad-sources/types';
