import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecoveryForm } from "@/components/recovery-form";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/?error=recovery-session");
  return <RecoveryForm/>;
}
