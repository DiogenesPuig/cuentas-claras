import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories';
import { useAccounts, useMembersForHolder } from '@/features/accounts';
import { useMyRole, type MemberRole } from '@/features/workspaces';
import {
  EMPTY_FIELD_FILTERS,
  ExportButton,
  FilterBar,
  SearchBar,
  TransactionForm,
  TransactionList,
  useCreateTransaction,
  useDeleteTransaction,
  useExtractReceipt,
  useTransactions,
  useUpdateTransaction,
  useUploadAttachment,
  type Transaction,
  type TransactionInput,
  type TransactionView,
} from '@/features/transactions';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useActiveMonth } from '@/hooks/useActiveMonth';

const CAN_MANAGE_ANY_ROLES: readonly MemberRole[] = ['owner', 'admin'];

/** Pantalla `/movimientos`: lista con filtros y búsqueda (FR-11) + alta/edición/borrado (B8). */
export function TransactionsPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  const month = useActiveMonth((state) => state.month);
  const { user } = useAuth();
  const { data: role } = useMyRole(workspaceId);
  const { data: categories } = useCategories(workspaceId);
  const { data: accounts } = useAccounts(workspaceId);
  const { data: members } = useMembersForHolder(workspaceId);

  const [fieldFilters, setFieldFilters] = useState(EMPTY_FIELD_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data: transactions, isLoading } = useTransactions(workspaceId, {
    month,
    search,
    ...fieldFilters,
  });

  const createTransaction = useCreateTransaction(workspaceId);
  const updateTransaction = useUpdateTransaction(workspaceId);
  const deleteTransaction = useDeleteTransaction(workspaceId);
  const uploadAttachment = useUploadAttachment(workspaceId);
  const extractReceipt = useExtractReceipt();

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!workspaceId) return null;

  const isFormOpen = editing !== null || isCreating;
  const canManageAny = role !== null && role !== undefined && CAN_MANAGE_ANY_ROLES.includes(role);

  function canEdit(transaction: TransactionView): boolean {
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

  async function handleDelete(transaction: TransactionView) {
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
            workspaceId={workspaceId}
            members={members ?? []}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={
              createTransaction.isPending ||
              updateTransaction.isPending ||
              uploadAttachment.isPending
            }
            onExtractReceipt={
              import.meta.env.VITE_INGESTA_URL
                ? (file) => extractReceipt.mutateAsync(file)
                : undefined
            }
          />
        </div>
      )}

      <div className="space-y-2">
        <SearchBar value={searchInput} onChange={setSearchInput} />
        <FilterBar
          value={fieldFilters}
          categories={categories ?? []}
          accounts={accounts ?? []}
          onChange={setFieldFilters}
        />
        <ExportButton transactions={transactions ?? []} />
      </div>

      <TransactionList
        transactions={transactions ?? []}
        isLoading={isLoading}
        canEdit={canEdit}
        onEdit={setEditing}
        onDelete={handleDelete}
      />
    </div>
  );
}
