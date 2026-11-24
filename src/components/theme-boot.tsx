import { useLayoutEffect } from "react";

export const THEME_KEY = "wishlist-theme";

export function applyStoredTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  const dark = stored !== "light";
  document.documentElement.classList.toggle("light", !dark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function setTheme(mode: "light" | "dark") {
  localStorage.setItem(THEME_KEY, mode);
  return applyStoredTheme();
}

export function ThemeBoot() {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);
  return null;
}
