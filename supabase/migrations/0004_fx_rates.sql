-- ============================================================================
-- 0004_fx_rates — Cache diario de cotizaciones (C12)
-- ============================================================================
-- Tabla GLOBAL (no por workspace): las cotizaciones del dólar son universales,
-- no pertenecen a ningún workspace. El workspace solo elige cuál usa, vía sus
-- columnas `fx_source` / `fx_quote` (ver workspaces en 0001_init.sql).
--
-- Escritura: SOLO desde la edge function `fx-refresh` con la service_role key
--   (que saltea RLS). No se crea ninguna policy de INSERT/UPDATE → los roles
--   `anon` y `authenticated` no pueden escribir.
-- Lectura: cualquier usuario autenticado (las cotizaciones no son secretas).
-- ============================================================================

create table fx_rates (
  id          uuid primary key default gen_random_uuid(),
  date        date  not null,                 -- día de la cotización (fechaActualizacion truncada a YYYY-MM-DD)
  source      text  not null,                 -- 'dolarapi' | 'bcra' | 'manual'
  quote       text  not null,                 -- 'oficial' | 'blue' | 'mep' | ...  (espejo de workspaces.fx_quote)
  currency    char(3) not null,               -- ISO-4217, ej. 'USD'
  buy         numeric(18, 4),                 -- compra (puede faltar según la fuente)
  sell        numeric(18, 4),                 -- venta
  created_at  timestamptz not null default now(),
  -- Idempotencia: una sola fila por día / fuente / cotización / moneda.
  -- Permite el upsert de la función (re-correr el mismo día no duplica).
  unique (date, source, quote, currency)
);

-- Lookup típico del front: última cotización de una moneda para la fuente/quote
-- elegida por el workspace.
create index idx_fx_rates_lookup on fx_rates (currency, source, quote, date desc);

alter table fx_rates enable row level security;

-- Lectura para usuarios autenticados (no `anon`).
create policy fx_rates_select on fx_rates
  for select
  to authenticated
  using (true);
