import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import type { Theme } from '@/lib/theme';

/** Apartado de Ajustes para elegir el tema (se guarda por usuario en la BD). */
export function AppearanceCard({ theme }: { theme: Theme }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tema de la interfaz: claro, oscuro o lectura (papel sepia, alto contraste). Tu preferencia se guarda en tu cuenta y se aplica en cualquier dispositivo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-w-sm">
          <ThemeSwitcher initial={theme} />
        </div>
      </CardContent>
    </Card>
  );
}
