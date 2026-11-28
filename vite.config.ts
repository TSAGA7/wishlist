import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig, type Plugin } from "vite";

/**
 * Writes dist/sw.js with every built asset in precache (Fitapp / My World pattern).
 * Cache names start with wishlist-: other apps on tsaga7.github.io keep their own caches.
 * Fetch is cache-first so a warm PWA opens without waiting on the network.
 */
function offlineWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "wishlist-offline-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else if (name !== "sw.js") files.push(relative(outDir, full).split("\\").join("/"));
        }
      };
      walk(outDir);
      const hashed = files.map((f) => {
        const digest = createHash("sha1").update(readFileSync(join(outDir, f))).digest("hex").slice(0, 10);
        return `${f}?h=${digest}`;
      });
      const version = createHash("sha1").update(hashed.join()).digest("hex").slice(0, 10);
      const sw = `const CACHE = "wishlist-${version}";
const FILES = ${JSON.stringify(["./", ...hashed])};

async function fill(cache, file) {
  if (file.includes("?h=")) {
    const old = await caches.match(file);
    if (old) return cache.put(file, old);
  }
  const path = file.split("?")[0];
  const response = await fetch(new Request(path, { cache: "reload" }));
  if (!response.ok) throw new Error(path);
  return cache.put(file, response);
}

self.addEventListener("install", (event) => {
  // Wait for «Обновить»: the open version keeps its cache until the user confirms.
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(FILES.map((file) => fill(cache, file)))));
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("wishlist-") && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL("./", self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  // Never cache the worker itself.
  if (url.pathname.endsWith("/sw.js")) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((hit) => {
        if (hit) return hit;
        return fetch(event.request)
          .then((response) => {
            if (response.ok && url.pathname.includes("/assets/")) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => (event.request.mode === "navigate" ? cache.match("./") : Response.error()));
      }),
    ),
  );
});
`;
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

// base './' keeps the build working from GitHub Pages /wishlist/ (same as My World / Fitapp).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), offlineWorker()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
