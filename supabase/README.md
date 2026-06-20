# supabase/ — Configuración y migraciones

Proyecto Supabase linkeado (`supabase link`) y migraciones versionadas que llevan `db/schema_fase1.sql` a la base real.

## Contenido

- `config.toml` — configuración del proyecto Supabase (generado por `supabase init`).
- `migrations/0001_init.sql` — migración inicial: extensiones, enums, funciones, tablas, índices, RLS, vista `member_directory`, trigger de owner y seed de categorías globales. Espejo de `db/schema_fase1.sql`, con una salvedad: `gen_random_bytes` se referencia calificado como `extensions.gen_random_bytes`, porque en Supabase `pgcrypto` se instala en el esquema `extensions`, no en `public`.
- `migrations/0002_attachments_storage.sql` — bucket privado `attachments` (comprobantes, FR-10) + políticas de `storage.objects` (lectura/escritura por miembro del workspace, vía el primer segmento del path `{workspace_id}/...`; borrado solo owner/admin). Espejo de la sección "STORAGE" de `db/schema_fase1.sql`.
- `migrations/0003_fix_workspace_select_on_create.sql` — fix de `ws_select` (bug preexistente que rompía el alta de workspace para cualquier usuario nuevo; ver el comentario en el archivo y en `db/schema_fase1.sql`).

## Notas

- Después de cualquier cambio de esquema: nueva migración en `migrations/` + `supabase db push` + regenerar `src/lib/database.types.ts` con `supabase gen types typescript --linked`.
- Requiere `SUPABASE_ACCESS_TOKEN` (token personal) seteado en el entorno para que el CLI se autentique.
