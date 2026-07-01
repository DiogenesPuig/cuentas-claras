# src/features/auth

Login/registro y sesión del usuario. Implementa **FR-1** (PRD §5.1): registro e inicio de
sesión con email+contraseña y/o OAuth de Google.

## Archivos

- `api.ts` — funciones que hablan con `supabase.auth` (sign in/up/out, OAuth Google, `getSession`/
  `onAuthStateChange`) y con `profiles` (`getMyProfile`, `upsertMyProfile`). Sin React. Única capa
  que importa `supabase` en este feature (REF-1).
- `context.ts` — `AuthContext` y `useAuth()` (separado de `hooks.tsx` por fast-refresh de Vite).
- `hooks.tsx` — `AuthProvider`: usa `getSession`/`onAuthStateChange` de `api.ts` (no toca
  `supabase` directo) y expone `session`/`user`/`loading`.
- `queries.ts` — react-query del perfil propio (MEJ-7): `useMyProfile()` y `useUpdateMyProfile()`
  (al guardar invalida el directorio de miembros de reportes y los miembros del grupo).
- `schema.ts` — esquemas zod de los formularios de login/registro y del perfil (`profileSchema`, MEJ-7).
- `index.ts` — barrel del feature.
- `components/LoginPage.tsx` — pantalla `/login`.
- `components/RegisterPage.tsx` — pantalla `/register`.
- `components/OAuthButton.tsx` — botón "Continuar con Google".
- `components/RequireAuth.tsx` — guard de rutas privadas; redirige a `/login` sin sesión.
- `components/LoginPage.test.tsx` — smoke test de validación de campos requeridos.

La creación del primer workspace al loguearse vive en `features/workspaces` + `src/app/pages/OnboardingPage.tsx` (A4).
