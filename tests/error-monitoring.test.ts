import { beforeEach, describe, expect, it, vi } from "vitest";
import { readOperationalEvents, recordOperationalTiming, reportOperationalError } from "@/lib/error-monitoring";

describe("privacy-safe operational logging", () => {
  beforeEach(() => sessionStorage.clear());

  it("records status and a generic code without journal content or error messages", () => {
    reportOperationalError(new TypeError("secret journal sentence and user@example.com"), "sync");
    const stored = JSON.stringify(readOperationalEvents());

    expect(stored).toContain("network-or-type-error");
    expect(stored).not.toContain("secret journal sentence");
    expect(stored).not.toContain("user@example.com");
  });

  it("records only a fixed stage and elapsed time for sign-in diagnostics", () => {
    recordOperationalTiming("auth", "master-key-unlock", performance.now() - 25);
    expect(readOperationalEvents("auth")).toEqual([expect.objectContaining({
      scope: "auth", stage: "master-key-unlock", status: "success", durationMs: expect.any(Number),
    })]);
    expect(JSON.stringify(readOperationalEvents())).not.toContain("password");
  });

  it("never blocks authentication when browser diagnostics are unavailable", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    try {
      expect(() => recordOperationalTiming("auth", "password-sign-in", performance.now())).not.toThrow();
      expect(() => reportOperationalError(new Error("private detail"), "auth")).not.toThrow();
    } finally {
      dispatch.mockRestore();
    }
  });
});
