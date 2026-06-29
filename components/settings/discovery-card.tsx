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

export function DiscoveryCard({ initial, dropiApiConfigured, shopifyConfigured }: { initial: DiscoveryConfigDTO; dropiApiConfigured: boolean; shopifyConfigured: boolean }) {
  const [sources, setSources] = useState(initial.sources);
  const [countries, setCountries] = useState(initial.countries.join(', '));
  const [keywords, setKeywords] = useState(initial.keywords.join('\n'));
  const [savingCfg, setSavingCfg] = useState(false);
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingShopify, setSyncingShopify] = useState(false);

  async function syncDropiApi() {
    setSyncing(true);
    const res = await fetch('/api/discovery/dropi-sync', { method: 'POST' });
    setSyncing(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: 'Catálogo Dropi sincronizado', description: `${d.upserted ?? 0} productos · ${d.matched ?? 0} candidatos emparejados` });
    else toast({ variant: 'destructive', title: 'No se pudo sincronizar', description: d.error });
  }

  async function syncFromShopify() {
    setSyncingShopify(true);
    const res = await fetch('/api/discovery/dropi-shopify-sync', { method: 'POST' });
    setSyncingShopify(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok && (d.received ?? 0) === 0) {
      toast({
        variant: 'destructive',
        title: 'Tu Shopify no tiene productos',
        description: 'El espejo no encontró productos en tu tienda. Importa tu catálogo de Dropi a Shopify (integración oficial Dropi→Shopify) y vuelve a intentar.',
      });
    } else if (res.ok) {
      toast({ title: 'Catálogo sincronizado desde Shopify', description: `${d.upserted ?? 0} productos · ${d.matched ?? 0} candidatos emparejados` });
    } else {
      toast({ variant: 'destructive', title: 'No se pudo sincronizar', description: d.error });
    }
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

  async function doImport(csvText: string) {
    if (!csvText.trim()) {
      toast({ variant: 'destructive', title: 'Archivo vacío', description: 'El CSV no tiene contenido.' });
      return;
    }
    setImporting(true);
    const res = await fetch('/api/discovery/dropi-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: csvText }) });
    setImporting(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast({ title: 'Catálogo Dropi importado', description: `${d.received ?? 0} filas · ${d.upserted ?? 0} productos · ${d.matched ?? 0} candidatos emparejados` });
    else toast({ variant: 'destructive', title: 'Error al importar', description: d.error });
  }

  function importCsv() {
    void doImport(csv);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    if (file.size > 8_000_000) {
      toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'Máximo ~8 MB. Si tu export es más grande, divídelo o avísame y lo subimos por partes.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void doImport(String(reader.result ?? ''));
    reader.onerror = () => toast({ variant: 'destructive', title: 'No se pudo leer el archivo' });
    reader.readAsText(file);
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
        <Button onClick={saveCfg} disabled={savingCfg} className="w-full sm:w-auto">
          {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar configuración
        </Button>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs">Catálogo Dropi</Label>
          <p className="text-xs text-muted-foreground">
            Dropi no permite consumir su API directamente (su soporte lo confirmó). El camino automático es vía Shopify: Dropi ya alimenta tu
            tienda, así que WinSpy lee esos productos y los cruza con los candidatos. Trae solo lo que ya importaste (lo que puedes vender).
          </p>
          <Button onClick={syncFromShopify} disabled={syncingShopify || !shopifyConfigured} title={shopifyConfigured ? 'Leer tus productos de Shopify (alimentados por Dropi)' : 'Conecta Shopify primero'} className="w-full sm:w-auto">
            {syncingShopify ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar catálogo desde Shopify
          </Button>
          {!shopifyConfigured && <p className="text-xs text-muted-foreground">Conecta Shopify (arriba en Costos) para habilitarlo.</p>}

          <p className="pt-2 text-xs text-muted-foreground">
            Catálogo por CSV: exporta tus productos/favoritos desde Dropi e impórtalos aquí; luego búscalos y fíltralos en «Catálogo Dropi» (menú).
            Cabecera tolerante: name/nombre, sku/codigo, category/categoria, cost/precio, stock, image/imagen.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={importing}
            className="block w-full text-xs file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-secondary/70"
          />
          {importing && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Importando…</p>}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">…o pegar el contenido</summary>
            <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="mt-2 min-h-[80px] font-mono text-xs" placeholder="name,sku,cost,stock&#10;Masajeador Cervical,SKU1,18000,50" />
            <Button variant="outline" className="mt-2 w-full sm:w-auto" onClick={importCsv} disabled={importing || !csv.trim()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar CSV pegado
            </Button>
          </details>
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
