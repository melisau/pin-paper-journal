import { redirect } from "next/navigation";
import JournalApp from "@/components/journal-app";
import JournalAccessNotice from "@/components/journal-access-notice";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  let result;
  try {
    const supabase = await createClient();
    result = await supabase.auth.getClaims();
  } catch {
    return <JournalAccessNotice />;
  }
  const { data, error } = result;
  // A network/verification failure is not a signed-out session. Keep the user
  // here so that retrying does not bounce between two disagreeing auth checks.
  if (error && error.name !== "AuthSessionMissingError") return <JournalAccessNotice />;
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) redirect("/?auth=session");
  return <JournalApp cloudUserId={userId} />;
}
