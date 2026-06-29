-- MEJ-8: apodos PRIVADOS por usuario para "personas" de un workspace.
-- Cada usuario le puede poner un nombre alternativo a una persona (miembro o titular
-- ajeno) que solo ve él. Persisten en la DB (sincronizan entre dispositivos) y la RLS
-- garantiza que nadie ve ni edita los apodos de otro.
--   persona_key: identidad de persona de los reportes → `member:<owner_member_id>` o
--   `name:<holder normalizado>` (ver lib/name-match.normalizeNameKey).
create table persona_aliases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  persona_key  text not null,
  alias        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, workspace_id, persona_key)
);

create index persona_aliases_user_ws_idx on persona_aliases (user_id, workspace_id);

create trigger trg_persona_aliases_updated
  before update on persona_aliases
  for each row execute function set_updated_at();

alter table persona_aliases enable row level security;

-- Cada usuario ve/gestiona SOLO sus propios apodos, y solo en workspaces a los que pertenece.
create policy pa_select on persona_aliases
  for select using (user_id = auth.uid() and is_member(workspace_id));
create policy pa_insert on persona_aliases
  for insert with check (user_id = auth.uid() and is_member(workspace_id));
create policy pa_update on persona_aliases
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(workspace_id));
create policy pa_delete on persona_aliases
  for delete using (user_id = auth.uid());
