import {
  AccountForm,
  useCreateAccount,
  useMembersForHolder,
  type Account,
  type AccountFormInput,
} from '@/features/accounts';

interface AccountQuickCreateProps {
  workspaceId: string;
  /** Valores iniciales del form, ya mapeados por quien llama (resumen de tarjeta,
   * comprobante de transferencia, etc.) — este componente no conoce el origen. */
  defaults: Partial<AccountFormInput>;
  /** Medios del workspace (para ofrecer la tarjeta titular si es una extensión). */
  accounts: Account[];
  onCreated: (account: Account) => void;
  onCancel: () => void;
  /** Copy del bloque; cada llamador lo contextualiza (resumen vs. transferencia). */
  title?: string;
}

/**
 * Alta inline de un medio (F2-5, F2-9): reusa el `AccountForm` de B7 precargado por
 * quien llama. Permite crear también una extensión ligada a su titular (el form ya
 * soporta `isExtension`/`parentAccountId`).
 */
export function AccountQuickCreate({
  workspaceId,
  defaults,
  accounts,
  onCreated,
  onCancel,
  title = 'Crear medio',
}: AccountQuickCreateProps) {
  const { data: members } = useMembersForHolder(workspaceId);
  const createAccount = useCreateAccount(workspaceId);
  const parentOptions = accounts.filter((a) => !a.is_extension);

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <AccountForm
        defaults={defaults}
        members={members ?? []}
        parentOptions={parentOptions}
        isSubmitting={createAccount.isPending}
        onCancel={onCancel}
        onSubmit={async (input) => {
          const created = await createAccount.mutateAsync(input);
          onCreated(created);
        }}
      />
    </div>
  );
}
