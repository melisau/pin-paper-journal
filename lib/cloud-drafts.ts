import { decryptJson, encryptJson, type EncryptedValue } from "@/lib/crypto";
import type { JournalDocument, PageData } from "@/lib/journal-model";

const PREFIX = "pin-paper-cloud-draft-v2:";
const FORMAT = "encrypted-cloud-draft";
const FORMAT_VERSION = 3;
const writeQueues = new Map<string, Promise<void>>();

type EncryptedCloudDraft = {
  format: typeof FORMAT;
  version: typeof FORMAT_VERSION;
  pendingSync: boolean;
  payload: EncryptedValue;
};

type DraftPayload = { journalId: string; document: JournalDocument };

export function cloudDraftKey(journalId: string, slot?: string) {
  return `${PREFIX}${journalId}${slot ? `:${slot}` : ""}`;
}

function isJournalDocument(value: unknown): value is JournalDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<JournalDocument>;
  return document.version === 2 && Array.isArray(document.pages) && typeof document.updatedAt === "string";
}

function normalizeDocument(document: JournalDocument): JournalDocument {
  // Object URLs belong to the tab that created them. Restore encrypted assets
  // by ID instead of trying to render a stale blob: URL after reopening.
  return {
    ...document,
    pages: document.pages.map(page => ({
      ...page,
      photos: (page.photos ?? []).map(photo => photo.assetId && photo.src?.startsWith("blob:") ? { ...photo, src: "" } : photo),
      drawingData: page.drawingAssetId && page.drawingData?.startsWith("blob:") ? "" : page.drawingData,
    })),
  };
}

export async function readCloudDraft(journalId: string, key: CryptoKey, slot?: string): Promise<JournalDocument | null> {
  if (slot === undefined) {
    const prefix = `${cloudDraftKey(journalId)}:`;
    const slots: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (name?.startsWith(prefix)) slots.push(name.slice(prefix.length));
    }
    const candidates = await Promise.all(["", ...slots].map(id => readCloudDraft(journalId, key, id)));
    return candidates.filter((draft): draft is JournalDocument => draft !== null)
      .sort((a, b) => Number(Boolean(b.pendingSync)) - Number(Boolean(a.pendingSync)) || b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }
  let raw: string;
  let value: unknown;
  try {
    const stored = localStorage.getItem(cloudDraftKey(journalId, slot));
    if (!stored) return null;
    raw = stored;
    value = JSON.parse(stored) as unknown;
  } catch {
    return null;
  }

  if (value && typeof value === "object" && (value as Partial<EncryptedCloudDraft>).format === FORMAT) {
    const envelope = value as Partial<EncryptedCloudDraft>;
    if (envelope.version !== FORMAT_VERSION || typeof envelope.pendingSync !== "boolean" || !envelope.payload) return null;
    try {
      const payload = await decryptJson<DraftPayload>(envelope.payload, key);
      if (payload.journalId !== journalId || !isJournalDocument(payload.document) || payload.document.pendingSync !== envelope.pendingSync) return null;
      return { ...normalizeDocument(payload.document), draftSlot: slot };
    } catch {
      // Never fall back to treating failed ciphertext as readable journal data.
      return null;
    }
  }

  // Migrate readable drafts from older releases immediately after unlock. The
  // legacy value is replaced only after encryption succeeds, preserving it if
  // the browser cannot perform secure encryption.
  if (isJournalDocument(value)) {
    const document = normalizeDocument(value);
    const migrated = await storeCloudDraft(journalId, document, Boolean(document.pendingSync), key, raw, slot);
    return migrated ? { ...migrated, draftSlot: slot } : readCloudDraft(journalId, key, slot);
  }
  return null;
}

async function storeCloudDraft(journalId: string, document: JournalDocument, pendingSync: boolean, key: CryptoKey, expectedRaw?: string, slot?: string): Promise<JournalDocument | null> {
  const encryptedDocument = { ...document, pendingSync };
  const payload = await encryptJson<DraftPayload>({ journalId, document: encryptedDocument }, key);
  const envelope: EncryptedCloudDraft = { format: FORMAT, version: FORMAT_VERSION, pendingSync, payload };
  const storageKey = cloudDraftKey(journalId, slot);
  if (expectedRaw !== undefined && localStorage.getItem(storageKey) !== expectedRaw) return null;
  localStorage.setItem(storageKey, JSON.stringify(envelope));
  return encryptedDocument;
}

export function writeCloudDraft(journalId: string, pages: PageData[], theme: string, pendingSync: boolean, key: CryptoKey, baseRevision?: number, slot?: string) {
  const document: JournalDocument = { version: 2, pages, theme, updatedAt: new Date().toISOString(), pendingSync, baseRevision, draftToken: crypto.randomUUID() };
  const storageKey = cloudDraftKey(journalId, slot);
  const previous = writeQueues.get(storageKey) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => {
    const stored = await storeCloudDraft(journalId, document, pendingSync, key, undefined, slot);
    if (!stored) throw new Error("The encrypted draft could not be saved.");
    return stored;
  });
  writeQueues.set(storageKey, write.then(() => undefined, () => undefined));
  return write;
}

export async function markCloudDraftSynced(journalId: string, pages: PageData[], theme: string, key: CryptoKey, baseRevision?: number, slot?: string, expectedToken?: string) {
  const storageKey = cloudDraftKey(journalId, slot);
  await writeQueues.get(storageKey);
  const raw = localStorage.getItem(storageKey);
  if (expectedToken && (await readCloudDraft(journalId, key, slot ?? ""))?.draftToken !== expectedToken) return null;
  // Compare the ciphertext again after encryption, so a late response cannot
  // clear newer pending edits, even if another writer changed this slot.
  return storeCloudDraft(journalId, { version: 2, pages, theme, updatedAt: new Date().toISOString(), baseRevision, draftToken: crypto.randomUUID() }, false, key, raw ?? undefined, slot);
}

export async function acknowledgeRecoveredDraft(journalId: string, key: CryptoKey, recovered: JournalDocument) {
  const storageKey = cloudDraftKey(journalId, recovered.draftSlot);
  const raw = localStorage.getItem(storageKey);
  const latest = await readCloudDraft(journalId, key, recovered.draftSlot ?? "");
  if (latest && latest.updatedAt === recovered.updatedAt && latest.draftToken === recovered.draftToken && localStorage.getItem(storageKey) === raw) localStorage.removeItem(storageKey);
}

export async function hasPendingCloudDraft(journalId: string, key: CryptoKey) {
  return (await readCloudDraft(journalId, key))?.pendingSync === true;
}

/** Upgrade legacy plaintext drafts belonging to journals in the unlocked account. */
export async function migrateLegacyCloudDrafts(journalIds: string[], key: CryptoKey) {
  const failedJournalIds: string[] = [];
  for (const journalId of journalIds) {
    try {
      const raw = localStorage.getItem(cloudDraftKey(journalId));
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      if (isJournalDocument(value)) await readCloudDraft(journalId, key);
    } catch {
      failedJournalIds.push(journalId);
    }
  }
  return failedJournalIds;
}
