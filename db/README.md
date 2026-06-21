# db/ — Base de datos

Esquema SQL de la base (Postgres/Supabase). Es la **fuente de verdad** del modelo de datos.

## Contenido

- `schema_fase1.sql` — esquema completo de la Fase 1: extensiones, enums, tablas (`profiles`, `workspaces`, `workspace_members`, `invitations`, `accounts`, `categories`, `attachments`, `transactions`), índices, políticas **RLS**, la vista `member_directory` (privacidad del teléfono), el trigger que agrega al creador como `owner`, las funciones `SECURITY DEFINER` `invitation_preview`/`accept_invitation` (aceptar invitación por token — C15), el seed de categorías globales y el bucket de Storage `attachments` (privado, comprobantes — B8) con sus políticas sobre `storage.objects`.

## Notas

- Si cambia el esquema, regenerar `src/lib/database.types.ts` con `supabase gen types`.
- Las migraciones versionadas viven en `supabase/migrations/` (ticket **A2**). Ahí `gen_random_bytes` quedó calificado como `extensions.gen_random_bytes`, porque en Supabase `pgcrypto` se instala en el esquema `extensions`, no en `public`; este archivo no se tocó para no desviar la fuente de verdad, pero es la única diferencia con la migración real.
