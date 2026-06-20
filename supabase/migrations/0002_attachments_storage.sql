-- ============================================================================
-- Bucket de Storage para comprobantes (B8 — FR-10). Espejo de la sección
-- "STORAGE" agregada a db/schema_fase1.sql.
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
