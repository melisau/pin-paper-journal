export const SYNC_CONFLICT_MESSAGE = "This journal changed on another device or tab. Your draft is safe here. Save it as a separate journal to keep both versions.";

export class JournalSyncConflictError extends Error {
  constructor() { super(SYNC_CONFLICT_MESSAGE); this.name = "JournalSyncConflictError"; }
}

export function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
