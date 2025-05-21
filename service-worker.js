// Production Service Worker for Lifestyle Blueprint App
const CACHE_VERSION = '7'; // Incrementing version to force cache refresh
const CACHE_NAME = `lifestyle-blueprint-v${CACHE_VERSION}`;

// Only cache static assets for offline use (no HTML files)
const urlsToCache = [
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
  '/js/config.js',
  '/images/logo.svg',
  '/images/favicon.ico',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/lifestyle-blueprint-logo-gradient.png',
  '/images/lifestyle-blueprint-logo-icon.png'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  // Don't use skipWaiting() to prevent race conditions with auth
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
  // Don't use clients.claim() to prevent race conditions with auth
  console.log('Service worker activated');
  
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

// Fetch event - implement network-first for HTML, cache-first for static assets
// self.addEventListener('fetch', event => {
  // Skip non-GET requests
//  if (event.request.method !== 'GET') {
//    return;
//  }

  // Handle requests with undefined origin
//  let url;
//  try {
//    url = new URL(event.request.url);
    
    // Skip cross-origin requests silently
//    if (url.origin !== location.origin) {
//      return;
//    }
//  } catch (error) {
//    // Skip invalid URLs silently
//    return;
//  }

  // For HTML pages, API requests, and auth-related requests, bypass service worker completely
//  if (event.request.headers.get('accept')?.includes('text/html') || 
//      url.pathname === '/' || 
//      url.pathname.endsWith('.html') ||
//      url.pathname.startsWith('/api/') || 
//      url.pathname.includes('/auth/') || 
//      url.pathname.includes('supabase')) {
//    // Let the browser handle these requests directly
//    return;
//  }

  // For JavaScript files, use network-first strategy during initialization
//  if (url.pathname.endsWith('.js')) {
//    event.respondWith(
//      fetch(event.request)
//        .then(response => {
//          if (!response || response.status !== 200 || response.type !== 'basic') {
//            return response;
//          }

//          const responseToCache = response.clone();
//          caches.open(CACHE_NAME)
//            .then(cache => {
//              cache.put(event.request, responseToCache);
//            });

//          return response;
//        })
//        .catch(() => caches.match(event.request))
//    );
//    return;
//  }

  // For other static assets (CSS, images), use cache-first strategy
//  if (url.pathname.match(/\.(css|png|jpg|jpeg|gif|svg|ico)$/)) {
//    event.respondWith(
//      caches.match(event.request)
//        .then(cachedResponse => {
//          if (cachedResponse) {
//            return cachedResponse;
//          }

//          return fetch(event.request)
//            .then(response => {
//              if (!response || response.status !== 200 || response.type !== 'basic') {
//                return response;
//              }

//              const responseToCache = response.clone();
//              caches.open(CACHE_NAME)
//                .then(cache => {
//                  cache.put(event.request, responseToCache);
//                });

//              return response;
//            })
//            .catch(() => {
//              if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
//                return caches.match('/images/lifestyle-blueprint-logo-icon.png');
//              }
//              return new Response('/* Resource unavailable while offline */', {
//                headers: { 'Content-Type': 'text/plain' },
//                status: 503
//              });
//            });
//        })
//    );
//    return;
//  }

  // For all other requests, use network-first strategy
//  event.respondWith(
//    fetch(event.request)
//      .catch(() => caches.match(event.request))
//  );
// });

// Add a message handler for cache management
self.addEventListener('message', event => {
  if (event.data) {
    // Handle cache clearing
    if (event.data.action === 'CLEAR_CACHES') {
      event.waitUntil(
        Promise.all([
          // Clear all caches
          caches.keys().then(cacheNames => {
            console.log('Clearing all caches:', cacheNames);
            return Promise.all(
              cacheNames.map(cacheName => {
                console.log('Manually clearing cache:', cacheName);
                return caches.delete(cacheName);
              })
            );
          }),
          // Notify all clients to clear auth storage
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                action: 'CLEAR_AUTH_STORAGE',
                timestamp: new Date().toISOString()
              });
            });
          })
        ]).then(() => {
          // Notify the client that caches were cleared
          if (event.source) {
            event.source.postMessage({
              action: 'CACHES_CLEARED',
              timestamp: new Date().toISOString()
            });
          }
          
          // Re-register the service worker
          self.registration.update();
          
          // Wait a moment and then notify clients that service worker is ready
          setTimeout(() => {
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  action: 'SERVICE_WORKER_READY',
                  timestamp: new Date().toISOString()
                });
              });
            });
          }, 1000);
        })
      );
    }
    
    // Handle cache update request
    if (event.data.action === 'UPDATE_CACHE') {
      event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
          console.log('Updating cache with latest assets');
          return cache.addAll(urlsToCache).then(() => {
            // Notify the client that cache was updated
            if (event.source) {
              event.source.postMessage({
                action: 'CACHE_UPDATED',
                version: CACHE_VERSION,
                timestamp: new Date().toISOString()
              });
            }
          });
        })
      );
    }
  }
});

// Periodic cache update (every 24 hours)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        console.log('Periodic sync: updating cache with latest assets');
        return cache.addAll(urlsToCache);
      })
    );
  }
});
