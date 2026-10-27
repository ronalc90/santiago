import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regresiones de seguridad en route handlers (sin BD ni red: Prisma, la sesión y
 * el almacenamiento van simulados).
 */

const db = vi.hoisted(() => ({
  product: { findMany: vi.fn(), findUnique: vi.fn() },
}));
const storageGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/auth/api', () => ({
  requireApiUser: vi.fn(async () => ({ id: 'u1', email: 'a@b.co', name: 'A', role: 'MEMBER', theme: 'dark' })),
}));
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1', email: 'a@b.co', name: 'A', role: 'MEMBER', theme: 'dark' })),
}));
vi.mock('@/lib/storage', () => ({ getStorage: () => ({ get: storageGet }) }));

import { GET as listProducts } from '@/app/api/products/route';
import { GET as getProduct } from '@/app/api/products/[id]/route';
import { GET as getFile } from '@/app/api/files/[...path]/route';
import { PUBLIC_USER_SELECT } from '@/lib/auth/public-user';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/products no expone el hash de la contraseña del dueño', () => {
  it('PUBLIC_USER_SELECT no incluye passwordHash', () => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty('passwordHash');
    expect(Object.keys(PUBLIC_USER_SELECT).sort()).toEqual(['email', 'id', 'name']);
  });

  it('GET /api/products pide el owner con select acotado', async () => {
    db.product.findMany.mockResolvedValue([]);
    const res = await listProducts(new Request('https://winspy.test/api/products'));
    expect(res.status).toBe(200);
    const args = db.product.findMany.mock.calls[0][0];
    expect(args.include.owner).toEqual({ select: PUBLIC_USER_SELECT });
  });

  it('GET /api/products/[id] pide el owner con select acotado', async () => {
    db.product.findUnique.mockResolvedValue({ id: 'p1' });
    const res = await getProduct(new Request('https://winspy.test/api/products/p1'), {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(200);
    const args = db.product.findUnique.mock.calls[0][0];
    expect(args.include.owner).toEqual({ select: PUBLIC_USER_SELECT });
  });
});

describe('/api/files no sirve HTML en el origen de la app', () => {
  const fetchFile = (...path: string[]) =>
    getFile(new Request(`https://winspy.test/api/files/${path.join('/')}`), { params: Promise.resolve({ path }) });

  it('un objeto guardado como text/html se fuerza a descarga', async () => {
    storageGet.mockResolvedValue({ data: Buffer.from('<script>alert(1)</script>'), contentType: 'text/html; charset=utf-8' });
    const res = await fetchFile('ads', '123', 'abc.mp4');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toBe('attachment');
  });

  it('SVG (puede llevar scripts) tampoco se sirve en línea', async () => {
    storageGet.mockResolvedValue({ data: Buffer.from('<svg/>'), contentType: 'image/svg+xml' });
    const res = await fetchFile('ads', '123', 'x.webp');
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
  });

  it('las imágenes y videos permitidos se sirven en línea', async () => {
    storageGet.mockResolvedValue({ data: Buffer.from('RIFF'), contentType: 'image/webp' });
    const img = await fetchFile('ads', '123', 'abc.webp');
    expect(img.headers.get('content-type')).toBe('image/webp');
    expect(img.headers.get('content-disposition')).toBeNull();

    storageGet.mockResolvedValue({ data: Buffer.from('mp4'), contentType: 'Video/MP4' });
    const vid = await fetchFile('ads', '123', 'abc.mp4');
    expect(vid.headers.get('content-type')).toBe('video/mp4');
  });
});
