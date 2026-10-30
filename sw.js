const CACHE_NAME = "arex-expert-v13";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  // Mise à jour technique : réseau d'abord, cache fallback.
  if (url.pathname.endsWith("/data/technical-updates.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Application : cache d'abord, réseau fallback, puis index.html hors-ligne.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });

          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("./index.html");
          }
        });
    })
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "show-notification") {
    event.waitUntil(
      self.registration.showNotification(data.title || "Expert Auto", {
        body: data.body || "",
        tag: data.tag || "arex-notification",
        icon: data.icon || "./icon-192.png",
        badge: data.badge || "./icon-192.png",
        data: {
          url: "./index.html"
        }
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }
    })
  );
});
