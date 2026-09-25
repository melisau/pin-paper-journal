import { createClient } from "@/lib/supabase/client";

export type StorageUsage = { usedBytes: number; quotaBytes: number };

export async function getEncryptedStorageUsage(): Promise<StorageUsage> {
  const { data, error } = await createClient().rpc("encrypted_storage_usage");
  if (error) {
    if (error.message.includes("encrypted_storage_usage")) throw new Error("Apply supabase/migrations/003_storage_quota.sql to enable storage limits.");
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { usedBytes: Number(row?.used_bytes ?? 0), quotaBytes: Number(row?.quota_bytes ?? 250 * 1024 * 1024) };
}

export function formatStorage(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
