const CACHE = "wishlist-shell-v3";

const PRECACHE = [
  "/wishlist/",
  "/wishlist/index.html",
  "/wishlist/placeholder-purchase.svg",
  "/wishlist/placeholder-trip.svg",
  "/wishlist/favicon.svg",
  "/wishlist/icon-192.png",
  "/wishlist/icon-512.png",
  "/wishlist/icon-maskable-512.png",
  "/wishlist/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("/wishlist/")) || (await cache.match("/wishlist/index.html"));
    if (cached) return cached;
    return new Response("Нет сети — откройте Wishlist ещё раз, когда появится связь.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return new Response("", { status: 404 });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|svg|png|webp|woff2|json|webmanifest)$/.test(url.pathname) ||
    PRECACHE.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
