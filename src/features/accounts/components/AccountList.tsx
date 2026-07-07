import { useState, type ReactNode } from 'react';
import { useMyRole, type MemberRole } from '@/features/workspaces';
import { useAccounts, useCreateAccount, useMembersForHolder, useUpdateAccount } from '../hooks';
import type { Account, AccountInput } from '../api';
import { AccountForm } from './AccountForm';
import { HolderAliasesEditor } from './HolderAliasesEditor';

const CAN_MANAGE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

function AccountRow({
  account,
  canManage,
  workspaceId,
  onEdit,
  editForm,
}: {
  account: Account;
  canManage: boolean;
  workspaceId: string;
  onEdit: (account: Account) => void;
  /** Si se está editando ESTE medio, el form va acá adentro (pegado a la tarjeta, BUG-15). */
  editForm?: ReactNode;
}) {
  // TODO(B8/reportes): cuando `owner_member_id` exista, mostrar el nombre vivo del miembro
  // (vía member_directory) en lugar de `holder_name`, que queda denormalizado si el miembro
  // cambia su nombre. Caer a `holder_name` solo cuando no hay miembro asociado.
  const details = [account.bank, account.network, account.holder_name]
    .filter(Boolean)
    .join(' · ');

  const isTransfer = account.type === 'transfer';

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card text-sm shadow-sm transition-colors hover:border-primary/50 focus-within:border-primary/60">
      <div className="flex items-center justify-between gap-4 px-3 py-2.5">
        <div className="space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {account.name}
            {account.is_extension && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-normal text-accent-foreground">
                extensión
              </span>
            )}
            {isTransfer && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-normal text-primary">
                transferencia
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {details || 'Sin detalles'}
            {account.last4 && ` · ••${account.last4}`}
            {' · '}
            {account.currency}
            {account.billing_close_day && ` · cierre día ${account.billing_close_day}`}
          </p>
        </div>
        {canManage && !editForm && (
          <button
            type="button"
            onClick={() => onEdit(account)}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Editar
          </button>
        )}
      </div>
      {/* Edición inline (BUG-15): el form aparece DENTRO de la tarjeta que tocaste, no al pie
          de toda la lista, así no hay que scrollear para editar el medio de más arriba. */}
      {editForm && <div className="border-t border-border bg-muted/30 px-3 py-3">{editForm}</div>}
      {/* Alias de titular: solo tiene sentido en el medio 'transfer' (uno por persona, MEJ-4).
          Sub-sección tintada dentro de la misma tarjeta para que se lea como parte de este medio. */}
      {canManage && !editForm && isTransfer && (
        <div className="border-t border-border bg-muted/40 px-3 py-2">
          <HolderAliasesEditor account={account} workspaceId={workspaceId} />
        </div>
      )}
    </li>
  );
}

interface AccountListProps {
  workspaceId: string;
}

/** Lista plana de medios/tarjetas del workspace, con alta/edición. */
export function AccountList({ workspaceId }: AccountListProps) {
  const { data: accounts, isLoading } = useAccounts(workspaceId);
  const { data: members } = useMembersForHolder(workspaceId);
  const { data: role } = useMyRole(workspaceId);
  const createAccount = useCreateAccount(workspaceId);
  const updateAccount = useUpdateAccount(workspaceId);

  const [editing, setEditing] = useState<Account | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = role !== null && role !== undefined && CAN_MANAGE_ROLES.includes(role);
  const isFormOpen = editing !== null || isCreating;

  function closeForm() {
    setEditing(null);
    setIsCreating(false);
    setFormError(null);
  }

  async function handleSubmit(input: AccountInput) {
    setFormError(null);
    try {
      if (editing) {
        await updateAccount.mutateAsync({ id: editing.id, input });
      } else {
        await createAccount.mutateAsync(input);
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el medio.');
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando medios…</p>;
  }

  const accountList = accounts ?? [];
  const parentOptions = accountList.filter(
    (a) => !a.is_extension && a.id !== editing?.id,
  );

  const accountForm = (account: Account | undefined) => (
    <>
      {formError && <p className="mb-2 text-sm text-destructive">{formError}</p>}
      <AccountForm
        account={account}
        members={members ?? []}
        parentOptions={parentOptions}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        isSubmitting={createAccount.isPending || updateAccount.isPending}
      />
    </>
  );

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {accountList.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            canManage={canManage}
            workspaceId={workspaceId}
            onEdit={setEditing}
            editForm={editing?.id === account.id ? accountForm(account) : undefined}
          />
        ))}
        {accountList.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Sin medios todavía.
          </li>
        )}
      </ul>

      {canManage && !isFormOpen && (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          + Nuevo medio
        </button>
      )}

      {/* Alta de un medio nuevo: al pie (el botón "+ Nuevo medio" está acá). La EDICIÓN, en
          cambio, va inline dentro de su tarjeta (BUG-15). */}
      {canManage && isCreating && (
        <div className="space-y-2 rounded-md border border-border p-4">{accountForm(undefined)}</div>
      )}
    </div>
  );
}
