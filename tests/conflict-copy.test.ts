import { beforeEach, expect, it, vi } from "vitest";
import type { PageData } from "@/lib/journal-model";

const mocks = vi.hoisted(() => ({ create: vi.fn(), load: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/journal-repository", () => ({ createEncryptedJournal: mocks.create }));
vi.mock("@/lib/page-repository", () => ({ loadEncryptedPageMedia: mocks.load, syncEncryptedPages: mocks.sync }));
import { copyConflictingJournal } from "@/lib/conflict-copy";

beforeEach(() => vi.clearAllMocks());
it("copies text and re-encrypts photo/drawing sources under the new journal key", async () => {
  const book = { id: "old", title: "Mine", tone: "sage", label: "notes" };
  const page = { id: "page", note: "B private edit", photos: [{ id: 1, assetId: "old-photo", src: "" }], drawingAssetId: "old-drawing", drawingData: "" } as PageData;
  mocks.load.mockResolvedValue({ ...page, photos: [{ ...page.photos[0], src: "blob:photo" }], drawingData: "blob:drawing" });
  mocks.create.mockResolvedValue({ ...book, id: "new" });
  await copyConflictingJournal({ userId: "user", masterKey: {} as CryptoKey, book, pages: [page], title: "Separate" });
  expect(mocks.create.mock.calls[0][2]).not.toHaveProperty("id");
  expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ journalId: "new", expectedRevision: 0, pages: [expect.objectContaining({ note: "B private edit", drawingAssetId: undefined, drawingData: "blob:drawing", photos: [expect.objectContaining({ assetId: undefined, src: "blob:photo" })] })] }));
  expect(page.photos[0].assetId).toBe("old-photo");
});
it("preserves the draft instead of silently making an incomplete copy", async () => {
  mocks.load.mockResolvedValue({ photos: [{ src: "", loadError: "missing" }] });
  await expect(copyConflictingJournal({ userId: "user", masterKey: {} as CryptoKey, book: { id: "old", title: "Mine", tone: "sage", label: "notes" }, pages: [{} as PageData], title: "Copy" })).rejects.toThrow("original draft is still safe");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
});
