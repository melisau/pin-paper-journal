import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccountKeyBundle, createJournalKeyBundle, decryptJson, encryptJson, unwrapJournalKey, unwrapKey } from "@/lib/crypto";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "btoa", { configurable: true, value: (value: string) => Buffer.from(value, "binary").toString("base64") });
  Object.defineProperty(globalThis, "atob", { configurable: true, value: (value: string) => Buffer.from(value, "base64").toString("binary") });
});

describe("encrypted journal key chain", () => {
  it("unlocks and decrypts journal metadata with the account password", async () => {
    const account = await createAccountKeyBundle("a-long-test-password");
    const unlockedMaster = await unwrapKey(account.wrappedByPassword, "a-long-test-password");
    const journal = await createJournalKeyBundle(unlockedMaster);
    const encrypted = await encryptJson({ title: "Private notes", tone: "sage", label: "mine" }, journal.journalKey);

    expect(encrypted.ciphertext).not.toContain("Private notes");

    const unlockedJournal = await unwrapJournalKey(unlockedMaster, journal.wrappedByMaster);
    await expect(decryptJson(encrypted, unlockedJournal)).resolves.toEqual({ title: "Private notes", tone: "sage", label: "mine" });
  });
});
