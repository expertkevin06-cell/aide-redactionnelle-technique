const CACHE_NAME = "arex-expert-v18-auto-engines";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./data/vehicle-catalog.json",
  "./data/engine-catalog.json",
  "./data/technical-updates.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) => {
          return cache.add(url).catch(() => {
            console.warn("Asset absent ou non caché :", url);
          });
        })
      );
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

  if (
    url.pathname.includes("/data/technical-updates.json") ||
    url.pathname.includes("/data/engine-catalog.json") ||
    url.pathname.includes("/data/vehicle-catalog.json") ||
    url.pathname.includes("/data/motorisations.json") ||
    url.pathname.includes("/data/models.json")
  ) {
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
