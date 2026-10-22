import { createEncryptedJournal } from "@/lib/journal-repository";
import type { Book, PageData } from "@/lib/journal-model";
import { loadEncryptedPageMedia, syncEncryptedPages } from "@/lib/page-repository";

/** A separate journal gets a separate key: decrypt and re-encrypt every asset. */
export async function copyConflictingJournal(options: { userId: string; masterKey: CryptoKey; book: Book; pages: PageData[]; title: string }) {
  const pages: PageData[] = [];
  for (const page of options.pages) {
    const loaded = await loadEncryptedPageMedia(options.masterKey, options.book.id, page);
    if (loaded.photos.some(photo => !photo.src || photo.loadError) || (loaded.drawingAssetId && !loaded.drawingData)) {
      throw new Error("The separate copy could not be completed because some images are unavailable. Your original draft is still safe.");
    }
    pages.push({ ...loaded, id: crypto.randomUUID(), drawingAssetId: undefined, photos: loaded.photos.map(photo => ({ ...photo, assetId: undefined, loadError: undefined })) });
  }
  const book = await createEncryptedJournal(options.userId, options.masterKey, { title: options.title, tone: options.book.tone, label: options.book.label, cover: options.book.cover });
  await syncEncryptedPages({ userId: options.userId, journalId: book.id, masterKey: options.masterKey, pages, expectedRevision: 0 });
  return book;
}
