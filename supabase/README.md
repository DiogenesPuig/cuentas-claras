# supabase/ — Configuración y migraciones

Proyecto Supabase linkeado (`supabase link`) y migraciones versionadas que llevan `db/schema_fase1.sql` a la base real.

## Contenido

- `config.toml` — configuración del proyecto Supabase (generado por `supabase init`).
- `migrations/0001_init.sql` — migración inicial: extensiones, enums, funciones, tablas, índices, RLS, vista `member_directory`, trigger de owner y seed de categorías globales. Espejo de `db/schema_fase1.sql`, con una salvedad: `gen_random_bytes` se referencia calificado como `extensions.gen_random_bytes`, porque en Supabase `pgcrypto` se instala en el esquema `extensions`, no en `public`.
- `migrations/0002_attachments_storage.sql` — bucket privado `attachments` (comprobantes, FR-10) + políticas de `storage.objects` (lectura/escritura por miembro del workspace, vía el primer segmento del path `{workspace_id}/...`; borrado solo owner/admin). Espejo de la sección "STORAGE" de `db/schema_fase1.sql`.
- `migrations/0003_fix_workspace_select_on_create.sql` — fix de `ws_select` (bug preexistente que rompía el alta de workspace para cualquier usuario nuevo; ver el comentario en el archivo y en `db/schema_fase1.sql`).
- `migrations/0004_fx_rates.sql` — tabla global `fx_rates` (cache de cotizaciones, C12) con `unique (date, source, quote, currency)`; RLS de solo lectura para autenticados (escritura solo service_role).
- `migrations/0005_fx_refresh_cron.sql` — cron diario (pg_cron + pg_net) que invoca la edge function `fx-refresh`; también keep-alive (PRD §15). La service_role key se lee de Vault, no se versiona (ver cabecera del archivo).
- `migrations/0006_invitation_accept.sql` — funciones `SECURITY DEFINER` `invitation_preview(token)` y `accept_invitation(token)` (C15): permiten que quien todavía no es miembro valide y acepte una invitación por token, ya que la policy `inv_admin` no deja leer `invitations` a nadie más que owner/admin.
- `migrations/0011_grant_table_privileges.sql` — GRANTs explícitos de DML a `authenticated`/`service_role` sobre las tablas de `public` (+ default privileges para tablas futuras). En la nube ya existían por el auto-expose legacy (deprecado, se elimina 2026-10-30) que la CLI local ya no aplica; sin esto el stack local devuelve 403 / "permission denied" pese a tener RLS. RLS sigue siendo el guardián de filas.
- `migrations/0012_invitation_links.sql` — links de invitación genéricos: `invitations.email` pasa a nullable (`NULL` = link reutilizable; `NOT NULL` = invitación por email de un solo uso) y `accept_invitation` solo marca `accepted` las de email, dejando los links reutilizables hasta vencer/revocar.
- `migrations/0013_accept_invitation_ensures_profile.sql` — fix BUG-2: `accept_invitation` crea el `profiles` del usuario si falta (deriva el nombre de `auth.users`) antes de sumarlo como miembro. Quien acepta por link puede no haber hecho onboarding (donde se crea el perfil), y `workspace_members.user_id → profiles.id` hacía fallar el alta con FK.
- `functions/fx-refresh/` — edge function que cachea cotizaciones de dolarapi en `fx_rates` (C12). Ver su `README.md`.

## Notas

- Después de cualquier cambio de esquema: nueva migración en `migrations/` + `supabase db push` + regenerar `src/lib/database.types.ts` con `supabase gen types typescript --linked`.
- Requiere `SUPABASE_ACCESS_TOKEN` (token personal) seteado en el entorno para que el CLI se autentique.
