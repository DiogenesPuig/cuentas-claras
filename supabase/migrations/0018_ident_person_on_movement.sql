-- IDENT-1 (paso 1: fundación del modelo, SIN backfill/colapso de datos).
-- "Persona en el movimiento": la persona pasa a ser un campo del movimiento (owner_member_id),
-- y workspace_members puede tener placeholders (personas del grupo sin cuenta). Todo aditivo /
-- nullable: no cambia el comportamiento hasta que el código y el backfill (pasos siguientes) lo usen.

-- 1. Placeholders: un miembro puede NO tener cuenta (user_id NULL) y traer su propio nombre.
--    Los miembros reales siguen sacando el nombre de `profiles` (vía member_directory). Un
--    placeholder (user_id NULL) NUNCA da acceso: is_member()/has_role() comparan user_id = auth.uid().
alter table workspace_members
  alter column user_id drop not null;
alter table workspace_members
  add column name text;  -- nombre del placeholder (NULL para miembros reales, que lo sacan de profiles)

comment on column workspace_members.name is
  'IDENT-1: nombre de la persona SIN cuenta (placeholder, user_id NULL). Miembros reales: NULL (nombre en profiles).';

-- 2. Persona del movimiento: apunta a un miembro (real o placeholder). NULL = se resuelve por el
--    medio (tarjeta) o queda "sin persona".
alter table transactions
  add column owner_member_id uuid references workspace_members (id) on delete set null;

create index idx_tx_owner_member on transactions (owner_member_id);

comment on column transactions.owner_member_id is
  'IDENT-1: persona del movimiento (workspace_members, incluye placeholders). Fuente de verdad de "quién"; el medio deja de ser la única vía.';

-- 3. member_directory: incluir placeholders. LEFT join a profiles y el nombre sale de profiles
--    (miembro real) o de workspace_members.name (placeholder). Se agrega `member_id` (id de la fila
--    de workspace_members) sin quitar las columnas existentes (consumidores actuales siguen andando).
drop view if exists member_directory;
create view member_directory
with (security_invoker = false) as
  select
    wm.id                     as member_id,
    wm.workspace_id,
    wm.user_id,
    coalesce(p.name, wm.name) as name,
    p.avatar_url,
    wm.role
  from workspace_members wm
  left join profiles p on p.id = wm.user_id
  where is_member(wm.workspace_id);

-- 4. Integridad: el owner_member_id de un movimiento debe ser de un miembro del MISMO workspace.
--    (No se puede expresar con un CHECK; va por trigger. SECURITY DEFINER para leer members sin RLS.)
create or replace function tx_owner_member_same_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_member_id is not null
     and not exists (
       select 1 from workspace_members wm
       where wm.id = new.owner_member_id
         and wm.workspace_id = new.workspace_id
     ) then
    raise exception 'owner_member_id % no pertenece al workspace %',
      new.owner_member_id, new.workspace_id;
  end if;
  return new;
end;
$$;

create trigger trg_tx_owner_member_ws
  before insert or update of owner_member_id, workspace_id on transactions
  for each row execute function tx_owner_member_same_workspace();
