-- Enforce a private-storage allowance for every authenticated account.
create or replace function public.encrypted_storage_usage()
returns table (used_bytes bigint, quota_bytes bigint)
language sql
security definer
set search_path = public, storage
stable
as $$
  select
    coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)::bigint as used_bytes,
    (250 * 1024 * 1024)::bigint as quota_bytes
  from storage.objects o
  where o.bucket_id = 'encrypted-journal-assets'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

create or replace function public.encrypted_storage_upload_allowed(object_size bigint)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select coalesce((select used_bytes from public.encrypted_storage_usage()), 0)
    + greatest(coalesce(object_size, 0), 0)
    <= (250 * 1024 * 1024)::bigint;
$$;

revoke all on function public.encrypted_storage_usage() from public;
revoke all on function public.encrypted_storage_upload_allowed(bigint) from public;
grant execute on function public.encrypted_storage_usage() to authenticated;
grant execute on function public.encrypted_storage_upload_allowed(bigint) to authenticated;

drop policy if exists "own encrypted objects insert" on storage.objects;
create policy "own encrypted objects insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'encrypted-journal-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.encrypted_storage_upload_allowed(coalesce((metadata ->> 'size')::bigint, 0))
);
