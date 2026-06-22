import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  accountSchema,
  ACCOUNT_TYPES,
  CARD_NETWORKS,
  HOLDER_KINDS,
  type AccountFormInput,
} from '../schema';
import type { Account, AccountInput, MemberOption } from '../api';

const TYPE_LABELS: Record<AccountFormInput['type'], string> = {
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Efectivo',
  wallet: 'Billetera',
  bank_account: 'Cuenta bancaria',
};

const NETWORK_LABELS: Record<(typeof CARD_NETWORKS)[number], string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  cabal: 'Cabal',
  other: 'Otra',
};

function defaultValuesFor(account?: Account): AccountFormInput {
  return {
    name: account?.name ?? '',
    bank: account?.bank ?? '',
    network: account?.network ?? '',
    type: account?.type ?? 'credit',
    currency: account?.currency ?? 'ARS',
    last4: account?.last4 ?? '',
    holderKind: account?.owner_member_id ? 'member' : 'name',
    ownerMemberId: account?.owner_member_id ?? '',
    holderName: account?.owner_member_id ? '' : account?.holder_name ?? '',
    isExtension: account?.is_extension ?? false,
    parentAccountId: account?.parent_account_id ?? '',
    billingCloseDay: account?.billing_close_day ? String(account.billing_close_day) : '',
  };
}

interface AccountFormProps {
  /** Si se pasa, el form edita este medio; si no, crea uno nuevo. */
  account?: Account;
  /** Valores precargados en modo alta (sin `account`), ej. detectados de un resumen (F2-5). */
  defaults?: Partial<AccountFormInput>;
  /** Miembros del workspace, para elegir el holder. */
  members: MemberOption[];
  /** Medios titulares disponibles como tarjeta padre (excluye el medio en edición). */
  parentOptions: Account[];
  onSubmit: (input: AccountInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/** Alta/edición de un medio de pago/tarjeta del workspace. */
export function AccountForm({
  account,
  defaults,
  members,
  parentOptions,
  onSubmit,
  onCancel,
  isSubmitting,
}: AccountFormProps) {
  // En modo alta, los `defaults` (ej. del resumen) pisan los valores vacíos; en
  // edición mandan los del medio. `account` siempre tiene prioridad si está.
  const initialValues = account
    ? defaultValuesFor(account)
    : { ...defaultValuesFor(undefined), ...defaults };
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AccountFormInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(account ? defaultValuesFor(account) : { ...defaultValuesFor(undefined), ...defaults });
    // `defaults` es un objeto nuevo en cada render del padre; lo serializamos para
    // no reinicializar el form en cada tecla mientras el usuario edita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, reset, JSON.stringify(defaults)]);

  const holderKind = watch('holderKind');
  const isExtension = watch('isExtension');

  async function handleFormSubmit(values: AccountFormInput) {
    const isMemberHolder = values.holderKind === 'member';
    const member = members.find((m) => m.id === values.ownerMemberId);

    await onSubmit({
      name: values.name,
      bank: values.bank || null,
      network: values.network || null,
      type: values.type,
      currency: values.currency.toUpperCase(),
      last4: values.last4 || null,
      ownerMemberId: isMemberHolder ? values.ownerMemberId || null : null,
      holderName: isMemberHolder ? member?.name ?? 'Sin nombre' : values.holderName || '',
      isExtension: values.isExtension,
      parentAccountId: values.isExtension ? values.parentAccountId || null : null,
      billingCloseDay: values.billingCloseDay ? Number(values.billingCloseDay) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="account-name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="account-name"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="account-bank" className="text-sm font-medium">
            Banco (opcional)
          </label>
          <input
            id="account-bank"
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('bank')}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="account-network" className="text-sm font-medium">
            Red (opcional)
          </label>
          <select
            id="account-network"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('network')}
          >
            <option value="">Sin red</option>
            {CARD_NETWORKS.map((network) => (
              <option key={network} value={network}>
                {NETWORK_LABELS[network]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="account-type" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="account-type"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('type')}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="account-currency" className="text-sm font-medium">
            Moneda
          </label>
          <input
            id="account-currency"
            type="text"
            maxLength={3}
            placeholder="ARS"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
            {...register('currency')}
          />
          {errors.currency && (
            <p className="text-sm text-destructive">{errors.currency.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="account-last4" className="text-sm font-medium">
          Últimos 4 dígitos (opcional)
        </label>
        <input
          id="account-last4"
          type="text"
          maxLength={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('last4')}
        />
        {errors.last4 && <p className="text-sm text-destructive">{errors.last4.message}</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Quién la usa?</legend>
        <div className="flex gap-4">
          {HOLDER_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input type="radio" value={kind} {...register('holderKind')} />
              {kind === 'member' ? 'Miembro de la app' : 'Otra persona'}
            </label>
          ))}
        </div>

        {holderKind === 'member' ? (
          <div className="space-y-1">
            <label htmlFor="account-owner-member" className="sr-only">
              Miembro
            </label>
            <select
              id="account-owner-member"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('ownerMemberId')}
            >
              <option value="">Elegir miembro…</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {errors.ownerMemberId && (
              <p className="text-sm text-destructive">{errors.ownerMemberId.message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <label htmlFor="account-holder-name" className="sr-only">
              Nombre del titular
            </label>
            <input
              id="account-holder-name"
              type="text"
              placeholder="Nombre del titular"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('holderName')}
            />
            {errors.holderName && (
              <p className="text-sm text-destructive">{errors.holderName.message}</p>
            )}
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" {...register('isExtension')} />
          Es una extensión
        </label>

        {isExtension && (
          <div className="space-y-1">
            <label htmlFor="account-parent" className="sr-only">
              Tarjeta titular
            </label>
            <select
              id="account-parent"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('parentAccountId')}
            >
              <option value="">Elegir tarjeta titular…</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
            {errors.parentAccountId && (
              <p className="text-sm text-destructive">{errors.parentAccountId.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="account-billing-close-day" className="text-sm font-medium">
          Día de cierre (opcional)
        </label>
        <input
          id="account-billing-close-day"
          type="text"
          inputMode="numeric"
          maxLength={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('billingCloseDay')}
        />
        {errors.billingCloseDay && (
          <p className="text-sm text-destructive">{errors.billingCloseDay.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {account ? 'Guardar cambios' : 'Crear medio'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
