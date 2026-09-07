/* Service worker — stale-while-revalidate.
   Abre instantâneo do cache (funciona offline) e atualiza em segundo plano. */
const CACHE = 'judo-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css?v=9',
  './js/catalogo.js?v=9',
  './js/store.js?v=9',
  './js/zip.js?v=9',
  './js/player.js?v=9',
  './js/tecnica.js?v=9',
  './js/planos.js?v=9',
  './js/app.js?v=9'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      ASSETS.map(u => fetch(u, { cache: 'reload' }).then(r => (r && r.ok) ? c.put(u, r) : null))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if(res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => hit);
        return hit || net;      // cache primeiro; rede revalida em segundo plano
      })
    )
  );
});
