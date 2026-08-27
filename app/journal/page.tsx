import { redirect } from "next/navigation";
import JournalApp from "@/components/journal-app";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/");
  return <JournalApp />;
}
