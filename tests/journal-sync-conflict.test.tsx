import { webcrypto } from "node:crypto";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PageData } from "@/lib/journal-model";
import { generateEncryptionKey } from "@/lib/crypto";
import { readCloudDraft } from "@/lib/cloud-drafts";
import { JournalSyncConflictError } from "@/lib/sync-conflict";

const state = vi.hoisted(() => ({ key: null as CryptoKey | null, revision: 0, pages: [] as PageData[], copies: [] as PageData[], copy: vi.fn(), sync: vi.fn(), router: { replace: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => state.router }));
vi.mock("@/lib/key-vault", () => ({ getAccountMasterKey: () => state.key, hasAccountMasterKey: () => true, restoreAccountMasterKey: async () => true, clearPersistedAccountMasterKey: vi.fn() }));
vi.mock("@/lib/journal-repository", () => ({ listEncryptedJournals: async () => [{ id: "shared", title: "Shared", tone: "sage", label: "notes" }], createEncryptedJournal: vi.fn(), updateEncryptedJournal: vi.fn(), deleteEncryptedJournal: vi.fn() }));
vi.mock("@/lib/page-repository", () => ({
  loadEncryptedPages: async (_key: CryptoKey, id: string) => ({ pages: structuredClone(id === "copy" ? state.copies : state.pages), revision: id === "copy" ? 1 : state.revision }),
  syncEncryptedPages: state.sync, loadEncryptedPageMedia: vi.fn(), reloadEncryptedAsset: vi.fn(), repairEncryptedPhotos: vi.fn(),
}));
vi.mock("@/lib/conflict-copy", () => ({ copyConflictingJournal: state.copy }));
vi.mock("@/lib/storage-usage", () => ({ getEncryptedStorageUsage: async () => null, formatStorage: () => "0" }));
import JournalApp from "@/components/journal-app";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn() } as unknown as CanvasRenderingContext2D);
});
beforeEach(async () => {
  localStorage.clear(); state.key = await generateEncryptionKey(); state.revision = 0;
  state.pages = [{ id: "30000000-0000-4000-8000-000000000001", pageName: "Page 1", pageDate: "", title: "Original", note: "Original", placed: [], photos: [], drawingData: "", joys: [], joysVisible: true, pattern: "lined", paperColor: "#fff", font: "hand", fontSize: 18, textColor: "#555" }];
  state.sync.mockReset().mockImplementation(async (options: { pages: PageData[]; expectedRevision: number }) => {
    if (options.expectedRevision !== state.revision) throw new JournalSyncConflictError();
    state.pages = structuredClone(options.pages);
    return { pages: state.pages, revision: ++state.revision };
  });
  state.copy.mockReset().mockImplementation(async (options: { pages: PageData[] }) => {
    state.copies = structuredClone(options.pages);
    return { id: "copy", title: "Separate", tone: "sage", label: "notes" };
  });
});

it("keeps the stale tab's edits local and offers a separate journal without replacing the winning version", async () => {
  const a = render(<JournalApp cloudUserId="user"/>);
  const b = render(<JournalApp cloudUserId="user"/>);
  const qa = within(a.container), qb = within(b.container);
  await waitFor(() => expect(qa.getByRole("button", { name: "Open Shared" })).toBeInTheDocument());
  await waitFor(() => expect(qb.getByRole("button", { name: "Open Shared" })).toBeInTheDocument());
  fireEvent.click(qa.getByRole("button", { name: "Open Shared" }));
  fireEvent.click(qb.getByRole("button", { name: "Open Shared" }));
  await waitFor(() => expect(qa.getByRole("textbox", { name: "Page title" })).toHaveValue("Original"));
  await waitFor(() => expect(qb.getByRole("textbox", { name: "Page title" })).toHaveValue("Original"));
  fireEvent.change(a.container.querySelector(".writing-area textarea")!, { target: { value: "A new text" } });
  fireEvent.click(qa.getByRole("button", { name: /^Save journal,/ }));
  await waitFor(() => expect(state.pages[0].note).toBe("A new text"));
  fireEvent.change(b.container.querySelector(".writing-area textarea")!, { target: { value: "B offline text" } });
  fireEvent.click(qb.getByRole("button", { name: /^Save journal,/ }));
  await waitFor(() => expect(qb.getByRole("button", { name: "Save draft as a separate journal" })).toBeInTheDocument(), { timeout: 5000 });
  expect(state.pages[0].note).toBe("A new text");
  expect(b.container.querySelector(".writing-area textarea")).toHaveValue("B offline text");
  expect((await readCloudDraft("shared", state.key!))?.pages[0].note).toBe("B offline text");
  fireEvent.click(qb.getByRole("button", { name: "Save draft as a separate journal" }));
  await waitFor(() => expect(state.copy).toHaveBeenCalledOnce());
  await waitFor(() => expect(qb.queryByRole("button", { name: "Save draft as a separate journal" })).not.toBeInTheDocument());
  expect(state.copies[0].note).toBe("B offline text");
  expect(state.pages[0].note).toBe("A new text");
}, 15000);
