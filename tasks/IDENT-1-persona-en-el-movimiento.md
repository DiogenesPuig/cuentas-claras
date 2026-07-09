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
  _Pendiente de BUG-17: el **filtro "Persona" de `/movimientos`** (`FilterBar`) todavía agrupa por
  `holder_name`; pasarlo a agrupar/filtrar por miembro (sub-ítem del paso siguiente)._
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
- ⏳ **Pasos siguientes:** (3c) crear placeholder (owner/admin: api + hook + "crear persona del grupo"
  en el selector); (3d) filtro "Persona" de `/movimientos` por miembro; efectivo compartido (mismo
  patrón); (4) mover alias de `accounts` a la persona; (5) **backfill + colapso** de medios por-persona
  (migración de datos, la parte de riesgo); (6) promoción placeholder→cuenta.

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
