# src/features/categories

Categorías de movimientos: globales (sembradas, `workspace_id is null`) + propias del workspace.
Implementa **FR-18** (PRD §5.5): categorías por defecto + categorías propias del workspace.

## Archivos

- `api.ts` — Supabase: `listCategories` (globales + propias del workspace), `createCategory` y
  `updateCategory` (categorías propias; RLS exige rol owner/admin). Sin React.
- `hooks.ts` — react-query: `useCategories(workspaceId, kind?)` (filtra por `kind` si se pasa),
  `useCreateCategory` y `useUpdateCategory`.
- `schema.ts` — zod del form (`name`, `kind`, `icon`, `color`).
- `index.ts` — barrel del feature.
- `components/CategoryList.tsx` — lista separada por gasto/ingreso; muestra el form de alta/edición
  solo si el usuario es owner/admin del workspace (vía `useMyRole` de `features/workspaces`).
- `components/CategoryForm.tsx` — alta/edición de una categoría propia.

## Fuera de alcance (ver ticket B6)

- Archivar categorías: el título del ticket lo menciona pero la tabla `categories` no tiene una
  columna de estado: ni los Pasos ni los Criterios de aceptación lo piden. Requeriría una
  migración nueva; queda pendiente para un ticket aparte.
- Sugerencia automática de categoría (fase 2, FR-19).

## Relacionados

- `features/workspaces` (`useMyRole`) — gating de owner/admin en el front (la seguridad real la
  garantiza RLS: `cat_write` en `db/schema_fase1.sql`).
- `useCategories` se reutiliza en el alta de movimientos (`features/transactions`, B8).
