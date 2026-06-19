import { z } from 'zod';

export const CATEGORY_KINDS = ['expense', 'income'] as const;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  kind: z.enum(CATEGORY_KINDS),
  icon: z.string().trim().max(10, 'Máximo 10 caracteres').optional().or(z.literal('')),
  color: z.string().trim().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
});
export type CategoryFormInput = z.infer<typeof categorySchema>;
