import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { importDropiCsv, matchCandidatesToDropi } from '@/lib/services/dropi-catalog';

const schema = z.object({ csv: z.string().min(1).max(8_000_000) });

/** Importa el catálogo Dropi por CSV (Dropi no da API) y re-cruza los candidatos. */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'CSV requerido' }, { status: 400 });
  const result = await importDropiCsv(parsed.data.csv);
  const matched = await matchCandidatesToDropi().catch(() => 0);
  return NextResponse.json({ ...result, matched });
}
