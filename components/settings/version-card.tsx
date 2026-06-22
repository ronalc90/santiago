import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHANGELOG, APP_VERSION } from '@/lib/changelog';

/** Apartado de Ajustes: versión actual + registro de qué se hizo en cada una. */
export function VersionCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Versión y cambios</CardTitle>
          <Badge variant="green">v{APP_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">En qué versión vamos y qué se hizo en cada una.</p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {CHANGELOG.map((entry, i) => (
            <li key={entry.version} className="border-l-2 border-muted pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">v{entry.version}</span>
                {i === 0 && (
                  <Badge variant="green" className="px-1.5 py-0 text-[10px]">
                    actual
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {entry.title} · {entry.date}
                </span>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {entry.changes.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
