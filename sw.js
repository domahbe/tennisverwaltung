/* Service Worker: App-Shell-Caching + Offline-Fallback.
   Alle Pfade relativ zum SW-Standort, damit es auch unter
   einem Unterpfad (GitHub Pages: /<repo>/) funktioniert. */
const CACHE = 'tcgw-v2';
const BASE = new URL('./', self.location).pathname;
const OFFLINE_URL = BASE + 'offline.html';
const PRECACHE = [OFFLINE_URL, BASE + 'manifest.webmanifest', BASE + 'icons/icon.svg', BASE + 'icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Navigation: Network-first mit Cache- und Offline-Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Statisches (JS/CSS/Icons): Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

/* Push-Benachrichtigungen (Produktion: Web Push mit VAPID-Keys) */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'TC Grün-Weiß', {
      body: data.body || '',
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(BASE));
});
