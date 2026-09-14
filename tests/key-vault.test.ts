import { beforeEach, describe, expect, it } from "vitest";
import { clearAccountMasterKey, getAccountMasterKey, hasAccountMasterKey, setAccountMasterKey } from "@/lib/key-vault";

describe("account key vault", () => {
  beforeEach(() => clearAccountMasterKey());

  it("reports whether the current tab has unlocked its encryption key", () => {
    expect(hasAccountMasterKey()).toBe(false);
    expect(() => getAccountMasterKey()).toThrow(/locked/i);
    const key = {} as CryptoKey;
    setAccountMasterKey(key);
    expect(hasAccountMasterKey()).toBe(true);
    expect(getAccountMasterKey()).toBe(key);
  });
});
