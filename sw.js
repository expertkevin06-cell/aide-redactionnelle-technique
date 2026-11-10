const CACHE_NAME = "expert-auto-v36-predictive-fix";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

const DATA_PATTERNS = [
  "/data/",
  "/auto-diagnostic-export.json",
  "/apk-base.json",
  "/base.json",
  "/brands.json",
  "/marques.json",
  "/models.json",
  "/modeles.json",
  "/vehicles.json",
  "/engines.json",
  "/motorisations.json",
  "/moteurs.json",
  "/defects.json",
  "/pannes.json",
  "/rappels.json",
  "/recalls.json",
  "/technical-updates.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {
          console.warn("[SW] Asset absent ou non caché :", url);
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

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppShell(url) {
  return (
    url.pathname === "/" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith("/manifest.json")
  );
}

function isDataRequest(url) {
  const path = url.pathname.toLowerCase();
  return path.endsWith(".json") || DATA_PATTERNS.some((p) => path.includes(p.toLowerCase()));
}

async function networkFirst(request, cacheName, fallbackUrl = null) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    if (request.mode === "navigate" || request.destination === "document") {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isSameOrigin(url)) return;
  if (request.method !== "GET") return;

  if (isAppShell(url)) {
    event.respondWith(
      networkFirst(request, CACHE_NAME, "./index.html").catch(() => {
        return caches.match("./index.html").then((cached) => {
          return cached || new Response("Application hors ligne. Rechargez quand vous avez du réseau.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
    );
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(
      networkFirst(request, CACHE_NAME).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    cacheFirst(request, CACHE_NAME).catch(() => {
      if (request.mode === "navigate" || request.destination === "document") {
        return caches.match("./index.html");
      }

      return new Response("Ressource indisponible hors ligne.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
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
        tag: data.tag || "expert-auto-notification",
        icon: data.icon || "./icon.svg",
        badge: data.badge || "./icon.svg",
        data: { url: "./index.html" }
      })
    );
  }

  if (data.type === "skip-waiting") {
    self.skipWaiting();
  }

  if (data.type === "clients-claim") {
    self.clients.claim();
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

self.addEventListener("sync", (event) => {
  if (event.tag === "catalog-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) =>
        Promise.all(clientsList.map((client) => client.postMessage({ type: "periodic-sync" })))
      )
    );
  }
});
