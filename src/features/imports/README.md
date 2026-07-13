# features/imports

Importación de resúmenes de tarjeta (PDF) → revisión → creación de movimientos en bloque.

**FR que implementa:** **FR-16** (parseo de resúmenes con staging y confirmación), **FR-17**
(dedupe) y **FR-16b** (identificar/crear el medio desde el resumen). Layouts: **Banco Patagonia
Visa/Master** (tabular) y **Nativa-Nación** (Mastercard).

## Diseño

El staging es **efímero en el front** (no hay tabla en la DB): se sube el PDF, el microservicio
de ingesta (`services/ingesta`, vía `lib/ingesta`) devuelve las filas agrupadas por tarjeta, se
revisan/editan en memoria y se confirman **todas de una**, creando los `transactions`
(`source='statement_import'`). Si se recarga la página antes de confirmar, se vuelve a subir el PDF.

## Archivos

- `api.ts` — toca Supabase: `parseStatementFile(file, password?)` (saca el token y llama al micro;
  la password no se persiste), `confirmStatementImport(workspaceId, file, rows, chargedOn)` (sube el
  PDF a `attachments` `kind='statement'` y crea los movimientos en bloque con `installment_n/total`,
  `charged_on` = cierre del resumen, `attachment_id`).
- `hooks.ts` — `useParseStatement` (parseo, no escribe) y `useConfirmImport` (crea en bloque e
  invalida la lista de movimientos).
- `staging.ts` — lógica PURA del staging editable: `buildStagingModel` (parseo → modelo editable;
  solo los **pagos de tarjeta** van destildados, los consumos y **reintegros** quedan tildados; si se
  pasan categorías, precarga la **categoría sugerida** por comercio con `lib/category-suggest`, F2-6),
  `isRowValid`, `countSelected`, `toImportRows` (modelo → inputs; convierte fecha DD/MM/AAAA→ISO y
  exporta los **reintegros como gasto negativo** para que neteen el total — requiere la migración 0008).
- `staging.test.ts` — tests de la lógica pura (destildado de pagos, conteo, conversión, exclusión
  de filas inválidas).
- `components/StatementImport.tsx` — flujo completo: subir PDF + password → revisar por tarjeta
  (elegir/crear medio, editar/destildar filas) → confirmar. Al cargar, asocia cada tarjeta al medio
  que matchea (`lib/account-match`); si no hay, ofrece crearlo. IDENT-1: al precargar el alta de esa
  tarjeta, si el titular del resumen matchea a un miembro por nombre o **alias** (`matchMember` +
  `member_directory.aliases`), la tarjeta queda como **suya** (`owner_member_id`) en vez de un nombre
  suelto → los gastos se atribuyen a esa persona (y reconoce variantes del nombre entre resúmenes). La
  sección de impuestos/cargos al pie (`isResidualHint`, BUG-5) se muestra como grupo sin medio: no
  ofrece ni autoabre el alta de medio. Mapea errores del micro (401/422/sin URL). Guards anti
  doble-submit en `handleParse`/`handleConfirm` (BUG-9).
- `components/StatementImport.test.tsx` — verifica el guard anti doble-submit del parseo (BUG-9).
- `components/StagingRow.tsx` — fila editable (incluir, fecha, descripción, monto, categoría;
  muestra cuota y marca pago/devolución).
- `components/AccountQuickCreate.tsx` — alta inline de un medio (F2-5, FR-16b): reusa el
  `AccountForm` de B7 precargado con los `defaults` que le pasa quien llama; soporta crear
  extensiones ligadas a su titular. Exportado en el barrel para que otras features lo reusen.
  (El medio `'transfer'` de una transferencia ya no pasa por acá: desde F2-11 se busca/crea lazy
  vía `getOrCreateTransferAccount`, `features/accounts`.)
- `index.ts` — barrel del feature.

## Dedupe (FR-17, F2-4)

Cada fila lleva un `external_hash` (`lib/dedupe`). Al cargar el staging se consulta cuáles ya
existen en la DB (`findExistingHashes`) y se marcan como **"ya importado"** (destildados; el usuario
puede re-tildar para forzar). Al confirmar se filtran de nuevo (los ya existentes y los repetidos del
mismo lote) y se persiste `external_hash`, así reimportar el mismo resumen no duplica.

## Match/alta de medio (FR-16b, F2-5)

Al cargar el staging, cada tarjeta del resumen se matchea contra los medios del workspace con
`lib/account-match` (`matchAccount`): fuerte por `last4` + red, o por titular + banco cuando el
resumen no trae `last4` (ej. Nativa). Si hay match, el medio queda asociado; si no, el usuario lo
elige del combo o lo crea inline (`AccountQuickCreate`, precargado por este feature con
`accountDefaultsFromHint` antes de pasarle los `defaults`).
Si una tarjeta no matchea, el alta inline se **abre sola** precargada. El combo de medios muestra
banco · red · ••últimos4 · (dueño) (`accounts/format.accountLabel`).

**Importante (anti-falsa-asociación):** el auto-match por titular (sin `last4`, ej. Nativa) exige
que el **banco coincida en ambos lados**; nunca asocia un resumen a una tarjeta de **otro banco**
(ni a una sin banco) por mero parecido de nombre. Por eso el parser fija el banco desde el
encabezado del resumen (Nativa-Nación lo detecta por "Nativa"/"Nación"/CUIT). Sin certeza de
banco, la tarjeta queda como **candidato** para que el usuario elija, no como match automático.
