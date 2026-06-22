# features/imports

Importación de resúmenes de tarjeta (PDF) → revisión → creación de movimientos en bloque.

**FR que implementa:** **FR-16** (parseo de resúmenes con staging y confirmación). Layout
objetivo: **Banco Patagonia Visa/Master** (tabular). Nativa-Nación (coordenadas) → F2-3b.

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
  solo los **pagos de tarjeta** van destildados, los consumos y **reintegros** quedan tildados),
  `isRowValid`, `countSelected`, `toImportRows` (modelo → inputs; convierte fecha DD/MM/AAAA→ISO y
  exporta los **reintegros como gasto negativo** para que neteen el total — requiere la migración 0008).
- `staging.test.ts` — tests de la lógica pura (destildado de pagos, conteo, conversión, exclusión
  de filas inválidas).
- `components/StatementImport.tsx` — flujo completo: subir PDF + password → revisar por tarjeta
  (elegir medio, editar/destildar filas) → confirmar. Mapea errores del micro (401/422/sin URL).
- `components/StagingRow.tsx` — fila editable (incluir, fecha, descripción, monto, categoría;
  muestra cuota y marca pago/devolución).
- `index.ts` — barrel del feature.
