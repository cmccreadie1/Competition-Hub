const CACHE_NAME = 'shorematch-v1.6.1'; // Incrementing cache version clears old storage
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// 1. Installation - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting()) // Force immediate activation
  );
});

// 2. Activation - Evict and clean up any old cached versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open browser tabs immediately
  );
});

// 3. Smart Fetching Strategy: Network-First with Offline Cache Fallback
self.addEventListener('fetch', (event) => {
  // Only intercept standard GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the network request succeeds, clone the response and update the cache dynamically
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network is completely dead (offline on the beach), serve the cached fallback
        console.log('[Service Worker] Offline mode - Serving from Cache:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a request is completely missing from cache and network is dead
          return new Response('Offline content unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
