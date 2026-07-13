# src/features/transactions

Alta/edición de movimientos (ingresos y gastos), multi-moneda, con la persona deducida del medio,
el resumen/lista del dashboard mensual y la lista con filtros/búsqueda de `/movimientos`.
Implementa **FR-7, FR-7b, FR-8, FR-9, FR-10** (PRD §5.3): alta manual con tipo, monto+moneda,
motivo, categoría, medio, fecha y fecha de cobro opcional, sin selector de persona, y comprobante
adjunto opcional. También **FR-20, FR-21** (PRD §5.6): resumen mensual y últimos movimientos,
**FR-11** (PRD §5.3): filtrar/buscar movimientos por mes, persona, tarjeta, categoría, moneda y
texto, **FR-23** (PRD §5.6): exportar a CSV el set de movimientos filtrado, y **FR-10/FR-13**
(PRD §5.4/§5.6): ver el comprobante adjunto de un movimiento (F2-7).

## Archivos

- `api.ts` — Supabase: `listTransactions` (del workspace, con los filtros de `filters.ts` aplicados
  en la query — mes como rango `occurred_on`, medio/categoría/moneda por igualdad, persona vía join
  `accounts!inner` filtrando `account.holder_name`, texto vía `ilike` sobre `description`; incluye
  `account.holder_name` y `account.bank` además de `account.name` para mostrar la persona/banco en
  listas/resumen/export), `createTransaction` (`source = input.source ?? 'manual'` — `'ocr'` si el
  alta se precargó desde un comprobante; `created_by = auth.uid()`; `TransactionInput` incluye
  `bank` —F2-11, banco del movimiento, hoy solo lo llena el flujo de transferencias—),
  `updateTransaction`, `deleteTransaction`, `uploadAttachment` (sube el archivo al bucket privado
  `attachments` y crea su fila — guarda además `content_hash` SHA-256 del archivo para F2-13),
  `getAttachment` (resuelve `file_url`/`file_type` desde un `attachment_id`, F2-7), `getAttachmentUrl`
  (signed URL temporal para mostrarlo/descargarlo), `extractReceiptData` (F2-1/F2-2: saca el access
  token de la sesión y llama al micro de ingesta vía `lib/ingesta` para precargar monto/fecha/comercio
  — es la capa que toca Supabase; el HTTP es puro) y `findDuplicateCandidates` (F2-13: busca
  movimientos del workspace con mismo monto+moneda en la ventana de fecha y/o mismo `content_hash` de
  comprobante, y delega el motivo a `lib/duplicate-detect`). Sin React.
- `filters.ts` — `TransactionFilters` (mes, medio, categoría, moneda, persona, texto) y
  `buildTransactionFilterArgs`: función pura que mapea esos filtros a los argumentos de la query
  (rango `[occurredFrom, occurredTo)`, recorte de texto, etc.), sin tocar Supabase. El centinela
  `NO_ACCOUNT_FILTER` ("Sin medio") mapea a `accountIsNull` → `account_id IS NULL` en la query, para
  poder listar los movimientos sin medio (BUG-13, que si no quedaban inencontrables por el `!inner`).
- `filters.test.ts` — tests de `buildTransactionFilterArgs`: mes→rango (incl. cruce de año),
  combinación con el resto de filtros, recorte/omisión de texto vacío.
- `hooks.ts` — react-query: `useTransactions(workspaceId, filters?)` (la query key incluye
  `filters`, así que cada combinación cachea por separado), `useCreateTransaction`,
  `useUpdateTransaction`, `useDeleteTransaction`, `useUploadAttachment`, `useExtractReceipt`
  (OCR de un comprobante vía `extractReceiptData`/el micro de ingesta, no escribe en la DB — F2-2),
  `useFindDuplicateCandidates` (F2-13: busca duplicados on-demand al confirmar el alta),
  `useAttachmentUrl(attachmentId, enabled)` (F2-7: pide `getAttachment` + `getAttachmentUrl` solo
  cuando `enabled` es true —al abrir el visor, no al render de la lista—; `staleTime` algo por
  debajo de los 5 min de la signed URL para no servir desde caché una URL ya vencida; `retry: false`
  porque el reintento ante una URL vencida lo dispara el usuario desde `AttachmentViewer`).
- `schema.ts` — zod del form: `type`, `amount`, `currency`, `description`, `categoryId`,
  `accountId`, `ownerMemberId` (IDENT-1: persona del movimiento, opcional; "Según el medio" = null),
  `bank` (F2-11, opcional), `occurredOn` (default hoy), `chargedOn`, `attachment`
  (`FileList` opcional). Las fechas se editan/validan como **DD/MM/YYYY** y se convierten a ISO al
  guardar (`displayToIsoDate`).
- `index.ts` — barrel del feature.
- `components/TransactionForm.tsx` — alta/edición rápida: foco automático en el monto, categorías
  filtradas por tipo (gasto/ingreso) vía `useCategories`, medios vía `useAccounts`. **IDENT-1:** un
  selector **"Persona (opcional)"** atribuye el movimiento a un miembro/placeholder
  (`owner_member_id`); "Según el medio" (vacío) = se deduce del medio en reportes/listas. Con
  `onCreatePerson` (solo owner/admin) ofrece **"+ Persona"** para crear una persona del grupo
  (placeholder) inline y seleccionarla. El archivo
  elegido se entrega al `onSubmit` (no se sube dentro del form, que no tiene lógica de datos); quien
  lo use decide cuándo subirlo (ver `TransactionsPage`/`DashboardPage`). Si recibe `onExtractReceipt`,
  muestra el botón "Extraer datos del comprobante" que llama al OCR y precarga monto/moneda/fecha/comercio
  (editables), avisando si la confianza es baja o si no se pudo extraer; al guardar un alta así, marca
  `source = 'ocr'` (FR-14). Sin la prop (o sin `VITE_INGESTA_URL`), el alta sigue 100% manual.
  Si el gasto no tiene categoría, muestra una **sugerencia** por descripción (`lib/category-suggest`,
  F2-6) con un botón "Usar" (nunca se aplica sola). El combo de medios muestra
  banco · red · ••últimos4 · (dueño) (`accounts/format.accountLabel`) para distinguir tarjetas.
  Si el comprobante extraído es de una **transferencia** (`origin_holder/bank`, `dest_holder/bank`
  del OCR, F2-8), determina el lado dueño **según el tipo** (F2-9): gasto → origen (quien envía),
  ingreso → destino (quien recibe) (`lib/transfer-account`). El banco del lado dueño se precarga en
  el campo "Banco" del movimiento (editable). **IDENT-1:** asigna el medio **"Transferencia"
  compartido** del workspace (uno solo, `useGetOrCreateSharedTransferAccount`) y **prefilla la
  persona** en el campo "Persona" si el titular matchea a un miembro/placeholder (`lib/member-match`);
  si nadie matchea, la persona queda en "Según el medio" (vacío) para que el usuario la elija. La
  persona va en el movimiento (`owner_member_id`), no en el medio (se acabó el medio `'transfer'` por
  persona de F2-11). Pagos institucionales (BUG-5): sin medio ni persona.
  **Efectivo compartido (IDENT-1):** el selector de medio ofrece la opción **"Efectivo"** que
  crea/reusa (lazy, `useGetOrCreateSharedCashAccount`) el **único** medio efectivo del workspace y lo
  asigna; quién pagó va en el selector de persona. Mientras se crea, el submit espera (no guarda el
  centinela). Una vez creado aparece como un medio normal y el centinela desaparece.
  Requiere `workspaceId`/`members` (opcionales; sin ellos, no se ofrece la atribución automática).
  Si recibe `onCheckDuplicates` (F2-13), antes de crear un alta **nueva** calcula el hash del archivo
  (`lib/file-hash`) y busca candidatos; si los hay, muestra un **aviso suave** ("Ya subiste este
  comprobante" / "Hay un movimiento parecido") con **"Guardar igual" / "Cancelar"** — nunca bloquea.
  En **edición** no se chequea. Si el chequeo falla (red), no frena el alta.
- `components/TransactionForm.test.tsx` — smoke test: monto > 0, moneda de 3 letras, fecha de hoy
  por defecto, precarga de OCR.
- `components/SummaryCard.tsx` — resumen del período (ingresos/gastos/balance) desglosado por
  moneda (B9). Si hay más de una moneda, aclara que el consolidado en la moneda base del workspace
  llega con la conversión FX (C11/C12); por ahora `DashboardPage` solo filtra por mes (en la query,
  desde B10) y pasa los movimientos, sin consolidar.
- `components/RecentTransactions.tsx` — últimos N movimientos del período con persona (holder del
  medio), medio y fecha (B9). Link "Ver todos" a `/movimientos`.
- `components/FilterBar.tsx` — filtros combinables de `/movimientos`: persona, medio y categoría
  y moneda (texto libre de 3 letras, igual que en `TransactionForm`), con botón "Limpiar filtros"
  (B10). El select de medio tiene la opción **"Sin medio"** (`NO_ACCOUNT_FILTER`, BUG-13) y muestra
  los medios con `accountDisplayName` (BUG-14). **IDENT-1:** el filtro **"Persona"** ya no agrupa por
  `holder_name`: recibe `personaOptions` por **miembro** (nombre vivo, vía `lib/persona`) que arma
  `TransactionsPage`, y el filtrado es client-side (`personaKey`), no en la query — arregla el síntoma
  del filtro de BUG-17.
- `components/SearchBar.tsx` — input de búsqueda por motivo; el debounce lo maneja quien la usa
  (`TransactionsPage`), el componente queda simple y controlado (B10).
- `components/TransactionList.tsx` — lista de movimientos ya filtrados con el total arriba y el
  estado vacío ("Sin movimientos para estos filtros") (B10).
- `components/TransactionRow.tsx` — fila de un movimiento: motivo/monto, persona·medio·fecha, y
  Editar/Eliminar si `canEdit` (extraído de `TransactionsPage` en B10 para reutilizar en la lista).
  Si el movimiento tiene `attachment_id`, muestra debajo el `AttachmentViewer` (F2-7).
- `attachment.ts` — lógica pura (F2-7): `attachmentViewerMode(fileType)` mapea `file_type`
  (`'image'` | `'pdf'` | cualquier otro valor inesperado, que cae a `'pdf'`) al modo de render del
  visor, sin tocar Supabase.
- `attachment.test.ts` — tests de `attachmentViewerMode`: imagen, pdf y valor inesperado.
- `components/AttachmentViewer.tsx` — visor de un comprobante (F2-7, FR-10/FR-13): botón
  "Ver comprobante" que recién al abrirse pide la signed URL (`useAttachmentUrl`, on-demand, no al
  render de la lista); imagen → `<img>` inline con `alt`; PDF → link "Ver/Descargar PDF" que abre en
  pestaña nueva. Si la signed URL venció, muestra error y un botón "Reintentar" (`refetch`). No se
  renderiza si el movimiento no tiene `attachment_id` (lo decide `TransactionRow`).
- `components/AttachmentViewer.test.tsx` — tests con `../hooks` mockeado: no pide la URL hasta
  abrir el visor, imagen inline, link de PDF, reintentar tras error.
- `format.ts` — `formatAmount(value, currency)`: formato de moneda (`Intl.NumberFormat`) compartido
  por `SummaryCard`, `RecentTransactions` y `TransactionRow`, sin conversión entre monedas (B9).
  `formatInstallment(n, total)`: arma "Cuota N/M" para movimientos en cuotas, o `null` si no aplica (F2-0).
  `isoToDisplayDate`/`displayToIsoDate`: convierten entre ISO (`YYYY-MM-DD`, lo que guarda la DB) y el
  formato de display DD/MM/YYYY que usa el form; `''` si la entrada es inválida o la fecha no existe.
- `format.test.ts` — tests de `formatInstallment` (cuota válida, campos null, datos incoherentes — F2-0)
  y de `isoToDisplayDate`/`displayToIsoDate` (conversión, formato inválido, fecha inexistente, roundtrip).
- `totals.ts` / `totals.test.ts` (MEJ-13) — `sumByType(transactions)`: suma el set ya filtrado **por
  moneda** (sin FX), separando gastos de ingresos; conserva el signo (reintegros negativos) y ordena las
  monedas. Pura. La usa `TransactionList` para el total arriba de la lista (se recalcula al cambiar filtros).
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
