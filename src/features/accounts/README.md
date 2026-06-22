# src/features/accounts

Medios de pago/tarjetas del workspace, como **lista plana** (cada extensión es su propia fila).
Implementa **FR-5, FR-6c, FR-6d** (PRD §5.2): alta/edición de tarjetas/medios con banco, red,
tipo, moneda, últimos 4 dígitos, holder (miembro o nombre) y, si es extensión, su tarjeta titular.

## Archivos

- `api.ts` — Supabase: `listAccounts` (no archivados del workspace), `listMembersForHolder`
  (miembros del workspace para el selector de holder, vía `workspace_members` + la vista
  `member_directory` — `profiles` solo es legible por su propio dueño), `createAccount` y
  `updateAccount` (RLS exige rol owner/admin). Sin React.
- `hooks.ts` — react-query: `useAccounts(workspaceId)` (se reutilizará en el alta de movimientos,
  B8), `useMembersForHolder`, `useCreateAccount` y `useUpdateAccount`.
- `schema.ts` — zod del form: `name`, `bank`, `network`, `type`, `currency`, `last4`, `holderKind`
  (`member` | `name`) + `ownerMemberId`/`holderName` según corresponda, `isExtension` +
  `parentAccountId` si aplica, `billingCloseDay`.
- `index.ts` — barrel del feature.
- `format.ts` / `format.test.ts` — `accountLabel(account)`: etiqueta para los combos de medios
  (nombre + banco · red · ••últimos4), para distinguir tarjetas al asignarlas. Pura (sin Supabase).
- `components/AccountList.tsx` — lista plana de medios (extensiones como fila propia, marcadas);
  muestra el form de alta/edición solo si el usuario es owner/admin (`useMyRole`).
- `components/AccountForm.tsx` — alta/edición de un medio: resuelve `owner_member_id` (si el
  holder es un miembro) u `holder_name` (si es "otra persona"), y exige `parent_account_id`
  cuando `isExtension` está activo. Acepta `defaults?` para precargar valores en modo alta (lo
  usa el alta inline desde la importación de resúmenes, F2-5).

## Fuera de alcance (ver ticket B7)

- Total gastado por medio en el período (FR-6): depende de `transactions` (C11); se deja para
  cuando exista esa lógica.
- **Mostrar el holder por `owner_member_id` (pendiente):** hoy la lista muestra `holder_name`, que
  queda denormalizado si el miembro cambia su nombre. A futuro, cuando exista `owner_member_id`,
  mostrar el nombre vivo del miembro (vía `member_directory`) y caer a `holder_name` solo si no hay
  miembro asociado. Ver `TODO(B8/reportes)` en `components/AccountList.tsx`.

## Relacionados

- `features/workspaces` (`useMyRole`) — gating de owner/admin en el front (la seguridad real la
  garantiza RLS: `acc_write` en `db/schema_fase1.sql`).
- `useAccounts` se reutiliza en el alta de movimientos (`features/transactions`, B8).
