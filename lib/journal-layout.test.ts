import { describe, expect, it } from "vitest";
import { clampJournalPosition, pageScaledPixels, photoSizePercent } from "./journal-layout";

describe("journal layout coordinates", () => {
  it("stores photo width as the same page percentage on every viewport", () => {
    expect(photoSizePercent(180)).toBeCloseTo(32.142857);
    expect(photoSizePercent(80)).toBeCloseTo(14.285714);
    expect(photoSizePercent(420)).toBe(75);
  });

  it("keeps dragged items inside the page using their actual relative size", () => {
    expect(clampJournalPosition(-4, 20)).toBe(0);
    expect(clampJournalPosition(45, 20)).toBe(45);
    expect(clampJournalPosition(96, 20)).toBe(80);
  });

  it("scales typography from the same page design width", () => {
    expect(pageScaledPixels(28)).toBe("5cqw");
  });
});
