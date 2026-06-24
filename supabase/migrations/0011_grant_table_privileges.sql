-- ============================================================================
-- 0011_grant_table_privileges — GRANTs explícitos para anon/authenticated/service_role
-- ============================================================================
-- Las tablas de `public` tienen RLS + policies, pero nunca se otorgó el GRANT a
-- nivel tabla a los roles de la API (`authenticated`, `service_role`). En la nube
-- "funcionaba" por el comportamiento legacy de auto-exponer tablas nuevas del
-- schema `public` (auto_expose_new_tables), que la CLI local ya NO aplica y que
-- Supabase elimina el 2026-10-30. Sin GRANT, PostgREST corta antes de evaluar la
-- policy y devuelve 403 / "permission denied for table ..." (code 42501).
--
-- RLS sigue siendo la fuente de verdad de seguridad: es restrictivo por defecto
-- (sin policy = denegado), así que otorgar DML a `authenticated` no expone filas;
-- solo habilita que la policy se evalúe. `service_role` (BYPASSRLS) lo usan las
-- edge functions (p. ej. fx-refresh upsertea `fx_rates`).
--
-- Idempotente: en la nube estos grants ya existen (no-op); este archivo los hace
-- explícitos y portables a cualquier Postgres.
-- ============================================================================

-- Acceso al schema (normalmente ya concedido vía PUBLIC, explícito por las dudas).
grant usage on schema public to anon, authenticated, service_role;

-- DML para el usuario autenticado. Las filas las filtran las policies (RLS).
grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role bypassa RLS y lo usan las edge functions.
grant all on all tables in schema public to service_role;

-- Secuencias/funciones (hoy no hay secuencias en public; los UUID usan gen_random_uuid).
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Reemplaza al auto-expose deprecado: objetos futuros creados por `postgres` en
-- public heredan estos grants (cada migración nueva queda cubierta sin repetir).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
