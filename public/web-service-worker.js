const CACHE_PREFIX = "omnix-read-only-web-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v3`;
const SHELL_ASSETS = ["/web.html", "/manifest.webmanifest", "/web-icon-192.png", "/web-icon-512.png"];

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_ASSETS);

  // Vite writes hashed scripts and styles into web.html. Cache those exact
  // immutable assets during installation so the first offline launch works;
  // runtime API responses remain outside the service worker entirely.
  const shell = await cache.match("/web.html");
  if (!shell) return;
  const markup = await shell.text();
  const builtAssets = Array.from(
    markup.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/g),
    (match) => match[1],
  );
  if (builtAssets.length > 0) await cache.addAll([...new Set(builtAssets)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" && (url.pathname === "/web" || url.pathname.startsWith("/web/"))) {
    event.respondWith(fetch(request).catch(() => caches.match("/web.html")));
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
