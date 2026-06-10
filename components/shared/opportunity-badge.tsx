import { Badge } from '@/components/ui/badge';
import { BAND_META, OpportunityBandName } from '@/lib/services/opportunity-rules';

const VARIANT: Record<string, 'green' | 'secondary' | 'yellow' | 'destructive' | 'gray'> = {
  EXCELENTE: 'green',
  MUY_BUENO: 'green',
  BUENO: 'secondary',
  RIESGOSO: 'yellow',
  RECHAZAR: 'destructive',
  SIN_DATOS: 'gray',
};

/** Badge de la banda de oportunidad (Excelente/Muy bueno/…/Sin datos). */
export function OpportunityBadge({ band }: { band: string | null | undefined }) {
  const key = (band ?? 'SIN_DATOS') as OpportunityBandName;
  const meta = BAND_META[key] ?? BAND_META.SIN_DATOS;
  return <Badge variant={VARIANT[key] ?? 'gray'} className="whitespace-nowrap">{meta.label}</Badge>;
}
