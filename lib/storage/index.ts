import { StorageAdapter } from '@/lib/storage/types';
import { LocalStorage } from '@/lib/storage/local';
import { S3Storage } from '@/lib/storage/s3';
import { getEnv } from '@/lib/config/env';

let cached: StorageAdapter | null = null;

/** Devuelve el adaptador de almacenamiento según STORAGE_DRIVER. */
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const env = getEnv();
  cached = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
  return cached;
}

export type { StorageAdapter, StoredObject } from '@/lib/storage/types';
