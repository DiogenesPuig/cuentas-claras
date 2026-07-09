# src/features/accounts

Medios de pago/tarjetas del workspace, como **lista plana** (cada extensión es su propia fila).
Implementa **FR-5, FR-6c, FR-6d** (PRD §5.2): alta/edición de tarjetas/medios con banco, red,
tipo, moneda, últimos 4 dígitos, holder (miembro o nombre) y, si es extensión, su tarjeta titular.

## Archivos

- `api.ts` — Supabase: `listAccounts` (no archivados del workspace), `listMembersForHolder`
  (miembros del workspace para el selector de holder y para resolver la persona; sale de la vista
  `member_directory` con `member_id` + nombre **vivo** e **incluye placeholders** —IDENT-1—;
  `profiles` solo es legible por su propio dueño), `createAccount` y
  `updateAccount` (RLS exige rol owner/admin), `updateHolderAliases(id, aliases)` (MEJ-4: setea
  los nombres alternativos del titular de un medio `'transfer'`; recorta/deduplica), y
  `getOrCreateTransferAccount(workspaceId, holder)` (F2-11: busca el medio `type='transfer'` de una
  persona y, si no existe, lo crea lazy; un único medio "Transferencia" por persona, sin banco).
  MEJ-4: el buscar/crear ahora delega en el matcher puro `findTransferAccount` (`lib/transfer-account`)
  —mismo criterio que el pre-match del front, incluyendo `holder_aliases`— en vez del match exacto
  por `holder_name` que duplicaba ante variantes de orden/tildes/apodos.
  IDENT-1: `getOrCreateSharedTransferAccount(workspaceId)` y `getOrCreateSharedCashAccount(workspaceId)`
  buscan/crean (lazy) el **único** medio "Transferencia"/"Efectivo" **compartido** del workspace
  (`owner_member_id NULL` + `holder_name = ''`); la persona de cada movimiento va en
  `transactions.owner_member_id`, no en el medio (así se reemplaza el "uno por persona"). Sin React.
- `hooks.ts` — react-query: `useAccounts(workspaceId)` (se reutilizará en el alta de movimientos,
  B8), `useMembersForHolder`, `useCreateAccount`, `useUpdateAccount`, `useUpdateHolderAliases`
  (MEJ-4), `useGetOrCreateTransferAccount` (F2-11) y los compartidos de IDENT-1
  `useGetOrCreateSharedTransferAccount` / `useGetOrCreateSharedCashAccount` (todos invalidan
  `accounts` al crear).
- `schema.ts` — zod del form: `name`, `bank`, `network`, `type` (incluye `'transfer'`, F2-11),
  `currency`, `last4`, `holderKind` (`member` | `name`) + `ownerMemberId`/`holderName` según
  corresponda, `isExtension` + `parentAccountId` si aplica, `billingCloseDay`.
- `index.ts` — barrel del feature.
- `format.ts` / `format.test.ts` — `accountLabel(account)`: etiqueta para los combos de medios
  (banco · red · ••últimos4 · (primeras 5 letras del dueño); cae al nombre si no hay datos de
  tarjeta, ej. efectivo), para distinguir tarjetas y titular/extensión. Excepción (F2-11): el medio
  `'transfer'` también agrega el dueño sin tener datos de tarjeta —si no, varias personas verían el
  mismo "Transferencia" en el combo, sin forma de distinguirlas—. También `accountDisplayName({name,
  bank})` (BUG-14): para listas/filtros que muestran el `name` crudo, antepone el banco si está
  seteado y el nombre no lo incluye (así un banco editado se ve aunque el `name` haya quedado
  congelado del alta por resumen; no pisa nombres que ya lo contienen). Pura.
- `components/AccountList.tsx` — lista plana de medios (extensiones como fila propia, marcadas);
  muestra el form de alta/edición solo si el usuario es owner/admin (`useMyRole`).
- `components/AccountForm.tsx` — alta/edición de un medio: resuelve `owner_member_id` (si el
  holder es un miembro) u `holder_name` (si es "otra persona"), y exige `parent_account_id`
  cuando `isExtension` está activo. Acepta `defaults?` para precargar valores en modo alta (lo
  usa el alta inline desde la importación de resúmenes, F2-5). `TYPE_LABELS` incluye
  `transfer: 'Transferencia'` (F2-11; el alta normal vía este form sigue existiendo, pero el flujo
  de transferencias del form de movimientos crea ese medio solo, sin pasar por acá).

## Fuera de alcance (ver ticket B7)

- Total gastado por medio en el período (FR-6): depende de `transactions` (C11); se deja para
  cuando exista esa lógica.
- **Holder por `owner_member_id` (hecho, IDENT-1/BUG-17):** `AccountList` muestra el nombre **vivo**
  del miembro (vía `member_directory`) cuando el medio tiene `owner_member_id`, y cae a `holder_name`
  solo si no hay miembro asociado. Así cambiar el nombre del perfil se refleja sin duplicar persona.

## Relacionados

- `features/workspaces` (`useMyRole`) — gating de owner/admin en el front (la seguridad real la
  garantiza RLS: `acc_write` en `db/schema_fase1.sql`).
- `useAccounts` se reutiliza en el alta de movimientos (`features/transactions`, B8).
