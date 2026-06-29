# MEJ-8 Apodos privados: renombrar a otras personas solo para mí (por usuario)

**Sprint:** Mejoras (post Fase 2) · **Modelo sugerido:** Sonnet (diseño cerrado por Opus + usuario, 2026-06-29; incluye migración + RLS) · **Depende de:** C13 (reportes), F2-10 (identidad de persona)

## Problema (reportado por el usuario, 2026-06-29)
El usuario quiere poder ponerle **otro nombre** a personas del grupo (miembros o titulares ajenos)
**solo para él**: un apodo que NO cambia cómo los ven los demás. (Distinto de MEJ-7, que cambia el
nombre **propio** a nivel grupo.)

## Decisión de diseño (cerrada con el usuario, 2026-06-29)
- **Alcance: privado por usuario, PERSISTIDO EN LA BASE** (no localStorage). El usuario descartó
  localStorage porque no sincroniza entre dispositivos y se pierde al borrar datos del navegador.
  Guardado en DB con **RLS**, el apodo es privado (solo lo ve/edita su dueño) pero **lo sigue en
  cualquier dispositivo** y sobrevive a logout/reinstalación.
- **Qué se puede apodar:** cualquier "persona" de los reportes, identificada por su `personaKey`:
  - miembros → `member:<owner_member_id>` (estable);
  - no-miembros → `name:<holder normalizado>` (ver `lib/name-match.normalizeNameKey`).
  El apodo **pisa el label mostrado** donde aparece esa persona (donuts, listas, opciones de filtro).
- **Scope por workspace:** el apodo es por `(usuario, workspace, personaKey)`. Así un `member:<id>`
  (id de `workspace_members`) es inequívoco y un mismo nombre ajeno puede apodarse distinto por grupo.
- **No** afecta la agrupación/dedup ni el consolidado (la identidad sigue siendo la misma
  `personaKey`); es puramente de **presentación**. Tampoco cambia el lumping de "Otros" (eso es MEJ-4).

## Modelo de datos (cerrado)
Tabla nueva `persona_aliases`:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade` (el dueño del apodo)
- `workspace_id uuid not null references workspaces(id) on delete cascade`
- `persona_key text not null` (ej. `member:<uuid>` o `name:<normalizado>`)
- `alias text not null`
- `created_at`/`updated_at timestamptz not null default now()` (+ trigger `set_updated_at`)
- `unique (user_id, workspace_id, persona_key)`

**RLS** (la identidad la da Supabase Auth; ver "portabilidad" en CLAUDE.md): habilitar RLS y, para
**todas** las operaciones, exigir `user_id = auth.uid() and is_member(workspace_id)` (helper
`is_member` ya existe). El `insert`/`update` además con `with check` del mismo predicado. Así nadie ve
ni escribe apodos de otro, y solo dentro de workspaces a los que pertenece.

## Contexto / archivos
- Identidad de persona: `src/features/reports/aggregate.ts` (`personaIdentity` → `key`/`label`,
  privado; `dimensionLabelFor` expone el label). El apodo se aplica **sobre el label**.
- Pantalla: `src/app/ReportsPage.tsx` arma `memberNameById` y pasa labels a los componentes. En los
  donut de resumen los no-miembros van a "Otros"; **los individuos se ven en el bloque [4] Detalle**
  (y los miembros, en el resumen) → la UI de apodo conviene en el bloque/persona donde el individuo
  aparece listado.
- Esquema: `db/schema_fase1.sql`. Tipos GENERADOS `src/lib/database.types.ts` (regenerar).
- RLS helper `is_member(ws)` y trigger `set_updated_at()`: ya en `db/schema_fase1.sql`.
- **Frontera Supabase:** todo el acceso vive en `api.ts` de una feature (nueva `src/features/aliases/`
  o dentro de `reports`); hooks/componentes/`lib` no importan `supabase` (regla de portabilidad).

## Pasos
1. **Migración** `supabase/migrations/00NN_persona_aliases.sql`: crear tabla + índice único + RLS
   (4 policies o una por operación) + trigger `set_updated_at`. Reflejar en `db/schema_fase1.sql`.
   Aplicar **local + remoto** (`supabase db push`, verificar `supabase migration list --linked`) y
   **regenerar** `database.types.ts`.
2. **Feature `aliases`** (o módulo en reports): `api.ts` (`listAliases(workspaceId)` →
   `Record<personaKey, alias>`, `upsertAlias(workspaceId, personaKey, alias)`,
   `deleteAlias(workspaceId, personaKey)`) + `hooks.ts` (`useAliases`, `useUpsertAlias`,
   `useDeleteAlias`; invalidan `useAliases` del workspace). `api.ts` es lo único que toca Supabase.
3. **Capa pura de presentación** `displayPersonaLabel(key, baseLabel, aliases)` (+ test): devuelve el
   apodo si existe para esa `key`, si no el label base. Mantener `aggregate.ts` puro (sin red).
4. **Aplicar el apodo** en `ReportsPage`: al construir labels de persona y opciones de filtro de
   persona, pasar por `displayPersonaLabel`. Exponer la `personaKey` donde haga falta (hoy varias
   vistas usan solo el label) para poder mapear y para la UI de edición.
5. **UI** para asignar/editar/quitar apodo de una persona (mínimo: un control inline por persona en
   la lista donde el individuo aparece — detalle por persona y/o miembros del resumen). Optimista o
   con estado de guardado; quitar el apodo = volver al nombre real.
6. `typecheck` / `lint` / `test`. Actualizar READMEs de carpeta (feature nueva, `aggregate`/reports).

## Criterios de aceptación
- [ ] El usuario puede ponerle un apodo a una persona (miembro o no-miembro) y verlo reflejado en
      sus reportes; **otro usuario del mismo grupo NO ve ese apodo** (RLS).
- [ ] El apodo **persiste entre dispositivos y sesiones** (está en la base, no en el navegador).
- [ ] Quitar el apodo vuelve al nombre original.
- [ ] No cambia la agrupación ni el consolidado (es solo presentación); `aggregate.ts` sigue puro.
- [ ] Migración aplicada en remoto + `database.types.ts` regenerado + `schema_fase1.sql` al día.
- [ ] RLS no se debilita; `api.ts` es la única capa que toca Supabase (portabilidad).

## Fuera de alcance
- Renombre propio global → MEJ-7 (hecho).
- Destacar no-miembros / personas sin cuenta a nivel grupo → MEJ-4 (ampliado).
- Apodar desde la porción "Otros" del resumen (los no-miembros se apodan donde aparecen individuales,
  ej. el detalle por filtro). Un acceso desde "Otros" es follow-up opcional.
