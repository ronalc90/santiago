'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ExternalLink, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClassificationBadge } from '@/components/shared/classification-badge';
import { normalizeAdLibraryUrl } from '@/lib/ad-library';

interface Ad {
  id: string;
  adId: string;
  storeName: string;
  country: string;
  adLibraryUrl: string;
  copyText: string | null;
  daysActive: number;
  estimatedSpend: number;
  winnerScore: number;
  classification: string;
  isNew: boolean;
  sellsInColombia: boolean;
  hasUnusedForeignCreative: boolean;
}

type SortKey = 'winnerScore' | 'daysActive' | 'estimatedSpend';

export function SpyTable() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('');
  const [view, setView] = useState<'all' | 'new'>('all');
  const [minDays, setMinDays] = useState<string>('');
  const [onlyUnusedForeign, setOnlyUnusedForeign] = useState(false);
  const [notInColombia, setNotInColombia] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('winnerScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (classification) qs.set('classification', classification);
    if (view === 'new') qs.set('onlyNew', 'true');
    if (minDays) qs.set('minDaysActive', minDays);
    if (onlyUnusedForeign) qs.set('hasUnusedForeignCreative', 'true');
    if (notInColombia) qs.set('sellsInColombia', 'false');
    qs.set('sortBy', sortBy);
    qs.set('sortDir', sortDir);
    qs.set('page', String(page));
    const res = await fetch(`/api/ads?${qs.toString()}`);
    const data = await res.json();
    setAds(data.ads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [search, classification, view, minDays, onlyUnusedForeign, notInColombia, sortBy, sortDir, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Al cambiar cualquier filtro u orden, vuelve a la página 1.
  useEffect(() => {
    setPage(1);
  }, [search, classification, view, minDays, onlyUnusedForeign, notInColombia, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  }

  const CLASSES = ['', 'LANZAR', 'CONSIDERAR', 'MONITOREAR', 'SATURADO'];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Tienda o copy…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Clasificación</Label>
          <div className="flex flex-wrap gap-1">
            {CLASSES.map((c) => (
              <Button key={c} variant={classification === c ? 'default' : 'outline'} size="sm" onClick={() => setClassification(c)}>
                {c === '' ? 'Todas' : c}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">+ Días activos</Label>
          <Input type="number" min={0} placeholder="ej: 5" value={minDays} onChange={(e) => setMinDays(e.target.value)} className="w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="unused" checked={onlyUnusedForeign} onCheckedChange={setOnlyUnusedForeign} />
          <Label htmlFor="unused" className="text-xs">Creativo extranjero sin usar en CO</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="notco" checked={notInColombia} onCheckedChange={setNotInColombia} />
          <Label htmlFor="notco" className="text-xs">No se vende en CO</Label>
        </div>
        <div className="flex rounded-md border p-0.5 sm:ml-auto">
          <Button variant={view === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('all')}>Históricos</Button>
          <Button variant={view === 'new' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('new')}>Solo nuevos</Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-card">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Tienda</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Copy</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('daysActive')}>
                <span className="inline-flex items-center gap-1">Días <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('estimatedSpend')} title="Gasto o impresiones estimados cuando Meta los publica. Para anuncios comerciales en CO casi siempre no hay dato público (—).">
                <span className="inline-flex items-center gap-1">Gasto/Impr. (est.) <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('winnerScore')} title="Señal de anuncio ganador. Cuando Meta no publica el gasto (anuncios comerciales en CO), es un proxy de longevidad/alcance, no de inversión: sube con los días hasta cierto punto y luego baja (un anuncio demasiado viejo está saturado).">
                <span className="inline-flex items-center gap-1">Winner Score <ArrowUpDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Señales</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            ) : ads.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Aún no hay anuncios reales. Pulsa &quot;Sincronizar reales&quot; arriba para traerlos del Meta Ad Library, o importa un export.</TableCell></TableRow>
            ) : (
              ads.map((ad) => {
                const normalizedUrl = normalizeAdLibraryUrl(ad.adLibraryUrl, { query: ad.storeName, country: ad.country });
                const isDemo = !normalizedUrl.includes('id=');
                return (
                <TableRow key={ad.id}>
                  <TableCell className="font-medium">
                    {ad.storeName}
                    {ad.isNew && <Badge variant="secondary" className="ml-2">nuevo</Badge>}
                    {isDemo && <Badge variant="gray" className="ml-2" title="Anuncio de demostración: el enlace abre una búsqueda, no un anuncio real">demo</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{ad.country}</Badge></TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground" title={ad.copyText ?? ''}>{ad.copyText}</TableCell>
                  <TableCell>{ad.daysActive}</TableCell>
                  <TableCell>{ad.estimatedSpend > 0 ? `$${ad.estimatedSpend.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="font-semibold">{ad.winnerScore.toLocaleString()}</TableCell>
                  <TableCell><ClassificationBadge value={ad.classification} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {ad.sellsInColombia ? <Badge variant="green">CO</Badge> : <Badge variant="gray">no CO</Badge>}
                      {ad.hasUnusedForeignCreative && <Badge variant="yellow">ángulo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <a href={normalizedUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" title={isDemo ? 'Búsqueda en Ad Library (anuncio de demostración)' : 'Ver en Ad Library'}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Link href={`/spy/${ad.id}`} className="text-sky-400 hover:underline text-xs">Detalle</Link>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {total} anuncio(s){total > PAGE_SIZE ? ` · mostrando ${ads.length} (pág. ${page}/${totalPages})` : ''} · Winner Score: señal de anuncio ganador. Sin gasto público (anuncios comerciales en CO) es un proxy de longevidad/alcance, no de inversión: sube con los días hasta cierto punto y luego baja (demasiado tiempo corriendo = saturado).
        </p>
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Pág. {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
