// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const J = "20000000-0000-4000-8000-000000000001";
const OTHER = "20000000-0000-4000-8000-000000000002";
const P1 = "30000000-0000-4000-8000-000000000001";
const P2 = "30000000-0000-4000-8000-000000000002";
const P3 = "30000000-0000-4000-8000-000000000003";
const J2 = "20000000-0000-4000-8000-000000000003";
const A1 = "40000000-0000-4000-8000-000000000001";
const A2 = "40000000-0000-4000-8000-000000000002";
let db: PGlite;
const records = (entries: Array<[string, string]>) => entries.map(([id, ciphertext], position) => ({ id, position, encrypted_payload: { ciphertext, iv: "test", version: 1 } }));
const save = (revision: number, entries: Array<[string, string]>) => db.query<{ revision: number }>("select public.sync_encrypted_pages($1, $2::jsonb, $3) as revision", [J, JSON.stringify(records(entries)), revision]);
const snapshot = () => db.query<{ snapshot: { revision: number; pages: Array<{ id: string; encrypted_payload: { ciphertext: string } }> } }>("select public.load_encrypted_journal_snapshot($1) as snapshot", [J]);

describe("versioned sync migration on PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role authenticated; create role anon;
      alter default privileges grant execute on functions to anon, authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
      create table public.journals (id uuid primary key, owner_id uuid not null, encrypted_metadata jsonb, wrapped_key_by_master jsonb, wrapped_key_by_password jsonb, is_password_protected boolean, updated_at timestamptz default now());
      create table public.pages (id uuid primary key, journal_id uuid references public.journals on delete cascade, owner_id uuid not null, encrypted_payload jsonb not null, position integer not null, updated_at timestamptz default now(), unique(journal_id, position));
      create table public.encrypted_assets (id uuid primary key default gen_random_uuid(), journal_id uuid references public.journals on delete cascade, page_id uuid references public.pages on delete cascade, owner_id uuid not null, storage_path text not null unique, encrypted_metadata jsonb not null default '{}');
      create table storage.objects (name text primary key, bucket_id text, metadata jsonb default '{}');
      alter table public.journals enable row level security;
      alter table public.pages enable row level security;
      alter table public.encrypted_assets enable row level security;
      alter table storage.objects enable row level security;
      create policy own_journals on public.journals for all to authenticated using(owner_id = auth.uid()) with check(owner_id = auth.uid());
      create policy own_pages on public.pages for all to authenticated using(owner_id = auth.uid()) with check(owner_id = auth.uid());
      create policy "own encrypted objects delete" on storage.objects for delete to authenticated using(true);
      create policy "own encrypted objects update" on storage.objects for update to authenticated using(true);
      create policy own_objects_read on storage.objects for select to authenticated using((storage.foldername(name))[1] = auth.uid()::text);
      grant usage on schema public, auth, storage to authenticated, anon;
      grant all on public.journals, public.pages, storage.objects to authenticated;
      grant all on public.encrypted_assets to authenticated;
      grant select on public.journals, public.pages to anon;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/002_sync_encrypted_pages.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/003_storage_quota.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/004_versioned_page_sync.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/005_bounded_drawing_storage.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/006_retryable_asset_cleanup.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/007_atomic_journal_deletion.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/008_protect_cleanup_jobs.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/009_close_audit_findings.sql", import.meta.url), "utf8"));
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec("reset role; truncate public.journals cascade; truncate storage.objects; truncate auth.users cascade;");
    await db.query("insert into auth.users(id) values ($1),($2)", [A, B]);
    await db.query("insert into public.journals(id, owner_id) values ($1,$2),($3,$4)", [J, A, OTHER, B]);
    await db.query("insert into public.pages(id,journal_id,owner_id,position,encrypted_payload) values ($1,$2,$3,0,'{}'::jsonb)", [P1, J, A]);
    await db.query("insert into storage.objects(name,bucket_id) values ($1, 'encrypted-journal-assets'), ($2, 'encrypted-journal-assets')", [`${A}/${J}/a.bin`, `${A}/${J}/b.bin`]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
    await db.exec("set role authenticated");
  });

  it("rejects B's stale version and preserves A's new text, page and all media", async () => {
    await save(0, [[P1, "initial"]]);
    const a = (await snapshot()).rows[0].snapshot;
    const b = (await snapshot()).rows[0].snapshot;
    await save(a.revision, [[P1, "A edited text"], [P2, "A added page and photo reference"]]);
    await expect(save(b.revision, [[P1, "B stale edit"]])).rejects.toThrow("journal_revision_conflict");
    expect((await snapshot()).rows[0].snapshot).toMatchObject({ revision: 2, pages: [{ id: P1, encrypted_payload: { ciphertext: "A edited text" } }, { id: P2 }] });
    const deleted = await db.query("delete from storage.objects where name = $1 returning name", [`${A}/${J}/b.bin`]);
    expect(deleted.rows).toHaveLength(0);
    expect((await db.query("select name from storage.objects")).rows).toHaveLength(2);
  });
  it("allows exactly one of two concurrent writes from the same revision", async () => {
    const results = await Promise.allSettled([save(0, [[P1, "A"]]), save(0, [[P1, "B"]])]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await snapshot()).rows[0].snapshot.revision).toBe(1);
  });
  it("permits deliberate page deletion only with the current revision, retaining media", async () => {
    await save(0, [[P1, "one"], [P2, "two"]]);
    await save(1, [[P1, "one"]]);
    expect((await snapshot()).rows[0].snapshot.pages.map(page => page.id)).toEqual([P1]);
    expect((await db.query("select name from storage.objects")).rows).toHaveLength(2);
  });
  it("prevents old clients, direct page writes and manual revision changes from bypassing CAS", async () => {
    await expect(db.query("select public.sync_encrypted_pages($1, '[]'::jsonb)", [J])).rejects.toThrow("does not exist");
    await expect(db.query("update public.pages set encrypted_payload = '{}'::jsonb where journal_id = $1", [J])).rejects.toThrow("permission denied");
    await expect(db.query("update public.journals set content_revision = 123 where id = $1", [J])).rejects.toThrow("permission denied");
    await db.query("update public.journals set encrypted_metadata = '{}'::jsonb where id = $1", [J]);
  });
  it("keeps cross-account and anonymous access blocked", async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [B]);
    await expect(save(0, [[P1, "attack"]])).rejects.toThrow("journal_not_accessible");
    expect((await snapshot()).rows[0].snapshot).toBeNull();
    await db.exec("reset role; set role anon");
    await expect(snapshot()).rejects.toThrow("permission denied");
  });
  it("rejects invalid batches without changing the revision or existing pages", async () => {
    await save(0, [[P1, "safe"]]);
    await expect(db.query("select public.sync_encrypted_pages($1, $2::jsonb, 1)", [J, JSON.stringify(records([[P1, "bad"], [P1, "duplicate"]]))])).rejects.toThrow("invalid_page_record");
    expect((await snapshot()).rows[0].snapshot).toMatchObject({ revision: 1, pages: [{ encrypted_payload: { ciphertext: "safe" } }] });
  });
  it("cannot move or overwrite a page belonging to a different journal/account", async () => {
    await db.exec("reset role");
    await db.query("insert into public.pages(id,journal_id,owner_id,position,encrypted_payload) values ($1,$2,$3,0,'{}'::jsonb)", [P2, OTHER, B]);
    await db.exec("set role authenticated");
    await expect(save(0, [[P2, "forged"]])).rejects.toThrow("invalid_page_record");
    expect((await snapshot()).rows[0].snapshot.revision).toBe(0);
  });
  it("allows explicit journal deletion followed by storage cleanup", async () => {
    await db.query("delete from public.journals where id = $1", [J]);
    expect((await db.query("delete from storage.objects where name = $1 returning name", [`${A}/${J}/a.bin`])).rows).toHaveLength(1);
  });
  it("keeps a durable cleanup job after the journal row is deleted, then permits retry", async () => {
    await db.query("insert into public.encrypted_assets(id,journal_id,owner_id,storage_path) values ($1,$2,$3,$4),($5,$2,$3,$6)", [A1, J, A, `${A}/${J}/${A1}.bin`, A2, `${A}/${J}/${A2}.bin`]);
    const prepared = await db.query<{ job_id: string }>("select public.delete_encrypted_journal_with_cleanup($1) as job_id", [J]);
    const jobId = prepared.rows[0].job_id;
    expect(jobId).toBeTruthy();
    expect((await db.query("select id from public.journals where id = $1", [J])).rows).toHaveLength(0);
    expect((await db.query("select id,storage_paths from public.pending_journal_asset_deletions where id = $1", [jobId])).rows).toHaveLength(1);
    expect((await db.query("delete from storage.objects where name = $1 returning name", [`${A}/${J}/b.bin`])).rows).toHaveLength(1);
    await expect(db.query("delete from public.pending_journal_asset_deletions where id = $1", [jobId])).rejects.toThrow("permission denied");
    await db.query("select public.finish_journal_asset_deletion($1)", [jobId]);
    expect((await db.query("select id from public.pending_journal_asset_deletions where id = $1", [jobId])).rows).toHaveLength(0);
  });
  it("replaces repeated drawing snapshots without growing Storage object count", async () => {
    for (let revision = 0; revision < 20; revision++) await save(revision, [[P1, `encrypted sketch ${revision}`]]);
    expect((await snapshot()).rows[0].snapshot.pages).toHaveLength(1);
    expect((await db.query("select name from storage.objects")).rows).toHaveLength(2);
    const usage = await db.query<{ used_bytes: number }>("select used_bytes::integer from public.encrypted_storage_usage()");
    expect(usage.rows[0].used_bytes).toBeLessThan(200);
    await expect(db.query("select public.sync_encrypted_pages_cas($1, '[]'::jsonb, 20)", [J])).rejects.toThrow("permission denied");
  });
  it("rolls back an over-quota page save including its revision, while allowing a smaller replacement", async () => {
    await save(0, [[P1, "original".repeat(50)]]);
    await db.exec("reset role; alter table storage.objects disable trigger enforce_journal_storage_budget");
    await db.query("update storage.objects set metadata = jsonb_build_object('size', $1::bigint) where name = $2", [250 * 1024 * 1024 - 600, `${A}/${J}/a.bin`]);
    await db.exec("alter table storage.objects enable trigger enforce_journal_storage_budget; set role authenticated");
    await expect(save(1, [[P1, "too big".repeat(500)]])).rejects.toThrow("encrypted_storage_quota_exceeded");
    expect((await snapshot()).rows[0].snapshot.revision).toBe(1);
    expect((await snapshot()).rows[0].snapshot.pages[0].encrypted_payload.ciphertext).toBe("original".repeat(50));
    await save(1, [[P1, "small"]]);
    expect((await snapshot()).rows[0].snapshot.revision).toBe(2);
    await db.exec("reset role; alter table storage.objects disable trigger enforce_journal_storage_budget");
    await db.query("update storage.objects set metadata = jsonb_build_object('size', $1::bigint) where name = $2", [250 * 1024 * 1024 + 100, `${A}/${J}/a.bin`]);
    await db.exec("alter table storage.objects enable trigger enforce_journal_storage_budget; set role authenticated");
    await save(2, [[P1, "s"]]);
    expect((await snapshot()).rows[0].snapshot.revision).toBe(3);
  });
  it("checks final Storage metadata updates, not just placeholder insertion", async () => {
    await db.exec("reset role; alter table storage.objects disable trigger enforce_journal_storage_budget");
    await db.query("update storage.objects set metadata = jsonb_build_object('size', $1::bigint) where name = $2", [250 * 1024 * 1024 - 100, `${A}/${J}/a.bin`]);
    await db.exec("alter table storage.objects enable trigger enforce_journal_storage_budget");
    await db.query("insert into storage.objects(name,bucket_id) values ($1,'encrypted-journal-assets')", [`${A}/${J}/placeholder.bin`]);
    await expect(db.query("update storage.objects set metadata = '{\"size\":200}' where name = $1", [`${A}/${J}/placeholder.bin`])).rejects.toThrow("encrypted_storage_quota_exceeded");
    await db.query("update storage.objects set metadata = '{\"size\":80}' where name = $1", [`${A}/${J}/placeholder.bin`]);
    const usage = await db.query<{ used_bytes: string }>("select used_bytes from public.encrypted_storage_usage()");
    expect(Number(usage.rows[0].used_bytes)).toBe(250 * 1024 * 1024 - 18);
  });
  it("rejects oversized page payloads and media objects", async () => {
    await expect(save(0, [[P1, "x".repeat(2 * 1024 * 1024)]])).rejects.toThrow("page_payload_too_large");
    await db.exec("reset role");
    await expect(db.query("update storage.objects set metadata = '{\"size\":3000000}' where name = $1", [`${A}/${J}/b.bin`])).rejects.toThrow("encrypted_asset_too_large");
  });
  it("rejects oversized page batches before any page or revision is changed", async () => {
    const largeBatch = Array.from({ length: 9 }, (_, index) => ({
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      position: index,
      encrypted_payload: { ciphertext: "x".repeat(1024 * 1024) },
    }));
    await expect(db.query("select public.sync_encrypted_pages($1,$2::jsonb,0)", [J, JSON.stringify(largeBatch)])).rejects.toThrow("page_batch_too_large");
    expect((await snapshot()).rows[0].snapshot.revision).toBe(0);
    expect((await snapshot()).rows[0].snapshot.pages).toHaveLength(1);
  });
  it("does not count a completed Storage object if its measured size is absent", async () => {
    const placeholder = `${A}/${J}/unknown-size.bin`;
    await db.query("insert into storage.objects(name,bucket_id) values ($1,'encrypted-journal-assets')", [placeholder]);
    await db.exec("reset role");
    await expect(db.query("update storage.objects set metadata = '{}'::jsonb where name = $1", [placeholder])).rejects.toThrow("encrypted_asset_size_missing");
  });
  it("allows null page staging but rejects cross-journal page references and forged asset paths", async () => {
    await db.query("insert into public.encrypted_assets(id,journal_id,page_id,owner_id,storage_path) values ($1,$2,null,$3,$4)", [A1, J, A, `${A}/${J}/${A1}.bin`]);
    await expect(db.query("select id from public.encrypted_assets where id = $1", [A1])).resolves.toMatchObject({ rows: [{ id: A1 }] });

    await db.exec("reset role");
    await db.query("insert into public.journals(id,owner_id) values ($1,$2)", [J2, A]);
    await db.query("insert into public.pages(id,journal_id,owner_id,position,encrypted_payload) values ($1,$2,$3,0,'{}'::jsonb)", [P3, J2, A]);
    await db.query("insert into public.pages(id,journal_id,owner_id,position,encrypted_payload) values ($1,$2,$3,0,'{}'::jsonb)", [P2, OTHER, B]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [A]);
    await db.exec("set role authenticated");
    await expect(db.query("insert into public.encrypted_assets(id,journal_id,page_id,owner_id,storage_path) values ($1,$2,$3,$4,$5)", [A2, J, P3, A, `${A}/${J}/${A2}.bin`])).rejects.toThrow(/row-level security/);
    await expect(db.query("insert into public.encrypted_assets(id,journal_id,page_id,owner_id,storage_path) values ($1,$2,$3,$4,$5)", [A2, J, P2, A, `${A}/${J}/${A2}.bin`])).rejects.toThrow(/row-level security/);
    await expect(db.query("insert into public.encrypted_assets(id,journal_id,owner_id,storage_path) values ($1,$2,$3,$4)", [A2, J, A, `${A}/${J}/somebody-elses.bin`])).rejects.toThrow(/row-level security/);
  });
});
