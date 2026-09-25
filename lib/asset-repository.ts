import { decryptBinary, decryptJson, encryptBinary, encryptJson, type EncryptedValue } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "encrypted-journal-assets";
const pendingUploads = new Map<string, Promise<string>>();
const knownUploads = new Map<string, string>();
const managedObjectUrls = new Set<string>();
const MAX_UPLOAD_ATTEMPTS = 3;
const CACHE_DB = "pin-paper-encrypted-assets";
const CACHE_STORE = "assets";
const MAX_CACHE_BYTES = 100 * 1024 * 1024;

type AssetMetadata = { iv: string; mimeType: string; name: string; version: 1 };
type AssetRow = { id: string; storage_path: string; encrypted_metadata: EncryptedValue };
type CachedAsset = { id: string; ciphertext: ArrayBuffer; encryptedMetadata: EncryptedValue; size: number; accessedAt: number };

function openAssetCache() {
  if (typeof indexedDB === "undefined") return Promise.resolve<IDBDatabase | null>(null);
  return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(CACHE_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(CACHE_STORE,{keyPath:"id"});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
}

async function readCachedAsset(id:string) {
  try{const db=await openAssetCache();if(!db)return null;const cached=await new Promise<CachedAsset|undefined>((resolve,reject)=>{const request=db.transaction(CACHE_STORE,"readonly").objectStore(CACHE_STORE).get(id);request.onsuccess=()=>resolve(request.result as CachedAsset|undefined);request.onerror=()=>reject(request.error)});db.close();return cached??null}catch{return null}
}

async function cacheEncryptedAsset(asset:CachedAsset) {
  try{const db=await openAssetCache();if(!db)return;const existing=await new Promise<CachedAsset[]>((resolve,reject)=>{const request=db.transaction(CACHE_STORE,"readonly").objectStore(CACHE_STORE).getAll();request.onsuccess=()=>resolve(request.result as CachedAsset[]);request.onerror=()=>reject(request.error)});const removals=existing.filter(item=>item.id!==asset.id).sort((a,b)=>a.accessedAt-b.accessedAt);let total=removals.reduce((sum,item)=>sum+item.size,0)+asset.size;const transaction=db.transaction(CACHE_STORE,"readwrite"),store=transaction.objectStore(CACHE_STORE);while(total>MAX_CACHE_BYTES&&removals.length){const oldest=removals.shift()!;store.delete(oldest.id);total-=oldest.size}store.put(asset);await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()}catch{/* Cache failures must never block encrypted media. */}
}

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
  const cached=await readCachedAsset(assetId);
  if(cached){const metadata=await decryptJson<AssetMetadata>(cached.encryptedMetadata,journalKey);const plaintext=await decryptBinary(cached.ciphertext,metadata.iv,journalKey);const objectUrl=URL.createObjectURL(new Blob([plaintext],{type:metadata.mimeType}));managedObjectUrls.add(objectUrl);return objectUrl}
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
  const ciphertext=await encryptedFile.arrayBuffer();
  await cacheEncryptedAsset({id:assetId,ciphertext,encryptedMetadata:asset.encrypted_metadata,size:ciphertext.byteLength,accessedAt:Date.now()});
  const plaintext = await decryptBinary(ciphertext, metadata.iv, journalKey);
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
