export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "pin-paper-theme:v1";
export const THEME_EVENT = "pin-paper-theme-change";

// Runs before the first paint. Only a theme preference is stored, never journal data.
export const THEME_BOOTSTRAP = `(function(){var theme;try{theme=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(theme!=='light'&&theme!=='dark'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=theme})();`;

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep the choice in memory if storage is unavailable. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}
