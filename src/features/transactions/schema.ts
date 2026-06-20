import { z } from 'zod';

export const TRANSACTION_TYPES = ['expense', 'income'] as const;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  occurredOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  chargedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
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
    occurredOn: todayIsoDate(),
    chargedOn: '',
  };
}
