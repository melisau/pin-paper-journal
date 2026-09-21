import { describe, expect, it } from "vitest";
import { journalChangeSignature } from "@/lib/journal-change-signature";
import type { PageData } from "@/lib/journal-model";

const page: PageData = {
  id: "page-1", pageName: "Today", pageDate: "2026-09-21", title: "Title", note: "Text",
  placed: [], photos: [{ id: 1, src: "blob:first", assetId: "asset-a", loadError: "temporary", x: 10, y: 20, rotation: 0, framed: true, z: 1, size: 180, shape: "square" }],
  drawingData: "", drawingAssetId: "drawing-a", joys: [], joysVisible: true, joyPosition: { x: 50, y: 60 },
  pattern: "lined", paperColor: "#fff", font: "hand", fontSize: 18, textColor: "#66564b",
};

describe("journalChangeSignature", () => {
  it("ignores asset IDs, blob URLs and load errors produced by a successful sync", () => {
    const synced: PageData = { ...page, drawingAssetId: "drawing-b", photos: [{ ...page.photos[0], src: "blob:second", assetId: "asset-b", loadError: undefined }] };
    expect(journalChangeSignature([synced], "Blush")).toBe(journalChangeSignature([page], "Blush"));
  });

  it("changes when editable journal content changes", () => {
    expect(journalChangeSignature([{ ...page, note: "New text" }], "Blush")).not.toBe(journalChangeSignature([page], "Blush"));
  });
});
