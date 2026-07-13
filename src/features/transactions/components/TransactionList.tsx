import { TransactionRow } from './TransactionRow';
import { formatAmount } from '../format';
import { sumByType, type CurrencyTotal } from '../totals';
import type { TransactionView } from '../api';

interface TransactionListProps {
  transactions: TransactionView[];
  isLoading: boolean;
  canEdit: (transaction: TransactionView) => boolean;
  onEdit: (transaction: TransactionView) => void;
  onDelete: (transaction: TransactionView) => void;
}

/** Lista de movimientos ya filtrados, con el total filtrado arriba (FR-11). */
export function TransactionList({
  transactions,
  isLoading,
  canEdit,
  onEdit,
  onDelete,
}: TransactionListProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando movimientos…</p>;
  }

  // Total del set FILTRADO (MEJ-13): por moneda, separando gastos de ingresos.
  const totals = sumByType(transactions);
  const formatTotals = (list: CurrencyTotal[]): string =>
    list.map((c) => formatAmount(c.total, c.currency)).join(' · ');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm text-muted-foreground">
          {transactions.length} movimiento{transactions.length === 1 ? '' : 's'}
        </span>
        <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1">
          {totals.expense.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Gastos:{' '}
              <span className="text-base font-bold text-foreground">{formatTotals(totals.expense)}</span>
            </span>
          )}
          {totals.income.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Ingresos:{' '}
              <span className="text-base font-bold text-foreground">{formatTotals(totals.income)}</span>
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            canEdit={canEdit(transaction)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {transactions.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            Sin movimientos para estos filtros.
          </li>
        )}
      </ul>
    </div>
  );
}
