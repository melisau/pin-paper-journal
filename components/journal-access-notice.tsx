"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";

export default function JournalAccessNotice() {
  const router = useRouter();
  const { t } = useLanguage();
  const [pending, startTransition] = useTransition();

  return <main className="auth-screen">
    <section className="auth-paper">
      <LanguageSwitcher />
      <div className="auth-mark"><LockKeyhole /><span>PIN & PAPER</span></div>
      <h1>{t("Let's try that again")}</h1>
      <p className="auth-message" role="status">{t("We couldn't verify your sign-in right now. Please try again.")}</p>
      <button type="button" className="auth-submit" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {t(pending ? "Please wait…" : "Try again")}
      </button>
      <button type="button" className="auth-link" disabled={pending} onClick={() => router.replace("/?auth=session")}>
        {t("Sign in again")}
      </button>
    </section>
  </main>;
}
