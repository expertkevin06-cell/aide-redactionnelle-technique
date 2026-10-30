(() => {
  "use strict";

  /* =========================================================
     PROTECTION GLOBALE
     ========================================================= */
  window.addEventListener("error", (event) => {
    console.warn("[AR-EXPERT] Erreur globale ignorée:", event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.warn("[AR-EXPERT] Promesse rejetée ignorée:", event.reason);
    if (event.preventDefault) event.preventDefault();
  });

  /* =========================================================
     HELPERS DOM / STORAGE / TEXT
     ========================================================= */
  const q = (sel) => {
    try { return document.querySelector(sel); } catch { return null; }
  };

  const qa = (sel) => {
    try { return Array.from(document.querySelectorAll(sel)); } catch { return []; }
  };

  const on = (sel, ev, fn) => {
    const el = q(sel);
    if (el) el.addEventListener(ev, fn);
  };

  const todayKey = () => {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const del = (key) => {
    try { localStorage.removeItem(key); } catch {}
  };

  const loadWithMigration = (newKey, oldKey, fallback) => {
    const current = load(newKey, null);
    if (current != null) return current;

    const old = load(oldKey, null);
    if (old != null) {
      save(newKey, old);
      return old;
    }

    return fallback;
  };

  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const norm = (str) => {
    let s = String(str == null ? "" : str).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.trim();
  };

  const normKey = (str) => norm(str).replace(/[^a-z0-9]+/g, "");

  const containsAny = (text, list) => {
    const t = norm(text);
    return (list || []).some((x) => t.includes(norm(x)));
  };

  const unique = (values) => {
    const seen = {};
    return (values || []).filter((v) => {
      const k = norm(v);
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  };

  const parseKm = (v) => parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;

  const parseYear = (v) => {
    const n = parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;
    return n >= 1980 && n <= 2035 ? n : 0;
  };

  const yearMatches = (range, year) => {
    if (!year) return true;
    const s = String(range || "").trim();
    if (!s || s === "*" || norm(s).includes("tous")) return true;

    const parts = s.split("|");
    for (const part of parts) {
      const m = part.match(/(\d{4})\D*(\d{4})?/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = m[2] ? parseInt(m[2], 10) : a;
      if (year >= a && year <= b) return true;
    }

    return false;
  };

  const brandMatches = (a, b) => {
    const na = normKey(a);
    const nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;

    const ba = catalog.brands[na];
    if (ba && ba.aliasKeys && ba.aliasKeys[nb]) return true;

    const bb = catalog.brands[nb];
    if (bb && bb.aliasKeys && bb.aliasKeys[na]) return true;

    if (na.length > 3 && nb.includes(na)) return true;
    if (nb.length > 3 && na.includes(nb)) return true;

    return false;
  };

  const nameMatch = (a, b) => {
    const na = normKey(a);
    const nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length > 2 && nb.includes(na)) return true;
    if (nb.length > 2 && na.includes(nb)) return true;
    return false;
  };

  const modelListContains = (list, model) => String(list || "").split("|").some((m) => nameMatch(m, model));

  const stripTags = (html) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.textContent || tmp.innerText || "";
  };

  const ensureToast = () => {
    let t = q("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast hidden";
      document.body.appendChild(t);
    }
    return t;
  };

  const toast = (message, type = "info") => {
    const el = ensureToast();
    el.textContent = message;
    el.className = `toast ${type}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add("hidden"), 4500);
  };

  const simpleHash = (str) => {
    let hash = 5381;
    str = String(str || "");
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return "simple:" + (hash >>> 0).toString(16);
  };

  const sha256 = async (text) => {
    text = String(text || "");
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") {
      return simpleHash(text);
    }

    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return simpleHash(text);
    }
  };

  const utf8ToB64Url = (str) => {
    const binary = encodeURIComponent(String(str || "")).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const b64UrlToUtf8 = (str) => {
    let s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const binary = atob(s);
    const percent = binary.split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    return decodeURIComponent(percent);
  };

  const getQueryParam = (name) => {
    const search = (location.search || "").replace(/^\?/, "");
    for (const pair of search.split("&")) {
      const [k, v] = pair.split("=");
      if (decodeURIComponent(k || "") === name) return decodeURIComponent(v || "");
    }
    return null;
  };

  const cleanUrlAfterParam = () => {
    const clean = location.href.split("?")[0] + location.hash;
    if (history.replaceState) history.replaceState({}, document.title, clean);
  };

  const resolveUrl = (base, path) => {
    try { return new URL(path, base).href; } catch { return String(base || "") + String(path || ""); }
  };

  const valToString = (v) => {
    if (Array.isArray(v)) return v.join("|");
    if (v == null) return "";
    return String(v);
  };

  const getField = (obj, keys) => {
    if (!obj || typeof obj !== "object") return "";

    for (const k of keys) {
      if (obj[k] != null && obj[k] !== "") return obj[k];
    }

    const lowerMap = {};
    for (const prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        lowerMap[normKey(prop)] = prop;
      }
    }

    for (const k of keys) {
      const lk = lowerMap[normKey(k)];
      if (lk && obj[lk] != null && obj[lk] !== "") return obj[lk];
    }

    return "";
  };

  const getBrandField = (o) => valToString(getField(o, ["b", "brand", "marque", "constructeur", "make", "Brand", "Marque"]));
  const getModelField = (o) => valToString(getField(o, ["m", "model", "modele", "modèle", "vehicle", "vehicule", "Model", "Modele"]));
  const getEngineField = (o) => valToString(getField(o, ["e", "engine", "motorisation", "moteur", "powertrain", "version", "variant", "Engine", "Motorisation"]));
  const getPowerField = (o) => valToString(getField(o, ["p", "power", "puissance", "ch", "kw", "kwh", "Power", "Puissance"]));
  const getFuelField = (o) => valToString(getField(o, ["t", "type", "fuel", "energie", "énergie", "carburant", "engineType", "Fuel", "Type"]));
  const getTransField = (o) => valToString(getField(o, ["tr", "transmission", "boite", "boîte", "gearbox", "Transmission", "Boite"]));
  const getYearsField = (o) => valToString(getField(o, ["y", "years", "annee", "année", "period", "range", "from", "start", "Years"]));
  const getSymptomsField = (o) => valToString(getField(o, ["s", "symptoms", "symptomes", "panne", "pannes", "defaut", "défaut", "probleme", "problème", "issue", "fault", "Symptoms"]));
  const getDtcField = (o) => valToString(getField(o, ["dtc", "codeDtc", "code", "codes", "DTC"]));
  const getDisplacementField = (o) => valToString(getField(o, ["d", "cyl", "cylindree", "cylindrée", "displacement", "engineSize", "cubic", "Cylindree"]));
  const getCodeField = (o) => valToString(getField(o, ["code", "codeMoteur", "engineCode", "codemoteur", "Code"]));

  const fetchJson = async (url) => {
    const res = await fetch(url, { cache: "no-store", method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  };

  const fetchText = async (url) => {
    const res = await fetch(url, { cache: "no-store", method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  };

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  const CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    pollAdminMs: 5000,
    catalog: {
      vehicleUrl: "./data/vehicle-catalog.json",
      engineUrl: "./data/engine-catalog.json",
      technicalUrl: "./data/technical-updates.json",
      nhtsaEnabled: true,
      autoBaseUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/",
      rawRepo: "expertkevin06-cell/auto-diagnostic",
      rawBranches: ["main", "master"],
      endpoints: [
        "data/vehicle-catalog.json",
        "data/engine-catalog.json",
        "data/models.json",
        "data/motorisations.json",
        "data/motorizations.json",
        "data/base.json",
        "data/pannes.json",
        "data/rappels.json",
        "data/technical-updates.json",
        "data/dtc.json",
        "data/export.json",
        "data/auto-diagnostic-export.json",
        "db.json",
        "database.json",
        "data/db.json",
        "data/data.json",
        "data/catalog.json",
        "data/vehicles.json",
        "data/engines.json",
        "data/brands.json"
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

  const KEYS = {
    SESSION: "arex_session_v20",
    USERS: "arex_users_v20",
    REQUESTS: "arex_requests_v20",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v20",
    TECH_UPDATES: "arex_tech_updates_v20",
    LAST_UPDATE: "arex_last_update_v20",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v20",
    CATALOG_CFG: "arex_catalog_cfg_v20",
    IMPORTED_RAW: "arex_imported_raw_v20"
  };

  const OLD_KEYS = {
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

  /* =========================================================
     ÉTAT GLOBAL
     ========================================================= */
  let currentUser = null;
  let vehicleData = {};
  let analysisData = {};
  let extractedText = "";
  let termesMobilises = new Set();
  let deferredPrompt = null;
  let swRegistration = null;
  let adminPollTimer = null;
  let lastPendingSignature = "";
  let lastSharedAccessRequest = null;
  let broadcast = null;
  let autoLastSync = 0;
  let modelLoadToken = 0;

  const selection = {
    brand: null,
    model: null,
    engine: null
  };

  let modelOptions = [];
  let currentModelOptions = [];
  let engineOptions = [];
  let currentEngineOptions = [];

  const catalog = {
    brands: {},
    models: [],
    modelKeys: {},
    engines: [],
    engineKeys: {},
    defects: []
  };

  const engineCache = {};

  try {
    if ("BroadcastChannel" in window) broadcast = new BroadcastChannel("arex_expert_channel");
  } catch {
    broadcast = null;
  }

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */
  const notificationPermissionState = () => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  };

  const updateNotificationState = () => {
    const el = q("#notifState");
    const state = notificationPermissionState();
    const labels = {
      granted: "✅ Notifications autorisées",
      default: "⏳ Permission non encore accordée",
      denied: "❌ Notifications bloquées par le navigateur / Android",
      unsupported: "⚠️ Notifications non supportées par cet environnement"
    };
    if (el) el.textContent = "État des notifications : " + (labels[state] || state);
  };

  const askNotification = async () => {
    if (!("Notification" in window)) {
      updateNotificationState();
      return "unsupported";
    }

    if (Notification.permission === "granted" || Notification.permission === "denied") {
      updateNotificationState();
      return Notification.permission;
    }

    try {
      const permission = await Notification.requestPermission();
      updateNotificationState();
      return permission;
    } catch {
      updateNotificationState();
      return Notification.permission || "denied";
    }
  };

  const showSystemNotification = async (title, body, tag) => {
    const options = {
      body: body || "",
      tag: tag || "arex-" + Date.now(),
      data: { url: "./index.html" }
    };

    const fallback = () => {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(title, options);
          n.onclick = () => window.focus();
        } catch (e) {
          console.warn("[AR-EXPERT] Notification fallback impossible:", e);
        }
      }
    };

    if (swRegistration && typeof swRegistration.showNotification === "function") {
      try {
        await swRegistration.showNotification(title, options);
        return;
      } catch {
        fallback();
        return;
      }
    }

    fallback();
  };

  const notify = (title, body, tag) => showSystemNotification(title, body, tag);

  /* =========================================================
     AUTH / USERS / REQUESTS
     ========================================================= */
  const normIdentity = (value) => norm(String(value == null ? "" : value)).replace(/\s+/g, " ").trim();
  const userEmailKey = (email) => normIdentity(email).replace(/\s/g, "");
  const userNameKey = (name) => normIdentity(name);
  const userCompositeKey = (name, email) => `${userNameKey(name)}|${userEmailKey(email)}`;

  const migrateUser = (u) => {
    const user = { ...(u || {}) };
    user.name = String(user.name || "").trim();
    user.email = String(user.email || "").trim();
    user.nameNorm = userNameKey(user.name);
    user.emailNorm = userEmailKey(user.email);
    user.key = user.key || userCompositeKey(user.name, user.email);
    user.role = user.role || "user";
    user.status = user.status || "pending";
    if (!user.daily) user.daily = { date: todayKey(), count: 0 };
    return user;
  };

  const getUsers = () => {
    const raw = loadWithMigration(KEYS.USERS, OLD_KEYS.USERS, []) || [];
    let changed = false;

    const users = raw.map((u) => {
      const m = migrateUser(u);
      if (JSON.stringify(m) !== JSON.stringify(u)) changed = true;
      return m;
    });

    if (changed) save(KEYS.USERS, users);
    return users;
  };

  const saveUsers = (users) => save(KEYS.USERS, (users || []).map(migrateUser));

  const migrateRequest = (r) => {
    const req = { ...(r || {}) };
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
  };

  const getRequests = () => {
    const raw = loadWithMigration(KEYS.REQUESTS, OLD_KEYS.REQUESTS, []) || [];
    let changed = false;

    const requests = raw.map((r) => {
      const m = migrateRequest(r);
      if (JSON.stringify(m) !== JSON.stringify(r)) changed = true;
      return m;
    });

    if (changed) save(KEYS.REQUESTS, requests);
    return requests;
  };

  const saveRequests = (requests) => save(KEYS.REQUESTS, (requests || []).map(migrateRequest));

  const findUser = (name, email) => {
    const key = userCompositeKey(name, email);
    const emailKey = userEmailKey(email);
    const users = getUsers();

    return users.find((u) => u.key === key) ||
           users.find((u) => u.emailNorm === emailKey && u.role !== "admin") ||
           null;
  };

  const findApprovedUser = (name, email) => {
    const emailKey = userEmailKey(email);
    if (!emailKey) return null;

    const key = userCompositeKey(name, email);
    const users = getUsers();

    return users.find((u) => u.status === "approved" && u.role !== "admin" && u.key === key) ||
           users.find((u) => u.status === "approved" && u.role !== "admin" && u.emailNorm === emailKey) ||
           null;
  };

  const findStoredUser = (session) => {
    if (!session) return null;

    const users = getUsers();
    const key = session.key || userCompositeKey(session.name, session.email);
    const emailKey = userEmailKey(session.email);

    return users.find((u) => u.key === key) ||
           users.find((u) => u.emailNorm === emailKey && u.role !== "admin") ||
           null;
  };

  const upsertUser = (user) => {
    const next = migrateUser(user);
    const users = getUsers();

    const idx = users.findIndex((u) => u.key === next.key || (u.emailNorm === next.emailNorm && u.role !== "admin"));

    if (idx >= 0) {
      const merged = { ...users[idx], ...next };
      merged.daily = users[idx].daily && users[idx].daily.date === todayKey()
        ? users[idx].daily
        : (next.daily || { date: todayKey(), count: 0 });
      users[idx] = merged;
      return merged;
    }

    users.push(next);
    saveUsers(users);
    return next;
  };

  const setSession = (user) => {
    currentUser = migrateUser(user);
    save(KEYS.SESSION, currentUser);
  };

  const clearSession = () => {
    currentUser = null;
    del(KEYS.SESSION);
  };

  const restoreSession = () => {
    const session = loadWithMigration(KEYS.SESSION, OLD_KEYS.SESSION, null);
    if (!session) return false;

    if (session.role === "admin") {
      clearSession();
      return false;
    }

    const fresh = findStoredUser(session);

    if (fresh && fresh.status === "approved") {
      currentUser = fresh;
      setSession(fresh);
      return true;
    }

    clearSession();
    return false;
  };

  const dailyInfo = () => {
    if (!currentUser) return { allowed: false, remaining: 0, unlimited: false };
    if (currentUser.role === "admin") return { allowed: true, remaining: Infinity, unlimited: true };

    const user = findUser(currentUser.name, currentUser.email) || currentUser;
    const daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;

    return {
      allowed: daily < CONFIG.maxDailyAnalyses,
      remaining: Math.max(0, CONFIG.maxDailyAnalyses - daily),
      unlimited: false
    };
  };

  const incrementDaily = () => {
    if (!currentUser || currentUser.role === "admin") return;

    const users = getUsers();
    const idx = users.findIndex((u) => u.key === currentUser.key || (u.emailNorm === currentUser.emailNorm && u.role !== "admin"));
    if (idx < 0) return;

    const user = users[idx];
    if (!user.daily || user.daily.date !== todayKey()) user.daily = { date: todayKey(), count: 0 };
    user.daily.count += 1;
    users[idx] = user;
    saveUsers(users);
    currentUser = user;
    setSession(user);
    updateCounter();
  };

  const updateCounter = () => {
    const el = q("#dailyCounter");
    if (!el) return;
    const info = dailyInfo();
    el.textContent = info.unlimited
      ? "👑 Admin — analyses illimitées"
      : `📊 ${info.remaining}/${CONFIG.maxDailyAnalyses} analyses restantes`;
  };

  const authMessage = (msg, type) => {
    const el = q("#authMsg");
    if (el) {
      el.textContent = msg;
      el.className = "auth-msg " + type;
    } else {
      toast(msg, type);
    }
  };

  const makeAccessRequestShareUrl = (req) => {
    const payload = {
      id: req.id,
      name: req.name,
      email: req.email,
      reason: req.reason,
      date: req.date,
      source: "lien-partage"
    };

    const baseUrl = location.href.split("?")[0].split("#")[0];
    return baseUrl + "?access_request=" + utf8ToB64Url(JSON.stringify(payload));
  };

  const makeAccessGrantUrl = (user) => {
    const safe = migrateUser(user);
    const payload = {
      name: safe.name,
      email: safe.email,
      status: "approved",
      role: "user",
      key: safe.key,
      grantedAt: Date.now()
    };

    const baseUrl = location.href.split("?")[0].split("#")[0];
    return baseUrl + "?access_grant=" + utf8ToB64Url(JSON.stringify(payload));
  };

  const processIncomingAccessRequestFromUrl = () => {
    try {
      const raw = getQueryParam("access_request");
      if (!raw) return false;

      const req = JSON.parse(b64UrlToUtf8(raw));
      if (!req || !req.name || !req.email) return false;

      const migrated = migrateRequest({
        id: req.id || uid(),
        name: req.name,
        email: req.email,
        reason: req.reason || "Motif non précisé",
        status: "pending",
        date: req.date || new Date().toLocaleString("fr-FR"),
        ts: Date.now(),
        source: "lien-partage"
      });

      const requests = getRequests();
      const exists = requests.find((r) => r.id === migrated.id || (r.emailNorm === migrated.emailNorm && r.nameNorm === migrated.nameNorm && r.reason === migrated.reason));

      if (!exists) {
        requests.push(migrated);
        saveRequests(requests);
        publishAccessRequest(migrated);
        toast("Demande d’accès importée depuis le lien partagé.", "success");
      }

      cleanUrlAfterParam();
      return true;
    } catch {
      toast("Lien de demande invalide ou corrompu.", "error");
      return false;
    }
  };

  const processIncomingAccessGrantFromUrl = () => {
    try {
      const raw = getQueryParam("access_grant");
      if (!raw) return false;

      const payload = JSON.parse(b64UrlToUtf8(raw));
      if (!payload || !payload.email) return false;

      const user = upsertUser({
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
    } catch {
      toast("Lien d’accès invalide ou corrompu.", "error");
      return false;
    }
  };

  const pendingRequests = () => getRequests().filter((r) => r.status === "pending");

  const pendingSignature = () => pendingRequests().map((r) => r.id).sort().join("|");

  const updateNotificationBell = () => {
    const bell = q("#notifBellBtn");
    const badge = q("#notifBadge");
    if (!bell) return;

    if (!currentUser || currentUser.role !== "admin") {
      bell.classList.add("hidden");
      if (badge) badge.classList.add("hidden");
      return;
    }

    bell.classList.remove("hidden");
    const count = pendingRequests().length;

    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle("hidden", count === 0);
    }
  };

  const renderAdminIfOpen = () => {
    const panel = q("#adminPanel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (!currentUser || currentUser.role !== "admin") return;
    renderAdmin();
  };

  const onAccessRequestReceived = (req) => {
    if (!currentUser || currentUser.role !== "admin" || !req) return;

    notify("Nouvelle demande d’accès", `${req.name || "Tiers"} — ${req.email || ""}`, "access-" + (req.id || Date.now()));
    updateNotificationBell();
    renderAdminIfOpen();
    toast("Nouvelle demande : " + (req.name || "Tiers"), "info");
  };

  const pollAdminNotifications = () => {
    if (!currentUser || currentUser.role !== "admin") return;

    const sig = pendingSignature();
    if (sig === lastPendingSignature) {
      updateNotificationBell();
      return;
    }

    const oldIds = lastPendingSignature ? lastPendingSignature.split("|") : [];
    const newIds = sig ? sig.split("|").filter((id) => id && !oldIds.includes(id)) : [];

    lastPendingSignature = sig;
    updateNotificationBell();

    if (newIds.length) {
      const all = getRequests();
      newIds.forEach((id) => {
        const req = all.find((r) => r.id === id);
        if (req) onAccessRequestReceived(req);
      });
    }

    renderAdminIfOpen();
  };

  const startAdminPolling = () => {
    stopAdminPolling();
    lastPendingSignature = pendingSignature();
    updateNotificationBell();

    adminPollTimer = setInterval(pollAdminNotifications, CONFIG.pollAdminMs || 5000);

    const count = pendingRequests().length;
    if (count > 0) toast(`${count} demande(s) d’accès en attente`, "info");
  };

  const stopAdminPolling = () => {
    if (adminPollTimer) {
      clearInterval(adminPollTimer);
      adminPollTimer = null;
    }
  };

  const publishAccessRequest = (req) => {
    if (!req) return;

    if (broadcast) {
      try { broadcast.postMessage({ type: "access-request", payload: req }); } catch {}
    }

    try { window.dispatchEvent(new CustomEvent("arex:access-request", { detail: req })); } catch {}

    updateNotificationBell();
  };

  const enforceTierAccess = () => {
    if (!currentUser || currentUser.role === "admin") return;

    const fresh = findStoredUser(currentUser);
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
  };

  const refreshSavedPasswordButton = () => {
    const btn = q("#useSavedPwdBtn");
    const saved = loadWithMigration(KEYS.ADMIN_PWD_HASH, OLD_KEYS.ADMIN_PWD_HASH, null);
    if (!btn) return;
    btn.classList.toggle("hidden", !saved);
  };

  const verifyAdminPassword = async (input) => {
    if (!input) return false;
    const adminHash = await sha256(CONFIG.adminPassword);
    const inputHash = await sha256(input);
    return inputHash === adminHash;
  };

  const loginAdminFromHash = async (savedHash) => {
    if (!savedHash) return false;
    const adminHash = await sha256(CONFIG.adminPassword);
    return savedHash === adminHash;
  };

  const showApp = () => {
    const login = q("#loginScreen");
    if (login) {
      login.classList.add("hidden");
      login.style.display = "none";
    }

    const app = q("#mainApp");
    if (app) {
      app.classList.remove("hidden");
      app.style.display = "block";
    }

    const badge = q("#userBadge");
    if (badge) badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;

    const adminBtn = q("#adminPanelBtn");
    if (adminBtn) adminBtn.classList.toggle("hidden", currentUser.role !== "admin");

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
  };

  const showLogin = () => {
    const login = q("#loginScreen");
    if (login) {
      login.classList.remove("hidden");
      login.style.display = "flex";
    }

    const app = q("#mainApp");
    if (app) {
      app.classList.add("hidden");
      app.style.display = "none";
    }

    const admin = q("#adminPanel");
    if (admin) admin.classList.add("hidden");

    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  };

  /* =========================================================
     CATALOGUE : BASES / ALIAS / NORMALISATION
     ========================================================= */
  const BASE_BRANDS = [
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

  const BRAND_ALIASES = {
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

  const addBrand = (name, aliases = [], sourceLabel = "local", sourceUrl = "") => {
    name = String(name || "").trim();
    if (!name) return;

    const k = normKey(name);
    if (!catalog.brands[k]) {
      catalog.brands[k] = {
        name,
        aliases: [],
        aliasKeys: {},
        source: sourceLabel || "local",
        sourceUrl: sourceUrl || ""
      };
    }

    const brand = catalog.brands[k];

    const pushAlias = (a) => {
      a = String(a || "").trim();
      if (!a) return;
      const ak = normKey(a);
      if (!brand.aliasKeys[ak]) {
        brand.aliasKeys[ak] = true;
        brand.aliases.push(a);
      }
    };

    pushAlias(name);
    (Array.isArray(aliases) ? aliases : []).forEach(pushAlias);
    (BRAND_ALIASES[k] || []).forEach(pushAlias);
  };

  const addModel = (brand, name, years = "", sourceLabel = "local", sourceUrl = "") => {
    brand = String(brand || "").trim();
    name = String(name || "").trim();
    if (!brand || !name || name === "*") return;

    addBrand(brand, null, sourceLabel, sourceUrl);

    const k = `${normKey(brand)}|${normKey(name)}`;
    if (catalog.modelKeys[k]) return;

    catalog.modelKeys[k] = true;
    catalog.models.push({
      brand,
      name,
      years: valToString(years),
      source: sourceLabel || "local",
      sourceUrl: sourceUrl || ""
    });
  };

  const parseDisplacement = (text) => {
    const t = String(text || "");
    let m = t.match(/\b(\d\.\d)\s*(?:l|litre|litres)?\b/i);
    if (m) return m[1] + " L";

    m = t.match(/\b(\d{3,4})\s*(?:cm3|cc)\b/i);
    if (m) return m[1] + " cm3";

    m = t.match(/\b(\d{3,4})\b/i);
    if (m && parseInt(m[1], 10) >= 600 && parseInt(m[1], 10) <= 8000 && /\b(diesel|essence|turbo|tdi|hdi|dci|tsi|tfsi|puretech|ecoboost)\b/i.test(t)) {
      return m[1] + " cm3";
    }

    return "";
  };

  const parsePower = (text) => {
    const t = String(text || "");
    const parts = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(ch|cv|hp|kw|kwh)/gi;
    let m;

    while ((m = re.exec(t)) !== null) {
      const value = m[1].replace(",", ".");
      let unit = m[2].toLowerCase();
      if (unit === "cv" || unit === "hp") unit = "ch";
      parts.push(`${value} ${unit}`);
    }

    if (parts.length) return unique(parts).join("|");

    m = t.match(/\b(\d{2,3})\b/);
    if (m && /\b(ch|kw|puissance)\b/i.test(t)) return m[1] + " ch";

    return "";
  };

  const parsePowerNumber = (text) => {
    const t = String(text || "");
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(ch|cv|hp)/i);
    if (m) return parseFloat(m[1].replace(",", "."));

    m = t.match(/(\d+(?:[.,]\d+)?)\s*kw/i);
    if (m) return parseFloat(m[1].replace(",", ".")) * 1.36;

    return 0;
  };

  const parseCapacityNumber = (text) => {
    const t = String(text || "");
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
    return m ? parseFloat(m[1].replace(",", ".")) : 0;
  };

  const parseDisplacementNumber = (text) => {
    const t = String(text || "");
    let m = t.match(/\b(\d\.\d)\b/);
    if (m) return parseFloat(m[1]);

    m = t.match(/\b(\d{3,4})\s*(?:cm3|cc)?\b/i);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 600 && v <= 8000) return v / 1000;
    }

    return 0;
  };

  const inferFuel = (text) => {
    const t = norm(text || "");

    if (containsAny(t, ["hydrogene", "h2", "fuel cell", "pile a combustible"])) return "Hydrogène";

    if (containsAny(t, [
      "hybride rechargeable", "plug-in", "phev", "e-tense", "4xe", "prime",
      "e-hybrid", "xdrive45e", "tucson phev", "sportage phev", "niro phev",
      "compass 4xe", "wrangler 4xe", "grand cherokee 4xe", "tonale phev"
    ])) return "Hybride rechargeable";

    if (containsAny(t, [
      "48v", "mild hybrid", "micro-hybridation", "eq boost", "boosterjet",
      "firefly hybrid", "hybrid 48", "e-torque", "egmp"
    ])) return "Hybride léger 48V";

    const hy = containsAny(t, [
      "hybride", "hybrid", "ths", "i-mmd", "e-power", "self-charging",
      "prius", "yaris hybrid", "corolla hybrid", "c-hr hybrid", "rav4 hybrid",
      "e:hev", "full hybrid"
    ]);

    const el = containsAny(t, [
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
  };

  const isFuelType = (f) => {
    f = norm(f || "");
    return ["essence", "diesel", "hybride", "electrique", "gpl", "e85", "bioethanol", "hydrogene"]
      .some((x) => f.includes(x));
  };

  const isElectricLike = (fuel) => {
    const t = norm(fuel || "");
    return t.includes("electrique") || t.includes("hybride") || t.includes("48v") || t.includes("hydrogene");
  };

  const looksLikeMotorisation = (text) => {
    const t = norm(text || "");
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
  };

  const createEngineLabel = (e, d, p, f, tr, code) => {
    e = String(e || "").trim();
    if (e) return e;

    const parts = [d, p, f, tr, code].filter((x) => x && String(x).trim());
    return parts.length ? parts.join(" ") : "Motorisation non nommée";
  };

  const normalizeEngineInput = (o, sourceLabel = "catalogue", sourceUrl = "", keyFallback = "") => {
    if (!o) return null;

    let brand = "";
    let model = "";
    let years = "";
    let engine = "";
    let power = "";
    let fuel = "";
    let trans = "";
    let code = "";
    let displacement = "";
    let source = sourceLabel || "catalogue";
    let url = sourceUrl || "";
    let confidence = 0.75;

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
    power = String(power || "").trim() || parsePower(`${engine} ${code} ${displacement}`);
    displacement = String(displacement || "").trim() || parseDisplacement(`${engine} ${code}`);
    code = String(code || "").trim();
    trans = String(trans || "").trim();
    years = String(years || "").trim();

    if (!fuel || !isFuelType(fuel)) {
      fuel = inferFuel(`${engine} ${power} ${displacement} ${trans} ${code} ${model} ${years}`);
    }

    engine = createEngineLabel(engine, displacement, power, fuel, trans, code);

    if (!confidence) {
      if (norm(source).includes("auto-diagnostic")) confidence = 0.88;
      else if (norm(source).includes("catalogue local")) confidence = 0.95;
      else if (norm(source).includes("générateur")) confidence = 0.55;
      else confidence = 0.75;
    }

    return {
      brand,
      model,
      years,
      engine,
      displacement,
      power,
      fuel,
      transmission: trans,
      code,
      source,
      sourceUrl: url,
      confidence
    };
  };

  const addEngine = (o, sourceUrl = "", force = false, sourceLabel = "catalogue", keyFallback = "") => {
    const e = normalizeEngineInput(o, sourceLabel || "catalogue", sourceUrl || "", keyFallback || "");
    if (!e) return;

    if (!force && !isFuelType(e.fuel) && !looksLikeMotorisation(`${e.engine} ${e.power} ${e.displacement} ${e.code}`)) {
      return;
    }

    const k = [
      normKey(e.brand),
      normKey(e.model),
      normKey(e.engine),
      normKey(e.displacement),
      normKey(e.power),
      normKey(e.fuel),
      normKey(e.transmission),
      normKey(e.code)
    ].join("|");

    if (catalog.engineKeys[k]) return;

    catalog.engineKeys[k] = true;
    catalog.engines.push(e);
    addModel(e.brand, e.model, e.years, e.source, e.sourceUrl);
  };

  const normalizeDefect = (d, sourceLabel = "base locale", sourceUrl = "") => {
    if (!d) return null;

    const out = {
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

    out.et = valToString(getField(d, ["et", "engineType", "type", "fuel", "energie"])) || inferFuel(`${out.e} ${out.tg} ${out.s} ${out.n}`);

    if (!out.b || !out.s) return null;
    return out;
  };

  const addDefect = (d, sourceLabel = "base locale", sourceUrl = "") => {
    const nd = normalizeDefect(d, sourceLabel, sourceUrl);
    if (!nd) return;

    catalog.defects.push(nd);
    addBrand(nd.b, null, nd.source, nd.sourceUrl);

    if (nd.m && nd.m !== "*") {
      String(nd.m).split("|").forEach((m) => addModel(nd.b, m, nd.y, nd.source, nd.sourceUrl));
    }

    if (nd.e && nd.m && nd.m !== "*" && looksLikeMotorisation(nd.e)) {
      String(nd.m).split("|").forEach((m) => {
        addEngine({
          b: nd.b,
          m,
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
  };

  const getAllBrands = () => Object.keys(catalog.brands)
    .map((k) => catalog.brands[k])
    .sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

  const getModels = (brand, year) => catalog.models
    .filter((m) => brandMatches(m.brand, brand) && yearMatches(m.years, year))
    .map((m) => ({
      id: `${normKey(m.brand)}|${normKey(m.name)}`,
      brand: m.brand,
      name: m.name,
      years: m.years,
      source: m.source
    }))
    .sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

  const engineMatches = (e, brand, model, year) => (
    brandMatches(e.brand, brand) &&
    nameMatch(e.model, model) &&
    yearMatches(e.years, year)
  );

  const fuelRank = (f) => {
    const order = ["Essence", "Diesel", "Hybride", "Hybride rechargeable", "Hybride léger 48V", "Électrique", "GPL", "E85 / Bioéthanol", "Hydrogène", "Non précisé / mixte", "Hybride / électrique"];
    const i = order.indexOf(f);
    return i >= 0 ? i : 999;
  };

  const dedupeAndSortEngines = (list) => {
    const seen = {};
    const out = [];

    list.forEach((e) => {
      if (!e) return;
      const k = [
        normKey(e.brand),
        normKey(e.model),
        normKey(e.engine),
        normKey(e.displacement),
        normKey(e.power),
        normKey(e.fuel),
        normKey(e.transmission),
        normKey(e.code)
      ].join("|");

      if (seen[k]) return;
      seen[k] = true;
      out.push(e);
    });

    out.sort((a, b) => {
      const fa = fuelRank(a.fuel);
      const fb = fuelRank(b.fuel);
      if (fa !== fb) return fa - fb;

      const da = parseDisplacementNumber(a.displacement || a.engine);
      const db = parseDisplacementNumber(b.displacement || b.engine);
      if (da !== db) return (da || 999) - (db || 999);

      const pa = parsePowerNumber(a.power || a.engine);
      const pb = parsePowerNumber(b.power || b.engine);
      if (pa !== pb) return pb - pa;

      const ca = parseCapacityNumber(a.power || a.displacement || a.engine);
      const cb = parseCapacityNumber(b.power || b.displacement || b.engine);
      if (ca !== cb) return cb - ca;

      return norm(a.engine).localeCompare(norm(b.engine));
    });

    return out;
  };

  /* =========================================================
     GÉNÉRATEUR INGÉNIEUR DE SECOURS
     ========================================================= */
  const detectFamily = (brand) => {
    const b = normKey(brand);

    if (containsAny(b, ["renault", "dacia", "peugeot", "citroen", "ds", "opel", "vauxhall", "fiat", "alfa", "maserati", "abarth"])) return "stellantis";
    if (containsAny(b, ["volkswagen", "vw", "audi", "skoda", "seat", "cupra", "porsche"])) return "vag";
    if (containsAny(b, ["bmw", "mini", "alpina"])) return "bmw";
    if (containsAny(b, ["mercedes", "smart", "amg"])) return "mercedes";
    if (containsAny(b, ["toyota", "lexus"])) return "toyota";
    if (containsAny(b, ["hyundai", "kia", "genesis"])) return "hk";
    if (containsAny(b, ["tesla", "byd", "nio", "xpeng", "leapmotor", "ora", "aiways", "polestar", "lucid", "rivian", "vinfast", "seres"])) return "ev";
    if (containsAny(b, ["mg"])) return "mg";
    return "generic";
  };

  const detectSegment = (model, brand) => {
    const m = norm(model || "");
    const b = norm(brand || "");

    if (containsAny(m, ["kangoo", "partner", "berlingo", "rifter", "caddy", "transit", "vivaro", "expert", "jumpy", "trafic", "master", "boxer", "jumper", "sprinter", "ducato", "transporter", "caravelle"])) return "van";

    if (containsAny(m, ["clio", "208", "c3", "corsa", "polo", "fabia", "ibiza", "swift", "yaris", "jazz", "micra", "aygo", "107", "108", "c1", "up!", "sandero", "logan", "500", "panda"])) return "city";

    if (containsAny(m, ["captur", "2008", "c3 aircross", "t-cross", "taigo", "arona", "mokka", "vitara", "s-cross", "bx", "trackhawk"])) return "suv_small";

    if (containsAny(m, ["tiguan", "kuga", "tucson", "sportage", "qashqai", "x-trail", "karoq", "ateca", "formentor", "cx-5", "forester", "outlander", "rav4", "cr-v", "elroq", "enyaq", "id.4", "q4 e-tron", "xc40", "ex30", "macan", "glc", "gla"])) return "suv_compact";

    if (containsAny(m, ["kodiaq", "touareg", "x5", "x7", "gle", "q7", "q8", "cayenne", "defender", "range rover", "discovery", "ev9", "escalade", "navigator"])) return "suv_large";

    if (containsAny(m, ["megane", "308", "c4", "astra", "golf", "leon", "octavia", "focus", "3 serie", "classe a", "a3", "corolla", "civic", "elantra", "versa"])) return "compact";

    if (containsAny(b, ["porsche", "jaguar", "land rover", "lotus", "aston", "bentley", "rolls", "lamborghini", "ferrari", "mclaren", "bugatti"])) return "premium";

    return "generic";
  };

  const generateEngines = (brand, model, year) => {
    const out = [];
    const y = parseYear(year) || new Date().getFullYear();
    const family = detectFamily(brand);
    const segment = detectSegment(model, brand);
    const mLower = norm(model || "");

    const push = (e, p, f, tr, code, d, conf) => {
      const ne = normalizeEngineInput({
        b: brand,
        m: model,
        y: `${y}-${y}`,
        e,
        p,
        t: f,
        tr: tr || "",
        code: code || "",
        d: d || "",
        source: "générateur ingénieur",
        confidence: typeof conf === "number" ? conf : 0.55
      }, "générateur ingénieur", "", "");
      if (ne) out.push(ne);
    };

    const isEvName = containsAny(mLower, [
      "e-", "ë-", "electric", "ev", "id.", "elroq", "enyaq", "taycan", "ioniq", "ev6", "ev9",
      "model 3", "model y", "model s", "model x", "atto", "seal", "dolphin", "mg4", "ariya",
      "leaf", "mx-30", "mach-e", "i-pace", "eqs", "eqe", "eqb", "eqa", "q4 e-tron", "e-tron",
      "born", "tavascan", "formentor vz", "ex30"
    ]);

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
  };

  const clearEngineCache = () => {
    Object.keys(engineCache).forEach((k) => delete engineCache[k]);
  };

  const getEnginesFor = (brand, model, year) => {
    if (!brand || !model) return [];

    const yr = parseYear(year);
    const cacheKey = `${normKey(brand)}|${normKey(model)}|${yr || "any"}`;
    if (engineCache[cacheKey]) return engineCache[cacheKey].slice();

    let list = catalog.engines.filter((e) => engineMatches(e, brand, model, yr));

    catalog.defects.forEach((d) => {
      if (!brandMatches(d.b, brand)) return;
      if (!yearMatches(d.y, yr)) return;
      if (!d.m || d.m === "*") {
        if (!looksLikeMotorisation(d.e)) return;
      } else if (!modelListContains(d.m, model)) {
        return;
      }

      if (!looksLikeMotorisation(d.e)) return;

      const ne = normalizeEngineInput({
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

    if (list.length < 6) {
      list = list.concat(generateEngines(brand, model, yr));
    }

    list = dedupeAndSortEngines(list);
    engineCache[cacheKey] = list;
    return list.slice();
  };

  /* =========================================================
     INGESTION JSON / HTML / JS / AUTO-DIAGNOSTIC
     ========================================================= */
  const META_KEYS = {
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

  const isMetaKey = (key) => !!META_KEYS[normKey(key)];

  const isPlainContainer = (obj) => obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length > 0;

  const ingestNode = (node, brandFallback, modelFallback, keyFallback, sourceLabel, sourceUrl, depth = 0, seen = new WeakSet()) => {
    if (!node || depth > 8) return;

    if (Array.isArray(node)) {
      node.forEach((item) => {
        if (typeof item === "string") {
          const s = String(item || "").trim();
          if (!s) return;

          if (brandFallback && modelFallback) {
            addEngine({
              b: brandFallback,
              m: modelFallback,
              e: s,
              source: sourceLabel,
              sourceUrl
            }, sourceUrl, false, sourceLabel);
          } else if (brandFallback) {
            addModel(brandFallback, s, "", sourceLabel, sourceUrl);
          } else {
            addBrand(s, [], sourceLabel, sourceUrl);
          }
        } else {
          ingestNode(item, brandFallback, modelFallback, keyFallback, sourceLabel, sourceUrl, depth + 1, seen);
        }
      });
      return;
    }

    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    const b = getBrandField(node) || brandFallback || "";
    const m = getModelField(node) || modelFallback || "";
    let e = getEngineField(node);
    if (!e && keyFallback && !isMetaKey(keyFallback)) e = keyFallback;
    if (!e && node.name && (getPowerField(node) || getFuelField(node) || getDisplacementField(node))) e = node.name;

    const sym = getSymptomsField(node);
    const hasEngineData = e || getPowerField(node) || getFuelField(node) || getDisplacementField(node);

    if (b && m && hasEngineData) {
      addEngine({ ...node, b, m, e: e || "", source: sourceLabel, sourceUrl }, sourceUrl, false, sourceLabel, keyFallback);
    }

    if (b && sym) {
      addDefect({ ...node, b, m: m || node.m || node.modele || "*", source: sourceLabel, sourceUrl }, sourceLabel, sourceUrl);
    }

    if (b && !m) addBrand(b, node.aliases || node.alias, sourceLabel, sourceUrl);
    if (b && m) addModel(b, m, getYearsField(node), sourceLabel, sourceUrl);

    ["brands", "marques"].forEach((k) => {
      if (node[k]) ingestNode(node[k], null, null, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["models", "modeles", "vehicles", "vehicules"].forEach((k) => {
      if (node[k]) ingestNode(node[k], b, null, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["engines", "motorisations", "motorizations", "powertrains", "versions", "variants"].forEach((k) => {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["defects", "pannes", "faults", "rappels", "problems", "issues"].forEach((k) => {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    ["data", "items", "records", "catalog", "base", "database", "result", "results"].forEach((k) => {
      if (node[k]) ingestNode(node[k], b, m, null, sourceLabel, sourceUrl, depth + 1, seen);
    });

    if (isPlainContainer(node)) {
      Object.keys(node).forEach((key) => {
        if (isMetaKey(key)) return;
        const val = node[key];

        if (val && typeof val === "object") {
          ingestNode(val, b, m, key, sourceLabel, sourceUrl, depth + 1, seen);
        } else if (typeof val === "string") {
          const s = String(val || "").trim();
          if (!s) return;

          if (b && m) {
            addEngine({
              b,
              m,
              e: key,
              p: s,
              source: sourceLabel,
              sourceUrl
            }, sourceUrl, false, sourceLabel);
          } else if (b) {
            addModel(b, key, s, sourceLabel, sourceUrl);
          } else {
            addBrand(key, [], sourceLabel, sourceUrl);
          }
        }
      });
    }
  };

  const parseBalanced = (text, start) => {
    const open = text.charAt(start);
    if (open !== "[" && open !== "{") return null;

    const stack = [open];
    let inString = false;
    let escape = false;
    const max = Math.min(text.length, start + 3000000);

    for (let i = start + 1; i < max; i++) {
      const ch = text.charAt(i);

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
        const expected = ch === "]" ? "[" : "{";
        if (stack.pop() !== expected) return null;
        if (stack.length === 0) return text.substring(start, i + 1);
      }
    }

    return null;
  };

  const tryParseJsonish = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {}

    let s = String(raw || "");

    s = s.replace(/\/\*[\s\S]*?\*\//g, "");
    s = s.replace(/(^|[^:])\/\/.*$/gm, "$1");
    s = s.replace(/'((?:[^'\\]|\\.)*)'/g, (_, p) => '"' + String(p).replace(/"/g, '\\"') + '"');
    s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
    s = s.replace(/,(\s*[}\]])/g, "$1");

    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const extractJsonCandidates = (text) => {
    const out = [];
    if (!text) return out;

    const keywordRe = /marque|brand|modele|model|motorisation|engine|panne|defaut|dtc|symptom|rappel|recall|puissance|power|energie|fuel|cylindree|displacement/i;
    const max = Math.min(text.length, 3500000);
    let attempts = 0;

    for (let i = 0; i < max && attempts < 500; i++) {
      const ch = text.charAt(i);
      if (ch !== "[" && ch !== "{") continue;

      const snippet = text.substr(i, 900).toLowerCase();
      if (!keywordRe.test(snippet)) continue;

      attempts++;
      const raw = parseBalanced(text, i);
      if (!raw) continue;

      const parsed = tryParseJsonish(raw);
      if (parsed) {
        out.push(parsed);
        i += raw.length;
      }
    }

    return out;
  };

  const ingestAutoText = (url, text, sourceLabel) => {
    const candidates = extractJsonCandidates(text);
    candidates.forEach((c) => ingestNode(c, null, null, null, sourceLabel || "auto-diagnostic", url, 0));
    return candidates.length > 0;
  };

  const discoverScriptUrls = (html, baseUrl) => {
    const urls = [];
    const re = /<script[^>]+src=["']([^"']+)["']/gi;
    let m;

    while ((m = re.exec(html)) !== null && urls.length < 50) {
      const src = m[1];
      if (/^https?:\/\//i.test(src) || src.charAt(0) === "/" || /^[\w./-]+\.js(?:\?|$)/i.test(src)) {
        urls.push(resolveUrl(baseUrl, src));
      }
    }

    return unique(urls);
  };

  const loadCatalogConfig = () => {
    const cfg = loadWithMigration(KEYS.CATALOG_CFG, OLD_KEYS.CATALOG_CFG, null);
    if (cfg) CONFIG.catalog = { ...CONFIG.catalog, ...cfg };
  };

  const saveCatalogConfigFromUi = () => {
    CONFIG.catalog.vehicleUrl = (q("#vehicleCatalogUrl") || {}).value || CONFIG.catalog.vehicleUrl;
    CONFIG.catalog.engineUrl = (q("#engineCatalogUrl") || {}).value || CONFIG.catalog.engineUrl;
    CONFIG.catalog.autoBaseUrl = (q("#autoBaseUrl") || {}).value || CONFIG.catalog.autoBaseUrl;
    CONFIG.catalog.nhtsaEnabled = !!(q("#nhtsaEnabled") || {}).checked;

    const eps = (q("#autoEndpoints") || {}).value || "";
    CONFIG.catalog.endpoints = String(eps)
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    save(KEYS.CATALOG_CFG, CONFIG.catalog);
    toast("Configuration catalogue enregistrée.", "success");
  };

  const renderCatalogConfig = () => {
    if (q("#vehicleCatalogUrl")) q("#vehicleCatalogUrl").value = CONFIG.catalog.vehicleUrl || "";
    if (q("#engineCatalogUrl")) q("#engineCatalogUrl").value = CONFIG.catalog.engineUrl || "";
    if (q("#autoBaseUrl")) q("#autoBaseUrl").value = CONFIG.catalog.autoBaseUrl || "";
    if (q("#autoEndpoints")) q("#autoEndpoints").value = (CONFIG.catalog.endpoints || []).join("\n");
    if (q("#nhtsaEnabled")) q("#nhtsaEnabled").checked = !!CONFIG.catalog.nhtsaEnabled;
  };

  const seedBaseCatalog = () => {
    BASE_BRANDS.forEach((b) => addBrand(b, BRAND_ALIASES[normKey(b)] || [], "base locale", ""));

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
    ].forEach((d) => addDefect(d, "base locale", ""));
  };

  const loadStoredTechnicalUpdates = () => {
    const oldTech = loadWithMigration(KEYS.TECH_UPDATES, OLD_KEYS.TECH_UPDATES, []) || [];
    oldTech.forEach((d) => addDefect(d, "base locale stockée", ""));
  };

  const loadImportedCatalog = () => {
    const raw = loadWithMigration(KEYS.IMPORTED_RAW, OLD_KEYS.IMPORTED_RAW, []) || [];
    raw.forEach((json) => {
      try { ingestNode(json, null, null, null, "import-admin", "import", 0); } catch {}
    });
  };

  const catalogSnapshot = () => ({
    brands: Object.keys(catalog.brands).length,
    models: catalog.models.length,
    engines: catalog.engines.length,
    defects: catalog.defects.length
  });

  const loadLocalCatalogs = async () => {
    const urls = [
      { url: CONFIG.catalog.vehicleUrl, label: "catalogue local" },
      { url: CONFIG.catalog.engineUrl, label: "catalogue local" },
      { url: CONFIG.catalog.technicalUrl, label: "mise à jour JSON" }
    ];

    await Promise.all(urls.map(async ({ url, label }) => {
      try {
        const json = await fetchJson(url);
        ingestNode(json, null, null, null, label, url, 0);
        if (label === "mise à jour JSON") save(KEYS.LAST_UPDATE, Date.now());
      } catch {}
    }));
  };

  const nhtsaMake = (brand) => {
    const s = String(brand || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const map = {
      "RANGE ROVER": "LAND ROVER",
      "MERCEDES BENZ": "MERCEDES-BENZ",
      "CITROEN": "CITROEN",
      "SKODA": "SKODA",
      "VOLKSWAGEN": "VOLKSWAGEN"
    };
    return map[s] || s;
  };

  const loadNhtsaMakes = async () => {
    if (!CONFIG.catalog.nhtsaEnabled || !window.fetch) return;

    try {
      const data = await fetchJson("https://vpic.nhtsa.dot.gov/api/vehicles/getmakes?format=json");
      const results = (data && data.Results) || [];
      results.forEach((r) => {
        const name = r.Make_Name || r.make || "";
        if (name) addBrand(name, [], "NHTSA vPIC", "https://vpic.nhtsa.dot.gov/");
      });
    } catch {}
  };

  const fetchNhtsaModels = async (brand) => {
    if (!CONFIG.catalog.nhtsaEnabled || !window.fetch || !brand) return [];

    const make = nhtsaMake(brand);
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`;

    try {
      const data = await fetchJson(url);
      const results = (data && data.Results) || [];
      return results
        .map((r) => ({
          id: `${normKey(brand)}|${normKey(r.Model_Name)}`,
          brand,
          name: r.Model_Name,
          years: "1990-2026",
          source: "NHTSA vPIC"
        }))
        .filter((x) => x.name);
    } catch {
      return [];
    }
  };

  const autoUrls = () => {
    const urls = new Set();
    const add = (u) => { if (u) urls.add(u); };

    const endpoints = CONFIG.catalog.endpoints || [];
    const base = CONFIG.catalog.autoBaseUrl;

    if (base) {
      endpoints.forEach((ep) => add(resolveUrl(base, ep)));
      (CONFIG.catalog.scriptUrls || []).forEach((sp) => add(resolveUrl(base, sp)));
    }

    const repo = CONFIG.catalog.rawRepo;
    const branches = CONFIG.catalog.rawBranches || ["main", "master"];

    if (repo) {
      branches.forEach((branch) => {
        const rb = `https://raw.githubusercontent.com/${repo}/${branch}/`;
        endpoints.forEach((ep) => add(rb + ep));
        (CONFIG.catalog.scriptUrls || []).forEach((sp) => add(rb + sp));

        [
          "data/export.json",
          "data/auto-diagnostic-export.json",
          "data/db.json",
          "db.json",
          "data/data.json",
          "data/catalog.json",
          "data/vehicles.json",
          "data/engines.json",
          "data/motorizations.json",
          "data/motorisations.json",
          "data/models.json",
          "data/brands.json",
          "data/pannes.json",
          "data/rappels.json",
          "data/dtc.json"
        ].forEach((ep) => add(rb + ep));
      });
    }

    ["./data/auto-diagnostic/", "./data/"].forEach((prefix) => {
      endpoints.forEach((ep) => add(resolveUrl(prefix, ep)));
    });

    return Array.from(urls).slice(0, 220);
  };

  const ingestUrl = async (url, label) => {
    try {
      const res = await fetch(url, { cache: "no-store", method: "GET" });
      if (!res.ok) return false;

      const text = await res.text();

      try {
        const json = JSON.parse(text);
        ingestNode(json, null, null, null, label, url, 0);
        return true;
      } catch {
        return ingestAutoText(url, text, label);
      }
    } catch {
      return false;
    }
  };

  const loadAutoDiagnostic = async (manual = false) => {
    if (!window.fetch) return false;

    updateDataStatus(manual ? "Synchronisation auto-diagnostic..." : "Auto-diagnostic en arrière-plan...");

    const before = catalogSnapshot();
    const urls = autoUrls();

    await Promise.all(urls.map((u) => ingestUrl(u, "auto-diagnostic")));

    autoLastSync = Date.now();
    save(KEYS.AUTO_LAST_SYNC, autoLastSync);

    const after = catalogSnapshot();
    const added = {
      models: Math.max(0, after.models - before.models),
      engines: Math.max(0, after.engines - before.engines),
      defects: Math.max(0, after.defects - before.defects)
    };

    clearEngineCache();
    updateAdminStats();
    refreshSelectorsFromCatalog();

    const ok = added.models + added.engines + added.defects > 0;

    updateDataStatus(ok
      ? `Auto-diagnostic synchronisé • +modèles: ${added.models} • +motorisations: ${added.engines} • +fiches: ${added.defects}`
      : "Auto-diagnostic : aucune nouvelle donnée exploitable trouvée");

    if (manual) {
      toast(ok
        ? `Auto-diagnostic renforcé : +${added.engines} motorisation(s), +${added.defects} fiche(s).`
        : "Aucune nouvelle donnée auto-diagnostic exploitable trouvée.",
        ok ? "success" : "warning");
    }

    return ok;
  };

  const loadCatalogs = async (manual = false) => {
    updateDataStatus(manual ? "Chargement des catalogues..." : "Chargement des catalogues en arrière-plan...");

    try {
      await loadLocalCatalogs();
      await loadAutoDiagnostic(manual);
      await loadNhtsaMakes();

      clearEngineCache();
      updateAdminStats();
      refreshSelectorsFromCatalog();

      updateDataStatus(`Catalogue chargé • Marques: ${getAllBrands().length} • Modèles: ${catalog.models.length} • Motorisations: ${catalog.engines.length} • Fiches: ${catalog.defects.length}`);

      if (manual) toast("Catalogues rechargés et renforcés.", "success");
    } catch (err) {
      console.warn("[AR-EXPERT] Chargement catalogue impossible:", err);
      updateDataStatus("Mode autonome : catalogue local partiel");
      if (manual) toast("Chargement catalogue impossible. Base locale conservée.", "warning");
    }
  };

  const refreshSelectorsFromCatalog = () => {
    if (selection.brand) {
      loadModelsForBrand(selection.brand.name, false);
    } else {
      renderBrandPanel();
    }
  };

  /* =========================================================
     UI DROPDOWN
     ========================================================= */
  const closeAllCombos = (exceptId) => {
    ["brandPanel", "modelPanel", "enginePanel"].forEach((id) => {
      if (id === exceptId) return;
      const el = q("#" + id);
      if (el) el.classList.add("hidden");
    });
  };

  const renderBrandPanel = () => {
    const input = q("#brandInput");
    const panel = q("#brandPanel");
    if (!input || !panel) return;

    const val = norm(input.value);
    const brands = getAllBrands().filter((b) => {
      if (!val) return true;
      if (norm(b.name).includes(val)) return true;
      return b.aliases.some((a) => norm(a).includes(val));
    }).slice(0, 80);

    if (!brands.length) {
      panel.innerHTML = '<div class="combo-empty">Aucune marque trouvée.</div>';
      panel.classList.remove("hidden");
      return;
    }

    panel.innerHTML = brands.map((b) => `<button type="button" class="suggest-item" data-brand="${esc(b.name)}">${esc(b.name)}</button>`).join("");
    panel.classList.remove("hidden");
  };

  const selectBrand = (name) => {
    selection.brand = { name };
    selection.model = null;
    selection.engine = null;

    const input = q("#brandInput");
    if (input) input.value = name;

    closeAllCombos();
    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
    loadModelsForBrand(name, true);
  };

  const updateModelButton = () => {
    const btn = q("#modelButton");
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
  };

  const updateEngineButton = () => {
    const btn = q("#engineButton");
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
  };

  const engineLabel = (o) => {
    const parts = [];
    if (o.fuel) parts.push(o.fuel);
    if (o.engine) parts.push(o.engine);
    if (o.displacement) parts.push(o.displacement);
    if (o.power && o.power !== "N/A") parts.push(o.power);
    if (o.transmission) parts.push(o.transmission);
    if (o.code) parts.push(o.code);
    if (o.years) parts.push(o.years);

    if (o.source && norm(o.source).includes("générateur")) parts.push("à confirmer");
    else if (o.source && o.source !== "catalogue local") parts.push(o.source);

    return parts.join(" • ");
  };

  const modelLabel = (o) => {
    const parts = [o.name];
    if (o.years) parts.push(o.years);
    if (o.source && o.source !== "catalogue local") parts.push(o.source);
    return parts.join(" • ");
  };

  const renderModelList = (filter) => {
    const list = q("#modelList");
    if (!list) return;

    const f = norm(filter || "");
    currentModelOptions = modelOptions.filter((o) => !f || norm(modelLabel(o)).includes(f));

    if (!currentModelOptions.length) {
      list.innerHTML = '<div class="combo-empty">Aucun modèle trouvé.</div>';
      return;
    }

    list.innerHTML = currentModelOptions.map((o, i) => `<button type="button" class="combo-option" data-model-index="${i}">${esc(modelLabel(o))}</button>`).join("");
  };

  const renderEngineList = (filter) => {
    const list = q("#engineList");
    if (!list) return;

    const f = norm(filter || "");
    currentEngineOptions = engineOptions.filter((o) => !f || norm(engineLabel(o)).includes(f));

    if (!currentEngineOptions.length) {
      list.innerHTML = '<div class="combo-empty">Aucune motorisation trouvée.</div>';
      return;
    }

    list.innerHTML = currentEngineOptions.map((o, i) => `<button type="button" class="combo-option" data-engine-index="${i}">${esc(engineLabel(o))}</button>`).join("");
  };

  const loadModelsForBrand = (brand, showLoading) => {
    const token = ++modelLoadToken;
    const year = parseYear((q("#vehicleYear") || {}).value);
    const local = getModels(brand, year);

    if (showLoading && local.length < 5) {
      modelOptions = local.concat([{
        id: "__loading__",
        brand,
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

    if (CONFIG.catalog.nhtsaEnabled && local.length < 30) {
      fetchNhtsaModels(brand).then((remote) => {
        if (token !== modelLoadToken) return;

        const merged = local.slice();
        const seen = {};
        merged.forEach((m) => { seen[m.id] = true; });

        remote.forEach((m) => {
          if (!seen[m.id]) {
            seen[m.id] = true;
            merged.push(m);
          }
        });

        merged.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

        if (!merged.length) {
          merged.push({
            id: "__custom__",
            brand,
            name: "Autre modèle (saisie libre)",
            years: "",
            source: "manuel"
          });
        }

        modelOptions = merged;
        renderModelList((q("#modelSearch") || {}).value || "");
        updateModelButton();
        updateAdminStats();
        refreshEngineOptions();
      }).catch(() => {
        if (token !== modelLoadToken) return;

        const merged = local.slice();
        if (!merged.length) {
          merged.push({
            id: "__custom__",
            brand,
            name: "Autre modèle (saisie libre)",
            years: "",
            source: "manuel"
          });
        }

        modelOptions = merged;
        renderModelList((q("#modelSearch") || {}).value || "");
        updateModelButton();
        refreshEngineOptions();
      });
    }

    refreshEngineOptions();
  };

  const selectModel = (opt) => {
    if (!opt || opt.id === "__loading__") return;

    if (opt.id === "__custom__") {
      const name = prompt("Nom exact du modèle recherché :", "");
      if (!name || !name.trim()) return;

      selection.model = {
        id: `custom|${normKey(name)}`,
        brand: selection.brand.name,
        name: name.trim(),
        years: "",
        source: "manuel"
      };
    } else {
      selection.model = opt;
    }

    selection.engine = null;

    closeAllCombos();
    updateModelButton();
    refreshEngineOptions();
    updateSelectionSummary();
  };

  const refreshEngineOptions = () => {
    if (!selection.brand || !selection.model) {
      engineOptions = [];
      currentEngineOptions = [];
      updateEngineButton();
      return;
    }

    const year = parseYear((q("#vehicleYear") || {}).value);
    let engines = getEnginesFor(selection.brand.name, selection.model.name, year);

    if (!engines.length) {
      engines = [{
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
      }];
    }

    engineOptions = engines;
    renderEngineList("");
    updateEngineButton();
  };

  const selectEngine = (opt) => {
    if (!opt) return;
    selection.engine = opt;

    closeAllCombos();
    updateEngineButton();
    updateSelectionSummary();
  };

  const updateSelectionSummary = () => {
    const el = q("#selectionSummary");
    if (!el) return;

    const v = getSelectedVehicleData();

    if (!v.marque && !v.modele && !v.annee && !v.engine) {
      el.textContent = "Aucune sélection véhicule complète.";
      return;
    }

    const parts = [];
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
  };

  const getSelectedVehicleData = () => {
    const brandEl = q("#brandInput");
    const yearEl = q("#vehicleYear");
    const kmEl = q("#vehicleKilometrage");
    const vinEl = q("#vehicleVin");

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
  };

  /* =========================================================
     ANALYSE / RAPPORT
     ========================================================= */
  const addTerm = (...args) => {
    args.forEach((t) => termesMobilises.add(t));
    return `<span class="termes-juridiques">(${args.join(", ")})</span>`;
  };

  const extractDtcCodes = (text) => {
    const m = String(text || "").match(/\b[PCBU][0-9A-F]{4}\b/gi) || [];
    return unique(m.map((x) => x.toUpperCase()));
  };

  const powerTokens = (p) => String(p || "")
    .split(/[^a-z0-9]+/i)
    .map((x) => norm(x))
    .filter((x) => x.length > 1);

  const legalForDefect = (d) => {
    const laws = [];
    if (d.law) laws.push(d.law);

    const tags = norm(d.tg || "");
    const symptoms = norm(d.s || "");
    const sev = d.sev || "moyen";
    const type = norm(d.et || "");

    if (sev === "critique") {
      laws.push("Vice caché art. 1641 C.civ.");
      laws.push("Défaut de conformité L.217-4 C.consom. si vendeur professionnel.");
      laws.push("Tromperie L.213-1 C.consom. en cas de dissimulation.");
    } else {
      laws.push("Vice caché art. 1641 C.civ. à confirmer par expertise.");
      laws.push("Usure normale à écarter selon kilométrage, entretien et usage.");
    }

    if (type.includes("diesel") || tags.includes("diesel") || tags.includes("egr") || tags.includes("fap") || tags.includes("adblue")) {
      laws.push("Conformité antipollution L.217-4 C.consom.; tromperie L.213-1 si dispositif illicite ou dissimulation.");
      laws.push("Sécurité / environnement L.423-1 C.consom. en cas de risque collectif.");
    }

    if (isElectricLike(type) || tags.includes("batterie") || tags.includes("charge") || tags.includes("electricite")) {
      laws.push("Sécurité batterie / BMS / charge L.423-1 C.consom.");
      laws.push("Produits défectueux art. 1245 C.civ.");
      laws.push("Conformité du bien numérique/logiciel L.217-4 C.consom.");
    }

    if (type.includes("essence") || tags.includes("turbo") || tags.includes("huile") || tags.includes("distribution")) {
      laws.push("Vice caché moteur art. 1641 C.civ.; usure à écarter par expertise.");
    }

    if (tags.includes("eau") || tags.includes("electricite") || symptoms.includes("court circuit")) {
      laws.push("Défaut de sécurité L.423-1 C.consom.");
      laws.push("Responsabilité du fait des produits défectueux art. 1245 C.civ.");
    }

    if (tags.includes("incendie") || symptoms.includes("incendie") || symptoms.includes("airbag")) {
      laws.push("Mise en danger art. 223-1 C.pénal.");
      laws.push("Homicide/blessures involontaires art. 221-6 / 222-19 C.pénal en cas d’accident.");
    }

    if (tags.includes("adas") || symptoms.includes("autopilot") || symptoms.includes("phantom")) {
      laws.push("Sécurité des systèmes automatisés L.423-1 C.consom.");
      laws.push("Responsabilité du constructeur/art. 1245 C.civ.");
    }

    return laws.filter((v, i, a) => a.indexOf(v) === i).join(" | ");
  };

  const symptomMatch = (textNorm, symptom) => {
    const s = norm(symptom);
    if (!s) return false;
    if (textNorm.includes(s)) return true;

    const words = s.split(/\s+/).filter((w) => w.length > 3);
    if (!words.length) return false;

    return words.every((w) => textNorm.includes(w));
  };

  const tagBoost = (textNorm, tags) => {
    let boost = 0;
    String(tags || "").split("|").forEach((t) => {
      const tn = norm(t);
      if (tn && textNorm.includes(tn)) boost += 0.35;
    });
    return boost;
  };

  const matchDefects = (v, text) => {
    const txt = norm(text);
    const yr = parseYear(v.annee);
    const km = parseKm(v.kilometrage);
    const dtcCodes = extractDtcCodes(text);
    const results = [];

    catalog.defects.forEach((d) => {
      if (v.marque && !brandMatches(d.b, v.marque)) return;
      if (!yearMatches(d.y, yr)) return;
      if (v.modele && d.m && d.m !== "*" && !modelListContains(d.m, v.modele)) return;

      let score = 0;
      const found = [];

      String(d.s || "").split("|").forEach((s) => {
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
        else if (norm(d.e).includes(norm(v.engine)) || norm(v.engine).includes(norm(d.e))) score += 3;
      }

      if (v.displacement && containsAny(`${d.e} ${d.n} ${d.tg}`, [v.displacement])) score += 2;

      if (v.power && d.p) {
        const sel = powerTokens(v.power);
        const def = powerTokens(d.p);
        if (sel.some((x) => def.includes(x))) score += 2;
      }

      if (v.fuel && norm(d.et) === norm(v.fuel)) score += 3;

      if (v.transmission && containsAny(`${d.tg} ${d.e} ${d.n}`, [v.transmission])) score += 1;

      if (v.code && containsAny(`${d.e} ${d.n} ${d.tg} ${d.dtc}`, [v.code])) score += 2;

      if (dtcCodes.length && d.dtc) {
        const dd = norm(d.dtc);
        if (dtcCodes.some((c) => dd.includes(norm(c)))) score += 3;
      }

      if (v.fuel && isElectricLike(v.fuel) && containsAny(`${d.tg} ${d.s}`, ["batterie", "charge", "autonomie", "electricite", "hybride", "48v"])) {
        score += 2;
      }

      if (norm(v.fuel) === "diesel" && containsAny(`${d.tg} ${d.s}`, ["diesel", "egr", "fap", "adblue", "nox", "pollution"])) {
        score += 2;
      }

      if (norm(v.fuel) === "essence" && containsAny(`${d.tg} ${d.s}`, ["essence", "turbo", "huile", "distribution", "courroie", "chaine"])) {
        score += 1.5;
      }

      if (score >= 1) {
        let confidence = "Haute";
        let wearAlert = "Kilométrage compatible avec un vice caché ou un défaut de série.";

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
          score,
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

    return results.sort((a, b) => b.score - a.score).slice(0, 12);
  };

  const engineAngle = (flags) => {
    let h = "";

    if (flags.engine) {
      h += '<div class="rappel-info"><h4>🧰 Motorisation retenue pour l’analyse</h4>';
      h += `<p><strong>Motorisation :</strong> ${esc(flags.engine)}</p>`;
      h += `<p><strong>Cylindrée / capacité :</strong> ${esc(flags.displacement || "non précisée")}</p>`;
      h += `<p><strong>Puissance :</strong> ${esc(flags.power || "non précisée")}</p>`;
      h += `<p><strong>Énergie :</strong> ${esc(flags.fuel || "non précisée")}</p>`;
      h += `<p><strong>Transmission / boîte :</strong> ${esc(flags.transmission || "non précisée")}</p>`;
      h += `<p><strong>Code moteur / système :</strong> ${esc(flags.code || "non communiqué")}</p>`;
      h += `<p><strong>Source motorisation :</strong> ${esc(flags.engineSource || "non précisée")}</p>`;
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
  };

  const runAnalysis = (text, context, objective, sellerType) => {
    const all = `${text} ${context}`.toLowerCase();
    const allNorm = norm(all);
    const fuelNorm = norm(vehicleData.fuel || "");

    const flags = {
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
      diesel: fuelNorm.includes("diesel") || containsAny(allNorm, ["diesel", "egr", "fap", "adblue", "nox", "gasoil"]),
      petrol: fuelNorm.includes("essence") || containsAny(allNorm, ["essence", "turbo", "puretech", "tce", "tsi", "ecoboost"]),
      hybrid: fuelNorm.includes("hybride"),
      phev: fuelNorm.includes("rechargeable"),
      mild48: fuelNorm.includes("48v"),
      electricLike: isElectricLike(fuelNorm),
      dtc: /\bp[0-9a-z]{3,5}\b/i.test(all) || allNorm.includes("dtc") || allNorm.includes("code défaut"),
      invoice: all.includes("facture"),
      repair: all.includes("réparation") || all.includes("ordre de réparation") || all.includes("devis"),
      controlTech: all.includes("contrôle technique") || all.includes(" ct "),
      warranty: all.includes("garantie"),
      highKm: parseKm(vehicleData.kilometrage) > 120000,
      veryHighKm: parseKm(vehicleData.kilometrage) > 180000
    };

    const matches = matchDefects(vehicleData, text);

    analysisData = {
      date: new Date().toLocaleString("fr-FR"),
      vehicleData,
      flags,
      matches,
      sections: []
    };

    const S = [];
    S.push(["I. IDENTIFICATION DU VÉHICULE ET SÉLECTIONS RENFORCÉES", secIdentification(text, context)]);
    S.push(["II. ANALYSE TECHNIQUE — MOTORISATION, DÉFAUTS CONNUS, USURE, SÉCURITÉ", secTechnique(matches, flags, vehicleData)]);
    S.push(["III. APPUI AUTO-DIAGNOSTIC ET FICHES CORRÉLÉES", secAuto(matches, flags)]);
    S.push(["IV. QUALIFICATION JURIDIQUE, RISQUES ET RÉGIMES DE GARANTIE", secJuridique(flags, matches, vehicleData)]);
    S.push(["V. PREUVE, STRATÉGIE ET VÉRIFICATIONS EXTERNES", secPreuve(matches, flags, objective)]);
    S.push(["VI. CONCLUSION ORIENTÉE INGÉNIEUR / JURISTE / SÉCURITÉ", secConclusion(objective, matches, flags, vehicleData)]);
    S.push(["VII. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ", secLexique()]);

    analysisData.sections = S;
    renderAnalysis();
  };

  const renderAnalysis = () => {
    let html = "";
    analysisData.sections.forEach((pair) => {
      html += `<h3>${pair[0]}</h3>${pair[1]}`;
    });

    html += '<div class="verification-needed"><strong>Rappel méthodologique :</strong> ce rapport effectue d’abord un croisement local technique/juridique/motorisation/auto-diagnostic avant toute rédaction assistée par IA. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>';

    const result = q("#analysisResult");
    if (result) result.innerHTML = html;

    const section = q("#analysisSection");
    if (section) {
      section.classList.remove("hidden");
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const secIdentification = (text, context) => {
    let h = `<p><strong>Objet :</strong> recensement des éléments fournis ${addTerm("éléments factuels", "faits allégués")}.</p>`;

    const availableEngines = vehicleData.marque && vehicleData.modele
      ? getEnginesFor(vehicleData.marque, vehicleData.modele, parseYear(vehicleData.annee))
      : [];

    h += "<h4>A. Véhicule sélectionné</h4><ul>";
    h += `<li><strong>Marque :</strong> ${esc(vehicleData.marque || "non précisée")}</li>`;
    h += `<li><strong>Modèle :</strong> ${esc(vehicleData.modele || "non précisé")}</li>`;
    h += `<li><strong>Année :</strong> ${esc(vehicleData.annee || "non précisée")} ${addTerm("millésime", "date de première mise en circulation")}</li>`;
    h += `<li><strong>Motorisation :</strong> ${esc(vehicleData.engine || "non précisée")}</li>`;
    h += `<li><strong>Cylindrée / capacité :</strong> ${esc(vehicleData.displacement || "non précisée")}</li>`;
    h += `<li><strong>Puissance :</strong> ${esc(vehicleData.power || "non précisée")}</li>`;
    h += `<li><strong>Énergie :</strong> ${esc(vehicleData.fuel || "non précisée")}</li>`;
    h += `<li><strong>Transmission / boîte :</strong> ${esc(vehicleData.transmission || "non précisée")}</li>`;
    h += `<li><strong>Code moteur / système :</strong> ${esc(vehicleData.code || "non communiqué")}</li>`;
    h += `<li><strong>Motorisations renforcées disponibles pour ce modèle/année :</strong> ${availableEngines.length}</li>`;
    h += `<li><strong>Kilométrage :</strong> ${esc(vehicleData.kilometrage || "non précisé")} km ${addTerm("kilométrage", "usure normale", "vétusté")}</li>`;
    h += `<li><strong>VIN :</strong> ${esc(vehicleData.vin || "non communiqué")} ${addTerm("VIN", "numéro de série", "traçabilité")}</li>`;
    h += "</ul>";

    if (availableEngines.length) {
      h += "<h4>B. Motorisations disponibles retenues par le moteur ingénieur</h4><ul>";
      availableEngines.slice(0, 25).forEach((e) => {
        h += `<li>${esc(engineLabel(e))}</li>`;
      });
      if (availableEngines.length > 25) h += `<li>… ${availableEngines.length - 25} autre(s) motorisation(s) disponible(s)</li>`;
      h += "</ul>";
    }

    h += "<h4>C. Faits rapportés</h4>";
    h += `<p>${esc(text.substring(0, 1400))}${text.length > 1400 ? " [...] (tronqué pour affichage, analyse complète conservée en mémoire)" : ""}</p>`;

    if (context) {
      h += `<h4>D. Contexte transactionnel</h4><p>${esc(context.substring(0, 1000))}</p>`;
    }

    h += `<div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ${addTerm("faits non vérifiés", "principe du contradictoire")}.</div>`;
    return h;
  };

  const secTechnique = (matches, flags, vData) => {
    const km = parseKm(vData.kilometrage);
    const yr = parseYear(vData.annee);
    const age = new Date().getFullYear() - (yr || new Date().getFullYear());

    let h = engineAngle(flags);

    if (!matches.length) {
      h += `<p><strong>Objet :</strong> recherche de défauts conceptuels connus ${addTerm("défauts conceptuels", "problèmes récurrents", "défaut de série")}.</p>`;
      h += '<div class="verification-needed">';
      h += "<p>Aucune correspondance exacte trouvée dans la base locale / auto-diagnostic pour Marque/Modèle/Année/Motorisation/Puissance/Cylindrée/Code/Symptômes.</p>";
      h += "<p>Cela ne signifie pas absence de défaut, mais absence de notoriété suffisante dans les sources consolidées localement.</p>";
      h += `<p>Une expertise individuelle est nécessaire ${addTerm("expertise individuelle", "analyse fonctionnelle", "recherche de cause racine")}.</p>`;
      h += "</div>";
      return h;
    }

    h += `<p><strong>Objet :</strong> croisement technique local avec motorisation, cylindrée, puissance, énergie, code moteur, défauts connus, rappels, TSB, forums spécialisés, DGCCRF, NHTSA, SafetyGate, KBA, auto-diagnostic et bases de sécurité ${addTerm("vice caché notoire", "défaut de série", "défaut de conception")}.</p>`;

    matches.forEach((m, i) => {
      const cls = m.severite === "critique" ? "rappel-critical" : "rappel-info";
      const confColor = m.confiance === "Haute" ? "#10b981" : (m.confiance === "Moyenne" ? "#f59e0b" : "#ef4444");

      h += `<div class="${cls}">`;
      h += `<h4>${i + 1}. ${esc(m.moteur)} — ${esc(m.puissance)} — ${esc(m.periode)}</h4>`;
      h += `<p><strong>Constructeur :</strong> ${esc(m.constructeur)}</p>`;
      h += `<p><strong>Modèles concernés :</strong> ${esc(m.modeles.join(", "))}</p>`;
      h += `<p><strong>Type motorisation :</strong> ${esc(m.engineType || "non précisé")}</p>`;
      h += `<p><strong>Symptômes détectés :</strong> ${esc(m.symptomes.join(", "))}</p>`;
      if (m.dtc) h += `<p><strong>Codes DTC associés :</strong> ${esc(m.dtc)}</p>`;
      h += `<p><strong>Tags système :</strong> ${esc(m.tags || "non précisé")}</p>`;
      h += `<p><strong>Source :</strong> ${esc(m.source || "base locale")}${m.sourceUrl ? ` — <a href='${esc(m.sourceUrl)}' target='_blank' rel='noopener noreferrer'>ouvrir la source</a>` : ""}</p>`;
      h += `<p><strong>Description technique :</strong> ${esc(m.description)}</p>`;
      h += `<p><strong>Gravité :</strong> <span style="font-weight:bold;color:${m.severite === "critique" ? "#dc3545" : "#ffc107"}">${esc(m.severite.toUpperCase())}</span></p>`;
      h += `<p><strong>Confiance vs usure :</strong> <span style="color:${confColor};font-weight:bold">${esc(m.confiance)}</span> — indice de non-usure : ${Math.round(m.wearFactor * 100)}%</p>`;
      h += `<p style="background:#fff3cd;padding:8px;border-radius:4px;">⚠️ ${esc(m.alerteUsure)}</p>`;
      h += `<p><strong>Croisement juridique local :</strong> ${esc(m.baseLegale)} ${addTerm("vice caché", "défaut de conformité", "tromperie")}</p>`;
      h += `<p><strong>Rappel / TSB / source :</strong> ${esc(m.rappelRef)} ${addTerm("rappel constructeur", "campagne technique", "TSB")}</p>`;
      h += "</div>";
    });

    h += "<h4>Analyse de vétusté et kilométrage</h4><ul>";
    h += `<li><strong>Âge approximatif :</strong> ${age} ans</li>`;
    h += `<li><strong>Kilométrage :</strong> ${km.toLocaleString("fr-FR")} km</li>`;
    h += `<li><strong>Rythme estimé :</strong> ${age > 0 ? Math.round(km / age).toLocaleString("fr-FR") : "N/A"} km/an</li>`;

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

    if (matches.some((m) => m.severite === "critique")) {
      h += '<div class="rappel-critical"><h4>🚨 Alerte sécurité civile / sapeur-pompier</h4>';
      h += "<p>Un défaut critique est identifié : risque moteur, incendie, perte de contrôle, airbag, batterie ou immobilisation brutale.</p>";
      h += "<p>En attendant expertise, limiter l’usage du véhicule, éviter autoroutes, transports d’enfants, trajets de nuit et longue durée.</p>";
      h += "</div>";
    }

    h += `<div class="certainty-medium"><strong>Synthèse :</strong> faisceau d’indices techniques ${addTerm("faisceau d’indices", "indice grave précis et concordant")} en faveur d’un défaut antérieur, caché et grave. Le vendeur professionnel aurait pu connaître ce risque ${addTerm("obligation de renseignement", "présomption de connaissance")}.</div>`;

    return h;
  };

  const secAuto = (matches, flags) => {
    const autoMatches = matches.filter((m) => m.source === "auto-diagnostic");
    const autoCount = catalog.defects.filter((d) => d.source === "auto-diagnostic").length;
    const autoEngineCount = catalog.engines.filter((e) => e.source === "auto-diagnostic").length;

    let h = `<p><strong>Objet :</strong> appui technique issu de la base auto-diagnostic, corrélé au contexte du litige et à la motorisation ${addTerm("appui technique", "corrélation auto-diagnostic", "fiche expert", "DTC", "motorisation")}.</p>`;
    h += `<p><strong>Entrées auto-diagnostic disponibles :</strong> ${autoCount} fiche(s) / ${autoEngineCount} motorisation(s) renforcée(s).</p>`;

    if (!autoCount) {
      h += '<div class="verification-needed">';
      h += "<p>La base auto-diagnostic n’a pas encore exposé de données exploitables via JSON ou extraction HTML/JS.</p>";
      h += `<p>URL configurée : <code>${esc(CONFIG.catalog.autoBaseUrl)}</code></p>`;
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

    h += '<div class="rappel-info"><h4>Fiches auto-diagnostic corrélées au litige</h4><ul>';

    autoMatches.slice(0, 10).forEach((m, i) => {
      h += `<li><strong>${i + 1}. ${esc(m.constructeur)} ${esc(m.modeles.join(", "))} — ${esc(m.moteur)}</strong>`;
      if (m.engineType) h += ` — type : ${esc(m.engineType)}`;
      if (m.dtc) h += ` — DTC : ${esc(m.dtc)}`;
      h += `<br/><strong>Symptômes :</strong> ${esc(m.symptomes.join(", "))}`;
      h += `<br/><strong>Description :</strong> ${esc(m.description)}`;
      if (m.sourceUrl) h += `<br/><strong>Source :</strong> <a href='${esc(m.sourceUrl)}' target='_blank' rel='noopener noreferrer'>${esc(m.sourceUrl)}</a>`;
      h += `<br/><strong>Appui juridique :</strong> ${esc(m.baseLegale)}`;
      h += "</li>";
    });

    h += "</ul></div>";

    h += "<h4>Exploitation experte / juriste de l’appui auto-diagnostic</h4><ul>";
    h += `<li>${addTerm("corrélation technique", "faisceau d’indices")} : les fiches auto-diagnostic permettent de démontrer que le désordre n’est pas isolé mais documenté.</li>`;
    h += `<li>${addTerm("antériorité", "défaut de série")} : si la fiche vise le même moteur / boîte / système, l’origine antérieure à la vente est renforcée.</li>`;
    h += `<li>${addTerm("caractère caché", "non-décelable par examen standard")} : les défauts électroniques, logiciels, ADAS, batterie, infiltration ou mécatronique ne sont généralement pas visibles lors d’un essai court.</li>`;
    h += `<li>${addTerm("gravité", "coût de réparation", "sécurité")} : les DTC et fiches expert aident à qualifier l’impact sur la sécurité, la valeur d’usage et le coût de remise en état.</li>`;

    if (flags.professional) {
      h += `<li>${addTerm("vendeur professionnel", "obligation de conseil", "vérification des rappels")} : la notoriété du défaut dans la base auto-diagnostic peut fonder une présomption de connaissance ou de faute.</li>`;
    } else {
      h += `<li>${addTerm("vendeur particulier", "mauvaise foi", "réticence dolosive")} : si le vendeur connaissait la fiche / rappel / DTC, la clause vendu en l’état peut être écartée.</li>`;
    }

    h += "</ul>";
    return h;
  };

  const secJuridique = (flags, matches) => {
    let h = `<p><strong>Objet :</strong> qualification juridique, risques et régimes de garantie ${addTerm("qualification juridique", "responsabilité", "garantie")}.</p>`;

    if (flags.professional && !flags.privateSeller) {
      h += `<div class="certainty-high"><p>Vendeur présumé professionnel ${addTerm("vendeur professionnel")}. Protection consommateur renforcée : garantie légale de conformité, charge de la preuve allégée, obligation d’information et de vérification des rappels.</p></div>`;
    } else if (flags.privateSeller && !flags.professional) {
      h += `<div class="certainty-medium"><p>Vendeur présumé particulier ${addTerm("vente entre particuliers")}. Garantie des vices cachés du Code civil. Charge de la preuve plus lourde pour l’acquéreur.</p></div>`;
    } else {
      h += `<div class="certainty-low"><p>Statut du vendeur incertain ${addTerm("ambiguïté statut vendeur")}. Qualifier d’abord le vendeur avant action.</p></div>`;
    }

    h += "<h4>A. Critères cumulatifs</h4>";
    h += `<p><strong>Antériorité :</strong> ${matches.some((m) => m.confiance === "Haute") ? "renforcée par défaut de série / logiciel / conception." : "à confirmer par expertise."} ${addTerm("antériorité")}</p>`;
    h += `<p><strong>Caractère caché :</strong> ${matches.some((m) => m.wearFactor >= 0.8) ? "soutenable, défaut non visible lors d’un examen standard." : "à apprécier concrètement."} ${addTerm("caractère caché")}</p>`;
    h += `<p><strong>Gravité :</strong> ${matches.some((m) => m.severite === "critique") ? "élevée : sécurité, casse, incendie, immobilisation, coût disproportionné." : "à mesurer par devis et usage normal."} ${addTerm("gravité")}</p>`;

    h += "<h4>B. Régimes mobilisables</h4><ul>";
    h += `<li>${addTerm("garantie des vices cachés", "1641 C.civ.")}</li>`;

    if (flags.professional) {
      h += `<li>${addTerm("garantie légale de conformité", "L.217-4 C.consom.")}</li>`;
      h += `<li>${addTerm("responsabilité contractuelle", "1231-1 C.civ.")}</li>`;
      h += `<li>${addTerm("tromperie", "L.213-1 C.consom.")}</li>`;
      h += `<li>${addTerm("pratique commerciale trompeuse", "L.121-2 C.consom.")}</li>`;
    } else {
      h += `<li>${addTerm("dol", "1137 C.civ.")} si dissimulation</li>`;
      h += `<li>${addTerm("obligation d’information précontractuelle", "1112-1 C.civ.")}</li>`;
    }

    h += `<li>${addTerm("produits défectueux", "1245 C.civ.")}</li>`;
    h += `<li>${addTerm("défaut de sécurité", "L.423-1 C.consom.")}</li>`;
    h += "</ul>";

    if (flags.diesel) {
      h += "<h4>C. Incidence diesel</h4><ul>";
      h += `<li>Conformité antipollution ${addTerm("L.217-4 C.consom.")}</li>`;
      h += `<li>Tromperie si dispositif illicite ou dissimulation ${addTerm("L.213-1 C.consom.")}</li>`;
      h += `<li>Rappel / campagne technique ${addTerm("DGCCRF", "KBA", "NHTSA")}</li>`;
      h += "</ul>";
    }

    if (flags.electricLike) {
      h += "<h4>D. Incidence électrifiée</h4><ul>";
      h += `<li>Sécurité batterie / charge / BMS ${addTerm("L.423-1 C.consom.")}</li>`;
      h += `<li>Conformité logiciel / autonomie ${addTerm("L.217-4 C.consom.")}</li>`;
      h += `<li>Produits défectueux ${addTerm("1245 C.civ.")}</li>`;
      h += "</ul>";
    }

    return h;
  };

  const researchLinks = (brand, model, engine, symptoms, fuel) => {
    const baseQuery = `${brand} ${model} ${engine || ""} ${fuel || ""} ${(symptoms || []).slice(0, 3).join(" ")}`.trim();
    const q1 = encodeURIComponent(`${baseQuery} défaut panne rappel incendie DTC motorisation puissance cylindrée`);
    const q2 = encodeURIComponent(`${brand} ${model}`);

    return [
      { label: "Base auto-diagnostic", url: CONFIG.catalog.autoBaseUrl },
      { label: "Recherche spécialisée Google / forums techniques", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France (DGCCRF)", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls (USA)", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / défauts constructeurs", url: "https://www.google.com/search?q=" + encodeURIComponent(`${baseQuery} safetygate TSB rappel défaut`) },
      { label: "Rappels allemands KBA", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} KBA Rückruf`) },
      { label: "Vérification VIN constructeur", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} VIN recall campaign motorisation`) }
    ];
  };

  const secPreuve = (matches, flags, objective) => {
    let h = `<p><strong>Objet :</strong> dossier probatoire, stratégie et vérifications ${addTerm("preuve documentaire", "stratégie contentieuse")}.</p>`;

    h += "<h4>A. Documents à consolider</h4><ul>";
    h += `<li>Facture d’achat : ${flags.invoice ? "présente" : "à récupérer"}</li>`;
    h += "<li>Certificat de cession / carte grise : vérifier motorisation, énergie, puissance, cylindrée, kilométrage</li>";
    h += `<li>Contrôle technique : ${flags.controlTech ? "présent" : "à récupérer"}</li>`;
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
    if (matches.length) h += `<li>Invoquer le défaut de série documenté ${addTerm("défaut de série", "présomption de connaissance")}</li>`;
    h += "<li>Conciliation / médiation si professionnel</li>";
    h += "<li>Assignation / expertise judiciaire si nécessaire</li>";
    if (matches.some((m) => m.severite === "critique")) h += "<li>Signalement DGCCRF / préfet / NHTSA / KBA si danger collectif</li>";
    h += "</ol>";

    const links = researchLinks(
      vehicleData.marque,
      vehicleData.modele,
      matches[0] ? matches[0].moteur : vehicleData.engine,
      matches[0] ? matches[0].symptomes : [],
      vehicleData.fuel
    );

    h += "<h4>C. Pistes de recherche externe</h4><ul>";
    links.forEach((l) => {
      h += `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`;
    });
    h += "</ul>";

    if (objective) h += `<p><strong>Objectif déclaré :</strong> ${esc(objective)}</p>`;

    return h;
  };

  const secConclusion = (objective, matches, flags, vData) => {
    const high = matches.some((m) => m.confiance === "Haute");
    const critical = matches.some((m) => m.severite === "critique");
    const auto = matches.some((m) => m.source === "auto-diagnostic");

    let h = `<p><strong>Objet :</strong> conclusion prudente orientée ingénieur / juriste ${addTerm("synthèse", "conclusion")}.</p>`;

    h += `<p><strong>Sélections prises en compte :</strong> ${esc(vData.marque || "marque non précisée")} / ${esc(vData.modele || "modèle non précisé")} / ${esc(vData.annee || "année non précisée")} / ${esc(vData.engine || "motorisation non précisée")}${vData.displacement ? " / " + esc(vData.displacement) : ""}${vData.power && vData.power !== "N/A" ? " / " + esc(vData.power) : ""}${vData.fuel ? " / " + esc(vData.fuel) : ""}${vData.transmission ? " / " + esc(vData.transmission) : ""}${vData.code ? " / code " + esc(vData.code) : ""}.</p>`;

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

    if (flags.diesel) h += "<p><strong>Incidence diesel :</strong> la qualification peut mobiliser conformité antipollution, tromperie, rappel et sécurité produit.</p>";
    if (flags.electricLike) h += "<p><strong>Incidence électrifiée :</strong> la qualification peut mobiliser batterie, autonomie, charge, logiciel, sécurité incendie et produits défectueux.</p>";

    h += "<p><strong>Recommandation opérationnelle :</strong> ne pas effectuer de réparation destructrice avant constat/expertise. Conserver le véhicule en l’état si possible, photographier, obtenir devis, exporter les fiches auto-diagnostic corrélées, puis mise en demeure LRAR.</p>";

    if (flags.professional) {
      h += "<p><strong>Si vendeur professionnel :</strong> privilégier garantie légale de conformité + signalement DGCCRF si danger.</p>";
    } else {
      h += "<p><strong>Si vendeur particulier :</strong> privilégier expertise amiable puis action en vices cachés.</p>";
    }

    h += '<div class="certainty-low"><strong>Avertissement :</strong> document d’aide à la rédaction. Ne constitue pas un avis juridique définitif.</div>';

    return h;
  };

  const secLexique = () => {
    const terms = Array.from(termesMobilises).sort();
    let h = `<p><strong>Termes mobilisés :</strong> ${terms.length}</p><div class="lexique-section">`;
    terms.forEach((t) => {
      h += `<div class="lexique-item"><strong>${esc(t)}</strong></div>`;
    });
    h += "</div>";
    return h;
  };

  /* =========================================================
     ADMIN
     ========================================================= */
  const updateDataStatus = (msg) => {
    const el = q("#dataStatus");
    if (el) el.textContent = msg;
  };

  const updateAdminStats = () => {
    const autoCount = catalog.defects.filter((d) => d.source === "auto-diagnostic").length;

    if (q("#statBrands")) q("#statBrands").textContent = getAllBrands().length;
    if (q("#statModels")) q("#statModels").textContent = catalog.models.length;
    if (q("#statEngines")) q("#statEngines").textContent = catalog.engines.length;
    if (q("#statEntries")) q("#statEntries").textContent = catalog.defects.length;
    if (q("#statAutoEntries")) q("#statAutoEntries").textContent = autoCount;

    if (q("#statAutoSync")) q("#statAutoSync").textContent = autoLastSync ? new Date(autoLastSync).toLocaleString("fr-FR") : "Jamais";

    const last = loadWithMigration(KEYS.LAST_UPDATE, OLD_KEYS.LAST_UPDATE, 0);
    if (q("#statSync")) q("#statSync").textContent = last ? new Date(last).toLocaleString("fr-FR") : "Jamais";
  };

  const renderRequests = () => {
    const box = q("#pendingRequests");
    if (!box) return;

    const all = getRequests().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const pending = all.filter((r) => r.status === "pending");
    const processed = all.filter((r) => r.status !== "pending").slice(0, 30);

    if (q("#pendingCount")) q("#pendingCount").textContent = pending.length;

    if (!all.length) {
      box.innerHTML = '<p class="empty-state">Aucune demande.</p>';
      return;
    }

    let html = "";

    html += `<h4>À traiter (${pending.length})</h4>`;

    if (!pending.length) {
      html += '<p class="empty-state">Aucune demande en attente.</p>';
    } else {
      html += pending.map((r) => (
        `<div class="card pending">` +
        `<strong>${esc(r.name)}</strong> <small>${esc(r.email)}</small>` +
        `<p>${esc(r.reason)}</p>` +
        `<small>${esc(r.date || "")} • source : ${esc(r.source || "locale")}</small>` +
        `<div class="actions">` +
        `<button class="btn-ok" data-action="approve" data-id="${esc(r.id)}" type="button">Accepter</button>` +
        `<button class="btn-no" data-action="refuse" data-id="${esc(r.id)}" type="button">Refuser</button>` +
        `</div></div>`
      )).join("");
    }

    if (processed.length) {
      html += "<h4>Dernières demandes traitées</h4>";

      html += processed.map((r) => {
        const cls = r.status === "approved" ? "approved" : "refused";
        const label = r.status === "approved" ? "Acceptée" : "Refusée";
        let actions = "";

        if (r.status === "approved") {
          actions = `<button class="btn-ok" data-action="share-grant" data-email="${esc(r.email)}" data-name="${esc(r.name)}" type="button">📤 Envoyer l’accès au tiers</button>`;
        }

        return `<div class="card ${cls}">` +
          `<strong>${esc(r.name)}</strong> <small>${esc(r.email)}</small>` +
          `<p>${esc(r.reason)}</p>` +
          `<small>Statut : ${esc(label)} • ${esc(r.processedDate || r.date || "")}</small>` +
          (actions ? `<div class="actions">${actions}</div>` : "") +
          `</div>`;
      }).join("");
    }

    box.innerHTML = html;
  };

  const renderUsers = () => {
    const box = q("#authorizedUsers");
    if (!box) return;

    const users = getUsers().filter((u) => u.role !== "admin");

    if (!users.length) {
      box.innerHTML = '<p class="empty-state">Aucun tiers.</p>';
      return;
    }

    box.innerHTML = users.map((u) => {
      const action = u.status === "approved"
        ? `<button class="btn-warn" data-action="revoke" data-email="${esc(u.email)}" data-name="${esc(u.name)}" type="button">Révoquer</button>`
        : `<button class="btn-ok" data-action="restore" data-email="${esc(u.email)}" data-name="${esc(u.name)}" type="button">Rétablir</button>`;

      return `<div class="card ${esc(u.status)}">` +
        `<strong>${esc(u.name)}</strong> <small>${esc(u.email)} • ${esc(u.status)}</small>` +
        `<div class="actions">${action}</div>` +
        `</div>`;
    }).join("");
  };

  const renderAdmin = () => {
    renderRequests();
    renderUsers();
    renderCatalogConfig();
    updateAdminStats();
  };

  /* =========================================================
     PDF / EXPORT
     ========================================================= */
  const ensurePdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.async = true;
      s.onload = () => {
        if (!window.pdfjsLib) return reject(new Error("PDF.js non chargé"));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error("PDF.js indisponible"));
      document.head.appendChild(s);
    });
  };

  const ensureJsPdf = () => {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);

    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.async = true;
      s.onload = () => {
        if (!window.jspdf || !window.jspdf.jsPDF) return reject(new Error("jsPDF non chargé"));
        resolve(window.jspdf.jsPDF);
      };
      s.onerror = () => reject(new Error("jsPDF indisponible"));
      document.head.appendChild(s);
    });
  };

  const readFileAsArrayBuffer = (file) => {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const pdfStatus = (msg, type) => {
    const el = q("#pdfStatus");
    if (el) {
      el.textContent = msg;
      el.className = "status " + type;
    } else {
      toast(msg, type);
    }
  };

  const buildPrintHtml = () => {
    let body = "";
    if (analysisData && analysisData.sections) {
      analysisData.sections.forEach((pair) => {
        body += `<h2>${pair[0]}</h2>${pair[1]}`;
      });
    }

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Rapport Expert Auto</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
h1 { text-align: center; }
h2 { margin-top: 28px; border-bottom: 1px solid #999; padding-bottom: 6px; }
.termes-juridiques { background: #eee; padding: 2px 6px; border-radius: 4px; font-style: italic; }
.rappel-critical, .certainty-low { border-left: 4px solid #c00; background: #fff5f5; padding: 10px; margin: 10px 0; }
.rappel-info, .certainty-medium, .verification-needed { border-left: 4px solid #06c; background: #f5fbff; padding: 10px; margin: 10px 0; }
.certainty-high { border-left: 4px solid #090; background: #f5fff7; padding: 10px; margin: 10px 0; }
</style>
</head>
<body>
<h1>Rapport d’analyse expert auto</h1>
<p><strong>Date :</strong> ${esc(analysisData.date || "")}</p>
<p><strong>Véhicule :</strong> ${esc(vehicleData.marque || "")} ${esc(vehicleData.modele || "")} ${esc(vehicleData.annee || "")}</p>
<p><strong>Motorisation :</strong> ${esc(vehicleData.engine || "")} — ${esc(vehicleData.displacement || "")} — ${esc(vehicleData.power || "")} — ${esc(vehicleData.fuel || "")}</p>
<p><strong>Kilométrage :</strong> ${esc(vehicleData.kilometrage || "")} km</p>
${body}
</body>
</html>`;
  };

  const downloadHtmlReport = () => {
    const html = buildPrintHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rapport-expert-auto.html";
    a.click();
    toast("Rapport HTML téléchargé. Ouvrez-le et imprimez en PDF.", "info");
  };

  const printReportFallback = () => {
    const win = window.open("", "_blank");
    if (!win) {
      downloadHtmlReport();
      return;
    }

    win.document.open();
    win.document.write(buildPrintHtml());
    win.document.close();

    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        downloadHtmlReport();
      }
    }, 350);
  };

  const generatePdfWithJsPdf = async () => {
    const jsPDF = await ensureJsPdf();
    const doc = new jsPDF();
    let y = 20;

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

    analysisData.sections.forEach((pair) => {
      const title = pair[0];
      const content = pair[1];

      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      doc.setFont(undefined, "bold");
      doc.setFontSize(11);
      const titleLines = doc.splitTextToSize(title, 170);
      doc.text(titleLines, 20, y);
      y += titleLines.length * 5 + 2;

      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      const plain = stripTags(content);
      const lines = doc.splitTextToSize(plain, 170);

      lines.forEach((line) => {
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
  };

  /* =========================================================
     SERVICE WORKER
     ========================================================= */
  const registerServiceWorker = () => {
    try {
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker
          .register("./sw.js")
          .then((reg) => {
            swRegistration = reg;
            return navigator.serviceWorker.ready;
          })
          .then((reg) => {
            swRegistration = reg;
            console.log("[AR-EXPERT] Service Worker prêt.");
          })
          .catch((err) => console.warn("[AR-EXPERT] Service Worker non enregistré:", err));
      }
    } catch (e) {
      console.warn("[AR-EXPERT] Enregistrement SW impossible:", e);
    }
  };

  const clearCacheAndReload = () => {
    const unload = ("serviceWorker" in navigator)
      ? navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister().catch(() => {}))))
      : Promise.resolve();

    const delCache = ("caches" in window)
      ? caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n).catch(() => {}))))
      : Promise.resolve();

    Promise.all([unload.catch(() => {}), delCache.catch(() => {})])
      .then(() => location.reload(true))
      .catch(() => location.reload(true));
  };

  /* =========================================================
     EVENEMENTS UI
     ========================================================= */
  const shareTextUrl = (text, url, title) => {
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => copyFallback(url));
    } else {
      copyFallback(url);
    }
  };

  const copyFallback = (url) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast("Lien copié.", "success")).catch(() => toast("Copie impossible.", "error"));
    } else {
      toast("Partage/copie non supporté.", "warning");
    }
  };

  const bindUi = () => {
    qa(".auth-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        qa(".auth-tab").forEach((b) => b.classList.remove("active"));
        qa(".auth-pane").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");

        const pane = q("#" + btn.dataset.authTab + "Pane");
        if (pane) pane.classList.add("active");

        authMessage("", "");
      });
    });

    on("#adminLoginBtn", "click", async () => {
      const pwdEl = q("#adminPassword");
      const rememberEl = q("#rememberAdminPwd");
      const pwd = pwdEl ? pwdEl.value : "";
      const remember = rememberEl ? rememberEl.checked : false;

      if (!pwd) {
        authMessage("Mot de passe requis.", "error");
        return;
      }

      const ok = await verifyAdminPassword(pwd);
      if (!ok) {
        authMessage("Mot de passe incorrect.", "error");
        return;
      }

      if (remember) {
        const h = await sha256(pwd);
        save(KEYS.ADMIN_PWD_HASH, h);
        refreshSavedPasswordButton();
      } else {
        del(KEYS.ADMIN_PWD_HASH);
        refreshSavedPasswordButton();
      }

      setSession({ id: "admin", name: "Administrateur", email: "admin@local", role: "admin", status: "approved" });
      showApp();
      toast("Connexion admin réussie.", "success");
      if (pwdEl) pwdEl.value = "";
    });

    on("#useSavedPwdBtn", "click", async () => {
      const saved = loadWithMigration(KEYS.ADMIN_PWD_HASH, OLD_KEYS.ADMIN_PWD_HASH, null);
      if (!saved) {
        authMessage("Aucun mot de passe enregistré.", "warning");
        return;
      }

      const ok = await loginAdminFromHash(saved);
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

    on("#requestBtn", "click", () => {
      const nameEl = q("#reqName");
      const emailEl = q("#reqEmail");
      const reasonEl = q("#reqReason");

      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      const reason = reasonEl ? reasonEl.value.trim() : "";

      if (!name || !email || !reason) {
        authMessage("Nom, email et motif sont requis.", "error");
        return;
      }

      const requests = getRequests();
      const emailKey = userEmailKey(email);

      const alreadyPending = requests.find((r) => r.emailNorm === emailKey && r.status === "pending");
      if (alreadyPending) {
        authMessage("Demande déjà en attente.", "warning");
        return;
      }

      const existingApproved = findApprovedUser(name, email);
      if (existingApproved) {
        authMessage("Accès déjà accordé. Utilisez Connexion tiers.", "success");
        return;
      }

      const req = migrateRequest({
        id: uid(),
        name,
        email,
        reason,
        status: "pending",
        date: new Date().toLocaleString("fr-FR"),
        ts: Date.now(),
        source: "formulaire-local"
      });

      requests.push(req);
      saveRequests(requests);

      lastSharedAccessRequest = req;

      const shareBtn = q("#shareRequestBtn");
      if (shareBtn) shareBtn.classList.remove("hidden");

      publishAccessRequest(req);

      authMessage("Demande envoyée. Si l’admin est sur le même appareil, il sera notifié. Sinon, utilisez ‘Partager la demande avec l’admin’.", "success");

      if (nameEl) nameEl.value = "";
      if (emailEl) emailEl.value = "";
      if (reasonEl) reasonEl.value = "";
    });

    on("#shareRequestBtn", "click", () => {
      if (!lastSharedAccessRequest) {
        toast("Aucune demande à partager.", "warning");
        return;
      }

      const url = makeAccessRequestShareUrl(lastSharedAccessRequest);
      const text =
        "Demande d’accès Expert Auto\n" +
        "Nom : " + lastSharedAccessRequest.name + "\n" +
        "Email : " + lastSharedAccessRequest.email + "\n" +
        "Motif : " + lastSharedAccessRequest.reason + "\n" +
        "Lien admin : " + url;

      shareTextUrl(text, url, "Demande d’accès Expert Auto");
    });

    on("#thirdLoginBtn", "click", () => {
      const nameEl = q("#loginName");
      const emailEl = q("#loginEmail");

      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";

      if (!email) {
        authMessage("Email requis.", "error");
        return;
      }

      const user = findApprovedUser(name, email);

      if (!user) {
        const emailKey = userEmailKey(email);
        const pending = getRequests().find((r) => r.status === "pending" && r.emailNorm === emailKey);

        if (pending) {
          authMessage("Votre demande est en attente de validation admin. Nom enregistré : " + pending.name, "warning");
          return;
        }

        authMessage("Aucun accès approuvé trouvé pour cet email. Demandez l’accès puis attendez la validation admin, ou ouvrez le lien d’accès envoyé par l’admin.", "error");
        return;
      }

      setSession(user);
      showApp();
      toast("Connexion tiers réussie.", "success");
    });

    on("#logoutBtn", "click", () => {
      clearSession();
      showLogin();
      toast("Déconnexion effectuée.", "info");
    });

    on("#clearCacheBtn", "click", clearCacheAndReload);

    on("#brandInput", "input", () => {
      selection.brand = null;
      selection.model = null;
      selection.engine = null;
      updateModelButton();
      updateEngineButton();
      updateSelectionSummary();
      renderBrandPanel();
    });

    on("#brandInput", "focus", renderBrandPanel);
    on("#brandInput", "blur", () => setTimeout(closeAllCombos, 160));

    on("#brandPanel", "mousedown", (e) => {
      const btn = e.target.closest("[data-brand]");
      if (!btn) return;
      e.preventDefault();
      selectBrand(btn.getAttribute("data-brand"));
    });

    on("#modelButton", "click", () => {
      if (!selection.brand) return;
      const panel = q("#modelPanel");
      const isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("modelPanel");
      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderModelList("");
        const search = q("#modelSearch");
        if (search) setTimeout(() => search.focus(), 30);
      }
    });

    on("#modelSearch", "input", function () {
      renderModelList(this.value);
    });

    on("#modelList", "mousedown", (e) => {
      const btn = e.target.closest("[data-model-index]");
      if (!btn) return;
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-model-index"), 10);
      selectModel(currentModelOptions[idx]);
    });

    on("#engineButton", "click", () => {
      if (!selection.brand || !selection.model) return;
      const panel = q("#enginePanel");
      const isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("enginePanel");
      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderEngineList("");
        const search = q("#engineSearch");
        if (search) setTimeout(() => search.focus(), 30);
      }
    });

    on("#engineSearch", "input", function () {
      renderEngineList(this.value);
    });

    on("#engineList", "mousedown", (e) => {
      const btn = e.target.closest("[data-engine-index]");
      if (!btn) return;
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-engine-index"), 10);
      selectEngine(currentEngineOptions[idx]);
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".combo")) closeAllCombos();
    });

    on("#vehicleYear", "input", () => {
      if (selection.brand) loadModelsForBrand(selection.brand.name, false);
      refreshEngineOptions();
      updateSelectionSummary();
    });

    on("#vehicleYear", "change", () => {
      if (selection.brand) loadModelsForBrand(selection.brand.name, false);
      refreshEngineOptions();
      updateSelectionSummary();
    });

    on("#pdfUpload", "change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        pdfStatus("Format non supporté. PDF uniquement.", "error");
        return;
      }

      pdfStatus("Chargement de la bibliothèque PDF...", "success");

      try {
        await ensurePdfJs();
        pdfStatus("Extraction du texte en cours...", "success");

        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";
        const promises = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          promises.push(
            pdf.getPage(i)
              .then((page) => page.getTextContent())
              .then((tc) => {
                fullText += tc.items.map((item) => item.str).join(" ") + "\n\n";
              })
          );
        }

        await Promise.all(promises);

        extractedText = fullText;
        const textInput = q("#textInput");
        if (textInput) textInput.value = fullText;
        pdfStatus(`PDF extrait avec succès (${pdf.numPages} pages).`, "success");
      } catch (err) {
        console.warn(err);
        pdfStatus("Extraction PDF indisponible : " + err.message + ". Saisissez le texte manuellement.", "error");
      }
    });

    on("#analyzeBtn", "click", () => {
      if (!currentUser) {
        toast("Connectez-vous.", "error");
        return;
      }

      const info = dailyInfo();
      if (!info.allowed) {
        toast(`Limite de ${CONFIG.maxDailyAnalyses} analyses/jour atteinte.`, "warning");
        return;
      }

      const textEl = q("#textInput");
      const contextEl = q("#contextInfo");
      const objectiveEl = q("#objectiveInfo");
      const goalEl = q("#goalSelect");
      const sellerEl = q("#sellerType");

      let text = textEl ? textEl.value.trim() : "";
      if (!text) text = extractedText.trim();

      const context = contextEl ? contextEl.value.trim() : "";
      const objective = (objectiveEl && objectiveEl.value.trim()) || (goalEl ? goalEl.value : "") || "";
      const sellerType = sellerEl ? sellerEl.value : "unknown";

      vehicleData = getSelectedVehicleData();

      if (!text) {
        toast("Saisissez des faits ou importez un PDF.", "warning");
        return;
      }

      termesMobilises = new Set();

      const btn = q("#analyzeBtn");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Analyse experte + motorisation + auto-diagnostic en cours...';
      }

      setTimeout(() => {
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

    on("#adminPanelBtn", "click", () => {
      if (!currentUser || currentUser.role !== "admin") return;
      const panel = q("#adminPanel");
      if (panel) panel.classList.remove("hidden");
      renderAdmin();
    });

    on("#closeAdminBtn", "click", () => {
      const panel = q("#adminPanel");
      if (panel) panel.classList.add("hidden");
    });

    qa(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        qa(".admin-tab").forEach((b) => b.classList.remove("active"));
        qa(".admin-pane").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const pane = q("#" + btn.dataset.adminTab + "Pane");
        if (pane) pane.classList.add("active");
      });
    });

    on("#adminPanel", "click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === "approve" || action === "refuse") {
        const id = btn.dataset.id;
        const reqs = getRequests();
        const req = reqs.find((r) => r.id === id);
        if (!req) return;

        req.status = action === "approve" ? "approved" : "refused";
        req.processedAt = Date.now();
        req.processedDate = new Date(req.processedAt).toLocaleString("fr-FR");

        if (action === "approve") {
          const user = upsertUser({
            id: req.id,
            name: req.name,
            email: req.email,
            role: "user",
            status: "approved",
            daily: { date: todayKey(), count: 0 }
          });

          req.userId = user.key;
          notify("Accès approuvé", `${req.name} (${req.email})`);
        }

        saveRequests(reqs);

        if (broadcast) {
          try { broadcast.postMessage({ type: "access-change", payload: { email: req.email, status: req.status } }); } catch {}
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
        const emailKey = userEmailKey(btn.dataset.email || "");
        const users = getUsers();

        const idx = users.findIndex((u) => u.emailNorm === emailKey && u.role !== "admin");
        if (idx >= 0) {
          users[idx].status = action === "revoke" ? "revoked" : "approved";
          users[idx].updatedAt = Date.now();

          saveUsers(users);

          if (broadcast) {
            try { broadcast.postMessage({ type: "access-change", payload: { email: users[idx].email, status: users[idx].status } }); } catch {}
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
        const name = btn.dataset.name || "";
        const email = btn.dataset.email || "";

        const user = findApprovedUser(name, email);
        if (!user) {
          toast("Aucun utilisateur approuvé trouvé pour cet email.", "error");
          return;
        }

        const url = makeAccessGrantUrl(user);
        const text =
          "Accès Expert Auto accordé\n" +
          "Nom : " + user.name + "\n" +
          "Email : " + user.email + "\n" +
          "Ouvrez ce lien dans l’application pour être connecté automatiquement :\n" +
          url;

        shareTextUrl(text, url, "Accès Expert Auto");
      }
    });

    on("#enableNotifBtn", "click", async () => {
      const permission = await askNotification();
      if (permission === "granted") toast("Notifications admin activées.", "success");
      else if (permission === "denied") toast("Notifications bloquées. Autorisez-les dans Android / navigateur.", "warning");
      else toast("Permission notification : " + permission, "info");
    });

    on("#testNotifBtn", "click", async () => {
      const permission = await askNotification();
      if (permission === "granted") {
        notify("Test Expert Auto", "La notification admin fonctionne correctement.", "test-" + Date.now());
        toast("Notification de test envoyée.", "success");
      } else {
        toast("Notification impossible : permission = " + permission, "warning");
      }
    });

    on("#refreshRequestsBtn", "click", () => {
      updateNotificationBell();
      renderAdmin();
      toast("Demandes actualisées.", "info");
    });

    on("#notifBellBtn", "click", () => {
      if (!currentUser || currentUser.role !== "admin") return;

      const panel = q("#adminPanel");
      if (panel) panel.classList.remove("hidden");

      qa(".admin-tab").forEach((b) => b.classList.toggle("active", b.dataset.adminTab === "requests"));
      qa(".admin-pane").forEach((p) => p.classList.toggle("active", p.id === "requestsPane"));

      renderAdmin();
    });

    on("#saveCatalogCfgBtn", "click", saveCatalogConfigFromUi);

    on("#reloadCatalogBtn", "click", () => {
      saveCatalogConfigFromUi();
      loadCatalogs(true);
    });

    on("#syncAutoBtn", "click", () => {
      saveCatalogConfigFromUi();
      loadAutoDiagnostic(true).then(() => {
        updateAdminStats();
        refreshSelectorsFromCatalog();
      });
    });

    on("#forceUpdateBtn", "click", () => {
      fetchJson(CONFIG.catalog.technicalUrl)
        .then((json) => {
          ingestNode(json, null, null, null, "mise à jour JSON", CONFIG.catalog.technicalUrl, 0);
          save(KEYS.LAST_UPDATE, Date.now());
          clearEngineCache();
          updateAdminStats();
          refreshSelectorsFromCatalog();
          toast("Mise à jour technique appliquée.", "success");
        })
        .catch(() => toast("Mise à jour impossible. Base locale conservée.", "warning"));
    });

    on("#exportDataBtn", "click", () => {
      const data = {
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

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aide-redactionnelle-expert-data-v20.json";
      a.click();
      toast("Données exportées.", "success");
    });

    on("#importDataBtn", "click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);

            if (data.users) saveUsers(data.users);
            if (data.requests) saveRequests(data.requests);

            const imported = loadWithMigration(KEYS.IMPORTED_RAW, OLD_KEYS.IMPORTED_RAW, []) || [];
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

    on("#apkBtn", "click", () => {
      if (location.protocol === "file:") {
        toast("Pour générer l’APK, publiez d’abord le site en HTTPS (GitHub Pages, Netlify, Vercel).", "warning");
        return;
      }
      window.open("https://www.pwabuilder.com/?url=" + encodeURIComponent(location.origin + location.pathname), "_blank");
    });

    on("#copyUrlBtn", "click", () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(() => toast("URL copiée.", "success")).catch(() => toast("Copie impossible.", "error"));
      } else {
        toast("Copie non supportée par ce navigateur.", "warning");
      }
    });

    on("#installBtn", "click", () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => { deferredPrompt = null; }).catch(() => {});
      } else {
        toast("Utilisez le menu du navigateur : Installer l’application.", "info");
      }
    });

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = q("#installBtn");
      if (btn) btn.classList.remove("hidden");
    });

    on("#generatePdfBtn", "click", () => {
      if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
        toast("Générez d’abord une analyse.", "warning");
        return;
      }

      generatePdfWithJsPdf().catch(() => {
        toast("Bibliothèque PDF indisponible. Impression/fallback HTML activé.", "warning");
        printReportFallback();
      });
    });

    on("#shareBtn", "click", () => {
      if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
        toast("Aucune analyse à partager.", "warning");
        return;
      }

      const text = analysisData.sections.map((pair) => pair[0] + "\n" + stripTags(pair[1])).join("\n\n");

      if (navigator.share) {
        navigator.share({ title: "Analyse Expert Auto", text }).catch(() => {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toast("Rapport copié.", "success")).catch(() => toast("Copie impossible.", "error"));
      } else {
        toast("Partage non supporté.", "warning");
      }
    });

    setInterval(enforceTierAccess, 15000);

    window.addEventListener("storage", (e) => {
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
      broadcast.onmessage = (event) => {
        try {
          const data = event.data || {};

          if (data.type === "access-request") onAccessRequestReceived(data.payload);

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

    window.addEventListener("arex:access-request", (event) => onAccessRequestReceived(event.detail));
  };

  /* =========================================================
     INIT
     ========================================================= */
  const init = () => {
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

    toast("Application prête. Filtres marques/modèles/motorisations renforcés.", "success");
  };

  const boot = () => {
    try {
      bindUi();
      init();
    } catch (e) {
      console.warn("[AR-EXPERT] Boot dégradé:", e);
      try {
        const status = q("#dataStatus");
        if (status) status.textContent = "Mode dégradé actif";
        const login = q("#loginScreen");
        if (login) login.style.display = "flex";
        const app = q("#mainApp");
        if (app) app.classList.add("hidden");
      } catch {}
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
