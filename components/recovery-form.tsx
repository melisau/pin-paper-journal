"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, KeyRound, LockKeyhole } from "lucide-react";
import { rewrapAccountKeyWithRecovery, type WrappedKey } from "@/lib/crypto";
import { setAccountMasterKey } from "@/lib/key-vault";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";

export function RecoveryForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setMessage("The new passwords do not match.");
    if (password.length < 10) return setMessage("Use at least 10 characters for your new password.");
    setBusy(true);
    setMessage("Opening your encryption key with the recovery code…");
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your recovery session expired. Request a new password-reset email.");
      const { data: bundle, error: bundleError } = await supabase
        .from("user_key_bundles")
        .select("wrapped_by_recovery")
        .eq("user_id", userData.user.id)
        .single();
      if (bundleError || !bundle) throw new Error(bundleError?.message || "Your encryption recovery bundle could not be found.");

      const recovered = await rewrapAccountKeyWithRecovery(bundle.wrapped_by_recovery as WrappedKey, recoveryCode, password);
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error(passwordError.message);
      const { error: wrapError } = await supabase
        .from("user_key_bundles")
        .update({ wrapped_by_password: recovered.wrappedByPassword, updated_at: new Date().toISOString() })
        .eq("user_id", userData.user.id);
      if (wrapError) throw new Error(`Your password changed, but the encryption key could not be updated: ${wrapError.message}. Retry with the same new password and recovery code.`);

      await setAccountMasterKey(recovered.masterKey, userData.user.id);
      setMessage("Password updated. Opening your encrypted journals…");
      router.replace("/journal");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Recovery could not be completed.";
      setMessage(text.includes("operation-specific") || text.includes("decrypt") ? "The recovery code is not valid. Check every character and try again." : text);
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-paper recovery-page">
      <LanguageSwitcher/>
      <div className="auth-mark"><BookOpen/><span>PIN & PAPER</span></div>
      <p className="auth-kicker">{t("Recover your private journal")}</p>
      <h1>{t("Choose a new password")}</h1>
      <p className="auth-copy">{t("Your recovery code opens the existing encryption key. Your journal content never needs to be sent as readable text.")}</p>
      <form onSubmit={submit}>
        <label><span><KeyRound/> {t("Recovery code")}</span><input type="password" autoComplete="one-time-code" spellCheck={false} required value={recoveryCode} onChange={event => setRecoveryCode(event.target.value)} /></label>
        <label><span><LockKeyhole/> {t("New password")}</span><input type="password" minLength={10} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label><span><LockKeyhole/> {t("Confirm new password")}</span><input type="password" minLength={10} autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <button className="auth-submit" disabled={busy}>{t(busy ? "Securing your journals…" : "Update password & unlock")}</button>
      </form>
      {message && <p className="auth-message" role="status">{t(message)}</p>}
      <p className="auth-security"><LockKeyhole/> {t("Your recovery code is never stored by Pin & Paper.")}</p>
    </section>
  </main>;
}
