import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "@/lib/auth-redirect";

describe("authentication callback redirect", () => {
  it("allows the local recovery route", () => {
    expect(safeAuthRedirect("/account/recovery")).toBe("/account/recovery");
  });

  it("rejects external and malformed redirects", () => {
    expect(safeAuthRedirect("https://evil.example")).toBe("/journal");
    expect(safeAuthRedirect("//evil.example")).toBe("/journal");
    expect(safeAuthRedirect("/\\evil.example")).toBe("/journal");
  });
});
