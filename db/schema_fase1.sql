-- ============================================================================
-- Cuentas Claras — Esquema de base de datos (Fase 1)
-- Motor: PostgreSQL (compatible con Supabase)
-- Versión: 1.0  |  Fecha: 2026-06-17
--
-- Alcance Fase 1:
--   profiles, workspaces, workspace_members, invitations,
--   accounts (tarjetas/medios), categories, transactions, attachments.
-- Fases posteriores (NO incluidas aquí): statement_imports,
--   transaction_splits, settlements, integración WhatsApp.
--
-- Notas:
--   * En Supabase, la identidad vive en auth.users. Acá creamos `profiles`
--     (1:1 con auth.users) para los datos de la app.
--   * Aislamiento entre workspaces vía Row Level Security (RLS).
--   * Todo `id` es UUID. Montos en NUMERIC(14,2). Moneda en ISO-4217 (3 letras).
-- ============================================================================

-- Extensiones --------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- ENUMS
-- ============================================================================
create type member_role     as enum ('owner', 'admin', 'member', 'viewer');
create type account_type     as enum ('credit', 'debit', 'cash', 'wallet', 'bank_account');
create type card_network     as enum ('visa', 'mastercard', 'amex', 'cabal', 'other');
create type category_kind    as enum ('expense', 'income');
create type transaction_type as enum ('expense', 'income');
create type transaction_source as enum ('manual', 'whatsapp', 'ocr', 'statement_import');
create type attachment_kind  as enum ('receipt', 'statement');
create type attachment_status as enum ('uploaded', 'processed', 'failed');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- ============================================================================
-- FUNCIÓN: updated_at automático
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES  (1:1 con auth.users)
--   El phone_number es interno: nunca se expone a otros miembros (solo el name).
-- ============================================================================
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  avatar_url    text,
  phone_number  text unique,                       -- privado, para WhatsApp
  notify_prefs  jsonb not null default
                  '{"channel":"whatsapp","email_fallback":true,
                    "events":{"income":true,"card_close":true}}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_profiles_updated
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- WORKSPACES  (un usuario individual = workspace de 1 miembro)
-- ============================================================================
create table workspaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  base_currency  char(3) not null default 'ARS',   -- ISO-4217
  fx_source      text not null default 'dolarapi',  -- 'dolarapi' | 'bcra' | 'manual'
  fx_quote       text not null default 'oficial',   -- 'oficial' | 'blue' | 'mep' | ...
  owner_id       uuid not null references profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_workspaces_updated
  before update on workspaces
  for each row execute function set_updated_at();

-- ============================================================================
-- WORKSPACE_MEMBERS  (vínculo usuario ↔ workspace + rol)
-- ============================================================================
create table workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  user_id       uuid references profiles (id)   on delete cascade,  -- NULL = persona sin cuenta (placeholder, IDENT-1)
  name          text,                                                -- nombre del placeholder (IDENT-1); miembros reales lo sacan de profiles
  aliases       text[] not null default '{}',                        -- IDENT-1 paso 4: nombres alternativos p/ matchear titulares de transferencias (MEJ-4A, movidos desde accounts)
  role          member_role not null default 'member',
  joined_at     timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index idx_members_workspace on workspace_members (workspace_id);
create index idx_members_user      on workspace_members (user_id);

-- ============================================================================
-- HELPER: ¿el usuario actual es miembro del workspace?  (evita recursión RLS)
-- SECURITY DEFINER para poder leer workspace_members sin disparar su RLS.
-- ============================================================================
create or replace function is_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function has_role(ws uuid, roles member_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- ============================================================================
-- INVITATIONS
-- ============================================================================
create table invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  email         text not null,
  role          member_role not null default 'member',
  token         text not null unique default encode(gen_random_bytes(24), 'hex'),
  status        invitation_status not null default 'pending',
  invited_by    uuid not null references profiles (id),
  member_id     uuid references workspace_members (id) on delete set null, -- IDENT-1 paso 6: invitación dirigida a un placeholder (lo promueve al aceptar)
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

create index idx_invitations_workspace on invitations (workspace_id);
create index idx_invitations_email      on invitations (lower(email));

-- ============================================================================
-- HELPERS: aceptar invitación por token (C15)
--   La policy `inv_admin` (más abajo) solo deja ver/escribir invitations a
--   owner/admin. Quien todavía no es miembro no puede leer su propia
--   invitación por select normal, así que estas funciones SECURITY DEFINER
--   validan el token y hacen el alta de forma controlada.
-- ============================================================================
-- invitation_preview: incluye member_name (nombre del placeholder destino, IDENT-1 paso 6).
create or replace function invitation_preview(p_token text)
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
    wm.name                                           as member_name
  from invitations i
  join workspaces w on w.id = i.workspace_id
  left join workspace_members wm on wm.id = i.member_id
  where i.token = p_token;
$$;

revoke all on function invitation_preview(text) from public;
grant execute on function invitation_preview(text) to authenticated;

-- accept_invitation: asegura el perfil (BUG-2), promueve un placeholder si la invitación lo apunta
-- (IDENT-1 paso 6), y no consume los links genéricos (solo email/dirigidas son de un solo uso).
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

  -- Promoción de un placeholder (IDENT-1 paso 6): setea user_id en la fila existente.
  if inv.member_id is not null then
    select * into target from workspace_members
      where id = inv.member_id and workspace_id = inv.workspace_id;
    if target.id is not null and target.user_id is null then
      if exists (
        select 1 from workspace_members
        where workspace_id = inv.workspace_id and user_id = auth.uid()
      ) then
        raise exception 'Ya sos miembro de este grupo; no se puede vincular a otra persona.';
      end if;
      update workspace_members
        set user_id = auth.uid(), role = inv.role
        where id = target.id;
      update invitations set status = 'accepted' where id = inv.id;
      return inv.workspace_id;
    end if;
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  if inv.email is not null then
    update invitations set status = 'accepted' where id = inv.id;
  end if;

  return inv.workspace_id;
end;
$$;

revoke all on function accept_invitation(text) from public;
grant execute on function accept_invitation(text) to authenticated;

-- ============================================================================
-- ACCOUNTS  (tarjetas / medios de pago)
-- ============================================================================
create table accounts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces (id) on delete cascade,
  name              text not null,                         -- ej. "Visa Nación Pepito"
  bank              text,                                  -- ej. "Banco Nación"
  network           card_network,                          -- visa | mastercard | ... (null si no es tarjeta)
  type              account_type not null,
  currency          char(3) not null default 'ARS',
  last4             char(4),
  -- Persona dueña/usuaria del medio (titular o extensión). La persona del
  -- movimiento se deduce de acá; no se elige en cada alta.
  owner_member_id   uuid references workspace_members (id) on delete set null, -- si usa la app
  holder_name       text not null,                         -- nombre del que la usa (ej. "Pepito")
  holder_aliases    text[] not null default '{}',          -- MEJ-4: nombres alternativos p/ matching (medio transfer)
  -- Extensiones: cada extensión es su propio medio; opcionalmente apunta a la titular
  is_extension      boolean not null default false,
  parent_account_id uuid references accounts (id) on delete set null,
  billing_close_day smallint check (billing_close_day between 1 and 31), -- ciclo configurable
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_accounts_workspace on accounts (workspace_id);
create index idx_accounts_owner     on accounts (owner_member_id);
create index idx_accounts_parent    on accounts (parent_account_id);

create trigger trg_accounts_updated
  before update on accounts
  for each row execute function set_updated_at();

-- ============================================================================
-- CATEGORIES
--   workspace_id NULL = categoría global por defecto (visible para todos).
-- ============================================================================
create table categories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces (id) on delete cascade,  -- NULL = global
  name          text not null,
  kind          category_kind not null,
  icon          text,
  color         text,
  parent_id     uuid references categories (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_categories_workspace on categories (workspace_id);

-- ============================================================================
-- ATTACHMENTS  (comprobantes / resúmenes). En Fase 1 solo se guardan.
-- ============================================================================
create table attachments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces (id) on delete cascade,
  uploaded_by       uuid not null references profiles (id),
  file_url          text not null,
  file_type         text not null,                       -- 'image' | 'pdf'
  kind              attachment_kind not null default 'receipt',
  status            attachment_status not null default 'uploaded',
  content_hash      text,                                 -- SHA-256 del archivo (F2-13, aviso de duplicado)
  created_at        timestamptz not null default now()
);

-- F2-13: buscar comprobantes por hash de contenido (no único: aviso suave, no bloqueo).
create index idx_attachments_ws_hash
  on attachments (workspace_id, content_hash)
  where content_hash is not null;

create index idx_attachments_workspace on attachments (workspace_id);

-- ============================================================================
-- TRANSACTIONS  (entidad central: ingresos y gastos)
-- ============================================================================
create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces (id) on delete cascade,
  type                transaction_type not null,
  amount              numeric(14,2) not null check (amount <> 0),  -- monto original (negativo = reintegro, ver 0008)
  currency            char(3) not null,                            -- moneda original
  amount_base         numeric(14,2),                               -- convertido a base_currency
  fx_rate             numeric(18,6),                               -- tipo de cambio aplicado
  fx_date             date,                                        -- fecha del FX usado
  occurred_on         date not null default current_date,          -- cuándo ocurrió
  charged_on          date,                                        -- cuándo se cobra/imputa (base del FX y del ciclo)
  description         text,
  category_id         uuid references categories (id)         on delete set null,
  account_id          uuid references accounts (id)           on delete set null,  -- medio/tarjeta usado
  owner_member_id     uuid references workspace_members (id)  on delete set null,  -- IDENT-1: persona del movimiento (fuente de verdad; el medio deja de ser la única vía)
  created_by          uuid not null references profiles (id),
  source              transaction_source not null default 'manual',
  is_shared           boolean not null default false,              -- base para "quién debe a quién"
  attachment_id       uuid references attachments (id)        on delete set null,
  external_hash       text,                                        -- detección de duplicados
  installment_n       smallint,                                    -- nº de cuota cobrada (ej. 2); NULL si no es en cuotas
  installment_total   smallint,                                    -- total de cuotas del plan (ej. 3); NULL si no es en cuotas
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Coherencia del rango solo cuando ambas están presentes (ver 0007).
  constraint transactions_installment_range_check check (
    installment_n is null
    or installment_total is null
    or (installment_n >= 1 and installment_n <= installment_total)
  )
);

-- Índices para los filtros/reportes más comunes
create index idx_tx_workspace        on transactions (workspace_id);
create index idx_tx_ws_charged       on transactions (workspace_id, charged_on);
create index idx_tx_ws_occurred      on transactions (workspace_id, occurred_on);
create index idx_tx_account          on transactions (account_id);
create index idx_tx_category         on transactions (category_id);
-- Evita importar dos veces el mismo movimiento de un resumen
create unique index uq_tx_external_hash
  on transactions (workspace_id, external_hash)
  where external_hash is not null;

create trigger trg_transactions_updated
  before update on transactions
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
--   Regla general: un usuario solo accede a filas de workspaces a los que
--   pertenece. Escritura/borrado de configuración: owner/admin.
-- ============================================================================
alter table profiles          enable row level security;
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table invitations       enable row level security;
alter table accounts          enable row level security;
alter table categories        enable row level security;
alter table attachments       enable row level security;
alter table transactions      enable row level security;

-- PROFILES: cada quien gestiona su propio perfil ---------------------------
create policy profiles_select_self on profiles
  for select using (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());
create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

-- WORKSPACES ---------------------------------------------------------------
-- ws_select incluye "owner_id = auth.uid()" además de is_member(id): el
-- INSERT de createWorkspace pide RETURNING, y Postgres aplica también la
-- política de SELECT sobre la fila nueva. En ese instante el creador
-- todavía no es miembro (el trigger trg_ws_add_owner lo agrega después),
-- así que con solo is_member(id) el alta del primer workspace fallaba
-- para cualquier usuario (bug detectado al verificar B8 manualmente).
create policy ws_select on workspaces
  for select using (is_member(id) or owner_id = auth.uid());
create policy ws_insert on workspaces
  for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces
  for update using (has_role(id, array['owner','admin']::member_role[]));
create policy ws_delete on workspaces
  for delete using (has_role(id, array['owner']::member_role[]));

-- WORKSPACE_MEMBERS --------------------------------------------------------
create policy wm_select on workspace_members
  for select using (is_member(workspace_id));
create policy wm_write on workspace_members
  for all using (has_role(workspace_id, array['owner','admin']::member_role[]))
  with check (has_role(workspace_id, array['owner','admin']::member_role[]));

-- INVITATIONS --------------------------------------------------------------
create policy inv_admin on invitations
  for all using (has_role(workspace_id, array['owner','admin']::member_role[]))
  with check (has_role(workspace_id, array['owner','admin']::member_role[]));

-- ACCOUNTS -----------------------------------------------------------------
create policy acc_select on accounts
  for select using (is_member(workspace_id));
create policy acc_write on accounts
  for all using (has_role(workspace_id, array['owner','admin']::member_role[]))
  with check (has_role(workspace_id, array['owner','admin']::member_role[]));

-- CATEGORIES (las globales, workspace_id IS NULL, son visibles para todos) --
create policy cat_select on categories
  for select using (workspace_id is null or is_member(workspace_id));
create policy cat_write on categories
  for all using (workspace_id is not null
                 and has_role(workspace_id, array['owner','admin']::member_role[]))
  with check (workspace_id is not null
                 and has_role(workspace_id, array['owner','admin']::member_role[]));

-- ATTACHMENTS --------------------------------------------------------------
create policy att_select on attachments
  for select using (is_member(workspace_id));
create policy att_insert on attachments
  for insert with check (is_member(workspace_id) and uploaded_by = auth.uid());
create policy att_delete on attachments
  for delete using (has_role(workspace_id, array['owner','admin']::member_role[]));

-- TRANSACTIONS -------------------------------------------------------------
-- Lectura: cualquier miembro. Inserción: cualquier miembro (registra el suyo).
-- Edición/borrado: el autor, o admin/owner del workspace.
create policy tx_select on transactions
  for select using (is_member(workspace_id));
create policy tx_insert on transactions
  for insert with check (is_member(workspace_id) and created_by = auth.uid());
create policy tx_update on transactions
  for update using (
    created_by = auth.uid()
    or has_role(workspace_id, array['owner','admin']::member_role[])
  );
create policy tx_delete on transactions
  for delete using (
    created_by = auth.uid()
    or has_role(workspace_id, array['owner','admin']::member_role[])
  );

-- ============================================================================
-- VISTA: directorio de miembros (privacidad de teléfono)
--   profiles queda accesible SOLO para el propio usuario (RLS self).
--   Para que los co-miembros se vean entre sí, exponemos esta vista con
--   columnas SEGURAS (nombre, avatar) — el phone_number NO se incluye.
--   security_invoker=false: la vista lee profiles como owner (bypass RLS),
--   pero el WHERE is_member() limita las filas a los workspaces del que llama.
-- ============================================================================
create view member_directory
with (security_invoker = false) as
  select
    wm.id                     as member_id,          -- IDENT-1
    wm.workspace_id,
    wm.user_id,                                       -- NULL para placeholders (IDENT-1)
    coalesce(p.name, wm.name) as name,               -- IDENT-1: profile (miembro real) o placeholder
    wm.aliases,                                       -- IDENT-1 paso 4: alias de la persona (matching de transferencias)
    p.avatar_url,
    wm.role
  from workspace_members wm
  left join profiles p on p.id = wm.user_id          -- LEFT para incluir placeholders (IDENT-1)
  where is_member(wm.workspace_id);

-- ============================================================================
-- TRIGGER: al crear un workspace, agregar al creador como owner
-- ============================================================================
create or replace function add_owner_on_workspace_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger trg_ws_add_owner
  after insert on workspaces
  for each row execute function add_owner_on_workspace_create();

-- ============================================================================
-- FX_RATES (C12): cotizaciones cacheadas (migración 0004). Reference/global; la
--   escribe la edge function `fx-refresh` con service_role (bypassa RLS); el front
--   solo lee. RLS: lectura para usuarios autenticados; sin policy de escritura.
-- ============================================================================
create table fx_rates (
  id          uuid primary key default gen_random_uuid(),
  date        date  not null,                 -- día de la cotización
  source      text  not null,                 -- 'dolarapi' | 'bcra' | 'manual'
  quote       text  not null,                 -- 'oficial' | 'blue' | 'mep' | ...
  currency    char(3) not null,               -- ISO-4217, ej. 'USD'
  buy         numeric(18, 4),                 -- compra (puede faltar según la fuente)
  sell        numeric(18, 4),                 -- venta
  created_at  timestamptz not null default now(),
  unique (date, source, quote, currency)      -- idempotencia del upsert diario
);

create index idx_fx_rates_lookup on fx_rates (currency, source, quote, date desc);

alter table fx_rates enable row level security;

-- Lectura para usuarios autenticados (no `anon`). Escritura: solo service_role (edge function).
create policy fx_rates_select on fx_rates
  for select
  to authenticated
  using (true);

-- ============================================================================
-- PERSONA_ALIASES (MEJ-8): apodos PRIVADOS por usuario para "personas" del reporte
--   Cada usuario le pone un nombre alternativo a una persona (miembro o titular ajeno)
--   que solo ve él. persona_key = `member:<owner_member_id>` o `name:<holder normalizado>`.
--   RLS: cada uno ve/edita SOLO sus apodos, y solo en workspaces a los que pertenece.
-- ============================================================================
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

create policy pa_select on persona_aliases
  for select using (user_id = auth.uid() and is_member(workspace_id));
create policy pa_insert on persona_aliases
  for insert with check (user_id = auth.uid() and is_member(workspace_id));
create policy pa_update on persona_aliases
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_member(workspace_id));
create policy pa_delete on persona_aliases
  for delete using (user_id = auth.uid());

-- ============================================================================
-- SEED: categorías globales por defecto (workspace_id = NULL)
-- ============================================================================
insert into categories (workspace_id, name, kind, icon) values
  (null, 'Supermercado',    'expense', '🛒'),
  (null, 'Alquiler',        'expense', '🏠'),
  (null, 'Servicios',       'expense', '💡'),
  (null, 'Impuestos',       'expense', '🧾'),
  (null, 'Transporte',      'expense', '🚗'),
  (null, 'Salud',           'expense', '⚕️'),
  (null, 'Ocio',            'expense', '🎉'),
  (null, 'Restaurantes',    'expense', '🍽️'),
  (null, 'Educación',       'expense', '📚'),
  (null, 'Compras',         'expense', '🛍️'),
  (null, 'Otros gastos',    'expense', '📦'),
  (null, 'Sueldo',          'income',  '💼'),
  (null, 'Transferencia',   'income',  '💸'),
  (null, 'Reintegro',       'income',  '↩️'),
  (null, 'Otros ingresos',  'income',  '➕');

-- ============================================================================
-- STORAGE: bucket de comprobantes (B8 — FR-10)
--   Bucket privado: el archivo no es accesible por URL pública, solo vía
--   signed URL generada por el front para un miembro del workspace.
--   Convención de path: '{workspace_id}/{nombre de archivo}', así las
--   políticas de storage.objects pueden leer el workspace desde la ruta sin
--   tocar la tabla `attachments`.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'attachments'
    and is_member((storage.foldername(name))[1]::uuid)
  );

create policy attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and is_member((storage.foldername(name))[1]::uuid)
    and owner = auth.uid()
  );

create policy attachments_storage_delete on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and has_role((storage.foldername(name))[1]::uuid, array['owner','admin']::member_role[])
  );

-- ============================================================================
-- FIN — schema Fase 1
-- ============================================================================
-- (v1.0 · Fase 1 · Cuentas Claras)
