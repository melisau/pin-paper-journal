"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportOperationalError } from "@/lib/error-monitoring";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  useEffect(() => { reportOperationalError(error, "ui"); }, [error]);
  return <main className="error-screen">
    <section className="error-paper" role="alert">
      <LanguageSwitcher/>
      <p>PIN & PAPER</p>
      <h1>{t("This page needs a fresh start.")}</h1>
      <span>{t("Your private journal content was not included in the error report.")}</span>
      <div><button type="button" onClick={reset}>{t("Try again")}</button><Link href="/">{t("Return to sign in")}</Link></div>
    </section>
  </main>;
}
