import { beforeEach, describe, expect, it } from "vitest";
import { readOperationalEvents, reportOperationalError } from "@/lib/error-monitoring";

describe("privacy-safe operational logging", () => {
  beforeEach(() => sessionStorage.clear());

  it("records status and a generic code without journal content or error messages", () => {
    reportOperationalError(new TypeError("secret journal sentence and user@example.com"), "sync");
    const stored = JSON.stringify(readOperationalEvents());

    expect(stored).toContain("network-or-type-error");
    expect(stored).not.toContain("secret journal sentence");
    expect(stored).not.toContain("user@example.com");
  });
});
