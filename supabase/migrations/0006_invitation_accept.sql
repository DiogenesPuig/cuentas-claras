-- ============================================================================
-- 0006_invitation_accept — aceptar invitación por token (C15)
-- ============================================================================
-- La policy `inv_admin` solo deja ver/escribir invitations a owner/admin del
-- workspace. Quien todavía no es miembro (el invitado) no puede leer su propia
-- invitación por una select normal, así que necesitamos funciones
-- SECURITY DEFINER que validen el token y hagan el alta de forma controlada,
-- sin abrir `invitations` a cualquier usuario autenticado.
-- ============================================================================

-- Vista previa de una invitación a partir del token (antes de aceptarla):
-- no expone otras invitaciones, solo la que coincide con el token recibido.
create or replace function invitation_preview(p_token text)
returns table (
  workspace_id   uuid,
  workspace_name text,
  role           member_role,
  email          text,
  is_expired     boolean,
  is_usable      boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.workspace_id,
    w.name,
    i.role,
    i.email,
    i.expires_at < now()              as is_expired,
    i.status = 'pending' and i.expires_at >= now() as is_usable
  from invitations i
  join workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

revoke all on function invitation_preview(text) from public;
grant execute on function invitation_preview(text) to authenticated;

-- Acepta una invitación pendiente y no vencida: agrega al usuario autenticado
-- como `workspace_member` con el rol de la invitación y la marca 'accepted'.
-- Devuelve el workspace_id para poder redirigir/activarlo en el front.
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

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update invitations set status = 'accepted' where id = inv.id;

  return inv.workspace_id;
end;
$$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;
