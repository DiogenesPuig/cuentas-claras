# src/features/aliases

Apodos **privados por usuario** para las "personas" de los reportes (MEJ-8). Cada usuario le puede
poner un nombre alternativo a un miembro o a un titular ajeno; solo lo ve él (RLS) y persiste en la
DB (sincroniza entre dispositivos). Es puramente de presentación: no cambia la agrupación ni el
consolidado de los reportes.

Implementa: MEJ-8.

## Archivos

- `display.ts` / `display.test.ts` — lógica pura: `AliasMap` (personaKey → apodo) y
  `displayPersonaLabel(key, baseLabel, aliases)` (apodo si existe y no está vacío, si no el label
  real). Sin React ni Supabase, para reutilizar en cualquier lista/donut.
- `api.ts` — única capa que toca Supabase: `listAliases(workspaceId)` (mapa del usuario actual;
  la RLS filtra por `auth.uid()`), `upsertAlias(workspaceId, personaKey, alias)` y
  `deleteAlias(workspaceId, personaKey)`.
- `hooks.ts` — react-query: `useAliases`, `useUpsertAlias`, `useDeleteAlias` (+ `aliasesKeys`).
- `index.ts` — barrel del feature.

## Persistencia

Tabla `persona_aliases (user_id, workspace_id, persona_key, alias)` con índice único
`(user_id, workspace_id, persona_key)` y RLS: cada usuario ve/edita SOLO sus apodos y solo en
workspaces a los que pertenece (migración `0015_persona_aliases.sql`).
