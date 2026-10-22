"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, THEME_EVENT, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function subscribe(listener: () => void) {
  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
}

function snapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeSwitcher({ language }: { language: "en" | "tr" }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light" as Theme);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return;
      } catch { return; }
      document.documentElement.dataset.theme = media.matches ? "dark" : "light";
      window.dispatchEvent(new Event(THEME_EVENT));
    };
    const updateStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : event.newValue === "light" ? "light" : media.matches ? "dark" : "light";
      window.dispatchEvent(new Event(THEME_EVENT));
    };
    media.addEventListener("change", updateSystem);
    window.addEventListener("storage", updateStorage);
    return () => { media.removeEventListener("change", updateSystem); window.removeEventListener("storage", updateStorage); };
  }, []);
  const light = language === "tr" ? "Açık tema" : "Light theme";
  const dark = language === "tr" ? "Koyu tema" : "Dark theme";
  return <span className="theme-switcher" role="group" aria-label={language === "tr" ? "Görünüm" : "Appearance"}>
    <button type="button" aria-label={light} title={light} aria-pressed={theme === "light"} onClick={() => applyTheme("light")}><Sun size={16}/></button>
    <button type="button" aria-label={dark} title={dark} aria-pressed={theme === "dark"} onClick={() => applyTheme("dark")}><Moon size={16}/></button>
  </span>;
}
