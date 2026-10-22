import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

test("drawing snapshot is bounded and keeps transparent ink readable", async ({ page }) => {
  const source = await readFile(resolve(process.cwd(), "lib/drawing-storage.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = await page.evaluate(async code => {
    const { serializeDrawing } = await import(`data:text/javascript;base64,${btoa(code)}`);
    const canvas = document.createElement("canvas"); canvas.width = 4000; canvas.height = 2000;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "rgba(255, 200, 0, 0.25)"; context.fillRect(300, 250, 1000, 500);
    const data = serializeDrawing(canvas);
    const image = new Image(); image.src = data; await image.decode();
    const decoded = document.createElement("canvas"); decoded.width = image.naturalWidth; decoded.height = image.naturalHeight;
    const decodedContext = decoded.getContext("2d")!; decodedContext.drawImage(image, 0, 0);
    return { width: image.naturalWidth, height: image.naturalHeight, bytes: (await (await fetch(data)).blob()).size,
      alpha: decodedContext.getImageData(160, 140, 1, 1).data[3], clearAlpha: decodedContext.getImageData(0, 0, 1, 1).data[3], type: data.slice(0, 15) };
  }, compiled);
  expect(result.width).toBe(1600); expect(result.height).toBe(800);
  expect(result.bytes).toBeLessThanOrEqual(512 * 1024);
  expect(result.alpha).toBeGreaterThan(55); expect(result.alpha).toBeLessThan(75);
  expect(result.clearAlpha).toBe(0); expect(result.type).toBe("data:image/webp");
});
