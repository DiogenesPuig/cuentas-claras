import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Edición del perfil propio (MEJ-7): por ahora solo el nombre (global). */
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Tu nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
});
export type ProfileInput = z.infer<typeof profileSchema>;
