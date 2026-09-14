export const JOURNAL_DESIGN_WIDTH = 560;

export function photoSizePercent(size = 180) {
  return Math.min(75, Math.max(14, (size / JOURNAL_DESIGN_WIDTH) * 100));
}

export function pageScaledPixels(value: number) {
  return `${(value / JOURNAL_DESIGN_WIDTH) * 100}cqw`;
}

export function clampJournalPosition(value: number, itemSizePercent: number) {
  return Math.max(0, Math.min(100 - itemSizePercent, value));
}
