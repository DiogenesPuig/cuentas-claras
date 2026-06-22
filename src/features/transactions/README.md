# src/features/transactions

Alta/edición de movimientos (ingresos y gastos), multi-moneda, con la persona deducida del medio,
el resumen/lista del dashboard mensual y la lista con filtros/búsqueda de `/movimientos`.
Implementa **FR-7, FR-7b, FR-8, FR-9, FR-10** (PRD §5.3): alta manual con tipo, monto+moneda,
motivo, categoría, medio, fecha y fecha de cobro opcional, sin selector de persona, y comprobante
adjunto opcional. También **FR-20, FR-21** (PRD §5.6): resumen mensual y últimos movimientos,
**FR-11** (PRD §5.3): filtrar/buscar movimientos por mes, persona, tarjeta, categoría, moneda y
texto, y **FR-23** (PRD §5.6): exportar a CSV el set de movimientos filtrado.

## Archivos

- `api.ts` — Supabase: `listTransactions` (del workspace, con los filtros de `filters.ts` aplicados
  en la query — mes como rango `occurred_on`, medio/categoría/moneda por igualdad, persona vía join
  `accounts!inner` filtrando `account.holder_name`, texto vía `ilike` sobre `description`; incluye
  `account.holder_name` y `account.bank` además de `account.name` para mostrar la persona/banco en
  listas/resumen/export), `createTransaction` (`source = 'manual'`, `created_by = auth.uid()`),
  `updateTransaction`, `deleteTransaction`, `uploadAttachment` (sube el archivo al bucket privado
  `attachments` y crea su fila) y `getAttachmentUrl` (signed URL temporal para mostrarlo/descargarlo).
  Sin React.
- `filters.ts` — `TransactionFilters` (mes, medio, categoría, moneda, persona, texto) y
  `buildTransactionFilterArgs`: función pura que mapea esos filtros a los argumentos de la query
  (rango `[occurredFrom, occurredTo)`, recorte de texto, etc.), sin tocar Supabase.
- `filters.test.ts` — tests de `buildTransactionFilterArgs`: mes→rango (incl. cruce de año),
  combinación con el resto de filtros, recorte/omisión de texto vacío.
- `hooks.ts` — react-query: `useTransactions(workspaceId, filters?)` (la query key incluye
  `filters`, así que cada combinación cachea por separado), `useCreateTransaction`,
  `useUpdateTransaction`, `useDeleteTransaction`, `useUploadAttachment`.
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
  llega con la conversión FX (C11/C12); por ahora `DashboardPage` solo filtra por mes (en la query,
  desde B10) y pasa los movimientos, sin consolidar.
- `components/RecentTransactions.tsx` — últimos N movimientos del período con persona (holder del
  medio), medio y fecha (B9). Link "Ver todos" a `/movimientos`.
- `components/FilterBar.tsx` — filtros combinables de `/movimientos`: persona, medio y categoría
  (selects a partir de `accounts`/`categories`) y moneda (texto libre de 3 letras, igual que en
  `TransactionForm`), con botón "Limpiar filtros" (B10).
- `components/SearchBar.tsx` — input de búsqueda por motivo; el debounce lo maneja quien la usa
  (`TransactionsPage`), el componente queda simple y controlado (B10).
- `components/TransactionList.tsx` — lista de movimientos ya filtrados con el total arriba y el
  estado vacío ("Sin movimientos para estos filtros") (B10).
- `components/TransactionRow.tsx` — fila de un movimiento: motivo/monto, persona·medio·fecha, y
  Editar/Eliminar si `canEdit` (extraído de `TransactionsPage` en B10 para reutilizar en la lista).
- `format.ts` — `formatAmount(value, currency)`: formato de moneda (`Intl.NumberFormat`) compartido
  por `SummaryCard`, `RecentTransactions` y `TransactionRow`, sin conversión entre monedas (B9).
  `formatInstallment(n, total)`: arma "Cuota N/M" para movimientos en cuotas, o `null` si no aplica (F2-0).
- `format.test.ts` — tests de `formatInstallment`: cuota válida, campos null (no es en cuotas) y datos
  incoherentes/no enteros (F2-0).
- `export.ts` — lógica pura de exportación (C14, FR-23), sin Supabase: `toExportRows` (mapea
  `TransactionView[]` ya filtrados a filas planas: fecha, se-cobra, tipo, monto, moneda, persona,
  medio, banco, categoría, descripción), `toCsv` (arma el CSV con encabezados en español, escapando
  comas/comillas/saltos de línea) y `downloadCsv` (dispara la descarga en el navegador con BOM UTF-8
  para que Excel reconozca los acentos).
- `export.test.ts` — tests de `toExportRows`/`toCsv`: mapeo completo, datos opcionales faltantes,
  tipo ingreso/gasto, encabezado y escape de campos con comas/comillas.
- `components/ExportButton.tsx` — botón "Exportar CSV" de `/movimientos`; usa el mismo set de
  movimientos ya filtrado que `TransactionList` (C14). Solo CSV, sin XLSX (ver "Por qué este
  modelo" en `tasks/done/C14-export.md`: evitar sumar una dependencia nueva sin escalar).

## Fuera de alcance (ver tickets B8/B9/B10/C14)

- XLSX nativo (requeriría sumar una librería, ej. SheetJS): no se agregó sin autorización; CSV
  cubre el criterio de aceptación de C14.
- Programar exportaciones automáticas: fuera de alcance de C14.
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
