/** Resultado de guardar un objeto en el almacenamiento. */
export interface StoredObject {
  key: string; // clave/ruta relativa dentro del almacenamiento
  url: string; // URL pública para mostrar/descargar
  bytes: number;
}

/** Contrato de almacenamiento. Implementado por local y S3/R2. */
export interface StorageAdapter {
  /** Guarda un buffer y devuelve clave + url pública. */
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  /** Lee un objeto (para servirlo en dev). */
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  /** URL pública de una clave existente. */
  publicUrl(key: string): string;
}
