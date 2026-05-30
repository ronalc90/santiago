import { computeCostReport } from '@/lib/services/costs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/** Formatea USD con suficientes decimales para costos unitarios diminutos. */
function usd(value: number): string {
  const decimals = value > 0 && value < 0.01 ? 5 : 2;
  return `US$ ${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
/** Formatea COP como pesos enteros. */
function cop(value: number): string {
  return `$ ${Math.round(value).toLocaleString('es-CO')} COP`;
}

export default async function CostosPage() {
  const report = await computeCostReport();
  const perAction = report.catalog.filter((c) => c.kind === 'per-action');
  const monthly = report.catalog.filter((c) => c.kind === 'monthly');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Costos</h1>
        <p className="text-sm text-muted-foreground">
          Costo peso a peso de cada cosa que hace el programa, y lo gastado hasta ahora (estimado).
          Tasa usada: 1 US$ = ${report.rate.toLocaleString('es-CO')} COP (configurable con USD_COP_RATE).
        </p>
      </div>

      {/* Gastado hasta ahora */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gastado hasta ahora (estimado)</CardTitle>
            <div className="text-right">
              <p className="text-lg font-bold">{cop(report.spentTotalCop)}</p>
              <p className="text-xs text-muted-foreground">{usd(report.spentTotalUsd)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Cómo se calcula</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">COP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.spent.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.detail}</TableCell>
                  <TableCell className="text-right">{usd(s.usd)}</TableCell>
                  <TableCell className="text-right font-medium">{cop(s.cop)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Estimación basada en conteos reales de la base de datos (anuncios, imágenes, landings), no en
            la facturación exacta de cada proveedor (no exponen API de facturación). La infraestructura
            mensual (abajo) no se incluye en este total porque es un fijo recurrente, no por acción.
          </p>
        </CardContent>
      </Card>

      {/* Costo por acción */}
      <Card>
        <CardHeader><CardTitle>Costo por acción (peso a peso)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">COP</TableHead>
                <TableHead>Por qué</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perAction.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell><Badge variant="outline">{c.unit}</Badge></TableCell>
                  <TableCell className="text-right">{usd(c.usd)}</TableCell>
                  <TableCell className="text-right font-medium">{cop(c.cop)}</TableCell>
                  <TableCell className="max-w-[360px] text-xs text-muted-foreground">{c.why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Infra mensual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Infraestructura mensual (fijo)</CardTitle>
            <div className="text-right">
              <p className="text-lg font-bold">{cop(report.monthlyCop)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
              <p className="text-xs text-muted-foreground">{usd(report.monthlyUsd)}/mes</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead className="text-right">USD/mes</TableHead>
                <TableHead className="text-right">COP/mes</TableHead>
                <TableHead>Por qué</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell className="text-right">{c.usd === 0 ? 'Gratis' : usd(c.usd)}</TableCell>
                  <TableCell className="text-right font-medium">{c.usd === 0 ? '—' : cop(c.cop)}</TableCell>
                  <TableCell className="max-w-[360px] text-xs text-muted-foreground">{c.why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
