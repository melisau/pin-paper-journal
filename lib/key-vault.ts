let accountMasterKey: CryptoKey | null = null;
const journalKeys = new Map<string, CryptoKey>();

export function setAccountMasterKey(key: CryptoKey) {
  accountMasterKey = key;
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

export function setJournalKey(journalId: string, key: CryptoKey) {
  journalKeys.set(journalId, key);
}

export function getCachedJournalKey(journalId: string) {
  return journalKeys.get(journalId) ?? null;
}

export function clearJournalKey(journalId: string) {
  journalKeys.delete(journalId);
}
