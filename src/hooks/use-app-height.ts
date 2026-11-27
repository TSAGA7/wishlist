import { useEffect } from "react";

/**
 * Keeps --app-height in sync with the visual viewport so fixed dock never sits
 * above a phantom gap on iOS Safari / installed PWAs.
 */
export function useAppHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
}
