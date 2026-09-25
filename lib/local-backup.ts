import type { Book } from "@/lib/journal-model";
import { decryptJson, encryptJson, generateEncryptionKey, unwrapKey, wrapKey, type EncryptedValue, type WrappedKey } from "@/lib/crypto";

export type JournalBackup = {
  app: "pin-paper-journal";
  version: 1;
  exportedAt: string;
  books: Book[];
  journals: Record<string, unknown>;
};

export type EncryptedJournalBackup = {
  app: "pin-paper-journal";
  version: 2;
  protected: true;
  wrappedKey: WrappedKey;
  payload: EncryptedValue;
};

export async function encryptBackup(backup: JournalBackup, password: string): Promise<EncryptedJournalBackup> {
  if (password.length < 10) throw new Error("Use at least 10 characters for the backup password.");
  const key = await generateEncryptionKey();
  return { app: "pin-paper-journal", version: 2, protected: true, wrappedKey: await wrapKey(key, password), payload: await encryptJson(backup, key) };
}

export async function decryptBackup(raw: string, password: string) {
  const value = JSON.parse(raw) as Partial<EncryptedJournalBackup>;
  if (value.app !== "pin-paper-journal" || value.version !== 2 || value.protected !== true || !value.wrappedKey || !value.payload) {
    return parseBackup(raw);
  }
  try {
    return parseBackup(JSON.stringify(await decryptJson<JournalBackup>(value.payload, await unwrapKey(value.wrappedKey, password))));
  } catch {
    throw new Error("The backup password is incorrect or the file is damaged.");
  }
}

export function isEncryptedBackup(raw: string) {
  try { const value=JSON.parse(raw) as Partial<EncryptedJournalBackup>;return value.app==="pin-paper-journal"&&value.version===2&&value.protected===true; } catch { return false; }
}

function isBook(value: unknown): value is Book {
  if (!value || typeof value !== "object") return false;
  const book = value as Record<string, unknown>;
  return [book.id, book.title, book.tone, book.label].every(item => typeof item === "string");
}

export function makeBackup(books: Book[], readJournal: (id: string) => string | null): JournalBackup {
  const journals: Record<string, unknown> = {};
  for (const book of books) {
    const raw = readJournal(book.id);
    if (raw) journals[book.id] = JSON.parse(raw);
  }
  return { app: "pin-paper-journal", version: 1, exportedAt: new Date().toISOString(), books, journals };
}

export function parseBackup(raw: string): JournalBackup {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("The backup file is not valid.");
  const backup = value as Partial<JournalBackup>;
  if (backup.app !== "pin-paper-journal" || backup.version !== 1 || !Array.isArray(backup.books) || !backup.books.every(isBook) || !backup.journals || typeof backup.journals !== "object") {
    throw new Error("This is not a supported Pin & Paper backup.");
  }
  const ids = new Set(backup.books.map(book => book.id));
  if (ids.size !== backup.books.length) throw new Error("The backup contains duplicate journal IDs.");
  return backup as JournalBackup;
}
