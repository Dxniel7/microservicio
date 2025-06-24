const CACHE_NAME = 'cinefox-cache-v1'; // Nombre de la caché, cámbialo si actualizas los archivos cacheados
const urlsToCache = [
  '/index.html', //
  '/style.css', //
  '/script.js', //
  // ruta de los icons
  '/icons/fox.png',
  '/icons/ram.png'
];

// Evento 'install': Se ejecuta cuando el Service Worker se instala por primera vez.
// Aquí se abren las cachés y se añaden los recursos estáticos.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierta');
        return cache.addAll(urlsToCache); // Añade todos los URLs especificados a la caché
      })
      .catch(error => {
        console.error('Service Worker: Falló la apertura o adición a la caché', error);
      })
  );
});

// Evento 'fetch': Se ejecuta cada vez que el navegador hace una petición de red.
// Aquí se interceptan las peticiones y se intenta responder desde la caché.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request) // Intenta encontrar la petición en la caché
      .then(response => {
        // Si la petición está en caché, la devuelve
        if (response) {
          return response;
        }
        // Si no está en caché, la obtiene de la red
        return fetch(event.request);
      })
      .catch(error => {
        console.error('Service Worker: Falló la petición de fetch', error);
        // Podrías devolver una página de error offline si la petición falla y no hay caché
      })
  );
});

// Evento 'activate': Se ejecuta cuando el Service Worker se activa.
// Aquí se puede limpiar cachés antiguas para liberar espacio.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Elimina cachés que no están en la lista blanca actual
            console.log('Service Worker: Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});