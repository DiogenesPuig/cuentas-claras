-- F2-13: hash del contenido del comprobante, para avisar "ya subiste este archivo".
-- NO es índice único (no bloquea): dos compras legítimas pueden compartir comprobante;
-- el aviso es suave y lo confirma el usuario. Solo acelera la búsqueda por hash.
alter table attachments add column content_hash text;

create index idx_attachments_ws_hash
  on attachments (workspace_id, content_hash)
  where content_hash is not null;
