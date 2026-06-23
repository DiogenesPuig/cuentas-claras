import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'credit',
  'debit',
  'cash',
  'wallet',
  'bank_account',
  'transfer',
] as const;
export const CARD_NETWORKS = ['visa', 'mastercard', 'amex', 'cabal', 'other'] as const;
export const HOLDER_KINDS = ['member', 'name'] as const;

export const accountSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
    bank: z.string().trim().max(80, 'Máximo 80 caracteres').optional().or(z.literal('')),
    network: z.enum(CARD_NETWORKS).optional().or(z.literal('')),
    type: z.enum(ACCOUNT_TYPES),
    currency: z.string().trim().length(3, 'Usá el código de 3 letras (ej. ARS)'),
    last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Deben ser 4 dígitos')
      .optional()
      .or(z.literal('')),
    holderKind: z.enum(HOLDER_KINDS),
    ownerMemberId: z.string().optional().or(z.literal('')),
    holderName: z.string().trim().max(80, 'Máximo 80 caracteres').optional().or(z.literal('')),
    isExtension: z.boolean(),
    parentAccountId: z.string().optional().or(z.literal('')),
    billingCloseDay: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 31), {
        message: 'Día entre 1 y 31',
      })
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.holderKind !== 'member' || data.ownerMemberId, {
    message: 'Elegí un miembro.',
    path: ['ownerMemberId'],
  })
  .refine((data) => data.holderKind !== 'name' || data.holderName, {
    message: 'Ingresá el nombre del titular.',
    path: ['holderName'],
  })
  .refine((data) => !data.isExtension || data.parentAccountId, {
    message: 'Elegí la tarjeta titular.',
    path: ['parentAccountId'],
  });

export type AccountFormInput = z.infer<typeof accountSchema>;
