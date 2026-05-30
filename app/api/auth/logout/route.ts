import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/logout]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
