// Спершу мережа (щоб оновлення приходили), без мережі беремо збережене
const C = 'pidkhid-v2';
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(C);
      const html = await (await fetch('./index.html', { cache: 'reload' })).text();
      const js = [...html.matchAll(/src="(\.\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', ...js]);
      self.skipWaiting();
    })().catch(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        const copy = res.clone();
        caches.open(C).then((c) => c.put(r, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))),
  );
});
