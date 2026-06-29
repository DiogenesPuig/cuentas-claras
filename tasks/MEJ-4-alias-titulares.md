# MEJ-4 Alias de titulares: varios nombres → un mismo medio/persona

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Sonnet (diseño cerrado por Opus + usuario, 2026-06-29) · **Depende de:** F2-11

## Problema (reportado por el usuario, 2026-06-27)
El mismo titular escrito distinto en cada banco/billetera (ej. `Pepito Perez` vs `Perez Pepito` vs
`PEREZ, Pepito Juan`, o apodos/abreviaturas) genera **medios `'transfer'` duplicados** y atribución
de persona inconsistente. Conecta con F2-11 (medio por persona), el follow-up de orden de nombre de
F2-12 y el match por titular de resúmenes (F2-5).

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

## Fuera de alcance
- **Merge** de medios duplicados existentes (mover movimientos / eliminar dup) → posible follow-up.
- Alias a nivel **miembro** compartido entre varios medios (acá el alias es por medio `'transfer'`).
- Reusar `holder_aliases` en el match de **resúmenes** (`account-match` ya queda preparado; cablearlo
  al flujo de statements es una extensión barata pero opcional, fuera de este v1).
- IA/embeddings para matching de nombres (sigue siendo por reglas).
