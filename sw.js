
const CACHE_NAME = 'wavetuner-v2.6.0';
const ASSETS = [
  './',
  './index.html',
  'https://cdn-icons-png.flaticon.com/512/5695/5695026.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
