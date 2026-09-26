import type { Book } from "@/lib/journal-model";
import { addLegacyJournalWrap, createJournalKeyBundle, decryptJson, encryptJson, rewrapJournalKeyForMaster, unwrapJournalKey, type EncryptedValue, type MasterWrappedKey } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";
import { clearJournalKey, getCachedJournalKey, setJournalKey } from "@/lib/key-vault";
import { recordOperationalTiming } from "@/lib/error-monitoring";

type JournalRow = {
  id: string;
  encrypted_metadata: EncryptedValue;
  wrapped_key_by_master: MasterWrappedKey;
};

function message(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listEncryptedJournals(masterKey: CryptoKey, onBook?: (book: Book, index: number) => void): Promise<Book[]> {
  const supabase = createClient();
  const queryStarted = performance.now();
  const { data, error } = await supabase
    .from("journals")
    .select("id, encrypted_metadata, wrapped_key_by_master")
    .order("created_at", { ascending: true });
  message(error);
  recordOperationalTiming("data", "journal-query", queryStarted);

  const rows = (data ?? []) as JournalRow[];
  const books = new Array<Book>(rows.length);
  const decryptStarted = performance.now();
  const openRow = async (row: JournalRow, index: number) => {
    const journalKey = await unwrapJournalKey(masterKey, row.wrapped_key_by_master);
    setJournalKey(row.id, journalKey);
    const metadata = await decryptJson<Omit<Book, "id">>(row.encrypted_metadata, journalKey);
    const book = { id: row.id, ...metadata };
    books[index] = book;
    onBook?.(book, index);

    // Retain the legacy wrapper for older clients and add a faster wrapper
    // alongside it. The encrypted metadata and page content do not change.
    if (row.wrapped_key_by_master.kdf === "AES-GCM-MASTER") {
      // A short-lived format omitted the legacy fields. Restore them without
      // touching the key or journal contents, so older clients can open it.
      void addLegacyJournalWrap(masterKey, journalKey, row.wrapped_key_by_master).then(async wrapped => {
        await supabase.from("journals").update({ wrapped_key_by_master: wrapped }).eq("id", row.id);
      }).catch(() => { /* Keep the fast-only wrapper readable if the update fails. */ });
    } else if (!row.wrapped_key_by_master.fast_wrap) {
      void rewrapJournalKeyForMaster(masterKey, journalKey).then(async fastWrap => {
        await supabase.from("journals").update({ wrapped_key_by_master: { ...row.wrapped_key_by_master, fast_wrap: fastWrap } }).eq("id", row.id);
      }).catch(() => { /* A failed upgrade leaves the legacy wrapper readable. */ });
    }
  };

  // Reveal one real cover before doing the remaining CPU-heavy legacy unwraps.
  if (rows.length) await openRow(rows[0], 0);
  for (let index = 1; index < rows.length; index += 3) {
    await Promise.all(rows.slice(index, index + 3).map((row, offset) => openRow(row, index + offset)));
  }
  recordOperationalTiming("data", "journal-decrypt", decryptStarted);
  return books;
}

export async function createEncryptedJournal(userId: string, masterKey: CryptoKey, metadata: Omit<Book, "id">): Promise<Book> {
  const supabase = createClient();
  const { journalKey, wrappedByMaster } = await createJournalKeyBundle(masterKey);
  const encryptedMetadata = await encryptJson(metadata, journalKey);
  const { data, error } = await supabase
    .from("journals")
    .insert({ owner_id: userId, encrypted_metadata: encryptedMetadata, wrapped_key_by_master: wrappedByMaster })
    .select("id")
    .single();
  message(error);
  if (!data) throw new Error("Supabase did not return the created journal.");
  setJournalKey(data.id, journalKey);
  return { id: data.id, ...metadata };
}

export async function getEncryptedJournalKey(masterKey: CryptoKey, journalId: string) {
  const cached = getCachedJournalKey(journalId);
  if (cached) return cached;
  const { data, error } = await createClient().from("journals").select("wrapped_key_by_master").eq("id", journalId).single();
  message(error);
  if (!data) throw new Error("The encrypted journal could not be found.");
  const key = await unwrapJournalKey(masterKey, data.wrapped_key_by_master as MasterWrappedKey);
  setJournalKey(journalId, key);
  return key;
}

export async function updateEncryptedJournal(masterKey: CryptoKey, book: Book, changes: Partial<Omit<Book, "id">>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journals")
    .select("wrapped_key_by_master")
    .eq("id", book.id)
    .single();
  message(error);
  if (!data) throw new Error("The encrypted journal could not be found.");

  const journalKey = await unwrapJournalKey(masterKey, data.wrapped_key_by_master as MasterWrappedKey);
  const encryptedMetadata = await encryptJson({ title: book.title, tone: book.tone, label: book.label, cover: book.cover, ...changes }, journalKey);
  const { error: updateError } = await supabase
    .from("journals")
    .update({ encrypted_metadata: encryptedMetadata, updated_at: new Date().toISOString() })
    .eq("id", book.id);
  message(updateError);
}

export async function deleteEncryptedJournal(id: string) {
  const supabase = createClient();
  const { data: assets, error: assetError } = await supabase.from("encrypted_assets").select("storage_path").eq("journal_id", id);
  message(assetError);
  const paths = (assets ?? []).map(asset => asset.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("encrypted-journal-assets").remove(paths);
    message(storageError);
  }
  const { error } = await supabase.from("journals").delete().eq("id", id);
  message(error);
  clearJournalKey(id);
}
