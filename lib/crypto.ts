const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 600_000;

function secureCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure encryption is unavailable in this browser. Open Pin & Paper over HTTPS, or use localhost on this computer.");
  }
  return globalThis.crypto.subtle;
}

export type EncryptedValue = { ciphertext: string; iv: string; version: 1 };
export type WrappedKey = EncryptedValue & { salt: string; kdf: "PBKDF2-SHA256"; iterations: number };
export type FastMasterWrap = EncryptedValue & { kdf: "AES-GCM-MASTER" };
export type MasterWrappedKey = (WrappedKey & { fast_wrap?: FastMasterWrap }) | FastMasterWrap;
export type EncryptedBinary = { ciphertext: ArrayBuffer; iv: string; version: 1 };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (typeof value !== "string" || !value) throw new Error("Encrypted data is incomplete or invalid.");
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    throw new Error("Encrypted data is incomplete or invalid.");
  }
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function createRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function generateEncryptionKey() {
  return secureCrypto().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function derivePasswordKey(secret: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const subtle = secureCrypto();
  const material = await subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson<T>(value: T, key: CryptoKey): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await secureCrypto().encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, key, plaintext);
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), version: 1 };
}

export async function decryptJson<T>(value: EncryptedValue, key: CryptoKey): Promise<T> {
  const plaintext = await secureCrypto().decrypt(
    { name: "AES-GCM", iv: asBuffer(base64ToBytes(value.iv)) },
    key,
    asBuffer(base64ToBytes(value.ciphertext)),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function wrapKey(key: CryptoKey, secret: string): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await derivePasswordKey(secret, salt);
  const subtle = secureCrypto();
  const rawKey = await subtle.exportKey("raw", key);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, wrappingKey, rawKey);
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    version: 1,
  };
}

export async function unwrapKey(value: WrappedKey, secret: string) {
  const wrappingKey = await derivePasswordKey(secret, base64ToBytes(value.salt), value.iterations);
  const subtle = secureCrypto();
  const rawKey = await subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(base64ToBytes(value.iv)) },
    wrappingKey,
    asBuffer(base64ToBytes(value.ciphertext)),
  );
  return subtle.importKey("raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]);
}

export async function createAccountKeyBundle(password: string) {
  const masterKey = await generateEncryptionKey();
  const recoveryCode = createRecoveryCode();
  return {
    masterKey,
    recoveryCode,
    wrappedByPassword: await wrapKey(masterKey, password),
    wrappedByRecovery: await wrapKey(masterKey, recoveryCode),
  };
}

export async function createJournalKeyBundle(masterKey: CryptoKey, journalPassword?: string) {
  const journalKey = await generateEncryptionKey();
  // Keep the legacy wrapper so a previously open client or a rolled-back
  // deployment can still read this journal. New clients use fast_wrap.
  const fastWrap = await rewrapJournalKeyForMaster(masterKey, journalKey);
  const wrappedByMaster = await addLegacyJournalWrap(masterKey, journalKey, fastWrap);
  return {
    journalKey,
    wrappedByMaster,
    wrappedByPassword: journalPassword ? await wrapKey(journalKey, journalPassword) : null,
  };
}

export async function encryptBinary(value: ArrayBuffer, key: CryptoKey): Promise<EncryptedBinary> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await secureCrypto().encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, key, value);
  return { ciphertext, iv: bytesToBase64(iv), version: 1 };
}

export async function decryptBinary(value: ArrayBuffer, iv: string, key: CryptoKey) {
  return secureCrypto().decrypt({ name: "AES-GCM", iv: asBuffer(base64ToBytes(iv)) }, key, value);
}

export async function unwrapJournalKey(masterKey: CryptoKey, wrappedKey: MasterWrappedKey) {
  // A short-lived version stored the fast wrapper as the entire value rather
  // than nested under fast_wrap. Both shapes must remain readable.
  const fastWrap = wrappedKey.kdf === "AES-GCM-MASTER" ? wrappedKey : wrappedKey.fast_wrap;
  if (fastWrap?.kdf === "AES-GCM-MASTER") {
    const rawKey = await secureCrypto().decrypt(
      { name: "AES-GCM", iv: asBuffer(base64ToBytes(fastWrap.iv)) },
      masterKey,
      asBuffer(base64ToBytes(fastWrap.ciphertext)),
    );
    return secureCrypto().importKey("raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  if (wrappedKey.kdf !== "PBKDF2-SHA256") throw new Error("Encrypted data is incomplete or invalid.");
  const masterRaw = bytesToBase64(new Uint8Array(await secureCrypto().exportKey("raw", masterKey)));
  return unwrapKey(wrappedKey, masterRaw);
}

export async function rewrapJournalKeyForMaster(masterKey: CryptoKey, journalKey: CryptoKey): Promise<FastMasterWrap> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawKey = await secureCrypto().exportKey("raw", journalKey);
  const ciphertext = await secureCrypto().encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, masterKey, rawKey);
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), version: 1, kdf: "AES-GCM-MASTER" };
}

export async function addLegacyJournalWrap(masterKey: CryptoKey, journalKey: CryptoKey, fastWrap: FastMasterWrap): Promise<WrappedKey & { fast_wrap: FastMasterWrap }> {
  const masterRaw = bytesToBase64(new Uint8Array(await secureCrypto().exportKey("raw", masterKey)));
  return { ...await wrapKey(journalKey, masterRaw), fast_wrap: fastWrap };
}

export async function rewrapAccountKeyWithRecovery(wrappedByRecovery: WrappedKey, recoveryCode: string, newPassword: string) {
  const masterKey = await unwrapKey(wrappedByRecovery, recoveryCode.trim());
  return { masterKey, wrappedByPassword: await wrapKey(masterKey, newPassword) };
}
