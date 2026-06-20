import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatAmount } from '../format';
import type { TransactionView } from '../api';

interface RecentTransactionsProps {
  transactions: TransactionView[];
  limit?: number;
}

function rowSubtitle(tx: TransactionView): string {
  return [tx.account?.holder_name, tx.account?.name, tx.occurred_on].filter(Boolean).join(' · ');
}

/** Últimos movimientos del período: persona (holder del medio), medio y fecha (FR-20). */
export function RecentTransactions({ transactions, limit = 5 }: RecentTransactionsProps) {
  const recent = transactions.slice(0, limit);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Últimos movimientos</h2>
        <Link to="/movimientos" className="text-xs font-medium text-primary hover:underline">
          Ver todos
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos en este período.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {recent.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
              <div className="space-y-0.5">
                <p className="font-medium">
                  {tx.description || tx.category?.name || (tx.type === 'income' ? 'Ingreso' : 'Gasto')}
                </p>
                <p className="text-xs text-muted-foreground">{rowSubtitle(tx)}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 font-medium',
                  tx.type === 'income' ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {tx.type === 'income' ? '+' : '−'} {formatAmount(tx.amount, tx.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
