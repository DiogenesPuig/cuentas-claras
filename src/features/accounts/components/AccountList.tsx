import { useState } from 'react';
import { useMyRole, type MemberRole } from '@/features/workspaces';
import { useAccounts, useCreateAccount, useMembersForHolder, useUpdateAccount } from '../hooks';
import type { Account, AccountInput } from '../api';
import { AccountForm } from './AccountForm';

const CAN_MANAGE_ROLES: readonly MemberRole[] = ['owner', 'admin'];

function AccountRow({
  account,
  canManage,
  onEdit,
}: {
  account: Account;
  canManage: boolean;
  onEdit: (account: Account) => void;
}) {
  // TODO(B8/reportes): cuando `owner_member_id` exista, mostrar el nombre vivo del miembro
  // (vía member_directory) en lugar de `holder_name`, que queda denormalizado si el miembro
  // cambia su nombre. Caer a `holder_name` solo cuando no hay miembro asociado.
  const details = [account.bank, account.network, account.holder_name]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
      <div className="space-y-0.5">
        <p className="font-medium">
          {account.name}
          {account.is_extension && (
            <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-normal text-accent-foreground">
              extensión
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
      {canManage && (
        <button
          type="button"
          onClick={() => onEdit(account)}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Editar
        </button>
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

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-md border border-border">
        {accountList.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            canManage={canManage}
            onEdit={setEditing}
          />
        ))}
        {accountList.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Sin medios todavía.</li>
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

      {canManage && isFormOpen && (
        <div className="space-y-2 rounded-md border border-border p-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <AccountForm
            account={editing ?? undefined}
            members={members ?? []}
            parentOptions={parentOptions}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={createAccount.isPending || updateAccount.isPending}
          />
        </div>
      )}
    </div>
  );
}
