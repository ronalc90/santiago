/** @type {import('next').NextConfig} */
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
};
export default nextConfig;
