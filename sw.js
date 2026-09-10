// sw.js — cache-first per gli asset dell'app, network-first per il backend.
const CACHE = 'forma-v2';
const ASSETS = ['./', './index.html', './ui.css', './app.js', './store.js', './api.js', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './engine/nutrition.js', './engine/training.js', './engine/foods.js', './engine/schemas.js', './engine/shopping.js', './engine/foodIcons.js', './engine/moves.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // backend: sempre rete
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  })));
});
