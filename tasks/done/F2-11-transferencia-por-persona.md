# F2-11 Transferencia por persona: un medio "Transferencia" por miembro + banco en el movimiento

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet (con check de Opus por el cambio de esquema) · **Depende de:** F2-9, B7 · **Coordina con:** F2-10

## Objetivo
Reemplazar el alta de **un medio por persona+banco** (F2-9) por **un único medio `'transfer'` por persona**, auto-seleccionado por la precarga del comprobante. El banco deja de vivir en el medio (una persona transfiere desde varios bancos) y pasa a ser un **campo opcional del movimiento** (`transactions.bank`). Así: se mantiene la atribución por persona, no se llena la lista de medios, y queda registrado de qué banco salió cada transferencia.

## Contexto (decisión charla 2026-06-23)
- Hoy `transactions.account_id` **define la persona vía el `holder_name`/`owner_member_id` del medio** (no hay campo "pagador" en el movimiento). Por eso el medio sigue siendo el portador de la persona.
- F2-9 crea un medio `type='bank_account'` por persona **y banco** (`src/lib/transfer-account.ts` → `transferAccountDefaults`), con alta inline (`AccountQuickCreate`). Eso prolifera medios y mete el banco en el medio.
- Decisión: **un medio `'transfer'` por persona**; el OCR detecta el titular del lado dueño (gasto→origen, ingreso→destino), lo matchea a un miembro (`src/lib/member-match.ts`) y **selecciona/crea (lazy) ese medio**. El **banco** del comprobante va a `transactions.bank` (opcional, editable).
- Provisión **lazy**: el medio "Transferencia" de cada persona se crea la **primera vez** que se le atribuye una (no se pre-crean medios vacíos).

## Cambios de esquema (migraciones — deben quedar aplicadas en remoto, ver DoD del CLAUDE.md)
- `supabase/migrations/00NN_account_type_transfer.sql` → `ALTER TYPE account_type ADD VALUE 'transfer';` (aditivo, seguro). Ojo: un `ADD VALUE` no puede usarse en la misma transacción donde se crea; va en su propia migración.
- `supabase/migrations/00NN_transactions_bank.sql` → `ALTER TABLE transactions ADD COLUMN bank text;` (nullable). Comentario: banco del movimiento (hoy solo lo llena el flujo de transferencias).
- Regenerar `src/lib/database.types.ts` con `supabase gen types` (no editar a mano).

## Archivos a crear/editar
- `src/features/accounts/schema.ts` → sumar `'transfer'` a `ACCOUNT_TYPES`.
- `src/features/accounts/components/AccountForm.tsx` → label `transfer: 'Transferencia'` en `TYPE_LABELS`.
- `src/lib/transfer-account.ts` → `transferAccountDefaults` pasa a `type: 'transfer'`, **sin banco** (name fijo "Transferencia"); test acorde.
- `src/features/transactions/schema.ts` → campo `bank` opcional (string).
- `src/features/transactions/api.ts` → `TransactionInput`/`Transaction` con `bank`; persistir/leer la columna.
- `src/features/transactions/components/TransactionForm.tsx`:
  - Input "Banco (opcional)" precargado del `origin_bank`/`dest_bank` del OCR según el lado dueño.
  - Flujo transferencia: titular dueño → `matchMember` → buscar el medio `'transfer'` de ese miembro → seleccionarlo; si no existe, **crearlo solo** (lazy, sin el paso manual de F2-9) y seleccionarlo. Para titular **no miembro**, crear un medio `'transfer'` con `holder_name` (sin banco).
  - Reemplaza el bloque `AccountQuickCreate` para transferencias (queda para otros usos: F2-5).
- `src/features/accounts/api.ts` (o `hooks.ts`) → si hace falta, helper para "buscar/crear el medio transfer de un miembro" (en `api.ts`, no en el componente).
- READMEs de `accounts`, `transactions`, `lib`.

## Pasos
1. Migraciones (enum + columna), aplicar a remoto, regenerar tipos.
2. Esquema/labels del medio `'transfer'`; ajustar `transferAccountDefaults` (sin banco) + test.
3. `transactions`: campo `bank` end-to-end (schema → api → form), precargado del OCR.
4. Form: auto-seleccionar/crear (lazy) el medio `'transfer'` por persona; sacar el alta manual del flujo de transferencia.
5. Verificar atribución por persona y que el banco quede guardado en el movimiento.

## Criterios de aceptación
- [ ] Cargar un comprobante de transferencia **no exige crear un medio a mano**: se selecciona (o crea solo) el medio `'transfer'` de la persona detectada.
- [ ] Una persona tiene **un solo** medio `'transfer'`, reutilizado entre transferencias de distintos bancos.
- [ ] El **banco** del comprobante queda en `transactions.bank` (visible/editable en el form), no en el medio.
- [ ] La atribución por persona sigue funcionando (medio con `owner_member_id`/`holder_name`).
- [ ] Titular no-miembro: crea un medio `'transfer'` con su `holder_name`, sin romper.
- [ ] Migraciones aplicadas en remoto (`supabase migration list --linked`) y tipos regenerados.
- [ ] `typecheck`/`lint`/`test` ok.

## Coordinación con F2-10 (reportes)
- Con el banco en el movimiento, los reportes **por banco** deben leer `transactions.bank` para transferencias y `account.bank` para tarjetas. Dejar la dimensión "banco" coherente (alinear con `aggregate.ts`). Si F2-10 se hace antes, anotar el follow-up; si después, contemplarlo ahí.

## Fuera de alcance
- Migrar/limpiar los medios `bank_account` de transferencia ya creados por F2-9 (herramienta de merge/limpieza → mejora futura; documentar que conviven).
- Parsing universal del comprobante (F2-12).

## Tests
- `transfer-account.test.ts`: defaults `type='transfer'`, sin banco, name "Transferencia".
- Test del form (`TransactionForm.test.tsx`): con OCR de transferencia y un miembro que matchea → se selecciona su medio `'transfer'` sin pedir alta; el banco se precarga en el campo.

## Por qué este modelo
Sonnet ejecuta el grueso (form, schema, api) que está bien definido; **Opus revisa** por ser cambio de esquema (enum + columna) y por la coordinación con la dimensión "persona/banco" de reportes.
