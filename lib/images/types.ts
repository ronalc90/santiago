import { StyleAnalysis } from '@/lib/services/landing-spec';

/** Imagen de referencia para condicionar la generación. */
export interface RefImage {
  data: Buffer;
  mimeType: string;
}

/** Contrato del generador de imágenes (Gemini real o mock). */
export interface ImageGenerator {
  /** Analiza la imagen de referencia y extrae los 8 elementos de estilo. */
  analyzeReference(image: RefImage): Promise<StyleAnalysis>;
  /**
   * Genera una imagen a partir de un prompt en inglés, opcionalmente
   * condicionada por la foto del producto y/o la imagen de referencia.
   * Devuelve un PNG sin comprimir (la compresión a WebP es un paso aparte).
   */
  generateImage(prompt: string, refs?: RefImage[]): Promise<Buffer>;
}
