// NutriTrack AI — Progressive Web App Service Worker
// Version: 1.2.0
const CACHE_NAME = 'nutritrack-shell-v3';
const STATIC_CACHE = 'nutritrack-static-v3';

// Safe, static public shell assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/nutritrack-logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];

// Helper: Determine if a request is an API, auth, or private data request
function isPrivateOrApiRequest(url, request) {
  const pathname = url.pathname;
  
  // 1. Explicit API endpoints (e.g. /api/v1/*, /api/*)
  if (pathname.startsWith('/api/') || pathname.includes('/api/v1/')) {
    return true;
  }

  // 2. Auth, refresh tokens, user records, scanner endpoints
  if (
    pathname.includes('/auth/') ||
    pathname.includes('/refresh') ||
    pathname.includes('/nutrition') ||
    pathname.includes('/workouts') ||
    pathname.includes('/goals') ||
    pathname.includes('/profile') ||
    pathname.includes('/scanner') ||
    pathname.includes('/analytics')
  ) {
    return true;
  }

  // 3. Authenticated requests with headers
  if (request.headers.has('Authorization') || request.headers.has('X-Requested-With')) {
    return true;
  }

  // 4. Non-same-origin API servers (e.g. backend running on another port/host)
  if (url.origin !== self.location.origin) {
    // If it's not a known CDN or Google Fonts, do not cache
    if (!url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) {
      return true;
    }
  }

  return false;
}

// Install Event — Precache safe shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[NutriTrack SW] Non-fatal precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Clean up outdated caches
self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!allowedCaches.includes(cacheName)) {
            console.log('[NutriTrack SW] Removing stale cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Event — Support manual SKIP_WAITING triggering
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event — Online-first for APIs/auth; safe network-first for navigation; cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never intercept or cache non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Strictly exclude private APIs, authentication, and user data
  if (isPrivateOrApiRequest(url, request)) {
    // Pass straight to network without service worker caching
    return;
  }

  // Ignore chrome-extension and unsupported schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Handle SPA Navigation Requests (HTML document)
  // Strategy: Network-First with cached index.html / offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, attempt to serve cached page or shell
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const shellResponse = await caches.match('/index.html');
          if (shellResponse) {
            return shellResponse;
          }
          const offlineFallback = await caches.match('/offline.html');
          return offlineFallback || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Handle Vite Static Hashed Assets (/assets/*)
  // Strategy: Cache-First with Network Revalidation (content-hashed assets are immutable)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Handle other same-origin static assets (icons, logo, manifest, fonts)
  // Strategy: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
