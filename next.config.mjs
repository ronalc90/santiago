/** @type {import('next').NextConfig} */

// Content-Security-Policy razonable para la app:
// - default 'self'.
// - img/media admiten data:, blob: y https: porque los creativos vienen de R2
//   (*.r2.dev) y se incrustan imágenes/videos de orígenes variados.
// - 'unsafe-inline' en style-src es necesario para los estilos en línea de Next.
// - 'unsafe-inline' en script-src lo exige el runtime de Next (App Router) en
//   producción; no usamos 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
].join('; ');

const securityHeaders = [
  // Fuerza HTTPS durante 2 años (con subdominios y preload).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La app no usa cámara, micrófono ni geolocalización: los bloqueamos por completo.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  reactStrictMode: true,
  // sharp/bullmq/ioredis/archiver son paquetes de servidor: no empaquetarlos en el bundle.
  // En Next 14 la clave vive bajo `experimental` (en Next 15 pasó a `serverExternalPackages`).
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'bullmq', 'ioredis', 'archiver'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    return [
      {
        // Aplica las cabeceras de seguridad a todas las rutas.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
export default nextConfig;
