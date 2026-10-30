(function () {
  "use strict";

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
     HELPERS
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
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
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

  function normKey(str) {
    return norm(str).replace(/[^a-z0-9]+/g, "");
  }

  function containsAny(text, list) {
    var t = norm(text);
    for (var i = 0; i < list.length; i++) {
      if (t.indexOf(norm(list[i])) >= 0) return true;
    }
    return false;
  }

  function unique(values) {
    var seen = {};
    return (values || []).filter(function (v) {
      var k = norm(v);
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function parseKm(v) {
    return parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;
  }

  function parseYear(v) {
    var n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;
    return (n >= 1980 && n <= 2035) ? n : 0;
  }

  function yearMatches(range, year) {
    if (!year) return true;
    var s = String(range || "").trim();
    if (!s || s === "*" || norm(s).indexOf("tous") >= 0) return true;

    var parts = s.split("|");
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/(\d{4})\D*(\d{4})?/);
      if (!m) continue;
      var a = parseInt(m[1], 10);
      var b = m[2] ? parseInt(m[2], 10) : a;
      if (year >= a && year <= b) return true;
    }

    return false;
  }

  function brandMatches(a, b) {
    var na = normKey(a);
    var nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;

    var ba = catalog.brands[na];
    if (ba && ba.aliasKeys && ba.aliasKeys[nb]) return true;

    var bb = catalog.brands[nb];
    if (bb && bb.aliasKeys && bb.aliasKeys[na]) return true;

    if (na.length > 3 && nb.indexOf(na) >= 0) return true;
    if (nb.length > 3 && na.indexOf(nb) >= 0) return true;

    return false;
  }

  function nameMatch(a, b) {
    var na = normKey(a);
    var nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length > 2 && nb.indexOf(na) >= 0) return true;
    if (nb.length > 2 && na.indexOf(nb) >= 0) return true;
    return false;
  }

  function modelListContains(list, model) {
    return String(list || "").split("|").some(function (m) {
      return nameMatch(m, model);
    });
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
          return ("0" + b.toString(16)).slice(-2);
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
    try { return new URL(path, base).href; }
    catch (e) { return String(base || "") + String(path || ""); }
  }

  function valToString(v) {
    if (Array.isArray(v)) return v.join("|");
    if (v == null) return "";
    return String(v);
  }

  function getField(obj, keys) {
    if (!obj || typeof obj !== "object") return "";
    var i, k;

    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (obj[k] != null && obj[k] !== "") return obj[k];
    }

    var lowerMap = {};
    for (var prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        lowerMap[normKey(prop)] = prop;
      }
    }

    for (i = 0; i < keys.length; i++) {
      var lk = lowerMap[normKey(keys[i])];
      if (lk && obj[lk] != null && obj[lk] !== "") return obj[lk];
    }

    return "";
  }

  function getBrandField(o) {
    return valToString(getField(o, ["b", "brand", "marque", "constructeur", "make", "Brand", "Marque"]));
  }

  function getModelField(o) {
    return valToString(getField(o, ["m", "model", "modele", "modèle", "vehicle", "vehicule", "Model", "Modele"]));
  }

  function getEngineField(o) {
    return valToString(getField(o, ["e", "engine", "motorisation", "moteur", "powertrain", "version", "variant", "Engine", "Motorisation"]));
  }

  function getPowerField(o) {
    return valToString(getField(o, ["p", "power", "puissance", "ch", "kw", "kwh", "Power", "Puissance"]));
  }

  function getFuelField(o) {
    return valToString(getField(o, ["t", "type", "fuel", "energie", "énergie", "carburant", "engineType", "Fuel", "Type"]));
  }

  function getTransField(o) {
    return valToString(getField(o, ["tr", "transmission", "boite", "boîte", "gearbox", "Transmission", "Boite"]));
  }

  function getYearsField(o) {
    return valToString(getField(o, ["y", "years", "annee", "année", "period", "range", "from", "start", "Years"]));
  }

  function getSymptomsField(o) {
    return valToString(getField(o, ["s", "symptoms", "symptomes", "panne", "pannes", "defaut", "défaut", "probleme", "problème", "issue", "fault", "Symptoms"]));
  }

  function getDtcField(o) {
    return valToString(getField(o, ["dtc", "codeDtc", "code", "codes", "DTC"]));
  }

  function getDisplacementField(o) {
    return valToString(getField(o, ["d", "cyl", "cylindree", "cylindrée", "displacement", "engineSize", "cubic", "Cylindree"]));
  }

  function getCodeField(o) {
    return valToString(getField(o, ["code", "codeMoteur", "engineCode", "codemoteur", "Code"]));
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store", method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store", method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      });
  }

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  var CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    pollAdminMs: 5000,
    catalog: {
      vehicleUrl: "./data/vehicle-catalog.json",
      engineUrl: "./data/engine-catalog.json",
      technicalUrl: "./data/technical-updates.json",
      nhtsaEnabled: true,
      autoBaseUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/",
      endpoints: [
        "data/vehicle-catalog.json",
        "data/engine-catalog.json",
        "data/models.json",
        "data/motorisations.json",
        "data/base.json",
        "data/pannes.json",
        "data/technical-updates.json",
        "data/dtc.json",
        "db.json",
        "database.json"
      ],
      scriptUrls: [
        "index.html",
        "js/app.js",
        "js/data.js",
        "js/base.js",
        "js/catalog.js",
        "js/motorisations.js",
        "js/models.js",
        "js/brands.js",
        "js/engine-catalog.js",
        "js/vehicle-catalog.js",
        "app.js",
        "data.js",
        "db.js",
        "assets/db.js",
        "assets/data.js"
      ]
    }
  };

  var KEYS = {
    SESSION: "arex_session_v19",
    USERS: "arex_users_v19",
    REQUESTS: "arex_requests_v19",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v19",
    TECH_UPDATES: "arex_tech_updates_v19",
    LAST_UPDATE: "arex_last_update_v19",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v19",
    CATALOG_CFG: "arex_catalog_cfg_v19",
    IMPORTED_RAW: "arex_imported_raw_v19"
  };

  var OLD_KEYS = {
    SESSION: "arex_session_v18",
    USERS: "arex_users_v18",
    REQUESTS: "arex_requests_v18",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v18",
    TECH_UPDATES: "arex_tech_updates_v18",
    LAST_UPDATE: "arex_last_update_v18",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v18",
    CATALOG_CFG: "arex_catalog_cfg_v18",
    IMPORTED_RAW: "arex_imported_raw_v18"
  };

  /* =========================================================
     ETAT GLOBAL
     ========================================================= */
  var currentUser = null;
  var vehicleData = {};
  var analysisData = {};
  var extractedText = "";
  var termesMobilises = new Set();
  var deferredPrompt = null;
  var swRegistration = null;
  var adminPollTimer = null;
  var lastPendingSignature = "";
  var lastSharedAccessRequest = null;
  var broadcast = null;
  var autoLastSync = 0;
  var modelLoadToken = 0;
  var engineCache = {};

  var selection = {
    brand: null,
    model: null,
    engine: null
  };

  var modelOptions = [];
  var currentModelOptions = [];
  var engineOptions = [];
  var currentEngineOptions = [];

  var catalog = {
    brands: {},
    models: [],
    modelKeys: {},
    engines: [],
    engineKeys: {},
    defects: []
  };

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

    if (el) el.textContent = "État des notifications : " + (labels[state] || state);
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
     AUTH / USERS / REQUESTS
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

    return users.find(function (u) { return u.key === key; }) ||
           users.find(function (u) { return u.emailNorm === emailKey && u.role !== "admin"; }) ||
           null;
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

    return users.find(function (u) { return u.key === key; }) ||
           users.find(function (u) { return u.emailNorm === emailKey && u.role !== "admin"; }) ||
           null;
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
      return u.key === currentUser.key || (u.emailNorm === currentUser.emailNorm && u.role !== "admin");
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

      var req = JSON.parse(b64UrlToUtf8(raw));
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

  function pendingRequests() {
    return getRequests().filter(function (r) { return r.status === "pending"; });
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

    notify("Nouvelle demande d’accès", (req.name || "Tiers") + " — " + (req.email || ""), "access-" + (req.id || Date.now()));
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
    var newIds = sig ? sig.split("|").filter(function (id) { return id && oldIds.indexOf(id) < 0; }) : [];

    lastPendingSignature = sig;
    updateNotificationBell();

    if (newIds.length) {
      var all = getRequests();

      newIds.forEach(function (id) {
        var req = all.find(function (r) { return r.id === id; });
        if (req) onAccessRequestReceived(req);
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
    if (count > 0) toast(count + " demande(s) d’accès en attente", "info");
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
        broadcast.postMessage({ type: "access-request", payload: req });
      } catch (e) {}
    }

    try {
      window.dispatchEvent(new CustomEvent("arex:access-request", { detail: req }));
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
      badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;
    }

    var adminBtn = q("#adminPanelBtn");
    if (adminBtn) {
      if (currentUser.role === "admin") adminBtn.classList.remove("hidden");
      else adminBtn.classList.add("hidden");
    }

    updateCounter();
    updateNotificationBell();
    updateNotificationState();
    updateSelectionSummary();

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
    if (admin) admin.classList.add("hidden");

    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  }

  /* =========================================================
     CATALOGUE : MARQUES / MODELES / MOTORSATIONS / DEFAUTS
     ========================================================= */
  var BASE_BRANDS = [
    "Renault", "Dacia", "Peugeot", "Citroen", "DS", "Volkswagen", "Audi", "Skoda", "Seat", "Cupra",
    "BMW", "Mini", "Mercedes-Benz", "smart", "Volvo", "Porsche", "Land Rover", "Range Rover", "Jaguar",
    "Opel", "Vauxhall", "Fiat", "Alfa Romeo", "Maserati", "Abarth", "Ford", "Tesla", "Jeep", "RAM",
    "Chrysler", "Dodge", "Chevrolet", "GMC", "Cadillac", "Buick", "Lincoln", "Toyota", "Lexus",
    "Honda", "Acura", "Nissan", "Infiniti", "Mazda", "Subaru", "Suzuki", "Mitsubishi", "Hyundai",
    "Kia", "Genesis", "MG", "BYD", "Omoda", "Jaecoo", "Chery", "Geely", "Lynk & Co", "Polestar",
    "Leapmotor", "XPeng", "NIO", "Aiways", "Ora", "GWM", "Maxus", "LDV", "Seres", "Dongfeng",
    "Haval", "Tank", "Hongqi", "Beijing", "Foton", "JAC", "DFSK", "Wey", "VinFast", "Rivian",
    "Lucid", "Fisker", "Lotus", "Aston Martin", "Bentley", "Rolls-Royce", "Lamborghini", "Ferrari",
    "McLaren", "Bugatti", "Koenigsegg", "Pagani", "Maybach", "Alpina", "Morgan", "Caterham",
    "Ariel", "KTM", "Aixam", "Ligier", "Microcar", "Chatenet", "Iveco", "MAN", "Scania"
  ];

  var BRAND_ALIASES = {
    volkswagen: ["vw", "vag", "volkswagen group"],
    mercedesbenz: ["mercedes", "benz", "mb"],
    citroen: ["citroen"],
    landrover: ["landrover", "lr"],
    rangerover: ["land rover", "range"],
    alfaromeo: ["alfa"],
    maserati: ["masa"],
    chevrolet: ["chevy"],
    bmw: ["bayerische motoren werke"],
    mini: ["mini cooper"],
    tesla: ["tesla motors"],
    byd: ["build your dreams"],
    mg: ["morris garages"],
    xpeng: ["x peng"],
    nio: ["next ev"],
    gwm: ["great wall motor"],
    ldv: ["maxus"],
    jac: ["jianghuai automobile"],
    dfsk: ["dongfeng small truck"],
    iveco: ["iveco bus"],
    man: ["man truck"],
    scania: ["scania truck"]
  };

  function addBrand(name, aliases, sourceLabel, sourceUrl) {
    name = String(name || "").trim();
    if (!name) return;

    var k = normKey(name);
    if (!catalog.brands[k]) {
      catalog.brands[k] = {
        name: name,
        aliases: [],
        aliasKeys: {},
        source: sourceLabel || "local",
        sourceUrl: sourceUrl || ""
      };
    }

    var brand = catalog.brands[k];

    function pushAlias(a) {
      a = String(a || "").trim();
      if (!a) return;
      var ak = normKey(a);
      if (!brand.aliasKeys[ak]) {
        brand.aliasKeys[ak] = true;
        brand.aliases.push(a);
      }
    }

    pushAlias(name);

    if (aliases && aliases.length) {
      aliases.forEach(pushAlias);
    }

    if (BRAND_ALIASES[k]) {
      BRAND_ALIASES[k].forEach(pushAlias);
    }
  }

  function addModel(brand, name, years, sourceLabel, sourceUrl) {
    brand = String(brand || "").trim();
    name = String(name || "").trim();
    if (!brand || !name || name === "*") return;

    addBrand(brand, null, sourceLabel, sourceUrl);

    var k = normKey(brand) + "|" + normKey(name);
    if (catalog.modelKeys[k]) return;

    catalog.modelKeys[k] = true;
    catalog.models.push({
      brand: brand,
      name: name,
      years: years || "",
      source: sourceLabel || "local",
      sourceUrl: sourceUrl || ""
    });
  }

  function parseDisplacement(text) {
    var t = String(text || "");
    var m = t.match(/\b(\d\.\d)\s*(?:l|litre|litres)?\b/i);
    if (m) return m[1] + " L";

    m = t.match(/\b(\d{3,4})\s*(?:cm3|cc)\b/i);
    if (m) return m[1] + " cm3";

    m = t.match(/\b(\d{3,4})\b(?:\s*(?:cm3|cc))?/i);
    if (m && parseInt(m[1], 10) >= 600 && parseInt(m[1], 10) <= 8000 && /\b(diesel|essence|turbo|tdi|hdi|dci|tsi|tfsi|puretech|ecoboost)\b/i.test(t)) {
      return m[1] + " cm3";
    }

    return "";
  }

  function parsePower(text) {
    var t = String(text || "");
    var parts = [];
    var re = /(\d+(?:[.,]\d+)?)\s*(ch|cv|hp|kw|kwh)/gi;
    var m;

    while ((m = re.exec(t)) !== null) {
      var value = m[1].replace(",", ".");
      var unit = m[2].toLowerCase();
      if (unit === "cv" || unit === "hp") unit = "ch";
      parts.push(value + " " + unit);
    }

    if (parts.length) return unique(parts).join("|");

    m = t.match(/\b(\d{2,3})\b/);
    if (m && /\b(ch|kw|puissance)\b/i.test(t)) return m[1] + " ch";

    return "";
  }

  function parsePowerNumber(text) {
    var t = String(text || "");
    var m = t.match(/(\d+(?:[.,]\d+)?)\s*(ch|cv|hp)/i);
    if (m) return parseFloat(m[1].replace(",", "."));

    m = t.match(/(\d+(?:[.,]\d+)?)\s*kw/i);
    if (m) return parseFloat(m[1].replace(",", ".")) * 1.36;

    return 0;
  }

  function parseCapacityNumber(text) {
    var t = String(text || "");
    var m = t.match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
    return m ? parseFloat(m[1].replace(",", ".")) : 0;
  }

  function parseDisplacementNumber(text) {
    var t = String(text || "");
    var m = t.match(/\b(\d\.\d)\b/);
    if (m) return parseFloat(m[1]);

    m = t.match(/\b(\d{3,4})\s*(?:cm3|cc)?\b/i);
    if (m) {
      var v = parseInt(m[1], 10);
      if (v >= 600 && v <= 8000) return v / 1000;
    }

    return 0;
  }

  function inferFuel(text) {
    var t = norm(text || "");

    if (containsAny(t, [
      "hydrogene", "h2", "fuel cell", "pile a combustible"
    ])) return "Hydrogène";

    if (containsAny(t, [
      "hybride rechargeable", "plug-in", "phev", "e-tense", "4xe", "prime",
      "e-hybrid", "xdrive45e", "tucson phev", "sportage phev", "niro phev",
      "compass 4xe", "wrangler 4xe", "grand cherokee 4xe", "tonale phev"
    ])) return "Hybride rechargeable";

    if (containsAny(t, [
      "48v", "mild hybrid", "micro-hybridation", "eq boost", "boosterjet",
      "firefly hybrid", "hybrid 48", "e-torque", "egmp"
    ])) return "Hybride léger 48V";

    var hy = containsAny(t, [
      "hybride", "hybrid", "ths", "i-mmd", "e-power", "self-charging",
      "prius", "yaris hybrid", "corolla hybrid", "c-hr hybrid", "rav4 hybrid",
      "e:hev", "full hybrid"
    ]);

    var el = containsAny(t, [
      "electrique", "electric", "bev", "battery", "bms", "charge", "autonomie",
      "tesla", "id.3", "id.4", "id.5", "id.7", "ioniq", "atto", "model 3",
      "model y", "e-tron", "e-cmp", "megane e-tech", "scenic e-tech",
      "austral e-tech", "captur e-tech", "spring", "500e", "e-corsa",
      "e-208", "e-2008", "enyaq", "elroq", "born", "taycan", "mach-e", "i-pace",
      "ariya", "leaf", "mx-30", "eqs", "eqe", "eqb", "eqa", "q4 e-tron",
      "ev6", "ev9", "mg4", "seal", "dolphin", "bolt", "kwh"
    ]);

    if (hy && el) return "Hybride / électrique";
    if (hy) return "Hybride";
    if (el) return "Électrique";

    if (containsAny(t, [
      "diesel", "dci", "tdi", "hdi", "bluehdi", "bluemotion", "cdti",
      "ddis", "crdi", "k9k", "dv6", "om654", "b47", "ea288", "d-4d",
      "gasoil", "multijet", "ecoblue", "bluedci", "tdci"
    ])) return "Diesel";

    if (containsAny(t, [
      "essence", "tsi", "tfsi", "tce", "puretech", "firefly", "ecoboost",
      "skyactiv-g", "skyactiv-x", "smartstream", "gamma", "theta", "b38",
      "b46", "b48", "b58", "ea211", "ea888", "ingenium", "turbo essence",
      "1.0 tce", "1.3 tce", "1.2 puretech", "1.5 tsi", "2.0 tsi", "2.3 ecoboost"
    ]) && !containsAny(t, ["diesel", "electrique", "hybride"])) return "Essence";

    if (containsAny(t, ["gpl", "lp/g", "liquefied petroleum", "eco-g"])) return "GPL";
    if (containsAny(t, ["e85", "bioethanol", "superethanol"])) return "E85 / Bioéthanol";

    return "Non précisé / mixte";
  }

  function isFuelType(f) {
    f = norm(f || "");
    return [
      "essence", "diesel", "hybride", "electrique", "gpl", "e85", "bioethanol", "hydrogene"
    ].some(function (x) { return f.indexOf(x) >= 0; });
  }

  function isElectricLike(fuel) {
    var t = norm(fuel || "");
    return t.indexOf("electrique") >= 0 ||
           t.indexOf("hybride") >= 0 ||
           t.indexOf("48v") >= 0 ||
           t.indexOf("hydrogene") >= 0;
  }

  function looksLikeMotorisation(text) {
    var t = norm(text || "");
    if (!t || t.length < 2) return false;

    if (containsAny(t, [
      "essence", "diesel", "hybride", "electrique", "gpl", "e85", "bioethanol", "hydrogene",
      "turbo", "tdi", "tsi", "tfsi", "hdi", "dci", "bluehdi", "bluedci",
      "puretech", "firefly", "ecoboost", "skyactiv", "boostjet", "ecotorque",
      "e-tech", "etech", "phev", "bev", "48v", "mild", "full hybrid",
      "plug-in", "rechargeable", "electric", "hybrid", "multijet", "tdci",
      "ecoblue", "d-4d", "thp", "tce", "t-gdi", "tgdi", "crdi", "mpi", "gdi",
      "i-mmd", "e:hev", "e-power", "self-charging", "elroq", "enyaq", "kwh"
    ])) return true;

    if (/\b\d\.\d\b/.test(t)) return true;
    if (/\b\d{3,4}\b/.test(t) && /\b(ch|kw|kwh|hp|cv|cm3|cc)\b/.test(t)) return true;
    if (/^[a-z0-9 .,_-]{3,70}$/.test(t) && /\b[a-z]{1,4}\d{2,3}\b/.test(t)) return true;

    return false;
  }

  function createEngineLabel(e, d, p, f, tr, code) {
    e = String(e || "").trim();
    if (e) return e;

    var parts = [d, p, f, tr, code].filter(function (x) { return x && String(x).trim(); });
    return parts.length ? parts.join(" ") : "Motorisation non nommée";
  }

  function normalizeEngineInput(o, sourceLabel, sourceUrl, keyFallback) {
    if (!o) return null;

    var brand = "";
    var model = "";
    var years = "";
    var engine = "";
    var power = "";
    var fuel = "";
    var trans = "";
    var code = "";
    var displacement = "";
    var source = sourceLabel || "catalogue";
    var url = sourceUrl || "";
    var confidence = 0.75;

    if (Array.isArray(o)) {
      brand = o[0] || "";
      model = o[1] || "";
      years = o[2] || "";
      engine = o[3] || "";
      power = o[4] || "";
      fuel = o[5] || "";
      trans = o[6] || "";
      code = o[7] || "";
      displacement = o[8] || "";
    } else if (typeof o === "object") {
      brand = getBrandField(o);
      model = getModelField(o);
      years = getYearsField(o);
      engine = getEngineField(o);
      power = getPowerField(o);
      fuel = getFuelField(o);
      trans = getTransField(o);
      code = getCodeField(o);
      displacement = getDisplacementField(o);
      source = valToString(getField(o, ["source", "src"])) || source;
      url = valToString(getField(o, ["sourceUrl", "url", "lien", "link"])) || url;
      confidence = typeof o.confidence === "number" ? o.confidence : confidence;

      if (!engine && keyFallback && !isMetaKey(keyFallback)) engine = keyFallback;
      if (!engine && o.name && (power || fuel || displacement)) engine = o.name;
    }

    brand = String(brand || "").trim();
    model = String(model || "").trim();

    if (!brand || !model) return null;

    engine = String(engine || "").trim();
    power = String(power || "").trim() || parsePower(engine + " " + code + " " + displacement);
    displacement = String(displacement || "").trim() || parseDisplacement(engine + " " + code);
    code = String(code || "").trim();
    trans = String(trans || "").trim();
    years = String(years || "").trim();

    if (!fuel || !isFuelType(fuel)) {
      fuel = inferFuel(engine + " " + power + " " + displacement + " " + trans + " " + code + " " + model + " " + years);
    }

    engine = createEngineLabel(engine, displacement, power, fuel, trans, code);

    if (!confidence) {
      if (norm(source).indexOf("auto-diagnostic") >= 0) confidence = 0.88;
      else if (norm(source).indexOf("catalogue local") >= 0) confidence = 0.95;
      else if (norm(source).indexOf("heuristique") >= 0) confidence = 0.55;
      else confidence = 0.75;
    }

    return {
      brand: brand,
      model: model,
      years: years,
      engine: engine,
      displacement: displacement,
      power: power,
      fuel: fuel,
      transmission: trans,
      code: code,
      source: source,
      sourceUrl: url,
      confidence: confidence
    };
  }

  function addEngine(o, sourceUrl, force, sourceLabel, keyFallback) {
    var e = normalizeEngineInput(o, sourceLabel || "catalogue", sourceUrl || "", keyFallback || "");
    if (!e) return;

    if (!force && !isFuelType(e.fuel) && !looksLikeMotorisation(e.engine + " " + e.power + " " + e.displacement + " " + e.code)) {
      return;
    }

    var k = normKey(e.brand) + "|" + normKey(e.model) + "|" + normKey(e.engine) + "|" +
            normKey(e.displacement) + "|" + normKey(e.power) + "|" + normKey(e.fuel) + "|" +
            normKey(e.transmission) + "|" + normKey(e.code);

    if (catalog.engineKeys[k]) return;

    catalog.engineKeys[k] = true;
    catalog.engines.push(e);
    addModel(e.brand, e.model, e.years, e.source, e.sourceUrl);
  }

  function normalizeDefect(d, sourceLabel, sourceUrl) {
    if (!d) return null;

    var out = {
      b: getBrandField(d),
      m: getModelField(d) || "*",
      y: getYearsField(d),
      e: getEngineField(d),
      p: getPowerField(d),
      s: getSymptomsField(d),
      sev: valToString(getField(d, ["sev", "severity", "gravite", "gravité"])) || "moyen",
      wf: typeof d.wf === "number" ? d.wf : (typeof d.wearFactor === "number" ? d.wearFactor : 0.5),
      n: valToString(getField(d, ["n", "note", "description", "fiche", "detail"])),
      law: valToString(getField(d, ["law", "legal", "baseLegale", "droit", "fondement"])),
      rec: valToString(getField(d, ["rec", "recall", "rappel", "campagne", "source"])),
      tg: valToString(getField(d, ["tg", "tags", "categorie", "category", "systeme"])),
      dtc: getDtcField(d),
      source: valToString(getField(d, ["source", "src"])) || sourceLabel || "base locale",
      sourceUrl: valToString(getField(d, ["sourceUrl", "url", "lien", "link"])) || sourceUrl || ""
    };

    out.et = valToString(getField(d, ["et", "engineType", "type", "fuel", "energie"])) || inferFuel(out.e + " " + out.tg + " " + out.s + " " + out.n);

    if (!out.b || !out.s) return null;
    return out;
  }

  function addDefect(d, sourceLabel, sourceUrl) {
    var nd = normalizeDefect(d, sourceLabel, sourceUrl);
    if (!nd) return;

    catalog.defects.push(nd);
    addBrand(nd.b, null, nd.source, nd.sourceUrl);

    if (nd.m && nd.m !== "*") {
      String(nd.m).split("|").forEach(function (m) {
        addModel(nd.b, m, nd.y, nd.source, nd.sourceUrl);
      });
    }

    if (nd.e && nd.m && nd.m !== "*" && looksLikeMotorisation(nd.e)) {
      String(nd.m).split("|").forEach(function (m) {
        addEngine({
          b: nd.b,
          m: m,
          y: nd.y,
          e: nd.e,
          p: nd.p,
          t: nd.et,
          tr: "",
          code: "",
          source: nd.source,
          sourceUrl: nd.sourceUrl
        }, nd.sourceUrl, true, nd.source);
      });
    }
  }

  function getAllBrands() {
    var arr = Object.keys(catalog.brands).map(function (k) { return catalog.brands[k]; });

    arr.sort(function (a, b) {
      return norm(a.name).localeCompare(norm(b.name));
    });

    return arr;
  }

  function getModels(brand, year) {
    var out = [];

    catalog.models.forEach(function (m) {
      if (!brandMatches(m.brand, brand)) return;
      if (!yearMatches(m.years, year)) return;
      out.push({
        id: normKey(m.brand) + "|" + normKey(m.name),
        brand: m.brand,
        name: m.name,
        years: m.years,
        source: m.source
      });
    });

    out.sort(function (a, b) {
      return norm(a.name).localeCompare(norm(b.name));
    });

    return out;
  }

  function engineMatches(e, brand, model, year) {
    if (!brandMatches(e.brand, brand)) return false;
    if (!nameMatch(e.model, model)) return false;
    if (!yearMatches(e.years, year)) return false;
    return true;
  }

  function dedupeAndSortEngines(list) {
    var seen = {};
    var out = [];

    list.forEach(function (e) {
      if (!e) return;
      var k = normKey(e.brand) + "|" + normKey(e.model) + "|" + normKey(e.engine) + "|" +
              normKey(e.displacement) + "|" + normKey(e.power) + "|" + normKey(e.fuel) + "|" +
              normKey(e.transmission) + "|" + normKey(e.code);
      if (seen[k]) return;
      seen[k] = true;
      out.push(e);
    });

    out.sort(function (a, b) {
      var fa = fuelRank(a.fuel);
      var fb = fuelRank(b.fuel);
      if (fa !== fb) return fa - fb;

      var da = parseDisplacementNumber(a.displacement || a.engine);
      var db = parseDisplacementNumber(b.displacement || b.engine);
      if (da !== db) return (da || 999) - (db || 999);

      var pa = parsePowerNumber(a.power || a.engine);
      var pb = parsePowerNumber(b.power || b.engine);
      if (pa !== pb) return pb - pa;

      var ca = parseCapacityNumber(a.power || a.displacement || a.engine);
      var cb = parseCapacityNumber(b.power || b.displacement || b.engine);
      if (ca !== cb) return cb - ca;

      return norm(a.engine).localeCompare(norm(b.engine));
    });

    return out;
  }

  function fuelRank(f) {
    var order = ["Essence", "Diesel", "Hybride", "Hybride rechargeable", "Hybride léger 48V", "Électrique", "GPL", "E85 / Bioéthanol", "Hydrogène", "Non précisé / mixte", "Hybride / électrique"];
    var i = order.indexOf(f);
    return i >= 0 ? i : 999;
  }

  /* =========================================================
     GENERATION INGÉNIEUR DE SECOURS
     ========================================================= */
  function detectFamily(brand) {
    var b = normKey(brand);

    if (containsAny(b, ["renault", "dacia", "peugeot", "citroen", "ds", "opel", "vauxhall", "fiat", "alfa", "maserati", "abarth"])) return "stellantis";
    if (containsAny(b, ["volkswagen", "vw", "audi", "skoda", "seat", "cupra", "porsche"])) return "vag";
    if (containsAny(b, ["bmw", "mini", "alpina"])) return "bmw";
    if (containsAny(b, ["mercedes", "smart", "amg"])) return "mercedes";
    if (containsAny(b, ["toyota", "lexus"])) return "toyota";
    if (containsAny(b, ["hyundai", "kia", "genesis"])) return "hk";
    if (containsAny(b, ["tesla", "byd", "nio", "xpeng", "leapmotor", "ora", "aiways", "polestar", "lucid", "rivian", "vinfast", "seres"])) return "ev";
    if (containsAny(b, ["mg"])) return "mg";
    return "generic";
  }

  function detectSegment(model, brand) {
    var m = norm(model || "");
    var b = norm(brand || "");

    if (containsAny(m, ["kangoo", "partner", "berlingo", "rifter", "caddy", "transit", "vivaro", "expert", "jumpy", "trafic", "master", "boxer", "jumper", "sprinter", "ducato", "transporter", "caravelle"])) return "van";

    if (containsAny(m, ["clio", "208", "c3", "corsa", "polo", "fabia", "ibiza", "swift", "yaris", "jazz", "micra", "aygo", "107", "108", "c1", "up!", "sandero", "logan", "500", "panda"])) return "city";

    if (containsAny(m, ["captur", "2008", "c3 aircross", "t-cross", "taigo", "arona", "mokka", "vitara", "s-cross", "bx", "trackhawk"])) return "suv_small";

    if (containsAny(m, ["tiguan", "kuga", "tucson", "sportage", "qashqai", "x-trail", "karoq", "ateca", "formentor", "cx-5", "forester", "outlander", "rav4", "cr-v", "elroq", "enyaq", "id.4", "q4 e-tron", "xc40", "ex30", "macan", "glc", "gla"])) return "suv_compact";

    if (containsAny(m, ["kodiaq", "touareg", "x5", "x7", "gle", "q7", "q8", "cayenne", "defender", "range rover", "discovery", "ev9", "escalade", "navigator"])) return "suv_large";

    if (containsAny(m, ["megane", "308", "c4", "astra", "golf", "leon", "octavia", "focus", "3 serie", "classe a", "a3", "corolla", "civic", "elantra", "versa"])) return "compact";

    if (containsAny(b, ["porsche", "jaguar", "land rover", "lotus", "aston", "bentley", "rolls", "lamborghini", "ferrari", "mclaren", "bugatti"])) return "premium";

    return "generic";
  }

  function generateEngines(brand, model, year) {
    var out = [];
    var y = parseYear(year) || new Date().getFullYear();
    var family = detectFamily(brand);
    var segment = detectSegment(model, brand);
    var mLower = norm(model || "");

    function push(e, p, f, tr, code, d, conf) {
      var ne = normalizeEngineInput({
        b: brand,
        m: model,
        y: y + "-" + y,
        e: e,
        p: p,
        t: f,
        tr: tr || "",
        code: code || "",
        d: d || "",
        source: "heuristique ingénieur",
        confidence: typeof conf === "number" ? conf : 0.55
      }, "heuristique ingénieur", "", "");
      if (ne) out.push(ne);
    }

    var isEvName = containsAny(mLower, ["e-", "ë-", "electric", "ev", "id.", "elroq", "enyaq", "taycan", "ioniq", "ev6", "ev9", "model 3", "model y", "model s", "model x", "atto", "seal", "dolphin", "mg4", "ariya", "leaf", "mx-30", "mach-e", "i-pace", "eqs", "eqe", "eqb", "eqa", "q4 e-tron", "e-tron", "born", "tavascan", "formentor vz", "ex30"]);

    if (family === "ev" || isEvName) {
      push("Standard Range", "170ch|204ch", "Électrique", "RWD / réducteur", "BEV", "50 kWh|60 kWh", 0.62);
      push("Long Range", "204ch|286ch|350ch", "Électrique", "RWD / réducteur", "BEV", "65 kWh|77 kWh|85 kWh", 0.62);
      push("AWD / Performance", "300ch|400ch|500ch", "Électrique", "AWD / réducteur", "BEV", "75 kWh|90 kWh|100 kWh", 0.58);
      return dedupeAndSortEngines(out);
    }

    if (family === "stellantis") {
      if (segment === "city") {
        push("1.0 TCe", "65ch|90ch", "Essence", "BVM5|BVM6", "H4D", "1.0 L", 0.72);
        push("1.3 TCe", "100ch|130ch|140ch", "Essence", "BVM6|EDC", "H5H", "1.3 L", 0.72);
        if (y >= 2016) push("1.5 Blue dCi", "75ch|100ch|115ch", "Diesel", "BVM6|EDC", "K9K", "1.5 L", 0.72);
        if (y >= 2020) push("E-Tech Hybrid", "140ch|145ch", "Hybride", "automatique", "TCe 140", "1.6 L", 0.68);
        if (y >= 2023) push("E-Tech Plug-in Hybrid", "160ch|180ch", "Hybride rechargeable", "automatique", "PHEV", "1.6 L", 0.62);
      } else if (segment === "compact" || segment === "suv_small") {
        push("1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2", "1.2 L", 0.74);
        push("1.3 TCe", "100ch|130ch|155ch", "Essence", "BVM6|EDC", "H5H", "1.3 L", 0.72);
        if (y >= 2016) push("1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5", "1.5 L", 0.74);
        if (y >= 2018) push("2.0 BlueHDi", "150ch|180ch", "Diesel", "EAT8", "DW10", "2.0 L", 0.68);
        if (y >= 2020) push("Hybrid 180", "180ch", "Hybride rechargeable", "EAT8", "PHEV", "1.6 L", 0.66);
        if (y >= 2021) push("Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV", "1.6 L", 0.66);
      } else if (segment === "suv_compact" || segment === "suv_large") {
        push("1.2 PureTech", "130ch|155ch|180ch", "Essence", "EAT8", "EB2", "1.2 L", 0.72);
        push("1.6 PureTech", "180ch|225ch", "Essence", "EAT8", "EP6F", "1.6 L", 0.68);
        if (y >= 2016) push("1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5", "1.5 L", 0.74);
        if (y >= 2018) push("2.0 BlueHDi", "160ch|180ch", "Diesel", "EAT8", "DW10", "2.0 L", 0.72);
        if (y >= 2020) push("Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV", "1.6 L", 0.68);
        if (y >= 2021) push("Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 / 4x4", "PHEV4", "1.6 L", 0.64);
      } else if (segment === "van") {
        push("1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2", "1.2 L", 0.72);
        push("1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5", "1.5 L", 0.74);
        push("2.0 BlueHDi", "150ch|180ch", "Diesel", "EAT8", "DW10", "2.0 L", 0.72);
        if (y >= 2021) push("Électrique", "100kW|115kW|136ch", "Électrique", "réducteur", "eCMP", "50 kWh", 0.66);
      } else {
        push("1.2 PureTech", "100ch|130ch", "Essence", "BVM6|EAT8", "EB2", "1.2 L", 0.66);
        push("1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5", "1.5 L", 0.66);
        if (y >= 2020) push("Hybrid", "180ch|225ch", "Hybride rechargeable", "EAT8", "PHEV", "1.6 L", 0.58);
      }
      return dedupeAndSortEngines(out);
    }

    if (family === "vag") {
      if (segment === "city" || segment === "compact") {
        push("1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM6|DSG", "EA211", "1.0 L", 0.76);
        push("1.5 TSI", "130ch|150ch|180ch", "Essence", "DSG|BVM6", "EA211 evo", "1.5 L", 0.76);
        if (y >= 2016) push("2.0 TSI", "190ch|245ch|320ch", "Essence", "DSG", "EA888", "2.0 L", 0.72);
        if (y >= 2015) push("1.6 TDI", "95ch|115ch", "Diesel", "BVM6|DSG", "EA288", "1.6 L", 0.74);
        if (y >= 2015) push("2.0 TDI", "115ch|150ch|190ch|200ch", "Diesel", "DSG|BVM6", "EA288", "2.0 L", 0.76);
        if (y >= 2020) push("1.0 eTSI", "110ch", "Hybride léger 48V", "DSG", "EA211 evo", "1.0 L", 0.70);
        if (y >= 2020) push("1.5 eTSI", "130ch|150ch", "Hybride léger 48V", "DSG", "EA211 evo", "1.5 L", 0.70);
        if (y >= 2020) push("eHybrid", "204ch|245ch|300ch", "Hybride rechargeable", "DSG", "PHEV", "1.4 L|2.0 L", 0.66);
      } else if (segment === "suv_small" || segment === "suv_compact") {
        push("1.0 TSI", "95ch|110ch|115ch", "Essence", "DSG", "EA211", "1.0 L", 0.74);
        push("1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo", "1.5 L", 0.74);
        push("2.0 TSI", "190ch|245ch|300ch|320ch", "Essence", "DSG", "EA888", "2.0 L", 0.74);
        push("2.0 TDI", "115ch|150ch|190ch|200ch", "Diesel", "DSG", "EA288", "2.0 L", 0.76);
        if (y >= 2020) push("eHybrid", "245ch|300ch", "Hybride rechargeable", "DSG", "PHEV", "1.4 L|2.0 L", 0.68);
        if (containsAny(mLower, ["elroq", "enyaq", "id.", "q4 e-tron", "born", "tavascan"])) {
          push("Standard", "170ch|204ch", "Électrique", "RWD / réducteur", "MEB", "55 kWh|63 kWh", 0.78);
          push("Long Range", "204ch|286ch", "Électrique", "RWD / réducteur", "MEB", "77 kWh", 0.78);
          push("AWD / vRS / GTX", "265ch|299ch|340ch", "Électrique", "AWD / réducteur", "MEB", "77 kWh|82 kWh", 0.74);
        }
      } else if (segment === "van") {
        push("1.5 TSI", "114ch", "Essence", "DSG|BVM6", "EA211", "1.5 L", 0.70);
        push("2.0 TDI", "102ch|122ch|150ch", "Diesel", "DSG|BVM6", "EA288", "2.0 L", 0.74);
        if (y >= 2020) push("Électrique", "113ch|204ch", "Électrique", "réducteur", "eCaddy/eTransporter", "50 kWh|75 kWh", 0.66);
      } else {
        push("2.0 TDI", "150ch|200ch", "Diesel", "DSG", "EA288", "2.0 L", 0.70);
        push("2.0 TSI", "245ch|320ch", "Essence", "DSG", "EA888", "2.0 L", 0.70);
      }
      return dedupeAndSortEngines(out);
    }

    if (family === "bmw") {
      push("118i / 320i", "136ch|156ch|170ch|184ch", "Essence", "BVM8|Steptronic", "B38/B48", "1.5 L|2.0 L", 0.72);
      push("330i / M340i", "245ch|258ch|374ch", "Essence", "Steptronic", "B46/B58", "2.0 L|3.0 L", 0.70);
      push("118d / 320d", "150ch|163ch|190ch", "Diesel", "BVM6|Steptronic", "B47", "2.0 L", 0.74);
      push("330d / 40d", "286ch|292ch|340ch", "Diesel", "Steptronic", "B57", "3.0 L", 0.70);
      if (y >= 2019) push("330e / xDrive45e", "252ch|292ch|394ch", "Hybride rechargeable", "Steptronic", "PHEV", "2.0 L", 0.66);
      if (containsAny(mLower, ["i4", "ix", "ix1", "cooper e"])) {
        push("eDrive", "286ch|340ch", "Électrique", "RWD / réducteur", "BEV", "70 kWh|80 kWh|100 kWh", 0.72);
        push("xDrive / M", "462ch|544ch|619ch", "Électrique", "AWD / réducteur", "BEV", "80 kWh|100 kWh", 0.68);
      }
      return dedupeAndSortEngines(out);
    }

    if (family === "mercedes") {
      push("180 / 200", "136ch|163ch|190ch|204ch", "Essence", "7G-DCT|9G-Tronic", "M282/M264", "1.3 L|2.0 L", 0.72);
      push("250 / 300", "224ch|258ch", "Essence", "8G|9G-Tronic", "M260/M264", "2.0 L", 0.70);
      push("220d / 300d", "150ch|190ch|200ch|245ch|286ch", "Diesel", "9G-Tronic", "OM654", "2.0 L|3.0 L", 0.74);
      if (y >= 2020) push("250e / 300e / 300de", "218ch|313ch|381ch", "Hybride rechargeable", "8G|9G-Tronic", "PHEV", "2.0 L", 0.66);
      if (containsAny(mLower, ["eqa", "eqb", "eqe", "eqs"])) {
        push("250+ / 350", "190ch|292ch", "Électrique", "RWD / réducteur", "BEV", "66 kWh|90 kWh|107 kWh", 0.74);
        push("350 4MATIC / 580", "292ch|544ch", "Électrique", "AWD / réducteur", "BEV", "90 kWh|107 kWh", 0.70);
      }
      return dedupeAndSortEngines(out);
    }

    if (family === "toyota") {
      push("1.0 / 1.2 / 1.5", "72ch|100ch|125ch", "Essence", "BVM5|CVT", "Dynamic Force", "1.0 L|1.2 L|1.5 L", 0.70);
      push("2.0", "150ch|171ch", "Essence", "CVT|Direct Shift", "Dynamic Force", "2.0 L", 0.70);
      if (y >= 2015) push("Hybrid", "116ch|125ch|180ch|218ch|222ch", "Hybride", "e-CVT", "THS", "1.5 L|1.8 L|2.5 L", 0.78);
      if (y >= 2021) push("Plug-in Hybrid", "306ch|320ch", "Hybride rechargeable", "e-CVT", "PHEV", "2.5 L", 0.70);
      if (y >= 2015 && segment !== "city") push("D-4D", "120ch|150ch|200ch", "Diesel", "BVM6|Direct Shift", "GD", "2.0 L|2.2 L", 0.68);
      return dedupeAndSortEngines(out);
    }

    if (family === "hk") {
      push("1.0 T-GDI", "100ch|120ch", "Essence", "BVM6|DCT", "Smartstream", "1.0 L", 0.72);
      push("1.2 / 1.4 / 1.5", "100ch|140ch|160ch", "Essence", "BVM6|IVT", "Smartstream", "1.2 L|1.4 L|1.5 L", 0.70);
      push("1.6 T-GDI", "150ch|177ch|215ch|230ch", "Essence", "DCT|BVM6", "Smartstream", "1.6 L", 0.72);
      push("1.6 CRDi", "115ch|136ch", "Diesel", "BVM6|DCT", "Smartstream", "1.6 L", 0.72);
      if (y >= 2020) push("Hybrid", "130ch|150ch|215ch|230ch", "Hybride", "automatique", "HEV", "1.6 L", 0.72);
      if (y >= 2021) push("Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique", "PHEV", "1.6 L", 0.70);
      if (containsAny(mLower, ["kona", "ioniq", "ev6", "ev9"])) {
        push("Standard Range", "136ch|151ch|170ch", "Électrique", "RWD / réducteur", "BEV", "39 kWh|53 kWh|64 kWh", 0.74);
        push("Long Range", "204ch|228ch|325ch", "Électrique", "RWD / réducteur", "BEV", "64 kWh|77 kWh", 0.74);
        push("AWD / GT", "325ch|430ch|585ch", "Électrique", "AWD / réducteur", "BEV", "77 kWh", 0.70);
      }
      return dedupeAndSortEngines(out);
    }

    if (family === "mg") {
      push("1.5 VTi / Turbo", "110ch|120ch|169ch", "Essence", "BVM5|CVT", "NA/Turbo", "1.5 L", 0.66);
      if (y >= 2020) push("Hybrid", "190ch|240ch|280ch|400ch", "Hybride", "automatique", "HEV", "1.5 L", 0.62);
      if (containsAny(mLower, ["mg4", "zs ev", "marvel r", "cyberster"])) {
        push("Standard Range", "136ch|156ch|170ch", "Électrique", "RWD / réducteur", "BEV", "51 kWh|64 kWh", 0.72);
        push("Long Range", "170ch|204ch|250ch", "Électrique", "RWD / réducteur", "BEV", "64 kWh|77 kWh", 0.72);
        push("XPOWER / AWD", "333ch|435ch", "Électrique", "AWD / réducteur", "BEV", "64 kWh|77 kWh", 0.68);
      }
      return dedupeAndSortEngines(out);
    }

    // Generic fallback
    push("1.0 / 1.2 Turbo", "90ch|110ch|130ch", "Essence", "BVM5|BVM6|automatique", "TURBO", "1.0 L|1.2 L", 0.58);
    push("1.5 / 1.6 Turbo", "130ch|150ch|180ch", "Essence", "BVM6|automatique", "TURBO", "1.5 L|1.6 L", 0.58);
    if (segment !== "city") push("2.0 Turbo", "190ch|245ch", "Essence", "automatique", "TURBO", "2.0 L", 0.54);
    if (y >= 2015) push("1.5 / 2.0 Diesel", "100ch|130ch|150ch|190ch", "Diesel", "BVM6|automatique", "TDI/HDi/DCI", "1.5 L|2.0 L", 0.58);
    if (y >= 2020) push("Hybrid", "140ch|180ch", "Hybride", "automatique", "HEV", "1.5 L|1.6 L|2.0 L", 0.54);
    if (y >= 2021) push("Plug-in Hybrid", "225ch|280ch", "Hybride rechargeable", "automatique", "PHEV", "1.6 L|2.0 L", 0.52);
    if (y >= 2020) push("Electric", "150ch|204ch|286ch", "Électrique", "réducteur", "BEV", "50 kWh|65 kWh|77 kWh", 0.52);

    return dedupeAndSortEngines(out);
  }

  function getEnginesFor(brand, model, year) {
    if (!brand || !model) return [];

    var yr = parseYear(year);
    var cacheKey = normKey(brand) + "|" + normKey(model) + "|" + (yr || "any");
    if (engineCache[cacheKey]) return engineCache[cacheKey].slice();

    var list = [];

    catalog.engines.forEach(function (e) {
      if (engineMatches(e, brand, model, yr)) list.push(e);
    });

    catalog.defects.forEach(function (d) {
      if (!brandMatches(d.b, brand)) return;
      if (!yearMatches(d.y, yr)) return;
      if (!d.m || d.m === "*") {
        if (!looksLikeMotorisation(d.e)) return;
      } else if (!modelListContains(d.m, model)) {
        return;
      }

      if (!looksLikeMotorisation(d.e)) return;

      var ne = normalizeEngineInput({
        b: d.b,
        m: model,
        y: d.y,
        e: d.e,
        p: d.p,
        t: d.et,
        tr: "",
        code: d.dtc || "",
        source: d.source,
        sourceUrl: d.sourceUrl,
        confidence: 0.84
      }, d.source, d.sourceUrl, "");

      if (ne) list.push(ne);
    });

    if (list.length < 4) {
      list = list.concat(generateEngines(brand, model, yr));
    }

    list = dedupeAndSortEngines(list);
    engineCache[cacheKey] = list;
    return list.slice();
  }

  function clearEngineCache() {
    engineCache = {};
  }

  /* =========================================================
     INGESTION JSON / AUTO-DIAGNOSTIC
     ========================================================= */
  var META_KEYS = {
    b:1, brand:1, marque:1, constructeur:1, make:1,
    m:1, model:1, modele:1, vehicle:1, vehicule:1,
    e:1, engine:1, motorisation:1, moteur:1, powertrain:1, version:1, variant:1,
    p:1, power:1, puissance:1, ch:1, kw:1, kwh:1,
    t:1, type:1, fuel:1, energie:1, carburant:1, enginetype:1,
    tr:1, transmission:1, boite:1, gearbox:1,
    y:1, years:1, annee:1, period:1, range:1, from:1, start:1,
    s:1, symptoms:1, symptomes:1, panne:1, pannes:1, defaut:1, probleme:1, issue:1, fault:1,
    dtc:1, codedtc:1, code:1, codes:1,
    d:1, cyl:1, cylindree:1, displacement:1, enginesize:1, cubic:1,
    n:1, note:1, description:1, fiche:1, detail:1,
    law:1, legal:1, baselegale:1, droit:1, fondement:1,
    rec:1, recall:1, rappel:1, campagne:1,
    tg:1, tags:1, categorie:1, category:1, systeme:1,
    source:1, src:1, sourceurl:1, url:1, lien:1, link:1,
    confidence:1, wf:1, wearfactor:1, sev:1, severity:1, gravite:1,
    brands:1, marques:1, models:1, modeles:1, vehicles:1, vehicules:1,
    engines:1, motorisations:1, powertrains:1, variants:1,
    defects:1, faults:1, rappels:1, problems:1, issues:1,
    data:1, items:1, records:1, catalog:1, base:1, database:1, result:1, results:1,
    name:1, aliases:1, alias:1
  };

  function isMetaKey(key) {
    return !!META_KEYS[normKey(key)];
  }

  function isPlainContainer(obj) {
    return obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length > 0;
  }

  function ingestNode(node, brandFallback, modelFallback, keyFallback, sourceLabel, sourceUrl, depth, seen) {
    depth = depth || 0;
    seen = seen || (typeof WeakSet !== "undefined" ? new WeakSet() : null);

    if (!node || depth > 8) return;

    if (Array.isArray(node)) {
      node.forEach(function (item) {
        if (typeof item === "string") {
          var s = String(item || "").trim();
          if (!s) return;

          if (brandFallback && modelFallback) {
            addEngine({
              b: brandFallback,
              m: modelFallback,
              e: s,
              source: sourceLabel,
              sourceUrl: sourceUrl
            }, sourceUrl, false, sourceLabel);
          } else if (brandFallback) {
            addModel(brandFallback, s, "", sourceLabel, sourceUrl);
          } else {
            addBrand(s, null, sourceLabel, sourceUrl);
          }
        } else {
          ingestNode(item, brandFallback, modelFallback, keyFallback, sourceLabel, sourceUrl, depth + 1, seen);
        }
      });
      return;
    }

    if (typeof node !== "object") return;

    if (seen) {
      if (seen.has(node)) return;
      seen.add(node);
    }

    var b = getBrandField(node) || brandFallback || "";
    var m = getModelField(node) || modelFallback || "";
    var e = getEngineField(node);
    if (!e && keyFallback && !isMetaKey(keyFallback)) e = keyFallback;
    if (!e && node.name && (getPowerField(node) || getFuelField(node) || getDisplacementField(node))) e = node.name;

    var sym = getSymptomsField(node);
    var hasEngineData = e || getPowerField(node) || getFuelField(node) || getDisplacementField(node);

    if (b && m && hasEngineData) {
      addEngine(Object.assign({}, node, {
        b: b,
        m: m,
        e: e || "",
        source: sourceLabel,
        sourceUrl: sourceUrl
      }), sourceUrl, false, sourceLabel, keyFallback);
    }

    if (b && sym) {
      addDefect(Object.assign({}, node, {
        b: b,
        m: m || node.m || node.modele || "*",
        source: sourceLabel,
        sourceUrl: sourceUrl
      }), sourceLabel, sourceUrl);
    }

    if (b && !m) addBrand(b, node.aliases || node.alias, sourceLabel, sourceUrl);
    if (b && m) addModel(b, m, getYearsField(node), sourceLabel, sourceUrl);

    ["brands", "marques"].forEach(function (k) {
      if (node[k]) ingestNode(node[k], null, null, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["models", "modeles", "vehicles", "vehicules"].forEach(function (k) {
      if (node[k]) ingestNode(node[k], b, null, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["engines", "motorisations", "powertrains", "versions", "variants"].forEach(function (k) {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["defects", "pannes", "faults", "rappels", "problems", "issues"].forEach(function (k) {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["data", "items", "records", "catalog", "base", "database", "result", "results"].forEach(function (k) {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    if (isPlainContainer(node)) {
      Object.keys(node).forEach(function (key) {
        if (isMetaKey(key)) return;
        var val = node[key];

        if (val && typeof val === "object") {
          ingestNode(val, b, m, key, sourceLabel, sourceUrl, depth + 1, seen);
        } else if (typeof val === "string") {
          var s = String(val || "").trim();
          if (!s) return;

          if (b && m) {
            addEngine({
              b: b,
              m: m,
              e: key,
              p: s,
              source: sourceLabel,
              sourceUrl: sourceUrl
            }, sourceUrl, false, sourceLabel);
          } else if (b) {
            addModel(b, key, s, sourceLabel, sourceUrl);
          } else {
            addBrand(key, null, sourceLabel, sourceUrl);
          }
        }
      });
    }
  }

  function parseBalanced(text, start) {
    var open = text.charAt(start);
    if (open !== "[" && open !== "{") return null;

    var stack = [open];
    var inString = false;
    var escape = false;
    var max = Math.min(text.length, start + 2500000);

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

  function tryParseJsonish(raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {}

    var s = String(raw || "");

    s = s.replace(/\/\*[\s\S]*?\*\//g, "");
    s = s.replace(/(^|[^:])\/\/.*$/gm, "$1");
    s = s.replace(/'((?:[^'\\]|\\.)*)'/g, function (m, p) {
      return '"' + String(p).replace(/"/g, '\\"') + '"';
    });
    s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
    s = s.replace(/,(\s*[}\]])/g, "$1");

    try {
      return JSON.parse(s);
    } catch (e2) {
      return null;
    }
  }

  function extractJsonCandidates(text) {
    var out = [];
    if (!text) return out;

    var keywordRe = /marque|brand|modele|model|motorisation|engine|panne|defaut|dtc|symptom|rappel|recall|puissance|power|energie|fuel|cylindree|displacement/i;
    var max = Math.min(text.length, 3000000);
    var attempts = 0;

    for (var i = 0; i < max && attempts < 350; i++) {
      var ch = text.charAt(i);
      if (ch !== "[" && ch !== "{") continue;

      var snippet = text.substr(i, 700).toLowerCase();
      if (!keywordRe.test(snippet)) continue;

      attempts++;
      var raw = parseBalanced(text, i);
      if (!raw) continue;

      var parsed = tryParseJsonish(raw);
      if (parsed) {
        out.push(parsed);
        i += raw.length;
      }
    }

    return out;
  }

  function ingestAutoText(url, text, sourceLabel) {
    var candidates = extractJsonCandidates(text);
    candidates.forEach(function (c) {
      ingestNode(c, null, null, null, sourceLabel || "auto-diagnostic", url, 0);
    });
    return candidates.length > 0;
  }

  function discoverScriptUrls(html, baseUrl) {
    var urls = [];
    var re = /<script[^>]+src=["']([^"']+)["']/gi;
    var m;

    while ((m = re.exec(html)) !== null && urls.length < 40) {
      var src = m[1];
      if (/^https?:\/\//i.test(src) || src.charAt(0) === "/" || /^[\w./-]+\.js(?:\?|$)/i.test(src)) {
        urls.push(resolveUrl(baseUrl, src));
      }
    }

    return unique(urls);
  }

  function loadCatalogConfig() {
    var cfg = loadWithMigration(KEYS.CATALOG_CFG, OLD_KEYS.CATALOG_CFG, null);
    if (cfg) {
      CONFIG.catalog = Object.assign({}, CONFIG.catalog, cfg);
    }
  }

  function saveCatalogConfigFromUi() {
    CONFIG.catalog.vehicleUrl = (q("#vehicleCatalogUrl") || {}).value || CONFIG.catalog.vehicleUrl;
    CONFIG.catalog.engineUrl = (q("#engineCatalogUrl") || {}).value || CONFIG.catalog.engineUrl;
    CONFIG.catalog.autoBaseUrl = (q("#autoBaseUrl") || {}).value || CONFIG.catalog.autoBaseUrl;
    CONFIG.catalog.nhtsaEnabled = !!(q("#nhtsaEnabled") || {}).checked;

    var eps = (q("#autoEndpoints") || {}).value || "";
    CONFIG.catalog.endpoints = String(eps)
      .split(/[\n,]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });

    save(KEYS.CATALOG_CFG, CONFIG.catalog);
    toast("Configuration catalogue enregistrée.", "success");
  }

  function renderCatalogConfig() {
    if (q("#vehicleCatalogUrl")) q("#vehicleCatalogUrl").value = CONFIG.catalog.vehicleUrl || "";
    if (q("#engineCatalogUrl")) q("#engineCatalogUrl").value = CONFIG.catalog.engineUrl || "";
    if (q("#autoBaseUrl")) q("#autoBaseUrl").value = CONFIG.catalog.autoBaseUrl || "";
    if (q("#autoEndpoints")) q("#autoEndpoints").value = (CONFIG.catalog.endpoints || []).join("\n");
    if (q("#nhtsaEnabled")) q("#nhtsaEnabled").checked = !!CONFIG.catalog.nhtsaEnabled;
  }

  function seedBaseCatalog() {
    BASE_BRANDS.forEach(function (b) { addBrand(b, BRAND_ALIASES[normKey(b)], "base locale", ""); });

    [
      {
        b: "Skoda", m: "Elroq|Enyaq", y: "2021-2026",
        e: "Batterie haute tension / BMS / autonomie", p: "55 kWh|63 kWh|77 kWh",
        s: "autonomie reduite|soh|charge lente|charge impossible|deséquilibre cellules|erreur BMS|temperature batterie|voyant batterie|perte autonomie|batterie froide|chauffe batterie|gonflement batterie|odeur brulee|fumee",
        sev: "critique", wf: 0.92,
        n: "Plateforme MEB : surveillance BMS, cellules, gestion thermique, dégradation d'autonomie et cohérence entre capacité annoncée et usage réel.",
        law: "Sécurité L.423-1 C.consom.; conformité L.217-4 C.consom.; produits défectueux art. 1245 C.civ.; vice caché art. 1641 C.civ.",
        rec: "Rappels EV/MEB; DGCCRF; KBA; NHTSA; fiches auto-diagnostic; vérification VIN; lecture SOH/BMS.",
        tg: "batterie|charge|autonomie|electricite|securite|logiciel|MEB",
        dtc: "P0Axx|U1xxx|P1xxx|B1xxx", et: "Électrique"
      },
      {
        b: "Skoda", m: "Elroq|Enyaq", y: "2021-2026",
        e: "Recharge AC/DC / port de charge / isolation haute tension", p: "N/A",
        s: "charge AC|charge DC|cable|port de charge|verrou|recharge impossible|charge lente|ISO|isolation HV|erreur recharge|thermal derating|echauffement prise|odeur brulee|fumee",
        sev: "critique", wf: 0.9,
        n: "Défaut possible de charge AC/DC, verrouillage, câble, port, isolation haute tension ou bridage thermique.",
        law: "Sécurité L.423-1 C.consom.; conformité L.217-4 C.consom.; produits défectueux art. 1245 C.civ.; tromperie L.213-1 C.consom.",
        rec: "Rappels recharge EV; DGCCRF; KBA; NHTSA; essais de charge documentés.",
        tg: "charge|batterie|electricite|securite|HV|recharge",
        dtc: "U1xxx|P0Axx|C1xxx", et: "Électrique"
      },
      {
        b: "Skoda", m: "Elroq|Enyaq", y: "2021-2026",
        e: "Logiciel / OTA / calculateurs / ADAS / Travel Assist", p: "N/A",
        s: "logiciel|OTA|mise a jour|freeze|redemarrage|voyant multiple|erreur software|Travel Assist|ADAS|camera|radar|lane keeping|emergency brake|calibration|phantom braking",
        sev: "critique", wf: 0.88,
        n: "Les véhicules MEB reposent fortement sur logiciels, calculateurs, ADAS, caméra, radar et mises à jour OTA.",
        law: "Conformité L.217-4 C.consom.; sécurité L.423-1 C.consom.; produits défectueux art. 1245 C.civ.",
        rec: "TSB logiciels; rappels ADAS/OTA; DGCCRF; KBA; NHTSA; Euro NCAP.",
        tg: "logiciel|OTA|ADAS|camera|radar|securite|electricite",
        dtc: "U0xxx|U1xxx|P1xxx|C2xxx", et: "Électrique"
      },
      {
        b: "Renault", m: "Clio|Megane|Scenic|Duster|Kangoo|Trafic|Master", y: "2017-2022",
        e: "K9K / 1.5 dCi", p: "75ch-110ch",
        s: "casse bielle|claquement moteur|usure coussinets|pompe a huile|bruit metallique|pression huile basse|voyant huile|calage",
        sev: "critique", wf: 0.9,
        n: "Risque de casse bielle/coussinets lié à la lubrification et à la pompe à huile.",
        law: "Vice caché 1641 C.civ.; tromperie L.213-1; responsabilité contractuelle 1231-1 C.civ.",
        rec: "Programme technique Renault K9K; TSB; jurisprudences",
        tg: "moteur|huile|bielle|pompe|bruit|critique", et: "Diesel"
      },
      {
        b: "Peugeot", m: "208|2008|308|3008|5008|Partner|Rifter|Boxer", y: "2017-2024",
        e: "EB2 / 1.2 PureTech", p: "100ch-155ch",
        s: "courroie distribution|wet belt|desagregration courroie|crepine pompe|casse moteur|bruit cliquetis|voyant pression huile|consommation huile|surchauffe|mode degrade",
        sev: "critique", wf: 0.85,
        n: "Courroie humide qui se désagrège, bouche la crépine de pompe à huile et peut casser le moteur.",
        law: "Vice caché 1641 C.civ.; tromperie L.213-1; pratique commerciale trompeuse L.121-2.",
        rec: "Extension garantie Stellantis PureTech; TSB; DGCCRF",
        tg: "moteur|distribution|courroie|huile|pompe|critique", et: "Essence"
      },
      {
        b: "Tesla", m: "Model 3|Model Y|Model S|Model X", y: "2017-2027",
        e: "Électrique", p: "283ch-1020ch",
        s: "Autopilot|FSD|phantom braking|12V battery|charging port|door handle|software|battery degradation|thermal|range|ADAS|camera|radar",
        sev: "critique", wf: 0.92,
        n: "ADAS, batterie 12V, port de charge, dégradation batterie, logiciels, poignées, gestion thermique.",
        law: "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245; pénal si accident.",
        rec: "NHTSA Tesla recalls; DGCCRF; SafetyGate",
        tg: "ADAS|batterie|charge|logiciel|securite", et: "Électrique"
      }
    ].forEach(function (d) { addDefect(d, "base locale", ""); });
  }

  function loadStoredTechnicalUpdates() {
    var oldTech = loadWithMigration(KEYS.TECH_UPDATES, OLD_KEYS.TECH_UPDATES, []) || [];
    oldTech.forEach(function (d) { addDefect(d, "base locale stockée", ""); });
  }

  function loadImportedCatalog() {
    var raw = loadWithMigration(KEYS.IMPORTED_RAW, OLD_KEYS.IMPORTED_RAW, []) || [];
    raw.forEach(function (json) {
      try { ingestNode(json, null, null, null, "import-admin", "import", 0); } catch (e) {}
    });
  }

  function catalogSnapshot() {
    return {
      brands: Object.keys(catalog.brands).length,
      models: catalog.models.length,
      engines: catalog.engines.length,
      defects: catalog.defects.length
    };
  }

  function loadLocalCatalogs() {
    var tasks = [];

    tasks.push(
      fetchJson(CONFIG.catalog.vehicleUrl)
        .then(function (json) { ingestNode(json, null, null, null, "catalogue local", CONFIG.catalog.vehicleUrl, 0); })
        .catch(function () {})
    );

    tasks.push(
      fetchJson(CONFIG.catalog.engineUrl)
        .then(function (json) { ingestNode(json, null, null, null, "catalogue local", CONFIG.catalog.engineUrl, 0); })
        .catch(function () {})
    );

    tasks.push(
      fetchJson(CONFIG.catalog.technicalUrl)
        .then(function (json) {
          ingestNode(json, null, null, null, "mise à jour JSON", CONFIG.catalog.technicalUrl, 0);
          save(KEYS.LAST_UPDATE, Date.now());
        })
        .catch(function () {})
    );

    return Promise.all(tasks);
  }

  function nhtsaMake(brand) {
    var s = String(brand || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    var map = {
      "RANGE ROVER": "LAND ROVER",
      "MERCEDES BENZ": "MERCEDES-BENZ",
      "CITROEN": "CITROEN",
      "SKODA": "SKODA",
      "VOLKSWAGEN": "VOLKSWAGEN"
    };
    return map[s] || s;
  }

  function fetchNhtsaModels(brand) {
    if (!CONFIG.catalog.nhtsaEnabled || !window.fetch || !brand) return Promise.resolve([]);

    var make = nhtsaMake(brand);
    var url = "https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/" + encodeURIComponent(make) + "?format=json";

    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var results = (data && data.Results) || [];
        return results.map(function (r) {
          return {
            id: normKey(brand) + "|" + normKey(r.Model_Name),
            brand: brand,
            name: r.Model_Name,
            years: "1990-2026",
            source: "NHTSA vPIC"
          };
        }).filter(function (x) { return x.name; });
      })
      .catch(function () {
        return [];
      });
  }

  function loadAutoDiagnostic(manual) {
    if (!window.fetch) return Promise.resolve(false);

    updateDataStatus(manual ? "Synchronisation auto-diagnostic..." : "Auto-diagnostic en arrière-plan...");

    var before = catalogSnapshot();
    var baseUrl = CONFIG.catalog.autoBaseUrl;
    var endpoints = CONFIG.catalog.endpoints || [];
    var scriptUrls = CONFIG.catalog.scriptUrls || [];
    var tasks = [];

    endpoints.forEach(function (ep) {
      var url = resolveUrl(baseUrl, ep);
      tasks.push(
        fetchJson(url)
          .then(function (json) {
            ingestNode(json, null, null, null, "auto-diagnostic", url, 0);
            return true;
          })
          .catch(function () {
            return fetchText(url)
              .then(function (text) {
                return ingestAutoText(url, text, "auto-diagnostic");
              })
              .catch(function () {
                return false;
              });
          })
      );
    });

    scriptUrls.forEach(function (sp) {
      var url = resolveUrl(baseUrl, sp);
      tasks.push(
        fetchText(url)
          .then(function (text) {
            var found = ingestAutoText(url, text, "auto-diagnostic");

            if (/index\.html$/i.test(url)) {
              var discovered = discoverScriptUrls(text, baseUrl);
              discovered.forEach(function (su) {
                tasks.push(
                  fetchText(su)
                    .then(function (stext) {
                      return ingestAutoText(su, stext, "auto-diagnostic");
                    })
                    .catch(function () { return false; })
                );
              });
            }

            return found;
          })
          .catch(function () {
            return false;
          })
      );
    });

    return Promise.all(tasks).then(function () {
      autoLastSync = Date.now();
      save(KEYS.AUTO_LAST_SYNC, autoLastSync);

      var after = catalogSnapshot();
      var added = {
        models: Math.max(0, after.models - before.models),
        engines: Math.max(0, after.engines - before.engines),
        defects: Math.max(0, after.defects - before.defects)
      };

      clearEngineCache();
      updateAdminStats();
      refreshSelectorsFromCatalog();

      var ok = added.models + added.engines + added.defects > 0;
      updateDataStatus(ok
        ? "Auto-diagnostic synchronisé • +modèles: " + added.models + " • +motorisations: " + added.engines + " • +fiches: " + added.defects
        : "Auto-diagnostic : aucune nouvelle donnée exploitable trouvée");

      if (manual) {
        toast(ok
          ? "Auto-diagnostic renforcé : +" + added.engines + " motorisation(s), +" + added.defects + " fiche(s)."
          : "Aucune nouvelle donnée auto-diagnostic exploitable trouvée.",
          ok ? "success" : "warning");
      }

      return ok;
    }).catch(function (err) {
      console.warn("[AR-EXPERT] Sync auto-diagnostic impossible:", err);
      updateDataStatus("Auto-diagnostic indisponible — base locale conservée");
      if (manual) toast("Synchronisation auto-diagnostic impossible.", "warning");
      return false;
    });
  }

  function loadCatalogs(manual) {
    updateDataStatus(manual ? "Chargement des catalogues..." : "Chargement des catalogues en arrière-plan...");

    return loadLocalCatalogs()
      .then(function () {
        return loadAutoDiagnostic(manual);
      })
      .then(function () {
        clearEngineCache();
        updateAdminStats();
        refreshSelectorsFromCatalog();
        updateDataStatus("Catalogue chargé • Marques: " + getAllBrands().length + " • Modèles: " + catalog.models.length + " • Motorisations: " + catalog.engines.length + " • Fiches: " + catalog.defects.length);
        if (manual) toast("Catalogues rechargés et renforcés.", "success");
      })
      .catch(function (err) {
        console.warn("[AR-EXPERT] Chargement catalogue impossible:", err);
        updateDataStatus("Mode autonome : catalogue local partiel");
        if (manual) toast("Chargement catalogue impossible. Base locale conservée.", "warning");
      });
  }

  function refreshSelectorsFromCatalog() {
    if (selection.brand) {
      loadModelsForBrand(selection.brand.name, false);
    } else {
      renderBrandPanel();
    }
  }

  /* =========================================================
     UI DROPDOWN
     ========================================================= */
  function closeAllCombos(exceptId) {
    ["brandPanel", "modelPanel", "enginePanel"].forEach(function (id) {
      if (id === exceptId) return;
      var el = q("#" + id);
      if (el) el.classList.add("hidden");
    });
  }

  function renderBrandPanel() {
    var input = q("#brandInput");
    var panel = q("#brandPanel");
    if (!input || !panel) return;

    var val = norm(input.value);
    var brands = getAllBrands().filter(function (b) {
      if (!val) return true;
      if (norm(b.name).indexOf(val) >= 0) return true;
      return b.aliases.some(function (a) { return norm(a).indexOf(val) >= 0; });
    }).slice(0, 60);

    if (!brands.length) {
      panel.innerHTML = '<div class="combo-empty">Aucune marque trouvée.</div>';
      panel.classList.remove("hidden");
      return;
    }

    panel.innerHTML = brands.map(function (b) {
      return '<button type="button" class="suggest-item" data-brand="' + esc(b.name) + '">' + esc(b.name) + '</button>';
    }).join("");

    panel.classList.remove("hidden");
  }

  function selectBrand(name) {
    selection.brand = { name: name };
    selection.model = null;
    selection.engine = null;

    var input = q("#brandInput");
    if (input) input.value = name;

    closeAllCombos();
    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
    loadModelsForBrand(name, true);
  }

  function updateModelButton() {
    var btn = q("#modelButton");
    if (!btn) return;

    if (!selection.brand) {
      btn.disabled = true;
      btn.textContent = "Choisir d’abord une marque";
      return;
    }

    if (selection.model) {
      btn.disabled = false;
      btn.textContent = selection.model.name + (selection.model.years ? " • " + selection.model.years : "");
    } else {
      btn.disabled = false;
      btn.textContent = "Choisir un modèle";
    }
  }

  function updateEngineButton() {
    var btn = q("#engineButton");
    if (!btn) return;

    if (!selection.brand || !selection.model) {
      btn.disabled = true;
      btn.textContent = !selection.brand ? "Choisir d’abord une marque" : "Choisir d’abord un modèle";
      return;
    }

    if (selection.engine) {
      btn.disabled = false;
      btn.textContent = engineLabel(selection.engine);
    } else {
      btn.disabled = false;
      btn.textContent = "Choisir une motorisation";
    }
  }

  function engineLabel(o) {
    var parts = [];
    if (o.fuel) parts.push(o.fuel);
    if (o.engine) parts.push(o.engine);
    if (o.displacement) parts.push(o.displacement);
    if (o.power && o.power !== "N/A") parts.push(o.power);
    if (o.transmission) parts.push(o.transmission);
    if (o.code) parts.push(o.code);
    if (o.years) parts.push(o.years);

    if (o.source && norm(o.source).indexOf("heuristique") >= 0) parts.push("à confirmer");
    else if (o.source && o.source !== "catalogue local") parts.push(o.source);

    return parts.join(" • ");
  }

  function modelLabel(o) {
    var parts = [o.name];
    if (o.years) parts.push(o.years);
    if (o.source && o.source !== "catalogue local") parts.push(o.source);
    return parts.join(" • ");
  }

  function renderModelList(filter) {
    var list = q("#modelList");
    if (!list) return;

    var f = norm(filter || "");
    currentModelOptions = modelOptions.filter(function (o) {
      if (!f) return true;
      return norm(modelLabel(o)).indexOf(f) >= 0;
    });

    if (!currentModelOptions.length) {
      list.innerHTML = '<div class="combo-empty">Aucun modèle trouvé.</div>';
      return;
    }

    list.innerHTML = currentModelOptions.map(function (o, i) {
      return '<button type="button" class="combo-option" data-model-index="' + i + '">' + esc(modelLabel(o)) + '</button>';
    }).join("");
  }

  function renderEngineList(filter) {
    var list = q("#engineList");
    if (!list) return;

    var f = norm(filter || "");
    currentEngineOptions = engineOptions.filter(function (o) {
      if (!f) return true;
      return norm(engineLabel(o)).indexOf(f) >= 0;
    });

    if (!currentEngineOptions.length) {
      list.innerHTML = '<div class="combo-empty">Aucune motorisation trouvée.</div>';
      return;
    }

    list.innerHTML = currentEngineOptions.map(function (o, i) {
      return '<button type="button" class="combo-option" data-engine-index="' + i + '">' + esc(engineLabel(o)) + '</button>';
    }).join("");
  }

  function loadModelsForBrand(brand, showLoading) {
    var token = ++modelLoadToken;
    var year = parseYear((q("#vehicleYear") || {}).value);
    var local = getModels(brand, year);

    if (showLoading && local.length < 5) {
      modelOptions = local.concat([{
        id: "__loading__",
        brand: brand,
        name: "Chargement des modèles...",
        years: "",
        source: "auto-diagnostic / NHTSA"
      }]);
      renderModelList("");
      updateModelButton();
    } else {
      modelOptions = local;
      renderModelList("");
      updateModelButton();
    }

    if (CONFIG.catalog.nhtsaEnabled && local.length < 10) {
      fetchNhtsaModels(brand).then(function (remote) {
        if (token !== modelLoadToken) return;

        var merged = local.slice();
        var seen = {};
        merged.forEach(function (m) { seen[m.id] = true; });

        remote.forEach(function (m) {
          if (!seen[m.id]) {
            seen[m.id] = true;
            merged.push(m);
          }
        });

        merged.sort(function (a, b) {
          return norm(a.name).localeCompare(norm(b.name));
        });

        modelOptions = merged;
        renderModelList((q("#modelSearch") || {}).value || "");
        updateModelButton();
        updateAdminStats();
      });
    }

    refreshEngineOptions();
  }

  function selectModel(opt) {
    if (!opt || opt.id === "__loading__") return;

    selection.model = opt;
    selection.engine = null;

    closeAllCombos();
    updateModelButton();
    refreshEngineOptions();
    updateSelectionSummary();
  }

  function refreshEngineOptions() {
    if (!selection.brand || !selection.model) {
      engineOptions = [];
      currentEngineOptions = [];
      updateEngineButton();
      return;
    }

    var year = parseYear((q("#vehicleYear") || {}).value);
    var engines = getEnginesFor(selection.brand.name, selection.model.name, year);

    if (!engines.length) {
      engines.push({
        id: "__unknown_engine__",
        brand: selection.brand.name,
        model: selection.model.name,
        engine: "Autre / non précisée",
        displacement: "",
        power: "N/A",
        fuel: "Non précisé / mixte",
        transmission: "",
        code: "",
        years: year ? String(year) : "",
        source: "manuel",
        sourceUrl: "",
        confidence: 0.4
      });
    }

    engineOptions = engines;
    renderEngineList("");
    updateEngineButton();
  }

  function selectEngine(opt) {
    if (!opt) return;

    selection.engine = opt;

    closeAllCombos();
    updateEngineButton();
    updateSelectionSummary();
  }

  function updateSelectionSummary() {
    var el = q("#selectionSummary");
    if (!el) return;

    var v = getSelectedVehicleData();

    if (!v.marque && !v.modele && !v.annee && !v.engine) {
      el.textContent = "Aucune sélection véhicule complète.";
      return;
    }

    var parts = [];
    if (v.marque) parts.push(v.marque);
    if (v.modele) parts.push(v.modele);
    if (v.annee) parts.push(v.annee);
    if (v.engine) parts.push(v.engine);
    if (v.displacement) parts.push(v.displacement);
    if (v.power && v.power !== "N/A") parts.push(v.power);
    if (v.fuel) parts.push(v.fuel);
    if (v.transmission) parts.push(v.transmission);
    if (v.code) parts.push(v.code);

    el.textContent = "Sélection retenue : " + parts.join(" • ");
  }

  function getSelectedVehicleData() {
    var brandEl = q("#brandInput");
    var yearEl = q("#vehicleYear");
    var kmEl = q("#vehicleKilometrage");
    var vinEl = q("#vehicleVin");

    return {
      marque: selection.brand ? selection.brand.name : (brandEl ? brandEl.value.trim() : ""),
      modele: selection.model ? selection.model.name : "",
      annee: yearEl ? yearEl.value.trim() : "",
      engine: selection.engine && selection.engine.id !== "__unknown_engine__" ? selection.engine.engine : "",
      displacement: selection.engine ? selection.engine.displacement : "",
      power: selection.engine && selection.engine.id !== "__unknown_engine__" ? selection.engine.power : "",
      fuel: selection.engine && selection.engine.id !== "__unknown_engine__" ? selection.engine.fuel : "",
      transmission: selection.engine ? selection.engine.transmission : "",
      code: selection.engine ? selection.engine.code : "",
      engineSource: selection.engine ? selection.engine.source : "",
      engineSourceUrl: selection.engine ? selection.engine.sourceUrl : "",
      kilometrage: kmEl ? kmEl.value.trim() : "",
      vin: vinEl ? vinEl.value.trim() : ""
    };
  }

  /* =========================================================
     ANALYSE / RAPPORT
     ========================================================= */
  function addTerm() {
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (t) { termesMobilises.add(t); });
    return '<span class="termes-juridiques">(' + args.join(", ") + ")</span>";
  }

  function extractDtcCodes(text) {
    var m = String(text || "").match(/\b[PCBU][0-9A-F]{4}\b/gi) || [];
    return unique(m.map(function (x) { return x.toUpperCase(); }));
  }

  function powerTokens(p) {
    return String(p || "")
      .split(/[^a-z0-9]+/i)
      .map(function (x) { return norm(x); })
      .filter(function (x) { return x.length > 1; });
  }

  function legalForDefect(d) {
    var laws = [];
    if (d.law) laws.push(d.law);

    var tags = norm(d.tg || "");
    var symptoms = norm(d.s || "");
    var sev = d.sev || "moyen";
    var type = norm(d.et || "");

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

    if (tags.indexOf("incendie") >= 0 || symptoms.indexOf("incendie") >= 0 || symptoms.indexOf("airbag") >= 0) {
      laws.push("Mise en danger art. 223-1 C.pénal.");
      laws.push("Homicide/blessures involontaires art. 221-6 / 222-19 C.pénal en cas d’accident.");
    }

    if (tags.indexOf("adas") >= 0 || symptoms.indexOf("autopilot") >= 0 || symptoms.indexOf("phantom") >= 0) {
      laws.push("Sécurité des systèmes automatisés L.423-1 C.consom.");
      laws.push("Responsabilité du constructeur/art. 1245 C.civ.");
    }

    return laws.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" | ");
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

  function matchDefects(v, text) {
    var txt = norm(text);
    var yr = parseYear(v.annee);
    var km = parseKm(v.kilometrage);
    var dtcCodes = extractDtcCodes(text);
    var results = [];

    catalog.defects.forEach(function (d) {
      if (v.marque && !brandMatches(d.b, v.marque)) return;
      if (!yearMatches(d.y, yr)) return;
      if (v.modele && d.m && d.m !== "*" && !modelListContains(d.m, v.modele)) return;

      var score = 0;
      var found = [];

      String(d.s || "").split("|").forEach(function (s) {
        if (symptomMatch(txt, s)) {
          score++;
          found.push(s);
        }
      });

      score += tagBoost(txt, d.tg);

      if (v.modele && d.m && d.m !== "*" && modelListContains(d.m, v.modele)) score += 2;
      if (yr && yearMatches(d.y, yr)) score += 1;

      if (v.engine && d.e) {
        if (normKey(v.engine) === normKey(d.e)) score += 5;
        else if (norm(d.e).indexOf(norm(v.engine)) >= 0 || norm(v.engine).indexOf(norm(d.e)) >= 0) score += 3;
      }

      if (v.displacement && containsAny(d.e + " " + d.n + " " + d.tg, [v.displacement])) score += 2;

      if (v.power && d.p) {
        var sel = powerTokens(v.power);
        var def = powerTokens(d.p);
        if (sel.some(function (x) { return def.indexOf(x) >= 0; })) score += 2;
      }

      if (v.fuel && norm(d.et) === norm(v.fuel)) score += 3;

      if (v.transmission && containsAny(d.tg + " " + d.e + " " + d.n, [v.transmission])) score += 1;

      if (v.code && containsAny(d.e + " " + d.n + " " + d.tg + " " + d.dtc, [v.code])) score += 2;

      if (dtcCodes.length && d.dtc) {
        var dd = norm(d.dtc);
        if (dtcCodes.some(function (c) { return dd.indexOf(norm(c)) >= 0; })) score += 3;
      }

      if (v.fuel && isElectricLike(v.fuel) && containsAny(d.tg + " " + d.s, ["batterie", "charge", "autonomie", "electricite", "hybride", "48v"])) {
        score += 2;
      }

      if (norm(v.fuel) === "diesel" && containsAny(d.tg + " " + d.s, ["diesel", "egr", "fap", "adblue", "nox", "pollution"])) {
        score += 2;
      }

      if (norm(v.fuel) === "essence" && containsAny(d.tg + " " + d.s, ["essence", "turbo", "huile", "distribution", "courroie", "chaine"])) {
        score += 1.5;
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
          baseLegale: legalForDefect(d),
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

    return results.sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
  }

  function engineAngle(flags) {
    var h = "";

    if (flags.engine) {
      h += '<div class="rappel-info"><h4>🧰 Motorisation retenue pour l’analyse</h4>';
      h += "<p><strong>Motorisation :</strong> " + esc(flags.engine) + "</p>";
      h += "<p><strong>Cylindrée / capacité :</strong> " + esc(flags.displacement || "non précisée") + "</p>";
      h += "<p><strong>Puissance :</strong> " + esc(flags.power || "non précisée") + "</p>";
      h += "<p><strong>Énergie :</strong> " + esc(flags.fuel || "non précisée") + "</p>";
      h += "<p><strong>Transmission / boîte :</strong> " + esc(flags.transmission || "non précisée") + "</p>";
      h += "<p><strong>Code moteur / système :</strong> " + esc(flags.code || "non communiqué") + "</p>";
      h += "<p><strong>Source motorisation :</strong> " + esc(flags.engineSource || "non précisée") + "</p>";
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
    var fuelNorm = norm(vehicleData.fuel || "");

    var flags = {
      engine: vehicleData.engine || "",
      displacement: vehicleData.displacement || "",
      power: vehicleData.power || "",
      fuel: vehicleData.fuel || "",
      transmission: vehicleData.transmission || "",
      code: vehicleData.code || "",
      engineSource: vehicleData.engineSource || "",
      professional: sellerType === "professional" || containsAny(all, ["professionnel", "garage", "concession", "revendeur", "automobile", "commercial"]),
      privateSeller: sellerType === "private" || containsAny(all, ["particulier", "entre particuliers", "leboncoin", "lavitrine"]),
      waterLeak: containsAny(all, ["eau", "humidité", "infiltration", "baie", "pare brise", "pare-brise", "moisiure", "court circuit", "traces d’eau", "flaque", "égouttement"]),
      safety: containsAny(all, ["sécurité", "frein", "airbag", "direction", "incendie", "danger", "vie", "intégrité physique", "mise en danger", "ADAS", "autopilot"]),
      ev: isElectricLike(fuelNorm) || containsAny(all, ["batterie", "charge", "autonomie", "electrique", "électrique", "hybride", "BMS", "DC", "AC", "recharge"]),
      diesel: fuelNorm.indexOf("diesel") >= 0 || containsAny(allNorm, ["diesel", "egr", "fap", "adblue", "nox", "gasoil"]),
      petrol: fuelNorm.indexOf("essence") >= 0 || containsAny(allNorm, ["essence", "turbo", "puretech", "tce", "tsi", "ecoboost"]),
      hybrid: fuelNorm.indexOf("hybride") >= 0,
      phev: fuelNorm.indexOf("rechargeable") >= 0,
      mild48: fuelNorm.indexOf("48v") >= 0,
      electricLike: isElectricLike(fuelNorm),
      dtc: /\bp[0-9a-z]{3,5}\b/i.test(all) || allNorm.indexOf("dtc") >= 0 || allNorm.indexOf("code défaut") >= 0,
      invoice: all.indexOf("facture") >= 0,
      repair: all.indexOf("réparation") >= 0 || all.indexOf("ordre de réparation") >= 0 || all.indexOf("devis") >= 0,
      controlTech: all.indexOf("contrôle technique") >= 0 || all.indexOf(" ct ") >= 0,
      warranty: all.indexOf("garantie") >= 0,
      highKm: parseKm(vehicleData.kilometrage) > 120000,
      veryHighKm: parseKm(vehicleData.kilometrage) > 180000
    };

    var matches = matchDefects(vehicleData, text);

    analysisData = {
      date: new Date().toLocaleString("fr-FR"),
      vehicleData: vehicleData,
      flags: flags,
      matches: matches,
      sections: []
    };

    var S = [];
    S.push(["I. IDENTIFICATION DU VÉHICULE ET SÉLECTIONS RENFORCÉES", secIdentification(text, context)]);
    S.push(["II. ANALYSE TECHNIQUE — MOTORISATION, DÉFAUTS CONNUS, USURE, SÉCURITÉ", secTechnique(matches, flags, vehicleData)]);
    S.push(["III. APPUI AUTO-DIAGNOSTIC ET FICHES CORRÉLÉES", secAuto(matches, flags)]);
    S.push(["IV. QUALIFICATION JURIDIQUE, RISQUES ET RÉGIMES DE GARANTIE", secJuridique(flags, matches, vehicleData)]);
    S.push(["V. PREUVE, STRATÉGIE ET VÉRIFICATIONS EXTERNES", secPreuve(matches, flags, objective)]);
    S.push(["VI. CONCLUSION ORIENTÉE INGÉNIEUR / JURISTE / SÉCURITÉ", secConclusion(objective, matches, flags, vehicleData)]);
    S.push(["VII. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ", secLexique()]);

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

  function secIdentification(text, context) {
    var h = "<p><strong>Objet :</strong> recensement des éléments fournis " + addTerm("éléments factuels", "faits allégués") + ".</p>";

    var availableEngines = [];
    if (vehicleData.marque && vehicleData.modele) {
      availableEngines = getEnginesFor(vehicleData.marque, vehicleData.modele, parseYear(vehicleData.annee));
    }

    h += "<h4>A. Véhicule sélectionné</h4><ul>";
    h += "<li><strong>Marque :</strong> " + esc(vehicleData.marque || "non précisée") + "</li>";
    h += "<li><strong>Modèle :</strong> " + esc(vehicleData.modele || "non précisé") + "</li>";
    h += "<li><strong>Année :</strong> " + esc(vehicleData.annee || "non précisée") + " " + addTerm("millésime", "date de première mise en circulation") + "</li>";
    h += "<li><strong>Motorisation :</strong> " + esc(vehicleData.engine || "non précisée") + "</li>";
    h += "<li><strong>Cylindrée / capacité :</strong> " + esc(vehicleData.displacement || "non précisée") + "</li>";
    h += "<li><strong>Puissance :</strong> " + esc(vehicleData.power || "non précisée") + "</li>";
    h += "<li><strong>Énergie :</strong> " + esc(vehicleData.fuel || "non précisée") + "</li>";
    h += "<li><strong>Transmission / boîte :</strong> " + esc(vehicleData.transmission || "non précisée") + "</li>";
    h += "<li><strong>Code moteur / système :</strong> " + esc(vehicleData.code || "non communiqué") + "</li>";
    h += "<li><strong>Motorisations renforcées disponibles pour ce modèle/année :</strong> " + availableEngines.length + "</li>";
    h += "<li><strong>Kilométrage :</strong> " + esc(vehicleData.kilometrage || "non précisé") + " km " + addTerm("kilométrage", "usure normale", "vétusté") + "</li>";
    h += "<li><strong>VIN :</strong> " + esc(vehicleData.vin || "non communiqué") + " " + addTerm("VIN", "numéro de série", "traçabilité") + "</li>";
    h += "</ul>";

    if (availableEngines.length) {
      h += "<h4>B. Motorisations disponibles retenues par le moteur ingénieur</h4><ul>";
      availableEngines.slice(0, 20).forEach(function (e) {
        h += "<li>" + esc(engineLabel(e)) + "</li>";
      });
      if (availableEngines.length > 20) h += "<li>… " + (availableEngines.length - 20) + " autre(s) motorisation(s) disponible(s)</li>";
      h += "</ul>";
    }

    h += "<h4>C. Faits rapportés</h4>";
    h += "<p>" + esc(text.substring(0, 1400)) + (text.length > 1400 ? " [...] (tronqué pour affichage, analyse complète conservée en mémoire)" : "") + "</p>";

    if (context) {
      h += "<h4>D. Contexte transactionnel</h4><p>" + esc(context.substring(0, 1000)) + "</p>";
    }

    h += '<div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ' + addTerm("faits non vérifiés", "principe du contradictoire") + ".</div>";
    return h;
  }

  function secTechnique(matches, flags, vData) {
    var km = parseKm(vData.kilometrage);
    var yr = parseYear(vData.annee);
    var age = new Date().getFullYear() - (yr || new Date().getFullYear());

    var h = engineAngle(flags);

    if (!matches.length) {
      h += "<p><strong>Objet :</strong> recherche de défauts conceptuels connus " + addTerm("défauts conceptuels", "problèmes récurrents", "défaut de série") + ".</p>";
      h += '<div class="verification-needed">';
      h += "<p>Aucune correspondance exacte trouvée dans la base locale / auto-diagnostic pour Marque/Modèle/Année/Motorisation/Puissance/Cylindrée/Code/Symptômes.</p>";
      h += "<p>Cela ne signifie pas absence de défaut, mais absence de notoriété suffisante dans les sources consolidées localement.</p>";
      h += "<p>Une expertise individuelle est nécessaire " + addTerm("expertise individuelle", "analyse fonctionnelle", "recherche de cause racine") + ".</p>";
      h += "</div>";
      return h;
    }

    h += "<p><strong>Objet :</strong> croisement technique local avec motorisation, cylindrée, puissance, énergie, code moteur, défauts connus, rappels, TSB, forums spécialisés, DGCCRF, NHTSA, SafetyGate, KBA, auto-diagnostic et bases de sécurité " + addTerm("vice caché notoire", "défaut de série", "défaut de conception") + ".</p>";

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

  function secAuto(matches, flags) {
    var autoMatches = matches.filter(function (m) {
      return m.source === "auto-diagnostic";
    });

    var autoCount = catalog.defects.filter(function (d) { return d.source === "auto-diagnostic"; }).length;
    var autoEngineCount = catalog.engines.filter(function (e) { return e.source === "auto-diagnostic"; }).length;

    var h = "<p><strong>Objet :</strong> appui technique issu de la base auto-diagnostic, corrélé au contexte du litige et à la motorisation " + addTerm("appui technique", "corrélation auto-diagnostic", "fiche expert", "DTC", "motorisation") + ".</p>";

    h += "<p><strong>Entrées auto-diagnostic disponibles :</strong> " + autoCount + " fiche(s) / " + autoEngineCount + " motorisation(s) renforcée(s).</p>";

    if (!autoCount) {
      h += '<div class="verification-needed">';
      h += "<p>La base auto-diagnostic n’a pas encore exposé de données exploitables via JSON ou extraction HTML/JS.</p>";
      h += "<p>URL configurée : <code>" + esc(CONFIG.catalog.autoBaseUrl) + "</code></p>";
      h += "<p>Déposer un export JSON dans l’un des endpoints configurés, ou utiliser : Admin → Base technique → Importer JSON.</p>";
      h += "</div>";
      return h;
    }

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

    h += "</ul></div>";

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

  function secJuridique(flags, matches, vData) {
    var h = "<p><strong>Objet :</strong> qualification juridique, risques et régimes de garantie " + addTerm("qualification juridique", "responsabilité", "garantie") + ".</p>";

    if (flags.professional && !flags.privateSeller) {
      h += '<div class="certainty-high"><p>Vendeur présumé professionnel ' + addTerm("vendeur professionnel") + ". Protection consommateur renforcée : garantie légale de conformité, charge de la preuve allégée, obligation d’information et de vérification des rappels.</p></div>";
    } else if (flags.privateSeller && !flags.professional) {
      h += '<div class="certainty-medium"><p>Vendeur présumé particulier ' + addTerm("vente entre particuliers") + ". Garantie des vices cachés du Code civil. Charge de la preuve plus lourde pour l’acquéreur.</p></div>";
    } else {
      h += '<div class="certainty-low"><p>Statut du vendeur incertain ' + addTerm("ambiguïté statut vendeur") + ". Qualifier d’abord le vendeur avant action.</p></div>";
    }

    h += "<h4>A. Critères cumulatifs</h4>";
    h += "<p><strong>Antériorité :</strong> " + (matches.some(function (m) { return m.confiance === "Haute"; }) ? "renforcée par défaut de série / logiciel / conception." : "à confirmer par expertise.") + " " + addTerm("antériorité") + "</p>";
    h += "<p><strong>Caractère caché :</strong> " + (matches.some(function (m) { return m.wearFactor >= 0.8; }) ? "soutenable, défaut non visible lors d’un examen standard." : "à apprécier concrètement.") + " " + addTerm("caractère caché") + "</p>";
    h += "<p><strong>Gravité :</strong> " + (matches.some(function (m) { return m.severite === "critique"; }) ? "élevée : sécurité, casse, incendie, immobilisation, coût disproportionné." : "à mesurer par devis et usage normal.") + " " + addTerm("gravité") + "</p>";

    h += "<h4>B. Régimes mobilisables</h4><ul>";
    h += "<li>" + addTerm("garantie des vices cachés", "1641 C.civ.") + "</li>";
    if (flags.professional) {
      h += "<li>" + addTerm("garantie légale de conformité", "L.217-4 C.consom.") + "</li>";
      h += "<li>" + addTerm("responsabilité contractuelle", "1231-1 C.civ.") + "</li>";
      h += "<li>" + addTerm("tromperie", "L.213-1 C.consom.") + "</li>";
      h += "<li>" + addTerm("pratique commerciale trompeuse", "L.121-2 C.consom.") + "</li>";
    } else {
      h += "<li>" + addTerm("dol", "1137 C.civ.") + " si dissimulation</li>";
      h += "<li>" + addTerm("obligation d’information précontractuelle", "1112-1 C.civ.") + "</li>";
    }
    h += "<li>" + addTerm("produits défectueux", "1245 C.civ.") + "</li>";
    h += "<li>" + addTerm("défaut de sécurité", "L.423-1 C.consom.") + "</li>";
    h += "</ul>";

    if (flags.diesel) {
      h += "<h4>C. Incidence diesel</h4><ul>";
      h += "<li>Conformité antipollution " + addTerm("L.217-4 C.consom.") + "</li>";
      h += "<li>Tromperie si dispositif illicite ou dissimulation " + addTerm("L.213-1 C.consom.") + "</li>";
      h += "<li>Rappel / campagne technique " + addTerm("DGCCRF", "KBA", "NHTSA") + "</li>";
      h += "</ul>";
    }

    if (flags.electricLike) {
      h += "<h4>D. Incidence électrifiée</h4><ul>";
      h += "<li>Sécurité batterie / charge / BMS " + addTerm("L.423-1 C.consom.") + "</li>";
      h += "<li>Conformité logiciel / autonomie " + addTerm("L.217-4 C.consom.") + "</li>";
      h += "<li>Produits défectueux " + addTerm("1245 C.civ.") + "</li>";
      h += "</ul>";
    }

    return h;
  }

  function researchLinks(brand, model, engine, symptoms, fuel) {
    var baseQuery = (brand + " " + model + " " + (engine || "") + " " + (fuel || "") + " " + (symptoms || []).slice(0, 3).join(" ")).trim();
    var q1 = encodeURIComponent(baseQuery + " défaut panne rappel incendie DTC motorisation puissance cylindrée");
    var q2 = encodeURIComponent(brand + " " + model);

    return [
      { label: "Base auto-diagnostic", url: CONFIG.catalog.autoBaseUrl },
      { label: "Recherche spécialisée Google / forums techniques", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France (DGCCRF)", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls (USA)", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / défauts constructeurs", url: "https://www.google.com/search?q=" + encodeURIComponent(baseQuery + " safetygate TSB rappel défaut") },
      { label: "Rappels allemands KBA", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " KBA Rückruf") },
      { label: "Vérification VIN constructeur", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " VIN recall campaign motorisation") }
    ];
  }

  function secPreuve(matches, flags, objective) {
    var h = "<p><strong>Objet :</strong> dossier probatoire, stratégie et vérifications " + addTerm("preuve documentaire", "stratégie contentieuse") + ".</p>";

    h += "<h4>A. Documents à consolider</h4><ul>";
    h += "<li>Facture d’achat : " + (flags.invoice ? "présente" : "à récupérer") + "</li>";
    h += "<li>Certificat de cession / carte grise : vérifier motorisation, énergie, puissance, cylindrée, kilométrage</li>";
    h += "<li>Contrôle technique : " + (flags.controlTech ? "présent" : "à récupérer") + "</li>";
    h += "<li>Historique entretien / carnet / factures garage</li>";
    h += "<li>Preuve des rappels effectués via VIN</li>";
    h += "<li>Devis réparation (minimum 2)</li>";
    h += "<li>Lecture OBD / codes défaut DTC</li>";
    h += "<li>Rapport auto-diagnostic / fiches expert corrélées</li>";
    h += "<li>Document motorisation : énergie, puissance, cylindrée, code moteur, boîte, logiciel</li>";
    h += "<li>Photos : moisiure, eau, corrosion, voyants, niveaux, batterie, charge</li>";
    h += "</ul>";

    h += "<h4>B. Stratégie recommandée</h4><ol>";
    h += "<li>Expertise amiable contradictoire</li>";
    h += "<li>Devis réparation</li>";
    h += "<li>Lecture OBD / DTC</li>";
    h += "<li>Export / impression des fiches auto-diagnostic corrélées</li>";
    h += "<li>Vérification VIN / rappels / motorisation</li>";
    h += "<li>Mise en demeure LRAR au vendeur</li>";
    if (matches.length) {
      h += "<li>Invoquer le défaut de série documenté " + addTerm("défaut de série", "présomption de connaissance") + "</li>";
    }
    h += "<li>Conciliation / médiation si professionnel</li>";
    h += "<li>Assignation / expertise judiciaire si nécessaire</li>";
    if (matches.some(function (m) { return m.severite === "critique"; })) {
      h += "<li>Signalement DGCCRF / préfet / NHTSA / KBA si danger collectif</li>";
    }
    h += "</ol>";

    var links = researchLinks(
      vehicleData.marque,
      vehicleData.modele,
      matches[0] ? matches[0].moteur : vehicleData.engine,
      matches[0] ? matches[0].symptomes : [],
      vehicleData.fuel
    );

    h += "<h4>C. Pistes de recherche externe</h4><ul>";
    links.forEach(function (l) {
      h += '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + "</a></li>";
    });
    h += "</ul>";

    if (objective) {
      h += "<p><strong>Objectif déclaré :</strong> " + esc(objective) + "</p>";
    }

    return h;
  }

  function secConclusion(objective, matches, flags, vData) {
    var high = matches.some(function (m) { return m.confiance === "Haute"; });
    var critical = matches.some(function (m) { return m.severite === "critique"; });
    var auto = matches.some(function (m) { return m.source === "auto-diagnostic"; });

    var h = "<p><strong>Objet :</strong> conclusion prudente orientée ingénieur / juriste " + addTerm("synthèse", "conclusion") + ".</p>";

    h += "<p><strong>Sélections prises en compte :</strong> " +
      esc(vData.marque || "marque non précisée") + " / " +
      esc(vData.modele || "modèle non précisé") + " / " +
      esc(vData.annee || "année non précisée") + " / " +
      esc(vData.engine || "motorisation non précisée") +
      (vData.displacement ? " / " + esc(vData.displacement) : "") +
      (vData.power && vData.power !== "N/A" ? " / " + esc(vData.power) : "") +
      (vData.fuel ? " / " + esc(vData.fuel) : "") +
      (vData.transmission ? " / " + esc(vData.transmission) : "") +
      (vData.code ? " / code " + esc(vData.code) : "") +
      ".</p>";

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

    if (flags.diesel) {
      h += "<p><strong>Incidence diesel :</strong> la qualification peut mobiliser conformité antipollution, tromperie, rappel et sécurité produit.</p>";
    }

    if (flags.electricLike) {
      h += "<p><strong>Incidence électrifiée :</strong> la qualification peut mobiliser batterie, autonomie, charge, logiciel, sécurité incendie et produits défectueux.</p>";
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
     ADMIN
     ========================================================= */
  function updateDataStatus(msg) {
    var el = q("#dataStatus");
    if (el) el.textContent = msg;
  }

  function updateAdminStats() {
    var statBrands = q("#statBrands");
    var statModels = q("#statModels");
    var statEngines = q("#statEngines");
    var statEntries = q("#statEntries");
    var statAutoEntries = q("#statAutoEntries");
    var statAutoSync = q("#statAutoSync");
    var statSync = q("#statSync");

    var autoCount = catalog.defects.filter(function (d) { return d.source === "auto-diagnostic"; }).length;

    if (statBrands) statBrands.textContent = getAllBrands().length;
    if (statModels) statModels.textContent = catalog.models.length;
    if (statEngines) statEngines.textContent = catalog.engines.length;
    if (statEntries) statEntries.textContent = catalog.defects.length;
    if (statAutoEntries) statAutoEntries.textContent = autoCount;

    if (statAutoSync) statAutoSync.textContent = autoLastSync ? new Date(autoLastSync).toLocaleString("fr-FR") : "Jamais";

    var last = loadWithMigration(KEYS.LAST_UPDATE, OLD_KEYS.LAST_UPDATE, 0);
    if (statSync) statSync.textContent = last ? new Date(last).toLocaleString("fr-FR") : "Jamais";
  }

  function renderRequests() {
    var box = q("#pendingRequests");
    if (!box) return;

    var all = getRequests().slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var pending = all.filter(function (r) { return r.status === "pending"; });
    var processed = all.filter(function (r) { return r.status !== "pending"; }).slice(0, 30);

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
    renderCatalogConfig();
    updateAdminStats();
  }

  /* =========================================================
     PDF / EXPORT
     ========================================================= */
  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.async = true;
      s.onload = function () {
        if (!window.pdfjsLib) return reject(new Error("PDF.js non chargé"));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error("PDF.js indisponible")); };
      document.head.appendChild(s);
    });
  }

  function ensureJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.async = true;
      s.onload = function () {
        if (!window.jspdf || !window.jspdf.jsPDF) return reject(new Error("jsPDF non chargé"));
        resolve(window.jspdf.jsPDF);
      };
      s.onerror = function () { reject(new Error("jsPDF indisponible")); };
      document.head.appendChild(s);
    });
  }

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
      '<p><strong>Motorisation :</strong> ' + esc(vehicleData.engine || "") + ' — ' + esc(vehicleData.displacement || "") + ' — ' + esc(vehicleData.power || "") + ' — ' + esc(vehicleData.fuel || "") + '</p>' +
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

      doc.text("Motorisation : " + (vehicleData.engine || "") + " — " + (vehicleData.displacement || "") + " — " + (vehicleData.power || "") + " — " + (vehicleData.fuel || ""), 20, y);
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
      .then(function () { location.reload(true); })
      .catch(function () { location.reload(true); });
  }

  /* =========================================================
     EVENEMENTS UI
     ========================================================= */
  function shareTextUrl(text, url, title) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () {
        copyFallback(url);
      });
    } else {
      copyFallback(url);
    }
  }

  function copyFallback(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast("Lien copié.", "success");
      }).catch(function () {
        toast("Copie impossible.", "error");
      });
    } else {
      toast("Partage/copie non supporté.", "warning");
    }
  }

  function bindUi() {
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

        setSession({ id: "admin", name: "Administrateur", email: "admin@local", role: "admin", status: "approved" });
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

      shareTextUrl(text, url, "Demande d’accès Expert Auto");
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
          authMessage("Votre demande est en attente de validation admin. Nom enregistré : " + pending.name, "warning");
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

    on("#brandInput", "input", function () {
      selection.brand = null;
      selection.model = null;
      selection.engine = null;
      updateModelButton();
      updateEngineButton();
      updateSelectionSummary();
      renderBrandPanel();
    });

    on("#brandInput", "focus", function () {
      renderBrandPanel();
    });

    on("#brandInput", "blur", function () {
      setTimeout(function () { closeAllCombos(); }, 160);
    });

    on("#brandPanel", "mousedown", function (e) {
      var btn = e.target.closest("[data-brand]");
      if (!btn) return;
      e.preventDefault();
      selectBrand(btn.getAttribute("data-brand"));
    });

    on("#modelButton", "click", function () {
      if (!selection.brand) return;
      var panel = q("#modelPanel");
      var isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("modelPanel");
      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderModelList("");
        var search = q("#modelSearch");
        if (search) setTimeout(function () { search.focus(); }, 30);
      }
    });

    on("#modelSearch", "input", function () {
      renderModelList(this.value);
    });

    on("#modelList", "mousedown", function (e) {
      var btn = e.target.closest("[data-model-index]");
      if (!btn) return;
      e.preventDefault();
      var idx = parseInt(btn.getAttribute("data-model-index"), 10);
      selectModel(currentModelOptions[idx]);
    });

    on("#engineButton", "click", function () {
      if (!selection.brand || !selection.model) return;
      var panel = q("#enginePanel");
      var isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("enginePanel");
      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderEngineList("");
        var search = q("#engineSearch");
        if (search) setTimeout(function () { search.focus(); }, 30);
      }
    });

    on("#engineSearch", "input", function () {
      renderEngineList(this.value);
    });

    on("#engineList", "mousedown", function (e) {
      var btn = e.target.closest("[data-engine-index]");
      if (!btn) return;
      e.preventDefault();
      var idx = parseInt(btn.getAttribute("data-engine-index"), 10);
      selectEngine(currentEngineOptions[idx]);
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".combo")) {
        closeAllCombos();
      }
    });

    on("#vehicleYear", "input", function () {
      if (selection.brand) loadModelsForBrand(selection.brand.name, false);
      refreshEngineOptions();
      updateSelectionSummary();
    });

    on("#vehicleYear", "change", function () {
      if (selection.brand) loadModelsForBrand(selection.brand.name, false);
      refreshEngineOptions();
      updateSelectionSummary();
    });

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

      var textEl = q("#textInput");
      var contextEl = q("#contextInfo");
      var objectiveEl = q("#objectiveInfo");
      var goalEl = q("#goalSelect");
      var sellerEl = q("#sellerType");

      var text = textEl ? textEl.value.trim() : "";
      if (!text) text = extractedText.trim();

      var context = contextEl ? contextEl.value.trim() : "";
      var objective = (objectiveEl && objectiveEl.value.trim()) || (goalEl ? goalEl.value : "") || "";
      var sellerType = sellerEl ? sellerEl.value : "unknown";

      vehicleData = getSelectedVehicleData();

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
        var req = reqs.find(function (r) { return r.id === id; });

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
              payload: { email: req.email, status: req.status }
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
                payload: { email: users[idx].email, status: users[idx].status }
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

        shareTextUrl(text, url, "Accès Expert Auto");
      }
    });

    on("#enableNotifBtn", "click", function () {
      askNotification().then(function (permission) {
        if (permission === "granted") toast("Notifications admin activées.", "success");
        else if (permission === "denied") toast("Notifications bloquées. Autorisez-les dans Android / navigateur.", "warning");
        else toast("Permission notification : " + permission, "info");
      });
    });

    on("#testNotifBtn", "click", function () {
      askNotification().then(function (permission) {
        if (permission === "granted") {
          notify("Test Expert Auto", "La notification admin fonctionne correctement.", "test-" + Date.now());
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

    on("#saveCatalogCfgBtn", "click", function () {
      saveCatalogConfigFromUi();
    });

    on("#reloadCatalogBtn", "click", function () {
      saveCatalogConfigFromUi();
      loadCatalogs(true);
    });

    on("#syncAutoBtn", "click", function () {
      saveCatalogConfigFromUi();
      loadAutoDiagnostic(true).then(function () {
        updateAdminStats();
        refreshSelectorsFromCatalog();
      });
    });

    on("#forceUpdateBtn", "click", function () {
      fetchJson(CONFIG.catalog.technicalUrl)
        .then(function (json) {
          ingestNode(json, null, null, null, "mise à jour JSON", CONFIG.catalog.technicalUrl, 0);
          save(KEYS.LAST_UPDATE, Date.now());
          clearEngineCache();
          updateAdminStats();
          refreshSelectorsFromCatalog();
          toast("Mise à jour technique appliquée.", "success");
        })
        .catch(function () {
          toast("Mise à jour impossible. Base locale conservée.", "warning");
        });
    });

    on("#exportDataBtn", "click", function () {
      var data = {
        exportedAt: new Date().toISOString(),
        users: getUsers(),
        requests: getRequests(),
        importedRaw: loadWithMigration(KEYS.IMPORTED_RAW, OLD_KEYS.IMPORTED_RAW, []) || [],
        catalogStats: {
          brands: getAllBrands().length,
          models: catalog.models.length,
          engines: catalog.engines.length,
          defects: catalog.defects.length
        }
      };

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aide-redactionnelle-expert-data-v19.json";
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

            var imported = loadWithMigration(KEYS.IMPORTED_RAW, OLD_KEYS.IMPORTED_RAW, []) || [];
            imported.push(data);
            save(KEYS.IMPORTED_RAW, imported);

            ingestNode(data, null, null, null, "import-admin", "import", 0);

            clearEngineCache();
            updateAdminStats();
            refreshSelectorsFromCatalog();
            renderAdmin();
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
        navigator.share({ title: "Analyse Expert Auto", text: text }).catch(function () {});
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
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    loadCatalogConfig();
    seedBaseCatalog();
    loadStoredTechnicalUpdates();
    loadImportedCatalog();

    autoLastSync = loadWithMigration(KEYS.AUTO_LAST_SYNC, OLD_KEYS.AUTO_LAST_SYNC, 0) || 0;

    updateAdminStats();
    updateDataStatus("Base locale ingénieur chargée");
    updateNotificationState();

    registerServiceWorker();
    refreshSavedPasswordButton();

    processIncomingAccessRequestFromUrl();

    if (processIncomingAccessGrantFromUrl()) {
      updateNotificationBell();
      loadCatalogs(false);
      return;
    }

    if (restoreSession()) {
      showApp();
    } else {
      showLogin();
    }

    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();

    loadCatalogs(false);

    toast("Application prête. Motorisations renforcées essence/diesel/hybride/électrique.", "success");
  }

  function boot() {
    try {
      bindUi();
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
