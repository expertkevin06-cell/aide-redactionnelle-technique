const CACHE_NAME = "expert-auto-v31-apk-robust";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {
          console.warn("Asset absent ou non caché :", url);
        }))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin && !url.hostname.includes("github.io")) {
    return;
  }

  const isAppShell =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith("/manifest.json");

  const isRemoteData =
    url.hostname.includes("expertkevin06-cell.github.io") &&
    (
      url.pathname.includes("/auto-diagnostic/data/") ||
      url.pathname.includes("/data/defects.json") ||
      url.pathname.includes("/data/pannes.json") ||
      url.pathname.includes("/data/recalls.json") ||
      url.pathname.includes("/data/rappels.json") ||
      url.pathname.includes("/data/technical-updates.json") ||
      url.pathname.includes("/data/models.json") ||
      url.pathname.includes("/data/vehicles.json") ||
      url.pathname.includes("/data/modeles.json") ||
      url.pathname.includes("/data/engines.json") ||
      url.pathname.includes("/data/motorisations.json") ||
      url.pathname.includes("/data/moteurs.json") ||
      url.pathname.includes("/data/brands.json") ||
      url.pathname.includes("/data/marques.json")
    );

  if (isAppShell) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  if (isRemoteData) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
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
          if (!response || response.status !== 200 || response.type !== "basic") return response;

          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") return caches.match("./index.html");
        });
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "catalog-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) =>
        Promise.all(clients.map((client) => client.postMessage({ type: "periodic-sync" })))
      )
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "show-notification") {
    event.waitUntil(
      self.registration.showNotification(data.title || "Expert Auto", {
        body: data.body || "",
        tag: data.tag || "expert-auto-notification",
        icon: data.icon || "./icon.svg",
        badge: data.badge || "./icon.svg",
        data: { url: "./index.html" }
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }

      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});
