-- Keep a durable, owner-scoped list of immutable media paths while a journal
-- is deleted. If Storage fails, the library can retry without the journal row.
create table public.pending_journal_asset_deletions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journal_id uuid not null,
  storage_paths text[] not null check (cardinality(storage_paths) > 0),
  created_at timestamptz not null default now()
);

alter table public.pending_journal_asset_deletions enable row level security;
revoke all on public.pending_journal_asset_deletions from public, anon, authenticated;
grant select on public.pending_journal_asset_deletions to authenticated;
create policy "read own pending asset deletions" on public.pending_journal_asset_deletions
  for select to authenticated using (owner_id = (select auth.uid()));

create function public.prepare_journal_asset_deletion(p_journal_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  user_id uuid := (select auth.uid());
  paths text[];
  job_id uuid;
begin
  if user_id is null then raise exception 'journal_not_accessible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(user_id::text, 7193));
  perform 1 from public.journals where id = p_journal_id and owner_id = user_id for update;
  if not found then raise exception 'journal_not_accessible'; end if;
  select array_agg(a.storage_path order by a.storage_path) into paths
  from public.encrypted_assets a where a.journal_id = p_journal_id and a.owner_id = user_id;
  if coalesce(cardinality(paths), 0) = 0 then return null; end if;
  insert into public.pending_journal_asset_deletions(owner_id, journal_id, storage_paths)
    values (user_id, p_journal_id, paths) returning id into job_id;
  return job_id;
end;
$$;
revoke all on function public.prepare_journal_asset_deletion(uuid) from public, anon;
grant execute on function public.prepare_journal_asset_deletion(uuid) to authenticated;

create function public.finish_journal_asset_deletion(p_job_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from public.pending_journal_asset_deletions
  where id = p_job_id and owner_id = (select auth.uid());
end;
$$;
revoke all on function public.finish_journal_asset_deletion(uuid) from public, anon;
grant execute on function public.finish_journal_asset_deletion(uuid) to authenticated;

-- Preserve the immutable-media rule, while allowing only explicitly queued
-- paths to be removed while their journal row still exists.
drop policy if exists "own encrypted objects delete" on storage.objects;
create policy "own encrypted objects delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'encrypted-journal-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    not exists (select 1 from public.journals j
      where j.id::text = (storage.foldername(name))[2] and j.owner_id = (select auth.uid()))
    or exists (select 1 from public.pending_journal_asset_deletions d
      where d.owner_id = (select auth.uid()) and name = any(d.storage_paths))
  )
);
