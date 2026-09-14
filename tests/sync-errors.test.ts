import { describe, expect, it } from "vitest";
import { isOfflineSyncError, OFFLINE_DRAFT_MESSAGE } from "@/lib/sync-errors";

describe("cloud sync error handling", () => {
  it("turns fetch failures into a safe offline state", () => {
    expect(isOfflineSyncError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isOfflineSyncError(new Error("TypeError: Failed to fetch"), true)).toBe(true);
    expect(isOfflineSyncError({ message: "Network request failed" }, true)).toBe(true);
    expect(isOfflineSyncError(new Error("Offline"), false)).toBe(true);
    expect(OFFLINE_DRAFT_MESSAGE).toMatch(/saved on this device/i);
  });

  it("keeps actual server errors distinct", () => {
    expect(isOfflineSyncError(new Error("permission denied"), true)).toBe(false);
  });
});
