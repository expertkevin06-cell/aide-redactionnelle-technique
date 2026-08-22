const CACHE_NAME = 'aide-redactionnelle-v2';
const urlsToCache = [
  '/aide-redactionnelle-technique/',
  '/aide-redactionnelle-technique/index.html',
  '/aide-redactionnelle-technique/styles.css',
  '/aide-redactionnelle-technique/app.js',
  '/aide-redactionnelle-technique/manifest.json',
  '/aide-redactionnelle-technique/icon-192.png',
  '/aide-redactionnelle-technique/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Erreur cache:', err))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
