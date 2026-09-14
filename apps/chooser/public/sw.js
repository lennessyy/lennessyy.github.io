const CACHE = 'fingies-v3';
const BASE = new URL(self.registration.scope).pathname;
const at = (path) => `${BASE}${path}`;
const CORE = [
  BASE,
  at('index.html'),
  at('manifest.webmanifest'),
  at('icons/favicon.svg'),
  at('icons/apple-touch-icon.png'),
  at('icons/icon-192.png'),
  at('icons/icon-512.png'),
  at('icons/icon-512-maskable.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));

    // Cache Vite's hashed production JS and CSS on the very first visit.
    const page = await fetch(at('index.html'));
    const html = await page.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => new URL(match[1], new URL(at('index.html'), self.location.origin)))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.pathname);
    await Promise.all([...new Set(assets)].map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // Optional assets should not prevent the offline shell from installing.
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match(at('index.html'));
        return Response.error();
      })
  );
});
