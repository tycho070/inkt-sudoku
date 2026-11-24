/**
 * Opvolger van de oude Synapse-service worker. Synapse heet nu Neural Planner en
 * staat op ../neural-planner/. Deze worker ruimt de oude cache op en meldt zich af,
 * zodat een al geïnstalleerde Synapse-app niet blijft hangen op een oude versie.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("synapse-cache-")).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(new URL("../neural-planner/", self.registration.scope).href));
    })(),
  );
});
