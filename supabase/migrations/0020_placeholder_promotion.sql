-- ============================================================================
-- 0020_placeholder_promotion — IDENT-1 paso 6: promover un placeholder a cuenta real
-- ============================================================================
-- Una "persona del grupo" sin cuenta (placeholder: workspace_members con user_id
-- NULL) puede unirse a la app conservando su identidad (member:<id>) y TODA su
-- historia (movimientos, medios, alias, apodos). El disparador es una invitación
-- DIRIGIDA a ese placeholder: al aceptarla, en vez de crear una fila nueva, se
-- setea user_id en la fila existente del placeholder.
-- ============================================================================

-- Invitación dirigida a un placeholder (NULL = invitación normal, crea miembro nuevo).
alter table invitations
  add column member_id uuid references workspace_members (id) on delete set null;

comment on column invitations.member_id is
  'IDENT-1 paso 6: si apunta a un placeholder (workspace_members sin cuenta), aceptar la invitación lo PROMUEVE (setea user_id) en vez de crear un miembro nuevo.';

-- ---------------------------------------------------------------------------
-- invitation_preview: exponer el nombre del placeholder (para el aviso "te unís
-- como <nombre>"). Cambia la firma de retorno → hay que DROP + CREATE.
-- ---------------------------------------------------------------------------
drop function if exists invitation_preview(text);
create function invitation_preview(p_token text)
returns table (
  workspace_id   uuid,
  workspace_name text,
  role           member_role,
  email          text,
  is_expired     boolean,
  is_usable      boolean,
  member_name    text
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
    i.expires_at < now()                              as is_expired,
    i.status = 'pending' and i.expires_at >= now()    as is_usable,
    wm.name                                           as member_name  -- placeholder destino (o NULL)
  from invitations i
  join workspaces w on w.id = i.workspace_id
  left join workspace_members wm on wm.id = i.member_id
  where i.token = p_token;
$$;

revoke all on function invitation_preview(text) from public;
grant execute on function invitation_preview(text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation: si la invitación apunta a un placeholder vigente, PROMOVERLO
-- (setear user_id); si no, comportamiento normal (alta de miembro nuevo).
-- ---------------------------------------------------------------------------
create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv    invitations;
  target workspace_members;
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
  -- onboarding). Sin esto, tanto el insert como el update violarían la FK a profiles.
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

  -- Promoción de un placeholder (IDENT-1 paso 6).
  if inv.member_id is not null then
    select * into target from workspace_members
      where id = inv.member_id and workspace_id = inv.workspace_id;
    if target.id is not null and target.user_id is null then
      -- El que acepta no puede ser YA miembro del workspace (violaría unique(workspace_id,user_id)).
      if exists (
        select 1 from workspace_members
        where workspace_id = inv.workspace_id and user_id = auth.uid()
      ) then
        raise exception 'Ya sos miembro de este grupo; no se puede vincular a otra persona.';
      end if;
      update workspace_members
        set user_id = auth.uid(), role = inv.role
        where id = target.id;
      -- La invitación dirigida es de un solo uso.
      update invitations set status = 'accepted' where id = inv.id;
      return inv.workspace_id;
    end if;
    -- Placeholder ya promovido o borrado → cae al alta normal de abajo.
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Solo las invitaciones por email (o dirigidas) son de un solo uso; el link genérico es reutilizable.
  if inv.email is not null then
    update invitations set status = 'accepted' where id = inv.id;
  end if;

  return inv.workspace_id;
end;
$$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;
