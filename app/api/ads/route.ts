import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { listAds, AdFilters } from '@/lib/services/ads';

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  // Convierte un parámetro a número finito o undefined: evita que un valor no
  // numérico (?page=abc) se propague como NaN a Prisma (skip: NaN / gte: NaN).
  const num = (v: string | null): number | undefined => {
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const filters: AdFilters = {
    classification: searchParams.get('classification') || undefined,
    country: searchParams.get('country') || undefined,
    onlyNew: searchParams.get('onlyNew') === 'true' || undefined,
    sellsInColombia: searchParams.has('sellsInColombia')
      ? searchParams.get('sellsInColombia') === 'true'
      : undefined,
    hasUnusedForeignCreative: searchParams.has('hasUnusedForeignCreative')
      ? searchParams.get('hasUnusedForeignCreative') === 'true'
      : undefined,
    minDaysActive: num(searchParams.get('minDaysActive')),
    search: searchParams.get('search') || undefined,
    sortBy: (searchParams.get('sortBy') as AdFilters['sortBy']) || undefined,
    sortDir: (searchParams.get('sortDir') as AdFilters['sortDir']) || undefined,
    page: num(searchParams.get('page')),
  };

  try {
    const result = await listAds(filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[ads:list]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
