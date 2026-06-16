import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { saveDiscoveryConfig } from '@/lib/services/discovery-config';

const schema = z.object({
  sources: z.object({ trends: z.boolean(), meta: z.boolean(), tiktok: z.boolean(), embeddings: z.boolean() }),
  countries: z.array(z.string().trim().min(2).max(4)).max(10),
  keywords: z.array(z.string().trim().min(1).max(120)).max(50),
});

/** Guarda la config de descubrimiento (switches por fuente + países/keywords). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const config = await saveDiscoveryConfig({
    sources: parsed.data.sources,
    countries: parsed.data.countries.map((c) => c.toUpperCase()),
    keywords: parsed.data.keywords,
  });
  return NextResponse.json({ config });
}
