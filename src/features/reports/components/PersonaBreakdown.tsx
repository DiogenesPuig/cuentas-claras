import { formatAmount } from '@/features/transactions/format';
import type { PersonaSpending } from '../aggregate';

interface PersonaBreakdownProps {
  people: PersonaSpending[];
  baseCurrency: string;
}

/**
 * Detalle del gasto por persona (FR-22): cuánto y qué % del total aporta cada una, y en
 * qué categoría gastó mayormente ("mayormente en Super" / "varios"). Acompaña al donut.
 */
export function PersonaBreakdown({ people, baseCurrency }: PersonaBreakdownProps) {
  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {people.map((person) => (
        <li key={person.holder} className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-medium">
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
