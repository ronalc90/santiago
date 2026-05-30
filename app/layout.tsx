import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WinSpy — Plataforma interna',
  description: 'Spy de anuncios, generador de landings con IA y dashboard de producto.',
};

// El <Toaster/> (Radix, usa createContext) vive en el layout autenticado (app),
// que es dinámico. Mantenerlo fuera del root evita el fallo de prerender en las
// páginas estáticas (/login, /_not-found, /404, /500) durante `next build`.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
