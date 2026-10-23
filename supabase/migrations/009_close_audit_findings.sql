-- J-03: Storage creates placeholder rows and fills measured metadata after the
-- object upload. Do not let a completed metadata update bypass quota accounting
-- by omitting its measured size. The existing per-user advisory lock serializes
-- this check with every other asset/page write for the account.
create or replace function public.enforce_journal_storage_budget()
returns trigger language plpgsql security definer set search_path = public, storage
as $$
declare
  user_id uuid;
  previous_size bigint := 0;
  incoming_size bigint := 0;
  size_text text;
begin
  if new.bucket_id <> 'encrypted-journal-assets' then return new; end if;
  user_id := ((storage.foldername(new.name))[1])::uuid;
  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 7193));
  size_text := new.metadata ->> 'size';
  if tg_op = 'UPDATE' and (size_text is null or size_text !~ '^[0-9]+$') then
    raise exception 'encrypted_asset_size_missing';
  end if;
  if size_text is not null then
    if size_text !~ '^[0-9]+$' then raise exception 'encrypted_asset_size_invalid'; end if;
    incoming_size := size_text::bigint;
  end if;
  if incoming_size > 2 * 1024 * 1024 + 16 then raise exception 'encrypted_asset_too_large'; end if;
  if tg_op = 'UPDATE' then
    if old.name <> new.name or old.bucket_id <> new.bucket_id then raise exception 'encrypted_asset_move_not_allowed'; end if;
    previous_size := coalesce((old.metadata ->> 'size')::bigint, 0);
  end if;
  if public.journal_account_used_bytes(user_id) - previous_size + incoming_size > 250 * 1024 * 1024 then
    raise exception 'encrypted_storage_quota_exceeded';
  end if;
  return new;
end;
$$;

-- J-04: Bound both the complete JSON request and every encrypted page before
-- running the version check or performing any writes. Keep the existing CAS,
-- account lock, quota checks, and shrink-while-over-quota behavior unchanged.
create or replace function public.sync_encrypted_pages(p_journal_id uuid, p_pages jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = public, storage
as $$
declare
  user_id uuid := (select auth.uid());
  next_revision integer;
  previous_bytes bigint;
  next_bytes bigint;
begin
  if user_id is null then raise exception 'journal_not_accessible'; end if;
  if p_pages is null or jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) > 500 then
    raise exception 'invalid_page_batch';
  end if;
  if octet_length(p_pages::text) > 8 * 1024 * 1024 then raise exception 'page_batch_too_large'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pages) as x(encrypted_payload jsonb)
    where jsonb_typeof(x.encrypted_payload) <> 'object'
      or octet_length(x.encrypted_payload::text) > 2 * 1024 * 1024
  ) then raise exception 'page_payload_too_large'; end if;

  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 7193));
  previous_bytes := public.journal_account_used_bytes(user_id);
  next_revision := public.sync_encrypted_pages_cas(p_journal_id, p_pages, p_expected_revision);
  next_bytes := public.journal_account_used_bytes(user_id);
  if next_bytes > 250 * 1024 * 1024 and next_bytes > previous_bytes then raise exception 'encrypted_storage_quota_exceeded'; end if;
  return next_revision;
end;
$$;
revoke all on function public.sync_encrypted_pages(uuid, jsonb, integer) from public, anon;
grant execute on function public.sync_encrypted_pages(uuid, jsonb, integer) to authenticated;

-- J-05: Asset metadata may only link to a page in this same owned journal, and
-- its immutable Storage key must match the canonical user/journal/asset path.
-- page_id remains nullable because current uploads are staged before page sync.
drop policy if exists "own assets only" on public.encrypted_assets;
create policy "own assets only" on public.encrypted_assets for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (select 1 from public.journals j where j.id = encrypted_assets.journal_id and j.owner_id = (select auth.uid()))
  and (page_id is null or exists (
    select 1 from public.pages p
    where p.id = encrypted_assets.page_id and p.journal_id = encrypted_assets.journal_id and p.owner_id = encrypted_assets.owner_id
  ))
  and storage_path = encrypted_assets.owner_id::text || '/' || encrypted_assets.journal_id::text || '/' || encrypted_assets.id::text || '.bin'
)
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.journals j where j.id = encrypted_assets.journal_id and j.owner_id = (select auth.uid()))
  and (page_id is null or exists (
    select 1 from public.pages p
    where p.id = encrypted_assets.page_id and p.journal_id = encrypted_assets.journal_id and p.owner_id = encrypted_assets.owner_id
  ))
  and storage_path = encrypted_assets.owner_id::text || '/' || encrypted_assets.journal_id::text || '/' || encrypted_assets.id::text || '.bin'
);
