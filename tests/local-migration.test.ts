import { beforeEach, describe, expect, it } from "vitest";
import { getLocalMigrationSources, makeMigrationBackup, removeMigratedLocalCopies } from "@/lib/local-migration";
import { decryptBackup, encryptBackup } from "@/lib/local-backup";

describe("local journal migration safety", () => {
  beforeEach(() => localStorage.clear());

  it("detects a local journal and leaves it untouched before migration", () => {
    localStorage.setItem("pin-paper-journal-books", JSON.stringify([{ id: "notes", title: "Notes", tone: "sage", label: "mine" }]));
    localStorage.setItem("pin-paper-journal-notes", JSON.stringify({ pages: [{ id: 1, title: "Local", note: "Keep me" }] }));
    const sources = getLocalMigrationSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].pages[0].note).toBe("Keep me");
    expect(localStorage.getItem("pin-paper-journal-notes")).not.toBeNull();
  });

  it("only removes copies recorded as completely migrated", () => {
    localStorage.setItem("pin-paper-journal-books", JSON.stringify([{ id: "done", title: "Done", tone: "rose", label: "one" }, { id: "pending", title: "Pending", tone: "blue", label: "two" }]));
    localStorage.setItem("pin-paper-journal-done", "{}");
    localStorage.setItem("pin-paper-journal-pending", "{}");
    localStorage.setItem("pin-paper-cloud-migration-v1", JSON.stringify({ done: { cloudId: "cloud-done", complete: true }, pending: { cloudId: "cloud-pending", complete: false } }));
    expect(removeMigratedLocalCopies(["done", "pending"])).toBe(1);
    expect(localStorage.getItem("pin-paper-journal-done")).toBeNull();
    expect(localStorage.getItem("pin-paper-journal-pending")).toBe("{}");
    expect(JSON.parse(localStorage.getItem("pin-paper-journal-books") || "[]")).toHaveLength(1);
  });

  it("creates a portable migration backup that can be password-encrypted before download", async () => {
    localStorage.setItem("pin-paper-journal-books", JSON.stringify([{ id: "notes", title: "Notes", tone: "sage", label: "mine" }]));
    localStorage.setItem("pin-paper-journal-notes", JSON.stringify({ pages: [{ id: 1, note: "unpublished secret" }] }));
    const sources = getLocalMigrationSources();
    const backup = makeMigrationBackup(sources);
    const encrypted = await encryptBackup(backup, "backup-password-123");

    expect(JSON.stringify(encrypted)).not.toContain("unpublished secret");
    await expect(decryptBackup(JSON.stringify(encrypted), "backup-password-123")).resolves.toEqual(backup);
    expect(localStorage.getItem("pin-paper-journal-notes")).toContain("unpublished secret");
  });
});
