# db/ — Base de datos

Esquema SQL de la base (Postgres/Supabase). Es la **fuente de verdad** del modelo de datos.

## Contenido

- `schema_fase1.sql` — esquema completo de la Fase 1: extensiones, enums, tablas (`profiles`, `workspaces`, `workspace_members`, `invitations`, `accounts`, `categories`, `attachments`, `transactions`), índices, políticas **RLS**, la vista `member_directory` (privacidad del teléfono), el trigger que agrega al creador como `owner` y el seed de categorías globales.

## Notas

- Si cambia el esquema, regenerar `src/lib/database.types.ts` con `supabase gen types`.
- Las migraciones versionadas viven en `supabase/migrations/` (se generan en el ticket **A2**).
