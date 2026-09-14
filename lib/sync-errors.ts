const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|network request failed|load failed|internet connection|offline/i;

export function isOfflineSyncError(error: unknown, online = typeof navigator === "undefined" ? true : navigator.onLine) {
  if (!online) return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  return NETWORK_ERROR_PATTERN.test(message);
}

export const OFFLINE_DRAFT_MESSAGE = "You are offline. Changes are saved on this device and will sync automatically when you reconnect.";
