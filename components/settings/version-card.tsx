import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RELEASES, APP_VERSION } from '@/lib/changelog';

/** Apartado de Ajustes: versión actual y el historial completo, una versión por
 *  cambio, con explicación clara y su fecha. */
export function VersionCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Versión y cambios</CardTitle>
          <Badge variant="green">v{APP_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cada cambio del proyecto es una versión, con su fecha y una explicación clara. La actual es la {APP_VERSION}.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
          {RELEASES.map((r, i) => (
            <li key={r.hash} className="border-l-2 border-muted pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={i === 0 ? 'green' : 'secondary'} className="px-1.5 py-0 text-[11px] font-semibold">
                  v{r.version}
                </Badge>
                {i === 0 && (
                  <Badge variant="green" className="px-1.5 py-0 text-[10px]">
                    actual
                  </Badge>
                )}
                <span className="text-sm font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">· {r.date}</span>
              </div>
              {r.detail && <p className="mt-0.5 text-sm text-muted-foreground">{r.detail}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
