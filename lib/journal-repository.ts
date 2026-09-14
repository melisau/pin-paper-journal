import type { Book } from "@/components/journal-library";
import { createJournalKeyBundle, decryptJson, encryptJson, unwrapJournalKey, type EncryptedValue, type WrappedKey } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";

type JournalRow = {
  id: string;
  encrypted_metadata: EncryptedValue;
  wrapped_key_by_master: WrappedKey;
};

function message(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listEncryptedJournals(masterKey: CryptoKey): Promise<Book[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journals")
    .select("id, encrypted_metadata, wrapped_key_by_master")
    .order("created_at", { ascending: true });
  message(error);

  return Promise.all((data as JournalRow[]).map(async row => {
    const journalKey = await unwrapJournalKey(masterKey, row.wrapped_key_by_master);
    const metadata = await decryptJson<Omit<Book, "id">>(row.encrypted_metadata, journalKey);
    return { id: row.id, ...metadata };
  }));
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
  return { id: data.id, ...metadata };
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

  const journalKey = await unwrapJournalKey(masterKey, data.wrapped_key_by_master as WrappedKey);
  const encryptedMetadata = await encryptJson({ title: book.title, tone: book.tone, label: book.label, ...changes }, journalKey);
  const { error: updateError } = await supabase
    .from("journals")
    .update({ encrypted_metadata: encryptedMetadata, updated_at: new Date().toISOString() })
    .eq("id", book.id);
  message(updateError);
}

export async function deleteEncryptedJournal(id: string) {
  const { error } = await createClient().from("journals").delete().eq("id", id);
  message(error);
}
