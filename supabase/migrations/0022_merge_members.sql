-- ============================================================================
-- 0022_merge_members — MEJ-19: fusionar dos personas del grupo en una
-- ============================================================================
-- Cubre el borde que IDENT-1 dejó afuera: un placeholder con historia + una
-- cuenta real que entró por link genérico quedan como dos "personas" separadas.
-- `merge_members(p_keep, p_remove)` mueve al sobreviviente todo lo que referencia
-- al duplicado (movimientos, medios, apodos privados, alias) y borra el duplicado.
-- Irreversible; solo owner/admin del workspace.
-- ============================================================================

create or replace function merge_members(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_row   workspace_members;
  remove_row workspace_members;
  moved_transactions integer;
  moved_accounts     integer;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa.';
  end if;
  if p_keep = p_remove then
    raise exception 'No se puede fusionar una persona consigo misma.';
  end if;

  -- Lock de ambas filas en orden determinístico (evita deadlock de dos fusiones cruzadas).
  perform 1 from workspace_members where id in (p_keep, p_remove) order by id for update;

  select * into keep_row   from workspace_members where id = p_keep;
  select * into remove_row from workspace_members where id = p_remove;
  if keep_row.id is null or remove_row.id is null then
    raise exception 'Persona inexistente.';
  end if;
  if keep_row.workspace_id <> remove_row.workspace_id then
    raise exception 'Las personas no son del mismo grupo.';
  end if;
  if not has_role(keep_row.workspace_id, array['owner', 'admin']::member_role[]) then
    raise exception 'Solo owner/admin puede fusionar personas.';
  end if;
  if remove_row.role = 'owner' then
    raise exception 'No se puede eliminar al owner del grupo: fusioná en la otra dirección.';
  end if;
  if remove_row.user_id = auth.uid() then
    raise exception 'No podés eliminar tu propia persona: fusioná en la otra dirección.';
  end if;

  -- Repuntar la historia del duplicado al sobreviviente.
  update transactions set owner_member_id = p_keep where owner_member_id = p_remove;
  get diagnostics moved_transactions = row_count;

  update accounts set owner_member_id = p_keep where owner_member_id = p_remove;
  get diagnostics moved_accounts = row_count;

  -- Apodos privados (MEJ-8): `member:<remove>` → `member:<keep>`. Si un usuario ya
  -- tiene apodo para el sobreviviente, el del duplicado se descarta (unique por
  -- user/workspace/persona_key).
  delete from persona_aliases pa
    where pa.workspace_id = keep_row.workspace_id
      and pa.persona_key = 'member:' || p_remove
      and exists (
        select 1 from persona_aliases pk
        where pk.user_id = pa.user_id
          and pk.workspace_id = pa.workspace_id
          and pk.persona_key = 'member:' || p_keep
      );
  update persona_aliases
    set persona_key = 'member:' || p_keep
    where workspace_id = keep_row.workspace_id
      and persona_key = 'member:' || p_remove;

  -- Alias de matcheo de transferencias (IDENT-1 paso 4): unir los del duplicado en el
  -- sobreviviente, sumando también su nombre visible (así los comprobantes que decían
  -- ese nombre siguen matcheando). Dedupe case-insensitive conservando el orden.
  update workspace_members k
    set aliases = (
      select coalesce(array_agg(c.value order by c.ord), '{}')
      from (
        select distinct on (lower(trim(t.value))) t.value, t.ord
        from unnest(k.aliases || remove_row.aliases || array[remove_row.name])
          with ordinality as t(value, ord)
        where trim(coalesce(t.value, '')) <> ''
        order by lower(trim(t.value)), t.ord
      ) c
    )
    where k.id = p_keep;

  -- Invitaciones dirigidas al duplicado: revocarlas. Si quedaran pendientes, al borrar
  -- el miembro la FK las dejaría con member_id NULL y un link de promoción (de un solo
  -- uso) pasaría a ser un link genérico reutilizable.
  update invitations
    set status = 'revoked'
    where member_id = p_remove and status = 'pending';

  delete from workspace_members where id = p_remove;

  return jsonb_build_object(
    'transactions', moved_transactions,
    'accounts', moved_accounts
  );
end;
$$;

revoke all on function merge_members(uuid, uuid) from public;
grant execute on function merge_members(uuid, uuid) to authenticated;
