'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import type { LandingSectionCopy } from '@/lib/services/landing-spec';

interface ProductOpt { id: string; name: string; market: string; currency: string; }

export function LandingWizard({ products, defaultProductId }: { products: ProductOpt[]; defaultProductId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const initialProduct = products.find((p) => p.id === defaultProductId) ?? products[0];
  const [productId, setProductId] = useState(initialProduct?.id ?? '');
  const [form, setForm] = useState({
    productName: initialProduct?.name ?? '',
    offerPrice: '',
    regularPrice: '',
    country: initialProduct?.market ?? 'CO',
    currency: initialProduct?.currency ?? 'COP',
    audience: '',
    description: '',
    offerType: '2x1',
    angle: '',
  });
  const [productPhoto, setProductPhoto] = useState<File | null>(null);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [compliance, setCompliance] = useState(false);
  const [sections, setSections] = useState<LandingSectionCopy[]>([]);
  const [autofilling, setAutofilling] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function autofillWithAI() {
    if (!form.productName) {
      toast({ variant: 'destructive', title: 'Falta el nombre', description: 'Indica el nombre del producto antes de autocompletar.' });
      return;
    }
    setAutofilling(true);
    try {
      const res = await fetch('/api/ai/landing-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {
            productName: form.productName,
            country: form.country,
            audience: form.audience || undefined,
            description: form.description || undefined,
            angle: form.angle || undefined,
            offerType: form.offerType || undefined,
          },
          complianceTiktok: compliance,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ variant: 'destructive', title: 'Error', description: data.error }); return; }
      const c = data.copy;
      setForm((f) => ({
        ...f,
        audience: c.audience || f.audience,
        description: c.description || f.description,
        angle: c.angle || f.angle,
      }));
      setSections(Array.isArray(c.sections) ? c.sections : []);
      toast({ title: 'Copy generado', description: `Público, descripción, ángulo y ${c.sections?.length ?? 0} secciones rellenadas.` });
    } finally {
      setAutofilling(false);
    }
  }

  function onPickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setForm((f) => ({ ...f, productName: p.name, country: p.market, currency: p.currency }));
  }

  const step1Valid = productId && form.productName && form.audience && form.description && form.angle;

  async function submit() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('productId', productId);
      fd.set('name', `Landing — ${form.productName}`);
      Object.entries(form).forEach(([k, v]) => fd.set(k, v));
      fd.set('complianceTiktok', String(compliance));
      if (sections.length) fd.set('sectionsCopy', JSON.stringify(sections));
      if (productPhoto) fd.set('productPhoto', productPhoto);
      if (referenceImage) fd.set('referenceImage', referenceImage);

      const res = await fetch('/api/landings', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast({ variant: 'destructive', title: 'Error', description: data.error }); return; }
      toast({ title: 'Landing en cola', description: 'Generando las 9 imágenes…' });
      router.push(`/landings/${data.project.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Primero crea un producto (desde el Spy) para asociarle una landing.</CardContent></Card>;
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Paso {step} de 3 — {step === 1 ? 'Datos del producto' : step === 2 ? 'Estilo e imágenes' : 'Revisar y generar'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <Select value={productId} onValueChange={onPickProduct}>
                <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={autofillWithAI} disabled={autofilling || !form.productName}>
              {autofilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Autocompletar con IA
            </Button>
            {sections.length > 0 && (
              <p className="text-xs text-muted-foreground">✓ {sections.length} secciones de copy generadas; se usarán en los prompts de imagen.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre del producto"><Input value={form.productName} onChange={(e) => set('productName', e.target.value)} /></Field>
              <Field label="Tipo de oferta"><Input value={form.offerType} onChange={(e) => set('offerType', e.target.value)} placeholder="2x1, 50% OFF…" /></Field>
              <Field label="Precio oferta"><Input type="number" value={form.offerPrice} onChange={(e) => set('offerPrice', e.target.value)} /></Field>
              <Field label="Precio regular"><Input type="number" value={form.regularPrice} onChange={(e) => set('regularPrice', e.target.value)} /></Field>
              <Field label="País"><Input value={form.country} onChange={(e) => set('country', e.target.value.toUpperCase())} maxLength={4} /></Field>
              <Field label="Moneda"><Input value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={4} /></Field>
            </div>
            <Field label="Público objetivo"><Input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="Ej: adultos 30-55 con dolor de cuello" /></Field>
            <Field label="Ángulo de venta"><Input value={form.angle} onChange={(e) => set('angle', e.target.value)} placeholder="Ej: alivio rápido sin fisioterapeuta" /></Field>
            <Field label="Descripción"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Foto del producto (opcional)">
              <input type="file" accept="image/*" onChange={(e) => setProductPhoto(e.target.files?.[0] ?? null)} className="w-full max-w-full text-sm" />
              {productPhoto && <p className="mt-1 truncate text-xs text-muted-foreground">{productPhoto.name}</p>}
            </Field>
            <Field label="Imagen de referencia de estilo (opcional)">
              <input type="file" accept="image/*" onChange={(e) => setReferenceImage(e.target.files?.[0] ?? null)} className="w-full max-w-full text-sm" />
              {referenceImage && <p className="mt-1 truncate text-xs text-muted-foreground">{referenceImage.name}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Analizaremos su estilo (paleta, tipografía, atmósfera…) para mantener coherencia visual.</p>
            </Field>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <Label>Compliance TikTok</Label>
                <p className="text-xs text-muted-foreground">Sin afirmaciones médicas, sin pérdida de peso, sin absolutos.</p>
              </div>
              <Switch checked={compliance} onCheckedChange={setCompliance} />
            </div>
          </>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <Summary label="Producto" value={form.productName} />
            <Summary label="Oferta" value={`${form.offerType} · ${form.offerPrice || '—'} ${form.currency} (antes ${form.regularPrice || '—'})`} />
            <Summary label="País / público" value={`${form.country} · ${form.audience}`} />
            <Summary label="Ángulo" value={form.angle} />
            <Summary label="Foto producto" value={productPhoto?.name ?? 'no'} />
            <Summary label="Referencia" value={referenceImage?.name ?? 'no'} />
            <Summary label="Compliance TikTok" value={compliance ? 'sí' : 'no'} />
            <Summary label="Copy IA" value={sections.length ? `${sections.length} secciones` : 'no'} />
            <p className="pt-2 text-muted-foreground">Se generarán 9 imágenes (hero, precio, antes/después, modo de uso, beneficios, ficha, garantía, urgencia, testimonios).</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}><ArrowLeft className="h-4 w-4" /> Atrás</Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !step1Valid}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generar 9 imágenes</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b py-1.5"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
