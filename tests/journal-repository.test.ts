import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEncryptedJournals } from "@/lib/journal-repository";
import type { MasterWrappedKey } from "@/lib/crypto";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; encrypted_metadata: { ciphertext: string; iv: string; version: 1 }; wrapped_key_by_master: MasterWrappedKey }>,
  releaseSecond: undefined as (() => void) | undefined,
  updates: [] as Array<{ wrapped_key_by_master: Record<string, unknown> }>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({
    select: () => ({ order: async () => ({ data: state.rows, error: null }) }),
    update: (payload: { wrapped_key_by_master: Record<string, unknown> }) => ({ eq: async () => { state.updates.push(payload); return { error: null }; } }),
  }) }),
}));
vi.mock("@/lib/crypto", () => ({
  unwrapJournalKey: vi.fn(async (_master: CryptoKey, wrapped: { ciphertext: string }) => {
    if (wrapped.ciphertext === "second") await new Promise<void>(resolve => { state.releaseSecond = resolve; });
    return {} as CryptoKey;
  }),
  decryptJson: vi.fn(async (encrypted: { ciphertext: string }) => ({ title: encrypted.ciphertext, tone: "rose", label: "notes" })),
  rewrapJournalKeyForMaster: vi.fn(async () => ({ ciphertext: "fast", iv: "iv", version: 1, kdf: "AES-GCM-MASTER" })),
  addLegacyJournalWrap: vi.fn(async (_master: CryptoKey, _journal: CryptoKey, fastWrap: Record<string, unknown>) => ({
    ciphertext: "legacy", iv: "iv", salt: "salt", iterations: 600_000, version: 1, kdf: "PBKDF2-SHA256", fast_wrap: fastWrap,
  })),
}));
vi.mock("@/lib/key-vault", () => ({ setJournalKey: vi.fn(), clearJournalKey: vi.fn(), getCachedJournalKey: vi.fn() }));
vi.mock("@/lib/error-monitoring", () => ({ recordOperationalTiming: vi.fn() }));

describe("encrypted library loading", () => {
  beforeEach(() => {
    state.rows = ["first", "second", "third"].map(id => ({
      id,
      encrypted_metadata: { ciphertext: id, iv: "", version: 1 },
      wrapped_key_by_master: { ciphertext: id, iv: "", salt: "", iterations: 600_000, version: 1, kdf: "PBKDF2-SHA256", fast_wrap: { ciphertext: id, iv: "", version: 1, kdf: "AES-GCM-MASTER" } },
    }));
    state.releaseSecond = undefined;
    state.updates = [];
  });

  it("publishes the first cover before all other journal keys finish opening", async () => {
    const onBook = vi.fn();
    const loading = listEncryptedJournals({} as CryptoKey, onBook);
    await vi.waitFor(() => expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: "first" }), 0));
    await vi.waitFor(() => expect(state.releaseSecond).toBeTypeOf("function"));
    expect(onBook).not.toHaveBeenCalledWith(expect.objectContaining({ id: "second" }), 1);

    state.releaseSecond?.();
    const books = await loading;
    expect(books.map(book => book.id)).toEqual(["first", "second", "third"]);
  });

  it("adds a fast wrapper without deleting the older readable wrapper", async () => {
    const wrapper = state.rows[0].wrapped_key_by_master;
    if (wrapper.kdf !== "PBKDF2-SHA256") throw new Error("Expected legacy test fixture.");
    state.rows = [{ ...state.rows[0], wrapped_key_by_master: { ...wrapper, fast_wrap: undefined } }];
    await listEncryptedJournals({} as CryptoKey);
    await vi.waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0].wrapped_key_by_master).toEqual(expect.objectContaining({
      kdf: "PBKDF2-SHA256", salt: "", iterations: 600_000,
      fast_wrap: expect.objectContaining({ kdf: "AES-GCM-MASTER" }),
    }));
  });

  it("repairs a fast-only wrapper from the interim format without changing the journal", async () => {
    state.rows = [{
      id: "first", encrypted_metadata: { ciphertext: "first", iv: "", version: 1 },
      wrapped_key_by_master: { ciphertext: "first", iv: "iv", version: 1, kdf: "AES-GCM-MASTER" },
    }];
    const books = await listEncryptedJournals({} as CryptoKey);
    expect(books[0].id).toBe("first");
    await vi.waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0].wrapped_key_by_master).toEqual(expect.objectContaining({
      kdf: "PBKDF2-SHA256", fast_wrap: expect.objectContaining({ kdf: "AES-GCM-MASTER" }),
    }));
  });
});
