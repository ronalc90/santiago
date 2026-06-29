import { COMMITS } from '@/lib/commits.generated';

/**
 * Versión y cambios de WinSpy. La VERSIÓN es el número de commit: si hay 58
 * commits, vamos en la v0.58. Cada commit es una versión (v0.1, v0.2, …, v0.58),
 * la más reciente es la actual. El número es estable por commit (ordinal desde
 * el primer commit).
 *
 * Las fechas/hashes salen del historial real (lib/commits.generated.ts, generado
 * con `npm run gen:commits`). Aquí se añade la explicación entendible por commit.
 */
export interface Release {
  /** "0.N" donde N es el número de commit (1 = el primero). */
  version: string;
  date: string;
  hash: string;
  title: string;
  detail: string;
}

/** Explicación clara por commit (hash → título + detalle entendible). */
const DETAILS: Record<string, { title: string; detail: string }> = {
  ee7197c: { title: 'Store Replication (validado por el mercado)', detail: 'En el detalle del producto, cuántas tiendas distintas corren el mismo producto; con ≥3 aparece «validado por el mercado».' },
  c12366b: { title: 'Loop de validación con resultados reales', detail: 'Registras ROAS/CPA/ventas/no entrega real; la no entrega real realimenta el margen y un badge marca validado/marginal/pierde plata.' },
  '0b3fb24': { title: 'Serie temporal de anuncios (AdSnapshot) + Velocity', detail: 'Cada sincronización guarda una foto del anuncio; en el detalle aparece la tendencia (subiendo/estable/bajando) cuando hay serie suficiente.' },
  '823b3a5': { title: 'Glosario en Ayuda, tooltips de métricas y foco más visible', detail: 'Glosario de Winner Score/4×25/Cascade/margen COD/Con Dropi; tooltips donde aparecen las métricas; anillo de foco más visible.' },
  '96d6bf0': { title: 'Menú por flujo, onboarding y accesibilidad', detail: 'Menú agrupado (Descubrir/Operar/Admin), banner de primeros pasos, labels y foco accesibles, y skip-link.' },
  '0a91501': { title: 'Subir archivo CSV del catálogo Dropi', detail: 'Importar el catálogo Dropi acepta subir el archivo (no solo pegar el texto).' },
  ff2c5b7: { title: 'Catálogo Dropi: buscar y filtrar el catálogo importado', detail: 'Nueva página «Catálogo Dropi» para buscar por nombre, filtrar por categoría y ordenar por costo lo que importes por CSV.' },
  bb49eec: { title: 'Link «buscar en Dropi» en cada candidato', detail: 'Cada candidato (no solo los cruzados) enlaza a tu panel de Dropi buscando ese producto por nombre.' },
  e88373d: { title: 'Precios en COP correctos en landings/IA + diagnóstico de Shopify vacío', detail: 'Arregla "70.000"→70 (parseCop), pasa el precio formateado a la IA con instrucción de exactitud, y avisa claro cuando tu Shopify no tiene productos.' },
  '555131d': { title: 'El catálogo Dropi se llena solo desde Shopify en cada búsqueda', detail: 'La discovery refresca el catálogo desde Shopify y cruza en la misma corrida, sin botón ni CSV.' },
  '8510808': { title: '«Con Dropi» arreglado: cruce por contención + lectura sin read_inventory', detail: 'Dos arreglos para que «Con Dropi» muestre productos: el cruce de nombres pasa a contención (los títulos largos de ML ya cruzan) y el espejo de Shopify ya no depende del scope read_inventory.' },
  '263ad59': { title: 'Sync diario del espejo Dropi + link al panel de Dropi', detail: 'El espejo de Shopify se sincroniza a diario junto a los costos, y el badge «Dropi» enlaza a tu panel de Dropi.' },
  '10c6df2': { title: 'Espejo del catálogo Dropi vía Shopify', detail: 'WinSpy lee los productos de tu Shopify (que Dropi alimenta) y los usa como catálogo Dropi para cruzar candidatos. Camino automático que Dropi sí soporta.' },
  '59cd90d': { title: 'Catálogo Dropi por CSV (Dropi no da API directa)', detail: 'Dropi confirmó que no da acceso directo a su API para integraciones propias; el catálogo vuelve a ser por CSV como camino soportado.' },
  d5c1faf: { title: 'Dropi API: diagnóstico de acceso por IP', detail: 'Probado contra la API real: el endpoint es correcto, pero Dropi valida por IP. Mensaje claro al respecto.' },
  ade4431: { title: 'Catálogo de Dropi: endpoint real de Integraciones', detail: 'Se corrige la integración con Dropi al endpoint real (/integrations/products/index) con el token de Integración; mensaje claro si el token está restringido por IP.' },
  f3d78eb: { title: 'Catálogo de Dropi por API (primer intento)', detail: 'Primer cliente para traer el catálogo de Dropi automáticamente (luego corregido con el endpoint real de Integraciones).' },
  '65a3b40': { title: 'La versión es el número de commit (v0.N)', detail: 'Cada commit es una versión: con N commits hechos, la actual es la v0.N.' },
  '92b73b7': { title: 'Una versión por cada cambio, clara y con fecha', detail: 'El apartado «Versión y cambios» muestra cada cambio del proyecto como una versión, con su explicación entendible y su fecha.' },
  a019b66: { title: 'Dinero en pesos (COP), señales automáticas y aviso de Dropi', detail: 'Todo el dinero del negocio se muestra en pesos colombianos. Las señales que el sistema detecta solo de los anuncios («se vende en CO», «creativo extranjero sin usar») quedan de solo lectura, y se avisa cuándo falta importar el catálogo Dropi para que el filtro «Con Dropi» funcione.' },
  a90b853: { title: 'Historial completo de versiones y commits', detail: 'El apartado de versiones pasa a mostrar todo el historial del proyecto, no solo las últimas versiones.' },
  '33b514b': { title: 'Modo lectura y tema guardado en tu cuenta', detail: 'Se agrega un tercer tema (lectura, tipo papel sepia) además de claro y oscuro, y la preferencia queda guardada en tu cuenta para cualquier dispositivo.' },
  '320bdb1': { title: 'Nuevo apartado «Versión y cambios»', detail: 'Aparece en Ajustes la sección que muestra la versión actual y qué se ha hecho en cada una.' },
  e2eaed1: { title: 'Guardar reglas no falla con configuraciones viejas', detail: 'El guardado de reglas de oportunidad ya no da error si vienen de una versión anterior sin los parámetros de pago contra entrega.' },
  '7145ad6': { title: 'Detector de ganadores globales que aún no llegan a Colombia', detail: 'Nuevo «Cascade Score»: marca productos ya probados en varios países que todavía no se venden en Colombia, para entrar antes que la competencia.' },
  '55deb94': { title: 'Winner Score con tope y margen real de contra entrega', detail: 'El Winner Score deja de premiar sin límite a los anuncios viejos (uno demasiado antiguo está saturado) y el margen descuenta las pérdidas reales del pago contra entrega.' },
  '33a23b8': { title: 'Prompts por imagen, página de Ayuda y modo claro/oscuro', detail: 'Se pueden ajustar los prompts de cada una de las 9 imágenes, hay una página de Ayuda y se agrega el modo claro/oscuro.' },
  '1504e14': { title: 'Fotos de candidatos, progreso en vivo y acceso a la landing', detail: 'Los candidatos descubiertos muestran sus fotos, se ve el progreso de la búsqueda en vivo y hay acceso directo a la landing.' },
  '09f52d8': { title: 'Correcciones del descubrimiento (revisión)', detail: 'Arreglos detectados en la revisión de la segunda fase del descubrimiento de productos.' },
  '578d219': { title: 'Descubrimiento ampliado: Trends, Meta/TikTok, IA y Dropi', detail: 'El descubrimiento suma Google Trends, anuncios de Meta y TikTok, deduplicado por inteligencia artificial, catálogo Dropi por archivo CSV y creativos.' },
  e40075f: { title: 'Correcciones y limpieza del descubrimiento', detail: 'Arreglos de la revisión y limpieza de código que ya no se usaba.' },
  '6f54bc6': { title: 'Descubrimiento de productos ganadores (núcleo gratis)', detail: 'Primer núcleo del buscador de productos ganadores, usando fuentes gratuitas.' },
  '6ddeef5': { title: 'Buscar anuncios por país y término', detail: 'Permite buscar anuncios por país y palabra clave, con ingesta automática en varios países.' },
  '50a652b': { title: 'Arreglo de la medición de competencia en MercadoLibre', detail: 'Se corrige cómo se mide la saturación/competencia en MercadoLibre (el método anterior fallaba).' },
  bd66122: { title: 'Coherencia del «creativo sin usar» en Colombia', detail: 'Un anuncio que ya corre en Colombia deja de contarse como «creativo extranjero sin usar».' },
  '82e9924': { title: 'Mensaje claro si falta el permiso de MercadoLibre', detail: 'Se explica con claridad cuándo falta el permiso para mantener la conexión con MercadoLibre.' },
  e635fe4: { title: 'Conexión estable con MercadoLibre', detail: 'Se pide el permiso necesario para renovar la sesión de MercadoLibre automáticamente.' },
  '30aa901': { title: 'Errores visibles al conectar MercadoLibre', detail: 'Muestra el error real al conectar y evita reintentar un código ya usado.' },
  bbecfe9: { title: 'Diagnóstico de la conexión con MercadoLibre', detail: 'Ayuda a entender por qué falla la conexión con MercadoLibre.' },
  '4c3a871': { title: 'Manual de usuario con capturas', detail: 'Se agrega el manual de uso de WinSpy con imágenes.' },
  '5d8e74e': { title: 'Login de MercadoLibre estable en producción', detail: 'Asegura la dirección pública correcta en producción para el inicio de sesión con MercadoLibre.' },
  '12e6413': { title: 'Arranque correcto del proceso en segundo plano', detail: 'El proceso que trae datos en segundo plano (worker) arranca bien.' },
  '7554832': { title: 'Medir competencia en MercadoLibre', detail: 'Mide cuántas publicaciones compiten en MercadoLibre para el score, vía conexión oficial.' },
  '39624b1': { title: 'Anuncio de Colombia marca «se vende en CO»', detail: 'Si un anuncio aparece en el Ad Library de Colombia, el producto se marca como que ya se vende ahí.' },
  d55438a: { title: 'Costo por artículo desde Shopify', detail: 'Lee el costo real de cada producto desde Shopify para calcular el margen.' },
  '8185e9b': { title: 'Landing de ventas en HTML', detail: 'Genera una landing de ventas en HTML con los remates del motor de oportunidad.' },
  '7dccdb3': { title: 'Motor de oportunidad 4×25', detail: 'Califica cada producto en 4 dimensiones: demanda, competencia, margen y creativos.' },
  '836deb4': { title: 'Prompts de IA editables', detail: 'Los textos que guían a la IA se pueden editar desde Ajustes.' },
  '2ebcab8': { title: 'Publicar landing en Shopify en un clic', detail: 'Publica la landing como producto de Shopify directamente.' },
  '1828c85': { title: 'Exportar landing a Shopify (CSV)', detail: 'Exporta la landing como producto de Shopify en archivo CSV.' },
  '37ce0c5': { title: 'Guía de usuario sencilla', detail: 'Guía simple y no técnica para el dueño.' },
  f82ad61: { title: 'Score por longevidad, regenerar landing y paginación', detail: 'Mejora el score por antigüedad del anuncio, permite regenerar landings, limpia la importación y agrega paginación.' },
  d971373: { title: 'Arreglo del despliegue del proceso en segundo plano', detail: 'Fija la versión de la herramienta de despliegue para que el worker suba bien.' },
  '61e14bd': { title: 'Redespliegue de verificación', detail: 'Despliegue de prueba tras limpiar un proceso duplicado.' },
  '9763e4a': { title: 'Navegación móvil mejorada', detail: 'Mejor navegación en celular y ajustes en todas las pantallas.' },
  '3ac3c3f': { title: 'Textos de IA reales obligatorios en producción', detail: 'Documenta que en producción no se permite el modo de prueba para los textos de IA.' },
  '20cf3bf': { title: 'Correcciones de IA, scoring y experiencia de producto', detail: 'Arreglos de auditoría en la IA, el cálculo de scores y el uso de la sección de productos.' },
  e11192a: { title: 'Arreglos críticos de seguridad y robustez', detail: 'Correcciones importantes y mejoras rápidas de seguridad.' },
  '5fbad43': { title: 'Compatibilidad de base de datos con Vercel', detail: 'Ajuste técnico para que la base de datos funcione en el servidor de Vercel.' },
  c7a77e8: { title: 'Arreglo del inicio de sesión en Vercel', detail: 'Se quita un límite de intentos que tumbaba el login en producción.' },
  f8f0f3a: { title: 'Descarga de creativos estable', detail: 'El proceso en segundo plano descarga los creativos correctamente.' },
  '6234cd4': { title: 'Sincronización de anuncios sin pedir login', detail: 'Permite traer anuncios con un token de servicio sin redirigir al login.' },
  '7f22854': { title: 'Pipeline de despliegue con administrador', detail: 'Asegura el usuario administrador al desplegar e ignora archivos sensibles.' },
  '96a5419': { title: 'Quitar datos de demostración', detail: 'Elimina datos de prueba y cierra pendientes para producción.' },
  '665b786': { title: 'Winner Score útil sin gasto de Meta', detail: 'El Winner Score funciona con datos reales aunque Meta no publique el gasto.' },
  e58cecb: { title: 'Apartado de Costos (COP/USD)', detail: 'Sección de costos en pesos y dólares, con botón para sincronizar anuncios reales.' },
  '7113973': { title: 'Integración de anuncios reales (merge)', detail: 'Une la rama con los anuncios reales del Meta Ad Library.' },
  '9dcade2': { title: 'Anuncios reales del Meta Ad Library', detail: 'Trae anuncios reales del Meta Ad Library usando Apify.' },
  '02aa85f': { title: 'Visor de imágenes a pantalla completa', detail: 'Permite ver los creativos en grande, a pantalla completa.' },
  f6fc305: { title: 'Generación de textos con OpenAI', detail: 'Sugiere producto y copy de landing con inteligencia artificial.' },
  '0520f14': { title: 'Limpieza de código (Gemini)', detail: 'Mejora técnica del cliente de Gemini.' },
  '01dfa20': { title: 'Arreglo de tipos para el build', detail: 'Ajuste técnico de la respuesta de Gemini para que compile en Vercel.' },
  '3e40070': { title: 'Configuración del proceso en Railway', detail: 'Prepara el worker (proceso en segundo plano) en Railway.' },
  a9d5b01: { title: 'Producción estable y Gemini por REST', detail: 'Build de producción funcionando, Gemini por API REST y páginas de error.' },
  '44f683a': { title: 'Fijar Node 20', detail: 'Usa Node 20 para evitar fallos al generar las páginas.' },
  ff9cc91: { title: 'Build de producción y páginas de error', detail: 'Build verde, páginas de error y configuración de despliegue.' },
  c5cccb5: { title: 'Primera versión de WinSpy', detail: 'Importación inicial: spy de anuncios, generador de landings y dashboard.' },
};

/** Una versión por commit (más reciente primero), con explicación clara y fecha. */
export const RELEASES: Release[] = COMMITS.map((c, i) => {
  const d = DETAILS[c.hash];
  return {
    // El más reciente (i=0) es el commit nº COMMITS.length → v0.{length}.
    version: `0.${COMMITS.length - i}`,
    date: c.date,
    hash: c.hash,
    title: d?.title ?? c.subject,
    detail: d?.detail ?? '',
  };
});

/** Versión actual (la más reciente) = "0.{nº de commits}". */
export const APP_VERSION = RELEASES[0]?.version ?? '0.1';
