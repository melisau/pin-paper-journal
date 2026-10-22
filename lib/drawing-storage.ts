export const MAX_DRAWING_BYTES = 512 * 1024;
const MAX_DRAWING_DIMENSION = 1600;

export function validateInlineDrawing(source: string) {
  if (!/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(source)) throw new Error("This drawing format could not be saved safely.");
  const encoded = source.slice(source.indexOf(",") + 1);
  const bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
  if (bytes > MAX_DRAWING_BYTES) throw new Error("This drawing is too large to save. Keep this page open and simplify the drawing.");
  return source;
}

/** Bound every canvas snapshot; WebP preserves transparent highlighter layers. */
export function serializeDrawing(canvas: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  let dimension = Math.min(MAX_DRAWING_DIMENSION, Math.max(canvas.width, canvas.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, dimension / Math.max(canvas.width, canvas.height));
    copy.width = Math.max(1, Math.round(canvas.width * scale));
    copy.height = Math.max(1, Math.round(canvas.height * scale));
    const context = copy.getContext("2d");
    if (!context) throw new Error("Drawing compression is unavailable in this browser.");
    context.drawImage(canvas, 0, 0, copy.width, copy.height);
    const data = copy.toDataURL("image/webp", 0.85);
    try { return validateInlineDrawing(data); } catch (error) {
      if (attempt === 5) throw error;
      dimension = Math.max(128, Math.floor(dimension * 0.75));
    }
  }
  throw new Error("The drawing could not be saved.");
}

export async function prepareInlineDrawing(source: string) {
  if (source.startsWith("data:")) {
    try { return validateInlineDrawing(source); } catch { /* Re-encode oversized legacy/imported drawings below. */ }
  }
  if (!source.startsWith("blob:") && !/^data:image\/(?:png|webp);base64,/.test(source)) throw new Error("This drawing format could not be saved safely.");
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Drawing compression is unavailable in this browser.");
  context.drawImage(image, 0, 0);
  return serializeDrawing(canvas);
}
