import { cleanupUnreferencedAssets, loadEncryptedAsset, uploadEncryptedAsset } from "@/lib/asset-repository";
import { decryptJson, encryptJson, type EncryptedValue } from "@/lib/crypto";
import { getEncryptedJournalKey } from "@/lib/journal-repository";
import type { PageData } from "@/lib/journal-model";
import { createClient } from "@/lib/supabase/client";

type PageRow = { id: string; encrypted_payload: EncryptedValue; position: number; updated_at: string };
type PersistedPhoto = Omit<PageData["photos"][number], "src" | "loadError"> & { src?: never; loadError?: never };
type PersistedPage = Omit<PageData, "id" | "photos" | "drawingData"> & {
  photos: PersistedPhoto[];
  drawingAssetId?: string;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message.includes("sync_encrypted_pages") ? "Apply supabase/migrations/002_sync_encrypted_pages.sql before syncing pages." : error.message);
}

function pageUuid(id: string | number) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : crypto.randomUUID();
}

export async function loadEncryptedPages(masterKey: CryptoKey, journalId: string) {
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const { data, error } = await createClient()
    .from("pages")
    .select("id, encrypted_payload, position, updated_at")
    .eq("journal_id", journalId)
    .order("position", { ascending: true });
  fail(error);
  const rows = (data ?? []) as PageRow[];

  // Decrypt and open assets sequentially. Mobile browsers can terminate a tab when
  // several large encrypted blobs are downloaded and decoded at the same time.
  const pages: PageData[] = [];
  for (const row of rows) {
    const payload = await decryptJson<PersistedPage>(row.encrypted_payload, journalKey);
    const photos: PageData["photos"] = [];
    for (const photo of payload.photos ?? []) {
      if (!photo.assetId) {
        photos.push({ ...photo, src: "", loadError: "This photo has no encrypted asset reference." });
        continue;
      }
      try {
        photos.push({ ...photo, src: await loadEncryptedAsset(photo.assetId, journalKey), loadError: undefined });
      } catch (error) {
        photos.push({ ...photo, src: "", loadError: error instanceof Error ? error.message : "This photo could not be opened." });
      }
    }
    let drawingData = "";
    if (payload.drawingAssetId) {
      try { drawingData = await loadEncryptedAsset(payload.drawingAssetId, journalKey); } catch { /* A missing drawing must not block the page. */ }
    }
    pages.push({ ...payload, id: row.id, photos, drawingData } satisfies PageData);
  }
  return { pages, updatedAt: rows.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, "") };
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
  onAssetProgress?: (completed: number, total: number) => void;
}) {
  const { userId, journalId, masterKey } = options;
  const journalKey = await getEncryptedJournalKey(masterKey, journalId);
  const referencedIds = new Set<string>();
  const runtimePages: PageData[] = [];
  const records: Array<{ id: string; position: number; encrypted_payload: EncryptedValue }> = [];
  const totalAssets = options.pages.reduce((total, page) => total + page.photos.filter(photo => !photo.assetId).length + (page.drawingData && !page.drawingAssetId ? 1 : 0), 0);
  let completedAssets = 0;
  const progressed = () => options.onAssetProgress?.(++completedAssets, totalAssets);
  if (totalAssets > 0) options.onAssetProgress?.(0, totalAssets);

  for (const [position, original] of options.pages.entries()) {
    const id = pageUuid(original.id);
    const photos = [] as PageData["photos"];
    for (const photo of original.photos ?? []) {
      const assetId = photo.assetId ?? await uploadEncryptedAsset({ userId, journalId, journalKey, source: photo.src, name: `photo-${photo.id}` }).then(id => { progressed(); return id; });
      if (!assetId) throw new Error("The encrypted photo upload did not return an asset ID.");
      referencedIds.add(assetId);
      photos.push({ ...photo, assetId });
    }
    const drawingAssetId = original.drawingData
      ? original.drawingAssetId ?? await uploadEncryptedAsset({ userId, journalId, journalKey, source: original.drawingData, name: `drawing-${id}.png` }).then(assetId => { progressed(); return assetId; })
      : undefined;
    if (drawingAssetId) referencedIds.add(drawingAssetId);
    const runtimePage: PageData = { ...original, id, photos, drawingAssetId };
    runtimePages.push(runtimePage);
    const payload: PersistedPage = {
      pageName: runtimePage.pageName,
      pageDate: runtimePage.pageDate,
      title: runtimePage.title,
      note: runtimePage.note,
      placed: runtimePage.placed,
      photos: runtimePage.photos.map(photo => ({ id: photo.id, assetId: photo.assetId, x: photo.x, y: photo.y, rotation: photo.rotation, framed: photo.framed, z: photo.z, size: photo.size, shape: photo.shape })),
      drawingAssetId: runtimePage.drawingAssetId,
      joys: runtimePage.joys,
      joysVisible: runtimePage.joysVisible,
      joyPosition: runtimePage.joyPosition,
      joyTitle: runtimePage.joyTitle,
      joyColor: runtimePage.joyColor,
      joyTextColor: runtimePage.joyTextColor,
      template: runtimePage.template,
      trackerChecks: runtimePage.trackerChecks,
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

  const { error } = await createClient().rpc("sync_encrypted_pages", { p_journal_id: journalId, p_pages: records });
  fail(error);
  await cleanupUnreferencedAssets(journalId, referencedIds);
  return runtimePages;
}
