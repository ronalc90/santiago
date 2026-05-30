import { promises as fs } from 'fs';
import path from 'path';
import { StorageAdapter, StoredObject } from '@/lib/storage/types';
import { getEnv } from '@/lib/config/env';

/** Almacenamiento en disco local (desarrollo). Sirve archivos vía /api/files. */
export class LocalStorage implements StorageAdapter {
  private root: string;
  private baseUrl: string;

  constructor() {
    const env = getEnv();
    this.root = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
    this.baseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  private full(key: string) {
    // Resuelve de forma canónica y confina a la raíz. NO usar replace de cadenas
    // (un saneo de una sola pasada es evadible con "....//"). path.resolve hace
    // que la raíz mande y luego verificamos que el resultado no la abandone.
    const resolved = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (resolved !== this.root && !resolved.startsWith(rootWithSep)) {
      throw new Error('Clave fuera del almacenamiento');
    }
    return resolved;
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<StoredObject> {
    const file = this.full(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return { key, url: this.publicUrl(key), bytes: data.length };
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const data = await fs.readFile(this.full(key));
      const ext = path.extname(key).toLowerCase();
      const types: Record<string, string> = {
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
      };
      const contentType = types[ext] ?? 'application/octet-stream';
      return { data, contentType };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
