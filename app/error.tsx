"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportOperationalError } from "@/lib/error-monitoring";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportOperationalError(error, "ui"); }, [error]);
  return <main className="error-screen">
    <section className="error-paper" role="alert">
      <p>PIN & PAPER</p>
      <h1>This page needs a fresh start.</h1>
      <span>Your private journal content was not included in the error report.</span>
      <div><button type="button" onClick={reset}>Try again</button><Link href="/">Return to sign in</Link></div>
    </section>
  </main>;
}
