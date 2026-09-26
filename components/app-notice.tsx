"use client";

import { useLanguage } from "@/components/language-switcher";

type Props = {
  message: string;
  kind?: "error" | "warning" | "info";
  onDismiss?: () => void;
  onRetry?: () => void;
};

export function AppNotice({ message, kind = "info", onDismiss, onRetry }: Props) {
  const { t } = useLanguage();
  return <div className={`app-notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
    <span>{t(message)}</span>
    <div>{onRetry ? <button type="button" onClick={onRetry}>{t("Try again")}</button> : null}{onDismiss ? <button type="button" onClick={onDismiss} aria-label={t("Dismiss notification")}>×</button> : null}</div>
  </div>;
}
