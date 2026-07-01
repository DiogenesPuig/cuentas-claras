import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@/features/categories';
import {
  useGetOrCreateTransferAccount,
  type Account,
  type MemberOption,
} from '@/features/accounts';
// Valor (no barrel) para no arrastrar Supabase al test del form (ver memoria del barrel).
import { accountLabel } from '@/features/accounts/format';
import { accountsToMatchable, matchAccount } from '@/lib/account-match';
import { matchMember } from '@/lib/member-match';
import {
  bankFor,
  counterpartyFor,
  holderFor,
  ownerSideFor,
  type TransferPartyInfo,
} from '@/lib/transfer-account';
import {
  defaultTransactionValues,
  transactionSchema,
  TRANSACTION_TYPES,
  type TransactionFormInput,
} from '../schema';
import type {
  DuplicateCandidateView,
  DuplicateCriteria,
  ReceiptExtraction,
  Transaction,
  TransactionInput,
} from '../api';
import { displayToIsoDate, isoToDisplayDate, formatAmount } from '../format';
import { suggestCategory } from '@/lib/category-suggest';
import { isInstitutionalPayee } from '@/lib/payee';
import { sha256Hex } from '@/lib/file-hash';

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
    bank: transaction.bank ?? '',
    occurredOn: isoToDisplayDate(transaction.occurred_on),
    chargedOn: isoToDisplayDate(transaction.charged_on),
  };
}

/**
 * Medio `'transfer'` de una persona entre los medios del workspace (F2-11): por
 * `owner_member_id` si el titular matchea a un miembro, o por `holder_name` si no
 * (para reutilizar el medio de un titular no-miembro entre comprobantes).
 */
function findTransferAccount(
  holder: string | null,
  matchedMemberId: string | null,
  transferAccounts: Account[],
): Account | null {
  if (!holder) return null;
  if (matchedMemberId) {
    return transferAccounts.find((a) => a.owner_member_id === matchedMemberId) ?? null;
  }
  const matchable = accountsToMatchable(transferAccounts);
  const result = matchAccount(
    { bank: null, network: null, last4: null, holder },
    matchable,
    { allowHolderOnlyMatch: true },
  );
  if (!result.matched) return null;
  return transferAccounts.find((a) => a.id === result.matched!.id) ?? null;
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
  /** Workspace activo: requerido para buscar/crear (lazy) el medio `'transfer'` de la persona (F2-11). */
  workspaceId?: string;
  /** Miembros del workspace, para matchear al titular de una transferencia con su medio. */
  members?: MemberOption[];
  /**
   * Busca posibles duplicados antes de crear (F2-13). Si se pasa y devuelve candidatos en un alta
   * nueva, se muestra un aviso suave y se espera confirmación ("Guardar igual"). En edición no se llama.
   */
  onCheckDuplicates?: (criteria: DuplicateCriteria) => Promise<DuplicateCandidateView[]>;
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
  onCheckDuplicates,
}: TransactionFormProps) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrApplied, setOcrApplied] = useState(false);
  // Aviso de duplicado (F2-13): candidatos detectados y el alta en espera de confirmación.
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidateView[]>([]);
  const [pendingSave, setPendingSave] = useState<{ input: TransactionInput; file: File | null } | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  // Origen/destino detectados en un comprobante de transferencia (F2-8/F2-9).
  const [transferInfo, setTransferInfo] = useState<TransferPartyInfo | null>(null);
  // null = usar heurística; true/false = override manual del usuario (BUG-5).
  const [treatAsInstitutional, setTreatAsInstitutional] = useState<boolean | null>(null);
  const [creatingTransferAccount, setCreatingTransferAccount] = useState(false);
  const getOrCreateTransferAccount = useGetOrCreateTransferAccount(workspaceId);
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
    setTransferInfo(null);
    setTreatAsInstitutional(null);
    setDuplicateCandidates([]);
    setPendingSave(null);
  }, [transaction, reset]);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const type = watch('type');
  const description = watch('description');
  const categoryId = watch('categoryId');
  const accountId = watch('accountId');
  const bank = watch('bank');
  const selectedFile = watch('attachment')?.[0] ?? null;
  const categoryOptions = categories.filter((c) => c.kind === type);
  const amountField = register('amount');

  // Atribución del medio/persona en una transferencia (F2-9, decisión 2026-06-23):
  // gasto → origen (quien envía), ingreso → destino (quien recibe).
  const ownerSide = transferInfo ? ownerSideFor(type) : null;
  const ownerHolder = transferInfo && ownerSide ? holderFor(transferInfo, ownerSide) : null;
  const ownerBank = transferInfo && ownerSide ? bankFor(transferInfo, ownerSide) : null;
  const counterparty = transferInfo && ownerSide ? counterpartyFor(transferInfo, ownerSide) : null;

  // Heurística BUG-5: si cualquiera de los dos lados es organismo/empresa de servicios,
  // no se crea persona ni medio 'transfer'. El usuario puede sobreescribir con el toggle.
  const heuristicIsInstitutional =
    transferInfo !== null &&
    (isInstitutionalPayee(transferInfo.originHolder) || isInstitutionalPayee(transferInfo.destHolder));
  const effectiveIsInstitutional = treatAsInstitutional ?? heuristicIsInstitutional;

  // Persona dueña de la transferencia (F2-11): si el titular matchea a un miembro, se
  // busca/crea SU medio `'transfer'` (uno por persona, no por persona+banco).
  const matchedMember = ownerHolder ? matchMember(ownerHolder, members ?? []) : null;
  const transferAccounts = accounts.filter((a) => a.type === 'transfer');
  const transferMatch = findTransferAccount(ownerHolder, matchedMember?.id ?? null, transferAccounts);

  // Si el medio `'transfer'` de la persona ya existe, se asocia solo. Si no, se crea
  // lazy (sin pedirle al usuario que lo cree a mano) y se asocia el recién creado.
  // Para pagos institucionales (BUG-5) se omite: no hay persona ni medio 'transfer'.
  useEffect(() => {
    if (effectiveIsInstitutional) {
      if (accountId) setValue('accountId', '');
      return;
    }
    if (accountId || !ownerHolder) return;
    if (transferMatch) {
      setValue('accountId', transferMatch.id);
      return;
    }
    if (creatingTransferAccount || !workspaceId) return;
    setCreatingTransferAccount(true);
    getOrCreateTransferAccount
      .mutateAsync({ ownerMemberId: matchedMember?.id ?? null, holderName: ownerHolder })
      .then((account) => setValue('accountId', account.id))
      .finally(() => setCreatingTransferAccount(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferMatch?.id, ownerHolder, matchedMember?.id, effectiveIsInstitutional]);

  // Banco del comprobante (F2-11): vive en el movimiento, no en el medio (el
  // usuario sigue pudiendo cambiarlo o borrarlo).
  useEffect(() => {
    if (ownerBank && !bank) setValue('bank', ownerBank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerBank]);

  // Sugerencia de categoría por descripción (F2-6, FR-19): solo si no hay una elegida.
  // Nunca se aplica sola; el usuario decide con el botón "Usar".
  const suggestedCategory =
    type === 'expense' && !categoryId ? suggestCategory(description, categoryOptions) : null;

  // Limpia lo que precargó una extracción anterior. Sirve para que al reintentar
  // con OTRO comprobante que falle o traiga menos datos, el form no quede con los
  // datos viejos (BUG-3). Resetea solo los campos que toca el OCR.
  function clearAppliedOcr() {
    const d = defaultTransactionValues();
    setValue('amount', d.amount);
    setValue('currency', d.currency);
    setValue('occurredOn', d.occurredOn);
    setValue('description', d.description);
    setValue('bank', d.bank);
    setValue('accountId', d.accountId);
    setTransferInfo(null);
    setTreatAsInstitutional(null);
    setOcrApplied(false);
  }

  async function handleExtract() {
    if (!onExtractReceipt || !selectedFile) return;
    setOcrLoading(true);
    // Reintento sobre una precarga previa: vaciar antes de aplicar el nuevo (BUG-3).
    if (ocrApplied) clearAppliedOcr();
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
        toast.error('No se pudieron extraer datos del comprobante. Completá manualmente.');
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
      setOcrApplied(true);
      if (result.confidence < LOW_CONFIDENCE) {
        toast.warning('Datos precargados con baja confianza: revisalos antes de guardar.');
      } else {
        toast.success('Datos precargados desde el comprobante: revisalos antes de guardar.');
      }
    } catch {
      toast.error('No se pudo procesar el comprobante. Podés cargar los datos a mano.');
    } finally {
      setOcrLoading(false);
    }
  }

  function buildInput(values: TransactionFormInput): TransactionInput {
    return {
      type: values.type,
      amount: Number(values.amount),
      currency: values.currency.toUpperCase(),
      description: values.description || null,
      categoryId: values.categoryId || null,
      accountId: values.accountId || null,
      bank: values.bank || null,
      occurredOn: displayToIsoDate(values.occurredOn),
      chargedOn: values.chargedOn ? displayToIsoDate(values.chargedOn) : null,
      attachmentId: transaction?.attachment_id ?? null,
      // Si se precargó desde un comprobante, el alta es de origen OCR (FR-14).
      source: !transaction && ocrApplied ? 'ocr' : undefined,
    };
  }

  async function handleFormSubmit(values: TransactionFormInput) {
    const file = values.attachment?.[0] ?? null;
    const input = buildInput(values);

    // Aviso de duplicado (F2-13): solo en ALTA nueva y si el contenedor pasó el chequeo.
    if (!transaction && onCheckDuplicates) {
      setCheckingDuplicates(true);
      try {
        const contentHash = file ? await sha256Hex(await file.arrayBuffer()) : null;
        const candidates = await onCheckDuplicates({
          amount: input.amount,
          currency: input.currency,
          occurredOn: input.occurredOn,
          accountId: input.accountId,
          description: input.description,
          contentHash,
        });
        if (candidates.length > 0) {
          setDuplicateCandidates(candidates);
          setPendingSave({ input, file });
          return; // se espera "Guardar igual" / "Cancelar"
        }
      } catch {
        // Si el chequeo falla (red, etc.) no bloqueamos el alta: seguimos y guardamos.
      } finally {
        setCheckingDuplicates(false);
      }
    }

    await onSubmit(input, file);
  }

  /** El usuario confirmó guardar pese al aviso de duplicado (F2-13). */
  async function confirmSaveAnyway() {
    if (!pendingSave) return;
    const { input, file } = pendingSave;
    setDuplicateCandidates([]);
    setPendingSave(null);
    await onSubmit(input, file);
  }

  function dismissDuplicateWarning() {
    setDuplicateCandidates([]);
    setPendingSave(null);
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
          {ownerHolder && !effectiveIsInstitutional && (
            <p className="text-xs text-muted-foreground">
              Transferencia con {ownerHolder}
              {counterparty ? ` (de/para ${counterparty})` : ''}.
              {creatingTransferAccount && ' Creando su medio "Transferencia"…'}
              {!workspaceId && !accountId && ' Falta el workspace activo para asignar el medio.'}
            </p>
          )}
          {transferInfo && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={effectiveIsInstitutional}
                onChange={(e) => setTreatAsInstitutional(e.target.checked)}
              />
              Es un pago a empresa/impuesto (no a una persona)
            </label>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="tx-bank" className="text-sm font-medium">
          Banco (opcional)
        </label>
        <input
          id="tx-bank"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('bank')}
        />
        {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
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
          </div>
        )}
      </div>

      {duplicateCandidates.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
          <p className="text-sm font-medium">
            {duplicateCandidates.some((c) => c.reason === 'same-file')
              ? 'Ya subiste este comprobante'
              : 'Hay un movimiento parecido'}
          </p>
          <ul className="space-y-1 text-sm">
            {duplicateCandidates.map((c) => (
              <li key={c.id}>
                {formatAmount(c.amount, c.currency)} · {isoToDisplayDate(c.occurredOn)}
                {c.description ? ` · ${c.description}` : ''}
                {c.accountName ? ` · ${c.accountName}` : ''}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmSaveAnyway}
              disabled={isSubmitting}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Guardar igual
            </button>
            <button
              type="button"
              onClick={dismissDuplicateWarning}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {duplicateCandidates.length === 0 && (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || checkingDuplicates}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {checkingDuplicates
              ? 'Verificando…'
              : transaction
                ? 'Guardar cambios'
                : 'Crear movimiento'}
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
      )}
    </form>
  );
}
