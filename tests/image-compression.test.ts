import { describe, expect, it } from "vitest";
import { containSize, processImageBatch } from "@/lib/image-compression";

describe("containSize", () => {
  it("shrinks a landscape image without changing its aspect ratio", () => {
    expect(containSize(4000, 2000, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("does not enlarge a small image", () => {
    expect(containSize(640, 480, 1800)).toEqual({ width: 640, height: 480 });
  });

  it("rejects invalid dimensions", () => {
    expect(() => containSize(0, 400, 1800)).toThrow("Invalid image dimensions");
  });
});

describe("mobile image batches", () => {
  it("processes a large gallery selection sequentially to bound peak memory", async () => {
    const files = Array.from({ length: 24 }, (_, index) => new File([new Uint8Array(512 * 1024)], `photo-${index}.jpg`, { type: "image/jpeg" }));
    let active = 0;
    let peak = 0;
    const results = await processImageBatch(files, async file => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return file.name;
    });

    expect(results).toHaveLength(24);
    expect(peak).toBe(1);
  });
});
