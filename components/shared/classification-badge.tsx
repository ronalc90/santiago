import { Badge } from '@/components/ui/badge';

const META: Record<string, { emoji: string; label: string; variant: 'red' | 'yellow' | 'green' | 'gray' }> = {
  LANZAR: { emoji: '🔴', label: 'LANZAR', variant: 'red' },
  CONSIDERAR: { emoji: '🟡', label: 'CONSIDERAR', variant: 'yellow' },
  MONITOREAR: { emoji: '🟢', label: 'MONITOREAR', variant: 'green' },
  SATURADO: { emoji: '⚪', label: 'SATURADO', variant: 'gray' },
};

export function ClassificationBadge({ value }: { value: string }) {
  const m = META[value] ?? META.MONITOREAR;
  return <Badge variant={m.variant}>{m.emoji} {m.label}</Badge>;
}
