import { createEncryptedJournal } from "@/lib/journal-repository";
import type { Book, PageData } from "@/lib/journal-model";
import { syncEncryptedPages } from "@/lib/page-repository";

const BOOKS_KEY = "pin-paper-journal-books";
const LEDGER_KEY = "pin-paper-cloud-migration-v1";
const DEFAULT_BOOKS: Book[] = [
  { id: "august", title: "My August Journal", tone: "rose", label: "summer notes" },
  { id: "wedding", title: "Wedding Memories", tone: "sage", label: "our story" },
  { id: "little", title: "Little Things", tone: "blue", label: "everyday magic" },
];

export type MigrationSource = { book: Book; pages: PageData[]; theme: string; raw: unknown };
type Ledger = Record<string, { cloudId: string; complete: boolean }>;

function storageKey(bookId: string) {
  return bookId === "august" ? "pin-paper-journal" : `pin-paper-journal-${bookId}`;
}

function readLedger(): Ledger {
  try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || "{}"); } catch { return {}; }
}

function writeLedger(ledger: Ledger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

function normalizePage(value: Partial<PageData>, index: number): PageData {
  return {
    id: value.id ?? Date.now() + index,
    pageName: value.pageName || `Page ${index + 1}`,
    pageDate: value.pageDate || "",
    title: value.title || "Untitled page",
    note: value.note || "",
    placed: Array.isArray(value.placed) ? value.placed : [],
    photos: Array.isArray(value.photos) ? value.photos : [],
    drawingData: value.drawingData || "",
    drawingAssetId: value.drawingAssetId,
    joys: Array.isArray(value.joys) ? value.joys : [],
    joysVisible: value.joysVisible !== false,
    pattern: value.pattern || "lined",
    paperColor: value.paperColor || "#fffdf7",
    font: value.font || "hand",
    fontSize: value.fontSize || 18,
    textColor: value.textColor || "#66564b",
  };
}

export function getLocalMigrationSources(): MigrationSource[] {
  let books = DEFAULT_BOOKS;
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKS_KEY) || "null");
    if (Array.isArray(stored)) books = stored;
  } catch { /* Ignore a malformed shelf and inspect known journals. */ }
  const ledger = readLedger();
  const sources: MigrationSource[] = [];
  for (const book of books) {
    if (ledger[book.id]?.complete) continue;
    const rawText = localStorage.getItem(storageKey(book.id));
    if (!rawText) continue;
    try {
      const raw = JSON.parse(rawText);
      const values = Array.isArray(raw.pages) ? raw.pages : [raw];
      if (!values.length) continue;
      sources.push({ book, pages: values.map(normalizePage), theme: raw.theme || "Blush", raw });
    } catch { /* A malformed journal stays local and is not uploaded. */ }
  }
  return sources;
}

export function downloadMigrationBackup(sources: MigrationSource[]) {
  const backup = {
    app: "pin-paper-journal",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: sources.map(source => source.book),
    journals: Object.fromEntries(sources.map(source => [source.book.id, source.raw])),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pin-paper-before-cloud-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function migrateLocalJournals(options: { userId: string; masterKey: CryptoKey; sources: MigrationSource[] }) {
  const ledger = readLedger();
  const migrated: Book[] = [];
  for (const source of options.sources) {
    let cloudId = ledger[source.book.id]?.cloudId;
    let cloudBook: Book;
    if (!cloudId) {
      cloudBook = await createEncryptedJournal(options.userId, options.masterKey, {
        title: source.book.title,
        tone: source.book.tone,
        label: source.book.label,
      });
      cloudId = cloudBook.id;
      ledger[source.book.id] = { cloudId, complete: false };
      writeLedger(ledger);
    } else {
      cloudBook = { ...source.book, id: cloudId };
    }
    await syncEncryptedPages({ userId: options.userId, journalId: cloudId, masterKey: options.masterKey, pages: source.pages });
    ledger[source.book.id] = { cloudId, complete: true };
    writeLedger(ledger);
    migrated.push(cloudBook);
  }
  return migrated;
}

export function removeMigratedLocalCopies(sourceIds: string[]) {
  const ledger = readLedger();
  const removable = new Set(sourceIds.filter(id => ledger[id]?.complete));
  if (!removable.size) return 0;

  for (const id of removable) localStorage.removeItem(storageKey(id));
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKS_KEY) || "[]");
    if (Array.isArray(stored)) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(stored.filter((book: Book) => !removable.has(book.id))));
    }
  } catch { /* The completed journal data was still removed; leave a malformed shelf untouched. */ }
  return removable.size;
}
