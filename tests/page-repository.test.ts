import { webcrypto } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptJson, encryptJson, generateEncryptionKey } from "@/lib/crypto";
import type { PageData } from "@/lib/journal-model";

const mocks = vi.hoisted(() => ({
  key: null as CryptoKey | null,
  rows: [] as unknown[], rpc: vi.fn(), upload: vi.fn(), cleanup: vi.fn(), loadAsset: vi.fn(),
}));

vi.mock("@/lib/journal-repository", () => ({ getEncryptedJournalKey: vi.fn(async () => mocks.key) }));
vi.mock("@/lib/asset-repository", () => ({
  uploadEncryptedAsset: mocks.upload,
  cleanupUnreferencedAssets: mocks.cleanup,
  loadEncryptedAsset: mocks.loadAsset,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: mocks.rows, error: null }) }) }) }),
}) }));

import { loadEncryptedPageMedia, loadEncryptedPages, syncEncryptedPages } from "@/lib/page-repository";

const makePage = (id: string | number, title: string): PageData => ({
  id, pageName: title, pageDate: "", title, note: `${title} secret`, placed: [], photos: [], drawingData: "", joys: [], joysVisible: true,
  pattern: "lined", paperColor: "#fffdf7", font: "hand", fontSize: 18, textColor: "#66564b",
});

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, "btoa", { configurable: true, value: (value: string) => Buffer.from(value, "binary").toString("base64") });
  Object.defineProperty(globalThis, "atob", { configurable: true, value: (value: string) => Buffer.from(value, "base64").toString("binary") });
});

describe("encrypted page sync", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.key = await generateEncryptionKey();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.rows = [];
  });

  it("loads page metadata first and opens media only for a requested visible page", async () => {
    const first = makePage("14ca2633-3490-48b2-90f5-5d53a537a27e", "Loaded");
    const encrypted_payload = await encryptJson({
      ...first, id: undefined, photos: [{ id: 1, assetId: "photo-asset", x: 0, y: 0, rotation: 0, framed: false, z: 1, size: 100, shape: "square" }],
      drawingData: undefined, drawingAssetId: "drawing-asset",
    }, mocks.key!);
    mocks.rows = [{ id: first.id, encrypted_payload, position: 0, updated_at: "2026-09-14T12:00:00.000Z" }];
    mocks.loadAsset.mockImplementation(async (id: string) => id === "photo-asset" ? "blob:photo" : "blob:drawing");

    const loaded = await loadEncryptedPages({} as CryptoKey, "journal");
    expect(loaded.updatedAt).toBe("2026-09-14T12:00:00.000Z");
    expect(loaded.pages[0]).toMatchObject({ id: first.id, title: "Loaded", drawingData: "", photos: [{ assetId: "photo-asset", src: "" }] });
    expect(mocks.loadAsset).not.toHaveBeenCalled();
    const opened = await loadEncryptedPageMedia({} as CryptoKey, "journal", loaded.pages[0]);
    expect(opened).toMatchObject({ drawingData: "blob:drawing", photos: [{ src: "blob:photo" }] });
    expect(mocks.loadAsset.mock.calls.map(call => call[0])).toEqual(["photo-asset", "drawing-asset"]);
  });

  it("keeps the page usable and marks an encrypted photo when its object is missing", async () => {
    const page = makePage("14ca2633-3490-48b2-90f5-5d53a537a27e", "Still readable");
    const encrypted_payload = await encryptJson({
      ...page, id: undefined, photos: [{ id: 7, assetId: "missing", x: 0, y: 0, rotation: 0, framed: false, z: 1, size: 100, shape: "square" }], drawingData: undefined,
    }, mocks.key!);
    mocks.rows = [{ id: page.id, encrypted_payload, position: 0, updated_at: "2026-09-14T12:00:00.000Z" }];
    mocks.loadAsset.mockRejectedValue(new Error("object not found"));

    const loaded = await loadEncryptedPages({} as CryptoKey, "journal");
    const opened = await loadEncryptedPageMedia({} as CryptoKey, "journal", loaded.pages[0]);
    expect(loaded.pages[0].title).toBe("Still readable");
    expect(opened.photos[0]).toMatchObject({ src: "", loadError: "object not found" });
  });

  it("sends ordered encrypted records and removes pages absent from the batch through the RPC", async () => {
    const pages = [makePage(1, "Second"), makePage(2, "First")];
    const result = await syncEncryptedPages({ userId: "user", journalId: "journal", masterKey: {} as CryptoKey, pages });
    const [, args] = mocks.rpc.mock.calls[0];

    expect(mocks.rpc).toHaveBeenCalledWith("sync_encrypted_pages", expect.any(Object));
    expect(args.p_pages.map((record: { position: number }) => record.position)).toEqual([0, 1]);
    expect(JSON.stringify(args.p_pages)).not.toContain("Second secret");
    await expect(decryptJson(args.p_pages[0].encrypted_payload, mocks.key!)).resolves.toMatchObject({ title: "Second", note: "Second secret" });
    expect(result.every(page => typeof page.id === "string")).toBe(true);
    expect(mocks.cleanup).toHaveBeenCalledWith("journal", new Set());
  });

  it("uploads photos and drawings, persists only asset references, and reports progress", async () => {
    mocks.upload.mockResolvedValueOnce("photo-asset").mockResolvedValueOnce("drawing-asset");
    const page = makePage(1, "Media");
    page.photos = [{ id: 1, src: "data:image/jpeg;base64,plain", x: 0, y: 0, rotation: 0, framed: false, z: 1, size: 100, shape: "square" }];
    page.drawingData = "data:image/png;base64,drawing";
    const progress = vi.fn();

    await syncEncryptedPages({ userId: "user", journalId: "journal", masterKey: {} as CryptoKey, pages: [page], onAssetProgress: progress });
    const payload = await decryptJson<Record<string, unknown>>(mocks.rpc.mock.calls[0][1].p_pages[0].encrypted_payload, mocks.key!);
    expect(payload).not.toHaveProperty("drawingData");
    expect(JSON.stringify(payload)).not.toContain("base64");
    expect(payload).toMatchObject({ drawingAssetId: "drawing-asset", photos: [{ assetId: "photo-asset" }] });
    expect(progress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]]);
    expect(mocks.cleanup).toHaveBeenCalledWith("journal", new Set(["photo-asset", "drawing-asset"]));
  });
});
