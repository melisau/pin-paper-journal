import { describe, expect, it } from "vitest";
import { makeBackup, parseBackup } from "@/lib/local-backup";

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
});
