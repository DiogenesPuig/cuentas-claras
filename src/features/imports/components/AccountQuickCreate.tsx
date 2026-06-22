import {
  AccountForm,
  CARD_NETWORKS,
  useCreateAccount,
  useMembersForHolder,
  type Account,
  type AccountFormInput,
} from '@/features/accounts';
import { accountDefaultsFromHint } from '@/lib/account-match';
import type { StatementAccountHint } from '@/lib/ingesta';

interface AccountQuickCreateProps {
  workspaceId: string;
  /** Pistas detectadas del resumen (banco/red/last4/titular). */
  hint: StatementAccountHint;
  /** Medios del workspace (para ofrecer la tarjeta titular si es una extensión). */
  accounts: Account[];
  onCreated: (account: Account) => void;
  onCancel: () => void;
}

/** Mapea las pistas del resumen a los valores iniciales del form de medios (B7). */
function defaultsFromHint(hint: StatementAccountHint): Partial<AccountFormInput> {
  const base = accountDefaultsFromHint(hint);
  const network = (CARD_NETWORKS as readonly string[]).includes(base.network) ? base.network : '';
  return {
    name: base.name,
    bank: base.bank,
    network: network as AccountFormInput['network'],
    last4: base.last4,
    holderName: base.holderName,
    holderKind: 'name', // del resumen sale un nombre, no un miembro de la app
    type: 'credit', // los resúmenes son de tarjetas de crédito
  };
}

/**
 * Alta inline de un medio desde el staging de importación (F2-5, FR-16b): reusa el
 * `AccountForm` de B7 precargado con lo detectado en el resumen. Permite crear también
 * una extensión ligada a su titular (el form ya soporta `isExtension`/`parentAccountId`).
 */
export function AccountQuickCreate({
  workspaceId,
  hint,
  accounts,
  onCreated,
  onCancel,
}: AccountQuickCreateProps) {
  const { data: members } = useMembersForHolder(workspaceId);
  const createAccount = useCreateAccount(workspaceId);
  const parentOptions = accounts.filter((a) => !a.is_extension);

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <p className="mb-3 text-sm font-medium">Crear medio detectado en el resumen</p>
      <AccountForm
        defaults={defaultsFromHint(hint)}
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
