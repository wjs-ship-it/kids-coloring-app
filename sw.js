const CACHE_NAME = 'kids-coloring-v14';
const WASM_CACHE = 'kids-coloring-wasm-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './painting.css?v=textures-1',
  './js/paint-textures.js?v=textures-1',
  './js/color-fill-tools.js?v=textures-1',
  './gallery.css?v=playroom-1',
  './verify-fill-regions.html',
  './manifest.json',
  './js/app.js?v=textures-1',
  './js/bg-remove.js',
  './js/edge-detect.js?v=background-color-2',
  './js/edge-worker.js?v=background-color-2',
  './js/creative.js?v=textures-1',
  './js/ui-utils.js',
  './js/demo.js',
  './js/ai-bridge.js',
  './js/presets.js',
  './js/preset-gallery.js?v=writing-1',
  './js/guided-trace.js?v=writing-1',
  './js/config.js',
  './js/config.js?v=background-color-2',
  './js/packs.js',
  './js/packs/registry.js',
  './js/packs/preset-packs.js',
  './js/packs/family-content.js?v=writing-1',
  './assets/family-content/diplodocus-guided-v1.json',
  './assets/family-content/diplodocus-guided-v1.png',
  './js/packs/writing-guides.js',
  ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...Array.from({ length: 11 }, (_, i) => String(i))].flatMap(character =>
    ['svg', 'json'].map(extension => `./assets/writing-guides/${character}.${extension}`)),
  './js/packs/original-dinosaurs.js',
  './js/packs/recovered-content.js',
  './assets/original-dinosaurs/trex.svg',
  './assets/original-dinosaurs/trex.json',
  './assets/original-dinosaurs/triceratops.svg',
  './assets/original-dinosaurs/triceratops.json',
  './assets/original-dinosaurs/stegosaurus.svg',
  './assets/original-dinosaurs/stegosaurus.json',
  './assets/recovered-guides/snake.png',
  './assets/recovered-guides/snake.json',
  './assets/recovered-guides/polar-bear.png',
  './assets/recovered-guides/polar-bear.json',
  './js/packs/sample-packs.js',
  './js/packs/theme-packs.js',
  './js/packs/premium-packs.js',
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

function isNetworkFirstRequest(request) {
  return request.destination === 'document' || request.destination === 'script';
}

function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') {
    return response;
  }
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  return response;
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

  if (isNetworkFirstRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(event.request, response))
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        return cacheResponse(event.request, response);
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
