-- MEJ-4 Parte A — Alias de titulares.
-- Nombres alternativos del titular de un medio 'transfer' (ej. "Pepito" para "José Pérez",
-- o variantes de orden/tildes que la heurística no colapsa sola). Sirven para el matching
-- futuro: evitan crear medios 'transfer' duplicados para la misma persona. No mueve datos
-- existentes. La RLS de `accounts` ya cubre esta columna (no requiere política nueva).
alter table accounts
  add column holder_aliases text[] not null default '{}';

comment on column accounts.holder_aliases is
  'MEJ-4: nombres alternativos del titular para el matching de medios transfer (no mueve movimientos).';
