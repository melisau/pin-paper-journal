let accountMasterKey: CryptoKey | null = null;
const journalKeys = new Map<string, CryptoKey>();
const DB_NAME = "pin-paper-key-vault";
const STORE_NAME = "keys";
const MASTER_KEY_ID = "account-master-key";

type StoredMasterKey = { id: string; userId: string; key: CryptoKey };

function openVault() {
  if (typeof indexedDB === "undefined") return Promise.resolve<IDBDatabase | null>(null);
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writePersistedMasterKey(userId: string, key: CryptoKey) {
  const db = await openVault();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: MASTER_KEY_ID, userId, key } satisfies StoredMasterKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export function setAccountMasterKey(key: CryptoKey, userId?: string) {
  accountMasterKey = key;
  return userId ? writePersistedMasterKey(userId, key) : Promise.resolve();
}

export async function restoreAccountMasterKey(userId: string) {
  const db = await openVault();
  if (!db) return false;
  const stored = await new Promise<StoredMasterKey | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(MASTER_KEY_ID);
    request.onsuccess = () => resolve(request.result as StoredMasterKey | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!stored || stored.userId !== userId) return false;
  accountMasterKey = stored.key;
  return true;
}

export function getAccountMasterKey() {
  if (!accountMasterKey) {
    throw new Error("Your encryption key is locked. Sign in again to unlock your journals.");
  }
  return accountMasterKey;
}

export function hasAccountMasterKey() {
  return accountMasterKey !== null;
}

export function clearAccountMasterKey() {
  accountMasterKey = null;
  journalKeys.clear();
}

export async function clearPersistedAccountMasterKey() {
  clearAccountMasterKey();
  const db = await openVault();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(MASTER_KEY_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export function setJournalKey(journalId: string, key: CryptoKey) {
  journalKeys.set(journalId, key);
}

export function getCachedJournalKey(journalId: string) {
  return journalKeys.get(journalId) ?? null;
}

export function clearJournalKey(journalId: string) {
  journalKeys.delete(journalId);
}
