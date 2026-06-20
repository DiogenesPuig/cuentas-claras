import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Category } from '@/features/categories';
import type { Account } from '@/features/accounts';
import {
  defaultTransactionValues,
  transactionSchema,
  TRANSACTION_TYPES,
  type TransactionFormInput,
} from '../schema';
import type { Transaction, TransactionInput } from '../api';

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
    occurredOn: transaction.occurred_on,
    chargedOn: transaction.charged_on ?? '',
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
}

/** Alta/edición rápida de un movimiento (ingreso/gasto) del workspace. */
export function TransactionForm({
  transaction,
  categories,
  accounts,
  onSubmit,
  onCancel,
  isSubmitting,
}: TransactionFormProps) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaultValuesFor(transaction),
  });

  useEffect(() => {
    reset(defaultValuesFor(transaction));
  }, [transaction, reset]);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const type = watch('type');
  const categoryOptions = categories.filter((c) => c.kind === type);
  const amountField = register('amount');

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
        occurredOn: values.occurredOn,
        chargedOn: values.chargedOn || null,
        attachmentId: transaction?.attachment_id ?? null,
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
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="tx-occurred-on" className="text-sm font-medium">
            Fecha
          </label>
          <input
            id="tx-occurred-on"
            type="date"
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
            type="date"
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
