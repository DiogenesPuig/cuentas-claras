import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@/features/categories';
import { DateField } from '@/components/DateField';
import {
  useGetOrCreateSharedCashAccount,
  useGetOrCreateSharedTransferAccount,
  type Account,
  type MemberOption,
} from '@/features/accounts';
// Valor (no barrel) para no arrastrar Supabase al test del form (ver memoria del barrel).
import { accountLabel } from '@/features/accounts/format';
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
import { learnedCategoryId, type CategoryMemory } from '@/lib/category-learn';
import { isInstitutionalPayee } from '@/lib/payee';
import { sha256Hex } from '@/lib/file-hash';

/** Debajo de este valor avisamos que la extracción puede ser imprecisa. */
const LOW_CONFIDENCE = 0.5;

/** Valor centinela del selector de medio para "Efectivo compartido" (IDENT-1): al elegirlo se
 * crea/reusa el medio `'cash'` compartido de forma lazy y se reemplaza por su id real. */
const SHARED_CASH_SENTINEL = '__shared_cash__';

/** El medio "Efectivo" compartido del workspace (IDENT-1): `cash`, sin dueño ni titular. */
function isSharedCashAccount(account: Account): boolean {
  return account.type === 'cash' && !account.owner_member_id && account.holder_name === '';
}

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
    ownerMemberId: transaction.owner_member_id ?? '',
    bank: transaction.bank ?? '',
    occurredOn: isoToDisplayDate(transaction.occurred_on),
    chargedOn: isoToDisplayDate(transaction.charged_on),
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
  /** Workspace activo: requerido para buscar/crear (lazy) el medio `'transfer'` de la persona (F2-11). */
  workspaceId?: string;
  /** Miembros del workspace (incluye placeholders), para el selector de persona y el match de transferencias. */
  members?: MemberOption[];
  /** Memoria de categorías aprendida del historial (MEJ-17/18): sugiere la categoría de lo recurrente. */
  categoryMemory?: CategoryMemory;
  /**
   * Crea una "persona del grupo" sin cuenta (placeholder, IDENT-1) y la devuelve. Si se pasa, el
   * selector de persona muestra "+ Persona" (solo lo pasa el contenedor a owner/admin). El contenedor
   * es responsable de invalidar la lista de miembros.
   */
  onCreatePerson?: (name: string) => Promise<MemberOption>;
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
  categoryMemory,
  onCreatePerson,
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
  // Crear "persona del grupo" (placeholder, IDENT-1) desde el selector de persona.
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  // Personas recién creadas en esta sesión del form (para que aparezcan ya en el select).
  const [createdPeople, setCreatedPeople] = useState<MemberOption[]>([]);
  // Persona a seleccionar recién creada: se aplica en un efecto (una vez que su <option> existe),
  // porque `setValue` sobre un select uncontrolled no engancha si la opción todavía no está.
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  // Token de la asignación del medio "Transferencia" vigente (BUG-7): identifica cada corrida
  // para descartar respuestas viejas si el estado cambió antes de resolver.
  const transferRunRef = useRef(0);
  // Efectivo compartido (IDENT-1): al elegir la opción "Efectivo" del selector se crea/reusa el
  // medio compartido de forma lazy. `pendingCashId` se aplica en un efecto una vez que su <option>
  // existe (mismo motivo que `pendingPersonId`).
  const [creatingCashAccount, setCreatingCashAccount] = useState(false);
  const [pendingCashId, setPendingCashId] = useState<string | null>(null);
  const cashRunRef = useRef(0);
  // Guard de re-entrancia del submit (BUG-9): evita disparar dos altas con doble click
  // rápido antes de que React refleje `disabled`.
  const submittingRef = useRef(false);
  const getOrCreateSharedTransferAccount = useGetOrCreateSharedTransferAccount(workspaceId);
  const getOrCreateSharedCashAccount = useGetOrCreateSharedCashAccount(workspaceId);
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
    setPendingCashId(null);
  }, [transaction, reset]);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const type = watch('type');
  const occurredOn = watch('occurredOn');
  const chargedOn = watch('chargedOn');
  const description = watch('description');
  const categoryId = watch('categoryId');
  const accountId = watch('accountId');
  const ownerMemberId = watch('ownerMemberId');
  const bank = watch('bank');
  const selectedFile = watch('attachment')?.[0] ?? null;
  const categoryOptions = categories.filter((c) => c.kind === type);
  const amountField = register('amount');

  // Efectivo compartido (IDENT-1): si ya existe, se elige como cualquier medio; si no, se ofrece la
  // opción centinela que lo crea al vuelo. La persona (quién pagó) va en el selector de persona.
  const sharedCashAccount = accounts.find(isSharedCashAccount) ?? null;
  const showCashSentinel = !sharedCashAccount || pendingCashId !== null;

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

  // Persona dueña de la transferencia (F2-9): si el titular matchea a un miembro/placeholder, se
  // prefilla en el campo "Persona" (editable). IDENT-1: el medio es el "Transferencia" COMPARTIDO
  // (uno por workspace); la persona va en el movimiento (`owner_member_id`), no en el medio.
  const matchedMember = ownerHolder ? matchMember(ownerHolder, members ?? []) : null;

  // Al detectar una transferencia por comprobante: asignar el medio "Transferencia" compartido y
  // prefill de la persona. Pago institucional (BUG-5): sin medio ni persona.
  useEffect(() => {
    if (!transferInfo) return;
    if (effectiveIsInstitutional) {
      if (accountId) setValue('accountId', '');
      if (ownerMemberId) setValue('ownerMemberId', '');
      return;
    }
    if (!ownerHolder) return;
    if (matchedMember && !ownerMemberId) setValue('ownerMemberId', matchedMember.id);
    if (accountId || !workspaceId) return;

    // Guard de carrera (BUG-7): descarta la respuesta si el estado cambió o el componente se
    // desmontó antes de resolver; solo la corrida vigente apaga el spinner.
    const runId = (transferRunRef.current += 1);
    let cancelled = false;
    setCreatingTransferAccount(true);
    getOrCreateSharedTransferAccount
      .mutateAsync()
      .then((account) => {
        if (!cancelled) setValue('accountId', account.id);
      })
      .finally(() => {
        if (transferRunRef.current === runId) setCreatingTransferAccount(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferInfo, effectiveIsInstitutional, ownerHolder, matchedMember?.id, workspaceId, accountId, ownerMemberId]);

  // Banco del comprobante (F2-11): vive en el movimiento, no en el medio (el
  // usuario sigue pudiendo cambiarlo o borrarlo).
  useEffect(() => {
    if (ownerBank && !bank) setValue('bank', ownerBank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerBank]);

  // Al elegir "Efectivo" (centinela): crea/reusa el medio compartido. No se setea el id acá porque
  // su <option> puede no existir aún; se aplica en el efecto de abajo (ver `pendingPersonId`).
  useEffect(() => {
    if (accountId !== SHARED_CASH_SENTINEL || !workspaceId) return;
    const runId = (cashRunRef.current += 1);
    let cancelled = false;
    setCreatingCashAccount(true);
    getOrCreateSharedCashAccount
      .mutateAsync()
      .then((account) => {
        if (!cancelled) setPendingCashId(account.id);
      })
      .catch((err) => {
        if (cancelled) return;
        setValue('accountId', '');
        toast.error(err instanceof Error ? err.message : 'No se pudo crear el medio "Efectivo".');
      })
      .finally(() => {
        if (cashRunRef.current === runId) setCreatingCashAccount(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, workspaceId]);

  // Selecciona el medio "Efectivo" compartido recién creado una vez que su <option> ya está en la
  // lista (tras invalidar `useAccounts`), para que el select uncontrolled enganche el valor.
  useEffect(() => {
    if (pendingCashId === null) return;
    if (!accounts.some((a) => a.id === pendingCashId)) return;
    setValue('accountId', pendingCashId);
    setPendingCashId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCashId, accounts]);

  // Sugerencia de categoría (solo si no hay una elegida; nunca se aplica sola, el usuario usa "Usar").
  // Prioridad: memoria aprendida del historial (MEJ-17/18: comercio o persona recurrente) → keywords
  // fijas (F2-6, FR-19). La memoria por persona solo aplica en transfer/cash (lo resuelve el lib).
  const suggestedCategory = (() => {
    if (type !== 'expense' || categoryId) return null;
    const accountType = accounts.find((a) => a.id === accountId)?.type ?? null;
    const learnedId = categoryMemory
      ? learnedCategoryId({ description, ownerMemberId, accountType }, categoryMemory)
      : null;
    const learned = learnedId ? (categoryOptions.find((c) => c.id === learnedId) ?? null) : null;
    return learned ?? suggestCategory(description, categoryOptions);
  })();

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
    setValue('ownerMemberId', d.ownerMemberId);
    setTransferInfo(null);
    setTreatAsInstitutional(null);
    setOcrApplied(false);
  }

  // Crea una "persona del grupo" (placeholder) y la selecciona (IDENT-1).
  async function handleCreatePerson() {
    const name = newPersonName.trim();
    if (!name || !onCreatePerson) return;
    try {
      const created = await onCreatePerson(name);
      setCreatedPeople((prev) => [...prev, created]);
      setPendingPersonId(created.id); // se selecciona en el efecto, cuando su <option> ya existe
      setNewPersonName('');
      setCreatingPerson(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la persona.');
    }
  }

  // Opciones del selector de persona: miembros + las recién creadas (que aún no están en `members`).
  const personOptions = [
    ...(members ?? []),
    ...createdPeople.filter((p) => !(members ?? []).some((m) => m.id === p.id)),
  ];

  // Selecciona la persona recién creada una vez que su <option> ya está renderizada.
  useEffect(() => {
    if (pendingPersonId && createdPeople.some((p) => p.id === pendingPersonId)) {
      setValue('ownerMemberId', pendingPersonId);
      setPendingPersonId(null);
    }
  }, [pendingPersonId, createdPeople, setValue]);

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
      ownerMemberId: values.ownerMemberId || null,
      bank: values.bank || null,
      occurredOn: displayToIsoDate(values.occurredOn),
      chargedOn: values.chargedOn ? displayToIsoDate(values.chargedOn) : null,
      attachmentId: transaction?.attachment_id ?? null,
      // Si se precargó desde un comprobante, el alta es de origen OCR (FR-14).
      source: !transaction && ocrApplied ? 'ocr' : undefined,
    };
  }

  async function handleFormSubmit(values: TransactionFormInput) {
    // Efectivo compartido (IDENT-1): no guardar el centinela; esperar a que el medio se cree.
    if (values.accountId === SHARED_CASH_SENTINEL || creatingCashAccount || pendingCashId !== null) {
      toast.error('Esperá a que termine de crearse el medio “Efectivo”.');
      return;
    }
    // Guard anti doble-submit (BUG-9): ignora reentradas mientras la anterior no terminó,
    // por si un doble click rápido dispara el handler antes de que se refleje `disabled`.
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
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
    } finally {
      submittingRef.current = false;
    }
  }

  /** El usuario confirmó guardar pese al aviso de duplicado (F2-13). */
  async function confirmSaveAnyway() {
    if (submittingRef.current || !pendingSave) return;
    submittingRef.current = true;
    try {
      const { input, file } = pendingSave;
      setDuplicateCandidates([]);
      setPendingSave(null);
      await onSubmit(input, file);
    } finally {
      submittingRef.current = false;
    }
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
            {showCashSentinel && <option value={SHARED_CASH_SENTINEL}>Efectivo</option>}
          </select>
          {creatingCashAccount && (
            <p className="text-xs text-muted-foreground">Creando el medio “Efectivo”…</p>
          )}
          {sharedCashAccount && accountId === sharedCashAccount.id && !ownerMemberId && (
            <p className="text-xs text-muted-foreground">Elegí abajo quién lo pagó (opcional).</p>
          )}
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

      {/* Persona del movimiento (IDENT-1): quién lo hizo, para cuando el medio no la determina
          (efectivo, transferencia compartida, sin medio). "Según el medio" = se deduce del medio. */}
      <div className="space-y-1">
        <label htmlFor="tx-owner" className="text-sm font-medium">
          Persona (opcional)
        </label>
        <div className="flex items-center gap-2">
          <select
            id="tx-owner"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('ownerMemberId')}
          >
            <option value="">Según el medio</option>
            {personOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          {onCreatePerson && !creatingPerson && (
            <button
              type="button"
              onClick={() => setCreatingPerson(true)}
              className="shrink-0 rounded-md border border-input px-2 py-2 text-sm font-medium hover:bg-accent"
            >
              + Persona
            </button>
          )}
        </div>
        {onCreatePerson && creatingPerson && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPersonName}
              onChange={(event) => setNewPersonName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreatePerson();
                }
              }}
              placeholder="Nombre de la persona del grupo"
              aria-label="Nombre de la persona del grupo"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleCreatePerson()}
              disabled={!newPersonName.trim()}
              className="shrink-0 rounded-md bg-primary px-2.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingPerson(false);
                setNewPersonName('');
              }}
              className="shrink-0 rounded-md border border-input px-2.5 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        )}
        {/* Aviso: si es una transferencia y no reconocimos a la persona, se toma según el medio. */}
        {transferInfo && !effectiveIsInstitutional && !ownerMemberId && (
          <p className="text-xs text-muted-foreground">
            No reconocimos al usuario/miembro del comprobante; elegilo (o creá la persona), o el
            movimiento se toma según el medio.
          </p>
        )}
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
        <DateField
          id="tx-occurred-on"
          label="Fecha"
          value={occurredOn}
          onChange={(v) => setValue('occurredOn', v, { shouldValidate: true, shouldDirty: true })}
          error={errors.occurredOn?.message}
        />

        <DateField
          id="tx-charged-on"
          label="Se cobra"
          optionalHint
          value={chargedOn ?? ''}
          onChange={(v) => setValue('chargedOn', v, { shouldValidate: true, shouldDirty: true })}
          error={errors.chargedOn?.message}
        />
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
