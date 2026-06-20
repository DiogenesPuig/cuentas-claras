import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories';
import { useAccounts } from '@/features/accounts';
import { useMyRole, type MemberRole } from '@/features/workspaces';
import {
  TransactionForm,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  useUploadAttachment,
  type Transaction,
  type TransactionInput,
} from '@/features/transactions';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';

const CAN_MANAGE_ANY_ROLES: readonly MemberRole[] = ['owner', 'admin'];

/**
 * Pantalla `/movimientos`: alta/edición rápida de movimientos (B8).
 * La lista con filtros/búsqueda (FR-11) llega en B10; esto es solo lo necesario
 * para probar y editar/eliminar los movimientos que se van creando.
 */
export function TransactionsPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  const { user } = useAuth();
  const { data: role } = useMyRole(workspaceId);
  const { data: categories } = useCategories(workspaceId);
  const { data: accounts } = useAccounts(workspaceId);
  const { data: transactions, isLoading } = useTransactions(workspaceId);

  const createTransaction = useCreateTransaction(workspaceId);
  const updateTransaction = useUpdateTransaction(workspaceId);
  const deleteTransaction = useDeleteTransaction(workspaceId);
  const uploadAttachment = useUploadAttachment(workspaceId);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!workspaceId) return null;

  const isFormOpen = editing !== null || isCreating;
  const canManageAny = role !== null && role !== undefined && CAN_MANAGE_ANY_ROLES.includes(role);

  function canEdit(transaction: Transaction): boolean {
    return transaction.created_by === user?.id || canManageAny;
  }

  function closeForm() {
    setEditing(null);
    setIsCreating(false);
    setFormError(null);
  }

  async function handleSubmit(input: TransactionInput, attachment: File | null) {
    setFormError(null);
    try {
      let attachmentId = input.attachmentId;
      if (attachment) {
        const uploaded = await uploadAttachment.mutateAsync(attachment);
        attachmentId = uploaded.id;
      }
      const payload = { ...input, attachmentId };

      if (editing) {
        await updateTransaction.mutateAsync({ id: editing.id, input: payload });
      } else {
        await createTransaction.mutateAsync(payload);
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.');
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await deleteTransaction.mutateAsync(transaction.id);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Movimientos</h1>

      {!isFormOpen && (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + Gasto / Ingreso
        </button>
      )}

      {isFormOpen && (
        <div className="space-y-2 rounded-md border border-border p-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <TransactionForm
            transaction={editing ?? undefined}
            categories={categories ?? []}
            accounts={accounts ?? []}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={
              createTransaction.isPending ||
              updateTransaction.isPending ||
              uploadAttachment.isPending
            }
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando movimientos…</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(transactions ?? []).map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
            >
              <div className="space-y-0.5">
                <p className="font-medium">
                  {transaction.type === 'income' ? '+ ' : '- '}
                  {transaction.amount} {transaction.currency}
                  {transaction.description ? ` · ${transaction.description}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transaction.occurred_on}
                  {transaction.category ? ` · ${transaction.category.name}` : ''}
                  {transaction.account ? ` · ${transaction.account.name}` : ''}
                </p>
              </div>
              {canEdit(transaction) && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(transaction)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(transaction)}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
          {(transactions ?? []).length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin movimientos todavía.</li>
          )}
        </ul>
      )}
    </div>
  );
}
