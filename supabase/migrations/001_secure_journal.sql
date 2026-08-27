create extension if not exists pgcrypto;

create table public.user_key_bundles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_by_password jsonb not null,
  wrapped_by_recovery jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  encrypted_metadata jsonb not null,
  wrapped_key_by_master jsonb not null,
  wrapped_key_by_password jsonb,
  is_password_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload jsonb not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, position)
);

create table public.encrypted_assets (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  encrypted_metadata jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.user_key_bundles enable row level security;
alter table public.journals enable row level security;
alter table public.pages enable row level security;
alter table public.encrypted_assets enable row level security;

create policy "own key bundle only" on public.user_key_bundles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own journals only" on public.journals for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "own pages only" on public.pages for all to authenticated
using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and exists (
    select 1 from public.journals j where j.id = journal_id and j.owner_id = (select auth.uid())
  )
);

create policy "own assets only" on public.encrypted_assets for all to authenticated
using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and exists (
    select 1 from public.journals j where j.id = journal_id and j.owner_id = (select auth.uid())
  )
);

create index journals_owner_id_idx on public.journals(owner_id);
create index pages_owner_id_idx on public.pages(owner_id);
create index pages_journal_id_idx on public.pages(journal_id);
create index encrypted_assets_owner_id_idx on public.encrypted_assets(owner_id);

insert into storage.buckets (id, name, public)
values ('encrypted-journal-assets', 'encrypted-journal-assets', false)
on conflict (id) do nothing;

create policy "own encrypted objects select" on storage.objects for select to authenticated
using (bucket_id = 'encrypted-journal-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own encrypted objects insert" on storage.objects for insert to authenticated
with check (bucket_id = 'encrypted-journal-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own encrypted objects update" on storage.objects for update to authenticated
using (bucket_id = 'encrypted-journal-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own encrypted objects delete" on storage.objects for delete to authenticated
using (bucket_id = 'encrypted-journal-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
