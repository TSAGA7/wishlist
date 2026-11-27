import { useSyncExternalStore } from "react";

/**
 * Same idea as My World / Fitapp: a new service worker installs and waits.
 * The open version keeps working until the user taps «Обновить».
 */
export type UpdateState = { kind: "none" } | { kind: "ready" };

let state: UpdateState = { kind: "none" };
const listeners = new Set<() => void>();

function setState(next: UpdateState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(subscribe, () => state);
}

let registration: ServiceWorkerRegistration | null = null;
let reloadArmed = false;
let started = false;

function reloadOnce() {
  if (reloadArmed) return;
  reloadArmed = true;
  window.location.reload();
}

function watch(reg: ServiceWorkerRegistration) {
  registration = reg;
  if (reg.waiting && navigator.serviceWorker.controller) setState({ kind: "ready" });
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) setState({ kind: "ready" });
    });
  });
}

export function startUpdates(): void {
  if (started || !("serviceWorker" in navigator)) return;
  started = true;
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

  const register = () => {
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || "./" })
      .then((reg) => {
        watch(reg);
        return reg.update();
      })
      .catch(() => undefined);
  };

  // Defer registration so first paint is not blocked by SW setup.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });

  const check = () => {
    void registration?.update().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.setInterval(check, 30 * 60_000);
}

/** The waiting worker takes over and the page reloads. Data in IndexedDB stays. */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage("skip-waiting");
    window.setTimeout(reloadOnce, 4000);
    return;
  }
  reloadOnce();
}

export function dismissUpdate(): void {
  setState({ kind: "none" });
}

/** Settings button: look for a build on the server, then apply it or say we are current. */
export async function checkForUpdate(): Promise<"ready" | "current" | "unsupported"> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  const reg = registration ?? (await navigator.serviceWorker.getRegistration()) ?? null;
  registration = reg;
  if (!reg) return "unsupported";
  await reg.update().catch(() => undefined);
  if (reg.waiting && navigator.serviceWorker.controller) {
    setState({ kind: "ready" });
    return "ready";
  }
  return "current";
}
