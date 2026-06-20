import { TransactionRow } from './TransactionRow';
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

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {transactions.length} movimiento{transactions.length === 1 ? '' : 's'}
      </p>
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
