import { afterEach, describe, expect, it, vi } from "vitest";
import { exportJournalPage } from "@/lib/page-export";
import type { PageData } from "@/lib/journal-model";

const page = { id: 1, pageName: "Page 1", title: "Memory", note: "Private", photos: [], placed: [], drawingData: "", joys: [], joysVisible: true, pageDate: "", pattern: "lined", paperColor: "#fff", font: "hand", fontSize: 18, textColor: "#555" } satisfies PageData;

describe("page export", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads when Web Share exists but permission is denied", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError")) });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:export") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await expect(exportJournalPage(page, "My Memory")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledOnce();
  });

  it("does not download when the user cancels the share sheet", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await expect(exportJournalPage(page, "My Memory")).resolves.toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });
});
