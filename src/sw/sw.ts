// Service Worker (TDD 5.2, D-15): cache-first für die eigenen Dateien, ohne Workbox.
// Eine neue Version wartet, bis die App sie mit SKIP_WAITING aktiviert (TDD 5.3).

// Kommen aus vite.sw.config.ts (scripts/precache.ts).
declare const __CACHE_VERSION__: string;
declare const __PRECACHE__: string[];

const sw = self as unknown as ServiceWorkerGlobalScope;
const PREFIX = "vokabeltrainer-";
const CACHE = PREFIX + __CACHE_VERSION__;

sw.addEventListener("install", (event) => {
  // `reload` umgeht den HTTP-Cache (GitHub Pages: max-age=600); sonst könnte ein alter Stand im neuen Cache landen.
  const requests = __PRECACHE__.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)));
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== sw.location.origin) return;
  event.respondWith(respond(request));
});

async function respond(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  // Vorab gespeicherte Dateien kommen als sie selbst, auch beim Öffnen per Link (z. B. die
  // Formatspezifikation). Jede andere Navigation bekommt die App; das Routing läuft über den Hash.
  const cached =
    (await cache.match(request)) ??
    (request.mode === "navigate" ? await cache.match("./") : undefined);
  return cached ?? fetch(request);
}

sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void sw.skipWaiting();
});
