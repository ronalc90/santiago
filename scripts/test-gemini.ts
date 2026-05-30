/**
 * Prueba de conectividad con Gemini.
 *   npx tsx scripts/test-gemini.ts
 * Lee GEMINI_API_KEY y GEMINI_TEXT_MODEL del .env. Útil para confirmar la key
 * y el nombre del modelo antes de cambiar IMAGE_PROVIDER a "gemini".
 */
import 'dotenv/config';

async function main() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';
  if (!key) throw new Error('Falta GEMINI_API_KEY en .env');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Di "hola" en una palabra.' }] }] }),
  });
  console.log('HTTP', res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error('Error:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '(sin texto)';
  console.log('Respuesta del modelo:', text);
  console.log('\n✅ Conectividad OK. Para imágenes, confirma que GEMINI_IMAGE_MODEL apunte a un modelo de imagen con acceso.');
}

main().catch((e) => { console.error(e); process.exit(1); });
