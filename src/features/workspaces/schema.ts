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

/** Roles asignables al invitar o al cambiar el rol de un miembro (no `owner`: no se otorga por UI). */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const inviteSchema = z.object({
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  role: z.enum(ASSIGNABLE_ROLES),
});
export type InviteFormInput = z.infer<typeof inviteSchema>;

/** Cotizaciones soportadas hoy por la edge function `fx-refresh` (fuente dolarapi). */
export const FX_QUOTES = ['oficial', 'blue', 'mep'] as const;
export type FxQuote = (typeof FX_QUOTES)[number];

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  baseCurrency: z.enum(BASE_CURRENCIES),
  fxQuote: z.enum(FX_QUOTES),
});
export type WorkspaceSettingsFormInput = z.infer<typeof workspaceSettingsSchema>;
