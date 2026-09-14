import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageData } from "@/lib/journal-model";

const mocks = vi.hoisted(() => ({ load: vi.fn(), sync: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/page-repository", () => ({ loadEncryptedPages: mocks.load, syncEncryptedPages: mocks.sync }));
vi.mock("@/lib/journal-repository", () => ({ createEncryptedJournal: mocks.create }));

import { importCloudBackup, makeCloudBackup } from "@/lib/cloud-backup";

const page: PageData = {
  id: "14ca2633-3490-48b2-90f5-5d53a537a27e", pageName: "Page 1", pageDate: "", title: "Memory", note: "Portable",
  placed: [], photos: [], drawingData: "", joys: [], joysVisible: true, pattern: "lined", paperColor: "#fff", font: "hand", fontSize: 18, textColor: "#555",
};
const book = { id: "old-journal", title: "Journal", tone: "sage", label: "notes" };

describe("cloud backups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports decrypted page data in the validated backup format", async () => {
    mocks.load.mockResolvedValue({ pages: [page], updatedAt: "2026-09-14T10:00:00.000Z" });
    const backup = await makeCloudBackup([book], {} as CryptoKey);
    expect(backup).toMatchObject({ app: "pin-paper-journal", version: 1, books: [book] });
    expect(backup.journals[book.id]).toMatchObject({ pages: [{ title: "Memory", note: "Portable" }] });
  });

  it("imports journals as new encrypted copies with fresh page IDs", async () => {
    mocks.create.mockResolvedValue({ ...book, id: "new-journal" });
    mocks.sync.mockResolvedValue(undefined);
    const backup = { app: "pin-paper-journal" as const, version: 1 as const, exportedAt: new Date().toISOString(), books: [book], journals: { [book.id]: { pages: [page] } } };
    const imported = await importCloudBackup({ backup, userId: "user", masterKey: {} as CryptoKey });
    expect(imported[0].id).toBe("new-journal");
    const uploadedPage = mocks.sync.mock.calls[0][0].pages[0] as PageData;
    expect(uploadedPage.id).not.toBe(page.id);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ journalId: "new-journal", userId: "user" }));
  });
});
