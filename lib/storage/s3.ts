import type { S3Client } from '@aws-sdk/client-s3';
import { StorageAdapter, StoredObject } from '@/lib/storage/types';
import { getEnv } from '@/lib/config/env';

/**
 * Adaptador S3 / Cloudflare R2 (producción).
 * Carga @aws-sdk/client-s3 de forma perezosa para no añadirlo como dependencia
 * obligatoria en dev. Para usarlo:
 *   npm i @aws-sdk/client-s3
 *   STORAGE_DRIVER=s3 y rellena S3_* en .env
 */
export class S3Storage implements StorageAdapter {
  private bucket: string;
  private publicBase: string;
  private clientPromise: Promise<S3Client>;

  constructor() {
    const env = getEnv();
    this.bucket = env.S3_BUCKET;
    this.publicBase = (env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    this.clientPromise = (async () => {
      // Import perezoso: solo se resuelve si el adaptador S3 se usa de verdad
      const mod = await import('@aws-sdk/client-s3').catch(() => {
        throw new Error('Falta @aws-sdk/client-s3. Ejecuta: npm i @aws-sdk/client-s3');
      });
      return new mod.S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT || undefined,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
        forcePathStyle: true,
      });
    })();
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const client = await this.clientPromise;
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
    return { key, url: this.publicUrl(key), bytes: data.length };
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const client = await this.clientPromise;
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return { data: Buffer.from(bytes), contentType: res.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}
