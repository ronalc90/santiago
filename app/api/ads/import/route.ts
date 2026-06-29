import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { getErrorMessage } from '@/lib/errors';
import { requireApiUser } from '@/lib/auth/api';
import { normalizeIngestPayload } from '@/lib/validation/ads';
import { ingestAds } from '@/lib/services/ads';

/**
 * Importador manual. Acepta:
 *  - JSON: { ads: [...] } o array
 *  - CSV (texto): columnas con los nombres del spy (store_name, ad_id, ...)
 * Cuerpo: { format: 'json'|'csv', data: string }
 */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const format = body.format as 'json' | 'csv';
    const data = body.data as string;
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'Falta el contenido a importar' }, { status: 400 });
    }

    let rows: unknown;
    if (format === 'csv') {
      const parsed = Papa.parse(data.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false });
      if (parsed.errors.length) {
        return NextResponse.json({ error: `CSV inválido: ${parsed.errors[0].message}` }, { status: 422 });
      }
      rows = parsed.data;
    } else {
      try {
        rows = JSON.parse(data);
      } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 422 });
      }
    }

    let ads;
    try {
      ads = normalizeIngestPayload(rows);
    } catch (err) {
      const msg = getErrorMessage(err, 'Datos inválidos');
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const result = await ingestAds(ads);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[ads/import]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
