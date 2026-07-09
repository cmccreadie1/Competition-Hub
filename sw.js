// ========================================================================
// APPLICATION SERVICE WORKER INTEGRATION SYSTEM LAYER (sw.js)
// ========================================================================
const COMP_HUB_OFFLINE_CACHE_SIGNATURE = 'competition-hub-cache-v7.5.0';
const PERSISTENT_RESOURCES_MANIFEST = [
  '/',
  '/index.html',
  '/excel-export-guide.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Service Worker Verification Asset Cache Registration Cycle Hook
self.addEventListener('install', (installEventTask) => {
  installEventTask.waitUntil(
    caches.open(COMP_HUB_OFFLINE_CACHE_SIGNATURE)
      .then((openedCacheInstance) => {
        console.log('Registering production app layer manifest mappings safely inside target sandbox caches.');
        return openedCacheInstance.addAll(PERSISTENT_RESOURCES_MANIFEST);
      })
      .then(() => self.skipWaiting())
  );
});

// Cache Eviction Validation Execution Cycles Lifecycle Phase
self.addEventListener('activate', (activationEventTask) => {
  activationEventTask.waitUntil(
    caches.keys().then((registeredCacheKeysList) => {
      return Promise.all(
        registeredCacheKeysList.map((uniqueKeyToken) => {
          if (uniqueKeyToken !== COMP_HUB_OFFLINE_CACHE_SIGNATURE) {
            console.log('Evicting historical deprecated cache entry profile data block:', uniqueKeyToken);
            return caches.delete(uniqueKeyToken);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network Proxy Interception Evaluation Middleware Block Execution Logic
self.addEventListener('fetch', (fetchInterceptorContext) => {
  fetchInterceptorContext.respondWith(
    caches.match(fetchInterceptorContext.request)
      .then((matchingCacheResponseObject) => {
        if (matchingCacheResponseObject) {
          return matchingCacheResponseObject;
        }
        return fetch(fetchInterceptorContext.request).then(
          (liveNetworkResponsePayload) => {
            if(!liveNetworkResponsePayload || liveNetworkResponsePayload.status !== 200 || liveNetworkResponsePayload.type !== 'basic') {
              return liveNetworkResponsePayload;
            }

            const payloadClonedCopy = liveNetworkResponsePayload.clone();
            caches.open(COMP_HUB_OFFLINE_CACHE_SIGNATURE)
              .then((openedCacheInstance) => {
                openedCacheInstance.put(fetchInterceptorContext.request, payloadClonedCopy);
              });

            return liveNetworkResponsePayload;
          }
        );
      }).catch(() => {
        return caches.match('/index.html');
      })
  );
});
