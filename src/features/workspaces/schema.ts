import { z } from 'zod';

/**
 * Monedas base ofrecidas en el onboarding (ISO-4217). Lista corta y ampliable;
 * el esquema de la DB acepta cualquier código de 3 letras.
 */
export const BASE_CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP'] as const;
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];

export const onboardingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Tu nombre es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  workspaceName: z
    .string()
    .trim()
    .min(1, 'El nombre del grupo es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  baseCurrency: z.enum(BASE_CURRENCIES),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
