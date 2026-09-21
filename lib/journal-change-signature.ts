import type { PageData } from "@/lib/journal-model";

/** Serializes only user-editable content, excluding sync/runtime media metadata. */
export function journalChangeSignature(pages: PageData[], themeName: string) {
  return JSON.stringify({
    themeName,
    pages: pages.map(page => ({
      ...page,
      drawingAssetId: undefined,
      photos: page.photos.map(photo => ({
        id: photo.id,
        x: photo.x,
        y: photo.y,
        rotation: photo.rotation,
        framed: photo.framed,
        z: photo.z,
        size: photo.size,
        shape: photo.shape,
      })),
    })),
  });
}
