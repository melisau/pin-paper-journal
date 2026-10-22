-- Drawings now live inside the replaceable encrypted page payload. Count both
-- encrypted page bytes and immutable Storage files in one 250 MiB allowance.
create function public.journal_account_used_bytes(p_owner uuid)
returns bigint language sql volatile security definer
set search_path = public, storage
as $$
  select coalesce((select sum(octet_length(p.encrypted_payload::text)) from public.pages p where p.owner_id = p_owner), 0)::bigint
    + coalesce((select sum(coalesce((o.metadata ->> 'size')::bigint, 0)) from storage.objects o
      where o.bucket_id = 'encrypted-journal-assets' and (storage.foldername(o.name))[1] = p_owner::text), 0)::bigint;
$$;
revoke all on function public.journal_account_used_bytes(uuid) from public, anon, authenticated;

create or replace function public.encrypted_storage_usage()
returns table(used_bytes bigint, quota_bytes bigint)
language sql volatile security definer set search_path = public, storage
as $$ select public.journal_account_used_bytes((select auth.uid())), (250 * 1024 * 1024)::bigint; $$;

create or replace function public.encrypted_storage_upload_allowed(object_size bigint)
returns boolean language sql volatile security definer set search_path = public, storage
as $$ select (select auth.uid()) is not null and public.journal_account_used_bytes((select auth.uid()))
  + greatest(coalesce(object_size, 0), 0) <= (250 * 1024 * 1024)::bigint; $$;
revoke all on function public.encrypted_storage_usage() from public, anon;
revoke all on function public.encrypted_storage_upload_allowed(bigint) from public, anon;
grant execute on function public.encrypted_storage_usage() to authenticated;
grant execute on function public.encrypted_storage_upload_allowed(bigint) to authenticated;

-- Keep the tested CAS implementation private, and add an account lock and
-- final-size check around it. Exceeding quota rolls back pages AND revision.
alter function public.sync_encrypted_pages(uuid, jsonb, integer) rename to sync_encrypted_pages_cas;
revoke all on function public.sync_encrypted_pages_cas(uuid, jsonb, integer) from public, anon, authenticated;
create function public.sync_encrypted_pages(p_journal_id uuid, p_pages jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = public, storage
as $$
declare
  user_id uuid := (select auth.uid());
  next_revision integer;
  previous_bytes bigint;
  next_bytes bigint;
begin
  if user_id is null then raise exception 'journal_not_accessible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 7193));
  previous_bytes := public.journal_account_used_bytes(user_id);
  if exists(select 1 from jsonb_array_elements(p_pages) p where octet_length((p -> 'encrypted_payload')::text) > 2 * 1024 * 1024) then
    raise exception 'encrypted_page_too_large';
  end if;
  next_revision := public.sync_encrypted_pages_cas(p_journal_id, p_pages, p_expected_revision);
  next_bytes := public.journal_account_used_bytes(user_id);
  -- Existing over-quota accounts may still shrink their content to recover.
  if next_bytes > 250 * 1024 * 1024 and next_bytes > previous_bytes then raise exception 'encrypted_storage_quota_exceeded'; end if;
  return next_revision;
end;
$$;
revoke all on function public.sync_encrypted_pages(uuid, jsonb, integer) from public, anon;
grant execute on function public.sync_encrypted_pages(uuid, jsonb, integer) to authenticated;

-- Storage may insert a placeholder before updating its final trusted metadata.
-- Check both stages, under the SAME account lock used by page saves. This
-- closes the parallel-upload and photo-versus-inline-drawing quota races.
create function public.enforce_journal_storage_budget()
returns trigger language plpgsql security definer set search_path = public, storage
as $$
declare
  user_id uuid;
  previous_size bigint := 0;
  incoming_size bigint;
begin
  if new.bucket_id <> 'encrypted-journal-assets' then return new; end if;
  user_id := ((storage.foldername(new.name))[1])::uuid;
  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 7193));
  incoming_size := greatest(coalesce((new.metadata ->> 'size')::bigint, 0), 0);
  if incoming_size > 2 * 1024 * 1024 + 16 then raise exception 'encrypted_asset_too_large'; end if;
  if tg_op = 'UPDATE' then
    if old.name <> new.name or old.bucket_id <> new.bucket_id then raise exception 'encrypted_asset_move_not_allowed'; end if;
    previous_size := greatest(coalesce((old.metadata ->> 'size')::bigint, 0), 0);
  end if;
  if public.journal_account_used_bytes(user_id) - previous_size + incoming_size > 250 * 1024 * 1024 then
    raise exception 'encrypted_storage_quota_exceeded';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_journal_storage_budget() from public, anon, authenticated;
create trigger enforce_journal_storage_budget before insert or update on storage.objects
for each row execute function public.enforce_journal_storage_budget();

drop policy if exists "own encrypted objects insert" on storage.objects;
create policy "own encrypted objects insert" on storage.objects for insert to authenticated
with check(bucket_id = 'encrypted-journal-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.encrypted_storage_upload_allowed(coalesce((metadata ->> 'size')::bigint, 0)));
