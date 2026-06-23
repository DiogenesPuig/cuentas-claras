# F2-9 Medio de transferencia desde el comprobante + atribución a la persona

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet (escalar a Opus si aparece ambigüedad de match) · **Depende de:** F2-8, F2-2, B7, B8

## Objetivo
Al cargar un **comprobante de transferencia** (OCR de F2-2), detectar/crear el **medio bancario** (`type='bank_account'`, sin red ni last4) y atribuir el movimiento a la **persona correcta según el tipo**: en un **gasto** la cuenta del miembro es el **origen** (quien envía); en un **ingreso** es el **destino** (quien recibe). Si el titular de ese lado coincide con un miembro del workspace, **preasignar `owner_member_id`** (editable). Reusa el alta inline de medio de F2-5.

## Contexto (links a docs)
- Decisiones (charla 2026-06-23): atribución **según tipo** (gasto→origen, ingreso→destino); **preasignar al miembro, editable**.
- `db/schema_fase1.sql` → `accounts`: `type account_type` ya incluye **`bank_account`** y `wallet` (no hace falta migración). `network`/`last4` quedan `null`. `owner_member_id` (miembro) **o** `holder_name` (texto libre).
- `account_type` enum: `('credit','debit','cash','wallet','bank_account')`.
- F2-8 agrega al OCR: `origin_holder/origin_bank/dest_holder/dest_bank`.
- F2-2: `src/features/transactions/components/TransactionForm.tsx` ya precarga monto/fecha/comercio desde el OCR (botón "Extraer datos del comprobante"); `source='ocr'` al guardar.
- F2-5: `src/features/imports/components/AccountQuickCreate.tsx` (alta inline reusando `AccountForm`) y `src/lib/account-match.ts` (`accountDefaultsFromHint`). `AccountForm` acepta `defaults?`.
- `src/features/accounts/api.ts` → `listMembersForHolder` (miembros vía `member_directory`).
- Portabilidad: nada de Supabase fuera de `api.ts`; el match titular→miembro es **lógica pura** en `lib/`.

## Archivos a crear/editar
- `src/lib/member-match.ts` + `.test.ts` (nuevo) — `matchMember(name, members)`: match por **token-set** (orden de nombre indistinto, ≥2 tokens significativos; ante varios, ninguno), devuelve el miembro o `null`. Puro (no conoce Supabase). Reutiliza la normalización de `account-match.ts` (o se extrae a un helper común).
- `src/features/transactions/` → enganchar en el flujo de alta por comprobante: cuando el OCR es de transferencia, elegir el lado (origen/destino) **según el tipo gasto/ingreso**, ofrecer **crear el medio bank_account** precargado (banco del lado elegido, `holderName` = titular del lado) y, si `matchMember` da miembro, preasignarlo (`owner_member_id`) dejándolo editable. La contraparte va como **descripción** sugerida.
- Reusar `AccountQuickCreate`/`AccountForm` (no duplicar el alta).
- READMEs de `transactions` y `lib`.

## Pasos
1. En el alta por comprobante, si subtipo transfer: determinar el lado dueño por tipo (gasto→origen, ingreso→destino).
2. Construir defaults del medio: `type='bank_account'`, `bank=<lado>.bank`, `network=null`, `last4=null`, `holderName=<lado>.holder`, nombre tipo `"Transferencia <Banco>"`.
3. Buscar medio existente (mismo banco + titular del lado, sin last4 → criterio de `matchAccount` por titular+banco, que **ya no cruza bancos**). Si existe, asociar; si no, ofrecer crear precargado.
4. `matchMember(<lado>.holder, members)` → si hay miembro, preasignar `owner_member_id` (editable); si no, queda `holder_name` libre.
5. Sugerir la contraparte como descripción del movimiento.

## Criterios de aceptación
- [ ] Un comprobante de transferencia como **gasto** crea/asocia el medio del **origen** y atribuye a esa persona; como **ingreso**, usa el **destino**.
- [ ] Si el titular del lado dueño coincide con un miembro, el medio queda ligado a `owner_member_id` (preseleccionado, **editable**); si no, usa `holder_name`.
- [ ] El medio es `type='bank_account'` con `network`/`last4` nulos; sin migración de esquema.
- [ ] No se crea un medio duplicado si ya existe uno del mismo banco+titular (reusa `matchAccount`).
- [ ] `matchMember` es puro y tolera nombre en orden invertido; con ambigüedad no preasigna.
- [ ] `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- Extracción de origen/destino en el micro (F2-8).
- Dedup de personas en **reportes** por `owner_member_id` (F2-10).
- Conciliación "quién le debe a quién" (fase posterior).

## Tests
- `member-match.test.ts`: match por apellido+nombre vs nombre+apellido; ≥2 tokens; ambigüedad → `null`; sin miembros → `null`.
- Lado dueño según tipo (gasto/ingreso) — lógica pura testeable.

## Por qué este modelo
Sonnet: integra piezas ya existentes (OCR de F2-2, alta inline de F2-5, match puro) sobre un contrato definido. Escalar a Opus solo si el criterio de match titular→miembro resulta ambiguo en muestras reales.
