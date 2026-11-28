import { createRoot } from "react-dom/client";
import { WishlistApp } from "@/components/wishlist-app";
import { isStandaloneApp } from "@/lib/standalone";
import "@/styles.css";

/**
 * Measure the visible viewport and publish it as CSS variables.
 * Standalone iOS can report 100dvh / visualViewport shorter than the screen,
 * which leaves a strip of the document background under the app shell.
 * In a browser tab, visualViewport avoids sizing the shell under the URL bar.
 * Safe-area insets stay on the dock and controls — they are not added here.
 */
function syncAppViewport() {
  const viewport = window.visualViewport;
  const innerHeight = window.innerHeight;
  const clientHeight = document.documentElement.clientHeight;
  const visualHeight = viewport?.height ?? innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;
  const standalone = isStandaloneApp();
  const keyboardOpen = viewport != null && innerHeight - visualHeight > 140;
  const height = keyboardOpen
    ? visualHeight
    : standalone
      ? Math.max(visualHeight, innerHeight, clientHeight)
      : visualHeight;
  const top = keyboardOpen ? offsetTop : 0;

  document.documentElement.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--app-viewport-top", `${Math.round(top)}px`);
}

function installViewportSync() {
  syncAppViewport();
  window.addEventListener("resize", syncAppViewport);
  window.addEventListener("orientationchange", syncAppViewport);
  window.visualViewport?.addEventListener("resize", syncAppViewport);
  window.visualViewport?.addEventListener("scroll", syncAppViewport);
}

installViewportSync();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<WishlistApp />);
}
