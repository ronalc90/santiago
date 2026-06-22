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
// Aplica el tema guardado ANTES de pintar (evita parpadeo). Modos: light (sin
// clase), dark, reading. Default: oscuro. La BD es la fuente de verdad y se
// sincroniza al montar (ThemeSync); localStorage es solo caché anti-parpadeo.
const themeScript = `(function(){try{var t=localStorage.getItem('winspy-theme');var e=document.documentElement;e.classList.remove('dark','reading');if(t==='light'){}else if(t==='reading'){e.classList.add('reading');}else{e.classList.add('dark');}}catch(err){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
