# src/features/transactions

Alta/edición de movimientos (ingresos y gastos), multi-moneda, con la persona deducida del medio,
y el resumen/lista del dashboard mensual.
Implementa **FR-7, FR-7b, FR-8, FR-9, FR-10** (PRD §5.3): alta manual con tipo, monto+moneda,
motivo, categoría, medio, fecha y fecha de cobro opcional, sin selector de persona, y comprobante
adjunto opcional. También **FR-20, FR-21** (PRD §5.6): resumen mensual y últimos movimientos.

## Archivos

- `api.ts` — Supabase: `listTransactions` (del workspace, sin filtros — ver B10; incluye
  `account.holder_name` además de `account.name` para mostrar la persona en `RecentTransactions`),
  `createTransaction` (`source = 'manual'`, `created_by = auth.uid()`), `updateTransaction`,
  `deleteTransaction`, `uploadAttachment` (sube el archivo al bucket privado `attachments` y crea su
  fila) y `getAttachmentUrl` (signed URL temporal para mostrarlo/descargarlo). Sin React.
- `hooks.ts` — react-query: `useTransactions`, `useCreateTransaction`, `useUpdateTransaction`,
  `useDeleteTransaction`, `useUploadAttachment`.
- `schema.ts` — zod del form: `type`, `amount`, `currency`, `description`, `categoryId`,
  `accountId`, `occurredOn` (default hoy), `chargedOn`, `attachment` (`FileList` opcional).
- `index.ts` — barrel del feature.
- `components/TransactionForm.tsx` — alta/edición rápida: foco automático en el monto, categorías
  filtradas por tipo (gasto/ingreso) vía `useCategories`, medios vía `useAccounts`. La persona NO
  se elige: se deduce del `account_id` (su holder) en reportes/listas, no en este form. El archivo
  elegido se entrega al `onSubmit` (no se sube dentro del form, que no tiene lógica de datos); quien
  lo use decide cuándo subirlo (ver `TransactionsPage`/`DashboardPage`).
- `components/TransactionForm.test.tsx` — smoke test: monto > 0, moneda de 3 letras, fecha de hoy
  por defecto.
- `components/SummaryCard.tsx` — resumen del período (ingresos/gastos/balance) desglosado por
  moneda (B9). Si hay más de una moneda, aclara que el consolidado en la moneda base del workspace
  llega con la conversión FX (C11/C12); por ahora `DashboardPage` solo filtra por mes y pasa los
  movimientos, sin consolidar.
- `components/RecentTransactions.tsx` — últimos N movimientos del período con persona (holder del
  medio), medio y fecha (B9). Link "Ver todos" a `/movimientos`.
- `format.ts` — `formatAmount(value, currency)`: formato de moneda (`Intl.NumberFormat`) compartido
  por `SummaryCard` y `RecentTransactions`, sin conversión entre monedas (B9).

## Fuera de alcance (ver tickets B8/B9)

- Lista con filtros/búsqueda (FR-11): es B10. `listTransactions` no tiene filtros todavía;
  `src/app/TransactionsPage.tsx` solo muestra una lista simple para poder probar/editar/eliminar, y
  `DashboardPage` filtra por mes en el cliente (`occurred_on` vs. `useActiveMonth`).
- OCR del comprobante (fase 2, FR-14): solo se guarda el archivo.
- Conversión a moneda base (`amount_base`/`fx_rate`) y gráficos: los calcula C11/C13; acá solo se
  guarda y muestra el monto y moneda original, agrupado por moneda.

## Relacionados

- `features/categories` (`useCategories`) y `features/accounts` (`useAccounts`) — opciones del form.
- `features/workspaces` (`useMyRole`) y `features/auth` (`useAuth`) — en `TransactionsPage`, para
  mostrar Editar/Eliminar solo al autor o admin/owner (la seguridad real la garantiza RLS:
  `tx_update`/`tx_delete` en `db/schema_fase1.sql`).
- Bucket de Storage `attachments` (privado, RLS por workspace) — ver sección "STORAGE" de
  `db/schema_fase1.sql` y `supabase/migrations/0002_attachments_storage.sql`.
