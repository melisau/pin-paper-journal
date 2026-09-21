export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function containSize(width: number, height: number, maxDimension: number) {
  if (width <= 0 || height <= 0 || maxDimension <= 0) throw new Error("Invalid image dimensions");
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image compression failed")), type, quality);
  });
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some mobile browsers expose createImageBitmap but cannot decode gallery files with it.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("This image format could not be opened. Try a JPG, PNG, or WebP image.");
  }
}

export async function compressImage(file: File, maxDimension = 1800, quality = 0.82) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 10 MB or smaller.");
  const decoded = await decodeImage(file);
  try {
    const size = containSize(decoded.width, decoded.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "journal-photo"}.webp`, { type: "image/webp" });
  } finally {
    decoded.close();
  }
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Processes gallery selections one at a time to keep mobile peak memory bounded. */
export async function processImageBatch<T>(files: Iterable<File>, process: (file: File, index: number) => Promise<T>) {
  const results: T[] = [];
  let index = 0;
  for (const file of files) {
    results.push(await process(file, index));
    index += 1;
  }
  return results;
}
