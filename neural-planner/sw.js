/**
 * Service worker: zorgt dat Neural Planner ook offline werkt.
 *
 * Strategie (zelfde als Inkt): eerst het netwerk, zodat je online altijd de
 * nieuwste versie krijgt; lukt dat niet, dan de bewaarde kopie uit de cache.
 *
 * Nieuw bestand toegevoegd? Zet het in FILES. Verhoog CACHE (neural-planner-cache-v2, ...)
 * als je de cache wilt verversen, bijv. na het hernoemen of verwijderen van bestanden.
 */
const CACHE = "neural-planner-cache-v2";
// Caches van deze app, ook die van toen hij nog Synapse heette.
const EIGEN_CACHES = ["neural-planner-cache-", "synapse-cache-"];
const FILES = [
  "./",
  "index.html",
  "css/styles.css",
  "js/store.js",
  "js/graph.js",
  "js/app.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
];

// Lettertypes van Google Fonts ook bewaren, zodat de app offline hetzelfde oogt.
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Oude caches van deze app opruimen (niet die van andere apps op hetzelfde domein).
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && EIGEN_CACHES.some((p) => k.startsWith(p))).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Fonts komen via @import als "opaque" antwoord (status 0); die mogen ook in de cache.
        if (res.ok || (isFont && res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Offline een pagina openen die niet bewaard is: toon de app zelf.
        if (request.mode === "navigate") return caches.match("index.html");
        return Response.error();
      }),
  );
});
