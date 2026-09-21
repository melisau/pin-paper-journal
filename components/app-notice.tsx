"use client";

type Props = {
  message: string;
  kind?: "error" | "warning" | "info";
  onDismiss?: () => void;
  onRetry?: () => void;
};

export function AppNotice({ message, kind = "info", onDismiss, onRetry }: Props) {
  return <div className={`app-notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
    <span>{message}</span>
    <div>{onRetry ? <button type="button" onClick={onRetry}>Try again</button> : null}{onDismiss ? <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button> : null}</div>
  </div>;
}
