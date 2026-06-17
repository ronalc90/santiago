'use client';
import { useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

export interface SlotPromptDTO {
  slot: number;
  type: string;
  title: string;
  intent: string;
  default: string;
}

/** Edita la instrucción de cada una de las 9 imágenes de la landing, por separado. */
export function LandingPromptsForm({ slots }: { slots: SlotPromptDTO[] }) {
  const [vals, setVals] = useState<Record<number, string>>(Object.fromEntries(slots.map((s) => [s.slot, s.intent])));
  const [saving, setSaving] = useState(false);
  const defaults = Object.fromEntries(slots.map((s) => [s.slot, s.default])) as Record<number, string>;

  async function save() {
    setSaving(true);
    const res = await fetch('/api/settings/landing-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intents: vals }),
    });
    setSaving(false);
    if (res.ok) toast({ title: 'Prompts por imagen guardados', description: 'Aplican en la próxima generación/regeneración.' });
    else toast({ variant: 'destructive', title: 'Error al guardar' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompts por imagen (las 9)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Edita la instrucción de cada una de las 9 imágenes de la landing por separado. El texto visible de las imágenes siempre sale en español; este prompt define QUÉ debe mostrar cada una.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {slots.map((s) => (
          <div key={s.slot} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Imagen {s.slot} — {s.title}</Label>
              {vals[s.slot] !== defaults[s.slot] && (
                <button
                  type="button"
                  onClick={() => setVals((v) => ({ ...v, [s.slot]: defaults[s.slot] }))}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> restablecer
                </button>
              )}
            </div>
            <Textarea
              value={vals[s.slot]}
              onChange={(e) => setVals((v) => ({ ...v, [s.slot]: e.target.value }))}
              className="min-h-[64px] text-xs"
            />
          </div>
        ))}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar prompts por imagen
        </Button>
      </CardContent>
    </Card>
  );
}
