import { beforeEach, describe, expect, it } from "vitest";
import { cloudDraftKey, hasPendingCloudDraft, markCloudDraftSynced, readCloudDraft, writeCloudDraft } from "@/lib/cloud-drafts";
import type { PageData } from "@/lib/journal-model";

const page: PageData = {
  id: "14ca2633-3490-48b2-90f5-5d53a537a27e", pageName: "Page 1", pageDate: "", title: "Offline note", note: "Safe locally",
  placed: [], photos: [], drawingData: "", joys: [], joysVisible: true, pattern: "lined", paperColor: "#fffdf7", font: "hand", fontSize: 18, textColor: "#66564b",
};

describe("cloud draft queue", () => {
  beforeEach(() => localStorage.clear());

  it("keeps an offline edit pending until cloud sync succeeds", () => {
    writeCloudDraft("journal-1", [page], "Blush", true);
    expect(hasPendingCloudDraft("journal-1")).toBe(true);
    expect(readCloudDraft("journal-1")?.pages[0].note).toBe("Safe locally");
    markCloudDraftSynced("journal-1", [page], "Blush");
    expect(hasPendingCloudDraft("journal-1")).toBe(false);
  });

  it("ignores malformed or obsolete drafts", () => {
    localStorage.setItem(cloudDraftKey("journal-2"), JSON.stringify({ version: 1, pages: [] }));
    expect(readCloudDraft("journal-2")).toBeNull();
    localStorage.setItem(cloudDraftKey("journal-2"), "not-json");
    expect(readCloudDraft("journal-2")).toBeNull();
  });
});
