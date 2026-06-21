-- ============================================================================
-- 0005_fx_refresh_cron — Corrida diaria de la edge function `fx-refresh` (C12)
-- ============================================================================
-- Programa, vía pg_cron, un POST diario a la edge function que cachea las
-- cotizaciones en `fx_rates`. La corrida diaria además sirve de KEEP-ALIVE:
-- mantiene el proyecto activo y evita la pausa por inactividad (PRD §15).
--
-- Por qué pg_cron + pg_net (y no el dashboard): el schedule queda VERSIONADO en
-- git y es reproducible. La service_role key NO va en este archivo: se lee de
-- Supabase Vault en tiempo de ejecución.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- REQUISITO MANUAL (una sola vez, NO se versiona porque son secretos):
-- crear dos secrets en Vault con estos nombres EXACTOS:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',                 'service_role_key');
--
-- Hasta que existan, el cron corre pero el POST falla en silencio (URL/clave NULL).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- `cron.schedule(name, ...)` hace upsert por nombre → re-aplicar la migración no
-- duplica el job. Corre 22:00 UTC (~19:00 ART), después del cierre del día.
select cron.schedule(
  'fx-refresh-daily',
  '0 22 * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret from vault.decrypted_secrets where name = 'project_url'
      ) || '/functions/v1/fx-refresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
