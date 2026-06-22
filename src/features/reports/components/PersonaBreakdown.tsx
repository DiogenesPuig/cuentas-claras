import { formatAmount } from '@/features/transactions/format';
import type { PersonaSpending } from '../aggregate';
import { chartColor } from './chartColors';

interface PersonaBreakdownProps {
  people: PersonaSpending[];
  baseCurrency: string;
}

/**
 * Detalle del gasto por persona (FR-22): cuánto y qué % del total aporta cada una, y en
 * qué categoría gastó mayormente ("mayormente en Super" / "varios"). Acompaña al donut
 * (mismo orden y color que sus porciones).
 */
export function PersonaBreakdown({ people, baseCurrency }: PersonaBreakdownProps) {
  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {people.map((person, index) => (
        <li key={person.holder} className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="flex items-center gap-2 font-medium">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartColor(index) }}
              aria-hidden
            />
            {person.holder} <span className="text-muted-foreground">· {Math.round(person.share * 100)}%</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {formatAmount(person.expense, baseCurrency)} ·{' '}
            {person.mainLabel === 'Varios' ? 'varios' : `mayormente en ${person.mainLabel}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
