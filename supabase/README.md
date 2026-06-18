# supabase/ — Configuración y migraciones

Proyecto Supabase linkeado (`supabase link`) y migraciones versionadas que llevan `db/schema_fase1.sql` a la base real.

## Contenido

- `config.toml` — configuración del proyecto Supabase (generado por `supabase init`).
- `migrations/0001_init.sql` — migración inicial: extensiones, enums, funciones, tablas, índices, RLS, vista `member_directory`, trigger de owner y seed de categorías globales. Espejo de `db/schema_fase1.sql`, con una salvedad: `gen_random_bytes` se referencia calificado como `extensions.gen_random_bytes`, porque en Supabase `pgcrypto` se instala en el esquema `extensions`, no en `public`.

## Notas

- Después de cualquier cambio de esquema: nueva migración en `migrations/` + `supabase db push` + regenerar `src/lib/database.types.ts` con `supabase gen types typescript --linked`.
- Requiere `SUPABASE_ACCESS_TOKEN` (token personal) seteado en el entorno para que el CLI se autentique.
