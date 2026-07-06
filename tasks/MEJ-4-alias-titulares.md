# MEJ-4 Identidad de persona: alias de titulares + personas del grupo sin cuenta

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Opus (cerrar diseño de la Parte B) → Sonnet (implementar) · **Depende de:** F2-11

> **Este ticket unifica dos pedidos** que tocan el MISMO modelo (la "identidad de persona"), para no
> hacerlos por separado y tener que rehacer (decisión del usuario, 2026-06-29):
> - **Parte A — Alias de titulares** (diseño cerrado): varios nombres → un mismo medio/persona.
> - **Parte B — Personas del grupo sin cuenta** (diseño a cerrar): una persona real del grupo que NO
>   usa la app, pero que el usuario quiere ver **individualizada** en los reportes (hoy cae en "Otros").
>
> Implementar **A primero** (ya está diseñada) y **B después** (requiere cerrar diseño, ver abajo).

## Problema (reportado por el usuario, 2026-06-27 y 2026-06-29)
1. **(A)** El mismo titular escrito distinto en cada banco/billetera (ej. `Pepito Perez` vs `Perez
   Pepito` vs `PEREZ, Pepito Juan`, o apodos/abreviaturas) genera **medios `'transfer'` duplicados**
   y atribución de persona inconsistente. Conecta con F2-11 (medio por persona), el follow-up de
   orden de nombre de F2-12 y el match por titular de resúmenes (F2-5).
2. **(B)** En los donuts de resumen de `/reportes` (MEJ-5) los no-miembros se agrupan en una sola
   porción **"Otros"**. Pero a veces un no-miembro **es parte real del grupo** (solo que no entró a
   la app) y el usuario quiere verlo individualizado, **a nivel grupo** (que todos lo vean así, no
   solo él — eso lo confirmó el usuario el 2026-06-29; el apodo local es MEJ-8).

---
# PARTE A — Alias de titulares (✅ implementada y mergeada — PR #64, 2026-07-06)

> **Estado:** hecho salvo el **slice 2 (prompt inline, paso 6 / AC3)**, que queda como follow-up.
> Entregado: migración 0017 `accounts.holder_aliases` (aplicada local + **remoto**), tipos y
> `schema_fase1.sql` al día; matcher `account-match` con alias (overlap ≥2 **o** clave exacta);
> `getOrCreateTransferAccount` unificado con `findTransferAccount` (auto-dedup base); UI de gestión
> `HolderAliasesEditor` en Medios (con el rediseño de tarjetas). Tests verdes.
> **Pendiente (slice 2):** el prompt inline "¿es la misma persona que X?" al detectar un titular
> nuevo parecido a uno existente en el alta por comprobante (guardar alias + reusar el medio).

## Diseño original (referencia)

## Causa raíz encontrada (2026-06-29)
La lógica de nombres ya existe y es pura (`src/lib/name-match.ts`: `nameTokenOverlap` orden-indistinto,
`normalizeNameKey` orden/tildes-indistinto). **Pero las dos capas de matching no coinciden:**
- **Front** (`TransactionForm.findTransferAccount` → `matchAccount` con `allowHolderOnlyMatch`):
  matchea **fuzzy** por overlap de tokens (≥2). Orden indistinto ya funciona acá.
- **Autoritativo** (`src/features/accounts/api.ts` → `getOrCreateTransferAccount`, ~L122): para
  no-miembros busca por **`holder_name` EXACTO**. Si el front no encontró el medio, esta capa crea
  un duplicado aunque sea la misma persona.

→ Hay que **unificar** ambas capas en el matcher puro y, además, permitir **alias manuales** para los
casos que la heurística no puede adivinar (apodos, "José" vs "Pepito", "Perez P.").

## Decisiones de diseño (cerradas con el usuario, 2026-06-29)
- **Modelo de datos:** **columna `holder_aliases text[]` en `accounts`** (default `'{}'`). El medio
  `'transfer'` de la persona guarda sus nombres alternativos. *Sin tabla nueva ni RLS nueva* (la RLS
  de `accounts` ya cubre la columna), migración mínima. Encaja con "un medio por persona".
- **Duplicados existentes:** **solo matching futuro.** Los alias evitan crear NUEVOS duplicados y
  resuelven el alta actual; los medios duplicados ya creados quedan como están (el usuario los puede
  archivar a mano). NO se mueven movimientos (sin operación de merge → sin riesgo sobre la tabla de
  movimientos).
- **UX:** **ambos** — (a) pantalla de gestión en Medios para agregar/quitar alias de un medio
  `'transfer'`, y (b) prompt inline al detectar un titular nuevo parecido a uno existente.
- **Auto-dedup como base (incluido):** al pasar `getOrCreateTransferAccount` del match exacto al
  matcher puro (con `normalizeNameKey` + alias), las variantes de orden/tildes colapsan solas.

## Contexto / archivos
- Matchers puros: `src/lib/name-match.ts`, `src/lib/account-match.ts` (`matchAccount`,
  `MatchableAccount`), `src/lib/member-match.ts`.
- Front: `src/features/transactions/components/TransactionForm.tsx` (`findTransferAccount` L60,
  efecto de alta lazy L170).
- Autoritativo: `src/features/accounts/api.ts` (`getOrCreateTransferAccount` L111).
- Medios (UI de gestión): `src/app/AccountsPage.tsx` + `src/features/accounts/components/`.
- Esquema: `accounts` en `db/schema_fase1.sql` (~L225). Tipos en `src/lib/database.types.ts`
  (GENERADO — regenerar con `supabase gen types`, no editar a mano).

## Pasos
1. **Migración** `supabase/migrations/00NN_accounts_holder_aliases.sql`: `alter table accounts add
   column holder_aliases text[] not null default '{}';`. Aplicar **local + remoto** (`supabase db
   push`, verificar con `supabase migration list --linked`). Reflejar en `db/schema_fase1.sql`.
   **Regenerar `database.types.ts`** (`supabase gen types`).
2. **`src/lib/account-match.ts`**: agregar `holderAliases?: string[]` a `MatchableAccount`; el match
   por titular considera `holderName` **o** cualquier alias (overlap de tokens / `normalizeNameKey`).
   Tests: alias resuelve match; orden/tildes colapsa; persona distinta NO matchea.
3. **`getOrCreateTransferAccount` (api.ts)**: reemplazar el match por `holder_name` exacto por:
   traer los medios `'transfer'` del workspace y delegar en el matcher puro (mismo criterio que el
   front, ahora con alias). Mantener `api.ts` fino (la decisión vive en `lib/`). Si no hay match →
   crear como hoy.
4. **`findTransferAccount` (TransactionForm)**: mapear `holder_aliases` al shape `MatchableAccount`
   para que el pre-match del front también use alias (unificado con el paso 3).
5. **UI de gestión (Medios):** en cada medio `'transfer'`, permitir ver/agregar/quitar nombres
   alternativos (alias). Hook + `api.ts` para actualizar `holder_aliases`. (NO fusiona movimientos.)
6. **Prompt inline:** en el alta por comprobante/transferencia, si se va a crear un medio nuevo pero
   hay un candidato cercano (overlap parcial), preguntar "¿Es la misma persona que <X>?". Si el
   usuario confirma → agregar el nombre detectado como alias de `<X>` y usar `<X>` (no crear nuevo).
7. `typecheck` / `lint` / `test`. Actualizar READMEs de carpeta si se crean archivos.

## Criterios de aceptación
- [ ] Dos comprobantes/transferencias del mismo titular con distinto orden/tildes resuelven al
      **mismo** medio `'transfer'` (no se duplica) — auto-dedup base.
- [ ] El usuario puede agregar un alias (ej. "Pepito") a un medio existente y, a partir de ahí, los
      movimientos con ese nombre resuelven a ese medio.
- [ ] El prompt inline ofrece unir a un titular parecido al dar de alta; al confirmar, guarda el
      alias y reusa el medio (sin crear duplicado, sin mover movimientos viejos).
- [ ] `getOrCreateTransferAccount` y el pre-match del front usan el **mismo** criterio (sin la
      inconsistencia exacto-vs-fuzzy actual).
- [ ] Migración aplicada en remoto + `database.types.ts` regenerado + `schema_fase1.sql` al día.
- [ ] Lógica pura con tests que pasan; no se debilita RLS.

## Fuera de alcance (Parte A)
- **Merge** de medios duplicados existentes (mover movimientos / eliminar dup) → posible follow-up.
- Alias a nivel **miembro** compartido entre varios medios (acá el alias es por medio `'transfer'`).
- Reusar `holder_aliases` en el match de **resúmenes** (`account-match` ya queda preparado; cablearlo
  al flujo de statements es una extensión barata pero opcional, fuera de este v1).
- IA/embeddings para matching de nombres (sigue siendo por reglas).

---
# PARTE B — Personas del grupo sin cuenta (diseño A CERRAR antes de implementar)

> Pedido del usuario (2026-06-29): que un no-miembro que **es del grupo** (pero no usa la app) se
> pueda ver **individualizado** en los reportes en vez de caer en "Otros" (MEJ-5), y que ese cambio
> sea **a nivel grupo** (todos lo ven así). Esto excede un flag de visualización: en los hechos es
> el concepto de **"miembro/persona del grupo sin cuenta de usuario"**. Por eso vive acá, junto a la
> identidad de persona, y NO se improvisa: **Opus cierra el diseño con el usuario antes de codear.**

## Casos de uso que lo motivan (observaciones del usuario, 2026-07-06)
Estos tres pedidos concretos caen todos sobre este mismo modelo de identidad y **se diseñan juntos**:
1. **Efectivo por defecto (seed).** Hoy no se seedea ningún medio (solo categorías, B6); el usuario
   tiene que crear "Efectivo" a mano. Se quiere que exista por defecto.
2. **Dueño del efectivo.** El efectivo, como cualquier medio, deduce la persona de su titular/owner.
   Que tenga dueño implica decidir si es **uno por persona** (seed por miembro) o uno genérico cuyo
   dueño se elige.
3. **Cargar efectivo (o cualquier gasto) de alguien que NO es miembro.** Hoy no hay forma → el
   movimiento queda **sin persona**. Este es exactamente el núcleo de la Parte B (persona sin cuenta).

> Nota: (1) y (2) con dueño = **un miembro existente** se pueden hacer sin la Parte B completa (seed
> de un "Efectivo" por miembro con `owner_member_id`). Pero (3) —y "efectivo de un no-miembro"—
> necesitan el modelo de persona sin cuenta. Decidir al cerrar el diseño si se parte en dos (seed de
> efectivo primero, persona sin cuenta después) o se hace junto.

## Decisiones ya tomadas
- **Alcance: a nivel GRUPO** (persistido en DB, lo ven todos). El equivalente "solo para mí" es el
  apodo de MEJ-8; esto es distinto.
- **Promoción placeholder → cuenta real es REQUISITO** (no follow-up): el usuario confirmó (2026-06-29)
  que un caso común es que esa persona **se una a la app más adelante**. Al hacerlo, debe **conservar
  toda su historia** (medios, movimientos, apodos) sin migrar datos. Esto inclina el modelo a (a).

## Decisiones de diseño PENDIENTES (cerrar con Opus + usuario)
1. **Modelo de datos.** Dos caminos:
   - (a) **`workspace_members` con `user_id` NULL** (miembro "placeholder" sin cuenta): reusa toda la
     maquinaria de persona (los reportes ya agrupan por `owner_member_id`, F2-10). **Promoción trivial:**
     cuando la persona acepta la invitación, se **setea `user_id` en esa misma fila** → conserva su
     `member:<id>` y toda la historia, sin mover nada. Hay que revisar **RLS** e invariantes que hoy
     asumen `user_id` no nulo (ej. `is_member`, `member_directory`, triggers de alta de miembro).
   - (b) **Tabla nueva** `group_persons` referenciada por `accounts.owner_person_id`. Más aislada, pero
     duplica el concepto de persona y la promoción obliga a **migrar** todo lo que apuntaba a la persona
     hacia el nuevo `workspace_member` (más trabajo y riesgo).
   → **Recomendación reforzada: (a)**, sobre todo por el requisito de promoción sin pérdida de historia.
     Decidir el detalle de RLS al cerrar el diseño.
2. **Cómo se asocia un titular suelto a esa persona.** Probablemente reusando el **matcher + alias de
   la Parte A** (`holder_aliases`): la persona sin cuenta es, en la práctica, un "dueño" con sus
   nombres alternativos. Esto es la razón fuerte de unir A y B.
3. **UX.** Desde "Otros"/gestión de personas: "convertir este titular en persona del grupo" → crea la
   persona sin cuenta y le asocia el/los medios `'transfer'` y alias correspondientes.
4. **Reportes (MEJ-5).** `aggregateByPersonaMembersOnly` ya deja individuales las `member:*`; si B usa
   el camino (a), una persona sin cuenta es un `member:*` más y **deja de caer en "Otros"
   automáticamente**. Verificar que el donut de ingresos/gastos y el detalle lo reflejen.
5. **Promoción (flujo).** Cómo se linkea el placeholder al `user_id` cuando la persona se une: ¿al
   aceptar una invitación dirigida a ese placeholder?, ¿match por email/nombre con confirmación del
   admin? Definir el disparador y la confirmación para no linkear a la persona equivocada.
6. **Apodos de MEJ-8 (remap).** Los apodos de MEJ-8 se indexan por `personaKey`. Al **convertir** un
   no-miembro (`name:<normalizado>`) en persona del grupo (`member:<id>`), hay que **remapear** las
   filas de `persona_aliases` de esa clave vieja a la nueva (migración/handler pequeño dentro de B),
   para no "perder" el apodo. Anotado como dependencia inversa MEJ-8 → MEJ-4.
7. **Efectivo por defecto (2026-07-06).** ¿Se seedea un "Efectivo" por miembro al unirse (con
   `owner_member_id`) o uno genérico por workspace? ¿Migración/trigger de seed? ¿Y cómo se ata al
   flujo de "cargar efectivo de un no-miembro" (que necesita persona sin cuenta)? Decidir si el seed
   de efectivo por-miembro se adelanta como paso independiente.
8. **Cargar movimiento de una persona sin cuenta desde el alta.** Hoy el form deduce la persona del
   medio y no hay selector de persona. Definir la UX para atribuir un movimiento (efectivo o no) a una
   persona del grupo sin cuenta al darlo de alta (crear la persona en el momento, elegirla, etc.).

## Criterios de aceptación (Parte B — preliminares, afinar al cerrar diseño)
- [ ] El usuario puede marcar/crear una "persona del grupo sin cuenta" y asociarle titulares/medios.
- [ ] Esa persona aparece **individualizada** (no en "Otros") en los donuts de resumen de `/reportes`,
      para **todos** los integrantes del grupo.
- [ ] **Promoción:** cuando la persona se une a la app, su placeholder pasa a cuenta real **conservando
      medios, movimientos y apodos** (sin migrar datos ni crear un duplicado).
- [ ] Migración aplicada en remoto + `database.types.ts` regenerado + `schema_fase1.sql` al día.
- [ ] RLS no se debilita; un usuario solo gestiona personas de workspaces a los que pertenece.

## Fuera de alcance (Parte B)
- Apodos (privados, MEJ-8) en sí — acá solo el **remap** de sus claves al promover (punto 6).
