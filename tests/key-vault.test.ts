import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccountMasterKey, getAccountMasterKey, hasAccountMasterKey, setAccountMasterKey } from "@/lib/key-vault";

describe("account key vault", () => {
  beforeEach(() => clearAccountMasterKey());

  it("reports whether the current tab has unlocked its encryption key", () => {
    expect(hasAccountMasterKey()).toBe(false);
    expect(() => getAccountMasterKey()).toThrow(/locked/i);
    const key = {} as CryptoKey;
    setAccountMasterKey(key);
    expect(hasAccountMasterKey()).toBe(true);
    expect(getAccountMasterKey()).toBe(key);
  });

  it("refuses IndexedDB persistence even when a caller requests it in high-security mode", async () => {
    localStorage.setItem("pin-paper-high-security", "true");
    const store = { delete: vi.fn() };
    const transaction: { objectStore: () => typeof store; oncomplete: (() => void) | null; onerror: (() => void) | null; error?: Error } = {
      objectStore: () => store,
      oncomplete: null,
      onerror: null,
    };
    const db = { transaction: () => transaction, close: vi.fn() };
    const request: { onsuccess: (() => void) | null; onerror: (() => void) | null; result: typeof db; error?: Error } = { onsuccess: null, onerror: null, result: db };
    const open = vi.fn(() => {
      queueMicrotask(() => request.onsuccess?.());
      return request;
    });
    store.delete.mockImplementation(() => queueMicrotask(() => transaction.oncomplete?.()));
    const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open } });
    try {
      await setAccountMasterKey({} as CryptoKey, "user-1", true);
      expect(open).toHaveBeenCalledOnce();
      expect(store.delete).toHaveBeenCalledWith("account-master-key");
      expect(db.close).toHaveBeenCalledOnce();
    } finally {
      localStorage.removeItem("pin-paper-high-security");
      if (previous) Object.defineProperty(globalThis, "indexedDB", previous);
      else Reflect.deleteProperty(globalThis, "indexedDB");
    }
  });
});
