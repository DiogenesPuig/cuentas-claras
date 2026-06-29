-- BUG-5: categoría global "Impuestos" para organismos y tributos.
-- workspace_id = NULL → disponible para todos los workspaces sin backfill.
insert into categories (workspace_id, name, kind, icon)
values (null, 'Impuestos', 'expense', '🧾');
