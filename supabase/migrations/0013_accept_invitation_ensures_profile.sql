-- ============================================================================
-- 0013_accept_invitation_ensures_profile — aceptar invitación sin perfil (BUG-2)
-- ============================================================================
-- `workspace_members.user_id` referencia `profiles.id`. El perfil se crea en el
-- onboarding (`upsertMyProfile`), pero quien llega por un link de invitación NO
-- pasa por el onboarding → no tiene perfil → `accept_invitation` fallaba al
-- insertar la membresía con FK 23503 ("Key (user_id)=... is not present in
-- table profiles"). Resultado: un usuario nuevo no podía aceptar una invitación
-- si todavía no tenía ningún grupo.
--
-- Fix: `accept_invitation` (SECURITY DEFINER) asegura el perfil del usuario
-- antes de sumarlo como miembro, derivando un nombre de `auth.users`
-- (full_name / name del metadata, o la parte local del email). El usuario puede
-- editarlo después. Idempotente (`on conflict do nothing`): no pisa perfiles
-- existentes ni afecta el flujo normal de onboarding.
-- ============================================================================

create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invitations;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa.';
  end if;

  select * into inv from invitations where token = p_token;

  if inv is null then
    raise exception 'Invitación inválida.';
  end if;
  if inv.status <> 'pending' or inv.expires_at < now() then
    raise exception 'Invitación vencida o no disponible.';
  end if;

  -- Asegurar el perfil del usuario (quien acepta por link puede no haber hecho
  -- onboarding). Sin esto, el insert en workspace_members viola la FK a profiles.
  insert into profiles (id, name)
  select u.id,
         coalesce(
           nullif(u.raw_user_meta_data->>'full_name', ''),
           nullif(u.raw_user_meta_data->>'name', ''),
           nullif(split_part(u.email, '@', 1), ''),
           'Sin nombre'
         )
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Solo las invitaciones por email son de un solo uso; el link es reutilizable.
  if inv.email is not null then
    update invitations set status = 'accepted' where id = inv.id;
  end if;

  return inv.workspace_id;
end;
$$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;
