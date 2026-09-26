"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LANGUAGE_STORAGE_KEY, translate, type Language } from "@/lib/i18n";

const EVENT_NAME = "pin-paper-language-change";

function subscribe(listener: () => void) {
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT_NAME, listener); window.removeEventListener("storage", listener); };
}

function currentLanguage(): Language {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "tr" ? "tr" : "en"; }
  catch { return "en"; }
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, currentLanguage, () => "en" as Language);
  const setLanguage = (next: Language) => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Continue in memory-only browser mode. */ }
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(EVENT_NAME));
  };
  const t = (source: string, values?: Record<string, string | number>) => translate(language, source, values);
  return { language, setLanguage, t };
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <div className={`language-switcher ${className}`} role="group" aria-label={t("Language")}>
    <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
    <button type="button" lang="tr" aria-pressed={language === "tr"} onClick={() => setLanguage("tr")}>TR</button>
  </div>;
}
