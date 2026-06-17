import {
  LayoutDashboard, Telescope, Trophy, Package, ImageIcon, Store, Settings, DollarSign, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

interface ModuleDoc {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  para: string; // para qué sirve
  hace: string[]; // qué hace / cómo usarlo
}

const MODULES: ModuleDoc[] = [
  {
    icon: LayoutDashboard, title: 'Dashboard',
    para: 'Ver de un vistazo cómo va el negocio.',
    hace: [
      'Resume anuncios detectados, productos en análisis/lanzados, landings y tiendas.',
      'Muestra el pipeline (Detectado → Validado → Landing → Lanzado → Escalando) y el Top por Winner Score.',
    ],
  },
  {
    icon: Telescope, title: 'Spy de anuncios',
    para: 'Encontrar anuncios que ya están funcionando (productos con tracción).',
    hace: [
      'Trae anuncios reales del Ad Library de Meta con «Buscar anuncios» (eliges país, término y cuántos) o «Importar resultados».',
      'Ordena por Winner Score (señal de ganador) con semáforo de clasificación.',
      'Filtros: días activos, “no se vende en CO”, “creativo extranjero sin usar”, etc. Desde el detalle creas un producto.',
    ],
  },
  {
    icon: Trophy, title: 'Oportunidades',
    para: 'Descubrir productos candidatos de varias fuentes, sin partir de un anuncio.',
    hace: [
      'Pulsa «Buscar ahora» (corre en segundo plano con indicador de progreso) o espera al descubrimiento diario.',
      'Fuentes: MercadoLibre (gratis), Google Trends (gratis), Meta/TikTok vía Apify (pago, opcional). Trae foto de cada candidato.',
      'Cada candidato trae países, fuente, saturación CO, estado Dropi y score 4×25. Desde el detalle: galería + «Crear producto».',
    ],
  },
  {
    icon: Package, title: 'Productos',
    para: 'Gestionar cada producto desde que lo detectas hasta que lo vendes.',
    hace: [
      'Lista con score de oportunidad, etapa del pipeline, disponibilidad Dropi y botón «Ver landing».',
      'En el detalle: precio/costo (margen), keyword de saturación, notas, anuncios ligados y crear/ver landings.',
    ],
  },
  {
    icon: ImageIcon, title: 'Landings',
    para: 'Crear la página de ventas con IA (9 imágenes + copy en español).',
    hace: [
      'Asistente de 3 pasos: datos (o autocompletar con IA), estilo (foto del producto + referencia) y generar.',
      'Genera las 9 secciones (hero, precio, antes/después, modo de uso, beneficios, ficha, garantía, urgencia, testimonios).',
      'Descargas el .zip o regeneras una sola imagen. Cada imagen tiene su prompt editable en Ajustes.',
    ],
  },
  {
    icon: Store, title: 'Tiendas',
    para: 'Vigilar competidores.',
    hace: ['Agregas/quitas tiendas (nombre, país, URL del Ad Library) para seguirles la pista.'],
  },
  {
    icon: DollarSign, title: 'Costos',
    para: 'Saber cuánto cuesta operar (sin sorpresas).',
    hace: ['Muestra el costo de cada acción (traer anuncios, generar imágenes/copy) en pesos y dólares, y el acumulado.'],
  },
  {
    icon: Settings, title: 'Ajustes',
    para: 'Afinar las reglas y conectar integraciones.',
    hace: [
      'Reglas del Winner Score y pesos del Motor de Oportunidad 4×25 (Demanda · Competencia · Margen · Creativos).',
      'Conectar MercadoLibre (saturación), sincronizar costos de Shopify, configurar el Descubrimiento (fuentes/países/keywords + CSV de Dropi).',
      'Prompts de IA editables, incluido uno por cada una de las 9 imágenes de la landing.',
    ],
  },
];

export default function AyudaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ayuda — cómo funciona WinSpy</h1>
        <p className="text-sm text-muted-foreground">Qué hace cada módulo y para qué sirve. La guía completa con capturas está en el repositorio (GUIA-SANTIAGO.md).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-sky-400" /> El flujo en una línea</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <b className="text-foreground">Descubrir</b> (Oportunidades / Spy) → <b className="text-foreground">Validar</b> (score 4×25:
          demanda, competencia, margen, creativos) → <b className="text-foreground">Crear producto</b> → <b className="text-foreground">Landing</b> (9 imágenes IA) →
          <b className="text-foreground"> Publicar en Shopify</b> → conectar el producto en <b className="text-foreground">Dropi</b> → vender.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-sky-400" /> {m.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{m.para}</p>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {m.hace.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Apariencia</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cambia entre <b className="text-foreground">modo claro</b> y <b className="text-foreground">oscuro</b> con el botón al final del menú (abajo a la izquierda). Tu preferencia se recuerda en este navegador.
        </CardContent>
      </Card>
    </div>
  );
}
