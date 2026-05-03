-- =========================================================
-- Migration 012 — Buckets de Storage + RLS de upload
-- Garante que os buckets existam e que o upload/leitura
-- esteja liberado para usuários autenticados.
-- =========================================================

-- 1) Garantir que os buckets existam (idempotente).
--    public=true permite leitura via URL pública.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do update set public = true;

-- 2) Dropar políticas antigas que possamos ter criado nesses buckets
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='storage' and tablename='objects'
      and (
        policyname ilike '%documentos%' or
        policyname ilike '%evidencias%' or
        policyname in ('app_storage_select','app_storage_insert','app_storage_update','app_storage_delete')
      )
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end$$;

-- 3) Criar políticas permissivas para os 2 buckets (authenticated + anon)
create policy "app_storage_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id in ('documentos','evidencias'));

create policy "app_storage_insert" on storage.objects
  for insert to authenticated, anon
  with check (bucket_id in ('documentos','evidencias'));

create policy "app_storage_update" on storage.objects
  for update to authenticated, anon
  using (bucket_id in ('documentos','evidencias'))
  with check (bucket_id in ('documentos','evidencias'));

create policy "app_storage_delete" on storage.objects
  for delete to authenticated, anon
  using (bucket_id in ('documentos','evidencias'));

-- 4) Diagnóstico (descomente para verificar)
-- select id, name, public from storage.buckets where id in ('documentos','evidencias');
-- select policyname, cmd, roles from pg_policies
--   where schemaname='storage' and tablename='objects'
--   and policyname like 'app_%';
