import { getScoringRules, getOpportunityRules } from '@/lib/services/settings';
import { getAllPrompts, PROMPT_DEFS } from '@/lib/services/prompts';
import { getCostSyncStatus } from '@/lib/services/cost-sync';
import { isShopifyConfigured } from '@/lib/shopify/client';
import { ScoringRulesForm } from '@/components/settings/scoring-rules-form';
import { OpportunityRulesForm } from '@/components/settings/opportunity-rules-form';
import { PromptsForm } from '@/components/settings/prompts-form';
import { CostSyncCard } from '@/components/settings/cost-sync-card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [rules, opportunityRules, promptValues, costStatus] = await Promise.all([
    getScoringRules(),
    getOpportunityRules(),
    getAllPrompts(),
    getCostSyncStatus(),
  ]);
  const shopifyConfigured = isShopifyConfigured();
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
      <CostSyncCard status={costStatus} shopifyConfigured={shopifyConfigured} />
      <PromptsForm initial={prompts} />
    </div>
  );
}
