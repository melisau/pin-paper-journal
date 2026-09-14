export function safeAuthRedirect(value: string | null, fallback = "/journal") {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
