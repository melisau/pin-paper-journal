import { decryptBinary, decryptJson, encryptBinary, encryptJson, type EncryptedValue } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "encrypted-journal-assets";
const pendingUploads = new Map<string, Promise<string>>();
const knownUploads = new Map<string, string>();
const managedObjectUrls = new Set<string>();
const MAX_UPLOAD_ATTEMPTS = 3;

type AssetMetadata = { iv: string; mimeType: string; name: string; version: 1 };
type AssetRow = { id: string; storage_path: string; encrypted_metadata: EncryptedValue };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function wait(delay: number) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function retryAssetOperation<T>(operation: () => Promise<T>, attempts = MAX_UPLOAD_ATTEMPTS) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await wait(250 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function performEncryptedUpload(options: {
  userId: string;
  journalId: string;
  journalKey: CryptoKey;
  source: string;
  name: string;
}) {
  const { userId, journalId, journalKey, source, name } = options;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`${name} could not be read before encryption.`);
  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const encrypted = await encryptBinary(await response.arrayBuffer(), journalKey);
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${journalId}/${id}.bin`;
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, encrypted.ciphertext, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  fail(uploadError);

  const encryptedMetadata = await encryptJson<AssetMetadata>({ iv: encrypted.iv, mimeType, name, version: 1 }, journalKey);
  const { error: rowError } = await supabase.from("encrypted_assets").insert({
    id,
    journal_id: journalId,
    owner_id: userId,
    storage_path: storagePath,
    encrypted_metadata: encryptedMetadata,
  });
  if (rowError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(rowError.message);
  }
  return id;
}

export function uploadEncryptedAsset(options: {
  userId: string;
  journalId: string;
  journalKey: CryptoKey;
  source: string;
  name: string;
}) {
  const cacheKey = `${options.journalId}:${options.source}`;
  const known = knownUploads.get(cacheKey);
  if (known) return Promise.resolve(known);
  const existing = pendingUploads.get(cacheKey);
  if (existing) return existing;
  const upload = retryAssetOperation(() => performEncryptedUpload(options))
    .then(id => { knownUploads.set(cacheKey, id); return id; })
    .finally(() => pendingUploads.delete(cacheKey));
  pendingUploads.set(cacheKey, upload);
  return upload;
}

export async function loadEncryptedAsset(assetId: string, journalKey: CryptoKey) {
  const supabase = createClient();
  const { data: row, error: rowError } = await supabase
    .from("encrypted_assets")
    .select("id, storage_path, encrypted_metadata")
    .eq("id", assetId)
    .single();
  fail(rowError);
  if (!row) throw new Error("The encrypted media item could not be found.");

  const asset = row as AssetRow;
  const metadata = await decryptJson<AssetMetadata>(asset.encrypted_metadata, journalKey);
  const { data: encryptedFile, error: downloadError } = await supabase.storage.from(BUCKET).download(asset.storage_path);
  fail(downloadError);
  if (!encryptedFile) throw new Error("The encrypted media item could not be downloaded.");
  const plaintext = await decryptBinary(await encryptedFile.arrayBuffer(), metadata.iv, journalKey);
  const objectUrl = URL.createObjectURL(new Blob([plaintext], { type: metadata.mimeType }));
  managedObjectUrls.add(objectUrl);
  return objectUrl;
}

export function revokeEncryptedAssetUrl(source?: string) {
  if (!source?.startsWith("blob:") || !managedObjectUrls.has(source)) return;
  URL.revokeObjectURL(source);
  managedObjectUrls.delete(source);
}

export function revokeAllEncryptedAssetUrls() {
  for (const source of managedObjectUrls) URL.revokeObjectURL(source);
  managedObjectUrls.clear();
}

export async function cleanupUnreferencedAssets(journalId: string, referencedIds: Set<string>) {
  const supabase = createClient();
  const { data, error } = await supabase.from("encrypted_assets").select("id, storage_path").eq("journal_id", journalId);
  fail(error);
  const unused = (data ?? []).filter(asset => !referencedIds.has(asset.id));
  if (!unused.length) return;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(unused.map(asset => asset.storage_path));
  fail(storageError);
  const { error: rowsError } = await supabase.from("encrypted_assets").delete().in("id", unused.map(asset => asset.id));
  fail(rowsError);
  const unusedIds = new Set(unused.map(asset => asset.id));
  for (const [key, id] of knownUploads) if (unusedIds.has(id)) knownUploads.delete(key);
}
