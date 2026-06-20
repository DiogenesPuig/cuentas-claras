import { formatAmount } from '../format';
import type { TransactionView } from '../api';

interface CurrencyTotals {
  currency: string;
  income: number;
  expense: number;
  balance: number;
}

function summarizeByCurrency(transactions: TransactionView[]): CurrencyTotals[] {
  const totals = new Map<string, { income: number; expense: number }>();
  for (const tx of transactions) {
    const entry = totals.get(tx.currency) ?? { income: 0, expense: 0 };
    if (tx.type === 'income') entry.income += tx.amount;
    else entry.expense += tx.amount;
    totals.set(tx.currency, entry);
  }
  return Array.from(totals.entries())
    .map(([currency, { income, expense }]) => ({
      currency,
      income,
      expense,
      balance: income - expense,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

interface SummaryCardProps {
  transactions: TransactionView[];
}

/**
 * Resumen del período: ingresos, gastos y balance, desglosados por moneda (FR-21).
 * El consolidado en moneda base llega cuando se integre `money.consolidate` (C11).
 */
export function SummaryCard({ transactions }: SummaryCardProps) {
  const totals = summarizeByCurrency(transactions);

  if (totals.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Sin movimientos en este período.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      {totals.map((t) => (
        <div key={t.currency} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ingresos</span>
            <span className="font-medium text-emerald-600">
              + {formatAmount(t.income, t.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gastos</span>
            <span className="font-medium text-destructive">
              − {formatAmount(t.expense, t.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1 text-sm font-semibold">
            <span>Balance ({t.currency})</span>
            <span>{formatAmount(t.balance, t.currency)}</span>
          </div>
        </div>
      ))}
      {totals.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Totales por moneda. El consolidado en la moneda base del workspace llega con la
          conversión FX (C11/C12).
        </p>
      )}
    </div>
  );
}
