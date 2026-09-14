let accountMasterKey: CryptoKey | null = null;

export function setAccountMasterKey(key: CryptoKey) {
  accountMasterKey = key;
}

export function getAccountMasterKey() {
  if (!accountMasterKey) {
    throw new Error("Your encryption key is locked. Sign in again to unlock your journals.");
  }
  return accountMasterKey;
}

export function clearAccountMasterKey() {
  accountMasterKey = null;
}
