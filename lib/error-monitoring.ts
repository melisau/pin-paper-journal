export type OperationScope = "auth" | "sync" | "media" | "ui" | "data";
export type OperationStatus = "started" | "success" | "offline" | "retry" | "failure";
export type OperationalEvent = { at: string; scope: OperationScope; status: OperationStatus; code?: string };

const STORAGE_KEY = "pin-paper-operational-events-v1";
const EVENT_NAME = "pin-paper-operational-event";
const MAX_EVENTS = 50;

export function safeErrorCode(error: unknown) {
  if (error instanceof DOMException) return error.name.slice(0, 40);
  if (error instanceof TypeError) return "network-or-type-error";
  if (error instanceof Error) return error.name.slice(0, 40) || "error";
  return "unknown-error";
}

export function readOperationalEvents(scope?: OperationScope): OperationalEvent[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as OperationalEvent[];
    return scope ? parsed.filter(event => event.scope === scope) : parsed;
  } catch {
    return [];
  }
}

export function recordOperationalEvent(scope: OperationScope, status: OperationStatus, error?: unknown) {
  if (typeof window === "undefined") return;
  const event: OperationalEvent = { at: new Date().toISOString(), scope, status, ...(error ? { code: safeErrorCode(error) } : {}) };
  const events = [...readOperationalEvents(), event].slice(-MAX_EVENTS);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
}

export function subscribeToOperationalEvents(listener: () => void) {
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function reportOperationalError(error: unknown, scope: OperationScope) {
  recordOperationalEvent(scope, "failure", error);
  // Intentionally never send messages, stacks, journal IDs, titles, text, or media URLs.
}
