# IDENT-1 Persona en el movimiento (modelo unificado de identidad)

**Sprint:** Identidad · **Modelo sugerido:** Opus (diseño — CERRADO acá) → Sonnet (implementar por partes) · **Depende de:** MEJ-4 Parte A (alias, ya hecho)

> **Ticket maestro** del rediseño de identidad. **Absorbe** MEJ-4 Parte B (persona sin cuenta),
> MEJ-12 (efectivo), la "Transferencia única" (charla 2026-07-09) y arregla BUG-17 (cambiar el
> nombre no se refleja en Medios). Diseño cerrado con el usuario el 2026-07-09.

## Progreso (rama `task/ident-1-persona-en-movimiento`)
- ✅ **Paso 1 — fundación del modelo** (migración 0018, aplicada en LOCAL, sin backfill):
  `transactions.owner_member_id`; `workspace_members.user_id` nullable + `name`; `member_directory`
  con placeholders (LEFT join, `member_id`); trigger de mismo-workspace. Aditivo → sin cambio de
  comportamiento. Tipos/schema al día; typecheck/lint/test/build verdes. **Migración NO aplicada a
  remoto todavía** (recién al final, con todo probado).
- ✅ **Paso 2 — resolución de persona (nombre vivo):** `personaIdentity` (reports) ahora lee
  `tx.owner_member_id` primero (persona del movimiento manda), luego el medio; `listMembersForHolder`
  sale de `member_directory` (`member_id` + nombre vivo, incluye placeholders); `AccountList` muestra
  el nombre vivo del miembro → **arregla el síntoma principal de BUG-17** (la lista de Medios). Sin
  cambio de comportamiento aún para transferencias (no hay `owner_member_id` en datos hasta el backfill).
- ✅ **Paso 3a — plomería + selector de persona en el alta:** `transactions.owner_member_id` viaja por
  `TransactionInput`/`toRow`/schema/form; campo "Persona (opcional)" ("Según el medio" = null, o un
  miembro/placeholder de `members`) que escribe `owner_member_id`. Aditivo/seguro (no reemplaza aún el
  flujo de transferencia por-persona).
- ✅ **Paso 3b — "Transferencia" compartida:** `getOrCreateSharedTransferAccount` (UN medio 'transfer'
  por workspace) + hook; el flujo del alta asigna ese medio y **prefilla la persona** (matchMember →
  miembro/placeholder), sin match queda vacía para elegir. Se eliminó el flujo per-persona
  (`getOrCreateTransferAccount`/`matchTransferAccount`) y el prompt de alias de MEJ-4A del alta.
  **Reemplaza "muchas Transferencia" por una sola.** _Nota: los movimientos VIEJOS siguen en sus
  medios transfer por-persona hasta el backfill (paso 5); ahí conviven, pero reportes resuelven bien
  (por `account.owner_member_id`)._
- ✅ **Paso 3c — crear placeholder desde el alta:** `createPlaceholderMember` (workspaces, RLS
  owner/admin: fila `workspace_members` con `user_id NULL` + nombre) + `useCreatePlaceholderMember`
  (invalida las 2 listas de miembros). El selector de persona muestra **"+ Persona"** (solo owner/admin
  vía prop `onCreatePerson`): crea el placeholder y lo selecciona. Aviso bajo el selector cuando una
  transferencia no reconoce a la persona. Tests: alta con persona; crear persona.
- ✅ **Paso 3d — filtro "Persona" de `/movimientos` por miembro:** se extrajo `lib/persona`
  (`personaKeyOf`/`personaLabelOf`, puro, testeado) que resuelve la persona por movimiento→medio→holder
  con el nombre **vivo** del miembro; `reports/aggregate.personaIdentity` ahora delega ahí (cero cambio
  de comportamiento). El movimiento trae `account.owner_member_id` en el select. El filtro dejó de ser
  server-side por `holder_name` (`!inner`): ahora `FilterBar` recibe `personaOptions` basadas en miembro
  y `TransactionsPage` filtra en el cliente con `personaKeyOf` → **arregla el síntoma del filtro de
  BUG-17** (nombres vivos, sin duplicar). Tests: `lib/persona.test.ts`.
- ✅ **Paso 3e — Efectivo compartido:** `getOrCreateSharedCashAccount` (UN medio `'cash'` por
  workspace, `owner_member_id NULL` + `holder_name ''`) + `useGetOrCreateSharedCashAccount`. En el
  alta, el selector de medio ofrece la opción **"Efectivo"** (centinela) que crea/reusa el medio lazy
  al elegirla y lo asigna; quién pagó va en el selector de persona. El submit espera mientras se crea
  (no guarda el centinela). Una vez creado, es un medio normal y el centinela desaparece. Test del
  flujo (centinela → crea → asigna). Mismo patrón que la transferencia compartida (3b).
- ✅ **Paso 4 — alias en la persona:** `workspace_members.aliases` (migración 0019, aplicada en LOCAL)
  + backfill desde `accounts.holder_aliases` de los medios con `owner_member_id`; `member_directory`
  expone `aliases`. `matchMember` ahora considera los alias del miembro (match exacto de clave contra
  un alias es autoritativo aunque sea de 1 palabra, ej. "Pepito") → los alias dejan de perderse en el
  flujo de transferencia compartida. Edición movida del medio a la **persona**: `updateMemberAliases`
  (workspaces, RLS owner/admin) + `MemberAliasesEditor` en `/grupo`; se quitó el `HolderAliasesEditor`
  del medio. `accounts.holder_aliases` queda como dato legacy hasta el colapso del paso 5 (los alias
  de titulares **no-miembros** se moverán ahí, al crear su placeholder). Tests de `matchMember` (+5).
  **Migración NO aplicada a remoto todavía** (junto con el resto, al final).
- ✅ **Paso 4b — resúmenes atribuyen a la persona (opción A, charla 2026-07-10):** al importar un
  resumen, si el titular de una tarjeta matchea a un miembro por nombre o **alias** (`matchMember` con
  los alias del paso 4), el alta inline de esa tarjeta se precarga como **suya** (`owner_member_id`) en
  vez de un nombre suelto → los gastos quedan atribuidos a esa persona y se reconocen variantes del
  nombre entre resúmenes (ej. "DIEGO TORRES" / "TORRES MARCO DIEGO"). Enganche en
  `StatementImport.defaultsFromHint`; los resúmenes recurrentes de la misma tarjeta ya matcheaban por
  `last4`. Sin match → nombre del resumen (comportamiento previo). _Pendiente futuro (fuera de este
  slice): que `matchAccount` sin `last4` también consulte los alias del miembro para desambiguar una
  tarjeta existente._
- ⏳ **Pasos siguientes:** (5) **backfill + colapso** de medios transfer/cash por-persona (migración de
  datos, la parte de riesgo; ahí se mueven también los `holder_aliases` de no-miembros a su placeholder
  y se archivan los medios viejos); (6) promoción placeholder→cuenta.

## Decisión de RLS (creación de placeholders) — CERRADA (2026-07-09)
**Solo owner/admin** pueden crear placeholders (se deja `wm_write` como está). Consistente con
"invitar/agregar miembros" (ya es owner/admin) y más simple. Costo aceptado: un rol "member" que
carga un movimiento de un no-miembro no puede crear la persona en el momento (lo deja en "Otros" o le
pide a un admin) — poco común, porque los que cargan plata suelen ser owner/admin.

## Problema de raíz
Hoy **la persona de un movimiento se deduce del medio** (`account.owner_member_id`/`holder_name`;
`transactions` NO tiene campo de persona). Consecuencias:
- Un medio `'transfer'` (y `'cash'`) **por persona** → "muchas Transferencia" en Medios.
- El `holder_name` denormalizado queda viejo al cambiar el nombre del perfil → **BUG-17** (persona
  duplicada en Medios/filtro).
- No se puede atribuir a alguien que no usa la app sin crear un medio con nombre suelto.

## Decisión (2026-07-09, con el usuario)
La persona pasa a ser un **campo del movimiento**. Decisiones cerradas:
1. **No-miembro:** al atribuir a alguien que no está en el grupo, se **crea una "persona del grupo"
   (placeholder) en el momento** desde el alta. Nunca un nombre de texto suelto en el movimiento.
2. **Migración:** los medios transfer/cash por-persona existentes se **colapsan a uno compartido
   conservando la historia** (backfill de la persona en cada movimiento + archivar los viejos).
3. **Rollout:** **todo junto** (un cambio grande). _Nota del arquitecto: implementar con commits
   acotados y probar la migración contra una copia antes de prod._

## Modelo de datos
- **`transactions.owner_member_id uuid null references workspace_members(id) on delete set null`**:
  la persona del movimiento. Apunta a `workspace_members`, que incluye miembros reales **y
  placeholders**.
- **`workspace_members`:** `user_id` → **nullable**; agregar **`name text`** (nombre del placeholder;
  los miembros reales siguen sacando el nombre de `profiles` vía `member_directory`). RLS: un
  placeholder (`user_id NULL`) **nunca da acceso** (`is_member()` compara `user_id = auth.uid()`).
  Revisar `member_directory` para exponer el nombre del placeholder.
- **Medios compartidos:** un solo `'transfer'` y un solo `'cash'` por workspace (`owner_member_id`
  NULL). Seed al crear el workspace (o lazy en el primer uso).
- **Alias (de Part A):** hoy `accounts.holder_aliases` vive en el medio transfer por-persona. Con el
  medio compartido, los alias pasan a la **persona** → mover a `workspace_members` (columna
  `aliases text[]` o tabla). Migrar los alias existentes al miembro/placeholder correspondiente.

## Regla de resolución de "persona" (reportes/listas/filtros)
En orden:
1. `transaction.owner_member_id` → ese miembro (**nombre vivo**).
2. si no, `account.owner_member_id` (tarjeta de una persona) → ese miembro (nombre vivo).
3. si no, `account.holder_name` (titular legacy sin miembro).
4. si no → "Sin persona".

→ Arregla **BUG-17** (nombre vivo siempre que haya miembro). `personaIdentity`
(`features/reports/aggregate.ts`) pasa a leer `tx.owner_member_id` primero; agregar la columna al
select y a `ReportTransactionView`. El **filtro "Persona"** de `/movimientos` (`FilterBar`) pasa a
agrupar/filtrar por miembro, no por `holder_name`.

## Alta (`TransactionForm`)
- **Selector de persona** cuando el medio NO determina la persona (Transferencia / Efectivo / sin
  medio): miembros + placeholders + **"crear persona del grupo"** (inline).
- **Transferencia por OCR:** prefill matcheando origen/destino contra miembros/placeholders (reusa
  `matchMember` + alias de la persona). Si no matchea → ofrecer crear placeholder (reusa el prompt
  de MEJ-4A slice 2, pero ahora contra personas, no contra medios).
- **Tarjetas:** sin selector (persona = dueño de la tarjeta). El movimiento queda con
  `owner_member_id` NULL y se resuelve por regla 2.
- Escribe `transactions.owner_member_id`.

## Migración (conservar historia)
1. `alter transactions add owner_member_id …`; `workspace_members`: `user_id` nullable + `name`;
   `workspace_members` alias; medios compartidos.
2. **Backfill de la persona en los movimientos:**
   - Movimientos en un medio transfer/cash **con `owner_member_id`** → `tx.owner_member_id =
     account.owner_member_id`.
   - Movimientos en un medio transfer **con `holder_name` sin `owner_member_id`** (no-miembros) →
     **crear placeholders** (dedup por nombre normalizado + alias), setear `tx.owner_member_id`.
3. **Colapsar medios:** repuntar `tx.account_id` de esos movimientos al medio compartido; **archivar**
   los medios transfer/cash por-persona.
4. **Apodos (MEJ-8):** remapear `persona_aliases` de claves `name:<...>` a `member:<id>` para los
   holders que se convirtieron en placeholder.
5. `supabase db push` (local + remoto) + regenerar `database.types.ts` + `schema_fase1.sql` al día.

## Promoción placeholder → cuenta real (Parte B)
Cuando la persona sin cuenta se une a la app, se **setea `user_id`** en su fila de
`workspace_members` (conserva `member:<id>` y toda la historia, sin migrar). Definir el disparador
(invitación dirigida al placeholder, o match por email/nombre con confirmación del admin) para no
linkear a la persona equivocada.

## RLS
- `transactions.owner_member_id` debe ser de un miembro del **mismo workspace** (check/trigger).
- No se debilita nada; placeholders no dan acceso. Un usuario solo gestiona personas de sus workspaces.

## Criterios de aceptación
- [ ] Existe **un solo** medio "Transferencia" y uno "Efectivo" por grupo; la persona de cada
      transferencia/efectivo se ve correctamente (por movimiento).
- [ ] Cambiar el nombre del perfil se refleja en Medios/filtros/reportes sin duplicar persona (BUG-17).
- [ ] Se puede atribuir un movimiento a una **persona del grupo sin cuenta** (placeholder), creada
      desde el alta, y aparece individualizada en reportes.
- [ ] Al unirse esa persona, su placeholder pasa a cuenta real conservando medios/movimientos/apodos.
- [ ] Migración aplicada en remoto + tipos + `schema_fase1.sql` al día; **sin perder atribución
      histórica** de las transferencias/efectivo ya cargados.
- [ ] Lógica pura con tests; RLS no se debilita.

## Fuera de alcance
- Cambiar la atribución de las **tarjetas** (siguen por su dueño).
- Merge de personas duplicadas más allá de lo que resuelve la migración.

## Tickets absorbidos / relacionados
- **MEJ-4 Parte B** (persona sin cuenta) → acá.
- **MEJ-12** (efectivo por miembro) → **reemplazado** por "Efectivo compartido + persona por movimiento".
- **BUG-17** (cambiar nombre no refleja) → lo arregla la regla de resolución (nombre vivo).
- **MEJ-4 Parte A** (alias) → ya hecho; sus alias se **mueven** de `accounts` a la persona.
