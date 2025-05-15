// Production Service Worker for Lifestyle Blueprint App
const CACHE_VERSION = '3';
const CACHE_NAME = `lifestyle-blueprint-v${CACHE_VERSION}`;

// Assets to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/contact.html',
  '/meal-history.html',
  '/manifest.json',
  '/css/styles.css',
  '/css/login.css',
  '/css/contact.css',
  '/css/meal-history.css',
  '/css/meal-plan.css',
  '/css/calorie-results.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/basic-info-collector.js',
  '/js/calorie-calculation-collector.js',
  '/js/calorie-calculator.js',
  '/js/calorie-results-overlay.js',
  '/js/chatbot.js',
  '/js/contact.js',
  '/js/diet-preferences-collector.js',
  '/js/login.js',
  '/js/meal-plan-creator.js',
  '/js/meal-plan-overlay.js',
  '/js/metrics-goals-collector.js',
  '/images/logo.svg',
  '/images/favicon.ico',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/lifestyle-blueprint-logo-gradient.png',
  '/images/lifestyle-blueprint-logo-icon.png'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service worker installed: caching core assets');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Error during service worker install:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
  
  // Clear old caches
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service worker activated: deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - implement cache-first strategy with network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For HTML pages, use network-first strategy
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the latest version
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, try to serve the offline page
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // For all other assets, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached response
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the new resource
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            // You could return a custom offline asset here if needed
          });
      })
  );
});

// Add a message handler for manual cache clearing
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('Manually clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});
