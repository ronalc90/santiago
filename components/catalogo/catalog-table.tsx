'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, ExternalLink, Loader2, ImageIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatCop } from '@/lib/format';
import { dropiPanelSearchUrl } from '@/lib/integrations/dropi-panel';
import { DEFAULT_PAGE_SIZE } from '@/lib/config/constants';

interface Item {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  cost: number | null;
  stock: number | null;
  imageUrl: string | null;
}

export function CatalogTable() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCatalog, setTotalCatalog] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'name' | 'cost'>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = DEFAULT_PAGE_SIZE;

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    qs.set('sort', sort);
    qs.set('dir', dir);
    qs.set('page', String(page));
    const res = await fetch(`/api/catalog?${qs.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalCatalog(data.totalCatalog ?? 0);
    setCategories(data.categories ?? []);
    setLoading(false);
  }, [search, category, sort, dir, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, category, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(key: 'name' | 'cost') {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir(key === 'cost' ? 'asc' : 'asc');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="catalog-search" className="text-xs">Buscar</Label>
          <Input id="catalog-search" placeholder="Nombre del producto…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-category" className="text-xs">Categoría</Label>
          <select
            id="catalog-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-56"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {totalCatalog === 0
            ? 'Catálogo vacío: impórtalo en Ajustes → Descubrimiento.'
            : `${total} de ${totalCatalog} producto(s)`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>
                <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Ordenar por producto">
                  Producto <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => toggleSort('cost')} className="ml-auto inline-flex items-center gap-1 hover:text-foreground" aria-label="Ordenar por costo">
                  Costo <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {totalCatalog === 0 ? 'Aún no has importado el catálogo de Dropi.' : 'Sin productos con esos filtros.'}
              </TableCell></TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.name} className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-secondary text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {it.name}
                    {it.sku && <span className="block text-xs text-muted-foreground">{it.sku}</span>}
                  </TableCell>
                  <TableCell>{it.category ? <Badge variant="secondary">{it.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-medium">{it.cost != null ? formatCop(it.cost) : '—'}</TableCell>
                  <TableCell className="text-right">{it.stock ?? '—'}</TableCell>
                  <TableCell>
                    <a href={dropiPanelSearchUrl(it.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline" title="Abrir en tu panel de Dropi">
                      Dropi <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <span className="text-xs text-muted-foreground">Pág. {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}
