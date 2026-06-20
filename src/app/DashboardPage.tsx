import { useState } from 'react';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useActiveMonth } from '@/hooks/useActiveMonth';
import { useCategories } from '@/features/categories';
import { useAccounts } from '@/features/accounts';
import { Fab } from '@/components/Fab';
import {
  RecentTransactions,
  SummaryCard,
  TransactionForm,
  useCreateTransaction,
  useTransactions,
  useUploadAttachment,
  type TransactionInput,
} from '@/features/transactions';

/** Pantalla `/`: resumen del mes activo, últimos movimientos y alta rápida (B9). */
export function DashboardPage() {
  const workspaceId = useActiveWorkspace((state) => state.workspaceId);
  const month = useActiveMonth((state) => state.month);
  const { data: categories } = useCategories(workspaceId);
  const { data: accounts } = useAccounts(workspaceId);
  const { data: transactions, isLoading } = useTransactions(workspaceId, { month });

  const createTransaction = useCreateTransaction(workspaceId);
  const uploadAttachment = useUploadAttachment(workspaceId);

  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!workspaceId) return null;

  const monthTransactions = transactions ?? [];

  async function handleSubmit(input: TransactionInput, attachment: File | null) {
    setFormError(null);
    try {
      let attachmentId = input.attachmentId;
      if (attachment) {
        const uploaded = await uploadAttachment.mutateAsync(attachment);
        attachmentId = uploaded.id;
      }
      await createTransaction.mutateAsync({ ...input, attachmentId });
      setIsCreating(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cuentas Claras</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <SummaryCard transactions={monthTransactions} />
          <RecentTransactions transactions={monthTransactions} />
        </>
      )}

      <Fab onClick={() => setIsCreating(true)} />

      {isCreating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo movimiento"
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 md:items-center"
          onClick={() => setIsCreating(false)}
        >
          <div
            className="w-full max-w-md space-y-2 rounded-md bg-background p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Nuevo movimiento</h2>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <TransactionForm
              categories={categories ?? []}
              accounts={accounts ?? []}
              onSubmit={handleSubmit}
              onCancel={() => setIsCreating(false)}
              isSubmitting={createTransaction.isPending || uploadAttachment.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}
