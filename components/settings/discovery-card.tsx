'use client';
import { useState } from 'react';
import { Loader2, Save, Upload, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

export interface DiscoveryConfigDTO {
  sources: { trends: boolean; meta: boolean; tiktok: boolean; embeddings: boolean };
  countries: string[];
  keywords: string[];
}

type SourceKey = keyof DiscoveryConfigDTO['sources'];
const SWITCHES: { key: SourceKey; label: string; hint: string }[] = [
  { key: 'trends', label: 'Google Trends', hint: 'Gratis · interés por país (best-effort)' },
  { key: 'meta', label: 'Meta Ad Library (Apify)', hint: 'PAGO · trae creativos' },
  { key: 'tiktok', label: 'TikTok (Apify)', hint: 'PAGO · requiere actor configurado' },
  { key: 'embeddings', label: 'Dedupe por embeddings', hint: 'OpenAI · costo bajo, agrupa casi-idénticos' },
];

export function DiscoveryCard({ initial, dropiApiConfigured }: { initial: DiscoveryConfigDTO; dropiApiConfigured: boolean }) {
  const [sources, setSources] = useState(initial.sources);
  const [countries, setCountries] = useState(initial.countries.join(', '));
  const [keywords, setKeywords] = useState(initial.keywords.join('\n'));
  const [savingCfg, setSavingCfg] = useState(false);
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function syncDropiApi() {
    setSyncing(true);
    const res = await fetch('/api/discovery/dropi-sync', { method: 'POST' });
    setSyncing(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: 'Catálogo Dropi sincronizado', description: `${d.upserted ?? 0} productos · ${d.matched ?? 0} candidatos emparejados` });
    else toast({ variant: 'destructive', title: 'No se pudo sincronizar', description: d.error });
  }

  async function saveCfg() {
    setSavingCfg(true);
    const res = await fetch('/api/discovery/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources,
        countries: countries.split(',').map((s) => s.trim()).filter(Boolean),
        keywords: keywords.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSavingCfg(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: 'Configuración guardada', description: 'Aplica en la próxima búsqueda.' });
    else toast({ variant: 'destructive', title: 'Error al guardar', description: d.error });
  }

  async function importCsv() {
    if (!csv.trim()) return;
    setImporting(true);
    const res = await fetch('/api/discovery/dropi-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
    setImporting(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: 'Catálogo Dropi importado', description: `${d.upserted ?? 0} ítems · ${d.matched ?? 0} candidatos emparejados` });
    else toast({ variant: 'destructive', title: 'Error al importar', description: d.error });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Descubrimiento de productos</CardTitle>
        <p className="text-sm text-muted-foreground">Fuentes, países y nichos para llenar «Oportunidades». MercadoLibre va gratis siempre; las de PAGO van apagadas.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {SWITCHES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <div>
                <Label className="text-sm">{s.label}</Label>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </div>
              <Switch checked={sources[s.key]} onCheckedChange={(v) => setSources((p) => ({ ...p, [s.key]: v }))} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Países / sitios ML (CSV)</Label>
          <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="MCO, MLM, MLA" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Keywords / nichos (uno por línea)</Label>
          <Textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} className="min-h-[100px]" placeholder="masajeador cervical&#10;lampara de luna" />
        </div>
        <Button onClick={saveCfg} disabled={savingCfg}>
          {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar configuración
        </Button>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs">Catálogo Dropi</Label>
          <p className="text-xs text-muted-foreground">
            Dropi no permite consumir su API directamente para integraciones propias (su soporte lo confirmó). El camino soportado es
            exportar tu catálogo/favoritos a CSV desde el panel de Dropi e importarlo aquí: se cruza por nombre con los candidatos.
          </p>
          <p className="text-xs text-muted-foreground">Cabecera del CSV: name, sku, category, cost, stock, image.</p>
          <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-[80px] font-mono text-xs" placeholder="name,sku,cost,stock&#10;Masajeador Cervical,SKU1,18000,50" />
          <Button variant="outline" onClick={importCsv} disabled={importing || !csv.trim()}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar catálogo Dropi (CSV)
          </Button>
          {dropiApiConfigured && (
            <Button variant="ghost" size="sm" onClick={syncDropiApi} disabled={syncing} title="Solo funciona si Dropi habilitó tu integración para consumir su API">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Probar sync por API (solo si Dropi habilitó tu integración)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
