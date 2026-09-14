create or replace function public.sync_encrypted_pages(p_journal_id uuid, p_pages jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  page_record record;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not exists (
    select 1 from public.journals where id = p_journal_id and owner_id = current_user_id
  ) then
    raise exception 'journal_not_accessible';
  end if;

  if p_pages is null or jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) > 500 then
    raise exception 'invalid_page_batch';
  end if;

  update public.pages
  set position = position + 1000000
  where journal_id = p_journal_id and owner_id = current_user_id;

  for page_record in
    select * from jsonb_to_recordset(p_pages)
      as item(id uuid, position integer, encrypted_payload jsonb)
  loop
    if page_record.position < 0 or page_record.encrypted_payload is null then
      raise exception 'invalid_page_record';
    end if;
    insert into public.pages (id, journal_id, owner_id, encrypted_payload, position, updated_at)
    values (page_record.id, p_journal_id, current_user_id, page_record.encrypted_payload, page_record.position, now())
    on conflict (id) do update
      set encrypted_payload = excluded.encrypted_payload,
          position = excluded.position,
          updated_at = now()
      where pages.journal_id = p_journal_id and pages.owner_id = current_user_id;
  end loop;

  delete from public.pages as existing
  where existing.journal_id = p_journal_id
    and existing.owner_id = current_user_id
    and not exists (
      select 1 from jsonb_to_recordset(p_pages) as incoming(id uuid) where incoming.id = existing.id
    );
end;
$$;

revoke all on function public.sync_encrypted_pages(uuid, jsonb) from public;
grant execute on function public.sync_encrypted_pages(uuid, jsonb) to authenticated;
