-- ============================================================================
-- Fix: alta de workspace rota para CUALQUIER usuario nuevo (bug preexistente,
-- detectado al verificar B8 manualmente vía onboarding).
--
-- `createWorkspace` hace `insert(...).select().single()`, es decir el INSERT
-- pide RETURNING. Postgres aplica también las políticas de SELECT sobre la
-- fila devuelta, y `ws_select` era `is_member(id)`: en el instante del INSERT
-- el creador todavía NO es miembro (el trigger `trg_ws_add_owner` lo agrega
-- recién después), así que el RETURNING fallaba con
-- "new row violates row-level security policy for table workspaces" y el
-- onboarding (A4) no podía crear el primer workspace de nadie.
-- ============================================================================
drop policy ws_select on workspaces;
create policy ws_select on workspaces
  for select using (is_member(id) or owner_id = auth.uid());

-- Limpieza de funciones de diagnóstico creadas (y revertidas en la migration
-- history) durante la investigación de este bug.
drop function if exists public.debug_auth_diag();
drop function if exists public.debug_ws_policies();
drop function if exists public.debug_try_insert_workspace(text);
drop function if exists public.debug_try_insert_workspace_noreturning(text);
