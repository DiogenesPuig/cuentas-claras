# src/features/workspaces

Pertenencia del usuario a workspaces y creación del primero (onboarding). Implementa parte de
**FR-2** (PRD §5.2): un usuario individual es un workspace de 1 miembro; al crear un grupo, el
creador queda como `owner` (trigger `trg_ws_add_owner`). El selector de workspace activo y el
layout son del ticket A5; invitar miembros, del C15.

## Archivos

- `api.ts` — Supabase: `listMyWorkspaces` (vía `workspace_members`) y `createWorkspace`
  (inserta con `owner_id = auth.uid()`). Sin React.
- `hooks.ts` — react-query: `useMyWorkspaces` y `useCompleteOnboarding` (asegura `profiles` +
  crea el primer workspace).
- `schema.ts` — zod del onboarding (`displayName`, `workspaceName`, `baseCurrency`) y la lista
  `BASE_CURRENCIES` (monedas base ofrecidas).
- `index.ts` — barrel del feature.
- `components/RequireWorkspace.tsx` — guard: si el usuario no tiene workspaces, redirige a
  `/onboarding`.

## Relacionados

- La creación/actualización de la fila en `profiles` vive en `features/auth` (`upsertMyProfile`).
- `OnboardingPage` vive en `src/app/` (composición de la app).
