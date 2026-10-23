-- Atomically enqueue immutable asset paths and remove their journal. The
-- transaction either commits both, or leaves the journal untouched.
create function public.delete_encrypted_journal_with_cleanup(p_journal_id uuid)
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
  if coalesce(cardinality(paths), 0) > 0 then
    insert into public.pending_journal_asset_deletions(owner_id, journal_id, storage_paths)
      values (user_id, p_journal_id, paths) returning id into job_id;
  end if;
  delete from public.journals where id = p_journal_id and owner_id = user_id;
  return job_id;
end;
$$;
revoke all on function public.delete_encrypted_journal_with_cleanup(uuid) from public, anon;
grant execute on function public.delete_encrypted_journal_with_cleanup(uuid) to authenticated;
drop function public.prepare_journal_asset_deletion(uuid);
