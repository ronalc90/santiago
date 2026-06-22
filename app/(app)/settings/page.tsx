import { getScoringRules, getOpportunityRules } from '@/lib/services/settings';
import { getAllPrompts, PROMPT_DEFS } from '@/lib/services/prompts';
import { getSlotPromptsForUI } from '@/lib/services/landing-slot-prompts';
import { getCostSyncStatus } from '@/lib/services/cost-sync';
import { getMeliConnection, getMeliSaturationStatus } from '@/lib/services/meli';
import { getDiscoveryConfig } from '@/lib/services/discovery-config';
import { isShopifyConfigured } from '@/lib/shopify/client';
import { isMeliConfigured } from '@/lib/integrations/mercadolibre';
import { ScoringRulesForm } from '@/components/settings/scoring-rules-form';
import { OpportunityRulesForm } from '@/components/settings/opportunity-rules-form';
import { PromptsForm } from '@/components/settings/prompts-form';
import { CostSyncCard } from '@/components/settings/cost-sync-card';
import { MeliCard } from '@/components/settings/meli-card';
import { DiscoveryCard } from '@/components/settings/discovery-card';
import { LandingPromptsForm } from '@/components/settings/landing-prompts-form';
import { VersionCard } from '@/components/settings/version-card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: { meli?: string } }) {
  const [rules, opportunityRules, promptValues, costStatus, meliConnection, meliStatus, discoveryConfig, slotPrompts] = await Promise.all([
    getScoringRules(),
    getOpportunityRules(),
    getAllPrompts(),
    getCostSyncStatus(),
    getMeliConnection(),
    getMeliSaturationStatus(),
    getDiscoveryConfig(),
    getSlotPromptsForUI(),
  ]);
  const shopifyConfigured = isShopifyConfigured();
  const meliConfigured = isMeliConfigured();
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
      <MeliCard configured={meliConfigured} connection={meliConnection} status={meliStatus} notice={searchParams.meli} />
      <DiscoveryCard initial={discoveryConfig} />
      <PromptsForm initial={prompts} />
      <LandingPromptsForm slots={slotPrompts} />
      <VersionCard />
    </div>
  );
}
