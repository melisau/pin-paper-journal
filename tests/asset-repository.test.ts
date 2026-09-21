import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptJson, encryptBinary, encryptJson, generateEncryptionKey } from "@/lib/crypto";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), download: vi.fn(), insert: vi.fn(), selectEq: vi.fn(), selectSingle: vi.fn(), deleteIn: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, download: mocks.download }) },
  from: () => ({
    insert: mocks.insert,
    select: () => ({ eq: (field: string, value: string) => field === "id" ? { single: mocks.selectSingle } : mocks.selectEq(field, value) }),
    delete: () => ({ in: mocks.deleteIn }),
  }),
}) }));

import { cleanupUnreferencedAssets, loadEncryptedAsset, retryAssetOperation, revokeAllEncryptedAssetUrls, revokeEncryptedAssetUrl, uploadEncryptedAsset } from "@/lib/asset-repository";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "btoa", { configurable: true, value: (value: string) => Buffer.from(value, "binary").toString("base64") });
  Object.defineProperty(globalThis, "atob", { configurable: true, value: (value: string) => Buffer.from(value, "base64").toString("binary") });
});

describe("encrypted asset storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.deleteIn.mockResolvedValue({ error: null });
    mocks.selectSingle.mockReset();
    mocks.download.mockReset();
  });

  it("uploads ciphertext and encrypts media metadata", async () => {
    const key = await generateEncryptionKey();
    const source = `data:text/plain;base64,${Buffer.from("private-photo-bytes").toString("base64")}`;
    const id = await uploadEncryptedAsset({ userId: "user", journalId: "journal-a", journalKey: key, source, name: "photo-1" });
    const uploaded = mocks.upload.mock.calls[0][1] as ArrayBuffer;
    const inserted = mocks.insert.mock.calls[0][0];

    expect(id).toBe(inserted.id);
    expect(new TextDecoder().decode(uploaded)).not.toContain("private-photo-bytes");
    expect(inserted.storage_path).toMatch(/^user\/journal-a\/.+\.bin$/);
    await expect(decryptJson(inserted.encrypted_metadata, key)).resolves.toMatchObject({ name: "photo-1", version: 1 });
  });

  it("removes the Storage object if its database record cannot be created", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "insert failed" } });
    const key = await generateEncryptionKey();
    await expect(uploadEncryptedAsset({ userId: "user", journalId: "journal-b", journalKey: key, source: "data:text/plain;base64,eA==", name: "broken" })).rejects.toThrow("insert failed");
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user\/journal-b\/.+\.bin$/)]);
  });

  it("retries an interrupted operation and succeeds on the third attempt", async () => {
    vi.useFakeTimers();
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue("uploaded");
    const result = retryAssetOperation(operation);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe("uploaded");
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("deletes only assets no longer referenced by any page", async () => {
    mocks.selectEq.mockResolvedValue({ data: [{ id: "keep", storage_path: "keep.bin" }, { id: "remove", storage_path: "remove.bin" }], error: null });
    await cleanupUnreferencedAssets("journal", new Set(["keep"]));
    expect(mocks.remove).toHaveBeenCalledWith(["remove.bin"]);
    expect(mocks.deleteIn).toHaveBeenCalledWith("id", ["remove"]);
  });

  it("revokes decrypted object URLs individually and on final cleanup", async () => {
    const key = await generateEncryptionKey();
    const first = await encryptBinary(new TextEncoder().encode("first").buffer as ArrayBuffer, key);
    const second = await encryptBinary(new TextEncoder().encode("second").buffer as ArrayBuffer, key);
    const metadata = async (iv: string) => encryptJson({ iv, mimeType: "image/webp", name: "memory", version: 1 }, key);
    mocks.selectSingle
      .mockResolvedValueOnce({ data: { id: "one", storage_path: "one.bin", encrypted_metadata: await metadata(first.iv) }, error: null })
      .mockResolvedValueOnce({ data: { id: "two", storage_path: "two.bin", encrypted_metadata: await metadata(second.iv) }, error: null });
    mocks.download
      .mockResolvedValueOnce({ data: new Blob([first.ciphertext]), error: null })
      .mockResolvedValueOnce({ data: new Blob([second.ciphertext]), error: null });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const one = await loadEncryptedAsset("one", key);
    await loadEncryptedAsset("two", key);
    revokeEncryptedAssetUrl(one);
    revokeAllEncryptedAssetUrls();

    expect(revoke.mock.calls.flat()).toEqual(["blob:one", "blob:two"]);
    create.mockRestore();
    revoke.mockRestore();
  });
});
