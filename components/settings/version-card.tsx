import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHANGELOG, APP_VERSION } from '@/lib/changelog';
import { COMMITS } from '@/lib/commits.generated';

type BadgeVariant = 'green' | 'yellow' | 'gray' | 'secondary';

/** Tipo de commit convencional → etiqueta y color. */
function commitTag(subject: string): { type: string; variant: BadgeVariant } {
  const m = subject.match(/^(\w+)(?:\([^)]*\))?!?:/);
  const type = m ? m[1].toLowerCase() : 'otro';
  const variant: BadgeVariant =
    type === 'feat' ? 'green' : type === 'fix' ? 'yellow' : type === 'docs' ? 'secondary' : 'gray';
  return { type, variant };
}

/** Apartado de Ajustes: versión actual, cambios por versión y el historial completo de commits. */
export function VersionCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Versión y cambios</CardTitle>
          <Badge variant="green">v{APP_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">En qué versión vamos, qué se hizo en cada una y el historial completo de commits.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Versiones (resumen curado) */}
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

        {/* Historial completo de commits */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial de commits ({COMMITS.length})</h3>
          <div className="max-h-96 overflow-y-auto rounded-md border">
            <ul className="divide-y text-sm">
              {COMMITS.map((c) => {
                const tag = commitTag(c.subject);
                return (
                  <li key={c.hash} className="flex items-start gap-2 px-3 py-2">
                    <Badge variant={tag.variant} className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px] uppercase">
                      {tag.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-foreground">{c.subject}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {c.hash} · {c.date}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
