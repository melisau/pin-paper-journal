import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptJson, generateEncryptionKey } from "@/lib/crypto";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), selectEq: vi.fn(), deleteIn: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  from: () => ({
    insert: mocks.insert,
    select: () => ({ eq: mocks.selectEq }),
    delete: () => ({ in: mocks.deleteIn }),
  }),
}) }));

import { cleanupUnreferencedAssets, uploadEncryptedAsset } from "@/lib/asset-repository";

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
    mocks.insert.mockResolvedValueOnce({ error: { message: "insert failed" } });
    const key = await generateEncryptionKey();
    await expect(uploadEncryptedAsset({ userId: "user", journalId: "journal-b", journalKey: key, source: "data:text/plain;base64,eA==", name: "broken" })).rejects.toThrow("insert failed");
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user\/journal-b\/.+\.bin$/)]);
  });

  it("deletes only assets no longer referenced by any page", async () => {
    mocks.selectEq.mockResolvedValue({ data: [{ id: "keep", storage_path: "keep.bin" }, { id: "remove", storage_path: "remove.bin" }], error: null });
    await cleanupUnreferencedAssets("journal", new Set(["keep"]));
    expect(mocks.remove).toHaveBeenCalledWith(["remove.bin"]);
    expect(mocks.deleteIn).toHaveBeenCalledWith("id", ["remove"]);
  });
});
