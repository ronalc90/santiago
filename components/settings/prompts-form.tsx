'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

interface PromptItem {
  key: string;
  label: string;
  description: string;
  default: string;
  value: string;
}

export function PromptsForm({ initial }: { initial: PromptItem[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((p) => [p.key, p.value])),
  );
  const [saving, setSaving] = useState(false);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }
  function reset(p: PromptItem) {
    set(p.key, p.default);
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/settings/prompts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: values }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: 'Prompts guardados', description: 'Se usarán en las próximas generaciones de IA.' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'Error', description: data.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompts de IA</CardTitle>
        <p className="text-sm text-muted-foreground">
          Personaliza las instrucciones que recibe la IA. Vacío o «Restablecer» vuelve al valor por defecto.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {initial.map((p) => {
          const changed = (values[p.key] ?? '').trim() !== p.default.trim();
          return (
            <div key={p.key} id={`prompt-${p.key}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">{p.label}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reset(p)}
                  disabled={!changed}
                  title="Restablecer al valor por defecto"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restablecer
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <Textarea
                value={values[p.key] ?? ''}
                onChange={(e) => set(p.key, e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>
          );
        })}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar prompts
        </Button>
      </CardContent>
    </Card>
  );
}
