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

export async function compressImage(file: File, maxDimension = 1800, quality = 0.82) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 10 MB or smaller.");
  const bitmap = await createImageBitmap(file);
  try {
    const size = containSize(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "journal-photo"}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
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
