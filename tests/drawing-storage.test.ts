import { describe, expect, it, vi } from "vitest";
import { MAX_DRAWING_BYTES, serializeDrawing, validateInlineDrawing } from "@/lib/drawing-storage";

describe("bounded drawing snapshots", () => {
  it("accepts transparent PNG/WebP but rejects external or executable sources", () => {
    expect(validateInlineDrawing("data:image/webp;base64,aGVsbG8=")).toContain("webp");
    expect(() => validateInlineDrawing("https://example.com/drawing.png")).toThrow();
    expect(() => validateInlineDrawing("data:image/svg+xml;base64,aGVsbG8=")).toThrow();
  });
  it("limits an inline drawing to 512 KiB of binary data", () => {
    const encoded = btoa("x".repeat(MAX_DRAWING_BYTES + 1));
    expect(() => validateInlineDrawing(`data:image/png;base64,${encoded}`)).toThrow("too large");
  });
  it("caps exported canvas dimensions and uses WebP", () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,aGVsbG8=");
    const canvas = document.createElement("canvas"); canvas.width = 4000; canvas.height = 2000;
    expect(serializeDrawing(canvas)).toContain("webp");
    const exported = encode.mock.instances[0] as HTMLCanvasElement;
    expect(exported.width).toBe(1600); expect(exported.height).toBe(800);
    expect(encode).toHaveBeenCalledWith("image/webp", 0.85);
    context.mockRestore(); encode.mockRestore();
  });
});
