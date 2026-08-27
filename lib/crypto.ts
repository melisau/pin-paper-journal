const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 600_000;

export type EncryptedValue = { ciphertext: string; iv: string; version: 1 };
export type WrappedKey = EncryptedValue & { salt: string; kdf: "PBKDF2-SHA256"; iterations: number };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function createRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function generateEncryptionKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function derivePasswordKey(secret: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
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
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, key, plaintext);
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), version: 1 };
}

export async function decryptJson<T>(value: EncryptedValue, key: CryptoKey): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
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
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, wrappingKey, rawKey);
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
  const rawKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(base64ToBytes(value.iv)) },
    wrappingKey,
    asBuffer(base64ToBytes(value.ciphertext)),
  );
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]);
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
  const masterRaw = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", masterKey)));
  return {
    journalKey,
    wrappedByMaster: await wrapKey(journalKey, masterRaw),
    wrappedByPassword: journalPassword ? await wrapKey(journalKey, journalPassword) : null,
  };
}
