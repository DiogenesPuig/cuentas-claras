-- IDENT-1 (paso 4): mover los alias de titular del medio a la PERSONA.
-- Los alias (MEJ-4 Parte A) eran nombres alternativos del titular de un medio 'transfer' por-persona
-- (ej. "Pepito" para "José Pérez"), usados para matchear el titular de un comprobante de transferencia
-- y no duplicar el medio. Con el medio 'transfer' COMPARTIDO (IDENT-1 3b) la persona del movimiento
-- vive en workspace_members, así que los alias pasan a la persona: sirven para matchear el titular de
-- un comprobante contra un miembro/placeholder. Aditivo: no cambia comportamiento hasta que el código
-- de matching (member-match) los use.

alter table workspace_members
  add column aliases text[] not null default '{}';

comment on column workspace_members.aliases is
  'IDENT-1 paso 4: nombres alternativos de la persona para matchear titulares de transferencias (MEJ-4A, movidos desde accounts.holder_aliases).';

-- Backfill: llevar los holder_aliases de cada medio 'transfer' VINCULADO a un miembro
-- (owner_member_id no nulo) a ese miembro, deduplicando y descartando vacíos. Los medios sin
-- owner_member_id (titulares no-miembros) conservan sus alias en accounts.holder_aliases hasta el
-- paso 5 (creación del placeholder + backfill de la persona del movimiento), que los moverá ahí.
update workspace_members wm
set aliases = merged.aliases
from (
  select a.owner_member_id as member_id,
         array_agg(distinct trim(al)) as aliases
  from accounts a
       cross join lateral unnest(a.holder_aliases) as al
  where a.owner_member_id is not null
    and coalesce(trim(al), '') <> ''
  group by a.owner_member_id
) merged
where wm.id = merged.member_id;

-- member_directory: exponer los alias (además de member_id + nombre vivo). El matching de personas en
-- el alta (member-match) sale de esta vista, así que necesita los alias del miembro/placeholder.
drop view if exists member_directory;
create view member_directory
with (security_invoker = false) as
  select
    wm.id                     as member_id,
    wm.workspace_id,
    wm.user_id,
    coalesce(p.name, wm.name) as name,
    wm.aliases,
    p.avatar_url,
    wm.role
  from workspace_members wm
  left join profiles p on p.id = wm.user_id
  where is_member(wm.workspace_id);
