/** Contrato del generador de texto (OpenAI, Gemini o mock). */
export interface TextGenerator {
  /**
   * Completa una instrucción y devuelve el texto del modelo.
   * Si jsonMode=true, se pide al modelo que responda SOLO con JSON válido.
   */
  complete(system: string, user: string, jsonMode?: boolean): Promise<string>;
}
