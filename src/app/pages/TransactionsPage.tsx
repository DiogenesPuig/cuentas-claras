import { useEffect, useMemo, useState } from 'react';
import { personaKeyOf, personaLabelOf } from '@/lib/persona';
import { useAuth } from '@/features/auth';
import { useCategories } from '@/features/categories';
import { useAccounts, useMembersForHolder } from '@/features/accounts';
import { useCreatePlaceholderMember, useMyRole, type MemberRole } from '@/features/workspaces';
import { StatementImport } from '@/features/imports';
import { Modal } from '@/components/Modal';
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
  useFindDuplicateCandidates,
  useTransactions,
  useCategoryHistory,
  useUpdateTransaction,
  useUploadAttachment,
  type Transaction,
  type TransactionInput,
  type TransactionView,
} from '@/features/transactions';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useActiveMonth } from '@/hooks/useActiveMonth';
import { buildCategoryMemory } from '@/lib/category-learn';

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
  const { data: categoryHistory } = useCategoryHistory(workspaceId);
  const categoryMemory = useMemo(() => buildCategoryMemory(categoryHistory ?? []), [categoryHistory]);

  const [fieldFilters, setFieldFilters] = useState(EMPTY_FIELD_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // La persona se filtra en el cliente (IDENT-1); el resto de los campos van a la query.
  const { data: transactions, isLoading } = useTransactions(workspaceId, {
    month,
    search,
    accountId: fieldFilters.accountId,
    categoryId: fieldFilters.categoryId,
    currency: fieldFilters.currency,
  });

  const memberNameById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member.name])),
    [members],
  );

  const personaOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const tx of transactions ?? []) {
      const key = personaKeyOf(tx);
      if (!byKey.has(key)) byKey.set(key, personaLabelOf(tx, memberNameById));
    }
    return Array.from(byKey, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [transactions, memberNameById]);

  const visibleTransactions = useMemo(() => {
    const all = transactions ?? [];
    const key = fieldFilters.personaKey;
    if (!key) return all;
    return all.filter((tx) => personaKeyOf(tx) === key);
  }, [transactions, fieldFilters.personaKey]);

  const createTransaction = useCreateTransaction(workspaceId);
  const updateTransaction = useUpdateTransaction(workspaceId);
  const deleteTransaction = useDeleteTransaction(workspaceId);
  const uploadAttachment = useUploadAttachment(workspaceId);
  const extractReceipt = useExtractReceipt();
  const findDuplicates = useFindDuplicateCandidates(workspaceId);
  const createPerson = useCreatePlaceholderMember(workspaceId);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!workspaceId) return null;

  const isFormOpen = editing !== null || isCreating;

  // Alta de movimiento e importación de resumen son mutuamente excluyentes.
  function openCreate() {
    setIsImporting(false);
    setIsCreating(true);
  }

  function openImport() {
    closeForm();
    setIsImporting(true);
  }
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

      {!isFormOpen && !isImporting && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + Gasto / Ingreso
          </button>
          <button
            type="button"
            onClick={openImport}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Importar resumen
          </button>
        </div>
      )}

      {isImporting && (
        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Importar resumen</h2>
            <button
              type="button"
              onClick={() => setIsImporting(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Subí el PDF del resumen de tarjeta (Banco Patagonia Visa/Master o Banco Nación
            Mastercard), revisá los movimientos detectados y confirmalos en bloque.
          </p>
          <StatementImport workspaceId={workspaceId} />
        </div>
      )}

      {/* Alta/edición en modal (BUG-12): así editar una fila de la lista no te tira al tope
          de la página ni pierde el scroll; se puede modificar varios campos en contexto. */}
      <Modal
        open={isFormOpen}
        onClose={closeForm}
        title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      >
        {formError && <p className="mb-2 text-sm text-destructive">{formError}</p>}
        <TransactionForm
          transaction={editing ?? undefined}
          categories={categories ?? []}
          accounts={accounts ?? []}
          workspaceId={workspaceId}
          members={members ?? []}
          categoryMemory={categoryMemory}
          onCreatePerson={canManageAny ? (name) => createPerson.mutateAsync(name) : undefined}
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
          onCheckDuplicates={(criteria) => findDuplicates.mutateAsync(criteria)}
        />
      </Modal>

      <div className="space-y-2">
        <SearchBar value={searchInput} onChange={setSearchInput} />
        <FilterBar
          value={fieldFilters}
          categories={categories ?? []}
          accounts={accounts ?? []}
          personaOptions={personaOptions}
          onChange={setFieldFilters}
        />
        <ExportButton transactions={visibleTransactions} />
      </div>

      <TransactionList
        transactions={visibleTransactions}
        isLoading={isLoading}
        canEdit={canEdit}
        onEdit={(transaction) => {
          setIsImporting(false);
          setEditing(transaction);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
