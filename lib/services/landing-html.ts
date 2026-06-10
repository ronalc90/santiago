import { LandingInputs, getSlot } from '@/lib/services/landing-spec';
import { LandingImageRef } from '@/lib/services/shopify-export';

/**
 * Genera una landing de ventas HTML COMPLETA y autocontenida a partir de los
 * datos de la landing: las 9 imágenes apiladas (que ya son las secciones de
 * venta) envueltas con la "capa de conversión" (barra de urgencia con contador,
 * CTA fija, popup de salida, prueba social) + SEO/OpenGraph/JSON-LD.
 *
 * Es código PURO (string-building): no toca BD, red ni Next, y se puede testear.
 * El CSS y el JS van inline para que el archivo sea autocontenido (sirve para
 * subir a Shopify como página o publicar en cualquier hosting).
 */

export interface LandingHtmlOptions {
  /** URL del botón "Comprar" (checkout/producto). Si falta, hace scroll a la oferta. */
  buyUrl?: string;
  /** Minutos del contador de urgencia. */
  countdownMinutes?: number;
}

function esc(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Formatea un precio entero con separador de miles + moneda (currency escapado). */
function fmtPrice(value: number, currency: string): string {
  return `${new Intl.NumberFormat('es-CO').format(Math.round(value))} ${esc(currency)}`;
}

export function buildLandingHtml(inputs: LandingInputs, images: LandingImageRef[], opts: LandingHtmlOptions = {}): string {
  const ordered = images.slice().sort((a, b) => a.slot - b.slot);
  const hero = ordered[0]?.url ?? '';
  // Seguro por defecto: solo esquemas inocuos en el href; cualquier otro (javascript:, data:…) cae al ancla.
  const rawBuy = opts.buyUrl?.trim() ?? '';
  const buyUrl = /^(https?:|mailto:|tel:|#|\/)/i.test(rawBuy) ? rawBuy : '#oferta';
  const minutes = Math.max(1, Math.round(opts.countdownMinutes ?? 15));
  const hasOffer = inputs.regularPrice > inputs.offerPrice;

  const title = esc(inputs.productName);
  const desc = esc((inputs.description || inputs.angle || inputs.productName).slice(0, 160));
  const offerPrice = fmtPrice(inputs.offerPrice, inputs.currency);
  const regularPrice = hasOffer ? fmtPrice(inputs.regularPrice, inputs.currency) : '';

  const bullets = (inputs.sectionsCopy ?? []).flatMap((s) => s.bullets).filter(Boolean).slice(0, 6);
  const benefitsList = bullets.length
    ? `<ul class="benefits">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
    : '';

  const imagesHtml = ordered
    .map((i) => `<img src="${esc(i.url)}" alt="${esc(getSlot(i.slot)?.title ?? i.type)}" loading="lazy">`)
    .join('\n      ');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: inputs.productName,
    image: ordered.map((i) => i.url),
    description: inputs.description || inputs.angle || inputs.productName,
    offers: {
      '@type': 'Offer',
      price: inputs.offerPrice,
      priceCurrency: inputs.currency,
      availability: 'https://schema.org/InStock',
    },
  }).replace(/</g, '\\u003c'); // evita que un "</script>" en el texto rompa el bloque JSON-LD (XSS)

  const ctaBlock = `
    <div class="cta" id="oferta">
      <div class="price">
        ${regularPrice ? `<span class="old">${regularPrice}</span>` : ''}
        <span class="now">${offerPrice}</span>
        ${inputs.offerType ? `<span class="tag">${esc(inputs.offerType)}</span>` : ''}
      </div>
      <a class="btn" href="${esc(buyUrl)}">Comprar ahora</a>
      <p class="trust">✅ Pago contra entrega · 🔒 Compra segura · 🚚 Envío a todo el país</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  ${hero ? `<meta property="og:image" content="${esc(hero)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff;line-height:1.5}
    .bar{position:sticky;top:0;z-index:30;background:#dc2626;color:#fff;text-align:center;padding:8px 12px;font-size:14px;font-weight:600}
    .wrap{max-width:720px;margin:0 auto;padding:0 0 96px}
    .wrap img{width:100%;height:auto;display:block;margin:0 auto}
    .cta{padding:24px 16px;text-align:center}
    .price{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:12px}
    .price .old{color:#888;text-decoration:line-through;font-size:18px}
    .price .now{color:#16a34a;font-size:30px;font-weight:800}
    .price .tag{background:#fde68a;color:#92400e;border-radius:6px;padding:2px 8px;font-size:13px;font-weight:700}
    .btn{display:inline-block;background:#16a34a;color:#fff;font-weight:800;font-size:18px;text-decoration:none;padding:16px 40px;border-radius:10px;box-shadow:0 6px 16px rgba(22,163,74,.35);animation:pulse 1.6s infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
    .trust{margin-top:12px;color:#555;font-size:13px}
    .benefits{max-width:560px;margin:8px auto 24px;padding:0 24px;text-align:left}
    .benefits li{margin:8px 0;list-style:none;padding-left:26px;position:relative}
    .benefits li:before{content:"✅";position:absolute;left:0}
    .sticky{position:fixed;bottom:0;left:0;right:0;z-index:40;background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -4px 12px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px}
    .sticky .now{color:#16a34a;font-weight:800;font-size:18px}
    .sticky a{background:#16a34a;color:#fff;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:8px;white-space:nowrap}
    .pop{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:20px}
    .pop.show{display:flex}
    .pop .card{background:#fff;border-radius:14px;max-width:380px;padding:28px 22px;text-align:center;position:relative}
    .pop .x{position:absolute;right:12px;top:8px;font-size:22px;color:#999;cursor:pointer;border:0;background:none}
    .pop h2{font-size:22px;margin-bottom:8px}
    .pop a{display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:10px}
  </style>
</head>
<body>
  <div class="bar">⏰ Oferta por tiempo limitado · termina en <span id="cd">${minutes}:00</span> · ¡Stock bajo!</div>
  <div class="wrap">
    <main>
      ${imagesHtml}
    </main>
    ${benefitsList}
    ${ctaBlock}
  </div>

  <div class="sticky">
    <span class="now">${offerPrice}</span>
    <a href="${esc(buyUrl)}">Comprar ahora</a>
  </div>

  <div class="pop" id="pop">
    <div class="card">
      <button class="x" aria-label="Cerrar" onclick="document.getElementById('pop').classList.remove('show')">&times;</button>
      <h2>¡Espera! 🎁</h2>
      <p>No pierdas la oferta de ${esc(inputs.productName)}. El stock se agota.</p>
      <a href="${esc(buyUrl)}">Sí, quiero la oferta</a>
    </div>
  </div>

  <script>
    // Contador de urgencia (persistente por sesión para que no reinicie al recargar).
    (function(){
      var total=${minutes}*60, key='cd_${esc(inputs.productName).replace(/[^a-z0-9]/gi, '').slice(0, 20)}';
      var start=parseInt(sessionStorage.getItem(key)||'0',10)||Date.now();
      sessionStorage.setItem(key,start);
      var el=document.getElementById('cd');
      function tick(){
        var left=total-Math.floor((Date.now()-start)/1000);
        if(left<0){left=0}
        var m=Math.floor(left/60), s=left%60;
        if(el){el.textContent=m+':' + (s<10?'0':'') + s}
      }
      tick(); setInterval(tick,1000);
    })();
    // Popup de salida (una vez por sesión).
    (function(){
      var shown=false;
      document.addEventListener('mouseout', function(e){
        if(shown) return;
        if(e.clientY<=0 && !sessionStorage.getItem('exitPop')){
          shown=true; sessionStorage.setItem('exitPop','1');
          document.getElementById('pop').classList.add('show');
        }
      });
    })();
  </script>
</body>
</html>`;
}
