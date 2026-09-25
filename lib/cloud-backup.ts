import { createEncryptedJournal } from "@/lib/journal-repository";
import type { Book, PageData } from "@/lib/journal-model";
import type { EncryptedJournalBackup, JournalBackup } from "@/lib/local-backup";
import { loadEncryptedPageMedia, loadEncryptedPages, syncEncryptedPages } from "@/lib/page-repository";

async function sourceToDataUrl(source: string) {
  if (!source || source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error("A journal image could not be added to the backup.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("A journal image could not be read for backup."));
    reader.readAsDataURL(blob);
  });
}

async function portablePage(page: PageData): Promise<PageData> {
  const photos = await Promise.all(page.photos.map(async photo => ({ ...photo, src: await sourceToDataUrl(photo.src), assetId: undefined })));
  return { ...page, photos, drawingData: await sourceToDataUrl(page.drawingData), drawingAssetId: undefined };
}

export async function makeCloudBackup(books: Book[], masterKey: CryptoKey): Promise<JournalBackup> {
  const journals: Record<string, unknown> = {};
  for (const book of books) {
    const loaded = await loadEncryptedPages(masterKey, book.id);
    const openedPages = [] as PageData[];
    for (const page of loaded.pages) openedPages.push(await loadEncryptedPageMedia(masterKey, book.id, page));
    journals[book.id] = { version: 1, pages: await Promise.all(openedPages.map(portablePage)), theme: "Blush", updatedAt: loaded.updatedAt };
  }
  return { app: "pin-paper-journal", version: 1, exportedAt: new Date().toISOString(), books, journals };
}

export function downloadBackupFile(backup: JournalBackup | EncryptedJournalBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pin-paper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importCloudBackup(options: { backup: JournalBackup; userId: string; masterKey: CryptoKey }) {
  const imported: Book[] = [];
  for (const sourceBook of options.backup.books) {
    const raw = options.backup.journals[sourceBook.id] as { pages?: PageData[] } | undefined;
    if (!raw?.pages?.length) continue;
    const book = await createEncryptedJournal(options.userId, options.masterKey, {
      title: sourceBook.title,
      tone: sourceBook.tone,
      label: sourceBook.label,
    });
    const pages = raw.pages.map(page => ({
      ...page,
      id: crypto.randomUUID(),
      photos: (page.photos ?? []).map(photo => ({ ...photo, assetId: undefined })),
      drawingAssetId: undefined,
    }));
    await syncEncryptedPages({ userId: options.userId, journalId: book.id, masterKey: options.masterKey, pages });
    imported.push(book);
  }
  return imported;
}
