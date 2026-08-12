// Presence alone (plus the manifest) is what makes the app installable — no
// offline cache yet, so every fetch just goes to the network untouched.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
