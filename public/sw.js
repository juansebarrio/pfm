// Service worker mínimo: alcanza para que la app sea instalable.
// Offline real queda anotado como fase siguiente (DESIGN_NOTES.md §5).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough: la red resuelve todo en esta versión.
});
