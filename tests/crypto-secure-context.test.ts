import { describe, expect, it } from "vitest";
import { generateEncryptionKey } from "@/lib/crypto";

describe("secure browser requirement", () => {
  it("shows an actionable HTTPS message when Web Crypto is unavailable", async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    await expect(generateEncryptionKey()).rejects.toThrow(/HTTPS/);
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
  });
});
