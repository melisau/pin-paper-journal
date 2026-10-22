-- One journal lock protects the revision check and the entire page replacement.
alter table public.journals add column content_revision integer not null default 0;

-- Old clients must fail closed instead of bypassing the revision check.
drop function public.sync_encrypted_pages(uuid, jsonb);

create function public.load_encrypted_journal_snapshot(p_journal_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'revision', j.content_revision,
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'encrypted_payload', p.encrypted_payload,
      'position', p.position, 'updated_at', p.updated_at
    ) order by p.position) from public.pages p where p.journal_id = j.id), '[]'::jsonb)
  ) from public.journals j
  where j.id = p_journal_id and j.owner_id = (select auth.uid());
$$;

create function public.sync_encrypted_pages(p_journal_id uuid, p_pages jsonb, p_expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_revision integer;
  page_record record;
begin
  select content_revision into current_revision from public.journals
  where id = p_journal_id and owner_id = current_user_id for update;
  if not found or current_user_id is null then
    raise exception 'journal_not_accessible';
  end if;
  if p_expected_revision is null or p_expected_revision <> current_revision then
    raise exception using message = 'journal_revision_conflict', errcode = 'P0001';
  end if;
  if p_pages is null or jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) > 500 then
    raise exception 'invalid_page_batch';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_pages) as x(id uuid, position integer, encrypted_payload jsonb)
    where x.id is null or x.position is null or x.position < 0 or x.position >= jsonb_array_length(p_pages)
      or x.encrypted_payload is null)
    or (select count(distinct x.id) from jsonb_to_recordset(p_pages) as x(id uuid)) <> jsonb_array_length(p_pages)
    or (select count(distinct x.position) from jsonb_to_recordset(p_pages) as x(position integer)) <> jsonb_array_length(p_pages)
    or exists (select 1 from jsonb_to_recordset(p_pages) as x(id uuid) join public.pages p on p.id = x.id
      where p.journal_id <> p_journal_id or p.owner_id <> current_user_id) then
    raise exception 'invalid_page_record';
  end if;

  update public.pages set position = position + 1000000 where journal_id = p_journal_id;
  for page_record in select * from jsonb_to_recordset(p_pages) as x(id uuid, position integer, encrypted_payload jsonb) loop
    insert into public.pages(id, journal_id, owner_id, encrypted_payload, position, updated_at)
    values(page_record.id, p_journal_id, current_user_id, page_record.encrypted_payload, page_record.position, now())
    on conflict(id) do update set encrypted_payload = excluded.encrypted_payload, position = excluded.position, updated_at = now()
      where pages.journal_id = p_journal_id and pages.owner_id = current_user_id;
    if not found then raise exception 'invalid_page_record'; end if;
  end loop;
  delete from public.pages p where p.journal_id = p_journal_id
    and not exists (select 1 from jsonb_to_recordset(p_pages) as incoming(id uuid) where incoming.id = p.id);
  update public.journals set content_revision = current_revision + 1, updated_at = now() where id = p_journal_id;
  return current_revision + 1;
end;
$$;

-- Direct writes and version-column edits must not bypass the checked RPC.
revoke insert, update, delete on public.pages from public, authenticated, anon;
revoke update on public.journals from public, authenticated, anon;
grant update(encrypted_metadata, wrapped_key_by_master, wrapped_key_by_password, is_password_protected, updated_at)
  on public.journals to authenticated;
revoke all on function public.load_encrypted_journal_snapshot(uuid) from public, anon;
revoke all on function public.sync_encrypted_pages(uuid, jsonb, integer) from public, anon;
grant execute on function public.load_encrypted_journal_snapshot(uuid) to authenticated;
grant execute on function public.sync_encrypted_pages(uuid, jsonb, integer) to authenticated;

-- Encrypted payloads hide media references from PostgreSQL. Keep immutable
-- assets on ordinary saves: a stale client cannot safely decide what to delete.
drop policy "own encrypted objects delete" on storage.objects;
create policy "own encrypted objects delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'encrypted-journal-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.journals j
    where j.id::text = (storage.foldername(name))[2] and j.owner_id = (select auth.uid()))
);
drop policy "own encrypted objects update" on storage.objects;
