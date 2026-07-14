-- MEJ-16 — Separar "Transporte" (viajes) de "Auto" (vehículo).
-- Las categorías default son GLOBALES (workspace_id NULL), compartidas por todos los workspaces, así
-- que alcanza con agregar una sola categoría global "Auto" (aparece en todos, existentes y nuevos) y
-- retocar el emoji de "Transporte". No re-categoriza los movimientos viejos (quedan como estaban).

-- Transporte pasa a representar viajes/público/apps → emoji de colectivo.
update categories
  set icon = '🚌'
  where workspace_id is null and name = 'Transporte' and icon = '🚗';

-- Nueva categoría global "Auto" (vehículo: combustible, service, patente, peajes). Guardado idempotente.
insert into categories (workspace_id, name, kind, icon)
select null, 'Auto', 'expense', '🚙'
where not exists (
  select 1 from categories where workspace_id is null and name = 'Auto'
);
