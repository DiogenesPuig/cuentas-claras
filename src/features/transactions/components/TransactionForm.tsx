import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@/features/categories';
import type { Account, AccountFormInput, MemberOption } from '@/features/accounts';
// Valor (no barrel) para no arrastrar Supabase al test del form (ver memoria del barrel).
import { accountLabel } from '@/features/accounts/format';
// Reusa el alta inline de medios de F2-5 (se mantiene físicamente en `imports` pero ya
// es genérica): evita duplicar el flujo de "crear medio" para el caso de transferencias.
import { AccountQuickCreate } from '@/features/imports';
import { matchAccount, type MatchableAccount } from '@/lib/account-match';
import { matchMember } from '@/lib/member-match';
import {
  bankFor,
  counterpartyFor,
  holderFor,
  ownerSideFor,
  transferAccountDefaults,
  type TransferPartyInfo,
} from '@/lib/transfer-account';
import {
  defaultTransactionValues,
  transactionSchema,
  TRANSACTION_TYPES,
  type TransactionFormInput,
} from '../schema';
import type { ReceiptExtraction, Transaction, TransactionInput } from '../api';
import { displayToIsoDate, isoToDisplayDate } from '../format';
import { suggestCategory } from '@/lib/category-suggest';

/** Debajo de este valor avisamos que la extracción puede ser imprecisa. */
const LOW_CONFIDENCE = 0.5;

const TYPE_LABELS: Record<TransactionFormInput['type'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
};

function defaultValuesFor(transaction?: Transaction): TransactionFormInput {
  if (!transaction) return defaultTransactionValues();
  return {
    type: transaction.type,
    amount: String(transaction.amount),
    currency: transaction.currency,
    description: transaction.description ?? '',
    categoryId: transaction.category_id ?? '',
    accountId: transaction.account_id ?? '',
    occurredOn: isoToDisplayDate(transaction.occurred_on),
    chargedOn: isoToDisplayDate(transaction.charged_on),
  };
}

/** Valores para precargar el alta inline del medio `bank_account` de una transferencia (F2-9). */
function accountDefaultsForTransfer(
  holder: string,
  bank: string | null,
  members: MemberOption[],
): Partial<AccountFormInput> {
  const base = transferAccountDefaults(holder, bank);
  const member = matchMember(holder, members);
  return {
    name: base.name,
    bank: base.bank,
    type: 'bank_account',
    holderKind: member ? 'member' : 'name',
    ownerMemberId: member?.id ?? '',
    holderName: member ? '' : base.holderName,
  };
}

interface TransactionFormProps {
  /** Si se pasa, el form edita este movimiento; si no, crea uno nuevo. */
  transaction?: Transaction;
  categories: Category[];
  accounts: Account[];
  /** El comprobante (si se elige uno) se sube aparte; acá solo se entrega el `File`. */
  onSubmit: (input: TransactionInput, attachment: File | null) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /**
   * OCR del comprobante elegido (FR-14). Si se pasa, aparece el botón para
   * precargar monto/fecha/comercio. Si falla o no se configuró, el alta sigue manual.
   */
  onExtractReceipt?: (file: File) => Promise<ReceiptExtraction>;
  /** Workspace activo: requerido para ofrecer crear el medio de una transferencia (F2-9). */
  workspaceId?: string;
  /** Miembros del workspace, para preasignar el dueño del medio de una transferencia. */
  members?: MemberOption[];
}

/** Alta/edición rápida de un movimiento (ingreso/gasto) del workspace. */
export function TransactionForm({
  transaction,
  categories,
  accounts,
  onSubmit,
  onCancel,
  isSubmitting,
  onExtractReceipt,
  workspaceId,
  members,
}: TransactionFormProps) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [ocrApplied, setOcrApplied] = useState(false);
  // Origen/destino detectados en un comprobante de transferencia (F2-8/F2-9).
  const [transferInfo, setTransferInfo] = useState<TransferPartyInfo | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaultValuesFor(transaction),
  });

  useEffect(() => {
    reset(defaultValuesFor(transaction));
    setOcrApplied(false);
    setOcrMessage(null);
    setTransferInfo(null);
    setShowCreateAccount(false);
  }, [transaction, reset]);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const type = watch('type');
  const description = watch('description');
  const categoryId = watch('categoryId');
  const accountId = watch('accountId');
  const selectedFile = watch('attachment')?.[0] ?? null;
  const categoryOptions = categories.filter((c) => c.kind === type);
  const amountField = register('amount');

  // Atribución del medio/persona en una transferencia (F2-9, decisión 2026-06-23):
  // gasto → origen (quien envía), ingreso → destino (quien recibe).
  const ownerSide = transferInfo ? ownerSideFor(type) : null;
  const ownerHolder = transferInfo && ownerSide ? holderFor(transferInfo, ownerSide) : null;
  const ownerBank = transferInfo && ownerSide ? bankFor(transferInfo, ownerSide) : null;
  const counterparty = transferInfo && ownerSide ? counterpartyFor(transferInfo, ownerSide) : null;

  const matchableAccounts: MatchableAccount[] = accounts.map((a) => ({
    id: a.id,
    bank: a.bank,
    network: a.network,
    last4: a.last4,
    holderName: a.holder_name,
    isExtension: a.is_extension,
  }));
  // Transferencia (F2-9): auto-asocia por titular aunque falte el banco (común en
  // comprobantes/medios de transferencia), siempre que el match sea inequívoco.
  const transferMatch = ownerHolder
    ? matchAccount(
        { bank: ownerBank, network: null, last4: null, holder: ownerHolder },
        matchableAccounts,
        { allowHolderOnlyMatch: true },
      ).matched
    : null;

  // Si el medio de la transferencia ya existe, se asocia solo (el usuario sigue pudiendo cambiarlo).
  useEffect(() => {
    if (transferMatch && !accountId) setValue('accountId', transferMatch.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferMatch?.id]);

  // Sugerencia de categoría por descripción (F2-6, FR-19): solo si no hay una elegida.
  // Nunca se aplica sola; el usuario decide con el botón "Usar".
  const suggestedCategory =
    type === 'expense' && !categoryId ? suggestCategory(description, categoryOptions) : null;

  async function handleExtract() {
    if (!onExtractReceipt || !selectedFile) return;
    setOcrLoading(true);
    setOcrMessage(null);
    try {
      const result = await onExtractReceipt(selectedFile);
      const transfer: TransferPartyInfo = {
        originHolder: result.origin_holder,
        originBank: result.origin_bank,
        destHolder: result.dest_holder,
        destBank: result.dest_bank,
      };
      const hasTransferInfo = Object.values(transfer).some((v) => v);
      const found =
        result.amount != null ||
        result.date != null ||
        (result.merchant?.trim().length ?? 0) > 0 ||
        hasTransferInfo;
      if (!found) {
        setOcrMessage('No se pudieron extraer datos del comprobante. Completá manualmente.');
        return;
      }
      if (result.amount != null) setValue('amount', String(result.amount));
      if (result.currency) setValue('currency', result.currency.toUpperCase());
      if (result.date) setValue('occurredOn', isoToDisplayDate(result.date));
      if (result.merchant?.trim()) setValue('description', result.merchant.trim().slice(0, 140));
      // Sin comercio (transferencia), sugerimos la contraparte como descripción.
      if (!result.merchant?.trim() && hasTransferInfo) {
        const side = ownerSideFor(type);
        const suggestion = counterpartyFor(transfer, side);
        if (suggestion) setValue('description', suggestion.slice(0, 140));
      }
      setTransferInfo(hasTransferInfo ? transfer : null);
      setShowCreateAccount(false);
      setOcrApplied(true);
      setOcrMessage(
        result.confidence < LOW_CONFIDENCE
          ? 'Datos precargados con baja confianza: revisalos antes de guardar.'
          : 'Datos precargados desde el comprobante: revisalos antes de guardar.',
      );
    } catch {
      setOcrMessage('No se pudo procesar el comprobante. Podés cargar los datos a mano.');
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleFormSubmit(values: TransactionFormInput) {
    const file = values.attachment?.[0] ?? null;
    await onSubmit(
      {
        type: values.type,
        amount: Number(values.amount),
        currency: values.currency.toUpperCase(),
        description: values.description || null,
        categoryId: values.categoryId || null,
        accountId: values.accountId || null,
        occurredOn: displayToIsoDate(values.occurredOn),
        chargedOn: values.chargedOn ? displayToIsoDate(values.chargedOn) : null,
        attachmentId: transaction?.attachment_id ?? null,
        // Si se precargó desde un comprobante, el alta es de origen OCR (FR-14).
        source: !transaction && ocrApplied ? 'ocr' : undefined,
      },
      file,
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <fieldset className="flex gap-4">
        <legend className="sr-only">Tipo de movimiento</legend>
        {TRANSACTION_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="radio" value={t} {...register('type')} />
            {TYPE_LABELS[t]}
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="tx-amount" className="text-sm font-medium">
            Monto
          </label>
          <input
            id="tx-amount"
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...amountField}
            ref={(el) => {
              amountField.ref(el);
              amountRef.current = el;
            }}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="tx-currency" className="text-sm font-medium">
            Moneda
          </label>
          <input
            id="tx-currency"
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
        <label htmlFor="tx-description" className="text-sm font-medium">
          Motivo (opcional)
        </label>
        <input
          id="tx-description"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="tx-category" className="text-sm font-medium">
            Categoría (opcional)
          </label>
          <select
            id="tx-category"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('categoryId')}
          >
            <option value="">Sin categoría</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ` : ''}
                {category.name}
              </option>
            ))}
          </select>
          {suggestedCategory && (
            <p className="text-xs text-muted-foreground">
              Sugerida: {suggestedCategory.icon ? `${suggestedCategory.icon} ` : ''}
              {suggestedCategory.name}{' '}
              <button
                type="button"
                onClick={() => setValue('categoryId', suggestedCategory.id)}
                className="font-medium text-primary hover:underline"
              >
                Usar
              </button>
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="tx-account" className="text-sm font-medium">
            Medio (opcional)
          </label>
          <select
            id="tx-account"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('accountId')}
          >
            <option value="">Sin medio</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel({ ...account, holderName: account.holder_name })}
              </option>
            ))}
          </select>
          {ownerHolder && (
            <p className="text-xs text-muted-foreground">
              Transferencia con {ownerHolder}
              {counterparty ? ` (de/para ${counterparty})` : ''}.
              {!transferMatch && !accountId && (
                <>
                  {' '}
                  {!showCreateAccount ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateAccount(true)}
                      className="font-medium text-primary hover:underline"
                    >
                      Crear medio
                    </button>
                  ) : null}
                </>
              )}
            </p>
          )}
          {showCreateAccount && ownerHolder && !transferMatch && !accountId && (
            <div className="mt-2">
              {workspaceId ? (
                <AccountQuickCreate
                  workspaceId={workspaceId}
                  nested
                  title={`Crear medio para ${ownerHolder}`}
                  defaults={accountDefaultsForTransfer(ownerHolder, ownerBank, members ?? [])}
                  accounts={accounts}
                  onCreated={(account) => {
                    setValue('accountId', account.id);
                    setShowCreateAccount(false);
                  }}
                  onCancel={() => setShowCreateAccount(false)}
                />
              ) : (
                <p className="text-xs text-destructive">
                  Falta el workspace activo para crear el medio.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="tx-occurred-on" className="text-sm font-medium">
            Fecha
          </label>
          <input
            id="tx-occurred-on"
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('occurredOn')}
          />
          {errors.occurredOn && (
            <p className="text-sm text-destructive">{errors.occurredOn.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="tx-charged-on" className="text-sm font-medium">
            Se cobra (opcional)
          </label>
          <input
            id="tx-charged-on"
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('chargedOn')}
          />
          {errors.chargedOn && (
            <p className="text-sm text-destructive">{errors.chargedOn.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="tx-attachment" className="text-sm font-medium">
          Comprobante (opcional)
        </label>
        <input
          id="tx-attachment"
          type="file"
          accept="image/*,application/pdf"
          className="w-full text-sm"
          {...register('attachment')}
        />
        {onExtractReceipt && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleExtract}
              disabled={!selectedFile || ocrLoading}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {ocrLoading ? 'Leyendo comprobante…' : 'Extraer datos del comprobante'}
            </button>
            {ocrMessage && <p className="text-sm text-muted-foreground">{ocrMessage}</p>}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {transaction ? 'Guardar cambios' : 'Crear movimiento'}
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
