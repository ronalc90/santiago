import { getScoringRules, getOpportunityRules } from '@/lib/services/settings';
import { getAllPrompts, PROMPT_DEFS } from '@/lib/services/prompts';
import { ScoringRulesForm } from '@/components/settings/scoring-rules-form';
import { OpportunityRulesForm } from '@/components/settings/opportunity-rules-form';
import { PromptsForm } from '@/components/settings/prompts-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [rules, opportunityRules, promptValues] = await Promise.all([
    getScoringRules(),
    getOpportunityRules(),
    getAllPrompts(),
  ]);
  const prompts = PROMPT_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    description: d.description,
    default: d.default,
    value: promptValues[d.key],
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Reglas del Winner Score y prompts de IA. Al guardar las reglas, se reclasifican todos los anuncios.</p>
      </div>
      <ScoringRulesForm initial={rules} />
      <OpportunityRulesForm initial={opportunityRules} />
      <PromptsForm initial={prompts} />
    </div>
  );
}
