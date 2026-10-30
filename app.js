(function () {
  "use strict";

  /* =========================================================
     POLYFILL MINIMAL
     ========================================================= */
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (maxLength, fillString) {
      if (this.length >= maxLength) return String(this);
      fillString = fillString || " ";
      var fill = "";
      while (fill.length + this.length < maxLength) fill += fillString;
      return fill.substring(0, maxLength - this.length) + String(this);
    };
  }

  /* =========================================================
     PROTECTION GLOBALE : AUCUNE ERREUR NE BLOQUE LE DEMARRAGE
     ========================================================= */
  window.addEventListener("error", function (event) {
    console.warn("[AR-EXPERT] Erreur globale ignorée:", event.message);
  });

  window.addEventListener("unhandledrejection", function (event) {
    console.warn("[AR-EXPERT] Promesse rejetée ignorée:", event.reason);
    if (event.preventDefault) event.preventDefault();
  });

  /* =========================================================
     HELPERS DOM / STOCKAGE / FORMATAGE
     ========================================================= */
  function q(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function qa(sel) {
    try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) { return []; }
  }

  function on(sel, ev, fn) {
    var el = q(sel);
    if (el) el.addEventListener(ev, fn);
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function del(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function loadWithMigration(newKey, oldKey, fallback) {
    var current = load(newKey, null);
    if (current != null) return current;

    var old = load(oldKey, null);
    if (old != null) {
      save(newKey, old);
      return old;
    }

    return fallback;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(str) {
    var s = String(str == null ? "" : str).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.trim();
  }

  function containsAny(text, list) {
    var t = norm(text);
    for (var i = 0; i < list.length; i++) {
      if (t.indexOf(norm(list[i])) >= 0) return true;
    }
    return false;
  }

  function parseKm(v) {
    return parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;
  }

  function parseYear(v) {
    return parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;
  }

  function stripTags(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function ensureToast() {
    var t = q("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast hidden";
      document.body.appendChild(t);
    }
    return t;
  }

  function toast(message, type) {
    type = type || "info";
    var el = ensureToast();
    el.textContent = message;
    el.className = "toast " + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.add("hidden");
    }, 4500);
  }

  function simpleHash(str) {
    var hash = 5381;
    str = String(str || "");
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return "simple:" + (hash >>> 0).toString(16);
  }

  function sha256(text) {
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") {
      return Promise.resolve(simpleHash(String(text || "")));
    }
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(String(text || "")))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      })
      .catch(function () {
        return simpleHash(String(text || ""));
      });
  }

  function utf8ToB64Url(str) {
    var binary = encodeURIComponent(String(str || "")).replace(/%([0-9A-F]{2})/g, function (m, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64UrlToUtf8(str) {
    var s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var binary = atob(s);
    var percent = binary.split("").map(function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("");
    return decodeURIComponent(percent);
  }

  function getQueryParam(name) {
    var search = location.search || "";
    if (search.charAt(0) === "?") search = search.substring(1);
    var parts = search.split("&");
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split("=");
      if (decodeURIComponent(pair[0] || "") === name) {
        return decodeURIComponent(pair[1] || "");
      }
    }
    return null;
  }

  function cleanUrlAfterParam() {
    var clean = location.href.split("?")[0] + location.hash;
    if (history.replaceState) {
      history.replaceState({}, document.title, clean);
    }
  }

  function resolveUrl(base, path) {
    try {
      return new URL(path, base).href;
    } catch (e) {
      return String(base || "") + String(path || "");
    }
  }

  function valToString(v) {
    if (Array.isArray(v)) return v.join("|");
    if (v == null) return "";
    return String(v);
  }

  function firstVal(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj && obj[k] != null && obj[k] !== "") return obj[k];
    }
    return "";
  }

  /* =========================================================
     CHARGEMENT DYNAMIQUE DES BIBLIOTHEQUES
     ========================================================= */
  var scriptCache = {};

  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];

    scriptCache[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }

      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        delete scriptCache[src];
        reject(new Error("Bibliothèque indisponible : " + src));
      };
      document.head.appendChild(s);
    });

    return scriptCache[src];
  }

  var pdfJsPromise = null;
  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;

    pdfJsPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js")
      .then(function () {
        if (!window.pdfjsLib) throw new Error("PDF.js non chargé");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        return window.pdfjsLib;
      })
      .catch(function (err) {
        pdfJsPromise = null;
        throw err;
      });

    return pdfJsPromise;
  }

  var jsPdfPromise = null;
  function ensureJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPdfPromise) return jsPdfPromise;

    jsPdfPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
      .then(function () {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF non chargé");
        return window.jspdf.jsPDF;
      })
      .catch(function (err) {
        jsPdfPromise = null;
        throw err;
      });

    return jsPdfPromise;
  }

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  var CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    updateIntervalDays: 30,
    updateUrl: "./data/technical-updates.json",
    engineCatalogUrl: "./data/engine-catalog.json",
    pollAdminMs: 5000,
    autoDiagnostic: {
      baseUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/",
      pageUrl: "index.html",
      endpoints: [
        "data/base.json",
        "data/pannes.json",
        "data/models.json",
        "data/motorisations.json",
        "data/engine-catalog.json",
        "data/dtc.json",
        "data/technical-updates.json",
        "db.json",
        "database.json",
        "data/db.json",
        "assets/db.json",
        "js/data.json"
      ],
      scriptUrls: [
        "js/app.js",
        "js/data.js",
        "js/base.js",
        "app.js",
        "data.js"
      ]
    }
  };

  var KEYS = {
    SESSION: "arex_session_v15",
    USERS: "arex_users_v15",
    REQUESTS: "arex_requests_v15",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v15",
    TECH_UPDATES: "arex_tech_updates_v15",
    LAST_UPDATE: "arex_last_update_v15",
    AUTO_DB: "arex_auto_db_v15",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v15",
    AUTO_CFG: "arex_auto_cfg_v15",
    ENGINE_EXTRA: "arex_engine_extra_v15"
  };

  var OLD_KEYS = {
    SESSION: "arex_session_v14",
    USERS: "arex_users_v14",
    REQUESTS: "arex_requests_v14",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v14",
    TECH_UPDATES: "arex_tech_updates_v14",
    LAST_UPDATE: "arex_last_update_v14",
    AUTO_DB: "arex_auto_db_v14",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v14",
    AUTO_CFG: "arex_auto_cfg_v14",
    ENGINE_EXTRA: "arex_engine_extra_v14"
  };

  var currentUser = null;
  var vehicleData = {};
  var analysisData = {};
  var extractedText = "";
  var termesMobilises = new Set();
  var deferredPrompt = null;
  var techUpdates = [];
  var autoDb = [];
  var autoLastSync = 0;
  var autoConfig = Object.assign({}, CONFIG.autoDiagnostic);
  var engineExtra = [];
  var engineCatalogCache = null;
  var engineOptionMap = {};
  var engineRefreshTimer = null;
  var swRegistration = null;
  var adminPollTimer = null;
  var lastPendingSignature = "";
  var lastSharedAccessRequest = null;
  var broadcast = null;

  try {
    if ("BroadcastChannel" in window) {
      broadcast = new BroadcastChannel("arex_expert_channel");
    }
  } catch (e) {
    broadcast = null;
  }

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */
  function notificationPermissionState() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }

  function updateNotificationState() {
    var el = q("#notifState");
    var state = notificationPermissionState();

    var labels = {
      granted: "✅ Notifications autorisées",
      default: "⏳ Permission non encore accordée",
      denied: "❌ Notifications bloquées par le navigateur / Android",
      unsupported: "⚠️ Notifications non supportées par cet environnement"
    };

    if (el) {
      el.textContent = "État des notifications : " + (labels[state] || state);
    }
  }

  function askNotification() {
    if (!("Notification" in window)) {
      updateNotificationState();
      return Promise.resolve("unsupported");
    }

    if (Notification.permission === "granted") {
      updateNotificationState();
      return Promise.resolve("granted");
    }

    if (Notification.permission === "denied") {
      updateNotificationState();
      return Promise.resolve("denied");
    }

    return Promise.resolve(Notification.requestPermission())
      .then(function (permission) {
        updateNotificationState();
        return permission;
      })
      .catch(function () {
        updateNotificationState();
        return Notification.permission || "denied";
      });
  }

  function showSystemNotification(title, body, tag) {
    var options = {
      body: body || "",
      tag: tag || "arex-" + Date.now(),
      data: { url: "./index.html" }
    };

    var fallback = function () {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          var n = new Notification(title, options);
          n.onclick = function () { window.focus(); };
          return Promise.resolve();
        } catch (e) {
          console.warn("[AR-EXPERT] Notification fallback impossible:", e);
        }
      }
      return Promise.resolve();
    };

    if (swRegistration && typeof swRegistration.showNotification === "function") {
      return swRegistration.showNotification(title, options).catch(fallback);
    }

    return fallback();
  }

  function notify(title, body, tag) {
    return showSystemNotification(title, body, tag);
  }

  /* =========================================================
     IDENTITÉ / UTILISATEURS / DEMANDES / ACCÈS TIERS
     ========================================================= */
  function normIdentity(value) {
    return norm(String(value == null ? "" : value)).replace(/\s+/g, " ").trim();
  }

  function userEmailKey(email) {
    return normIdentity(email).replace(/\s/g, "");
  }

  function userNameKey(name) {
    return normIdentity(name);
  }

  function userCompositeKey(name, email) {
    return userNameKey(name) + "|" + userEmailKey(email);
  }

  function migrateUser(u) {
    var user = Object.assign({}, u || {});
    user.name = String(user.name || "").trim();
    user.email = String(user.email || "").trim();
    user.nameNorm = userNameKey(user.name);
    user.emailNorm = userEmailKey(user.email);
    user.key = user.key || userCompositeKey(user.name, user.email);
    user.role = user.role || "user";
    user.status = user.status || "pending";
    if (!user.daily) user.daily = { date: todayKey(), count: 0 };
    return user;
  }

  function getUsers() {
    var raw = loadWithMigration(KEYS.USERS, OLD_KEYS.USERS, []) || [];
    var changed = false;

    var users = raw.map(function (u) {
      var m = migrateUser(u);
      if (JSON.stringify(m) !== JSON.stringify(u)) changed = true;
      return m;
    });

    if (changed) save(KEYS.USERS, users);
    return users;
  }

  function saveUsers(users) {
    save(KEYS.USERS, (users || []).map(migrateUser));
  }

  function migrateRequest(r) {
    var req = Object.assign({}, r || {});
    req.name = String(req.name || "").trim();
    req.email = String(req.email || "").trim();
    req.reason = String(req.reason || "").trim();
    req.nameNorm = userNameKey(req.name);
    req.emailNorm = userEmailKey(req.email);
    req.key = req.key || userCompositeKey(req.name, req.email);
    req.status = req.status || "pending";
    req.ts = req.ts || Date.now();
    req.date = req.date || new Date(req.ts).toLocaleString("fr-FR");
    return req;
  }

  function getRequests() {
    var raw = loadWithMigration(KEYS.REQUESTS, OLD_KEYS.REQUESTS, []) || [];
    var changed = false;

    var requests = raw.map(function (r) {
      var m = migrateRequest(r);
      if (JSON.stringify(m) !== JSON.stringify(r)) changed = true;
      return m;
    });

    if (changed) save(KEYS.REQUESTS, requests);
    return requests;
  }

  function saveRequests(requests) {
    save(KEYS.REQUESTS, (requests || []).map(migrateRequest));
  }

  function findUser(name, email) {
    var key = userCompositeKey(name, email);
    var emailKey = userEmailKey(email);
    var users = getUsers();

    return users.find(function (u) {
      return u.key === key;
    }) || users.find(function (u) {
      return u.emailNorm === emailKey && u.role !== "admin";
    }) || null;
  }

  function findApprovedUser(name, email) {
    var emailKey = userEmailKey(email);
    if (!emailKey) return null;

    var key = userCompositeKey(name, email);
    var users = getUsers();

    return users.find(function (u) {
      return u.status === "approved" && u.role !== "admin" && u.key === key;
    }) || users.find(function (u) {
      return u.status === "approved" && u.role !== "admin" && u.emailNorm === emailKey;
    }) || null;
  }

  function findStoredUser(session) {
    if (!session) return null;

    var users = getUsers();
    var key = session.key || userCompositeKey(session.name, session.email);
    var emailKey = userEmailKey(session.email);

    return users.find(function (u) {
      return u.key === key;
    }) || users.find(function (u) {
      return u.emailNorm === emailKey && u.role !== "admin";
    }) || null;
  }

  function upsertUser(user) {
    var next = migrateUser(user);
    var users = getUsers();

    var idx = users.findIndex(function (u) {
      return u.key === next.key || (u.emailNorm === next.emailNorm && u.role !== "admin");
    });

    if (idx >= 0) {
      var merged = Object.assign({}, users[idx], next);

      merged.daily = users[idx].daily && users[idx].daily.date === todayKey()
        ? users[idx].daily
        : (next.daily || { date: todayKey(), count: 0 });

      users[idx] = merged;
      next = merged;
    } else {
      users.push(next);
    }

    saveUsers(users);
    return next;
  }

  function setSession(user) {
    currentUser = migrateUser(user);
    save(KEYS.SESSION, currentUser);
  }

  function clearSession() {
    currentUser = null;
    del(KEYS.SESSION);
  }

  function restoreSession() {
    var session = loadWithMigration(KEYS.SESSION, OLD_KEYS.SESSION, null);
    if (!session) return false;

    if (session.role === "admin") {
      clearSession();
      return false;
    }

    var fresh = findStoredUser(session);

    if (fresh && fresh.status === "approved") {
      currentUser = fresh;
      setSession(fresh);
      return true;
    }

    clearSession();
    return false;
  }

  function dailyInfo() {
    if (!currentUser) return { allowed: false, remaining: 0, unlimited: false };
    if (currentUser.role === "admin") return { allowed: true, remaining: Infinity, unlimited: true };

    var user = findUser(currentUser.name, currentUser.email) || currentUser;
    var daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;

    return {
      allowed: daily < CONFIG.maxDailyAnalyses,
      remaining: Math.max(0, CONFIG.maxDailyAnalyses - daily),
      unlimited: false
    };
  }

  function incrementDaily() {
    if (!currentUser || currentUser.role === "admin") return;

    var users = getUsers();
    var idx = users.findIndex(function (u) {
      return u.key === currentUser.key ||
        (u.emailNorm === currentUser.emailNorm && u.role !== "admin");
    });

    if (idx < 0) return;

    var user = users[idx];
    if (!user.daily || user.daily.date !== todayKey()) {
      user.daily = { date: todayKey(), count: 0 };
    }
    user.daily.count += 1;
    users[idx] = user;
    saveUsers(users);
    currentUser = user;
    setSession(user);
    updateCounter();
  }

  function updateCounter() {
    var el = q("#dailyCounter");
    if (!el) return;
    var info = dailyInfo();
    el.textContent = info.unlimited
      ? "👑 Admin — analyses illimitées"
      : "📊 " + info.remaining + "/" + CONFIG.maxDailyAnalyses + " analyses restantes";
  }

  function authMessage(msg, type) {
    var el = q("#authMsg");
    if (el) {
      el.textContent = msg;
      el.className = "auth-msg " + type;
    } else {
      toast(msg, type);
    }
  }

  function makeAccessRequestShareUrl(req) {
    var payload = {
      id: req.id,
      name: req.name,
      email: req.email,
      reason: req.reason,
      date: req.date,
      source: "lien-partage"
    };

    var baseUrl = location.href.split("?")[0].split("#")[0];
    return baseUrl + "?access_request=" + utf8ToB64Url(JSON.stringify(payload));
  }

  function makeAccessGrantUrl(user) {
    var safe = migrateUser(user);

    var payload = {
      name: safe.name,
      email: safe.email,
      status: "approved",
      role: "user",
      key: safe.key,
      grantedAt: Date.now()
    };

    var baseUrl = location.href.split("?")[0].split("#")[0];
    return baseUrl + "?access_grant=" + utf8ToB64Url(JSON.stringify(payload));
  }

  function processIncomingAccessRequestFromUrl() {
    try {
      var raw = getQueryParam("access_request");
      if (!raw) return false;

      var decoded = b64UrlToUtf8(raw);
      var req = JSON.parse(decoded);

      if (!req || !req.name || !req.email) return false;

      req = migrateRequest({
        id: req.id || uid(),
        name: req.name,
        email: req.email,
        reason: req.reason || "Motif non précisé",
        status: "pending",
        date: req.date || new Date().toLocaleString("fr-FR"),
        ts: Date.now(),
        source: "lien-partage"
      });

      var requests = getRequests();

      var exists = requests.find(function (r) {
        return r.id === req.id ||
          (r.emailNorm === req.emailNorm && r.nameNorm === req.nameNorm && r.reason === req.reason);
      });

      if (!exists) {
        requests.push(req);
        saveRequests(requests);
        publishAccessRequest(req);
        toast("Demande d’accès importée depuis le lien partagé.", "success");
      }

      cleanUrlAfterParam();
      return true;
    } catch (e) {
      console.warn("[AR-EXPERT] Lien de demande invalide:", e);
      toast("Lien de demande invalide ou corrompu.", "error");
      return false;
    }
  }

  function processIncomingAccessGrantFromUrl() {
    try {
      var raw = getQueryParam("access_grant");
      if (!raw) return false;

      var payload = JSON.parse(b64UrlToUtf8(raw));
      if (!payload || !payload.email) return false;

      var user = upsertUser({
        name: payload.name || payload.email,
        email: payload.email,
        role: "user",
        status: "approved",
        key: payload.key,
        daily: { date: todayKey(), count: 0 }
      });

      setSession(user);
      showApp();
      toast("Accès approuvé importé. Connexion tierce réussie.", "success");

      cleanUrlAfterParam();
      return true;
    } catch (e) {
      console.warn("[AR-EXPERT] Lien d’accès invalide:", e);
      toast("Lien d’accès invalide ou corrompu.", "error");
      return false;
    }
  }

  /* =========================================================
     DEMANDES / NOTIFICATION ADMIN / CLOCHE
     ========================================================= */
  function pendingRequests() {
    return getRequests().filter(function (r) {
      return r.status === "pending";
    });
  }

  function pendingSignature() {
    return pendingRequests()
      .map(function (r) { return r.id; })
      .sort()
      .join("|");
  }

  function updateNotificationBell() {
    var bell = q("#notifBellBtn");
    var badge = q("#notifBadge");

    if (!bell) return;

    if (!currentUser || currentUser.role !== "admin") {
      bell.classList.add("hidden");
      if (badge) badge.classList.add("hidden");
      return;
    }

    bell.classList.remove("hidden");

    var count = pendingRequests().length;

    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle("hidden", count === 0);
    }
  }

  function renderAdminIfOpen() {
    var panel = q("#adminPanel");
    if (!panel) return;
    if (panel.classList.contains("hidden")) return;
    if (!currentUser || currentUser.role !== "admin") return;
    renderAdmin();
  }

  function onAccessRequestReceived(req) {
    if (!currentUser || currentUser.role !== "admin") return;
    if (!req) return;

    var title = "Nouvelle demande d’accès";
    var body = (req.name || "Tiers") + " — " + (req.email || "");

    notify(title, body, "access-" + (req.id || Date.now()));

    updateNotificationBell();
    renderAdminIfOpen();

    toast("Nouvelle demande : " + (req.name || "Tiers"), "info");
  }

  function pollAdminNotifications() {
    if (!currentUser || currentUser.role !== "admin") return;

    var sig = pendingSignature();

    if (sig === lastPendingSignature) {
      updateNotificationBell();
      return;
    }

    var oldIds = lastPendingSignature ? lastPendingSignature.split("|") : [];
    var newIds = sig ? sig.split("|").filter(function (id) {
      return id && oldIds.indexOf(id) < 0;
    }) : [];

    lastPendingSignature = sig;
    updateNotificationBell();

    if (newIds.length) {
      var all = getRequests();

      newIds.forEach(function (id) {
        var req = all.find(function (r) {
          return r.id === id;
        });

        if (req) {
          onAccessRequestReceived(req);
        }
      });
    }

    renderAdminIfOpen();
  }

  function startAdminPolling() {
    stopAdminPolling();

    lastPendingSignature = pendingSignature();
    updateNotificationBell();

    adminPollTimer = setInterval(function () {
      pollAdminNotifications();
    }, CONFIG.pollAdminMs || 5000);

    var count = pendingRequests().length;
    if (count > 0) {
      toast(count + " demande(s) d’accès en attente", "info");
    }
  }

  function stopAdminPolling() {
    if (adminPollTimer) {
      clearInterval(adminPollTimer);
      adminPollTimer = null;
    }
  }

  function publishAccessRequest(req) {
    if (!req) return;

    if (broadcast) {
      try {
        broadcast.postMessage({
          type: "access-request",
          payload: req
        });
      } catch (e) {}
    }

    try {
      window.dispatchEvent(new CustomEvent("arex:access-request", {
        detail: req
      }));
    } catch (e) {}

    updateNotificationBell();
  }

  function enforceTierAccess() {
    if (!currentUser || currentUser.role === "admin") return;

    var fresh = findStoredUser(currentUser);
    if (!fresh || fresh.status !== "approved") {
      clearSession();
      showLogin();
      toast("Votre accès a été révoqué ou refusé par l’administrateur.", "error");
      notify("Accès révoqué", "Contactez l’administrateur si nécessaire.");
    } else {
      currentUser = fresh;
      setSession(fresh);
      updateCounter();
    }
  }

  /* =========================================================
     AFFICHAGE APPLICATION / CONNEXION
     ========================================================= */
  function showApp() {
    var login = q("#loginScreen");
    if (login) {
      login.classList.add("hidden");
      login.style.display = "none";
    }

    var app = q("#mainApp");
    if (app) {
      app.classList.remove("hidden");
      app.style.display = "block";
    }

    var badge = q("#userBadge");
    if (badge) {
      badge.textContent = currentUser.role === "admin"
        ? "👑 Admin"
        : "👤 " + currentUser.name;
    }

    var adminBtn = q("#adminPanelBtn");
    if (adminBtn) {
      if (currentUser.role === "admin") {
        adminBtn.classList.remove("hidden");
      } else {
        adminBtn.classList.add("hidden");
      }
    }

    updateCounter();
    updateNotificationBell();
    updateNotificationState();
    refreshEngineOptions();

    if (currentUser && currentUser.role === "admin") {
      startAdminPolling();
      askNotification();
    } else {
      stopAdminPolling();
    }

    window.scrollTo(0, 0);
  }

  function showLogin() {
    var login = q("#loginScreen");
    if (login) {
      login.classList.remove("hidden");
      login.style.display = "flex";
    }

    var app = q("#mainApp");
    if (app) {
      app.classList.add("hidden");
      app.style.display = "none";
    }

    var admin = q("#adminPanel");
    if (admin) {
      admin.classList.add("hidden");
    }

    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  }

  function refreshSavedPasswordButton() {
    var btn = q("#useSavedPwdBtn");
    var saved = loadWithMigration(KEYS.ADMIN_PWD_HASH, OLD_KEYS.ADMIN_PWD_HASH, null);
    if (!btn) return;

    if (saved) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  }

  function verifyAdminPassword(input) {
    if (!input) return Promise.resolve(false);
    return sha256(CONFIG.adminPassword).then(function (adminHash) {
      return sha256(input).then(function (inputHash) {
        return inputHash === adminHash;
      });
    });
  }

  function loginAdminFromHash(savedHash) {
    if (!savedHash) return Promise.resolve(false);
    return sha256(CONFIG.adminPassword).then(function (adminHash) {
      return savedHash === adminHash;
    });
  }

  /* =========================================================
     MOTORISATION : TYPES / CATALOGUE / FILTRE
     ========================================================= */
  var ENGINE_TYPES_ORDER = [
    "Essence",
    "Diesel",
    "Hybride",
    "Hybride rechargeable",
    "Hybride léger 48V",
    "Hybride / électrique",
    "Électrique",
    "GPL",
    "E85 / Bioéthanol",
    "Non précisé / mixte"
  ];

  function inferEngineType(engine, tags, symptoms, note) {
    var t = norm(engine + " " + tags + " " + symptoms + " " + note);

    if (containsAny(t, [
      "hybride rechargeable", "plug-in", "phev", "e-tense", "4xe", "prime",
      "e-hybrid", "xdrive45e", "tucson phev", "sportage phev", "niro phev",
      "compass 4xe", "wrangler 4xe", "grand cherokee 4xe", "tonale phev"
    ])) return "Hybride rechargeable";

    if (containsAny(t, [
      "48v", "mild hybrid", "micro-hybridation", "eq boost", "boosterjet",
      "firefly hybrid", "hybrid 48"
    ])) return "Hybride léger 48V";

    var hy = containsAny(t, [
      "hybride", "hybrid", "ths", "i-mmd", "e-power", "self-charging",
      "prius", "yaris hybrid", "corolla hybrid", "c-hr hybrid", "rav4 hybrid"
    ]);

    var el = containsAny(t, [
      "electrique", "electric", "bev", "battery", "bms", "charge", "autonomie",
      "tesla", "id.3", "id.4", "id.5", "id.7", "ioniq", "atto", "model 3",
      "model y", "e-tron", "e-cmp", "megane e-tech", "scenic e-tech",
      "austral e-tech", "captur e-tech", "spring", "500e", "e-corsa",
      "e-208", "e-2008", "enyaq", "born", "taycan", "mach-e", "i-pace",
      "ariya", "leaf", "mx-30", "eqs", "eqe", "eqb", "eqa", "q4 e-tron"
    ]);

    if (hy && el) return "Hybride / électrique";
    if (hy) return "Hybride";
    if (el) return "Électrique";

    if (containsAny(t, [
      "diesel", "dci", "tdi", "hdi", "bluehdi", "bluemotion", "cdti",
      "ddis", "crdi", "k9k", "dv6", "om654", "b47", "ea288", "d-4d",
      "gasoil", "gasoil"
    ])) return "Diesel";

    if (containsAny(t, [
      "essence", "tsi", "tfsi", "tce", "puretech", "firefly", "ecoboost",
      "skyactiv-g", "skyactiv-x", "smartstream", "gamma", "theta", "b38",
      "b46", "b48", "b58", "ea211", "ea888", "ingenium", "turbo essence",
      "1.0 tce", "1.3 tce", "1.2 puretech", "1.5 tsi", "2.0 tsi", "2.3 ecoboost"
    ]) && !containsAny(t, ["diesel", "electrique", "hybride"])) return "Essence";

    if (containsAny(t, ["gpl", "lp/g", "liquefied petroleum"])) return "GPL";
    if (containsAny(t, ["e85", "bioethanol", "superethanol"])) return "E85 / Bioéthanol";

    return "Non précisé / mixte";
  }

  function isMotorisationType(type) {
    return type && type !== "Non précisé / mixte";
  }

  function isElectricLike(type) {
    var t = norm(type);
    return t.indexOf("electrique") >= 0 ||
           t.indexOf("hybride") >= 0 ||
           t.indexOf("48v") >= 0;
  }

  function isMotorisationEntry(d) {
    var t = norm(d.e + " " + d.tg);

    if (containsAny(t, [
      "boite", "embrayage", "convertisseur", "mecatronique", "synchro",
      "dsg", "edc", "pdk", "cvt", "dct", "eat8", "ddct", "powershift",
      "transmission"
    ])) {
      if (!containsAny(t, ["essence", "diesel", "electrique", "hybride", "moteur"])) return false;
    }

    if (containsAny(t, [
      "adas", "camera", "radar", "lidar", "frein", "abs", "esp", "direction",
      "suspension", "pneu", "tpms", "clim", "ecran", "gps", "bluetooth",
      "logiciel", "ota", "corrosion", "carrosserie", "infiltration", "eau",
      "court circuit", "fuite", "refroidissement", "thermostat", "radiateur",
      "pompe a eau", "ventilateur", "joint culasse", "capteur", "sonde"
    ])) {
      if (!containsAny(t, [
        "essence", "diesel", "electrique", "hybride", "turbo", "courroie",
        "chaine", "distribution", "injecteur", "pompe a huile", "bielle",
        "coussinet"
      ])) return false;
    }

    return true;
  }

  function engineTypeRank(type) {
    var idx = ENGINE_TYPES_ORDER.indexOf(type);
    return idx >= 0 ? idx : 999;
  }

  function normalizeEngineRecord(r, sourceUrl) {
    if (!r || typeof r !== "object") return null;

    var brand = valToString(firstVal(r, ["b", "brand", "marque", "constructeur"]));
    var model = valToString(firstVal(r, ["m", "models", "model", "modele", "modèle"]));
    var years = valToString(firstVal(r, ["y", "years", "annee", "année", "period", "range"]));
    var engine = valToString(firstVal(r, ["e", "engine", "motorisation", "moteur", "powertrain"]));
    var power = valToString(firstVal(r, ["p", "power", "puissance", "ch", "kw"]));
    var type = valToString(firstVal(r, ["t", "type", "engineType", "typeMotorisation", "energie"]));

    if (!brand || !engine) return null;

    if (!type) {
      type = inferEngineType(
        engine,
        valToString(firstVal(r, ["tg", "tags", "categorie", "category"])),
        valToString(firstVal(r, ["s", "symptoms", "symptomes", "panne", "pannes"])),
        valToString(firstVal(r, ["n", "note", "description"]))
      );
    }

    if (!isMotorisationType(type)) return null;

    return {
      b: brand,
      m: model || "*",
      y: years || "2017-2027",
      e: engine,
      p: power || "N/A",
      t: type,
      sourceUrl: sourceUrl || valToString(firstVal(r, ["sourceUrl", "url", "lien", "link"]))
    };
  }

  function collectEngineRecordsFromJson(json, sourceUrl, depth) {
    depth = depth || 0;
    var out = [];
    if (!json || depth > 4) return out;

    if (Array.isArray(json)) {
      json.forEach(function (item) {
        var rec = normalizeEngineRecord(item, sourceUrl);
        if (rec) out.push(rec);

        if (item && typeof item === "object") {
          ["motorisations", "engines", "engineCatalog", "catalogue", "data", "items"].forEach(function (key) {
            if (item[key]) out = out.concat(collectEngineRecordsFromJson(item[key], sourceUrl, depth + 1));
          });
        }
      });
      return out;
    }

    if (typeof json === "object") {
      var direct = normalizeEngineRecord(json, sourceUrl);
      if (direct) out.push(direct);

      ["motorisations", "engines", "engineCatalog", "catalogue", "data", "items"].forEach(function (key) {
        if (json[key]) out = out.concat(collectEngineRecordsFromJson(json[key], sourceUrl, depth + 1));
      });
    }

    return out;
  }

  function engineRecordKey(e) {
    return norm(e.b) + "|" + norm(e.m) + "|" + norm(e.e) + "|" + norm(e.p) + "|" + norm(e.t);
  }

  function mergeEngineRecords(base, incoming) {
    var map = new Map();
    (base || []).forEach(function (e) { map.set(engineRecordKey(e), e); });
    (incoming || []).forEach(function (e) {
      var k = engineRecordKey(e);
      if (!map.has(k)) map.set(k, e);
    });
    return Array.from(map.values());
  }

  function invalidateEngineCatalog() {
    engineCatalogCache = null;
    engineOptionMap = {};
    refreshEngineOptions();
  }

  function addEngineCatalogEntry(cat, brand, model, entry) {
    var nb = norm(brand || "Toutes marques");
    var nm = norm(model || "*");
    if (!nb) nb = "toutes-marques";
    if (!nm) nm = "*";

    if (!cat[nb]) cat[nb] = {};
    if (!cat[nb][nm]) cat[nb][nm] = [];

    var id = nb + "|" + nm + "|" + norm(entry.engine) + "|" + norm(entry.power) + "|" + norm(entry.type);
    var exists = cat[nb][nm].some(function (x) { return x.id === id; });
    if (!exists) {
      cat[nb][nm].push({
        id: id,
        brand: brand || "Toutes marques",
        model: model || "*",
        engine: entry.engine,
        power: entry.power || "N/A",
        years: entry.years || "2017-2027",
        type: entry.type,
        source: entry.source || "base locale",
        sourceUrl: entry.sourceUrl || ""
      });
    }
  }

  function engineCatalog() {
    if (engineCatalogCache) return engineCatalogCache;

    var cat = {};

    allDefects().forEach(function (d) {
      var type = d.et || inferEngineType(d.e, d.tg, d.s, d.n);
      if (!isMotorisationType(type)) return;
      if (!isMotorisationEntry(d)) return;

      var brands = d.b === "Toutes marques" ? ["Toutes marques"] : [d.b];
      var models = d.m === "*" ? ["*"] : String(d.m || "").split("|");

      brands.forEach(function (b) {
        models.forEach(function (m) {
          addEngineCatalogEntry(cat, b, m, {
            engine: d.e,
            power: d.p,
            years: d.y,
            type: type,
            source: d.source || "base locale",
            sourceUrl: d.sourceUrl || ""
          });
        });
      });
    });

    (engineExtra || []).forEach(function (e) {
      addEngineCatalogEntry(cat, e.b, e.m, {
        engine: e.e,
        power: e.p,
        years: e.y,
        type: e.t,
        source: "catalogue motorisation",
        sourceUrl: e.sourceUrl || ""
      });
    });

    engineCatalogCache = cat;
    return cat;
  }

  function findClosestNormalizedKey(map, value) {
    var n = norm(value);
    if (!n) return null;
    if (map[n]) return n;

    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(n) >= 0 || n.indexOf(keys[i]) >= 0) return keys[i];
    }
    return null;
  }

  function formatEngineLabel(o) {
    var label = o.type + " — " + o.engine;
    if (o.power && o.power !== "N/A") label += " (" + o.power + ")";
    if (o.years) label += " • " + o.years;
    if (o.model === "*") label += " • générique marque";
    return label;
  }

  function getEngineOptions(brand, model, year) {
    var cat = engineCatalog();
    var nb = norm(brand);
    var brandKey = nb ? findClosestNormalizedKey(cat, nb) : null;
    if (!brandKey && cat["toutes-marques"]) brandKey = "toutes-marques";
    if (!brandKey) brandKey = "toutes-marques";

    var modelsMap = cat[brandKey] || {};
    var nm = norm(model);
    var modelKeys = [];

    if (nm) {
      var exact = findClosestNormalizedKey(modelsMap, nm);
      if (exact) modelKeys.push(exact);

      Object.keys(modelsMap).forEach(function (k) {
        if (k !== "*" && k.indexOf(nm) >= 0 && modelKeys.indexOf(k) < 0) {
          modelKeys.push(k);
        }
      });
    }

    modelKeys.push("*");

    var out = [];
    modelKeys.forEach(function (mk) {
      (modelsMap[mk] || []).forEach(function (e) {
        if (year && !checkYearRange(e.years, year)) return;
        out.push(e);
      });
    });

    var seen = {};
    var dedup = [];
    out.forEach(function (e) {
      if (!seen[e.id]) {
        seen[e.id] = true;
        dedup.push(e);
      }
    });

    dedup.sort(function (a, b) {
      var ra = engineTypeRank(a.type);
      var rb = engineTypeRank(b.type);
      if (ra !== rb) return ra - rb;
      return norm(a.engine).localeCompare(norm(b.engine));
    });

    if (!dedup.length) {
      var stdTypes = [
        "Essence",
        "Diesel",
        "Hybride",
        "Hybride rechargeable",
        "Hybride léger 48V",
        "Électrique",
        "GPL",
        "E85 / Bioéthanol"
      ];

      stdTypes.forEach(function (type) {
        var id = "std|" + norm(type);
        dedup.push({
          id: id,
          brand: brand || "Toutes marques",
          model: model || "*",
          engine: type,
          power: "N/A",
          years: year ? year + "-" + year : "2017-2027",
          type: type,
          source: "référentiel standard",
          sourceUrl: ""
        });
      });
    }

    return dedup;
  }

  function refreshEngineOptions() {
    var select = q("#vehicleEngine");
    if (!select) return;

    var brandEl = q("#vehicleBrand");
    var modelEl = q("#vehicleModel");
    var yearEl = q("#vehicleYear");

    var brand = brandEl ? brandEl.value.trim() : "";
    var model = modelEl ? modelEl.value.trim() : "";
    var year = yearEl ? parseYear(yearEl.value) : 0;

    var oldValue = select.value;
    var oldOption = engineOptionMap[oldValue] || null;

    var options = getEngineOptions(brand, model, year);
    engineOptionMap = {};

    select.innerHTML = '<option value="">Automatique / non précisée</option>';

    options.forEach(function (o) {
      engineOptionMap[o.id] = o;
      var opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = formatEngineLabel(o);
      select.appendChild(opt);
    });

    if (oldValue && engineOptionMap[oldValue]) {
      select.value = oldValue;
    } else if (oldOption) {
      var match = options.find(function (o) {
        return o.type === oldOption.type &&
          norm(o.engine) === norm(oldOption.engine) &&
          norm(o.power) === norm(oldOption.power);
      });
      select.value = match ? match.id : "";
    } else {
      select.value = "";
    }

    var help = q("#engineHelp");
    if (help) {
      if (!brand && !model) {
        help.textContent = "Saisissez marque, modèle et année pour charger les motorisations compatibles.";
      } else if (options.length && options[0].source === "référentiel standard") {
        help.textContent = "Aucune motorisation spécifique trouvée dans la base locale / auto-diagnostic. Propositions standard affichées.";
      } else {
        help.textContent = options.length + " motorisation(s) proposée(s) selon marque, modèle et année.";
      }
    }
  }

  function scheduleEngineRefresh() {
    clearTimeout(engineRefreshTimer);
    engineRefreshTimer = setTimeout(refreshEngineOptions, 250);
  }

  function fetchJsonUrl(url) {
    return fetch(url, { cache: "no-store", method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
  }

  function fetchTextUrl(url) {
    return fetch(url, { cache: "no-store", method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      });
  }

  function fetchEngineCatalogs(manual) {
    if (!window.fetch) {
      if (manual) toast("Catalogue motorisation impossible : fetch non supporté.", "warning");
      return Promise.resolve(false);
    }

    var urls = [CONFIG.engineCatalogUrl];

    if (autoConfig.baseUrl) {
      urls.push(resolveUrl(autoConfig.baseUrl, "data/engine-catalog.json"));
      urls.push(resolveUrl(autoConfig.baseUrl, "data/motorisations.json"));
    }

    return Promise.all(urls.map(function (url) {
      return fetchJsonUrl(url)
        .then(function (json) {
          return collectEngineRecordsFromJson(json, url, 0);
        })
        .catch(function () {
          return [];
        });
    })).then(function (results) {
      var incoming = [];
      results.forEach(function (arr) {
        incoming = incoming.concat(arr);
      });

      if (incoming.length) {
        engineExtra = mergeEngineRecords(engineExtra, incoming);
        save(KEYS.ENGINE_EXTRA, engineExtra);
        invalidateEngineCatalog();
        updateAdminStats();
        if (manual) toast("Catalogue motorisation chargé : " + incoming.length + " entrées.", "success");
        return true;
      }

      if (manual) toast("Aucun catalogue motorisation additionnel trouvé.", "info");
      return false;
    }).catch(function (err) {
      console.warn("[AR-EXPERT] Catalogue motorisation impossible:", err);
      if (manual) toast("Catalogue motorisation indisponible.", "warning");
      return false;
    });
  }

  /* =========================================================
     BASE TECHNIQUE LOCALE MASSIVE 2017-2027
     ========================================================= */
  function D(b, m, y, e, p, s, sev, wf, n, law, rec, tg) {
    return { b: b, m: m, y: y, e: e, p: p, s: s, sev: sev, wf: wf, n: n, law: law, rec: rec, tg: tg };
  }

  var BRAND_LIST = [
    "Renault", "Dacia", "Peugeot", "Citroen", "DS", "Volkswagen", "Audi", "Skoda", "Seat", "Cupra",
    "BMW", "Mini", "Mercedes-Benz", "Volvo", "Porsche", "Land Rover", "Range Rover", "Jaguar",
    "Opel", "Fiat", "Alfa Romeo", "Ford", "Tesla", "Jeep", "Toyota", "Lexus", "Honda", "Nissan",
    "Mazda", "Subaru", "Suzuki", "Mitsubishi", "Hyundai", "Kia", "Genesis", "MG", "BYD",
    "Leapmotor", "XPeng", "NIO", "Aiways", "Ora", "Chery", "Omoda", "Jaecoo", "Geely", "Smart",
    "Lotus", "Maxus", "GWM", "Chevrolet", "GMC", "Cadillac", "Ram", "Chrysler", "Dodge",
    "Toutes marques"
  ];

  var CATEGORY_TEMPLATES = [
    ["Essence turbo downsizing", "consommation huile|turbo|chaine|voyant moteur|perte puissance|mode degrade|fumee|surchauffe|huile|preignition|LSPI|carbonisation", "critique", 0.72, "Moteur essence turbo à cylindrée réduite : surveillance huile, turbo, distribution, encrassement, pré-allumage, perte de puissance.", "Vice caché 1641 C.civ.; conformité L.217-4 C.consom.; tromperie L.213-1 si dissimulation.", "TSB constructeurs; forums; rappel.conso; NHTSA", "moteur|turbo|huile|distribution|puissance|combustion"],
    ["Diesel dépollution", "EGR|FAP|DPF|AdBlue|NOx|injecteur|turbo|regeneration|voyant antipollution|fumee noire|puissance reduite|cristallisation|conso gasoil", "moyen", 0.55, "Chaîne de dépollution diesel : EGR, FAP/DPF, AdBlue, NOx, injecteurs, turbo, régénération.", "Vice caché 1641 C.civ.; usure normale à écarter; tromperie L.213-1 si logiciel.", "Rappels diesel; CJUE; DGCCRF; KBA", "diesel|EGR|FAP|AdBlue|NOx|pollution|turbo"],
    ["Boîte automatique / robotisée", "a-coups|patinage|embrayage|mecatronique|convertisseur|voyant boite|mode degrade|surchauffe|odeur brulee|bruit boite|blocage vitesse", "critique", 0.7, "Boîte automatique ou robotisée : mécatronique, embrayage, convertisseur, logiciel, surchauffe urbaine.", "Vice caché 1641 C.civ.; conformité L.217-4 C.consom.", "TSB boîtes; rappels constructeurs", "boite|embrayage|mecatronique|convertisseur|logiciel"],
    ["Boîte manuelle / embrayage", "embrayage|boite|synchro|bruit|vibration|patinage|difficile passer vitesse|pedale embrayage", "moyen", 0.5, "Transmission manuelle : embrayage, synchroniseurs, bruit, vibration, difficulté de passage.", "Vice caché 1641 C.civ.; usure normale possible.", "Forums; TSB", "boite|embrayage|transmission"],
    ["Hybride / électrique batterie", "batterie|BMS|autonomie|charge|cellule|SOH|thermal|incendie|12V|DC-DC|software|recharge|deséquilibre", "critique", 0.92, "Batterie haute tension, BMS, cellules, autonomie, batterie 12V, DC-DC, logiciel, risque thermique.", "Sécurité L.423-1 C.consom.; produits défectueux 1245 C.civ.; conformité L.217-4.", "Rappels EV/hybride; NHTSA; DGCCRF; KBA", "batterie|charge|autonomie|electricite|securite|logiciel"],
    ["Charge électrique", "charge AC|charge DC|port de charge|cable|verrou|recharge impossible|charge lente|thermal derating|ISO|isolation HV", "critique", 0.9, "Recharge AC/DC, port, câble, verrouillage, isolation haute tension, bridage thermique.", "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245.", "Rappels EV; constructeurs; NHTSA", "charge|batterie|electricite|securite"],
    ["ADAS / conduite assistée", "ADAS|camera|radar|lidar|phantom braking|lane keeping|emergency brake|calibration|autopilot|Travel Assist|Pilot Assist|ProPILOT|Toyota Safety Sense|BlueCruise", "critique", 0.95, "Capteurs ADAS, calibration, caméra, radar, lidar, freinage fantôme, assistance autoroute, logiciel.", "Sécurité L.423-1; produits défectueux 1245; conformité L.217-4; pénal si accident.", "NHTSA ADAS; Euro NCAP; DGCCRF; SafetyGate", "ADAS|logiciel|securite|capteurs|camera|radar"],
    ["Électricité / infiltration eau", "infiltration eau|court circuit|moisiure|corrosion|faisceau|boitier fusibles|calculateurs|voyants aleatoires|incendie electrique|odeur brulee", "critique", 0.93, "Infiltration d’eau, corrosion, courts-circuits, faisceaux, calculateurs, voyants aléatoires, risque incendie électrique.", "Sécurité L.423-1; vice caché 1641; produits défectueux 1245.", "Rappels électriques; forums; NHTSA; DGCCRF", "eau|electricite|court-circuit|incendie|securite"],
    ["Fuite de fluides", "fuite carburant|fuite huile|fuite liquide refroidissement|fuite frein|incendie|odeur|niveau bas|voyant", "critique", 0.88, "Fuite de carburant, huile, liquide de refroidissement ou frein : risque incendie, surchauffe, perte de freinage.", "Sécurité L.423-1; vice caché 1641; pénal si accident.", "Rappels fluides; NHTSA; DGCCRF", "fuite|incendie|frein|refroidissement|securite"],
    ["Refroidissement moteur", "surchauffe|thermostat|radiateur|pompe a eau|ventilateur|liquide refroidissement|joint culasse|fumee blanche", "critique", 0.8, "Circuit de refroidissement : pompe à eau, thermostat, radiateur, ventilateur, joint de culasse.", "Vice caché 1641; conformité L.217-4.", "TSB refroidissement; forums", "moteur|refroidissement|culasse|surchauffe"],
    ["Freinage / ABS / ESP", "frein|ABS|ESP|plaquettes|disques|etrier|pedale molle|vibration freinage|bruit frein|perte freinage", "critique", 0.85, "Freinage, ABS, ESP, plaquettes, disques, étriers, pédale, perte de freinage.", "Sécurité L.423-1; vice caché 1641; pénal si accident.", "Rappels freinage; NHTSA; DGCCRF", "frein|ABS|ESP|securite"],
    ["Direction / assistance", "direction|cremaillere|assistance electrique|jeu|bruit|vibration|volant|perte direction", "critique", 0.85, "Direction mécanique ou électrique, crémaillère, assistance, jeu, bruit, perte de direction.", "Sécurité L.423-1; vice caché 1641.", "Rappels direction; NHTSA", "direction|securite|chassis"],
    ["Suspension / train roulant", "suspension|amortisseur|silentbloc|bruit|claquement|usure|train roulage|roue", "moyen", 0.55, "Suspension, amortisseurs, silentblocs, bruit, claquaient, usure train roulant.", "Vice caché 1641; usure normale possible.", "Forums; TSB", "suspension|chassis|usure"],
    ["Pneumatiques / TPMS", "TPMS|pneu|pression pneu|capteur|runflat|usure pneu|voyant pression", "moyen", 0.5, "Capteurs TPMS, pression pneus, runflat, usure pneumatiques.", "Conformité L.217-4; vice caché 1641 si capteur défaillant.", "Rappels TPMS; NHTSA", "pneu|TPMS|securite"],
    ["Climatisation / chauffage", "climatisation|chauffage|blower|compresseur|gaz|odeur|humidite|vitrage|air conditionne", "moyen", 0.5, "Climatisation, chauffage, blower, compresseur, gaz, odeur, humidité, désembuage.", "Conformité L.217-4; vice caché 1641.", "TSB HVAC; forums", "confort|climatisation|chauffage"],
    ["Infodivertissement / caméra", "ecran|GPS|Bluetooth|CarPlay|Android Auto|son|camera recul|logiciel|freeze|redemarrage|tactile", "moyen", 0.6, "Écran, GPS, Bluetooth, CarPlay/Android Auto, caméra de recul, logiciel, freeze.", "Conformité L.217-4; vice caché 1641 si sécurité caméra.", "Rappels multimédia; TSB", "logiciel|camera|confort|ADAS"],
    ["Logiciel / OTA / calculateurs", "logiciel|OTA|mise a jour|calculateur|module|brick|erreur software|reinitialisation|voyant multiple", "critique", 0.88, "Mise à jour OTA, calculateurs, modules, briquage, erreurs logicielles, voyants multiples.", "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.", "Rappels logiciels; NHTSA; DGCCRF", "logiciel|OTA|electricite|securite"],
    ["Corrosion / carrosserie / étanchéité", "corrosion|rouille|carrosserie|peinture|joint|etancheite|porte|coffre|capot|infiltration", "moyen", 0.7, "Corrosion, carrosserie, peinture, joints, étanchéité, portes, coffre, capot.", "Vice caché 1641; conformité L.217-4.", "Rappels carrosserie; forums", "carrosserie|corrosion|eau|securite"]
  ];

  function buildGeneratedDefects() {
    var out = [];
    BRAND_LIST.forEach(function (brand) {
      CATEGORY_TEMPLATES.forEach(function (t) {
        out.push(D(
          brand,
          "*",
          "2017-2027",
          t[0],
          "N/A",
          t[1],
          t[2],
          t[3],
          t[4],
          t[5],
          t[6],
          t[7]
        ));
      });
    });
    return out;
  }

  var GENERATED_DEFECTS = buildGeneratedDefects();

  var SPECIFIC_RAW = [
    ["Renault", "Clio V|Captur II|Megane IV|Austral|Scenic", "2017-2027", "1.0 TCe / 1.3 TCe", "90ch-160ch",
      "consommation huile|turbo|chaine|voyant moteur|perte puissance|mode degrade|fumee|surchauffe|huile",
      "critique", 0.75,
      "Downsizing turbo : surconsommation huile, turbo, chaîne, PCV, perte de puissance.",
      "Vice caché 1641 C.civ.; conformité L.217-4 C.consom.; tromperie L.213-1.",
      "TSB Renault; forums; rappel.conso",
      "moteur|turbo|huile|distribution|puissance"],

    ["Renault", "Clio|Megane|Scenic|Duster|Kangoo|Trafic|Master", "2017-2022", "K9K / 1.5 dCi", "75ch-110ch",
      "casse bielle|claquement moteur|usure coussinets|pompe a huile|bruit metallique|pression huile basse|voyant huile|calage",
      "critique", 0.9,
      "Risque de casse bielle/coussinets lié à la lubrification et à la pompe à huile.",
      "Vice caché 1641 C.civ.; tromperie L.213-1; responsabilité contractuelle 1231-1 C.civ.",
      "Programme technique Renault K9K; TSB; jurisprudences",
      "moteur|huile|bielle|pompe|bruit|critique"],

    ["Renault", "Clio IV|Captur|Megane III|Kadjar|Austral", "2017-2024", "EDC6 / double embrayage", "N/A boite",
      "a-coups boite|blocage rapport|patinage|voyant boite|odeur brulee|vibrations|mode degrade|perte traction",
      "critique", 0.7,
      "Boîte EDC : module mécatronique fragile, surchauffe embrayage en ville.",
      "Vice caché 1641 C.civ.; conformité L.217-4 C.consom.",
      "Programme qualité EDC Renault; forums",
      "boite|embrayage|mecatronique|a-coups"],

    ["Renault", "Trafic II|Master III|Espace V|Talisman", "2017-2027", "Baie de pare-brise / étanchéité", "N/A",
      "infiltration eau|court circuit|moisiure|panne electronique|voyants aleatoires|erreur ABS|erreur ESP|corrosion|odeur humidite",
      "critique", 0.95,
      "Défaut d’étanchéité de la baie de pare-brise. Eau vers calculateurs et faisceaux. Indépendant du km.",
      "Vice caché 1641 C.civ.; sécurité L.423-1 C.consom.; produits défectueux 1245 C.civ.",
      "Campagnes Renault; forums; DGCCRF",
      "eau|electricite|court-circuit|securite|carrosserie"],

    ["Renault", "Megane E-Tech|Scenic E-Tech|Austral E-Tech|Captur E-Tech", "2022-2027", "E-Tech hybride / électrique", "145ch-220ch",
      "autonomie reduite|voyant batterie|charge lente|charge DC|DC-DC|batterie 12V|BMS|software|ADAS|camera|radar|mode degrade",
      "critique", 0.9,
      "Plateformes électrifiées récentes : BMS, batterie 12V, charge, logiciel, capteurs ADAS, autonomie réelle.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245 C.civ.",
      "Rappels Renault EV/hybride; DGCCRF; NHTSA si import",
      "batterie|charge|autonomie|adas|logiciel|electricite"],

    ["Dacia", "Sandero|Duster|Logan|Lodgy|Jogger|Spring", "2017-2027", "K9K 1.5 dCi / EDC / Spring électrique", "75ch-110ch",
      "casse bielle|pompe huile|bruit moteur|a-coups|patinage|voyant boite|autonomie|charge|batterie 12V",
      "critique", 0.85,
      "Base Renault K9K/EDC pour thermique; Spring : batterie, charge, autonomie, logiciel.",
      "Vice caché 1641 C.civ.; conformité L.217-4 si pro.",
      "TSB Dacia/Renault; forums",
      "moteur|boite|batterie|charge"],

    ["Peugeot", "208|2008|308|3008|5008|Partner|Rifter|Boxer", "2017-2024", "EB2 / 1.2 PureTech", "100ch-155ch",
      "courroie distribution|wet belt|desagregration courroie|crepine pompe|casse moteur|bruit cliquetis|voyant pression huile|consommation huile|surchauffe|mode degrade",
      "critique", 0.85,
      "Courroie humide qui se désagrège, bouche la crépine de pompe à huile et peut casser le moteur.",
      "Vice caché 1641 C.civ.; tromperie L.213-1; pratique commerciale trompeuse L.121-2.",
      "Extension garantie Stellantis PureTech; TSB; DGCCRF",
      "moteur|distribution|courroie|huile|pompe|critique"],

    ["Peugeot", "308|3008|508|Expert|Boxer", "2017-2024", "DV6 / 1.6 BlueHDi", "92ch-130ch",
      "EGR encrasse|FAP colmate|turbo HS|AdBlue|cristallisation|voyant antipollution|puissance reduite|mode degrade|fumee noire|conso gasoil",
      "moyen", 0.5,
      "Systèmes de dépollution sensibles aux trajets courts, à-froids, qualité carburant et entretien.",
      "Vice caché 1641 C.civ.; usure normale à écarter par expertise.",
      "TSB PSA/Stellantis; forums",
      "diesel|EGR|FAP|AdBlue|turbo|pollution"],

    ["Peugeot", "308|3008|5008|e-208|e-2008", "2017-2027", "EAT8 / e-CMP électrique", "N/A",
      "a-coups|convertisseur|vibrations|patinage|voyant boite|autonomie|charge|BMS|batterie 12V|software|ADAS",
      "critique", 0.65,
      "Boîte EAT8 et plateformes électriques e-CMP : convertisseur, logiciel, batterie, charge, ADAS.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Programme qualité Stellantis; rappels EV",
      "boite|batterie|charge|adas|logiciel"],

    ["Citroen", "C3|C3 Aircross|C4|C4 Cactus|C5 Aircross|Berlingo|Jumper", "2017-2024", "EB2 1.2 PureTech / BlueHDi", "100ch-130ch",
      "courroie distribution|casse moteur|bruit metallique|EGR|FAP|turbo|consommation huile|voyant moteur|surchauffe",
      "critique", 0.85,
      "Mêmes architectures PSA/Stellantis : wet belt, dépollution, turbo, huile.",
      "Vice caché 1641 C.civ.; tromperie L.213-1.",
      "TSB Stellantis; forums",
      "moteur|distribution|diesel|turbo|huile"],

    ["Citroen", "e-C3|e-C4|C5 Aircross Hybrid", "2020-2027", "Électrique / hybride rechargeable", "N/A",
      "autonomie|charge AC|charge DC|batterie|BMS|12V|software|ADAS|camera|radar|chauffage|climatisation",
      "critique", 0.9,
      "Batterie, charge, logiciel, autonomie réelle, capteurs ADAS, confort thermique.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels Stellantis EV; DGCCRF",
      "batterie|charge|autonomie|adas|logiciel"],

    ["DS", "DS 3 Crossback E-Tense|DS 4|DS 7 Crossback E-Tense", "2019-2027", "PureTech / BlueHDi / E-Tense 4x4", "130ch-360ch",
      "courroie|EGR|FAP|AdBlue|hybride|batterie|charge|software|ADAS|voyant moteur|perte puissance",
      "critique", 0.8,
      "Combine défauts PSA thermiques et plateformes hybrides rechargeables complexes.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "TSB Stellantis; forums DS",
      "moteur|hybride|batterie|adas|logiciel"],

    ["Volkswagen", "Golf 8|Polo|T-Cross|Taigo|Tiguan|Touran|Caddy", "2017-2027", "EA211 1.0 TSI / 1.5 TSI", "95ch-150ch",
      "consommation huile|turbo|chaine|voyant moteur|perte puissance|mode degrade|fumee|surchauffe|carbonisation",
      "moyen", 0.6,
      "Moteurs downsizing turbo : surveillance huile, turbo, chaîne, encrassement, logiciel moteur.",
      "Vice caché 1641; conformité L.217-4 si pro.",
      "TSB VAG; forums Golf 8",
      "moteur|turbo|huile|distribution"],

    ["Volkswagen", "Golf|Passat|Tiguan|Touran|Sharan|Caddy", "2017-2024", "EA288 Evo 2.0 TDI", "115ch-200ch",
      "AdBlue|cristallisation|pompe AdBlue|NOx|EGR|FAP|capteur NOx|voyant antipollution|mode degrade|impossibilite redemarrer",
      "moyen", 0.45,
      "Chaîne de dépollution diesel : AdBlue, NOx, EGR, FAP, logiciel moteur.",
      "Vice caché 1641; tromperie L.213-1 si dissimulation; conformité L.217-4.",
      "Rappels VAG diesel; CJUE; DGCCRF",
      "diesel|AdBlue|NOx|EGR|FAP|pollution"],

    ["Volkswagen", "Golf|Polo|T-Cross|Taigo|Tiguan|Touran", "2017-2024", "DSG DQ200 / DQ381", "N/A boite",
      "a-coups|mecatronique|patinage|bruit claquement|voyant boite|mode degrade|blocage vitesse|odeur brulee",
      "critique", 0.7,
      "Boîtes DSG : mécatronique, embrayage, convertisseur, logiciel boîte.",
      "Vice caché 1641; conformité L.217-4; tromperie L.213-1.",
      "Rappels/TSB VAG DSG; class actions",
      "boite|DSG|mecatronique|embrayage"],

    ["Volkswagen", "ID.3|ID.4|ID.5|ID.7", "2020-2027", "MEB électrique", "145ch-286ch",
      "autonomie|charge AC|charge DC|BMS|cellules|logiciel|software|ADAS|Travel Assist|camera|radar|12V|DC-DC|thermal derating",
      "critique", 0.92,
      "Plateforme MEB : logiciel, charge, batterie, autonomie, ADAS, batterie 12V, DC-DC.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels VW ID; KBA Allemagne; NHTSA; DGCCRF",
      "batterie|charge|autonomie|adas|logiciel|electricite"],

    ["Audi", "A1|A3|A4|A5|Q2|Q3|Q5", "2017-2027", "EA211 / EA888 / DSG", "110ch-265ch",
      "consommation huile|turbo|chaine|DSG|mecatronique|a-coups|voyant moteur|mode degrade|AdBlue|FAP",
      "critique", 0.7,
      "Groupe VAG : moteurs turbo, DSG, dépollution diesel, logiciel.",
      "Vice caché 1641; conformité L.217-4; tromperie L.213-1.",
      "TSB Audi/VAG; rappels",
      "moteur|boite|DSG|diesel|turbo"],

    ["Audi", "Q4 e-tron|e-tron GT|A6 e-tron|Q6 e-tron", "2021-2027", "Électrique PPE/MEB", "204ch-544ch",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|DC-DC|thermal|logiciel",
      "critique", 0.92,
      "Modèles électriques Audi : batterie, charge rapide, logiciel, ADAS, gestion thermique.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels Audi e-tron; KBA; NHTSA",
      "batterie|charge|ADAS|logiciel|electricite"],

    ["Skoda", "Fabia|Octavia|Superb|Karoq|Kodiaq|Enyaq", "2017-2027", "TSI / TDI / DSG / MEB", "95ch-299ch",
      "consommation huile|turbo|DSG|AdBlue|FAP|batterie|charge|autonomie|software|ADAS",
      "critique", 0.7,
      "Base VAG : TSI/TDI, DSG, Enyaq MEB, logiciel et ADAS.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Skoda/VAG; rappels Enyaq",
      "moteur|boite|batterie|ADAS|logiciel"],

    ["Seat", "Ibiza|Leon|Ateca|Arona|Toledo|Born|Tavascan", "2017-2027", "TSI / TDI / DSG / MEB", "95ch-326ch",
      "DSG|mecatronique|a-coups|consommation huile|turbo|batterie|charge|autonomie|software|ADAS",
      "critique", 0.7,
      "Groupe VAG : DSG, moteurs turbo, Cupra Born/Tavascan sur base MEB.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "TSB Seat/Cupra; rappels VAG",
      "boite|DSG|batterie|ADAS|logiciel"],

    ["Cupra", "Leon|Ateca|Arona|Born|Tavascan|Formentor", "2018-2027", "TSI / DSG / MEB", "150ch-340ch",
      "DSG|mecatronique|a-coups|turbo|batterie|charge|autonomie|software|ADAS",
      "critique", 0.7,
      "Marque sportive du groupe VAG : DSG, turbo, plateformes électriques MEB.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Cupra/VAG",
      "boite|DSG|batterie|ADAS|logiciel"],

    ["BMW", "Serie 1|Serie 2|Serie 3|Serie 4|X1|X2|X3|X4", "2017-2027", "B38 / B46 / B48 / B58", "136ch-387ch",
      "consommation huile|turbo|vanne PCV|refroidissement|pompe a eau|voyant moteur|perte puissance|surchauffe|fuite liquide|fuite huile",
      "critique", 0.75,
      "Moteurs BMW turbo : PCV, refroidissement, pompes à eau, fuites huile/liquide, logiciel moteur.",
      "Vice caché 1641; défaut de sécurité L.423-1 si fuite sur échappement; conformité L.217-4.",
      "TSB BMW; rappels pompe à eau; forums",
      "moteur|turbo|huile|liquide|refroidissement|fuite"],

    ["BMW", "Serie 3|Serie 5|X3|X5|X7", "2017-2027", "B47 / 2.0d / 3.0d", "150ch-400ch",
      "chaine distribution|tensionneur|bruit crecelle|claquement|voyant moteur|mode degrade|AdBlue|NOx|FAP",
      "critique", 0.8,
      "Chaînes de distribution diesel/essence, tensionneurs, dépollution AdBlue/NOx.",
      "Vice caché 1641; tromperie L.213-1 si dissimulation.",
      "Rappels BMW chaîne; TSB diesel",
      "distribution|chaine|diesel|AdBlue|bruit"],

    ["BMW", "iX1|iX3|i4|iX|i7", "2021-2027", "Électrique / PHEV", "204ch-650ch",
      "batterie|charge AC|charge DC|autonomie|BMS|software|iDrive|ADAS|camera|radar|12V|DC-DC|thermal",
      "critique", 0.9,
      "Plateformes électrifiées BMW : batterie, charge, logiciel, ADAS, gestion thermique.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels BMW i; KBA; NHTSA",
      "batterie|charge|ADAS|logiciel|electricite"],

    ["Mini", "Cooper|Cooper S|Countryman|Clubman|Aceman", "2017-2027", "B38 / B48 / Getrag / Aisin / Électrique", "136ch-306ch",
      "chaine distribution|consommation huile|turbo|water pump|boite|a-coups|patinage|batterie|charge|software|ADAS",
      "critique", 0.8,
      "Moteurs BMW/PSA Prince puis BMW : chaîne, huile, turbo, boîtes, électrification.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels MINI/BMW; TSB",
      "distribution|huile|turbo|boite|batterie"],

    ["Mercedes-Benz", "Classe A|Classe B|CLA|GLA|Classe C|Classe E|GLC|GLE", "2017-2027", "M254 / OM654 / 48V", "120ch-435ch",
      "turbo|AdBlue|NOx|capteur|voyant moteur|mode degrade|consommation huile|fuite|48V|batterie secondaire|EQ Boost",
      "critique", 0.7,
      "Motorisations récentes : turbo, AdBlue, NOx, micro-hybridation 48V, fuites, logiciel.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "TSB Mercedes; rappels diesel/48V",
      "moteur|turbo|AdBlue|48V|fuite|logiciel"],

    ["Mercedes-Benz", "Classe C|Classe E|GLC|GLE|EQE|EQS|EQB|EQA", "2017-2027", "9G-Tronic / EQ électrique", "N/A",
      "a-coups|convertisseur|calculateur boite|voyant boite|batterie|charge|autonomie|MBUX|software|ADAS|Distance Pilot|Active Brake",
      "critique", 0.65,
      "Boîtes 9G et plateformes EQ : logiciel, ADAS, batterie, charge, autonomie.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Mercedes EQ/ADAS; KBA",
      "boite|batterie|ADAS|logiciel|charge"],

    ["Volvo", "XC40|XC60|XC90|V60|V90|S60|S90|C40|EX30|EX40|EC40", "2017-2027", "Drive-E / 48V / PHEV / Recharge", "150ch-455ch",
      "consommation huile|turbo|compresseur|chaine|48V|batterie PHEV|charge|autonomie|Pilot Assist|camera|radar|software",
      "critique", 0.8,
      "Drive-E essence : huile/turbo/chaîne. Électrification : 48V, PHEV, batterie, ADAS Pilot Assist.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Volvo; TSB Drive-E; DGCCRF",
      "moteur|huile|turbo|batterie|ADAS|logiciel"],

    ["Porsche", "Macan|Cayenne|Panamera|Taycan|911", "2017-2027", "PDK / Turbo / Taycan électrique", "245ch-761ch",
      "PDK|a-coups|embrayage|volant moteur|batterie|charge|autonomie|software|ADAS|thermal|12V",
      "critique", 0.7,
      "PDK, hybrides, Taycan : batterie, charge, logiciel, gestion thermique, ADAS.",
      "Vice caché 1641; conformité L.217-4; produits défectueux 1245.",
      "Rappels Porsche; TSB Taycan",
      "boite|PDK|batterie|charge|ADAS"],

    ["Land Rover", "Defender|Discovery|Range Rover|Evoque|Velar", "2017-2027", "Ingenium / PHEV / électrique", "163ch-550ch",
      "consommation huile|turbo|refroidissement|fuite liquide|incendie|PHEV|batterie|charge|software|Pivi|ADAS|camera|radar",
      "critique", 0.8,
      "Ingenium : huile/refroidissement/fuites. PHEV/électrique : batterie, charge, logiciel, ADAS.",
      "Vice caché 1641; sécurité L.423-1; produits défectueux 1245.",
      "Rappels JLR; incendie Ingenium; forums",
      "moteur|fuite|incendie|batterie|ADAS|logiciel"],

    ["Jaguar", "F-Pace|E-Pace|I-Pace|XF|XE", "2017-2027", "Ingenium / I-Pace électrique", "163ch-400ch",
      "consommation huile|refroidissement|fuite liquide|incendie|batterie|charge|software|Pivi Pro|ADAS",
      "critique", 0.8,
      "Moteurs Ingenium et plateforme I-Pace : fuites, incendie, batterie, logiciel, ADAS.",
      "Vice caché 1641; sécurité L.423-1.",
      "Rappels JLR; forums",
      "moteur|fuite|incendie|batterie|ADAS"],

    ["Opel", "Corsa|Astra|Mokka|Grandland|Zafira|Combo", "2017-2027", "PureTech / BlueHDi / e-Corsa", "75ch-130ch",
      "courroie distribution|EGR|FAP|AdBlue|batterie|charge|autonomie|software|ADAS",
      "critique", 0.8,
      "Base PSA/Stellantis : wet belt, dépollution, e-Corsa batterie/charge.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Opel/Stellantis",
      "moteur|distribution|diesel|batterie"],

    ["Fiat", "500|500e|Panda|Tipo|Tonale|Doblo", "2017-2027", "FireFly / Hybrid / 500e électrique", "70ch-150ch",
      "hybridation 48V|batterie 12V|charge|autonomie|software|Dualogic|a-coups|embrayage|robot",
      "critique", 0.75,
      "Micro-hybridation 48V, 500e électrique, boîtes robotisées Dualogic/EDC selon modèles.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Fiat 500e/Hybrid; TSB Stellantis",
      "48V|batterie|charge|boite|logiciel"],

    ["Alfa Romeo", "Giulia|Stelvio|Tonale", "2017-2027", "2.0 Turbo / PHEV Tonale", "160ch-280ch",
      "turbo|consommation huile|refroidissement|PHEV|batterie|charge|software|ADAS|boite ZF",
      "critique", 0.75,
      "2.0 turbo, plateforme Giorgio, Tonale PHEV : batterie, charge, logiciel, ADAS.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Alfa/Stellantis; forums",
      "moteur|turbo|PHEV|batterie|ADAS"],

    ["Ford", "Fiesta|Focus|Puma|Kuga|Explorer|Transit", "2017-2027", "EcoBoost 1.0 / 1.5 / 2.3 / PowerShift", "95ch-280ch",
      "joint culasse|surchauffe|refroidissement|pompe a eau|eau dans huile|fumee blanche|PowerShift|a-coups|embrayage|vibrations|odeur brulee",
      "critique", 0.85,
      "EcoBoost 1.0 : refroidissement/joint culasse. PowerShift : embrayage sec fragile.",
      "Vice caché 1641; tromperie L.213-1; conformité L.217-4.",
      "Class actions PowerShift; TSB Ford EcoBoost",
      "moteur|refroidissement|culasse|boite|embrayage"],

    ["Ford", "Mustang Mach-E", "2021-2027", "Électrique", "269ch-487ch",
      "batterie|charge|autonomie|BMS|software|BlueCruise|ADAS|camera|radar|12V|porte de charge|thermal",
      "critique", 0.9,
      "Plateforme électrique Ford : batterie, charge, logiciel, BlueCruise, ADAS.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels Ford Mach-E; NHTSA",
      "batterie|charge|ADAS|logiciel"],

    ["Tesla", "Model 3|Model Y|Model S|Model X", "2017-2027", "Électrique", "283ch-1020ch",
      "Autopilot|FSD|phantom braking|12V battery|charging port|door handle|software|battery degradation|thermal|range|ADAS|camera|radar",
      "critique", 0.92,
      "ADAS, batterie 12V, port de charge, dégradation batterie, logiciels, poignées, gestion thermique.",
      "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245; pénal si accident.",
      "NHTSA Tesla recalls; DGCCRF; SafetyGate",
      "ADAS|batterie|charge|logiciel|securite"],

    ["Jeep", "Renegade|Compass|Wrangler|Grand Cherokee|Grand Cherokee 4xe", "2017-2027", "DDCT / Hurricane / 4xe PHEV", "120ch-490ch",
      "DDCT|surchauffe embrayage|a-coups|bruit boite|mode limp|PHEV|batterie|charge|autonomie|software|ADAS",
      "critique", 0.75,
      "Boîte DDCT en ville, 4xe : batterie, charge, logiciel, ADAS.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB FCA/Stellantis; rappels 4xe",
      "boite|embrayage|PHEV|batterie|ADAS"],

    ["Toyota", "Yaris|Corolla|Camry|RAV4|C-HR|Prius|Hilux|Land Cruiser", "2017-2027", "Hybride THS / Dynamic Force / D-4D", "100ch-309ch",
      "batterie hybride|refroidissement batterie|CVT|bruit|vibration|12V|Toyota Safety Sense|camera|radar|ADAS|consommation|mode degrade",
      "critique", 0.65,
      "Hybrides Toyota : batterie, ventilation, CVT, 12V, ADAS Toyota Safety Sense.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Toyota hybride/ADAS; NHTSA",
      "hybride|batterie|CVT|ADAS|12V"],

    ["Lexus", "UX|NX|RX|ES|IS|LBX", "2017-2027", "Hybride / Multi-stage Hybrid", "180ch-414ch",
      "batterie hybride|CVT|refroidissement|ADAS|camera|radar|software|12V|autonomie hybride",
      "moyen", 0.6,
      "Architecture hybride Lexus : batterie, CVT, ADAS, logiciel.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Lexus/Toyota",
      "hybride|batterie|ADAS|CVT"],

    ["Honda", "Jazz|Civic|HR-V|CR-V|Accord|e:Ny1", "2017-2027", "1.0 / 1.5 Turbo / i-MMD / électrique", "130ch-212ch",
      "turbo|CVT|bruit|vibration|huile|refroidissement|batterie|charge|autonomie|Honda Sensing|ADAS|camera|radar",
      "critique", 0.7,
      "Turbo/HV/CVT et Honda Sensing. e:Ny1 : batterie, charge, logiciel.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels Honda; TSB i-MMD",
      "moteur|turbo|CVT|ADAS|batterie"],

    ["Nissan", "Qashqai|X-Trail|Juke|Ariya|Leaf|Navara", "2017-2027", "1.3 TCe / CVT / e-POWER / électrique", "140ch-306ch",
      "CVT|a-coups|glissement|surchauffe|e-POWER|batterie|charge|autonomie|ProPILOT|ADAS|camera|radar|software|12V",
      "critique", 0.75,
      "CVT/X-Tronic, e-POWER, Ariya/Leaf : batterie, charge, ADAS ProPILOT, logiciel.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Nissan CVT/ADAS; NHTSA",
      "CVT|boite|batterie|ADAS|logiciel"],

    ["Mazda", "2|3|CX-3|CX-30|CX-5|CX-60|MX-30", "2017-2027", "Skyactiv-G / Skyactiv-X / MX-30", "110ch-327ch",
      "compression|huile|bruit|boite auto|mild hybrid|48V|batterie MX-30|charge|autonomie|ADAS|i-Activsense",
      "moyen", 0.6,
      "Skyactiv-X compression, mild hybrid 48V, MX-30 électrique/range extender, ADAS.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Mazda; forums",
      "moteur|48V|batterie|ADAS"],

    ["Subaru", "XV|Forester|Outback|Impreza|WRX", "2017-2027", "Boxer / Lineartronic CVT", "115ch-275ch",
      "CVT|bruit|vibration|huile|refroidissement|EyeSight|ADAS|camera|radar|logiciel",
      "moyen", 0.6,
      "CVT Lineartronic et EyeSight : capteurs, logiciel, entretien.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels Subaru EyeSight; NHTSA",
      "CVT|ADAS|huile|logiciel"],

    ["Suzuki", "Swift|Ignis|Vitara|S-Cross|Jimny|ACROSS", "2017-2027", "Boosterjet / Mild Hybrid / AllGrip", "90ch-136ch",
      "turbo|48V|batterie 12V|CVT|AllGrip|ADAS|camera|radar|software|conso",
      "moyen", 0.55,
      "Micro-hybridation 48V, CVT, ADAS Suzuki Safety Support.",
      "Vice caché 1641; conformité L.217-4.",
      "TSB Suzuki; forums",
      "48V|turbo|CVT|ADAS"],

    ["Mitsubishi", "Space Star|ASX|Eclipse Cross|Outlander|Outlander PHEV", "2017-2027", "CVT / PHEV 4WD", "105ch-224ch",
      "CVT|bruit|surchauffe|PHEV|batterie|charge|autonomie|ADAS|camera|radar|software",
      "critique", 0.7,
      "Outlander PHEV : batterie, charge, gestion 4WD, CVT, ADAS.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels Mitsubishi PHEV; NHTSA",
      "CVT|PHEV|batterie|ADAS"],

    ["Hyundai", "i10|i20|i30|Bayon|Tucson|Santa Fe|Kona|IONIQ 5|IONIQ 6", "2017-2027", "Smartstream / Theta / Gamma / E-GMP", "80ch-325ch",
      "consommation huile|turbo|DCT|a-coups|batterie|charge|autonomie|BMS|Bluelink|ADAS|camera|radar|software|12V",
      "critique", 0.75,
      "Moteurs turbo, boîtes DCT, plateformes E-GMP : batterie, charge rapide, ADAS, logiciel.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Hyundai/Kia; NHTSA; KBA",
      "moteur|boite|batterie|ADAS|logiciel"],

    ["Kia", "Picanto|Ceed|Stonic|Sportage|Sorento|Niro|EV6|EV9", "2017-2027", "Smartstream / DCT / E-GMP", "84ch-585ch",
      "DCT|a-coups|embrayage|batterie|charge|autonomie|BMS|ADAS|camera|radar|software|12V|V2L",
      "critique", 0.75,
      "DCT, EV6/EV9 : batterie, charge, V2L, ADAS, logiciel.",
      "Vice caché 1641; conformité L.217-4; sécurité L.423-1.",
      "Rappels Kia EV; NHTSA",
      "boite|batterie|charge|ADAS|logiciel"],

    ["Genesis", "G70|G80|G90|GV60|GV70|GV80", "2017-2027", "Turbo / DCT / E-GMP", "220ch-455ch",
      "DCT|a-coups|batterie|charge|autonomie|BMS|ADAS|camera|radar|software|12V",
      "critique", 0.72,
      "Plateformes Hyundai/Kia premium : DCT, E-GMP, ADAS, logiciel.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels Genesis; NHTSA",
      "boite|batterie|ADAS|logiciel"],

    ["MG", "MG3|MG ZS|MG ZS EV|MG4|MG5|Marvel R|Cyster", "2019-2027", "Électrique / PHEV / essence", "116ch-435ch",
      "batterie|charge AC|charge DC|autonomie|BMS|software|ADAS|port de charge|12V|camera|radar|thermal derating",
      "critique", 0.9,
      "Plateformes SAIC/MG : batterie, charge, logiciel, ADAS, autonomie réelle, température.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels MG; DGCCRF; SafetyGate",
      "batterie|charge|ADAS|logiciel|autonomie"],

    ["BYD", "Atto 3|Dolphin|Seal|Han|Tang", "2022-2027", "Blade Battery électrique / PHEV", "177ch-530ch",
      "batterie Blade|charge|autonomie|BMS|DiLink|software|ADAS|camera|radar|12V|thermal|port de charge",
      "critique", 0.9,
      "BYD : batterie Blade, charge, logiciel DiLink, ADAS, gestion thermique.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels BYD; DGCCRF; NHTSA si import",
      "batterie|charge|ADAS|logiciel"],

    ["Leapmotor", "T03|C10|B10", "2023-2027", "Électrique", "95ch-218ch",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|connectivite",
      "critique", 0.88,
      "Nouvelles plateformes chinoises EV : batterie, charge, logiciel, ADAS.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels Leapmotor; DGCCRF",
      "batterie|charge|ADAS|logiciel"],

    ["XPeng", "G6|P7|G9", "2020-2027", "Électrique", "200ch-500ch+",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|lidar|radar|12V|connectivite|thermal",
      "critique", 0.9,
      "EV chinois premium : batterie, charge, ADAS avancés, lidar, logiciel.",
      "Conformité L.217-4; sécurité L.423-1; produits défectueux 1245.",
      "Rappels XPeng; SafetyGate",
      "batterie|charge|ADAS|logiciel|autonomie"],

    ["NIO", "ET5|ES6|ET7|EL6", "2020-2027", "Électrique / battery swap", "400ch-600ch+",
      "batterie|swap|charge|autonomie|BMS|software|ADAS|camera|lidar|radar|12V|connectivite|thermal",
      "critique", 0.9,
      "Battery swap, charge, ADAS, lidar, logiciel.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels NIO; SafetyGate",
      "batterie|charge|ADAS|logiciel|autonomie"],

    ["Chery", "Omoda 5|Jaecoo 7|Tiggo", "2023-2027", "1.6 TGDI / DCT / PHEV", "147ch-300ch+",
      "turbo|DCT|a-coups|embrayage|batterie|charge|autonomie|ADAS|camera|radar|software|conso",
      "critique", 0.75,
      "Nouvelles marques chinoises : turbo, DCT, PHEV, ADAS, logiciel.",
      "Vice caché 1641; conformité L.217-4.",
      "Rappels Chery/Omoda; DGCCRF",
      "moteur|boite|DCT|ADAS|batterie"],

    ["Geely", "Coolray|Emgrand|Smart #1|Smart #3|Lotus Eletre", "2022-2027", "Électrique / hybride", "200ch-600ch+",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|connectivite",
      "critique", 0.88,
      "Plateformes SEA/Geely : batterie, charge, logiciel, ADAS.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels Geely/Smart; SafetyGate",
      "batterie|charge|ADAS|logiciel"],

    ["Smart", "#1|#3|#5", "2022-2027", "Électrique SEA", "200ch-428ch",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|connectivite",
      "critique", 0.88,
      "Smart électrique basé plateforme Geely SEA.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels Smart; DGCCRF",
      "batterie|charge|ADAS|logiciel"],

    ["Maxus", "eDeliver|W90|T60|Euniq", "2019-2027", "Électrique / hybride / utilitaire", "130ch-400ch",
      "batterie|charge|autonomie|BMS|software|ADAS|12V|fuite|refroidissement|utilitaire",
      "critique", 0.85,
      "Utilitaires et SUV chinois électrifiés : batterie, charge, logiciel, refroidissement.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels Maxus/LDV",
      "batterie|charge|utilitaire|ADAS"],

    ["GWM", "Tank|Ora|GWM Poer", "2021-2027", "Électrique / hybride / utilitaire", "150ch-400ch",
      "batterie|charge|autonomie|BMS|software|ADAS|12V|fuite|refroidissement",
      "critique", 0.85,
      "Marques chinoises GWM/Ora : batterie, charge, logiciel, ADAS.",
      "Conformité L.217-4; sécurité L.423-1.",
      "Rappels GWM/Ora",
      "batterie|charge|ADAS|logiciel"],

    ["Chevrolet", "Bolt EV|Bolt EUV|Lyriq|Equinox EV", "2017-2027", "Électrique Ultium / Bolt", "204ch-1000ch",
      "incendie|batterie|thermal runaway|charge|recall|BMS|software|ADAS|Super Cruise|autonomie|12V",
      "critique", 1.0,
      "Bolt : rappel mondial incendie batterie. Ultium/Super Cruise : logiciel, charge, ADAS.",
      "Sécurité L.423-1; produits défectueux 1245; pénal si accident; conformité L.217-4.",
      "NHTSA Bolt recall; GM recalls; DGCCRF",
      "incendie|batterie|charge|ADAS|logiciel"],

    ["GMC", "Hummer EV|Lyriq-based", "2022-2027", "Électrique Ultium", "400ch-1000ch",
      "batterie|charge|autonomie|BMS|software|ADAS|Super Cruise|thermal|12V",
      "critique", 0.92,
      "Plateforme Ultium GM : batterie, charge, logiciel, ADAS.",
      "Sécurité L.423-1; produits défectueux 1245.",
      "NHTSA GMC; GM recalls",
      "batterie|charge|ADAS|logiciel"],

    ["Cadillac", "Lyriq|Celestiq", "2022-2027", "Électrique Ultium", "300ch-600ch+",
      "batterie|charge|autonomie|BMS|software|ADAS|Super Cruise|thermal|12V",
      "critique", 0.92,
      "Plateforme Ultium GM premium : batterie, charge, logiciel, ADAS.",
      "Sécurité L.423-1; produits défectueux 1245.",
      "NHTSA Cadillac; GM recalls",
      "batterie|charge|ADAS|logiciel"],

    ["Ram", "1500|2500|3500", "2017-2027", "Diesel / Hurricane / électrique", "250ch-700ch",
      "turbo|boite|8-speed|PHEV|batterie|charge|autonomie|software|ADAS|fuel pump|fuite carburant",
      "critique", 0.75,
      "Gros moteurs, boîtes auto, PHEV, pompes à carburant, ADAS.",
      "Vice caché 1641; sécurité L.423-1; conformité L.217-4.",
      "NHTSA Ram; recalls",
      "moteur|boite|PHEV|carburant|ADAS"],

    ["Chrysler", "Pacifica|Pacifica Hybrid", "2017-2027", "V6 / PHEV", "287ch-360ch",
      "PHEV|batterie|charge|autonomie|software|ADAS|boite|fuel pump",
      "critique", 0.72,
      "Pacifica Hybrid : batterie, charge, logiciel, boîte.",
      "Vice caché 1641; conformité L.217-4.",
      "NHTSA Chrysler; recalls",
      "PHEV|batterie|boite|ADAS"]
  ];

  var SPECIFIC_DEFECTS = SPECIFIC_RAW.map(function (a) {
    return D(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11]);
  });

  function normalizeDefect(d) {
    var out = {
      b: d.b || d.brand || "",
      m: d.m || d.models || "",
      y: d.y || d.years || "",
      e: d.e || d.engine || "",
      p: d.p || d.power || "",
      s: d.s || d.symptoms || "",
      sev: d.sev || d.severity || "moyen",
      wf: typeof d.wf === "number" ? d.wf : (typeof d.wearFactor === "number" ? d.wearFactor : 0.5),
      n: d.n || d.note || d.description || "",
      law: d.law || d.legal || d.baseLegale || "",
      rec: d.rec || d.recall || d.recallRef || "",
      tg: d.tg || d.tags || ""
    };

    out.et = d.et || d.engineType || d.type || inferEngineType(out.e, out.tg, out.s, out.n);

    if (d.source) out.source = d.source;
    if (d.sourceUrl) out.sourceUrl = d.sourceUrl;
    if (d.dtc) out.dtc = d.dtc;

    return out;
  }

  function isValidDefect(d) {
    return d && d.b && d.s;
  }

  function defectKey(d) {
    return norm(d.b) + "|" + norm(d.e) + "|" + norm(d.y) + "|" + norm(d.m).slice(0, 40);
  }

  function mergeDefects(base, incoming) {
    var map = new Map();
    base.forEach(function (d) { map.set(defectKey(d), d); });
    incoming.forEach(function (d) {
      var nd = normalizeDefect(d);
      if (!isValidDefect(nd)) return;
      map.set(defectKey(nd), nd);
    });
    return Array.from(map.values());
  }

  var SEED_DEFECTS = SPECIFIC_DEFECTS.concat(GENERATED_DEFECTS)
    .map(normalizeDefect)
    .filter(isValidDefect);

  function allDefects() {
    return SEED_DEFECTS.concat(techUpdates || [], autoDb || []);
  }

  /* =========================================================
     INTEGRATION AUTO-DIAGNOSTIC
     ========================================================= */
  function inferAutoLegal(sev, tags, symptoms) {
    var laws = [];
    var t = norm(tags || "");
    var s = norm(symptoms || "");

    if (sev === "critique") {
      laws.push("Vice caché art. 1641 C.civ.");
      laws.push("Défaut de conformité L.217-4 C.consom. si vendeur professionnel.");
      laws.push("Tromperie L.213-1 C.consom. en cas de dissimulation.");
    } else {
      laws.push("Vice caché art. 1641 C.civ. à confirmer par expertise.");
      laws.push("Usure normale à écarter selon kilométrage, entretien et usage.");
    }

    if (t.indexOf("eau") >= 0 || t.indexOf("electricite") >= 0 || s.indexOf("court circuit") >= 0) {
      laws.push("Défaut de sécurité L.423-1 C.consom.");
      laws.push("Produits défectueux art. 1245 C.civ.");
    }

    if (t.indexOf("incendie") >= 0 || s.indexOf("incendie") >= 0 || s.indexOf("airbag") >= 0) {
      laws.push("Mise en danger art. 223-1 C.pénal.");
      laws.push("Homicide/blessures involontaires art. 221-6 / 222-19 C.pénal en cas d’accident.");
    }

    if (t.indexOf("adas") >= 0 || s.indexOf("autopilot") >= 0 || s.indexOf("phantom") >= 0) {
      laws.push("Sécurité des systèmes automatisés L.423-1 C.consom.");
      laws.push("Responsabilité du constructeur art. 1245 C.civ.");
    }

    if (t.indexOf("batterie") >= 0 || s.indexOf("thermal runaway") >= 0) {
      laws.push("Risque incendie batterie : sécurité L.423-1, produits défectueux 1245 C.civ.");
    }

    return laws.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" | ");
  }

  function normalizeAutoRecord(r, sourceUrl) {
    if (!r || typeof r !== "object") return null;

    var brand = valToString(firstVal(r, ["b", "brand", "marque", "constructeur", "make"]));
    var model = valToString(firstVal(r, ["m", "models", "model", "modele", "modèle", "vehicle", "vehicule"]));
    var years = valToString(firstVal(r, ["y", "years", "annee", "année", "millésime", "range", "period"]));
    var engine = valToString(firstVal(r, ["e", "engine", "motorisation", "moteur", "powertrain"]));
    var power = valToString(firstVal(r, ["p", "power", "puissance", "ch", "kw"]));
    var symptoms = valToString(firstVal(r, ["s", "symptoms", "symptomes", "panne", "pannes", "defaut", "défaut", "probleme", "problème", "issue", "fault"]));
    var severityRaw = norm(valToString(firstVal(r, ["sev", "severity", "gravite", "gravité", "niveau"])));
    var note = valToString(firstVal(r, ["n", "note", "description", "fiche", "ficheExpert", "expert", "detail"]));
    var law = valToString(firstVal(r, ["law", "legal", "baseLegale", "droit", "fondement"]));
    var recall = valToString(firstVal(r, ["rec", "recall", "rappel", "campagne", "campaign", "source"]));
    var tags = valToString(firstVal(r, ["tg", "tags", "categorie", "category", "family", "systeme"]));
    var dtc = valToString(firstVal(r, ["dtc", "codeDtc", "code", "codes", "DTC"]));
    var recSourceUrl = valToString(firstVal(r, ["sourceUrl", "url", "lien", "link"]));
    var wfRaw = firstVal(r, ["wf", "wearFactor", "coefUsure", "resistanceUsure"]);
    var wf = typeof wfRaw === "number" ? wfRaw : parseFloat(String(wfRaw || ""));
    if (!isFinite(wf)) wf = 0.6;

    if (!brand || !symptoms) return null;

    if (!years && r.annee) years = String(r.annee);
    if (years && /^\d{4}$/.test(years)) years = years + "-" + years;

    var sev = "moyen";
    if (severityRaw.indexOf("critique") >= 0 || severityRaw.indexOf("high") >= 0 || severityRaw.indexOf("major") >= 0) sev = "critique";
    else if (severityRaw.indexOf("moyen") >= 0 || severityRaw.indexOf("medium") >= 0) sev = "moyen";
    else if (severityRaw.indexOf("faible") >= 0 || severityRaw.indexOf("low") >= 0) sev = "faible";

    if (!law) law = inferAutoLegal(sev, tags, symptoms);

    return {
      b: brand,
      m: model || "*",
      y: years || "2017-2027",
      e: engine || "Auto-diagnostic",
      p: power || "N/A",
      s: symptoms,
      sev: sev,
      wf: wf,
      n: note || "Fiche technique issue de la base auto-diagnostic.",
      law: law,
      rec: recall || "Source auto-diagnostic",
      tg: tags || "auto-diagnostic",
      dtc: dtc,
      source: "auto-diagnostic",
      sourceUrl: recSourceUrl || sourceUrl || autoConfig.baseUrl
    };
  }

  function parseBalanced(text, start) {
    var open = text.charAt(start);
    if (open !== "[" && open !== "{") return null;

    var stack = [open];
    var inString = false;
    var escape = false;
    var max = Math.min(text.length, start + 1500000);

    for (var i = start + 1; i < max; i++) {
      var ch = text.charAt(i);

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === "\\") {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === "[" || ch === "{") {
        stack.push(ch);
      } else if (ch === "]" || ch === "}") {
        var expected = ch === "]" ? "[" : "{";
        if (stack.pop() !== expected) return null;
        if (stack.length === 0) return text.substring(start, i + 1);
      }
    }

    return null;
  }

  function extractJsonCandidates(text) {
    var out = [];
    if (!text) return out;

    var keywordRe = /marque|brand|modele|model|panne|defaut|dtc|symptom|rappel|recall|motorisation|engine|fiche/i;
    var max = Math.min(text.length, 2000000);
    var attempts = 0;

    for (var i = 0; i < max && attempts < 120; i++) {
      var ch = text.charAt(i);
      if (ch !== "[" && ch !== "{") continue;

      var snippet = text.substr(i, 400).toLowerCase();
      if (!keywordRe.test(snippet)) continue;

      attempts++;
      var raw = parseBalanced(text, i);
      if (!raw) continue;

      try {
        var obj = JSON.parse(raw);
        out.push(obj);
        i += raw.length;
      } catch (e) {}
    }

    return out;
  }

  function collectRecordsFromJson(json, sourceUrl, depth) {
    depth = depth || 0;
    var out = [];
    if (!json || depth > 4) return out;

    if (Array.isArray(json)) {
      json.forEach(function (item) {
        if (item && typeof item === "object" && Array.isArray(item.pannes)) {
          var parent = Object.assign({}, item);
          delete parent.pannes;
          item.pannes.forEach(function (p) {
            var sub = Object.assign({}, parent, p || {});
            var rec = normalizeAutoRecord(sub, sourceUrl);
            if (rec) out.push(rec);
          });
        } else {
          var rec = normalizeAutoRecord(item, sourceUrl);
          if (rec) out.push(rec);
        }
      });
      return out;
    }

    if (typeof json === "object") {
      var direct = normalizeAutoRecord(json, sourceUrl);
      if (direct) out.push(direct);

      ["defects", "base", "pannes", "models", "dtc", "records", "data", "items", "technicalUpdates", "autoDiagnostic"].forEach(function (key) {
        if (json[key] && typeof json[key] === "object") {
          out = out.concat(collectRecordsFromJson(json[key], sourceUrl, depth + 1));
        }
      });
    }

    return out;
  }

  function finishAutoSync(incoming, manual, mode) {
    autoDb = mergeDefects(autoDb, incoming);
    save(KEYS.AUTO_DB, autoDb);
    autoLastSync = Date.now();
    save(KEYS.AUTO_LAST_SYNC, autoLastSync);
    invalidateEngineCatalog();
    updateAdminStats();
    updateDataStatus("Auto-diagnostic synchronisé (" + mode + ")");
    if (manual) toast("Auto-diagnostic synchronisé : " + incoming.length + " entrées traitées.", "success");
    notify("Auto-diagnostic synchronisé", incoming.length + " entrées traitées (" + mode + ").");
  }

  function syncAutoDiagnostic(manual) {
    if (!window.fetch) {
      if (manual) toast("Synchronisation impossible : fetch non supporté.", "warning");
      return Promise.resolve(false);
    }

    updateDataStatus(manual ? "Synchronisation auto-diagnostic en cours..." : "Synchronisation auto-diagnostic en arrière-plan...");

    var baseUrl = autoConfig.baseUrl || CONFIG.autoDiagnostic.baseUrl;
    var endpoints = autoConfig.endpoints || CONFIG.autoDiagnostic.endpoints;
    var scriptUrls = autoConfig.scriptUrls || CONFIG.autoDiagnostic.scriptUrls;
    var pageUrl = autoConfig.pageUrl || CONFIG.autoDiagnostic.pageUrl;

    var tasks = [];

    endpoints.forEach(function (ep) {
      var url = resolveUrl(baseUrl, ep);
      tasks.push(
        fetchJsonUrl(url)
          .then(function (json) {
            return collectRecordsFromJson(json, url, 0);
          })
          .catch(function () {
            return [];
          })
      );
    });

    return Promise.all(tasks).then(function (results) {
      var incoming = [];
      results.forEach(function (arr) {
        incoming = incoming.concat(arr);
      });

      if (incoming.length) {
        finishAutoSync(incoming, manual, "JSON direct");
        return fetchEngineCatalogs(false).then(function () { return true; });
      }

      var textTasks = [];

      textTasks.push(
        fetchTextUrl(resolveUrl(baseUrl, pageUrl))
          .then(function (text) {
            var candidates = extractJsonCandidates(text);
            var recs = [];
            var erecs = [];
            candidates.forEach(function (c) {
              recs = recs.concat(collectRecordsFromJson(c, resolveUrl(baseUrl, pageUrl), 0));
              erecs = erecs.concat(collectEngineRecordsFromJson(c, resolveUrl(baseUrl, pageUrl), 0));
            });
            if (erecs.length) {
              engineExtra = mergeEngineRecords(engineExtra, erecs);
              save(KEYS.ENGINE_EXTRA, engineExtra);
              invalidateEngineCatalog();
            }
            return recs;
          })
          .catch(function () { return []; })
      );

      scriptUrls.forEach(function (sp) {
        var url = resolveUrl(baseUrl, sp);
        textTasks.push(
          fetchTextUrl(url)
            .then(function (text) {
              var candidates = extractJsonCandidates(text);
              var recs = [];
              var erecs = [];
              candidates.forEach(function (c) {
                recs = recs.concat(collectRecordsFromJson(c, url, 0));
                erecs = erecs.concat(collectEngineRecordsFromJson(c, url, 0));
              });
              if (erecs.length) {
                engineExtra = mergeEngineRecords(engineExtra, erecs);
                save(KEYS.ENGINE_EXTRA, engineExtra);
                invalidateEngineCatalog();
              }
              return recs;
            })
            .catch(function () { return []; })
        );
      });

      return Promise.all(textTasks).then(function (textResults) {
        var fallbackIncoming = [];
        textResults.forEach(function (arr) {
          fallbackIncoming = fallbackIncoming.concat(arr);
        });

        if (fallbackIncoming.length) {
          finishAutoSync(fallbackIncoming, manual, "extraction HTML/JS");
          return fetchEngineCatalogs(false).then(function () { return true; });
        }

        save(KEYS.AUTO_LAST_SYNC, Date.now());
        autoLastSync = Date.now();
        updateAdminStats();
        updateDataStatus("Auto-diagnostic : aucune donnée JSON exploitable trouvée");
        if (manual) toast("Aucune donnée auto-diagnostic exploitable trouvée. Utilisez import JSON ou exposez data/base.json.", "warning");
        return fetchEngineCatalogs(manual).then(function () { return false; });
      });
    }).catch(function (err) {
      console.warn("[AR-EXPERT] Sync auto-diagnostic impossible:", err);
      updateDataStatus("Auto-diagnostic indisponible — base locale conservée");
      if (manual) toast("Synchronisation auto-diagnostic impossible.", "warning");
      return false;
    });
  }

  function renderAutoConfig() {
    var baseEl = q("#autoBaseUrl");
    var epEl = q("#autoEndpoints");

    if (baseEl) baseEl.value = autoConfig.baseUrl || "";
    if (epEl) epEl.value = (autoConfig.endpoints || []).join("\n");
  }

  function saveAutoConfigFromUi() {
    var baseEl = q("#autoBaseUrl");
    var epEl = q("#autoEndpoints");

    autoConfig.baseUrl = baseEl ? baseEl.value.trim() : autoConfig.baseUrl;
    var rawEndpoints = epEl ? epEl.value : "";
    autoConfig.endpoints = String(rawEndpoints)
      .split(/[\n,]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });

    save(KEYS.AUTO_CFG, autoConfig);
    toast("Configuration auto-diagnostic enregistrée.", "success");
  }

  /* =========================================================
     MISE A JOUR AUTOMATIQUE TOUS LES 30 JOURS
     ========================================================= */
  function updateDataStatus(msg) {
    var el = q("#dataStatus");
    if (el) el.textContent = msg + " • Auto-diagnostic: " + (autoDb ? autoDb.length : 0);
  }

  function checkAutoUpdate(manual) {
    try {
      var last = loadWithMigration(KEYS.LAST_UPDATE, OLD_KEYS.LAST_UPDATE, 0);
      var interval = CONFIG.updateIntervalDays * 24 * 60 * 60 * 1000;
      var due = (Date.now() - last) >= interval;

      if (!due && !manual) return;
      if (!navigator.onLine && !manual) return;

      fetchUpdate(manual);
    } catch (e) {
      console.warn("[AR-EXPERT] Check update ignore:", e);
    }
  }

  function fetchUpdate(manual) {
    if (!window.fetch) {
      if (manual) toast("Mise à jour impossible : fetch non supporté.", "warning");
      return;
    }

    updateDataStatus(manual ? "Recherche de mise à jour..." : "Mise à jour périodique en arrière-plan...");

    fetch(CONFIG.updateUrl, { cache: "no-store", method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var incoming = Array.isArray(json) ? json : (json && Array.isArray(json.defects) ? json.defects : []);
        if (!incoming.length) {
          if (manual) toast("Aucune nouvelle donnée technique.", "info");
          save(KEYS.LAST_UPDATE, Date.now());
          updateDataStatus("Base locale à jour");
          return;
        }

        techUpdates = mergeDefects(techUpdates, incoming);
        save(KEYS.TECH_UPDATES, techUpdates);
        save(KEYS.LAST_UPDATE, Date.now());
        invalidateEngineCatalog();
        updateAdminStats();
        updateDataStatus("Base mise à jour automatiquement");

        if (manual) toast("Mise à jour technique appliquée.", "success");
        notify("Base technique mise à jour", incoming.length + " entrées traitées.");
      })
      .catch(function (err) {
        console.warn("[AR-EXPERT] Mise à jour impossible:", err);
        save(KEYS.LAST_UPDATE, Date.now());
        updateDataStatus("Mode autonome : mise à jour indisponible");
        if (manual) toast("Mise à jour impossible. Base locale conservée.", "warning");
      });
  }

  /* =========================================================
     CORRELATION TECHNIQUE / JURIDIQUE
     ========================================================= */
  function checkYearRange(rangeStr, targetYear) {
    if (!targetYear) return true;
    var parts = String(rangeStr || "").split("-").map(function (s) { return parseInt(s.trim(), 10); });
    if (parts.length === 2 && parts[0] && parts[1]) {
      return targetYear >= parts[0] && targetYear <= parts[1];
    }
    return true;
  }

  function symptomMatch(textNorm, symptom) {
    var s = norm(symptom);
    if (!s) return false;
    if (textNorm.indexOf(s) >= 0) return true;

    var words = s.split(/\s+/).filter(function (w) { return w.length > 3; });
    if (!words.length) return false;

    return words.every(function (w) { return textNorm.indexOf(w) >= 0; });
  }

  function tagBoost(textNorm, tags) {
    var boost = 0;
    String(tags || "").split("|").forEach(function (t) {
      var tn = norm(t);
      if (tn && textNorm.indexOf(tn) >= 0) boost += 0.35;
    });
    return boost;
  }

  function legalFor(defect) {
    var laws = [];
    if (defect.law) laws.push(defect.law);

    var tags = norm(defect.tg || "");
    var symptoms = norm(defect.s || "");
    var sev = defect.sev || "moyen";
    var type = norm(defect.et || "");

    if (sev === "critique") {
      laws.push("Vice caché art. 1641 C.civ.");
      laws.push("Défaut de conformité L.217-4 C.consom. si vendeur professionnel.");
      laws.push("Tromperie L.213-1 C.consom. en cas de dissimulation.");
    } else {
      laws.push("Vice caché art. 1641 C.civ. à confirmer par expertise.");
      laws.push("Usure normale à écarter selon kilométrage, entretien et usage.");
    }

    if (type.indexOf("diesel") >= 0 || tags.indexOf("diesel") >= 0 || tags.indexOf("egr") >= 0 || tags.indexOf("fap") >= 0 || tags.indexOf("adblue") >= 0) {
      laws.push("Conformité antipollution L.217-4 C.consom.; tromperie L.213-1 si dispositif illicite ou dissimulation.");
      laws.push("Sécurité / environnement L.423-1 C.consom. en cas de risque collectif.");
    }

    if (isElectricLike(type) || tags.indexOf("batterie") >= 0 || tags.indexOf("charge") >= 0 || tags.indexOf("electricite") >= 0) {
      laws.push("Sécurité batterie / BMS / charge L.423-1 C.consom.");
      laws.push("Produits défectueux art. 1245 C.civ.");
      laws.push("Conformité du bien numérique/logiciel L.217-4 C.consom.");
    }

    if (type.indexOf("essence") >= 0 || tags.indexOf("turbo") >= 0 || tags.indexOf("huile") >= 0 || tags.indexOf("distribution") >= 0) {
      laws.push("Vice caché moteur art. 1641 C.civ.; usure à écarter par expertise.");
    }

    if (tags.indexOf("eau") >= 0 || tags.indexOf("electricite") >= 0 || symptoms.indexOf("court circuit") >= 0) {
      laws.push("Défaut de sécurité L.423-1 C.consom.");
      laws.push("Responsabilité du fait des produits défectueux art. 1245 C.civ.");
    }

    if (tags.indexOf("incendie") >= 0 || symptoms.indexOf("incendie") >= 0 || symptoms.indexOf("airbag") >= 0 || symptoms.indexOf("pedale") >= 0) {
      laws.push("Mise en danger art. 223-1 C.pénal.");
      laws.push("Homicide/blessures involontaires art. 221-6 / 222-19 C.pénal en cas d’accident.");
    }

    if (tags.indexOf("adas") >= 0 || symptoms.indexOf("autopilot") >= 0 || symptoms.indexOf("phantom") >= 0) {
      laws.push("Sécurité des systèmes automatisés L.423-1 C.consom.");
      laws.push("Responsabilité du constructeur/art. 1245 C.civ.");
    }

    return laws.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" | ");
  }

  function matchDefects(marque, modele, annee, kilometrage, texte, engine, engineType) {
    var bq = norm(marque);
    var mq = norm(modele);
    var yr = parseYear(annee);
    var km = parseKm(kilometrage);
    var txt = norm(texte);
    var eng = norm(engine || "");
    var typ = norm(engineType || "");
    var results = [];

    allDefects().forEach(function (d) {
      var db = norm(d.b || "");

      var brandOk;
      if (!bq) {
        brandOk = db === "toutes marques";
      } else {
        brandOk = db === "toutes marques" || db.indexOf(bq) >= 0 || bq.indexOf(db) >= 0;
      }

      if (!brandOk) return;
      if (!checkYearRange(d.y, yr)) return;

      var modelOk = true;
      if (mq && d.m && d.m !== "*") {
        modelOk = String(d.m || "").split("|").some(function (m) {
          var nm = norm(m);
          return nm.indexOf(mq) >= 0 || mq.indexOf(nm) >= 0;
        });
      }
      if (!modelOk) return;

      var score = 0;
      var found = [];

      String(d.s || "").split("|").forEach(function (s) {
        if (symptomMatch(txt, s)) {
          score++;
          found.push(s);
        }
      });

      score += tagBoost(txt, d.tg);

      var det = norm(d.et || "");
      if (eng) {
        var de = norm(d.e || "");
        if (de.indexOf(eng) >= 0 || eng.indexOf(de) >= 0) score += 3;
      }

      if (typ && det === typ) score += 2;

      if (typ && isElectricLike(typ) && containsAny(d.tg + " " + d.s, ["batterie", "charge", "autonomie", "electricite", "hybride", "48v"])) {
        score += 1.5;
      }

      if (typ === "diesel" && containsAny(d.tg + " " + d.s, ["diesel", "egr", "fap", "adblue", "nox", "pollution"])) {
        score += 1.5;
      }

      if (typ === "essence" && containsAny(d.tg + " " + d.s, ["essence", "turbo", "huile", "distribution", "courroie", "chaine"])) {
        score += 1;
      }

      if (score >= 1) {
        var confidence = "Haute";
        var wearAlert = "Kilométrage compatible avec un vice caché ou un défaut de série.";

        if (d.wf >= 0.9) {
          confidence = "Haute";
          wearAlert = "Défaut de conception/montage/software peu dépendant du kilométrage.";
        } else if (km > 200000) {
          confidence = d.wf >= 0.8 ? "Moyenne" : "Basse";
          wearAlert = "Kilométrage très élevé (>200 000 km) : présomption d’usure normale forte. Expertise judiciaire indispensable.";
        } else if (km > 150000 && d.wf < 0.7) {
          confidence = "Basse";
          wearAlert = "Kilométrage élevé (>150 000 km) : une part des symptômes peut relever de l’usure normale.";
        } else if (km > 100000 && d.wf < 0.85) {
          confidence = "Moyenne";
          wearAlert = "Kilométrage élevé (>100 000 km) : usure possible, mais défaut documenté suspect.";
        }

        results.push({
          constructeur: d.b,
          moteur: d.e,
          puissance: d.p,
          periode: d.y,
          modeles: d.m === "*" ? ["Toutes motorisations"] : String(d.m || "").split("|"),
          severite: d.sev,
          description: d.n,
          symptomes: found.length ? found : String(d.s || "").split("|").slice(0, 3),
          score: score,
          confiance: confidence,
          alerteUsure: wearAlert,
          baseLegale: legalFor(d),
          rappelRef: d.rec || "À vérifier via VIN auprès constructeur, DGCCRF, rappel.conso, NHTSA, KBA, SafetyGate.",
          wearFactor: d.wf,
          tags: d.tg,
          dtc: d.dtc || "",
          engineType: d.et || "",
          source: d.source || "base locale",
          sourceUrl: d.sourceUrl || ""
        });
      }
    });

    return results.sort(function (a, b) { return b.score - a.score; }).slice(0, 15);
  }

  function researchLinks(brand, model, engine, symptoms, engineType) {
    var baseQuery = (brand + " " + model + " " + (engine || "") + " " + (engineType || "") + " " + (symptoms || []).slice(0, 3).join(" ")).trim();
    var q1 = encodeURIComponent(baseQuery + " défaut panne rappel incendie DTC motorisation");
    var q2 = encodeURIComponent(brand + " " + model);

    return [
      { label: "Base auto-diagnostic", url: autoConfig.baseUrl || CONFIG.autoDiagnostic.baseUrl },
      { label: "Recherche spécialisée Google / forums techniques", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France (DGCCRF)", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls (USA)", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / défauts constructeurs", url: "https://www.google.com/search?q=" + encodeURIComponent(baseQuery + " safetygate TSB rappel défaut") },
      { label: "Rappels allemands KBA", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " KBA Rückruf") },
      { label: "Vérification VIN constructeur", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " VIN recall campaign motorisation") }
    ];
  }

  /* =========================================================
     ANALYSE / RAPPORT
     ========================================================= */
  function addTerm() {
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (t) { termesMobilises.add(t); });
    return '<span class="termes-juridiques">(' + args.join(", ") + ")</span>";
  }

  function engineAngle(flags) {
    var h = "";

    if (flags.engine) {
      h += '<div class="rappel-info"><h4>🧰 Motorisation retenue pour l’analyse</h4>';
      h += "<p><strong>Motorisation déclarée :</strong> " + esc(flags.engine) + "</p>";
      h += "<p><strong>Type :</strong> " + esc(flags.engineType || "non précisé") + " " + addTerm("motorisation", "énergie", "powertrain", "type de motorisation") + "</p>";
      h += "<p>La motorisation est prise en compte comme critère technique et juridique : elle oriente le diagnostic, la présomption d’antériorité, la gravité, les rappels applicables et les fondements de responsabilité.</p>";
      h += "</div>";
    }

    if (flags.diesel) {
      h += '<div class="rappel-info"><h4>🛢️ Angle diesel / dépollution</h4>';
      h += "<p>La motorisation diesel active les axes EGR, FAP/DPF, AdBlue, NOx, injecteurs, turbo, régénération, logiciel moteur et conformité antipollution.</p>";
      h += "<p><strong>Point juriste :</strong> un défaut antipollution, une cristallisation AdBlue, un voyant pollution permanent ou une perte de puissance peut fonder une non-conformité L.217-4 C.consom. et, si dissimulation, tromperie L.213-1 C.consom.</p>";
      h += "<p><strong>Point ingénieur :</strong> distinguer l’usure d’entretien d’un défaut de conception, de logiciel ou de montage.</p>";
      h += "</div>";
    }

    if (flags.electricLike) {
      h += '<div class="rappel-info"><h4>⚡ Angle motorisation électrifiée / hybride / électrique</h4>';
      h += "<p>La motorisation électrifiée active les axes batterie, BMS, cellules, autonomie, charge AC/DC, DC-DC, batterie 12V, logiciel, isolation HV, gestion thermique et sécurité incendie.</p>";
      h += "<p><strong>Point sécurité :</strong> odeur, fumée, échauffement, gonflement, erreur d’isolement ou perte de puissance brutale imposent immobilisation et expertise spécialisée.</p>";
      h += "<p><strong>Point juriste :</strong> autonomie réelle non conforme, défaut de charge, bug logiciel ou risque batterie peuvent engager L.217-4 C.consom., L.423-1 C.consom. et art. 1245 C.civ.</p>";
      h += "</div>";
    }

    if (flags.petrol) {
      h += '<div class="rappel-info"><h4>⛽ Angle essence / turbo downsizing</h4>';
      h += "<p>La motorisation essence active les axes turbo, consommation huile, chaîne/courroie de distribution, PCV, carbonisation, pré-allumage, perte de puissance et surchauffe.</p>";
      h += "<p><strong>Point ingénieur :</strong> certains désordres sont indépendants du kilométrage quand ils relèvent de la conception, du montage ou du logiciel.</p>";
      h += "</div>";
    }

    if (flags.mild48) {
      h += '<div class="rappel-info"><h4>🔋 Angle hybride léger 48V</h4>';
      h += "<p>La micro-hybridation 48V introduit batterie secondaire, convertisseur, logiciel, démarrage/arrêt, alternodémarreur et risques de voyants multiples.</p>";
      h += "<p>Ces éléments peuvent être non conformes ou dangereux même si le moteur thermique principal semble fonctionnel.</p>";
      h += "</div>";
    }

    return h;
  }

  function runAnalysis(text, context, objective, sellerType) {
    var all = (text + " " + context).toLowerCase();
    var allNorm = norm(all);

    var engineTypeNorm = norm(vehicleData.engineType || "");

    var flags = {
      engine: vehicleData.engine || "",
      engineType: vehicleData.engineType || "",
      professional: sellerType === "professional" || containsAny(all, ["professionnel", "garage", "concession", "revendeur", "automobile", "commercial"]),
      privateSeller: sellerType === "private" || containsAny(all, ["particulier", "entre particuliers", "leboncoin", "lavitrine"]),
      defect: containsAny(all, ["défaut", "panne", "problème", "dysfonctionnement", "casse", "fuite", "bruit", "vibration", "perte puissance", "à-coup", "claquement", "voyant", "mode dégradé", "surchauffe", "infiltration", "court circuit", "moisiure", "odeur", "fumée", "calage", "patinage", "blocage"]),
      waterLeak: containsAny(all, ["eau", "humidité", "infiltration", "baie", "pare brise", "pare-brise", "moisiure", "court circuit", "traces d’eau", "flaque", "égouttement"]),
      safety: containsAny(all, ["sécurité", "frein", "airbag", "direction", "incendie", "danger", "vie", "intégrité physique", "mise en danger", "ADAS", "autopilot"]),
      ev: isElectricLike(engineTypeNorm) || containsAny(all, ["batterie", "charge", "autonomie", "electrique", "électrique", "hybride", "BMS", "DC", "AC", "recharge"]),
      diesel: engineTypeNorm.indexOf("diesel") >= 0 || containsAny(allNorm, ["diesel", "egr", "fap", "adblue", "nox", "gasoil"]),
      petrol: engineTypeNorm.indexOf("essence") >= 0 || containsAny(allNorm, ["essence", "turbo", "puretech", "tce", "tsi", "ecoboost"]),
      hybrid: engineTypeNorm.indexOf("hybride") >= 0,
      phev: engineTypeNorm.indexOf("rechargeable") >= 0,
      mild48: engineTypeNorm.indexOf("48v") >= 0,
      electricLike: isElectricLike(engineTypeNorm),
      dtc: /\bp[0-9a-z]{3,5}\b/i.test(all) || allNorm.indexOf("dtc") >= 0 || allNorm.indexOf("code défaut") >= 0,
      invoice: all.indexOf("facture") >= 0,
      repair: all.indexOf("réparation") >= 0 || all.indexOf("ordre de réparation") >= 0 || all.indexOf("devis") >= 0,
      controlTech: all.indexOf("contrôle technique") >= 0 || all.indexOf(" ct ") >= 0,
      warranty: all.indexOf("garantie") >= 0,
      highKm: parseKm(vehicleData.kilometrage) > 120000,
      veryHighKm: parseKm(vehicleData.kilometrage) > 180000
    };

    var matches = matchDefects(
      vehicleData.marque,
      vehicleData.modele,
      vehicleData.annee,
      vehicleData.kilometrage,
      text,
      vehicleData.engine,
      vehicleData.engineType
    );

    analysisData = {
      date: new Date().toLocaleString("fr-FR"),
      vehicleData: vehicleData,
      flags: flags,
      matches: matches,
      sections: []
    };

    var S = [];
    S.push(["I. ÉLÉMENTS FACTUELS ET IDENTIFICATION DU VÉHICULE", secFacts(text, context)]);
    S.push(["II. DIAGNOSTIC TECHNIQUE — MOTORISATION, DÉFAUTS CONNUS, VÉTUSTÉ, USURE, SÉCURITÉ", secDiag(matches, flags, vehicleData)]);
    S.push(["II-B. APPUI TECHNIQUE AUTO-DIAGNOSTIC IMPORTÉ", secAutoAppui(matches, flags)]);
    S.push(["III. QUALIFICATION JURIDIQUE PROVISOIRE", secQualif(flags, matches)]);
    S.push(["IV. RISQUES ET RESPONSABILITÉS SELON LA QUALITÉ DU VENDEUR", secRisques(flags, matches)]);
    S.push(["V. TROIS CRITÈRES CUMULATIFS : ANTÉRIORITÉ, CARACTÈRE CACHÉ, GRAVITÉ", secCriteres(flags, matches, vehicleData)]);
    S.push(["VI. RÉGIMES DE GARANTIE ET FONDEMENTS JURIDIQUES CROISÉS", secGaranties(flags, matches)]);
    S.push(["VII. DOSSIER PROBATOIRE ET DOCUMENTS À CONSOLIDER", secDocs(flags, matches)]);
    S.push(["VIII. JURISPRUDENCE, TEXTES ET SOURCES DE RÉFÉRENCE", secJuri(matches, flags)]);
    S.push(["IX. ÉVALUATION DU PRÉJUDICE", secPrejudice(flags, matches)]);
    S.push(["X. STRATÉGIE CONTENTIEUSE RECOMMANDÉE", secStrategie(flags, matches, objective)]);
    S.push(["XI. RECHERCHE APPROFONDIE ET VÉRIFICATIONS EXTERNES", secVerif(matches, flags)]);
    S.push(["XII. VOIES D’ACTION POSSIBLES", secVoies(flags, matches)]);
    S.push(["XIII. CONCLUSION ORIENTÉE EXPERT / INGÉNIEUR / JURISTE / SAPEUR-POMPIER", secConclu(objective, matches, flags, vehicleData)]);
    S.push(["XIV. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ", secLexique()]);

    analysisData.sections = S;
    renderAnalysis();
  }

  function renderAnalysis() {
    var html = "";
    analysisData.sections.forEach(function (pair) {
      html += "<h3>" + pair[0] + "</h3>" + pair[1];
    });

    html += '<div class="verification-needed"><strong>Rappel méthodologique :</strong> ce rapport effectue d’abord un croisement local technique/juridique/motorisation/auto-diagnostic avant toute rédaction assistée par IA. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>';

    var result = q("#analysisResult");
    if (result) result.innerHTML = html;

    var section = q("#analysisSection");
    if (section) {
      section.classList.remove("hidden");
      section.scrollIntoView({ behavior: "smooth" });
    }
  }

  function secFacts(text, context) {
    var h = "<p><strong>Objet :</strong> recensement des éléments fournis " + addTerm("éléments factuels", "faits allégués") + ".</p>";

    h += "<h4>A. Véhicule déclaré</h4><ul>";
    h += "<li><strong>Marque :</strong> " + esc(vehicleData.marque || "non précisée") + "</li>";
    h += "<li><strong>Modèle :</strong> " + esc(vehicleData.modele || "non précisé") + "</li>";
    h += "<li><strong>Année :</strong> " + esc(vehicleData.annee || "non précisée") + " " + addTerm("millésime", "date de première mise en circulation") + "</li>";
    h += "<li><strong>Motorisation :</strong> " + esc(vehicleData.engine || "non précisée") + " " + addTerm("motorisation", "powertrain") + "</li>";
    h += "<li><strong>Type de motorisation :</strong> " + esc(vehicleData.engineType || "non précisé") + " " + addTerm("énergie", "essence", "diesel", "hybride", "électrique", "48V") + "</li>";
    h += "<li><strong>Kilométrage :</strong> " + esc(vehicleData.kilometrage || "non précisé") + " km " + addTerm("kilométrage", "usure normale", "vétusté") + "</li>";
    h += "<li><strong>VIN :</strong> " + esc(vehicleData.vin || "non communiqué") + " " + addTerm("VIN", "numéro de série", "traçabilité") + "</li>";
    h += "</ul>";

    h += "<h4>B. Faits rapportés</h4>";
    h += "<p>" + esc(text.substring(0, 1400)) + (text.length > 1400 ? " [...] (tronqué pour affichage, analyse complète conservée en mémoire)" : "") + "</p>";

    if (context) {
      h += "<h4>C. Contexte transactionnel</h4><p>" + esc(context.substring(0, 1000)) + "</p>";
    }

    h += '<div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ' + addTerm("faits non vérifiés", "principe du contradictoire") + ".</div>";
    return h;
  }

  function secDiag(matches, flags, vData) {
    var km = parseKm(vData.kilometrage);
    var yr = parseYear(vData.annee);
    var age = new Date().getFullYear() - (yr || new Date().getFullYear());

    var h = engineAngle(flags);

    if (!matches.length) {
      h += "<p><strong>Objet :</strong> recherche de défauts conceptuels connus " + addTerm("défauts conceptuels", "problèmes récurrents", "défaut de série") + ".</p>";
      h += '<div class="verification-needed">';
      h += "<p>Aucune correspondance exacte trouvée dans la base locale / auto-diagnostic pour Marque/Modèle/Année/Motorisation/Symptômes.</p>";
      h += "<p>Cela ne signifie pas absence de défaut, mais absence de notoriété suffisante dans les sources consolidées localement.</p>";
      h += "<p>Une expertise individuelle est nécessaire " + addTerm("expertise individuelle", "analyse fonctionnelle", "recherche de cause racine") + ".</p>";
      h += "</div>";
      return h;
    }

    h += "<p><strong>Objet :</strong> croisement technique local avec motorisation, défauts connus, rappels, TSB, forums spécialisés, DGCCRF, NHTSA, SafetyGate, KBA, auto-diagnostic et bases de sécurité " + addTerm("vice caché notoire", "défaut de série", "défaut de conception") + ".</p>";

    matches.forEach(function (m, i) {
      var cls = m.severite === "critique" ? "rappel-critical" : "rappel-info";
      var confColor = m.confiance === "Haute" ? "#10b981" : (m.confiance === "Moyenne" ? "#f59e0b" : "#ef4444");

      h += '<div class="' + cls + '">';
      h += "<h4>" + (i + 1) + ". " + esc(m.moteur) + " — " + esc(m.puissance) + " — " + esc(m.periode) + "</h4>";
      h += "<p><strong>Constructeur :</strong> " + esc(m.constructeur) + "</p>";
      h += "<p><strong>Modèles concernés :</strong> " + esc(m.modeles.join(", ")) + "</p>";
      h += "<p><strong>Type motorisation :</strong> " + esc(m.engineType || "non précisé") + "</p>";
      h += "<p><strong>Symptômes détectés :</strong> " + esc(m.symptomes.join(", ")) + "</p>";
      if (m.dtc) h += "<p><strong>Codes DTC associés :</strong> " + esc(m.dtc) + "</p>";
      h += "<p><strong>Tags système :</strong> " + esc(m.tags || "non précisé") + "</p>";
      h += "<p><strong>Source :</strong> " + esc(m.source || "base locale") + (m.sourceUrl ? " — <a href='" + esc(m.sourceUrl) + "' target='_blank' rel='noopener noreferrer'>ouvrir la source</a>" : "") + "</p>";
      h += "<p><strong>Description technique :</strong> " + esc(m.description) + "</p>";
      h += '<p><strong>Gravité :</strong> <span style="font-weight:bold;color:' + (m.severite === "critique" ? "#dc3545" : "#ffc107") + '">' + esc(m.severite.toUpperCase()) + "</span></p>";
      h += '<p><strong>Confiance vs usure :</strong> <span style="color:' + confColor + ';font-weight:bold">' + esc(m.confiance) + "</span> — indice de non-usure : " + Math.round(m.wearFactor * 100) + "%</p>";
      h += '<p style="background:#fff3cd;padding:8px;border-radius:4px;">⚠️ ' + esc(m.alerteUsure) + "</p>";
      h += "<p><strong>Croisement juridique local :</strong> " + esc(m.baseLegale) + " " + addTerm("vice caché", "défaut de conformité", "tromperie") + "</p>";
      h += "<p><strong>Rappel / TSB / source :</strong> " + esc(m.rappelRef) + " " + addTerm("rappel constructeur", "campagne technique", "TSB") + "</p>";
      h += "</div>";
    });

    h += "<h4>Analyse de vétusté et kilométrage</h4><ul>";
    h += "<li><strong>Âge approximatif :</strong> " + age + " ans</li>";
    h += "<li><strong>Kilométrage :</strong> " + km.toLocaleString("fr-FR") + " km</li>";
    h += "<li><strong>Rythme estimé :</strong> " + (age > 0 ? Math.round(km / age).toLocaleString("fr-FR") : "N/A") + " km/an</li>";

    if (km > 200000) {
      h += '<li class="certainty-low">Kilométrage très élevé : usure normale fortement plausible. Expertise indispensable pour distinguer défaut et usure.</li>';
    } else if (km > 120000) {
      h += '<li class="certainty-medium">Kilométrage élevé : usure possible, mais défaut de série documenté maintient une suspicion forte.</li>';
    } else {
      h += '<li class="certainty-high">Kilométrage modéré : la thèse du vice caché / défaut de conception est renforcée.</li>';
    }
    h += "</ul>";

    if (flags.waterLeak) {
      h += '<div class="rappel-critical"><h4>💧 Alerte infiltration d’eau — angle ingénieur / sapeur-pompier</h4>';
      h += "<p>Les symptômes évoquent une infiltration d’eau (baie de pare-brise, joints, évacuations, toit ouvrant, climatisation).</p>";
      h += "<p><strong>Point expert :</strong> ce type de désordre relève souvent d’un défaut de montage ou de conception, indépendant du kilométrage.</p>";
      h += "<p><strong>Risques :</strong> court-circuit, destruction de calculateurs, corrosion, dysfonctionnement ABS/ESP, airbag, direction, risque d’incendie électrique.</p>";
      h += "<p><strong>Constat recommandé :</strong> photos des moisiures, boîtier fusibles, connecteurs sous tableau de bord, cavillon, joints de pare-brise, évacuations.</p>";
      h += "</div>";
    }

    if (flags.dtc) {
      h += '<div class="rappel-info"><h4>🧾 Angle codes défaut / DTC</h4>';
      h += "<p>Des codes défaut ou mentions DTC semblent présents dans le dossier.</p>";
      h += "<p><strong>Recommandation :</strong> faire extraire la liste complète des DTC par un diagnostiqueur indépendant, conserver le rapport horodaté, croiser avec les fiches auto-diagnostic et les TSB constructeurs.</p>";
      h += "</div>";
    }

    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += '<div class="rappel-critical"><h4>🚨 Alerte sécurité civile / sapeur-pompier</h4>';
      h += "<p>Un défaut critique est identifié : risque moteur, incendie, perte de contrôle, airbag, batterie ou immobilisation brutale.</p>";
      h += "<p>En attendant expertise, limiter l’usage du véhicule, éviter autoroutes, transports d’enfants, trajets de nuit et longue durée.</p>";
      h += "</div>";
    }

    h += '<div class="certainty-medium"><strong>Synthèse :</strong> faisceau d’indices techniques ' + addTerm("faisceau d’indices", "indice grave précis et concordant") + " en faveur d’un défaut antérieur, caché et grave. Le vendeur professionnel aurait pu connaître ce risque " + addTerm("obligation de renseignement", "présomption de connaissance") + ".</div>";

    return h;
  }

  function secAutoAppui(matches, flags) {
    var autoMatches = matches.filter(function (m) {
      return m.source === "auto-diagnostic";
    });

    var h = "<p><strong>Objet :</strong> appui technique issu de la base auto-diagnostic, corrélé au contexte du litige et à la motorisation " + addTerm("appui technique", "corrélation auto-diagnostic", "fiche expert", "DTC", "motorisation") + ".</p>";

    if (!autoDb.length) {
      h += '<div class="verification-needed">';
      h += "<p>La base auto-diagnostic n’est pas encore synchronisée localement.</p>";
      h += "<p>L’application a tenté de récupérer les données depuis :</p>";
      h += "<p><code>" + esc(autoConfig.baseUrl || CONFIG.autoDiagnostic.baseUrl) + "</code></p>";
      h += "<p>Si aucune donnée n’est exposée en JSON, déposer un export JSON dans :</p>";
      h += "<p><code>" + esc(resolveUrl(autoConfig.baseUrl || CONFIG.autoDiagnostic.baseUrl, "data/base.json")) + "</code></p>";
      h += "<p>ou utiliser : Admin → Base technique → Importer JSON.</p>";
      h += "</div>";
      return h;
    }

    h += "<p><strong>Entrées auto-diagnostic disponibles localement :</strong> " + autoDb.length + ".</p>";

    if (!autoMatches.length) {
      h += '<div class="certainty-medium">';
      h += "<p>Aucune fiche auto-diagnostic ne correspond directement au véhicule / motorisation / symptômes déclarés.</p>";
      h += "<p>Cela n’exclut pas un défaut individuel. Une lecture OBD / DTC et une expertise restent nécessaires.</p>";
      h += "</div>";
      return h;
    }

    h += '<div class="rappel-info">';
    h += "<h4>Fiches auto-diagnostic corrélées au litige</h4>";
    h += "<ul>";

    autoMatches.slice(0, 10).forEach(function (m, i) {
      h += "<li><strong>" + (i + 1) + ". " + esc(m.constructeur) + " " + esc(m.modeles.join(", ")) + " — " + esc(m.moteur) + "</strong>";
      if (m.engineType) h += " — type : " + esc(m.engineType);
      if (m.dtc) h += " — DTC : " + esc(m.dtc);
      h += "<br/><strong>Symptômes :</strong> " + esc(m.symptomes.join(", "));
      h += "<br/><strong>Description :</strong> " + esc(m.description);
      if (m.sourceUrl) h += "<br/><strong>Source :</strong> <a href='" + esc(m.sourceUrl) + "' target='_blank' rel='noopener noreferrer'>" + esc(m.sourceUrl) + "</a>";
      h += "<br/><strong>Appui juridique :</strong> " + esc(m.baseLegale);
      h += "</li>";
    });

    h += "</ul>";
    h += "</div>";

    h += "<h4>Exploitation experte / juriste de l’appui auto-diagnostic</h4><ul>";
    h += "<li>" + addTerm("corrélation technique", "faisceau d’indices") + " : les fiches auto-diagnostic permettent de démontrer que le désordre n’est pas isolé mais documenté.</li>";
    h += "<li>" + addTerm("antériorité", "défaut de série") + " : si la fiche vise le même moteur / boîte / système, l’origine antérieure à la vente est renforcée.</li>";
    h += "<li>" + addTerm("caractère caché", "non-décelable par examen standard") + " : les défauts électroniques, logiciels, ADAS, batterie, infiltration ou mécatronique ne sont généralement pas visibles lors d’un essai court.</li>";
    h += "<li>" + addTerm("gravité", "coût de réparation", "sécurité") + " : les DTC et fiches expert aident à qualifier l’impact sur la sécurité, la valeur d’usage et le coût de remise en état.</li>";
    if (flags.professional) {
      h += "<li>" + addTerm("vendeur professionnel", "obligation de conseil", "vérification des rappels") + " : la notoriété du défaut dans la base auto-diagnostic peut fonder une présomption de connaissance ou de faute.</li>";
    } else {
      h += "<li>" + addTerm("vendeur particulier", "mauvaise foi", "réticence dolosive") + " : si le vendeur connaissait la fiche / rappel / DTC, la clause vendu en l’état peut être écartée.</li>";
    }
    h += "</ul>";

    return h;
  }

  function secQualif(flags, matches) {
    var h = "<p><strong>Objet :</strong> qualification juridique provisoire " + addTerm("qualification juridique", "qualification incertaine") + ".</p>";

    if (flags.professional && !flags.privateSeller) {
      h += '<div class="certainty-high"><p>Vendeur présumé professionnel ' + addTerm("vendeur professionnel") + ". Protection consommateur renforcée : garantie légale de conformité, charge de la preuve allégée, obligation d’information et de vérification des rappels.</p></div>";
    } else if (flags.privateSeller && !flags.professional) {
      h += '<div class="certainty-medium"><p>Vendeur présumé particulier ' + addTerm("vente entre particuliers") + ". Garantie des vices cachés du Code civil. Charge de la preuve plus lourde pour l’acquéreur.</p></div>";
    } else {
      h += '<div class="certainty-low"><p>Statut du vendeur incertain ' + addTerm("ambiguïté statut vendeur") + ". Qualifier d’abord le vendeur avant action.</p></div>";
    }

    if (matches.length) {
      h += "<p>La probabilité d’un " + addTerm("défaut de conception", "vice caché notoire") + " renforce la non-conformité initiale du bien.</p>";
    }

    if (flags.diesel) {
      h += "<p>La motorisation diesel rend particulièrement pertinents les textes sur la conformité antipollution, la tromperie en cas de dispositif illicite ou de dissimulation, et la sécurité des produits " + addTerm("conformité antipollution", "defeat device", "L.213-1 C.consom.") + ".</p>";
    }

    if (flags.electricLike) {
      h += "<p>La motorisation électrifiée rend particulièrement pertinents les axes batterie, autonomie, charge, logiciel, sécurité incendie et conformité du bien comportant des éléments numériques " + addTerm("bien non conforme", "sécurité batterie", "logiciel", "L.217-4 C.consom.") + ".</p>";
    }

    return h;
  }

  function secRisques(flags, matches) {
    var h = "<p><strong>Objet :</strong> risques et responsabilités " + addTerm("risques encourus", "responsabilité contractuelle", "responsabilité délictuelle") + ".</p>";

    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += '<div class="rappel-critical"><h4>⚠️ Responsabilité aggravée</h4><ul>';
      h += "<li>Professionnel : faute lourde ou dolosive possible " + addTerm("faute lourde", "faute dolosive") + ".</li>";
      h += "<li>Particulier : mauvaise foi si défaut connu ou dissimulé " + addTerm("mauvaise foi", "réticence dolosive") + ".</li>";
      h += "<li>Pénal possible en cas d’accident " + addTerm("homicide involontaire", "blessures involontaires", "mise en danger") + ".</li>";
      h += "<li>Constructeur : produits défectueux " + addTerm("article 1245 C.civ.") + ".</li>";
      h += "</ul></div>";
    }

    h += "<h4>A. Si professionnel</h4><ul>";
    h += "<li>" + addTerm("garantie légale de conformité", "L.217-4 C.consom.") + " : réparation, remplacement, réduction, résolution.</li>";
    h += "<li>" + addTerm("présomption d’antériorité") + " pendant 12 mois, 24 mois depuis 2022.</li>";
    h += "<li>" + addTerm("responsabilité contractuelle", "1231-1 C.civ.") + " : dommages-intérêts.</li>";
    h += "<li>" + addTerm("tromperie", "L.213-1 C.consom.") + " si dissimulation.</li>";
    h += "<li>" + addTerm("DGCCRF", "rappel conso", "sanctions administratives") + ".</li>";
    h += "</ul>";

    h += "<h4>B. Si particulier</h4><ul>";
    h += "<li>" + addTerm("garantie des vices cachés", "1641 C.civ.") + ".</li>";
    h += "<li>" + addTerm("action rédhibitoire") + " ou " + addTerm("action estimatoire") + ".</li>";
    h += "<li>" + addTerm("charge de la preuve") + " sur l’acquéreur.</li>";
    h += "<li>" + addTerm("clause vendu en l’état") + " inopposable en cas de mauvaise foi.</li>";
    h += "</ul>";

    if (flags.diesel) {
      h += "<h4>C. Risque diesel / antipollution</h4><ul>";
      h += "<li>Non-conformité aux normes de dépollution " + addTerm("conformité environnementale") + ".</li>";
      h += "<li>Tromperie si dispositif illicite ou information dissimulée " + addTerm("defeat device", "L.213-1 C.consom.") + ".</li>";
      h += "<li>Rappel / campagne technique " + addTerm("DGCCRF", "KBA", "NHTSA") + ".</li>";
      h += "</ul>";
    }

    if (flags.electricLike) {
      h += "<h4>D. Risque électrifié / batterie / logiciel</h4><ul>";
      h += "<li>Risque thermique, incendie, isolation HV " + addTerm("sécurité L.423-1 C.consom.") + ".</li>";
      h += "<li>Autonomie non conforme, charge défaillante, bug logiciel " + addTerm("L.217-4 C.consom.") + ".</li>";
      h += "<li>Responsabilité constructeur produits défectueux " + addTerm("1245 C.civ.") + ".</li>";
      h += "</ul>";
    }

    return h;
  }

  function secCriteres(flags, matches, vData) {
    var km = parseKm(vData.kilometrage);
    var best = matches[0];

    var h = "<p><strong>Objet :</strong> critères cumulatifs adaptés à l’usure, à la vétusté et à la motorisation " + addTerm("critères cumulatifs", "usure normale", "vétusté", "motorisation") + ".</p>";

    h += "<h4>A. Antériorité " + addTerm("antériorité") + "</h4>";
    if (best && best.confiance === "Haute") {
      h += '<p class="certainty-high">Défaut de série/conception/software : antériorité fortement présumée, souvent indépendante du kilométrage.</p>';
    } else if (best && best.confiance === "Moyenne") {
      h += '<p class="certainty-medium">Antériorité probable, mais km élevé (' + km.toLocaleString("fr-FR") + ") : expertise pour écarter l’usure.</p>";
    } else if (best) {
      h += '<p class="certainty-low">Antériorité difficile à établir sans expertise : km très élevé, usure normale plausible.</p>';
    } else {
      h += '<p class="verification-needed">Antériorité à prouver par expertise contradictoire.</p>';
    }

    if (flags.electricLike) {
      h += '<p class="certainty-high">Pour une motorisation électrifiée, les défauts BMS, logiciel, charge, batterie 12V, DC-DC ou autonomie sont souvent antérieurs et peu dépendants du kilométrage thermique.</p>';
    }

    if (flags.diesel) {
      h += '<p class="certainty-medium">Pour une motorisation diesel, distinguer l’encrassement d’usage (trajets courts, entretien) d’un défaut de conception, de logiciel ou de dépollution.</p>';
    }

    h += "<h4>B. Caractère caché " + addTerm("caractère caché") + "</h4>";
    if (best && best.wearFactor >= 0.8) {
      h += '<p class="certainty-high">Défaut non apparent lors d’un examen visuel standard et d’un essai court.</p>';
    } else if (best) {
      h += '<p class="certainty-medium">Caractère caché soutenable, mais dépend de la diligence de l’acheteur et de la visibilité du symptôme.</p>';
    } else {
      h += "<p>Caractère caché à apprécier concrètement.</p>";
    }

    h += "<h4>C. Gravité " + addTerm("gravité") + "</h4>";
    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += '<p class="certainty-high">Gravité élevée : sécurité, casse moteur, incendie, immobilisation, coût disproportionné.</p>';
    } else if (matches.length) {
      h += '<p class="certainty-medium">Gravité à mesurer par rapport au coût de réparation et à la valeur du véhicule.</p>';
    } else {
      h += "<p>Gravité à évaluer par devis et usage normal du véhicule.</p>";
    }

    h += '<div class="verification-needed">Réunion des critères à confirmer par expertise ' + addTerm("confirmation expertise") + ".</div>";
    return h;
  }

  function secGaranties(flags, matches) {
    var h = "<p><strong>Objet :</strong> régimes de garantie et croisement juridique local " + addTerm("régimes de garantie", "cumul des garanties") + ".</p>";

    if (flags.professional) {
      h += "<h4>Professionnel</h4><ul>";
      h += "<li>" + addTerm("garantie légale de conformité", "L.217-4 et s. C.consom.") + "</li>";
      h += "<li>" + addTerm("garantie des vices cachés", "1641 C.civ.") + " cumulable</li>";
      h += "<li>" + addTerm("responsabilité contractuelle", "1231-1 C.civ.") + "</li>";
      h += "<li>" + addTerm("tromperie", "L.213-1 C.consom.") + "</li>";
      h += "<li>" + addTerm("pratique commerciale trompeuse", "L.121-2 C.consom.") + "</li>";
      h += "</ul>";
    } else {
      h += "<h4>Particulier</h4><ul>";
      h += "<li>" + addTerm("garantie des vices cachés", "1641 à 1649 C.civ.") + "</li>";
      h += "<li>" + addTerm("action rédhibitoire") + " / " + addTerm("action estimatoire") + "</li>";
      h += "<li>" + addTerm("dol", "1137 C.civ.") + " si dissimulation</li>";
      h += "<li>" + addTerm("obligation d’information précontractuelle", "1112-1 C.civ.") + "</li>";
      h += "</ul>";
    }

    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += "<h4>Constructeur / sécurité</h4><ul>";
      h += "<li>" + addTerm("produits défectueux", "1245 C.civ.") + "</li>";
      h += "<li>" + addTerm("défaut de sécurité", "L.423-1 C.consom.") + "</li>";
      h += "<li>" + addTerm("rappel obligatoire", "DGCCRF", "NHTSA", "KBA") + "</li>";
      h += "</ul>";
    }

    if (flags.diesel) {
      h += "<h4>Motorisation diesel</h4><ul>";
      h += "<li>" + addTerm("conformité antipollution", "L.217-4 C.consom.") + "</li>";
      h += "<li>" + addTerm("tromperie / defeat device", "L.213-1 C.consom.") + " si logiciel ou dispositif illicite</li>";
      h += "<li>" + addTerm("rappel / campagne technique", "DGCCRF", "KBA") + "</li>";
      h += "</ul>";
    }

    if (flags.electricLike) {
      h += "<h4>Motorisation électrifiée</h4><ul>";
      h += "<li>" + addTerm("sécurité batterie / charge", "L.423-1 C.consom.") + "</li>";
      h += "<li>" + addTerm("conformité logiciel / autonomie", "L.217-4 C.consom.") + "</li>";
      h += "<li>" + addTerm("produits défectueux", "1245 C.civ.") + "</li>";
      h += "</ul>";
    }

    return h;
  }

  function secDocs(flags, matches) {
    var h = "<p><strong>Objet :</strong> preuve documentaire " + addTerm("preuve documentaire", "dossier probatoire") + ".</p><ul>";
    h += "<li>Facture : " + (flags.invoice ? "présente" : "à récupérer") + "</li>";
    h += "<li>Certificat de cession : à conserver</li>";
    h += "<li>Carte grise : vérifier cohérence kilométrage et motorisation</li>";
    h += "<li>Contrôle technique : " + (flags.controlTech ? "présent" : "à récupérer") + "</li>";
    h += "<li>Historique entretien / carnet / factures garage</li>";
    h += "<li>Preuve des rappels effectués via VIN</li>";
    h += "<li>Devis réparation (minimum 2)</li>";
    h += "<li>Lecture OBD / codes défaut DTC</li>";
    h += "<li>Rapport auto-diagnostic / fiches expert corrélées</li>";
    h += "<li>Document motorisation : énergie, puissance, code moteur, boîte, logiciel</li>";
    h += "<li>Photos : moisiure, eau, corrosion, voyants, niveaux, batterie, charge</li>";
    if (matches.length) {
      h += "<li>Vérification VIN sur sites constructeur, DGCCRF, rappel.conso, NHTSA, KBA, SafetyGate, auto-diagnostic</li>";
    }
    h += "</ul>";
    h += '<div class="verification-needed">Sans facture, CT ou historique, la preuve de l’antériorité sera fragilisée ' + addTerm("insuffisance probatoire") + ".</div>";
    return h;
  }

  function secJuri(matches, flags) {
    var h = "<p><strong>Objet :</strong> textes et jurisprudence " + addTerm("jurisprudence", "doctrine") + ".</p>";
    h += "<h4>Textes</h4><ul>";
    h += "<li>1641 à 1649 C.civ. — vices cachés</li>";
    h += "<li>1130 à 1144 C.civ. — vices du consentement</li>";
    h += "<li>1112-1 C.civ. — information précontractuelle</li>";
    h += "<li>1231-1 C.civ. — responsabilité contractuelle</li>";
    h += "<li>1240, 1241 C.civ. — responsabilité délictuelle</li>";
    h += "<li>1245 et s. C.civ. — produits défectueux</li>";
    h += "<li>L.217-3 à L.217-20 C.consom. — conformité</li>";
    h += "<li>L.213-1 C.consom. — tromperie</li>";
    h += "<li>L.121-2 C.consom. — pratique commerciale trompeuse</li>";
    h += "<li>L.423-1 C.consom. — sécurité des produits</li>";
    h += "<li>221-6, 222-19, 223-1, 313-1, 441-1 C.pénal</li>";
    h += "</ul>";

    h += "<h4>Jurisprudence / références</h4><ul>";
    h += "<li>Cass. civ. 1ère, 3 mai 2006 — caractère caché</li>";
    h += "<li>Cass. civ. 1ère, 12 juill. 2018 — vérification des rappels par pro</li>";
    h += "<li>Cass. civ. 1ère, 27 févr. 2019 — clause vendu en l’état et mauvaise foi</li>";
    h += "<li>CJUE, 5 avril 2023, C-277/22 — defeat device et conformité</li>";
    h += "<li>TGI Paris, 15 janv. 2020 — Renault 1.5 dCi bielles</li>";
    h += "<li>NHTSA / KBA / DGCCRF / auto-diagnostic — rappels sécurité, batteries, ADAS, incendies, DTC, motorisation</li>";
    h += "</ul>";

    if (flags.diesel) {
      h += "<h4>Références diesel</h4><ul>";
      h += "<li>Conformité antipollution L.217-4 C.consom.</li>";
      h += "<li>Tromperie L.213-1 C.consom. si dispositif illicite ou dissimulation</li>";
      h += "<li>Rappels diesel DGCCRF / KBA / SafetyGate</li>";
      h += "</ul>";
    }

    if (flags.electricLike) {
      h += "<h4>Références électrifiées</h4><ul>";
      h += "<li>Sécurité batterie / charge L.423-1 C.consom.</li>";
      h += "<li>Produits défectueux 1245 C.civ.</li>";
      h += "<li>Conformité logiciel / autonomie L.217-4 C.consom.</li>";
      h += "<li>Rappels EV/hybride NHTSA / DGCCRF / KBA</li>";
      h += "</ul>";
    }

    if (matches.length) {
      h += "<h4>Références spécifiques aux défauts détectés</h4><ul>";
      matches.forEach(function (m) {
        h += "<li><strong>" + esc(m.moteur) + " :</strong> " + esc(m.rappelRef) + (m.sourceUrl ? " — source : " + esc(m.sourceUrl) : "") + "</li>";
      });
      h += "</ul>";
    }

    return h;
  }

  function secPrejudice(flags, matches) {
    var h = "<p><strong>Objet :</strong> préjudice " + addTerm("évaluation du préjudice", "réparation intégrale") + ".</p>";
    h += "<h4>Préjudices matériels</h4><ul>";
    h += "<li>Coût réparations / devis</li>";
    h += "<li>Remboursement prix si résolution</li>";
    h += "<li>Moins-value</li>";
    h += "<li>Location véhicule remplacement</li>";
    h += "<li>Frais expertise / avocat / dépens</li>";
    h += "<li>Manque à gagner si usage professionnel</li>";
    h += "</ul>";

    h += "<h4>Préjudices moraux / corporels</h4><ul>";
    h += "<li>Préjudice d’anxiété si dangerosité</li>";
    h += "<li>Trouble dans les conditions d’existence</li>";
    h += "<li>Souffrances endurées / préjudice esthétique / DFT / DFP si accident</li>";
    h += "</ul>";

    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += '<div class="rappel-critical"><strong>Angle sapeur-pompier / sécurité :</strong> la peur de conduire un véhicule dangereux peut justifier un préjudice moral même sans accident ' + addTerm("préjudice d’anxiété") + ".</div>";
    }

    if (flags.electricLike) {
      h += '<div class="rappel-info"><strong>Angle électrifié :</strong> perte d’autonomie réelle, impossibilité de recharge, immobilisation ou risque batterie peut aggraver le préjudice d’usage ' + addTerm("préjudice d’agrément", "trouble de jouissance") + ".</div>";
    }

    return h;
  }

  function secStrategie(flags, matches, objective) {
    var h = "<p><strong>Objet :</strong> stratégie " + addTerm("stratégie contentieuse", "MARD") + ".</p>";

    h += "<h4>Phase 1 — consolidation probatoire</h4><ol>";
    h += "<li>Expertise amiable contradictoire</li>";
    h += "<li>Devis réparation</li>";
    h += "<li>Lecture OBD / DTC</li>";
    h += "<li>Export / impression des fiches auto-diagnostic corrélées</li>";
    h += "<li>Vérification VIN / rappels / motorisation</li>";
    h += "<li>Photos et constats</li>";
    h += "</ol>";

    h += "<h4>Phase 2 — mise en demeure</h4><ol>";
    h += "<li>LRAR au vendeur</li>";
    if (matches.length) {
      h += "<li>Invoquer le défaut de série documenté " + addTerm("défaut de série", "présomption de connaissance") + "</li>";
    }
    h += "<li>Joindre annexes auto-diagnostic / DTC / motorisation / devis / photos</li>";
    h += "<li>Délai 15 jours</li>";
    h += "</ol>";

    h += "<h4>Phase 3 — résolution amiable</h4><ol>";
    h += "<li>Conciliation</li>";
    if (flags.professional) h += "<li>Médiation de la consommation</li>";
    h += "<li>Transaction écrite si accord</li>";
    h += "</ol>";

    h += "<h4>Phase 4 — judiciaire</h4><ol>";
    h += "<li>Assignation TJ / tribunal de proximité</li>";
    h += "<li>Demande d’expertise judiciaire si nécessaire</li>";
    h += "<li>Référé si urgence / danger</li>";
    if (matches.length && matches.some(function (m) { return m.severite === "critique"; })) {
      h += "<li>Signalement DGCCRF / préfet / NHTSA / KBA si danger collectif</li>";
    }
    h += "</ol>";

    if (objective) {
      h += "<p><strong>Objectif déclaré :</strong> " + esc(objective) + "</p>";
    }

    return h;
  }

  function secVerif(matches, flags) {
    var h = "<p><strong>Objet :</strong> vérifications et recherche approfondie " + addTerm("vérifications complémentaires") + ".</p>";

    h += "<ul>";
    h += "<li>Vérifier VIN sur site constructeur</li>";
    h += "<li>Consulter auto-diagnostic et ses fiches / DTC / motorisations</li>";
    h += "<li>Consulter rappel.conso.gouv.fr</li>";
    h += "<li>Consulter NHTSA si véhicule importé / groupe international</li>";
    h += "<li>Consulter KBA pour rappels allemands</li>";
    h += "<li>Consulter SafetyGate / bases européennes</li>";
    h += "<li>Rechercher TSB / notes techniques atelier</li>";
    h += "<li>Consulter forums spécialisés et retours propriétaires</li>";
    h += "<li>Vérifier historique entretien et rappels effectués</li>";
    h += "<li>Faire lire les codes défaut OBD</li>";
    if (flags.waterLeak) {
      h += "<li>Inspecter baie de pare-brise, cavillon, évacuations, boîtier fusibles, connecteurs</li>";
    }
    if (flags.electricLike) {
      h += "<li>Contrôler SOH batterie, BMS, charge AC/DC, température, isolation HV, batterie 12V</li>";
    }
    if (flags.diesel) {
      h += "<li>Contrôler EGR, FAP/DPF, AdBlue, NOx, régénération, logiciel moteur</li>";
    }
    h += "</ul>";

    var links = researchLinks(
      vehicleData.marque,
      vehicleData.modele,
      matches[0] ? matches[0].moteur : vehicleData.engine,
      matches[0] ? matches[0].symptomes : [],
      vehicleData.engineType
    );

    h += "<h4>Pistes de recherche externe à ouvrir manuellement</h4><ul>";
    links.forEach(function (l) {
      h += '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + "</a></li>";
    });
    h += "</ul>";

    h += '<div class="verification-needed">Ces liens ne sont pas appelés automatiquement pendant l’analyse. Ils servent à confirmer la notoriété du défaut avant conclusion finale.</div>';

    return h;
  }

  function secVoies(flags, matches) {
    var h = "<p><strong>Objet :</strong> voies d’action " + addTerm("voies d’action") + ".</p><ul>";
    h += "<li>Action civile en garantie des vices cachés</li>";
    if (flags.professional) {
      h += "<li>Garantie légale de conformité</li>";
      h += "<li>Signalement DGCCRF / rappel.conso</li>";
      h += "<li>Médiation de la consommation</li>";
    }
    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += "<li>Action contre constructeur : produits défectueux</li>";
      h += "<li>Plainte pénale si danger dissimulé</li>";
      h += "<li>Action collective si défaut massif</li>";
    }
    if (flags.diesel) {
      h += "<li>Action antipollution / tromperie si dispositif illicite ou dissimulation</li>";
    }
    if (flags.electricLike) {
      h += "<li>Action sécurité batterie / charge / logiciel / autonomie</li>";
    }
    h += "<li>Expertise judiciaire</li>";
    h += "</ul>";
    return h;
  }

  function secConclu(objective, matches, flags, vData) {
    var high = matches.some(function (m) { return m.confiance === "Haute"; });
    var critical = matches.some(function (m) { return m.severite === "critique"; });
    var auto = matches.some(function (m) { return m.source === "auto-diagnostic"; });

    var h = "<p><strong>Objet :</strong> conclusion prudente " + addTerm("synthèse") + ".</p>";

    h += "<p>";
    if (high && critical && auto) {
      h += "Le croisement local technique/juridique/motorisation/auto-diagnostic oriente fortement vers un défaut de conception, de montage, de logiciel ou de sécurité, antérieur, caché et grave. L’appui auto-diagnostic renforce la démonstration du caractère documenté et non isolé du désordre.";
    } else if (high && critical) {
      h += "Le croisement local technique/juridique oriente fortement vers un défaut de conception, de montage, de logiciel ou de sécurité, antérieur, caché et grave.";
    } else if (matches.length) {
      h += "Un défaut connu est probable, mais le kilométrage, la motorisation ou la nature du symptôme impose une expertise pour écarter l’usure normale.";
    } else {
      h += "Aucun défaut de série identifié localement. Le problème peut être individuel : diagnostic et expertise nécessaires.";
    }
    h += "</p>";

    if (flags.engineType) {
      h += "<p><strong>Motorisation :</strong> le type " + esc(flags.engineType) + " est intégré comme critère d’analyse technique et juridique.</p>";
    }

    h += "<p><strong>Recommandation opérationnelle :</strong> ne pas effectuer de réparation destructrice avant constat/expertise. Conserver le véhicule en l’état si possible, photographier, obtenir devis, exporter les fiches auto-diagnostic corrélées, puis mise en demeure LRAR.</p>";

    if (flags.professional) {
      h += "<p><strong>Si vendeur professionnel :</strong> privilégier garantie légale de conformité + signalement DGCCRF si danger.</p>";
    } else {
      h += "<p><strong>Si vendeur particulier :</strong> privilégier expertise amiable puis action en vices cachés.</p>";
    }

    h += '<div class="certainty-low"><strong>Avertissement :</strong> document d’aide à la rédaction. Ne constitue pas un avis juridique définitif.</div>';

    return h;
  }

  function secLexique() {
    var terms = Array.from(termesMobilises).sort();
    var h = "<p><strong>Termes mobilisés :</strong> " + terms.length + '</p><div class="lexique-section">';
    terms.forEach(function (t) {
      h += '<div class="lexique-item"><strong>' + esc(t) + "</strong></div>";
    });
    h += "</div>";
    return h;
  }

  /* =========================================================
     ADMIN PANEL
     ========================================================= */
  function updateAdminStats() {
    var brands = {};
    allDefects().forEach(function (d) {
      if (d.b && d.b !== "Toutes marques") brands[d.b] = true;
    });

    var cat = engineCatalog();
    var engineCount = 0;
    Object.keys(cat).forEach(function (b) {
      Object.keys(cat[b]).forEach(function (m) {
        engineCount += cat[b][m].length;
      });
    });

    var statEntries = q("#statEntries");
    var statBrands = q("#statBrands");
    var statEngines = q("#statEngines");
    var statAutoEntries = q("#statAutoEntries");
    var statAutoSync = q("#statAutoSync");
    var statSync = q("#statSync");

    if (statEntries) statEntries.textContent = allDefects().length;
    if (statBrands) statBrands.textContent = Object.keys(brands).length;
    if (statEngines) statEngines.textContent = engineCount;
    if (statAutoEntries) statAutoEntries.textContent = autoDb.length;

    if (statAutoSync) statAutoSync.textContent = autoLastSync ? new Date(autoLastSync).toLocaleString("fr-FR") : "Jamais";

    var last = loadWithMigration(KEYS.LAST_UPDATE, OLD_KEYS.LAST_UPDATE, 0);
    if (statSync) statSync.textContent = last ? new Date(last).toLocaleString("fr-FR") : "Jamais";
  }

  function renderRequests() {
    var box = q("#pendingRequests");
    if (!box) return;

    var all = getRequests().slice().sort(function (a, b) {
      return (b.ts || 0) - (a.ts || 0);
    });

    var pending = all.filter(function (r) {
      return r.status === "pending";
    });

    var processed = all.filter(function (r) {
      return r.status !== "pending";
    }).slice(0, 30);

    var count = q("#pendingCount");
    if (count) count.textContent = pending.length;

    if (!all.length) {
      box.innerHTML = '<p class="empty-state">Aucune demande.</p>';
      return;
    }

    var html = "";

    html += "<h4>À traiter (" + pending.length + ")</h4>";

    if (!pending.length) {
      html += '<p class="empty-state">Aucune demande en attente.</p>';
    } else {
      html += pending.map(function (r) {
        return '<div class="card pending">' +
          "<strong>" + esc(r.name) + "</strong> <small>" + esc(r.email) + "</small>" +
          "<p>" + esc(r.reason) + "</p>" +
          "<small>" + esc(r.date || "") + " • source : " + esc(r.source || "locale") + "</small>" +
          '<div class="actions">' +
          '<button class="btn-ok" data-action="approve" data-id="' + esc(r.id) + '" type="button">Accepter</button>' +
          '<button class="btn-no" data-action="refuse" data-id="' + esc(r.id) + '" type="button">Refuser</button>' +
          "</div></div>";
      }).join("");
    }

    if (processed.length) {
      html += "<h4>Dernières demandes traitées</h4>";

      html += processed.map(function (r) {
        var cls = r.status === "approved" ? "approved" : "refused";
        var label = r.status === "approved" ? "Acceptée" : "Refusée";
        var actions = "";

        if (r.status === "approved") {
          actions =
            '<button class="btn-ok" data-action="share-grant" data-email="' + esc(r.email) + '" data-name="' + esc(r.name) + '" type="button">' +
            "📤 Envoyer l’accès au tiers" +
            "</button>";
        }

        return '<div class="card ' + cls + '">' +
          "<strong>" + esc(r.name) + "</strong> <small>" + esc(r.email) + "</small>" +
          "<p>" + esc(r.reason) + "</p>" +
          "<small>Statut : " + esc(label) + " • " + esc(r.processedDate || r.date || "") + "</small>" +
          (actions ? '<div class="actions">' + actions + "</div>" : "") +
          "</div>";
      }).join("");
    }

    box.innerHTML = html;
  }

  function renderUsers() {
    var box = q("#authorizedUsers");
    if (!box) return;

    var users = getUsers().filter(function (u) { return u.role !== "admin"; });

    if (!users.length) {
      box.innerHTML = '<p class="empty-state">Aucun tiers.</p>';
      return;
    }

    box.innerHTML = users.map(function (u) {
      var action = u.status === "approved"
        ? '<button class="btn-warn" data-action="revoke" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '" type="button">Révoquer</button>'
        : '<button class="btn-ok" data-action="restore" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '" type="button">Rétablir</button>';

      return '<div class="card ' + esc(u.status) + '">' +
        "<strong>" + esc(u.name) + "</strong> <small>" + esc(u.email) + " • " + esc(u.status) + "</small>" +
        '<div class="actions">' + action + "</div>" +
        "</div>";
    }).join("");
  }

  function renderAdmin() {
    renderRequests();
    renderUsers();
    renderAutoConfig();
    updateAdminStats();
  }

  /* =========================================================
     PDF UPLOAD / EXPORT
     ========================================================= */
  function readFileAsArrayBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function pdfStatus(msg, type) {
    var el = q("#pdfStatus");
    if (el) {
      el.textContent = msg;
      el.className = "status " + type;
    } else {
      toast(msg, type);
    }
  }

  function buildPrintHtml() {
    var body = "";
    if (analysisData && analysisData.sections) {
      analysisData.sections.forEach(function (pair) {
        body += "<h2>" + pair[0] + "</h2>" + pair[1];
      });
    }

    return '<!DOCTYPE html>' +
      '<html lang="fr">' +
      '<head>' +
      '<meta charset="UTF-8" />' +
      '<title>Rapport Expert Auto</title>' +
      '<style>' +
      'body { font-family: Arial, sans-serif; padding: 24px; color: #111; }' +
      'h1 { text-align: center; }' +
      'h2 { margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 6px; }' +
      '.termes-juridiques { background: #eee; padding: 2px 6px; border-radius: 4px; font-style: italic; }' +
      '.rappel-critical, .certainty-low { border-left: 4px solid #c00; background: #fff5f5; padding: 10px; margin: 10px 0; }' +
      '.rappel-info, .certainty-medium, .verification-needed { border-left: 4px solid #06c; background: #f5fbff; padding: 10px; margin: 10px 0; }' +
      '.certainty-high { border-left: 4px solid #090; background: #f5fff7; padding: 10px; margin: 10px 0; }' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<h1>Rapport d’analyse expert auto</h1>' +
      '<p><strong>Date :</strong> ' + esc(analysisData.date || "") + '</p>' +
      '<p><strong>Véhicule :</strong> ' + esc(vehicleData.marque || "") + ' ' + esc(vehicleData.modele || "") + ' ' + esc(vehicleData.annee || "") + '</p>' +
      '<p><strong>Motorisation :</strong> ' + esc(vehicleData.engine || "") + ' — ' + esc(vehicleData.engineType || "") + '</p>' +
      '<p><strong>Kilométrage :</strong> ' + esc(vehicleData.kilometrage || "") + ' km</p>' +
      body +
      '</body>' +
      '</html>';
  }

  function downloadHtmlReport() {
    var html = buildPrintHtml();
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rapport-expert-auto.html";
    a.click();
    toast("Rapport HTML téléchargé. Ouvrez-le et imprimez en PDF.", "info");
  }

  function printReportFallback() {
    var win = window.open("", "_blank");
    if (!win) {
      downloadHtmlReport();
      return;
    }

    win.document.open();
    win.document.write(buildPrintHtml());
    win.document.close();

    setTimeout(function () {
      try {
        win.focus();
        win.print();
      } catch (e) {
        downloadHtmlReport();
      }
    }, 350);
  }

  function generatePdfWithJsPdf() {
    return ensureJsPdf().then(function (jsPDF) {
      var doc = new jsPDF();
      var y = 20;

      doc.setFontSize(16);
      doc.text("RAPPORT D'ANALYSE EXPERT AUTO", 105, y, { align: "center" });
      y += 10;

      doc.setFontSize(10);
      doc.text("Date : " + analysisData.date, 20, y);
      y += 6;

      doc.text("Véhicule : " + (vehicleData.marque || "") + " " + (vehicleData.modele || "") + " " + (vehicleData.annee || ""), 20, y);
      y += 6;

      doc.text("Motorisation : " + (vehicleData.engine || "") + " — " + (vehicleData.engineType || ""), 20, y);
      y += 6;

      doc.text("Kilométrage : " + (vehicleData.kilometrage || "") + " km", 20, y);
      y += 10;

      analysisData.sections.forEach(function (pair) {
        var title = pair[0];
        var content = pair[1];

        if (y > 265) {
          doc.addPage();
          y = 20;
        }

        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        var titleLines = doc.splitTextToSize(title, 170);
        doc.text(titleLines, 20, y);
        y += titleLines.length * 5 + 2;

        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        var plain = stripTags(content);
        var lines = doc.splitTextToSize(plain, 170);

        lines.forEach(function (line) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += 4;
        });

        y += 5;
      });

      doc.save("analyse-experte-" + new Date().toISOString().slice(0, 10) + ".pdf");
      toast("PDF généré.", "success");
    });
  }

  /* =========================================================
     SERVICE WORKER
     ========================================================= */
  function registerServiceWorker() {
    try {
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker
          .register("./sw.js")
          .then(function (reg) {
            swRegistration = reg;
            return navigator.serviceWorker.ready;
          })
          .then(function (reg) {
            swRegistration = reg;
            console.log("[AR-EXPERT] Service Worker prêt.");
          })
          .catch(function (err) {
            console.warn("[AR-EXPERT] Service Worker non enregistré:", err);
          });
      }
    } catch (e) {
      console.warn("[AR-EXPERT] Enregistrement SW impossible:", e);
    }
  }

  function clearCacheAndReload() {
    var unload = ("serviceWorker" in navigator)
      ? navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) {
            return r.unregister().catch(function () {});
          }));
        })
      : Promise.resolve();

    var delCache = ("caches" in window)
      ? caches.keys().then(function (names) {
          return Promise.all(names.map(function (n) {
            return caches.delete(n).catch(function () {});
          }));
        })
      : Promise.resolve();

    Promise.all([unload.catch(function () {}), delCache.catch(function () {})])
      .then(function () {
        location.reload(true);
      })
      .catch(function () {
        location.reload(true);
      });
  }

  /* =========================================================
     EVENEMENTS UI
     ========================================================= */
  qa(".auth-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      qa(".auth-tab").forEach(function (b) { b.classList.remove("active"); });
      qa(".auth-pane").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");

      var pane = q("#" + btn.dataset.authTab + "Pane");
      if (pane) pane.classList.add("active");

      authMessage("", "");
    });
  });

  on("#adminLoginBtn", "click", function () {
    var pwdEl = q("#adminPassword");
    var rememberEl = q("#rememberAdminPwd");
    var pwd = pwdEl ? pwdEl.value : "";
    var remember = rememberEl ? rememberEl.checked : false;

    if (!pwd) {
      authMessage("Mot de passe requis.", "error");
      return;
    }

    verifyAdminPassword(pwd).then(function (ok) {
      if (!ok) {
        authMessage("Mot de passe incorrect.", "error");
        return;
      }

      if (remember) {
        sha256(pwd).then(function (h) {
          save(KEYS.ADMIN_PWD_HASH, h);
          refreshSavedPasswordButton();
        });
      } else {
        del(KEYS.ADMIN_PWD_HASH);
        refreshSavedPasswordButton();
      }

      setSession({
        id: "admin",
        name: "Administrateur",
        email: "admin@local",
        role: "admin",
        status: "approved"
      });

      showApp();
      toast("Connexion admin réussie.", "success");
      if (pwdEl) pwdEl.value = "";
    }).catch(function () {
      if (pwd === CONFIG.adminPassword) {
        setSession({ id: "admin", name: "Administrateur", email: "admin@local", role: "admin", status: "approved" });
        showApp();
        toast("Connexion admin réussie (mode local).", "success");
        if (pwdEl) pwdEl.value = "";
      } else {
        authMessage("Vérification impossible. Réessayez.", "error");
      }
    });
  });

  on("#useSavedPwdBtn", "click", function () {
    var saved = loadWithMigration(KEYS.ADMIN_PWD_HASH, OLD_KEYS.ADMIN_PWD_HASH, null);
    if (!saved) {
      authMessage("Aucun mot de passe enregistré.", "warning");
      return;
    }

    loginAdminFromHash(saved).then(function (ok) {
      if (!ok) {
        authMessage("Mot de passe enregistré invalide.", "error");
        del(KEYS.ADMIN_PWD_HASH);
        refreshSavedPasswordButton();
        return;
      }

      setSession({ id: "admin", name: "Administrateur", email: "admin@local", role: "admin", status: "approved" });
      showApp();
      toast("Connexion admin via mot de passe enregistré.", "success");
    });
  });

  on("#requestBtn", "click", function () {
    var nameEl = q("#reqName");
    var emailEl = q("#reqEmail");
    var reasonEl = q("#reqReason");

    var name = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";
    var reason = reasonEl ? reasonEl.value.trim() : "";

    if (!name || !email || !reason) {
      authMessage("Nom, email et motif sont requis.", "error");
      return;
    }

    var requests = getRequests();
    var emailKey = userEmailKey(email);

    var alreadyPending = requests.find(function (r) {
      return r.emailNorm === emailKey && r.status === "pending";
    });

    if (alreadyPending) {
      authMessage("Demande déjà en attente.", "warning");
      return;
    }

    var existingApproved = findApprovedUser(name, email);
    if (existingApproved) {
      authMessage("Accès déjà accordé. Utilisez Connexion tiers.", "success");
      return;
    }

    var req = migrateRequest({
      id: uid(),
      name: name,
      email: email,
      reason: reason,
      status: "pending",
      date: new Date().toLocaleString("fr-FR"),
      ts: Date.now(),
      source: "formulaire-local"
    });

    requests.push(req);
    saveRequests(requests);

    lastSharedAccessRequest = req;

    var shareBtn = q("#shareRequestBtn");
    if (shareBtn) shareBtn.classList.remove("hidden");

    publishAccessRequest(req);

    authMessage(
      "Demande envoyée. Si l’admin est sur le même appareil, il sera notifié. Sinon, utilisez ‘Partager la demande avec l’admin’.",
      "success"
    );

    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (reasonEl) reasonEl.value = "";
  });

  on("#shareRequestBtn", "click", function () {
    if (!lastSharedAccessRequest) {
      toast("Aucune demande à partager.", "warning");
      return;
    }

    var url = makeAccessRequestShareUrl(lastSharedAccessRequest);

    var text =
      "Demande d’accès Expert Auto\n" +
      "Nom : " + lastSharedAccessRequest.name + "\n" +
      "Email : " + lastSharedAccessRequest.email + "\n" +
      "Motif : " + lastSharedAccessRequest.reason + "\n" +
      "Lien admin : " + url;

    if (navigator.share) {
      navigator.share({
        title: "Demande d’accès Expert Auto",
        text: text,
        url: url
      }).catch(function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            toast("Lien de demande copié.", "success");
          }).catch(function () {
            toast("Copie impossible.", "error");
          });
        } else {
          toast("Partage impossible.", "warning");
        }
      });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast("Lien de demande copié.", "success");
      }).catch(function () {
        toast("Copie impossible.", "error");
      });
    } else {
      toast("Partage non supporté.", "warning");
    }
  });

  on("#thirdLoginBtn", "click", function () {
    var nameEl = q("#loginName");
    var emailEl = q("#loginEmail");

    var name = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";

    if (!email) {
      authMessage("Email requis.", "error");
      return;
    }

    var user = findApprovedUser(name, email);

    if (!user) {
      var emailKey = userEmailKey(email);
      var pending = getRequests().find(function (r) {
        return r.status === "pending" && r.emailNorm === emailKey;
      });

      if (pending) {
        authMessage(
          "Votre demande est en attente de validation admin. Nom enregistré : " + pending.name,
          "warning"
        );
        return;
      }

      authMessage(
        "Aucun accès approuvé trouvé pour cet email. Demandez l’accès puis attendez la validation admin, ou ouvrez le lien d’accès envoyé par l’admin.",
        "error"
      );
      return;
    }

    setSession(user);
    showApp();
    toast("Connexion tiers réussie.", "success");
  });

  on("#logoutBtn", "click", function () {
    clearSession();
    showLogin();
    toast("Déconnexion effectuée.", "info");
  });

  on("#clearCacheBtn", "click", function () {
    clearCacheAndReload();
  });

  on("#vehicleBrand", "input", scheduleEngineRefresh);
  on("#vehicleBrand", "change", scheduleEngineRefresh);
  on("#vehicleModel", "input", scheduleEngineRefresh);
  on("#vehicleModel", "change", scheduleEngineRefresh);
  on("#vehicleYear", "input", scheduleEngineRefresh);
  on("#vehicleYear", "change", scheduleEngineRefresh);
  on("#vehicleEngine", "change", refreshEngineOptions);

  on("#pdfUpload", "change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      pdfStatus("Format non supporté. PDF uniquement.", "error");
      return;
    }

    pdfStatus("Chargement de la bibliothèque PDF...", "success");

    ensurePdfJs()
      .then(function () {
        pdfStatus("Extraction du texte en cours...", "success");
        return readFileAsArrayBuffer(file);
      })
      .then(function (arrayBuffer) {
        return window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      })
      .then(function (pdf) {
        var fullText = "";
        var promises = [];

        for (var i = 1; i <= pdf.numPages; i++) {
          (function (pageNum) {
            promises.push(
              pdf.getPage(pageNum).then(function (page) {
                return page.getTextContent();
              }).then(function (tc) {
                fullText += tc.items.map(function (item) { return item.str; }).join(" ") + "\n\n";
              })
            );
          })(i);
        }

        return Promise.all(promises).then(function () {
          extractedText = fullText;
          var textInput = q("#textInput");
          if (textInput) textInput.value = fullText;
          pdfStatus("PDF extrait avec succès (" + pdf.numPages + " pages).", "success");
        });
      })
      .catch(function (err) {
        console.warn(err);
        pdfStatus("Extraction PDF indisponible : " + err.message + ". Saisissez le texte manuellement.", "error");
      });
  });

  on("#analyzeBtn", "click", function () {
    if (!currentUser) {
      toast("Connectez-vous.", "error");
      return;
    }

    var info = dailyInfo();
    if (!info.allowed) {
      toast("Limite de " + CONFIG.maxDailyAnalyses + " analyses/jour atteinte.", "warning");
      return;
    }

    refreshEngineOptions();

    var textEl = q("#textInput");
    var contextEl = q("#contextInfo");
    var objectiveEl = q("#objectiveInfo");
    var goalEl = q("#goalSelect");
    var sellerEl = q("#sellerType");
    var engineEl = q("#vehicleEngine");

    var text = textEl ? textEl.value.trim() : "";
    if (!text) text = extractedText.trim();

    var context = contextEl ? contextEl.value.trim() : "";
    var objective = (objectiveEl && objectiveEl.value.trim()) || (goalEl ? goalEl.value : "") || "";
    var sellerType = sellerEl ? sellerEl.value : "unknown";

    var engineOption = engineEl && engineOptionMap[engineEl.value] ? engineOptionMap[engineEl.value] : null;

    vehicleData = {
      marque: (q("#vehicleBrand") || {}).value || "",
      modele: (q("#vehicleModel") || {}).value || "",
      annee: (q("#vehicleYear") || {}).value || "",
      engine: engineOption ? engineOption.engine : "",
      engineType: engineOption ? engineOption.type : "",
      kilometrage: (q("#vehicleKilometrage") || {}).value || "",
      vin: (q("#vehicleVin") || {}).value || ""
    };

    if (!text) {
      toast("Saisissez des faits ou importez un PDF.", "warning");
      return;
    }

    termesMobilises = new Set();

    var btn = q("#analyzeBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Analyse experte + motorisation + auto-diagnostic en cours...';
    }

    setTimeout(function () {
      try {
        runAnalysis(text, context, objective, sellerType);
        incrementDaily();
        toast("Analyse générée.", "success");
      } catch (err) {
        console.error(err);
        toast("Erreur d’analyse : " + err.message, "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "🔍 Lancer l’analyse croisée technique + juridique + motorisation + auto-diagnostic";
        }
      }
    }, 700);
  });

  on("#adminPanelBtn", "click", function () {
    if (!currentUser || currentUser.role !== "admin") return;
    var panel = q("#adminPanel");
    if (panel) panel.classList.remove("hidden");
    renderAdmin();
  });

  on("#closeAdminBtn", "click", function () {
    var panel = q("#adminPanel");
    if (panel) panel.classList.add("hidden");
  });

  qa(".admin-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      qa(".admin-tab").forEach(function (b) { b.classList.remove("active"); });
      qa(".admin-pane").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      var pane = q("#" + btn.dataset.adminTab + "Pane");
      if (pane) pane.classList.add("active");
    });
  });

  on("#adminPanel", "click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;

    var action = btn.dataset.action;

    if (action === "approve" || action === "refuse") {
      var id = btn.dataset.id;
      var reqs = getRequests();
      var req = reqs.find(function (r) {
        return r.id === id;
      });

      if (!req) return;

      req.status = action === "approve" ? "approved" : "refused";
      req.processedAt = Date.now();
      req.processedDate = new Date(req.processedAt).toLocaleString("fr-FR");

      if (action === "approve") {
        var user = upsertUser({
          id: req.id,
          name: req.name,
          email: req.email,
          role: "user",
          status: "approved",
          daily: { date: todayKey(), count: 0 }
        });

        req.userId = user.key;
        notify("Accès approuvé", req.name + " (" + req.email + ")");
      }

      saveRequests(reqs);

      if (broadcast) {
        try {
          broadcast.postMessage({
            type: "access-change",
            payload: {
              email: req.email,
              status: req.status
            }
          });
        } catch (e2) {}
      }

      renderAdmin();

      toast(
        action === "approve"
          ? "Demande acceptée. Si le tiers est sur un autre appareil, envoyez-lui le lien d’accès."
          : "Demande refusée.",
        action === "approve" ? "success" : "warning"
      );
    }

    if (action === "revoke" || action === "restore") {
      var emailKey = userEmailKey(btn.dataset.email || "");
      var users = getUsers();

      var idx = users.findIndex(function (u) {
        return u.emailNorm === emailKey && u.role !== "admin";
      });

      if (idx >= 0) {
        users[idx].status = action === "revoke" ? "revoked" : "approved";
        users[idx].updatedAt = Date.now();

        saveUsers(users);

        if (broadcast) {
          try {
            broadcast.postMessage({
              type: "access-change",
              payload: {
                email: users[idx].email,
                status: users[idx].status
              }
            });
          } catch (e2) {}
        }

        renderAdmin();
        enforceTierAccess();

        toast(
          action === "revoke" ? "Accès révoqué." : "Accès rétabli.",
          action === "revoke" ? "warning" : "success"
        );
      }
    }

    if (action === "share-grant") {
      var name = btn.dataset.name || "";
      var email = btn.dataset.email || "";

      var user = findApprovedUser(name, email);

      if (!user) {
        toast("Aucun utilisateur approuvé trouvé pour cet email.", "error");
        return;
      }

      var url = makeAccessGrantUrl(user);

      var text =
        "Accès Expert Auto accordé\n" +
        "Nom : " + user.name + "\n" +
        "Email : " + user.email + "\n" +
        "Ouvrez ce lien dans l’application pour être connecté automatiquement :\n" +
        url;

      if (navigator.share) {
        navigator.share({
          title: "Accès Expert Auto",
          text: text,
          url: url
        }).catch(function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              toast("Lien d’accès copié.", "success");
            }).catch(function () {
              toast("Copie impossible.", "error");
            });
          } else {
            toast("Partage impossible.", "warning");
          }
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          toast("Lien d’accès copié.", "success");
        }).catch(function () {
          toast("Copie impossible.", "error");
        });
      } else {
        toast("Partage non supporté.", "warning");
      }
    }
  });

  on("#enableNotifBtn", "click", function () {
    askNotification().then(function (permission) {
      if (permission === "granted") {
        toast("Notifications admin activées.", "success");
      } else if (permission === "denied") {
        toast("Notifications bloquées. Autorisez-les dans Android / navigateur.", "warning");
      } else {
        toast("Permission notification : " + permission, "info");
      }
    });
  });

  on("#testNotifBtn", "click", function () {
    askNotification().then(function (permission) {
      if (permission === "granted") {
        notify(
          "Test Expert Auto",
          "La notification admin fonctionne correctement.",
          "test-" + Date.now()
        );
        toast("Notification de test envoyée.", "success");
      } else {
        toast("Notification impossible : permission = " + permission, "warning");
      }
    });
  });

  on("#refreshRequestsBtn", "click", function () {
    updateNotificationBell();
    renderAdmin();
    toast("Demandes actualisées.", "info");
  });

  on("#notifBellBtn", "click", function () {
    if (!currentUser || currentUser.role !== "admin") return;

    var panel = q("#adminPanel");
    if (panel) panel.classList.remove("hidden");

    qa(".admin-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.adminTab === "requests");
    });

    qa(".admin-pane").forEach(function (p) {
      p.classList.toggle("active", p.id === "requestsPane");
    });

    renderAdmin();
  });

  on("#saveAutoCfgBtn", "click", function () {
    saveAutoConfigFromUi();
  });

  on("#syncAutoBtn", "click", function () {
    saveAutoConfigFromUi();
    syncAutoDiagnostic(true).then(function () {
      return fetchEngineCatalogs(true);
    });
  });

  on("#loadEngineCatalogBtn", "click", function () {
    fetchEngineCatalogs(true);
  });

  on("#forceUpdateBtn", "click", function () {
    fetchUpdate(true);
  });

  on("#exportDataBtn", "click", function () {
    var data = {
      exportedAt: new Date().toISOString(),
      users: getUsers(),
      requests: getRequests(),
      defects: techUpdates,
      autoDefects: autoDb,
      engineExtra: engineExtra,
      autoConfig: autoConfig
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aide-redactionnelle-expert-data-v15.json";
    a.click();
    toast("Données exportées.", "success");
  });

  on("#importDataBtn", "click", function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);

          if (data.users) saveUsers(data.users);
          if (data.requests) saveRequests(data.requests);
          if (data.autoConfig) {
            autoConfig = Object.assign({}, autoConfig, data.autoConfig);
            save(KEYS.AUTO_CFG, autoConfig);
          }

          if (data.engineExtra) {
            engineExtra = mergeEngineRecords(engineExtra, data.engineExtra);
            save(KEYS.ENGINE_EXTRA, engineExtra);
          }

          var incoming = [];
          if (Array.isArray(data)) incoming = data;
          else if (data.defects) incoming = data.defects;
          else if (data.autoDefects) incoming = data.autoDefects;
          else if (data.base) incoming = data.base;
          else if (data.pannes) incoming = data.pannes;

          if (Array.isArray(incoming)) {
            var normalized = collectRecordsFromJson(incoming, "import-manuel", 0);
            if (normalized.length) {
              autoDb = mergeDefects(autoDb, normalized);
              save(KEYS.AUTO_DB, autoDb);
              autoLastSync = Date.now();
              save(KEYS.AUTO_LAST_SYNC, autoLastSync);
            } else {
              techUpdates = mergeDefects(techUpdates, incoming);
              save(KEYS.TECH_UPDATES, techUpdates);
              save(KEYS.LAST_UPDATE, Date.now());
            }
          }

          var engineIncoming = [];
          if (data.motorisations) engineIncoming = data.motorisations;
          else if (data.engines) engineIncoming = data.engines;
          else if (data.engineCatalog) engineIncoming = data.engineCatalog;

          if (Array.isArray(engineIncoming)) {
            var erecs = collectEngineRecordsFromJson(engineIncoming, "import-manuel", 0);
            if (erecs.length) {
              engineExtra = mergeEngineRecords(engineExtra, erecs);
              save(KEYS.ENGINE_EXTRA, engineExtra);
            }
          }

          invalidateEngineCatalog();
          renderAdmin();
          updateAdminStats();
          toast("Données importées.", "success");
        } catch (err) {
          console.error(err);
          toast("Erreur d’import JSON.", "error");
        }
      };

      reader.readAsText(file);
    };

    input.click();
  });

  on("#apkBtn", "click", function () {
    if (location.protocol === "file:") {
      toast("Pour générer l’APK, publiez d’abord le site en HTTPS (GitHub Pages, Netlify, Vercel).", "warning");
      return;
    }
    window.open("https://www.pwabuilder.com/?url=" + encodeURIComponent(location.origin + location.pathname), "_blank");
  });

  on("#copyUrlBtn", "click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).then(function () {
        toast("URL copiée.", "success");
      }).catch(function () {
        toast("Copie impossible.", "error");
      });
    } else {
      toast("Copie non supportée par ce navigateur.", "warning");
    }
  });

  on("#installBtn", "click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
      }).catch(function () {});
    } else {
      toast("Utilisez le menu du navigateur : Installer l’application.", "info");
    }
  });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var btn = q("#installBtn");
    if (btn) btn.classList.remove("hidden");
  });

  on("#generatePdfBtn", "click", function () {
    if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
      toast("Générez d’abord une analyse.", "warning");
      return;
    }

    generatePdfWithJsPdf().catch(function () {
      toast("Bibliothèque PDF indisponible. Impression/fallback HTML activé.", "warning");
      printReportFallback();
    });
  });

  on("#shareBtn", "click", function () {
    if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
      toast("Aucune analyse à partager.", "warning");
      return;
    }

    var text = analysisData.sections.map(function (pair) {
      return pair[0] + "\n" + stripTags(pair[1]);
    }).join("\n\n");

    if (navigator.share) {
      navigator.share({
        title: "Analyse Expert Auto",
        text: text
      }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Rapport copié.", "success");
      }).catch(function () {
        toast("Copie impossible.", "error");
      });
    } else {
      toast("Partage non supporté.", "warning");
    }
  });

  /* =========================================================
     TEMPS REEL LOCAL
     ========================================================= */
  setInterval(enforceTierAccess, 15000);

  window.addEventListener("storage", function (e) {
    if (e.key === KEYS.USERS || e.key === KEYS.REQUESTS || e.key === OLD_KEYS.USERS || e.key === OLD_KEYS.REQUESTS) {
      updateNotificationBell();

      if (currentUser && currentUser.role === "admin") {
        pollAdminNotifications();
        renderAdminIfOpen();
      }

      enforceTierAccess();
    }
  });

  if (broadcast) {
    broadcast.onmessage = function (event) {
      try {
        var data = event.data || {};

        if (data.type === "access-request") {
          onAccessRequestReceived(data.payload);
        }

        if (data.type === "access-change") {
          enforceTierAccess();

          if (currentUser && currentUser.role === "admin") {
            updateNotificationBell();
            renderAdminIfOpen();
          }
        }
      } catch (e) {
        console.warn("[AR-EXPERT] Broadcast message ignoré:", e);
      }
    };
  }

  window.addEventListener("arex:access-request", function (event) {
    onAccessRequestReceived(event.detail);
  });

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    try {
      techUpdates = (loadWithMigration(KEYS.TECH_UPDATES, OLD_KEYS.TECH_UPDATES, []) || [])
        .map(normalizeDefect)
        .filter(isValidDefect);
    } catch (e) {
      techUpdates = [];
    }

    try {
      autoDb = (loadWithMigration(KEYS.AUTO_DB, OLD_KEYS.AUTO_DB, []) || [])
        .map(normalizeDefect)
        .filter(isValidDefect);
    } catch (e) {
      autoDb = [];
    }

    try {
      engineExtra = (loadWithMigration(KEYS.ENGINE_EXTRA, OLD_KEYS.ENGINE_EXTRA, []) || [])
        .map(function (e) { return normalizeEngineRecord(e, e.sourceUrl || ""); })
        .filter(Boolean);
    } catch (e) {
      engineExtra = [];
    }

    autoLastSync = loadWithMigration(KEYS.AUTO_LAST_SYNC, OLD_KEYS.AUTO_LAST_SYNC, 0) || 0;
    autoConfig = Object.assign({}, CONFIG.autoDiagnostic, loadWithMigration(KEYS.AUTO_CFG, OLD_KEYS.AUTO_CFG, {}) || {});

    updateAdminStats();
    updateDataStatus("Base locale ingénieur chargée");
    updateNotificationState();

    registerServiceWorker();
    checkAutoUpdate(false);

    refreshSavedPasswordButton();

    processIncomingAccessRequestFromUrl();

    if (processIncomingAccessGrantFromUrl()) {
      updateNotificationBell();
      return;
    }

    if (restoreSession()) {
      showApp();
    } else {
      showLogin();
    }

    syncAutoDiagnostic(false).then(function () {
      return fetchEngineCatalogs(false);
    }).catch(function () {});

    toast("Application prête. Base locale + motorisation + auto-diagnostic chargés.", "success");
  }

  function boot() {
    try {
      init();
    } catch (e) {
      console.warn("[AR-EXPERT] Boot dégradé:", e);
      try {
        var status = q("#dataStatus");
        if (status) status.textContent = "Mode dégradé actif";
        var login = q("#loginScreen");
        if (login) login.style.display = "flex";
        var app = q("#mainApp");
        if (app) app.classList.add("hidden");
      } catch (_) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
