const CACHE = "wishlist-85a60c3a4a";
const FILES = ["./","apple-touch-icon.png?h=f50e5cd214","assets/index-BY3_Tw6j.js?h=a4eaaac2e0","assets/index-tgmHwU01.css?h=de5e4366ad","assets/onest-cyrillic-wght-normal-DayYxulF.woff2?h=0b4bfaa142","assets/onest-latin-ext-wght-normal-QAhDxQuo.woff2?h=4d76dc3243","assets/onest-latin-wght-normal-Dun_Rd-l.woff2?h=44aca66be9","favicon.svg?h=2609fdea0d","icon-192.png?h=b2ed224c70","icon-512.png?h=b52025a1ad","icon-maskable-512.png?h=7066fe2142","index.html?h=ce9767d45d","manifest.webmanifest?h=0a19a5c719","placeholder-event.svg?h=62e09f3df8","placeholder-place.svg?h=09ae45ba23","placeholder-purchase.svg?h=1788fbda0e","placeholder-trip.svg?h=442426229b","placeholder-venue.svg?h=3f4382155b"];

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
