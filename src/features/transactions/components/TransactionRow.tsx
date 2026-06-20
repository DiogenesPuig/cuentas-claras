import { cn } from '@/lib/utils';
import { formatAmount } from '../format';
import type { TransactionView } from '../api';

interface TransactionRowProps {
  transaction: TransactionView;
  canEdit: boolean;
  onEdit: (transaction: TransactionView) => void;
  onDelete: (transaction: TransactionView) => void;
}

function subtitle(tx: TransactionView): string {
  return [tx.account?.holder_name, tx.account?.name, tx.occurred_on].filter(Boolean).join(' · ');
}

/** Fila de un movimiento: motivo·monto, persona (holder del medio)·medio·fecha, editar/eliminar. */
export function TransactionRow({ transaction, canEdit, onEdit, onDelete }: TransactionRowProps) {
  return (
    <li className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
      <div className="space-y-0.5">
        <p className="font-medium">
          {transaction.description ||
            transaction.category?.name ||
            (transaction.type === 'income' ? 'Ingreso' : 'Gasto')}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle(transaction)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'font-medium',
            transaction.type === 'income' ? 'text-emerald-600' : 'text-destructive',
          )}
        >
          {transaction.type === 'income' ? '+' : '−'}{' '}
          {formatAmount(transaction.amount, transaction.currency)}
        </span>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(transaction)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(transaction)}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
