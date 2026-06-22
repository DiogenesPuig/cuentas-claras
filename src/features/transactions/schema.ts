import { z } from 'zod';
import { displayToIsoDate, isoToDisplayDate } from './format';

export const TRANSACTION_TYPES = ['expense', 'income'] as const;

/** Fecha de hoy en formato de display DD/MM/YYYY. */
function todayDisplayDate(): string {
  return isoToDisplayDate(new Date().toISOString().slice(0, 10));
}

const DATE_MSG = 'Fecha inválida (DD/MM/AAAA)';

export const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, 'El monto debe ser mayor a 0'),
  currency: z.string().trim().length(3, 'Usá el código de 3 letras (ej. ARS)'),
  description: z.string().trim().max(140, 'Máximo 140 caracteres').optional().or(z.literal('')),
  categoryId: z.string().optional().or(z.literal('')),
  accountId: z.string().optional().or(z.literal('')),
  // Las fechas viven en el form como DD/MM/YYYY; se convierten a ISO al guardar.
  occurredOn: z.string().trim().refine((v) => displayToIsoDate(v) !== '', DATE_MSG),
  chargedOn: z
    .string()
    .trim()
    .refine((v) => v === '' || displayToIsoDate(v) !== '', DATE_MSG)
    .optional()
    .or(z.literal('')),
  attachment: z
    .custom<FileList>((value) => value === undefined || value instanceof FileList)
    .optional(),
});

export type TransactionFormInput = z.infer<typeof transactionSchema>;

export function defaultTransactionValues(): TransactionFormInput {
  return {
    type: 'expense',
    amount: '',
    currency: 'ARS',
    description: '',
    categoryId: '',
    accountId: '',
    occurredOn: todayDisplayDate(),
    chargedOn: '',
  };
}
