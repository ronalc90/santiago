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
    // Evita path traversal
    const safe = key.replace(/\.\.(\/|\\)/g, '');
    return path.join(this.root, safe);
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
      const contentType =
        ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
      return { data, contentType };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
