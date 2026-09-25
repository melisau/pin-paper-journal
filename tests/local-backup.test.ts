import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup, makeBackup, parseBackup } from "@/lib/local-backup";

const books = [{ id: "journal-1", title: "Journal", tone: "rose", label: "notes" }];

describe("local backups", () => {
  it("exports and validates journal data", () => {
    const backup = makeBackup(books, () => JSON.stringify({ pages: [{ id: 1, title: "Today" }] }));
    const restored = parseBackup(JSON.stringify(backup));
    expect(restored.books).toEqual(books);
    expect(restored.journals["journal-1"]).toEqual({ pages: [{ id: 1, title: "Today" }] });
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseBackup('{"version":1}')).toThrow("not a supported Pin & Paper backup");
  });

  it("password-encrypts portable backup files", async () => {
    const backup = makeBackup(books, () => JSON.stringify({ pages: [{ note: "private" }] }));
    const encrypted = await encryptBackup(backup, "a-long-backup-password");
    expect(JSON.stringify(encrypted)).not.toContain("private");
    await expect(decryptBackup(JSON.stringify(encrypted), "a-long-backup-password")).resolves.toEqual(backup);
    await expect(decryptBackup(JSON.stringify(encrypted), "wrong-password")).rejects.toThrow("incorrect");
  });
});
