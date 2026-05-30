import { getScoringRules } from '@/lib/services/settings';
import { ScoringRulesForm } from '@/components/settings/scoring-rules-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const rules = await getScoringRules();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Reglas de clasificación del Winner Score. Al guardar, se reclasifican todos los anuncios.</p>
      </div>
      <ScoringRulesForm initial={rules} />
    </div>
  );
}
