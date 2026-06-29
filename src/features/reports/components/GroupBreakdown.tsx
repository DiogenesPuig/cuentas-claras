import { formatAmount } from '@/features/transactions/format';
import type { DimensionGroup } from '../aggregate';
import { chartColor } from './chartColors';

interface GroupBreakdownProps {
  groups: DimensionGroup[];
  baseCurrency: string;
  /** Qué métrica consolidada lista cada grupo (MEJ-5: ingresos vs gastos). */
  metric?: 'expense' | 'income';
}

/**
 * Info del gráfico: cada grupo con su color (igual que el donut), monto y % del total mostrado.
 * El total es el de los grupos que recibe, así sirve tanto para el grupo entero como para el
 * subconjunto de un filtro (ej. el % por categoría de una persona). Mismo orden que el donut.
 */
export function GroupBreakdown({ groups, baseCurrency, metric = 'expense' }: GroupBreakdownProps) {
  const items = groups.filter((g) => g.consolidated[metric] > 0);
  const total = items.reduce((sum, g) => sum + g.consolidated[metric], 0);

  if (items.length === 0) {
    const what = metric === 'income' ? 'ingresos' : 'gastos';
    return <p className="text-sm text-muted-foreground">Sin {what} en el período.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {items.map((group, index) => (
        <li key={group.key} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartColor(index) }}
              aria-hidden
            />
            {group.label}
            <span className="text-muted-foreground">
              {total > 0 ? `· ${Math.round((group.consolidated[metric] / total) * 100)}%` : ''}
            </span>
          </span>
          <span className="font-medium">{formatAmount(group.consolidated[metric], baseCurrency)}</span>
        </li>
      ))}
    </ul>
  );
}
