export type Book = { id: string; title: string; tone: string; label: string };
export type PageId = string | number;
export type Sticker = { id: number; value: string; x: number; y: number; rotation: number };
export type Photo = { id: number; src: string; assetId?: string; x: number; y: number; rotation: number; framed: boolean; z: number; size: number; shape: "square" | "round" | "soft" | "wavy" };
export type Joy = { id: number; text: string; done: boolean };
export type PageData = {
  id: PageId;
  pageName: string;
  pageDate: string;
  title: string;
  note: string;
  placed: Sticker[];
  photos: Photo[];
  drawingData: string;
  drawingAssetId?: string;
  joys: Joy[];
  joysVisible: boolean;
  joyPosition?: { x: number; y: number };
  pattern: string;
  paperColor: string;
  font: string;
  fontSize: number;
  textColor: string;
};

export type JournalDocument = { version: 2; pages: PageData[]; theme: string; updatedAt: string; pendingSync?: boolean };
