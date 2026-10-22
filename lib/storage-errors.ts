export class JournalStorageLimitError extends Error {
  constructor(message = "Your encrypted storage is full (250 MB). Remove unused journals or reduce page content before adding more images.") {
    super(message); this.name = "JournalStorageLimitError";
  }
}
