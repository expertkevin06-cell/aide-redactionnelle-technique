const CACHE_NAME = "expert-auto-v33-admin-json-robust";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./admin-json-import.js",
  "./manifest.json",
  "./icon.svg"
];

const DATA_PATH_PATTERNS = [
  "/data/",
  "/apk-base.json",
  "/brands.json",
  "/models.json",
  "/engines.json",
  "/defects.json",
  "/motorisations.json",
  "/modeles.json",
  "/marques.json",
  "/pannes.json",
  "/rappels.json",
  "/recalls.json",
  "/technical-updates.json",
  "/catalog-manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) => {
          return cache.add(url).catch(() => {
            console.warn("[SW] Asset absent ou non caché :", url);
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

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAppShellRequest(url) {
  return (
    url.pathname === "/" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/admin-json-import.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith("/manifest.json")
  );
}

function isDataRequest(url) {
  const path = url.pathname.toLowerCase();
  return DATA_PATH_PATTERNS.some((pattern) => path.includes(pattern.toLowerCase())) || path.endsWith(".json");
}

function isNavigationRequest(event) {
  return event.request.mode === "navigate" || event.request.destination === "document";
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
    if (isNavigationRequest({ request })) {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes externes (proxys CORS, Google, etc.)
  if (!isSameOrigin(url)) {
    return;
  }

  // Les requêtes non GET ne sont pas mises en cache
  if (request.method !== "GET") {
    return;
  }

  // App shell : réseau d'abord pour éviter de rester bloqué sur une ancienne version cassée
  if (isAppShellRequest(url)) {
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

  // Données JSON : réseau d'abord, puis cache
  if (isDataRequest(url)) {
    event.respondWith(
      networkFirst(request, CACHE_NAME).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // Autres ressources : cache d'abord, puis réseau
  event.respondWith(
    cacheFirst(request, CACHE_NAME).catch(() => {
      if (isNavigationRequest(event)) {
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
        data: {
          url: "./index.html"
        }
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

self.addEventListener("sync", (event) => {
  if (event.tag === "catalog-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        return Promise.all(
          clientList.map((client) => {
            return client.postMessage({ type: "periodic-sync" });
          })
        );
      })
    );
  }
});
