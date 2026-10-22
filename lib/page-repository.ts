import { loadEncryptedAsset, uploadEncryptedAsset } from "@/lib/asset-repository";
import { decryptJson, encryptJson, type EncryptedValue } from "@/lib/crypto";
import { getEncryptedJournalKey } from "@/lib/journal-repository";
import type { PageData } from "@/lib/journal-model";
import { createClient } from "@/lib/supabase/client";
import { JournalSyncConflictError, validRevision } from "@/lib/sync-conflict";
import { prepareInlineDrawing } from "@/lib/drawing-storage";
import { JournalStorageLimitError } from "@/lib/storage-errors";

type PageRow = { id: string; encrypted_payload: EncryptedValue; position: number; updated_at: string };
type PersistedPhoto = Omit<PageData["photos"][number], "src" | "loadError"> & { src?: never; loadError?: never };
type PersistedPage = Omit<PageData, "id" | "photos" | "drawingData"> & {
  photos: PersistedPhoto[];
  drawingData?: string;
  drawingAssetId?: string;
};

function fail(error: { message: string } | null) {
  if (error?.message.includes("encrypted_storage_quota_exceeded")) throw new JournalStorageLimitError();
  if (error?.message.includes("encrypted_page_too_large")) throw new JournalStorageLimitError("This page is too large to save. Move some content to another page and try again.");
  if (error?.message.includes("journal_revision_conflict")) throw new JournalSyncConflictError();
  if (error) throw new Error(/sync_encrypted_pages|load_encrypted_journal_snapshot/.test(error.message) ? "Apply supabase/migrations/004_versioned_page_sync.sql before syncing pages." : error.message);
}

function pageUuid(id: string | number) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : crypto.randomUUID();
}

export async function loadEncryptedPages(masterKey: CryptoKey, journalId: string) {
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const { data, error } = await createClient().rpc("load_encrypted_journal_snapshot", { p_journal_id: journalId });
  fail(error);
  if (!data || !validRevision(data.revision) || !Array.isArray(data.pages)) throw new Error("The journal snapshot could not be loaded safely.");
  const rows = data.pages as PageRow[];

  const pages: PageData[] = [];
  for (const row of rows) {
    const payload = await decryptJson<PersistedPage>(row.encrypted_payload, journalKey);
    const photos = (payload.photos ?? []).map(photo => ({
      ...photo,
      src: "",
      loadError: photo.assetId ? undefined : "This photo has no encrypted asset reference.",
    }));
    pages.push({ ...payload, id: row.id, photos, drawingData: payload.drawingData || "" } satisfies PageData);
  }
  return { pages, revision: data.revision as number, updatedAt: rows.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, "") };
}

/** Opens only one page's media. Call this for the visible page(s), not the whole journal. */
export async function loadEncryptedPageMedia(masterKey: CryptoKey, journalId: string, page: PageData) {
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const photos = [] as PageData["photos"];
  for (const photo of page.photos ?? []) {
    if (photo.src || !photo.assetId) { photos.push(photo); continue; }
    try {
      photos.push({ ...photo, src: await loadEncryptedAsset(photo.assetId, journalKey), loadError: undefined });
    } catch (error) {
      photos.push({ ...photo, src: "", loadError: error instanceof Error ? error.message : "This photo could not be opened." });
    }
  }
  let drawingData = page.drawingData;
  if (!drawingData && page.drawingAssetId) {
    try { drawingData = await loadEncryptedAsset(page.drawingAssetId, journalKey); } catch { /* Keep the rest of the page usable. */ }
  }
  return { ...page, photos, drawingData } satisfies PageData;
}

export async function reloadEncryptedAsset(masterKey: CryptoKey, journalId: string, assetId: string) {
  return loadEncryptedAsset(assetId, await getEncryptedJournalKey(masterKey, journalId));
}

export async function repairEncryptedPhotos(masterKey: CryptoKey, journalId: string, photos: PageData["photos"]) {
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const repaired = [] as PageData["photos"];
  for (const photo of photos) {
    if (!photo.assetId || (photo.src && !photo.loadError)) { repaired.push(photo); continue; }
    try {
      repaired.push({ ...photo, src: await loadEncryptedAsset(photo.assetId, journalKey), loadError: undefined });
    } catch (error) {
      repaired.push({ ...photo, src: "", loadError: error instanceof Error ? error.message : "This photo could not be reopened." });
    }
  }
  return repaired;
}

export async function syncEncryptedPages(options: {
  userId: string;
  journalId: string;
  masterKey: CryptoKey;
  pages: PageData[];
  expectedRevision: number;
  onAssetProgress?: (completed: number, total: number) => void;
}) {
  const { userId, journalId, masterKey } = options;
  if (!validRevision(options.expectedRevision)) throw new JournalSyncConflictError();
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const runtimePages: PageData[] = [];
  const records: Array<{ id: string; position: number; encrypted_payload: EncryptedValue }> = [];
  const totalAssets = options.pages.reduce((total, page) => total + page.photos.filter(photo => !photo.assetId).length, 0);
  let completedAssets = 0;
  const progressed = () => options.onAssetProgress?.(++completedAssets, totalAssets);
  if (totalAssets > 0) options.onAssetProgress?.(0, totalAssets);

  for (const [position, original] of options.pages.entries()) {
    const id = pageUuid(original.id);
    const photos = [] as PageData["photos"];
    for (const photo of original.photos ?? []) {
      const assetId = photo.assetId ?? await uploadEncryptedAsset({ userId, journalId, journalKey, source: photo.src, name: `photo-${photo.id}` }).then(id => { progressed(); return id; });
      if (!assetId) throw new Error("The encrypted photo upload did not return an asset ID.");
      photos.push({ ...photo, assetId });
    }
    // A fresh drawing replaces the encrypted value in this page's existing row.
    // Legacy immutable asset references remain readable until the user edits.
    const inlineDrawing = !original.drawingAssetId && original.drawingData ? await prepareInlineDrawing(original.drawingData) : undefined;
    const drawingAssetId = inlineDrawing ? undefined : original.drawingAssetId;
    const runtimePage: PageData = { ...original, id, photos, drawingAssetId, drawingData: inlineDrawing ?? original.drawingData };
    runtimePages.push(runtimePage);
    const payload: PersistedPage = {
      pageName: runtimePage.pageName,
      pageDate: runtimePage.pageDate,
      title: runtimePage.title,
      note: runtimePage.note,
      placed: runtimePage.placed,
      photos: runtimePage.photos.map(photo => ({ id: photo.id, assetId: photo.assetId, x: photo.x, y: photo.y, rotation: photo.rotation, framed: photo.framed, z: photo.z, size: photo.size, shape: photo.shape, locked: photo.locked })),
      drawingAssetId: runtimePage.drawingAssetId,
      drawingData: inlineDrawing,
      joys: runtimePage.joys,
      joysVisible: runtimePage.joysVisible,
      joyLocked: runtimePage.joyLocked,
      joyPosition: runtimePage.joyPosition,
      joyTitle: runtimePage.joyTitle,
      joyColor: runtimePage.joyColor,
      joyTextColor: runtimePage.joyTextColor,
      template: runtimePage.template,
      templateTitle: runtimePage.templateTitle,
      templateBackground: runtimePage.templateBackground,
      templateBorderColor: runtimePage.templateBorderColor,
      trackerChecks: runtimePage.trackerChecks,
      todoItems: runtimePage.todoItems,
      moodEntries: runtimePage.moodEntries,
      weeklyNotes: runtimePage.weeklyNotes,
      templateLayout: runtimePage.templateLayout,
      freeTexts: runtimePage.freeTexts,
      pattern: runtimePage.pattern,
      paperColor: runtimePage.paperColor,
      font: runtimePage.font,
      fontSize: runtimePage.fontSize,
      textColor: runtimePage.textColor,
    };
    const encrypted_payload = await encryptJson(payload, journalKey);
    records.push({ id, position, encrypted_payload });
  }

  const { data, error } = await createClient().rpc("sync_encrypted_pages", { p_journal_id: journalId, p_pages: records, p_expected_revision: options.expectedRevision });
  fail(error);
  if (!validRevision(data) || data !== options.expectedRevision + 1) throw new Error("The saved journal revision could not be verified. Reopen the journal before retrying.");
  return { pages: runtimePages, revision: data };
}
