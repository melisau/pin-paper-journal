import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { THEME_BOOTSTRAP, THEME_STORAGE_KEY } from "@/lib/theme";

describe("brand themes", () => {
  beforeEach(() => { localStorage.removeItem(THEME_STORAGE_KEY); delete document.documentElement.dataset.theme; });
  it("restores the saved theme before rendering", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.eval(THEME_BOOTSTRAP);
    expect(document.documentElement.dataset.theme).toBe("dark");
    render(<ThemeSwitcher language="en"/>);
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
  });
  it("uses the device preference when there is no valid saved choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "invalid");
    vi.spyOn(window, "matchMedia").mockReturnValueOnce({ matches: true } as MediaQueryList);
    window.eval(THEME_BOOTSTRAP);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("switches both ways, persists the choice, and has Turkish labels", () => {
    render(<ThemeSwitcher language="tr"/>);
    fireEvent.click(screen.getByRole("button", { name: "Koyu tema" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Açık tema" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
  it("stays usable when storage is blocked", () => {
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeSwitcher language="en"/>);
    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    failure.mockRestore();
  });
  it("syncs changes from another tab", () => {
    render(<ThemeSwitcher language="en"/>);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" })));
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
  });
});
