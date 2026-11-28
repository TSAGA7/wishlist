import { useEffect } from "react";

/**
 * Keeps --app-height in sync with the visual viewport so fixed dock never sits
 * above a phantom gap on iOS Safari / installed PWAs.
 */
export function useAppHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(offsetTop)}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    const kick = window.setTimeout(apply, 280);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(kick);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);
}
