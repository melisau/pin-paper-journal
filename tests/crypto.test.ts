import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccountKeyBundle, createJournalKeyBundle, decryptBinary, decryptJson, encryptBinary, encryptJson, rewrapAccountKeyWithRecovery, unwrapJournalKey, unwrapKey } from "@/lib/crypto";

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

  it("encrypts photo and drawing bytes without exposing their contents", async () => {
    const account = await createAccountKeyBundle("another-long-test-password");
    const masterKey = await unwrapKey(account.wrappedByPassword, "another-long-test-password");
    const journal = await createJournalKeyBundle(masterKey);
    const journalKey = await unwrapJournalKey(masterKey, journal.wrappedByMaster);
    const original = new TextEncoder().encode("private image bytes");
    const encrypted = await encryptBinary(original.buffer, journalKey);

    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain("private image bytes");
    const decrypted = await decryptBinary(encrypted.ciphertext, encrypted.iv, journalKey);
    expect(Array.from(new Uint8Array(decrypted))).toEqual(Array.from(original));
  });

  it("recovers the same master key and wraps it with a new password", async () => {
    const account = await createAccountKeyBundle("original-long-password");
    const journal = await createJournalKeyBundle(account.masterKey);
    const encrypted = await encryptJson({ note: "still readable after reset" }, journal.journalKey);
    const recovered = await rewrapAccountKeyWithRecovery(account.wrappedByRecovery, account.recoveryCode, "replacement-long-password");
    const reopenedMaster = await unwrapKey(recovered.wrappedByPassword, "replacement-long-password");
    const reopenedJournal = await unwrapJournalKey(reopenedMaster, journal.wrappedByMaster);
    await expect(decryptJson(encrypted, reopenedJournal)).resolves.toEqual({ note: "still readable after reset" });
    await expect(unwrapKey(recovered.wrappedByPassword, "original-long-password")).rejects.toThrow();
  });
});
