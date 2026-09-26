import type { CSSProperties } from "react";
import type { JournalCover } from "@/lib/journal-model";

type CoverBody = { imageWidth: number; imageHeight: number; x: number; y: number; width: number; height: number };
export type CoverChoice = { id: JournalCover; label: string; body?: CoverBody };

// The supplied PNGs have different amounts of transparent padding. Each body
// rectangle describes the actual book, so every cover occupies the same frame.
export const JOURNAL_COVERS: CoverChoice[] = [
  { id: "journal-1", label: "Moonbound leather" },
  { id: "journal-2", label: "Feather keepsake" },
  { id: "journal-3", label: "Midnight linen" },
  { id: "journal-4", label: "Blush leather" },
  { id: "journal-5", label: "Golden yellow", body: { imageWidth: 1024, imageHeight: 1024, x: 256, y: 137, width: 506, height: 715 } },
  { id: "journal-6", label: "Soft lemon", body: { imageWidth: 1024, imageHeight: 1024, x: 256, y: 137, width: 506, height: 715 } },
  { id: "journal-7", label: "Burgundy leather", body: { imageWidth: 912, imageHeight: 1155, x: 165, y: 154, width: 572, height: 821 } },
  { id: "journal-8", label: "Charcoal leather", body: { imageWidth: 688, imageHeight: 1532, x: 100, y: 399, width: 488, height: 685 } },
  { id: "journal-9", label: "Espresso leather", body: { imageWidth: 335, imageHeight: 746, x: 48, y: 193, width: 239, height: 334 } },
  { id: "journal-10", label: "Pastel pink linen", body: { imageWidth: 849, imageHeight: 1080, x: 100, y: 35, width: 652, height: 871 } },
  { id: "journal-11", label: "Powder blue leather", body: { imageWidth: 849, imageHeight: 1080, x: 97, y: 34, width: 656, height: 871 } },
  { id: "journal-12", label: "Pale sage leather", body: { imageWidth: 864, imageHeight: 1242, x: 118, y: 122, width: 626, height: 915 } },
  { id: "journal-13", label: "Forest green leather", body: { imageWidth: 1024, imageHeight: 1024, x: 252, y: 132, width: 520, height: 730 } },
];

export function coverBodyStyle(body: CoverBody): CSSProperties {
  return {
    position: "absolute",
    left: `${-body.x / body.width * 100}%`,
    top: `${-body.y / body.height * 100}%`,
    width: `${body.imageWidth / body.width * 100}%`,
    height: `${body.imageHeight / body.height * 100}%`,
  };
}
