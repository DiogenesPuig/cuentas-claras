-- ============================================================================
-- 0012_invitation_links — links de invitación genéricos y reutilizables (C15+)
-- ============================================================================
-- Hasta ahora toda invitación tenía un `email` destinatario y era de un solo uso
-- (al aceptarla pasaba a 'accepted'). Sumamos el "link genérico": una invitación
-- SIN email que cualquiera con el link puede aceptar, reutilizable hasta que venza
-- o se revoque.
--
-- Modelado sin columnas nuevas: `email IS NULL` == link reutilizable;
-- `email IS NOT NULL` == invitación por email de un solo uso (comportamiento actual).
-- El vencimiento lo decide quien crea la invitación (los links se crean a 48 hs
-- desde `api.ts`; las de email mantienen el default de 7 días).
-- ============================================================================

alter table invitations alter column email drop not null;

comment on column invitations.email is
  'Destinatario de la invitación. NULL = link genérico reutilizable (cualquiera con el link entra); NOT NULL = invitación por email de un solo uso.';

-- accept_invitation: las de email se marcan 'accepted' (un solo uso); los links
-- (email null) quedan 'pending' para que sigan sirviendo a más gente.
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

  -- Solo las invitaciones por email son de un solo uso; el link genérico es reutilizable.
  if inv.email is not null then
    update invitations set status = 'accepted' where id = inv.id;
  end if;

  return inv.workspace_id;
end;
$$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;
