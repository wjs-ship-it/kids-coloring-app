const CACHE_NAME = 'kids-coloring-v3';
const WASM_CACHE = 'kids-coloring-wasm-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/bg-remove.js',
  './js/edge-detect.js',
  './js/edge-worker.js',
  './js/creative.js',
  './js/ui-utils.js',
  './js/demo.js',
  './js/ai-bridge.js',
  './js/presets.js',
  './js/particles.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const WASM_CDN_ORIGINS = [
  'cdn.jsdelivr.net'
];

function isWasmAsset(url) {
  return WASM_CDN_ORIGINS.some((origin) => url.hostname.includes(origin));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE_NAME, WASM_CACHE]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isWasmAsset(url)) {
    event.respondWith(
      caches.open(WASM_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        if (response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
