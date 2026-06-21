import { formatAmount } from '@/features/transactions';
import type { ConsolidationResult } from '@/lib/money';

interface ConsolidatedTotalsProps {
  consolidated: ConsolidationResult;
  baseCurrency: string;
}

/** Totales por moneda original + consolidado en la moneda base del workspace (FR-21/FR-9b). */
export function ConsolidatedTotals({ consolidated, baseCurrency }: ConsolidatedTotalsProps) {
  const currencies = Object.entries(consolidated.byCurrency).sort(([a], [b]) => a.localeCompare(b));

  if (currencies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin movimientos en este período.</p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-sm font-semibold">Consolidado ({baseCurrency})</span>
        <span className="text-sm font-semibold">{formatAmount(consolidated.balance, baseCurrency)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
        <span>Ingresos: {formatAmount(consolidated.income, baseCurrency)}</span>
        <span>Gastos: {formatAmount(consolidated.expense, baseCurrency)}</span>
      </div>

      {currencies.length > 0 && (
        <ul className="space-y-1 pt-1 text-sm">
          {currencies.map(([currency, totals]) => (
            <li key={currency} className="flex items-center justify-between">
              <span className="text-muted-foreground">{currency}</span>
              <span>{formatAmount(totals.balance, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
