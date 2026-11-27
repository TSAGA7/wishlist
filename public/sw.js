const CACHE = "wishlist-shell-v5";
const BASE = "/wishlist/";

const PRECACHE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}placeholder-purchase.svg`,
  `${BASE}placeholder-trip.svg`,
  `${BASE}favicon.svg`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}icon-maskable-512.png`,
  `${BASE}apple-touch-icon.png`,
  `${BASE}manifest.webmanifest`,
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
    const fresh = await fetch(request, { cache: "reload" });
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(BASE)) ||
      (await cache.match(`${BASE}index.html`));
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
  if (!url.pathname.startsWith(BASE) && url.pathname !== "/wishlist") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const isAsset =
    url.pathname.startsWith(`${BASE}assets/`) ||
    PRECACHE.includes(url.pathname) ||
    /\.(?:js|css|svg|png|webp|woff2|json|webmanifest)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(cacheFirst(request));
  }
});
