import { useLayoutEffect } from "react";
import type { ThemeMode } from "@/types/wishlist";

export const THEME_KEY = "wishlist-theme";

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "light") return false;
  if (mode === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemeMode(mode: ThemeMode): boolean {
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle("light", !dark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function applyStoredTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  const mode: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  return applyThemeMode(mode);
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode);
  return applyThemeMode(mode);
}

export function readThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function ThemeBoot() {
  useLayoutEffect(() => {
    applyStoredTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemeMode() === "system") applyThemeMode("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return null;
}
