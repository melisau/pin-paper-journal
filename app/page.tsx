"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createAccountKeyBundle } from "@/lib/crypto";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  async function ensureEncryptionKeys(userId: string) {
    const supabase = createClient();
    const { data } = await supabase.from("user_key_bundles").select("user_id").eq("user_id", userId).maybeSingle();
    if (data) return false;
    const bundle = await createAccountKeyBundle(password);
    const { error } = await supabase.from("user_key_bundles").insert({
      user_id: userId,
      wrapped_by_password: bundle.wrappedByPassword,
      wrapped_by_recovery: bundle.wrappedByRecovery,
    });
    if (error) throw error;
    setRecoveryCode(bundle.recoveryCode);
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setMessage(error ? error.message : "Check your email to confirm your account.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else if (data.user) {
        try {
          const created = await ensureEncryptionKeys(data.user.id);
          if (created) setMessage("Save your recovery code before continuing.");
          else router.push("/journal");
        } catch {
          setMessage("Your account opened, but encryption setup could not be completed.");
        }
      }
    }
    setBusy(false);
  }

  async function resetPassword() {
    if (!email) return setMessage("Enter your email first.");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/recovery`,
    });
    setMessage(error ? error.message : "Password reset email sent.");
  }

  return <main className="auth-screen">
    <section className="auth-paper">
      <div className="auth-mark"><BookOpen /><span>PIN & PAPER</span></div>
      <p className="auth-kicker">Your private corner of memories</p>
      <h1>{mode === "signin" ? "Welcome back" : "Create your journal"}</h1>
      <p className="auth-copy">Your journal content is encrypted in your browser before it is saved.</p>
      <form onSubmit={submit}>
        <label><span><Mail /> Email</span><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label><span><LockKeyhole /> Password</span><input type="password" minLength={10} autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Open my journals" : "Create account"}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      {recoveryCode && <div className="recovery-card"><strong>Your recovery code</strong><code>{recoveryCode}</code><p>Store it in a password manager. It is not saved as readable text.</p><button onClick={() => navigator.clipboard.writeText(recoveryCode)}>Copy code</button><button onClick={() => router.push("/journal")}>I saved it — continue</button></div>}
      {mode === "signin" && <button className="auth-link" onClick={resetPassword}>Forgot password?</button>}
      <button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
      <p className="auth-security"><LockKeyhole /> Database access alone cannot reveal journal text.</p>
    </section>
  </main>;
}
