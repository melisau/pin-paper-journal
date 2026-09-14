import { describe, expect, it } from "vitest";
import { containSize } from "@/lib/image-compression";

describe("containSize", () => {
  it("shrinks a landscape image without changing its aspect ratio", () => {
    expect(containSize(4000, 2000, 1800)).toEqual({ width: 1800, height: 900 });
  });

  it("does not enlarge a small image", () => {
    expect(containSize(640, 480, 1800)).toEqual({ width: 640, height: 480 });
  });

  it("rejects invalid dimensions", () => {
    expect(() => containSize(0, 400, 1800)).toThrow("Invalid image dimensions");
  });
});
