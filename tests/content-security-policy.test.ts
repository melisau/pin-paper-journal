import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

describe("Content Security Policy", () => {
  it("allows only nonce-authorized scripts in production", () => {
    const policy = buildContentSecurityPolicy("random-nonce", false);
    expect(policy).toContain("script-src 'self' 'nonce-random-nonce' 'strict-dynamic'");
    expect(policy.match(/script-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("keeps the development eval exception out of production", () => {
    expect(buildContentSecurityPolicy("dev-nonce", true)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("dev-nonce", false)).not.toContain("'unsafe-eval'");
  });
});
