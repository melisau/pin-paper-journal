import type { JournalDocument, PageData } from "@/lib/journal-model";

const PREFIX = "pin-paper-cloud-draft-v2:";

export function cloudDraftKey(journalId: string) {
  return `${PREFIX}${journalId}`;
}

export function readCloudDraft(journalId: string): JournalDocument | null {
  try {
    const raw = localStorage.getItem(cloudDraftKey(journalId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<JournalDocument>;
    if (value.version !== 2 || !Array.isArray(value.pages) || typeof value.updatedAt !== "string") return null;
    return value as JournalDocument;
  } catch {
    return null;
  }
}

export function writeCloudDraft(journalId: string, pages: PageData[], theme: string, pendingSync: boolean) {
  const document: JournalDocument = { version: 2, pages, theme, updatedAt: new Date().toISOString(), pendingSync };
  localStorage.setItem(cloudDraftKey(journalId), JSON.stringify(document));
  return document;
}

export function markCloudDraftSynced(journalId: string, pages: PageData[], theme: string) {
  return writeCloudDraft(journalId, pages, theme, false);
}

export function hasPendingCloudDraft(journalId: string) {
  return readCloudDraft(journalId)?.pendingSync === true;
}
