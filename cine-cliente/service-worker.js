// Service Worker para CineFox
const CACHE_NAME = 'cinefox-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icons/fox.png',
  '/icons/ram.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierta, añadiendo archivos base.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación del Service Worker - Limpieza de caches viejos
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  const cacheWhitelist = [CACHE_NAME]; // Solo la caché actual debe sobrevivir

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si la caché no está en nuestra lista blanca, se elimina.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Manejo de peticiones con la estrategia "Stale-While-Revalidate"
self.addEventListener('fetch', event => {
  // Ignoramos las peticiones que no son GET, como las POST
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignoramos las peticiones a la API para no cachearlas
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request)
        .then(cachedResponse => {
          // Crea una promesa para obtener el recurso de la red
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // Si la petición de red es exitosa, la guardamos en caché
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });

          // Devolvemos la respuesta cacheada si existe, si no, esperamos la de la red. 
          return cachedResponse || fetchPromise;
        });
    })
  );
});
