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
  const q = (sel) => { try { return document.querySelector(sel); } catch { return null; } };
  const qa = (sel) => { try { return Array.from(document.querySelectorAll(sel)); } catch { return []; } };
  const on = (sel, ev, fn) => { const el = q(sel); if (el) el.addEventListener(ev, fn); };

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
    } catch { return fallback; }
  };

  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const del = (key) => { try { localStorage.removeItem(key); } catch {} };

  const loadWithMigration = (newKey, oldKey, fallback) => {
    const current = load(newKey, null);
    if (current != null) return current;
    const old = load(oldKey, null);
    if (old != null) { save(newKey, old); return old; }
    return fallback;
  };

  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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

  // Logique améliorée pour gérer les chevauchements d'années et les transitions
  const yearMatches = (range, year) => {
    if (!year) return true;
    const s = String(range || "").trim();
    if (!s || s === "*" || norm(s).includes("tous")) return true;
    
    // Support format simple "2016-2020" ou "2016|2020" ou juste "2016"
    const parts = s.split(/[|\-–—]/).map(p => p.trim()).filter(Boolean);
    
    for (const part of parts) {
      const m = part.match(/(\d{4})/);
      if (!m) continue;
      
      // Si c'est une plage complète déjà extraite ailleurs, on ignore ce split naïf
      // Mais ici on suppose que range est souvent "2016-2020". 
      // Pour être sûr, on essaie de parser les bornes min/max globales si possible.
      // Simplification robuste : si le string contient "-", on extrait début et fin.
      if (part.includes("-") || part.includes("–")) {
         const bounds = part.split(/[-–—]/).map(b => parseInt(b, 10)).filter(n => !isNaN(n));
         if (bounds.length === 2) {
             if (year >= bounds[0] && year <= bounds[1]) return true;
         } else if (bounds.length === 1) {
             if (year === bounds[0]) return true;
         }
      } else {
          // Cas où part est juste une année ou un bloc complexe géré avant
           const val = parseInt(part, 10);
           if (!isNaN(val) && year === val) return true;
      }
    }
    
    // Reprise finale pour formats standards type "2016-2020" non splittés correctement ci-dessus
    const regex = /(\d{4})\D+(\d{4})/;
    const match = s.match(regex);
    if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (year >= start && year <= end) return true;
    }

    return false;
  };

  const brandMatches = (a, b) => {
    const na = normKey(a);
    const nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    
    // Alias étendus
    const aliases = {
      volkswagen: ["vw"], mercedesbenz: ["mercedes", "mb"], citroen: ["citroen"],
      landrover: ["land rover"], rangerover: ["range rover"], alfaromeo: ["alfa"],
      chevrolet: ["chevy"], bmw: ["bayerische motoren werke"], mini: ["mini cooper"],
      tesla: ["tesla motors"], byd: ["build your dreams"], mg: ["morris garages"],
      xpeng: ["x peng"], nio: ["next ev"], gwm: ["great wall motor"], ldv: ["maxus"],
      jac: ["jianghuai automobile"], dfsk: ["dongfeng small truck"],
      hyundai: ["hyundai motor"], kia: ["kia motors"], toyota: ["toyota motor corp"],
      honda: ["honda motor co"], ford: ["ford motor co"], gm: ["general motors"],
      fiat: ["fiat spa"], opel: ["adam opel ag"], psa: ["peugeot citroen"],
      stellantis: ["psa fca"], vag: ["volkswagen audi group"]
    };

    if (aliases[na] && aliases[na].includes(nb)) return true;
    if (aliases[nb] && aliases[nb].includes(na)) return true;

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
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") return simpleHash(text);
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch { return simpleHash(text); }
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

  const getBrandField = (o) => valToString(getField(o, ["b", "brand", "marque", "constructeur", "make"]));
  const getModelField = (o) => valToString(getField(o, ["m", "model", "modele", "modèle", "vehicle", "vehicule"]));
  const getEngineField = (o) => valToString(getField(o, ["e", "engine", "motorisation", "moteur", "powertrain", "version", "variant"]));
  const getPowerField = (o) => valToString(getField(o, ["p", "power", "puissance", "ch", "kw", "kwh"]));
  const getFuelField = (o) => valToString(getField(o, ["t", "type", "fuel", "energie", "énergie", "carburant", "engineType"]));
  const getTransField = (o) => valToString(getField(o, ["tr", "transmission", "boite", "boîte", "gearbox"]));
  const getYearsField = (o) => valToString(getField(o, ["y", "years", "annee", "année", "period", "range"]));
  const getSymptomsField = (o) => valToString(getField(o, ["s", "symptoms", "symptomes", "panne", "pannes", "defaut", "défaut", "probleme", "problème", "issue", "fault"]));
  const getDtcField = (o) => valToString(getField(o, ["dtc", "codeDtc", "code", "codes"]));
  const getDisplacementField = (o) => valToString(getField(o, ["d", "cyl", "cylindree", "cylindrée", "displacement", "engineSize", "cubic"]));
  const getCodeField = (o) => valToString(getField(o, ["code", "codeMoteur", "engineCode", "codemoteur"]));

  const fetchJson = async (url) => {
    const res = await fetch(url, { cache: "no-store", method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  };

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  const CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    pollAdminMs: 5000,
    syncIntervalDays: 30,
    catalog: {
      autoBaseUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/",
      vehiclesJsonUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/data/vehicles.json",
      motorisationsJsonUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/data/motorisations.json",
      defectsJsonUrl: "https://expertkevin06-cell.github.io/auto-diagnostic/data/defects.json"
    }
  };

  const KEYS = {
    SESSION: "arex_session_v26",
    USERS: "arex_users_v26",
    REQUESTS: "arex_requests_v26",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v26",
    TECH_UPDATES: "arex_tech_updates_v26",
    LAST_UPDATE: "arex_last_update_v26",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v26",
    CATALOG_CFG: "arex_catalog_cfg_v26",
    IMPORTED_RAW: "arex_imported_raw_v26"
  };

  const OLD_KEYS = {
    SESSION: "arex_session_v25",
    USERS: "arex_users_v25",
    REQUESTS: "arex_requests_v25",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v25",
    TECH_UPDATES: "arex_tech_updates_v25",
    LAST_UPDATE: "arex_last_update_v25",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v25",
    CATALOG_CFG: "arex_catalog_cfg_v25",
    IMPORTED_RAW: "arex_imported_raw_v25"
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
  let broadcast = null;
  let autoLastSync = 0;
  let modelLoadToken = 0;

  const selection = { brand: null, model: null, engine: null };
  
  // Index interne pour recherche rapide O(1)
  const index = {
    brands: {}, 
    models: {}, 
    engines: {} 
  };

  const catalog = {
    defects: []
  };

  try {
    if ("BroadcastChannel" in window) broadcast = new BroadcastChannel("arex_expert_channel");
  } catch { broadcast = null; }

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
      denied: "❌ Notifications bloquées",
      unsupported: "⚠️ Non supporté"
    };
    if (el) el.textContent = "État des notifications : " + (labels[state] || state);
  };

  const askNotification = async () => {
    if (!("Notification" in window)) { updateNotificationState(); return "unsupported"; }
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
    const options = { body: body || "", tag: tag || "arex-" + Date.now(), data: { url: "./index.html" } };
    const fallback = () => {
      if ("Notification" in window && Notification.permission === "granted") {
        try { const n = new Notification(title, options); n.onclick = () => window.focus(); } catch (e) { console.warn(e); }
      }
    };
    if (swRegistration && typeof swRegistration.showNotification === "function") {
      try { await swRegistration.showNotification(title, options); return; } catch { fallback(); return; }
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
    return raw.map(migrateUser);
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
    return raw.map(migrateRequest);
  };

  const saveRequests = (requests) => save(KEYS.REQUESTS, (requests || []).map(migrateRequest));

  const findApprovedUser = (name, email) => {
    const emailKey = userEmailKey(email);
    if (!emailKey) return null;
    const users = getUsers();
    return users.find(u => u.status === "approved" && u.role !== "admin" && (u.key === userCompositeKey(name, email) || u.emailNorm === emailKey)) || null;
  };

  const upsertUser = (user) => {
    const next = migrateUser(user);
    const users = getUsers();
    const idx = users.findIndex(u => u.key === next.key || (u.emailNorm === next.emailNorm && u.role !== "admin"));
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...next };
      saveUsers(users);
      return users[idx];
    }
    users.push(next);
    saveUsers(users);
    return next;
  };

  const setSession = (user) => { currentUser = migrateUser(user); save(KEYS.SESSION, currentUser); };
  const clearSession = () => { currentUser = null; del(KEYS.SESSION); };

  const restoreSession = () => {
    const session = loadWithMigration(KEYS.SESSION, OLD_KEYS.SESSION, null);
    if (!session) return false;
    if (session.role === "admin") { clearSession(); return false; }
    const fresh = findApprovedUser(session.name, session.email);
    if (fresh && fresh.status === "approved") { currentUser = fresh; setSession(fresh); return true; }
    clearSession();
    return false;
  };

  const dailyInfo = () => {
    if (!currentUser) return { allowed: false, remaining: 0, unlimited: false };
    if (currentUser.role === "admin") return { allowed: true, remaining: Infinity, unlimited: true };
    const user = findApprovedUser(currentUser.name, currentUser.email) || currentUser;
    const daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;
    return { allowed: daily < CONFIG.maxDailyAnalyses, remaining: Math.max(0, CONFIG.maxDailyAnalyses - daily), unlimited: false };
  };

  const incrementDaily = () => {
    if (!currentUser || currentUser.role === "admin") return;
    const users = getUsers();
    const idx = users.findIndex(u => u.key === currentUser.key || (u.emailNorm === currentUser.emailNorm && u.role !== "admin"));
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
    el.textContent = info.unlimited ? "👑 Admin — analyses illimitées" : `📊 ${info.remaining}/${CONFIG.maxDailyAnalyses} analyses restantes`;
  };

  const authMessage = (msg, type) => {
    const el = q("#authMsg");
    if (el) { el.textContent = msg; el.className = "auth-msg " + type; } else { toast(msg, type); }
  };

  const makeAccessGrantUrl = (user) => {
    const safe = migrateUser(user);
    const payload = { name: safe.name, email: safe.email, status: "approved", role: "user", key: safe.key, grantedAt: Date.now() };
    const baseUrl = location.href.split("?")[0].split("#")[0];
    return baseUrl + "?access_grant=" + utf8ToB64Url(JSON.stringify(payload));
  };

  const processIncomingAccessGrantFromUrl = () => {
    try {
      const raw = getQueryParam("access_grant");
      if (!raw) return false;
      const payload = JSON.parse(b64UrlToUtf8(raw));
      if (!payload || !payload.email) return false;
      const user = upsertUser({
        name: payload.name || payload.email, email: payload.email, role: "user", status: "approved", key: payload.key, daily: { date: todayKey(), count: 0 }
      });
      setSession(user);
      showApp();
      toast("Accès approuvé importé.", "success");
      cleanUrlAfterParam();
      return true;
    } catch {
      toast("Lien d’accès invalide.", "error");
      return false;
    }
  };

  const pendingRequests = () => getRequests().filter(r => r.status === "pending");
  const pendingSignature = () => pendingRequests().map(r => r.id).sort().join("|");

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
    if (badge) { badge.textContent = String(count); badge.classList.toggle("hidden", count === 0); }
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
    if (sig === lastPendingSignature) { updateNotificationBell(); return; }
    const oldIds = lastPendingSignature ? lastPendingSignature.split("|") : [];
    const newIds = sig ? sig.split("|").filter(id => id && !oldIds.includes(id)) : [];
    lastPendingSignature = sig;
    updateNotificationBell();
    if (newIds.length) {
      const all = getRequests();
      newIds.forEach(id => { const req = all.find(r => r.id === id); if (req) onAccessRequestReceived(req); });
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

  const stopAdminPolling = () => { if (adminPollTimer) { clearInterval(adminPollTimer); adminPollTimer = null; } };

  const publishAccessRequest = (req) => {
    if (!req) return;
    if (broadcast) { try { broadcast.postMessage({ type: "access-request", payload: req }); } catch {} }
    try { window.dispatchEvent(new CustomEvent("arex:access-request", { detail: req })); } catch {}
    updateNotificationBell();
  };

  const enforceTierAccess = () => {
    if (!currentUser || currentUser.role === "admin") return;
    const fresh = findApprovedUser(currentUser.name, currentUser.email);
    if (!fresh || fresh.status !== "approved") {
      clearSession();
      showLogin();
      toast("Votre accès a été révoqué ou refusé.", "error");
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
    if (login) { login.classList.add("hidden"); login.style.display = "none"; }
    const app = q("#mainApp");
    if (app) { app.classList.remove("hidden"); app.style.display = "block"; }
    const badge = q("#userBadge");
    if (badge) badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;
    const adminBtn = q("#adminPanelBtn");
    if (adminBtn) adminBtn.classList.toggle("hidden", currentUser.role !== "admin");
    updateCounter();
    updateNotificationBell();
    updateNotificationState();
    updateSelectionSummary();
    if (currentUser && currentUser.role === "admin") { startAdminPolling(); askNotification(); } else { stopAdminPolling(); }
    window.scrollTo(0, 0);
  };

  const showLogin = () => {
    const login = q("#loginScreen");
    if (login) { login.classList.remove("hidden"); login.style.display = "flex"; }
    const app = q("#mainApp");
    if (app) { app.classList.add("hidden"); app.style.display = "none"; }
    const admin = q("#adminPanel");
    if (admin) admin.classList.add("hidden");
    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  };

  /* =========================================================
     BASE DE DONNÉES MASSIVE HISTORIQUE (OFFLINE FIRST)
     Inclut Générations Passées (2014-2019) et Actuelles (2020-2026)
     Format: [Marque, Modèle, Années, MoteurLabel, Puissance, Energie, Boite, Code/Cyl/KWh]
     ========================================================= */
  const EMBEDDED_MASTER_DB = [
    // --- PEUGEOT (CORRECTION CRITIQUE 3008 I & II) ---
    ["Peugeot", "3008 I", "2016-2020", "1.2 PureTech 130", "130ch", "Essence", "EAT6", "EB2|1.2 L"],
    ["Peugeot", "3008 I", "2016-2020", "1.6 PureTech 180", "180ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "3008 I", "2016-2020", "1.6 PureTech 225", "225ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "3008 I", "2016-2020", "1.5 BlueHDi 120", "120ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "3008 I", "2016-2020", "2.0 BlueHDi 150", "150ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "3008 I", "2016-2020", "2.0 BlueHDi 180", "180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "3008 II", "2020-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "3008 II", "2020-2026", "1.5 BlueHDi 130", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "3008 II", "2020-2026", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "3008 II", "2020-2026", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 225", "225ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 320 4x4", "320ch", "Hybride rechargeable", "automatique 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "e-3008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Peugeot", "5008 I", "2017-2020", "1.2 PureTech 130", "130ch", "Essence", "EAT6", "EB2|1.2 L"],
    ["Peugeot", "5008 I", "2017-2020", "1.6 PureTech 180", "180ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "5008 I", "2017-2020", "1.6 PureTech 225", "225ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "5008 I", "2017-2020", "1.5 BlueHDi 120", "120ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "5008 I", "2017-2020", "2.0 BlueHDi 150", "150ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "5008 I", "2017-2020", "2.0 BlueHDi 180", "180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "5008 II", "2020-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "5008 II", "2020-2026", "1.5 BlueHDi 130", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "5008 II", "2020-2026", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "5008 II", "2020-2026", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 225", "225ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 320 4x4", "320ch", "Hybride rechargeable", "automatique 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "e-5008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Peugeot", "208 I", "2012-2019", "1.2 VTi", "82ch", "Essence", "BVM5", "EB2|1.2 L"],
    ["Peugeot", "208 I", "2012-2019", "1.2 PureTech", "110ch|130ch", "Essence", "BVM5|ETG6", "EB2|1.2 L"],
    ["Peugeot", "208 I", "2012-2019", "1.6 e-HDi", "92ch", "Diesel", "ETG6", "DV6|1.6 L"],
    ["Peugeot", "208 I", "2012-2019", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5", "DV6|1.6 L"],
    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 75", "75ch", "Essence", "BVM5", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 100", "100ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.5 BlueHDi 100", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Peugeot", "208 II", "2019-2026", "e-208", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],

    ["Peugeot", "2008 I", "2013-2019", "1.2 PureTech", "82ch|110ch|130ch", "Essence", "BVM5|ETG6", "EB2|1.2 L"],
    ["Peugeot", "2008 I", "2013-2019", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5|ETG6", "DV6|1.6 L"],
    ["Peugeot", "2008 II", "2019-2026", "1.2 PureTech 100", "100ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "2008 II", "2019-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "2008 II", "2019-2026", "1.5 BlueHDi 100|130", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "2008 II", "2019-2026", "e-2008", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],

    ["Peugeot", "308 I", "2013-2021", "1.2 PureTech", "110ch|130ch", "Essence", "BVM5|ETG6|EAT6", "EB2|1.2 L"],
    ["Peugeot", "308 I", "2013-2021", "1.6 THP", "125ch|150ch|200ch", "Essence", "BVM6|EAT6", "EP6|1.6 L"],
    ["Peugeot", "308 I", "2013-2021", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5|ETG6", "DV6|1.6 L"],
    ["Peugeot", "308 I", "2013-2021", "2.0 HDi", "150ch", "Diesel", "BVM6|EAT6", "DW10|2.0 L"],
    ["Peugeot", "308 II", "2021-2026", "1.2 PureTech 110", "110ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "308 II", "2021-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "308 II", "2021-2026", "1.5 BlueHDi 130", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "308 II", "2021-2026", "Hybrid 180", "180ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308 II", "2021-2026", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308 II", "2021-2026", "e-308", "115kW|150kW", "Électrique", "réducteur", "eCMP|54 kWh"],

    // --- CITROEN (HISTORIQUE) ---
    ["Citroen", "C3 II", "2016-2026", "1.2 PureTech", "82ch|110ch|130ch", "Essence", "BVM5|BVM6|EAT6", "EB2|1.2 L"],
    ["Citroen", "C3 II", "2016-2026", "1.5 BlueHDi", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Citroen", "C3 III", "2024-2026", "ë-C3", "94ch|118ch", "Électrique", "réducteur", "eCMP|44 kWh"],
    ["Citroen", "C4 Picasso", "2013-2018", "1.6 THP", "150ch|165ch", "Essence", "ETG6", "EP6|1.6 L"],
    ["Citroen", "C4 Picasso", "2013-2018", "1.6 HDi", "115ch", "Diesel", "ETG6", "DV6|1.6 L"],
    ["Citroen", "C4 SpaceTourer", "2018-2024", "1.2 PureTech", "110ch|130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Citroen", "C4 SpaceTourer", "2018-2024", "1.5 BlueHDi", "100ch|130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Citroen", "Berlingo II", "2018-2026", "1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Citroen", "Berlingo II", "2018-2026", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Citroen", "Berlingo II", "2018-2026", "ë-Berlingo", "100kW|136ch", "Électrique", "réducteur", "eCMP|50 kWh"],

    // --- RENAULT (HISTORIQUE CLIO IV/V) ---
    ["Renault", "Clio IV", "2012-2019", "1.2 16V", "75ch", "Essence", "BVM5", "D4F|1.2 L"],
    ["Renault", "Clio IV", "2012-2019", "0.9 TCe", "90ch", "Essence", "BVM5|EDC", "H4B|0.9 L"],
    ["Renault", "Clio IV", "2012-2019", "1.5 dCi", "75ch|90ch|110ch", "Diesel", "BVM5|EDC", "K9K|1.5 L"],
    ["Renault", "Clio V", "2019-2026", "1.0 TCe", "65ch|90ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Renault", "Clio V", "2019-2026", "1.3 TCe", "100ch|130ch|140ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Clio V", "2019-2026", "1.5 dCi", "75ch|100ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Clio V", "2019-2026", "E-Tech Hybrid", "140ch|145ch", "Hybride", "automatique", "TCe 140|1.6 L"],
    ["Renault", "Captur I", "2013-2019", "1.2 TCe", "120ch", "Essence", "EDC", "H5F|1.2 L"],
    ["Renault", "Captur I", "2013-2019", "1.5 dCi", "90ch|110ch", "Diesel", "EDC|BVM6", "K9K|1.5 L"],
    ["Renault", "Captur II", "2020-2026", "1.0 TCe", "90ch|100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Renault", "Captur II", "2020-2026", "1.3 TCe", "130ch|155ch", "Essence", "EDC", "H5H|1.3 L"],
    ["Renault", "Captur II", "2020-2026", "1.5 Blue dCi", "100ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Captur II", "2020-2026", "E-Tech Hybrid", "140ch|160ch", "Hybride", "automatique", "TCe 160|1.6 L"],
    ["Renault", "Megane III", "2010-2016", "1.5 dCi", "90ch|110ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Megane III", "2010-2016", "1.2 TCe", "130ch", "Essence", "EDC", "H5F|1.2 L"],
    ["Renault", "Megane IV", "2016-2024", "1.3 TCe", "100ch|140ch|160ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Megane IV", "2016-2024", "1.5 dCi", "90ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Megane IV", "2020-2024", "E-Tech Hybrid", "160ch|205ch", "Hybride", "automatique", "TCe 200|1.6 L"],

    // --- VOLKSWAGEN (HISTORIQUE GOLF VI/VII/VIII) ---
    ["Volkswagen", "Golf VI", "2008-2012", "1.4 TSI", "122ch|160ch", "Essence", "DSG|BVM6", "EA111|1.4 L"],
    ["Volkswagen", "Golf VI", "2008-2012", "2.0 TDI", "140ch|170ch", "Diesel", "DSG|BVM6", "EA189|2.0 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "1.0 TSI", "85ch|110ch|125ch", "Essence", "BVM6|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "1.4 TSI", "125ch|150ch", "Essence", "DSG", "EA211|1.4 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "1.5 TSI", "130ch|150ch|180ch", "Essence", "DSG|BVM6", "EA211 evo|1.5 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "2.0 TSI", "230ch|310ch", "Essence", "DSG", "EA888|2.0 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "1.6 TDI", "90ch|110ch|115ch", "Diesel", "BVM5|DSG", "EA288|1.6 L"],
    ["Volkswagen", "Golf VII", "2012-2020", "2.0 TDI", "110ch|150ch|184ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Golf VII", "2014-2020", "GTE", "204ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],
    ["Volkswagen", "Golf VIII", "2020-2026", "1.0 eTSI", "110ch", "Hybride léger 48V", "DSG", "EA211 evo|1.0 L"],
    ["Volkswagen", "Golf VIII", "2020-2026", "1.5 eTSI", "130ch|150ch", "Hybride léger 48V", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Golf VIII", "2020-2026", "2.0 TSI", "245ch|320ch", "Essence", "DSG", "EA888|2.0 L"],
    ["Volkswagen", "Golf VIII", "2020-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Golf VIII", "2020-2026", "eHybrid", "204ch|245ch", "Hybride rechargeable", "DSG", "PHEV|1.5 L"],
    ["Volkswagen", "Polo V", "2009-2017", "1.2 TSI", "90ch|105ch", "Essence", "DSG|BVM5", "EA111|1.2 L"],
    ["Volkswagen", "Polo V", "2009-2017", "1.6 TDI", "90ch|105ch", "Diesel", "BVM5|DSG", "EA189|1.6 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.0 MPI", "65ch|75ch", "Essence", "BVM5", "EA211|1.0 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM5|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.6 TDI", "80ch", "Diesel", "BVM5", "EA288|1.6 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "2.0 TDI", "95ch|115ch|150ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Tiguan I", "2007-2016", "2.0 TDI", "140ch|177ch", "Diesel", "DSG|BVM6", "EA189|2.0 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "2.0 TSI", "190ch|245ch|320ch", "Essence", "DSG 4Motion", "EA888|2.0 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "2.0 TDI", "150ch|190ch|200ch", "Diesel", "DSG|4Motion", "EA288|2.0 L"],
    ["Volkswagen", "Tiguan II", "2019-2026", "eHybrid", "245ch|300ch", "Hybride rechargeable", "DSG 4Motion", "PHEV|1.4 L|2.0 L"],

    // --- AUDI (HISTORIQUE A3/A4/Q3) ---
    ["Audi", "A3 II", "2012-2020", "1.4 TFSI", "125ch|150ch", "Essence", "S tronic", "EA211|1.4 L"],
    ["Audi", "A3 II", "2012-2020", "2.0 TFSI", "190ch|230ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "A3 II", "2012-2020", "2.0 TDI", "150ch|184ch", "Diesel", "S tronic|quattro", "EA288|2.0 L"],
    ["Audi", "A3 III", "2020-2026", "30 TFSI", "110ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "A3 III", "2020-2026", "35 TFSI", "150ch", "Essence", "S tronic", "EA211 evo|1.5 L"],
    ["Audi", "A3 III", "2020-2026", "40 TFSI", "204ch", "Essence", "S tronic", "EA888|2.0 L"],
    ["Audi", "A3 III", "2020-2026", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "A3 III", "2020-2026", "40 TDI", "204ch", "Diesel", "S tronic quattro", "EA288|2.0 L"],
    ["Audi", "A3 III", "2020-2026", "Sportback 45 TFSI e", "245ch|310ch", "Hybride rechargeable", "S tronic", "PHEV|1.4 L"],
    ["Audi", "Q3 I", "2011-2018", "2.0 TDI", "140ch|177ch", "Diesel", "S tronic|quattro", "EA288|2.0 L"],
    ["Audi", "Q3 II", "2018-2026", "30 TFSI", "110ch|150ch", "Essence", "S tronic", "EA211|1.0 L|1.5 L"],
    ["Audi", "Q3 II", "2018-2026", "40 TFSI", "190ch|204ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "Q3 II", "2018-2026", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "Q3 II", "2018-2026", "40 TDI", "190ch", "Diesel", "S tronic quattro", "EA288|2.0 L"],
    ["Audi", "Q3 II", "2019-2026", "45 TFSI e", "245ch", "Hybride rechargeable", "S tronic quattro", "PHEV|1.4 L"],

    // --- BMW (HISTORIQUE SERIE 1/3/X1/X3) ---
    ["BMW", "Serie 1 F20/F21", "2011-2019", "116i", "136ch", "Essence", "BVM6|Steptronic", "N13|1.6 L"],
    ["BMW", "Serie 1 F20/F21", "2011-2019", "118i", "170ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1 F20/F21", "2011-2019", "116d", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["BMW", "Serie 1 F20/F21", "2011-2019", "118d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "116i", "109ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "118i", "136ch|156ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "120i", "170ch|218ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "125i", "245ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "116d", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "118d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "Serie 1 F40/F48", "2019-2026", "120d", "163ch|190ch", "Diesel", "Steptronic|xDrive", "B47|2.0 L"],
    ["BMW", "X1 F48/E84", "2015-2022", "sDrive18i", "136ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "X1 F48/E84", "2015-2022", "sDrive18d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "X1 U11/U12", "2022-2026", "sDrive18i", "136ch|170ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "X1 U11/U12", "2022-2026", "sDrive18d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "X1 U11/U12", "2022-2026", "xDrive25e", "245ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|1.5 L"],

    // --- MERCEDES BENZ (HISTORIQUE CLA/CLASSE A/GLA) ---
    ["Mercedes-Benz", "Classe A W176", "2012-2018", "A180", "122ch", "Essence", "7G-DCT", "M270|1.6 L"],
    ["Mercedes-Benz", "Classe A W176", "2012-2018", "A200", "156ch|184ch", "Essence", "7G-DCT", "M270|2.0 L"],
    ["Mercedes-Benz", "Classe A W176", "2012-2018", "A180 CDI", "109ch", "Diesel", "7G-DCT", "OM651|1.5 L"],
    ["Mercedes-Benz", "Classe A W176", "2012-2018", "A200 CDI", "136ch", "Diesel", "7G-DCT", "OM651|2.1 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "A180", "120ch|136ch", "Essence", "7G-DCT", "M282|1.3 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "A200", "163ch|190ch", "Essence", "7G-DCT|8G-DCT", "M282/M260|1.3 L|2.0 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "A250", "224ch", "Essence", "8G-DCT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "AMG A35", "306ch", "Essence", "AMG SPEEDSHIFT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "A180d", "116ch", "Diesel", "7G-DCT", "OM654|1.5 L|2.0 L"],
    ["Mercedes-Benz", "Classe A W177", "2018-2026", "A200d", "150ch", "Diesel", "8G-DCT", "OM654|2.0 L"],
    ["Mercedes-Benz", "Classe A W177", "2020-2026", "A250e", "218ch", "Hybride rechargeable", "8G-DCT", "PHEV|1.3 L"],
    ["Mercedes-Benz", "GLA X156", "2014-2020", "GLA 200", "156ch|184ch", "Essence", "7G-DCT", "M270|2.0 L"],
    ["Mercedes-Benz", "GLA X156", "2014-2020", "GLA 220 CDI", "170ch", "Diesel", "7G-DCT", "OM651|2.1 L"],
    ["Mercedes-Benz", "GLA H247", "2020-2026", "GLA180", "120ch|136ch", "Essence", "7G-DCT", "M282|1.3 L"],
    ["Mercedes-Benz", "GLA H247", "2020-2026", "GLA200", "163ch|190ch", "Essence", "7G-DCT|8G-DCT", "M282/M260|1.3 L|2.0 L"],
    ["Mercedes-Benz", "GLA H247", "2020-2026", "GLA250", "224ch", "Essence", "8G-DCT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "GLA H247", "2020-2026", "GLA200d", "150ch", "Diesel", "8G-DCT", "OM654|2.0 L"],
    ["Mercedes-Benz", "GLA H247", "2020-2026", "GLA250e", "218ch", "Hybride rechargeable", "8G-DCT", "PHEV|1.3 L"],

    // --- TOYOTA (HYBRIDE LEGACY) ---
    ["Toyota", "Yaris I", "2011-2020", "1.0 VVT-i", "69ch", "Essence", "BVM5", "1KR-FE|1.0 L"],
    ["Toyota", "Yaris I", "2011-2020", "1.33 VVT-i", "101ch", "Essence", "Multidrive S", "2NR-FE|1.3 L"],
    ["Toyota", "Yaris I", "2011-2020", "1.5 D-4D", "100ch", "Diesel", "BVM5", "ND|1.5 L"],
    ["Toyota", "Yaris II", "2020-2026", "1.0", "72ch", "Essence", "BVM5", "1KR-FE|1.0 L"],
    ["Toyota", "Yaris II", "2020-2026", "1.5 Hybrid", "116ch|130ch", "Hybride", "e-CVT", "THS II|1.5 L"],
    ["Toyota", "Yaris II", "2020-2026", "GR Yaris", "261ch|280ch", "Essence", "BVM6 4x4", "G16E-GTS|1.6 L"],
    ["Toyota", "Corolla XI", "2018-2026", "1.8 Hybrid", "122ch|140ch", "Hybride", "e-CVT", "THS II|1.8 L"],
    ["Toyota", "Corolla XI", "2018-2026", "2.0 Hybrid", "184ch|196ch", "Hybride", "e-CVT", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla XI", "2018-2026", "2.0", "169ch|197ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla XI", "2018-2026", "1.8 Plug-in Hybrid", "196ch", "Hybride rechargeable", "e-CVT", "PHEV|1.8 L"],
    ["Toyota", "RAV4 IV", "2018-2026", "2.0", "171ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "RAV4 IV", "2018-2026", "2.5 Hybrid", "218ch|222ch", "Hybride", "e-CVT AWD-i", "THS II|2.5 L"],
    ["Toyota", "RAV4 IV", "2020-2026", "2.5 Plug-in Hybrid", "306ch|320ch", "Hybride rechargeable", "e-CVT AWD-i", "PHEV|2.5 L"],
    ["Toyota", "RAV4 IV", "2018-2026", "2.5 D-4D", "150ch|200ch", "Diesel", "BVM6|Direct Shift 4x4", "GD|2.5 L"],

    // --- AUTRES MARQUES MAJEURES (Résumé pour performance) ---
    ["Dacia", "Sandero II", "2012-2020", "1.0 SCe", "73ch", "Essence", "BVM5", "SCe|1.0 L"],
    ["Dacia", "Sandero II", "2012-2020", "1.5 dCi", "90ch", "Diesel", "BVM5", "K9K|1.5 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.0 SCe", "65ch|75ch", "Essence", "BVM5", "SCe|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.0 TCe", "90ch|100ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.0 ECO-G 100", "100ch", "GPL", "BVM6", "ECO-G|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.5 Blue dCi", "100ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Dacia", "Duster II", "2018-2024", "1.0 TCe", "90ch|100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Dacia", "Duster II", "2018-2024", "1.5 Blue dCi", "100ch|115ch", "Diesel", "BVM6|4x4", "K9K|1.5 L"],
    ["Dacia", "Duster III", "2024-2026", "1.0 TCe", "100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Dacia", "Duster III", "2024-2026", "1.2 TCe", "130ch|140ch", "Essence", "BVM6|EDC", "H5F|1.2 L"],
    ["Dacia", "Duster III", "2024-2026", "1.5 Blue dCi", "100ch|115ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Dacia", "Duster III", "2024-2026", "Hybrid 140", "140ch", "Hybride", "automatique", "TCe 140|1.0 L"],

    ["Tesla", "Model 3", "2017-2026", "Standard Range Plus", "283ch", "Électrique", "RWD / réducteur", "BEV|57.5 kWh|60 kWh"],
    ["Tesla", "Model 3", "2017-2026", "Long Range", "351ch|442ch", "Électrique", "RWD/AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model 3", "2017-2026", "Performance", "513ch|534ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model Y", "2020-2026", "Standard Range", "299ch", "Électrique", "RWD / réducteur", "BEV|60 kWh|62.5 kWh"],
    ["Tesla", "Model Y", "2020-2026", "Long Range", "442ch|534ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model Y", "2020-2026", "Performance", "534ch|615ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model S", "2012-2026", "Long Range", "670ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model S", "2012-2026", "Plaid", "1020ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model X", "2015-2026", "Long Range", "670ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model X", "2015-2026", "Plaid", "1020ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],

    ["Skoda", "Octavia III", "2012-2020", "1.4 TSI", "125ch|150ch", "Essence", "DSG|BVM6", "EA211|1.4 L"],
    ["Skoda", "Octavia III", "2012-2020", "1.6 TDI", "110ch|115ch", "Diesel", "DSG|BVM5", "EA288|1.6 L"],
    ["Skoda", "Octavia III", "2012-2020", "2.0 TDI", "150ch|184ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Octavia IV", "2020-2026", "1.5 TSI", "110ch|150ch", "Essence", "BVM6|DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Octavia IV", "2020-2026", "2.0 TSI", "190ch|265ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Octavia IV", "2020-2026", "2.0 TDI", "115ch|150ch|200ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Octavia IV", "2020-2026", "iV", "204ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 50", "55 kWh|125kW|170ch", "Électrique", "RWD / réducteur", "MEB|55 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 60", "63 kWh|150kW|204ch", "Électrique", "RWD / réducteur", "MEB|63 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 85", "77 kWh|210kW|286ch", "Électrique", "RWD / réducteur", "MEB|77 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 85x", "77 kWh|210kW|286ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],

    ["Ford", "Focus III", "2011-2018", "1.0 EcoBoost", "100ch|125ch", "Essence", "BVM5|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Focus III", "2011-2018", "1.5 TDCi", "95ch|120ch", "Diesel", "BVM5|BVM6", "TDCi|1.5 L"],
    ["Ford", "Focus IV", "2018-2025", "1.0 EcoBoost", "100ch|125ch|155ch", "Essence", "BVM6|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Focus IV", "2018-2025", "1.5 EcoBoost", "150ch|182ch", "Essence", "BVM6|PowerShift", "EcoBoost|1.5 L"],
    ["Ford", "Focus IV", "2018-2025", "2.3 EcoBoost ST", "280ch", "Essence", "BVM6", "EcoBoost|2.3 L"],
    ["Ford", "Focus IV", "2018-2025", "1.5 EcoBlue", "95ch|120ch", "Diesel", "BVM6", "EcoBlue|1.5 L"],
    ["Ford", "Focus IV", "2018-2025", "2.0 EcoBlue", "150ch|190ch", "Diesel", "BVM6|Auto", "EcoBlue|2.0 L"],
    ["Ford", "Kuga II", "2019-2026", "1.5 EcoBoost", "120ch|150ch", "Essence", "BVM6|Auto", "EcoBoost|1.5 L"],
    ["Ford", "Kuga II", "2019-2026", "2.5 Plug-in Hybrid", "225ch", "Hybride rechargeable", "automatique", "PHEV|2.5 L"],
    ["Ford", "Kuga II", "2019-2026", "2.5 Full Hybrid", "190ch", "Hybride", "automatique", "HEV|2.5 L"],
    ["Ford", "Kuga II", "2019-2026", "2.0 EcoBlue", "120ch|150ch|190ch", "Diesel", "BVM6|Auto 4x4", "EcoBlue|2.0 L"],

    ["Opel", "Corsa E", "2014-2019", "1.4 Turbo", "100ch|120ch|150ch", "Essence", "BVM5|BVM6", "LC4|1.4 L"],
    ["Opel", "Corsa E", "2014-2019", "1.6 CDTI", "95ch|120ch", "Diesel", "BVM6", "LT|1.6 L"],
    ["Opel", "Corsa F", "2019-2026", "1.2", "75ch|100ch|130ch", "Essence", "BVM5|BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Corsa F", "2019-2026", "1.2 Turbo", "100ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Corsa F", "2019-2026", "1.5 Diesel", "100ch|130ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Opel", "Corsa F", "2019-2026", "Corsa Electric", "136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Opel", "Astra J", "2009-2015", "1.4 Turbo", "140ch|150ch", "Essence", "BVM6|Easytronic", "LC4|1.4 L"],
    ["Opel", "Astra J", "2009-2015", "1.6 CDTI", "95ch|110ch|136ch", "Diesel", "BVM6", "LT|1.6 L"],
    ["Opel", "Astra K", "2015-2021", "1.4 Turbo", "125ch|150ch", "Essence", "BVM6|Auto", "LYA|1.4 L"],
    ["Opel", "Astra K", "2015-2021", "1.6 CDTI", "95ch|110ch|136ch", "Diesel", "BVM6|Auto", "LT|1.6 L"],
    ["Opel", "Astra L", "2021-2026", "1.2 Turbo", "110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Astra L", "2021-2026", "1.2 Turbo Hybrid", "130ch", "Hybride léger 48V", "EAT8", "EB2|1.2 L"],
    ["Opel", "Astra L", "2021-2026", "1.5 Diesel", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Opel", "Astra L", "2021-2026", "Hybrid", "180ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Opel", "Astra L", "2021-2026", "Hybrid4", "225ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],

    ["Seat", "Leon III", "2012-2020", "1.2 TSI", "110ch", "Essence", "DSG|BVM6", "EA211|1.2 L"],
    ["Seat", "Leon III", "2012-2020", "1.4 TSI", "125ch|150ch", "Essence", "DSG", "EA211|1.4 L"],
    ["Seat", "Leon III", "2012-2020", "2.0 TDI", "150ch|184ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "1.0 TSI", "110ch", "Essence", "DSG", "EA211|1.0 L"],
    ["Seat", "Leon IV", "2020-2026", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Leon IV", "2020-2026", "2.0 TSI", "190ch|310ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG", "EA288|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "e-HYBRID", "204ch|245ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],

    ["Hyundai", "Tucson III", "2015-2021", "1.6 TGDI", "132ch|177ch", "Essence", "BVM6|DCT", "Gamma|1.6 L"],
    ["Hyundai", "Tucson III", "2015-2021", "1.6 CRDi", "115ch|136ch", "Diesel", "BVM6|DCT", "U2|1.6 L"],
    ["Hyundai", "Tucson IV", "2021-2026", "1.6 TGDI", "150ch|177ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson IV", "2021-2026", "1.6 TGDI 48V", "150ch|177ch", "Hybride léger 48V", "DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson IV", "2021-2026", "1.6 CRDi 48V", "115ch|136ch", "Diesel", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson IV", "2021-2026", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Hyundai", "Tucson IV", "2021-2026", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],

    ["Kia", "Sportage III", "2015-2021", "1.6 TGDI", "132ch|177ch", "Essence", "BVM6|DCT", "Gamma|1.6 L"],
    ["Kia", "Sportage III", "2015-2021", "1.6 CRDi", "115ch|136ch", "Diesel", "BVM6|DCT", "U2|1.6 L"],
    ["Kia", "Sportage IV", "2021-2026", "1.6 TGDI", "150ch|180ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Kia", "Sportage IV", "2021-2026", "1.6 CRDi", "136ch", "Diesel", "BVM6|DCT 4x4", "Smartstream|1.6 L"],
    ["Kia", "Sportage IV", "2021-2026", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Kia", "Sportage IV", "2021-2026", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique 4x4", "PHEV|1.6 L"]
  ];

  const DEFECTS_KNOWN = [
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
      b: "Tesla", m: "Model 3|Model Y|Model S|Model X", y: "2017-2027",
      e: "Électrique", p: "283ch-1020ch",
      s: "Autopilot|FSD|phantom braking|12V battery|charging port|door handle|software|battery degradation|thermal|range|ADAS|camera|radar",
      sev: "critique", wf: 0.92,
      n: "ADAS, batterie 12V, port de charge, dégradation batterie, logiciels, poignées, gestion thermique.",
      law: "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245; pénal si accident.",
      rec: "NHTSA Tesla recalls; DGCCRF; SafetyGate",
      tg: "ADAS|batterie|charge|logiciel|securite", et: "Électrique"
    }
  ];

  /* =========================================================
     INITIALISATION ET INDEXATION OFFLINE-FIRST
     ========================================================= */
  const initIndexOfflineFirst = () => {
    index.brands = {};
    index.models = {};
    index.engines = {};
    catalog.defects = [];

    // 1. Charger les défauts connus locaux
    DEFECTS_KNOWN.forEach(d => {
      catalog.defects.push({ ...d, source: "base massive locale" });
    });

    // 2. Indexer la base massive embarquée (Instantané)
    EMBEDDED_MASTER_DB.forEach(row => {
      const [b, m, y, e, p, t, tr, codeOrDisp] = row;
      
      const bk = normKey(b);
      const mk = normKey(m);
      const ek = normKey(e);
      
      if (!index.brands[bk]) {
        index.brands[bk] = { name: b, models: [] };
      }

      const modelKey = `${bk}|${mk}`;
      
      if (!index.models[modelKey]) {
        index.models[modelKey] = {
          brand: b,
          name: m,
          years: y,
          engines: []
        };
        index.brands[bk].models.push(index.models[modelKey]);
      }

      const engineObj = {
        brand: b,
        model: m,
        years: y,
        engine: e,
        displacement: codeOrDisp.includes("L") || codeOrDisp.includes("cm3") ? codeOrDisp : "",
        power: p,
        fuel: t,
        transmission: tr,
        code: codeOrDisp,
        source: "secours local massif historique",
        confidence: 0.95
      };

      index.models[modelKey].engines.push(engineObj);
      const fullEngineKey = `${modelKey}|${ek}`;
      index.engines[fullEngineKey] = engineObj;
    });
  };

  const addModelToIndex = (b, m, y) => {
    const bk = normKey(b);
    const mk = normKey(m);
    if (!index.brands[bk]) index.brands[bk] = { name: b, models: [] };
    
    const modelKey = `${bk}|${mk}`;
    if (!index.models[modelKey]) {
      index.models[modelKey] = { brand: b, name: m, years: y, engines: [] };
      index.brands[bk].models.push(index.models[modelKey]);
    }
  };

  const addEngineToIndex = (b, m, y, e, p, t, tr, code) => {
    const bk = normKey(b);
    const mk = normKey(m);
    const ek = normKey(e);
    const modelKey = `${bk}|${mk}`;
    
    if (!index.models[modelKey]) return; // Sécurité
    
    // Éviter doublons exacts
    const exists = index.models[modelKey].engines.some(ex => ex.engine === e && ex.power === p);
    if (exists) return;

    const engineObj = {
      brand: b, model: m, years: y, engine: e, power: p, fuel: t, transmission: tr, code: code,
      displacement: code?.includes("L") ? code : "",
      source: "auto-diagnostic distant",
      confidence: 0.98
    };
    
    index.models[modelKey].engines.push(engineObj);
    index.engines[`${modelKey}|${ek}`] = engineObj;
  };

  /* =========================================================
     SYNCHRONISATION PASSIVE (EN ARRIÈRE-PLAN)
     ========================================================= */
  const syncRemoteCatalogPassive = async () => {
    const lastSync = loadWithMigration(KEYS.AUTO_LAST_SYNC, OLD_KEYS.AUTO_LAST_SYNC, 0);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    if (lastSync && (now - lastSync) < thirtyDaysMs) {
      console.log("[AR-EXPERT] Synchro distante inutile (<30 jours). Utilisation du cache/local.");
      updateDataStatus(`Base locale massive active • Dernière synchro : ${new Date(lastSync).toLocaleDateString()}`);
      return;
    }

    updateDataStatus("Tentative de synchronisation distante...");
    
    try {
      const vehiclesRes = await fetchJson(CONFIG.catalog.vehiclesJsonUrl);
      const motorsRes = await fetchJson(CONFIG.catalog.motorisationsJsonUrl);
      
      mergeRemoteData(vehiclesRes, motorsRes);
      
      autoLastSync = Date.now();
      save(KEYS.AUTO_LAST_SYNC, autoLastSync);
      updateDataStatus(`Auto-Diagnostic synchronisé (${new Date().toLocaleTimeString()})`);
      toast("Données Auto-Diagnostic mises à jour en arrière-plan.", "success");
      
      if (selection.brand) {
        loadModelsForBrand(selection.brand.name, false);
      }
      
    } catch (err) {
      console.warn("Échec synchro distante silencieux :", err);
      updateDataStatus("Mode Secours Local Actif (Pas de connexion GitHub récente)");
      save(KEYS.AUTO_LAST_SYNC, Date.now()); 
    }
  };

  const mergeRemoteData = (vehicles, motors) => {
    initIndexOfflineFirst(); 
    
    if (Array.isArray(vehicles)) {
      vehicles.forEach(v => {
        const b = v.b || v.marque || v.brand;
        const m = v.m || v.modele || v.model;
        const y = v.y || v.annee || v.years;
        if (b && m) addModelToIndex(b, m, y);
      });
    }

    if (Array.isArray(motors)) {
      motors.forEach(mo => {
        const b = mo.b || mo.marque || mo.brand;
        const m = mo.m || mo.modele || mo.model;
        const y = mo.y || mo.annee || mo.years;
        const e = mo.e || mo.engine || mo.motorisation;
        const p = mo.p || mo.power || mo.puissance;
        const t = mo.t || mo.type || mo.fuel || mo.energie;
        const tr = mo.tr || mo.transmission || mo.boite;
        const code = mo.code || mo.d || mo.displacement;
        
        if (b && m && e) {
          addEngineToIndex(b, m, y, e, p, t, tr, code);
        }
      });
    }
  };

  /* =========================================================
     LOGIQUE DE PRÉDICTION STRICTE (CASCADE)
     ========================================================= */
  const predictBrands = (query) => {
    const q = norm(query);
    if (!q) return Object.values(index.brands).map(b => ({ name: b.name, id: normKey(b.name) })).slice(0, 50);
    
    return Object.values(index.brands)
      .filter(b => norm(b.name).includes(q))
      .map(b => ({ name: b.name, id: normKey(b.name) }))
      .slice(0, 50);
  };

  const predictModels = (brandName, query) => {
    if (!brandName) return [];
    const bk = normKey(brandName);
    const brandData = index.brands[bk];
    if (!brandData) return [];

    const q = norm(query);
    return brandData.models
      .filter(m => !q || norm(m.name).includes(q))
      .map(m => ({ 
        id: `${bk}|${normKey(m.name)}`, 
        brand: m.brand, 
        name: m.name, 
        years: m.years,
        source: m.source || "local"
      }))
      .sort((a,b) => norm(a.name).localeCompare(norm(b.name)))
      .slice(0, 100);
  };

  const predictEngines = (brandName, modelName, yearStr) => {
    if (!brandName || !modelName) return [];
    const bk = normKey(brandName);
    const mk = normKey(modelName);
    const modelKey = `${bk}|${mk}`;
    const modelData = index.models[modelKey];
    
    if (!modelData) return [];

    const year = parseYear(yearStr);
    
    let engines = modelData.engines;
    if (year) {
      engines = engines.filter(e => yearMatches(e.years, year));
    }

    // FALLBACK INTELLIGENT CRUCIAL :
    // Si aucune correspondance stricte d'année mais qu'il y a des moteurs pour ce modèle,
    // on retourne TOUS les moteurs du modèle pour éviter la liste vide frustrante.
    // L'utilisateur pourra alors choisir celui qui semble le plus proche.
    if (!engines.length && modelData.engines.length) {
       engines = modelData.engines;
    }

    return engines.map(e => ({
      id: `${modelKey}|${normKey(e.engine)}`,
      ...e
    })).sort((a, b) => {
      const rankA = ["Essence","Diesel","Hybride","Hybride rechargeable","Hybride léger 48V","Électrique"].indexOf(a.fuel);
      const rankB = ["Essence","Diesel","Hybride","Hybride rechargeable","Hybride léger 48V","Électrique"].indexOf(b.fuel);
      if (rankA !== rankB) return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
      
      const powA = parseFloat(String(a.power).match(/(\d+)/)?.[0] || 0);
      const powB = parseFloat(String(b.power).match(/(\d+)/)?.[0] || 0);
      return powB - powA;
    });
  };

  /* =========================================================
     UI DROPDOWN & EVENEMENTS
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

    const val = input.value;
    const brands = predictBrands(val);

    if (!brands.length) {
      panel.innerHTML = '<div class="combo-empty">Aucune marque trouvée.</div>';
      panel.classList.remove("hidden");
      return;
    }

    panel.innerHTML = brands.map(b => `<button type="button" class="suggest-item" data-brand="${esc(b.name)}">${esc(b.name)}</button>`).join("");
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
    
    renderModelList("");
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
    return parts.join(" • ");
  };

  const renderModelList = (filter) => {
    const list = q("#modelList");
    if (!list) return;

    if (!selection.brand) {
      list.innerHTML = '<div class="combo-empty">Sélectionnez une marque d\'abord.</div>';
      return;
    }

    const models = predictModels(selection.brand.name, filter);
    
    if (!models.length) {
      list.innerHTML = '<div class="combo-empty">Aucun modèle trouvé pour cette marque.</div>';
      return;
    }

    list.innerHTML = models.map((o, i) => `<button type="button" class="combo-option" data-model-index="${i}" data-model-name="${esc(o.name)}">${esc(o.name)} ${o.years ? '('+o.years+')' : ''}</button>`).join("");
    
    window.__tempModelOptions = models;
  };

  const renderEngineList = (filter) => {
    const list = q("#engineList");
    if (!list) return;

    if (!selection.brand || !selection.model) {
      list.innerHTML = '<div class="combo-empty">Sélectionnez un modèle d\'abord.</div>';
      return;
    }

    const yearVal = (q("#vehicleYear") || {}).value || "";
    const engines = predictEngines(selection.brand.name, selection.model.name, yearVal);
    
    const f = norm(filter || "");
    const filtered = f ? engines.filter(e => norm(engineLabel(e)).includes(f)) : engines;

    if (!filtered.length) {
      list.innerHTML = '<div class="combo-empty">Aucune motorisation compatible trouvée.</div>';
      return;
    }

    list.innerHTML = filtered.map((o, i) => `<button type="button" class="combo-option" data-engine-index="${i}">${esc(engineLabel(o))}</button>`).join("");
    
    window.__tempEngineOptions = filtered;
  };

  const selectModel = (opt) => {
    if (!opt) return;
    selection.model = opt;
    selection.engine = null;
    closeAllCombos();
    updateModelButton();
    renderEngineList("");
    updateSelectionSummary();
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
      engine: selection.engine ? selection.engine.engine : "",
      displacement: selection.engine ? selection.engine.displacement : "",
      power: selection.engine ? selection.engine.power : "",
      fuel: selection.engine ? selection.engine.fuel : "",
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

  const matchDefects = (v, text) => {
    const txt = norm(text);
    const yr = parseYear(v.annee);
    const results = [];

    catalog.defects.forEach(d => {
      if (v.marque && !brandMatches(d.b, v.marque)) return;
      if (v.modele && d.m && d.m !== "*" && !modelListContains(d.m, v.modele)) return;
      if (!yearMatches(d.y, yr)) return;

      let score = 0;
      const found = [];
      
      String(d.s || "").split("|").forEach(s => {
        if (txt.includes(norm(s))) {
          score++;
          found.push(s);
        }
      });

      if (v.engine && d.e && norm(v.engine).includes(norm(d.e))) score += 5;
      if (v.fuel && norm(d.et) === norm(v.fuel)) score += 3;

      if (score >= 1) {
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
          confiance: score > 5 ? "Haute" : (score > 2 ? "Moyenne" : "Basse"),
          alerteUsure: d.wf >= 0.9 ? "Défaut de conception probable." : "À confirmer par expertise.",
          baseLegale: d.law,
          rappelRef: d.rec,
          wearFactor: d.wf,
          tags: d.tg,
          dtc: d.dtc,
          engineType: d.et,
          source: d.source,
          sourceUrl: d.sourceUrl
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
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
      professional: sellerType === "professional" || containsAny(all, ["professionnel", "garage", "concession", "revendeur"]),
      privateSeller: sellerType === "private" || containsAny(all, ["particulier", "entre particuliers", "leboncoin"]),
      waterLeak: containsAny(all, ["eau", "humidité", "infiltration", "baie", "pare brise", "moisiure"]),
      safety: containsAny(all, ["sécurité", "frein", "airbag", "direction", "incendie", "danger"]),
      ev: isElectricLike(fuelNorm) || containsAny(all, ["batterie", "charge", "autonomie", "electrique", "hybride", "BMS"]),
      diesel: fuelNorm.includes("diesel") || containsAny(allNorm, ["diesel", "egr", "fap", "adblue", "nox"]),
      petrol: fuelNorm.includes("essence") || containsAny(allNorm, ["essence", "turbo", "puretech", "tsi", "ecoboost"]),
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

  // Helpers de rendu section (identiques à v25)
  const secIdentification = (text, context) => {
    let h = `<p><strong>Objet :</strong> recensement des éléments fournis ${addTerm("éléments factuels", "faits allégués")}.</p>`;
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
    h += `<li><strong>Kilométrage :</strong> ${esc(vehicleData.kilometrage || "non précisé")} km ${addTerm("kilométrage", "usure normale", "vétusté")}</li>`;
    h += `<li><strong>VIN :</strong> ${esc(vehicleData.vin || "non communiqué")} ${addTerm("VIN", "numéro de série", "traçabilité")}</li>`;
    h += "</ul>";
    h += "<h4>B. Faits rapportés</h4>";
    h += `<p>${esc(text.substring(0, 1400))}${text.length > 1400 ? " [...]" : ""}</p>`;
    if (context) {
      h += `<h4>C. Contexte transactionnel</h4><p>${esc(context.substring(0, 1000))}</p>`;
    }
    h += `<div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ${addTerm("faits non vérifiés", "principe du contradictoire")}.</div>`;
    return h;
  };

  const secTechnique = (matches, flags, vData) => {
    const km = parseKm(vData.kilometrage);
    const yr = parseYear(vData.annee);
    const age = new Date().getFullYear() - (yr || new Date().getFullYear());
    let h = "";
    
    if (!matches.length) {
      h += `<p><strong>Objet :</strong> recherche de défauts conceptuels connus ${addTerm("défauts conceptuels", "problèmes récurrents", "défaut de série")}.</p>`;
      h += '<div class="verification-needed">';
      h += "<p>Aucune correspondance exacte trouvée dans la base locale massive pour Marque/Modèle/Année/Motorisation/Puissance/Symptômes.</p>";
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
    const autoCount = catalog.defects.filter(d => d.source === "auto-diagnostic").length;
    let h = `<p><strong>Objet :</strong> appui technique issu de la base auto-diagnostic, corrélé au contexte du litige et à la motorisation ${addTerm("appui technique", "corrélation auto-diagnostic", "fiche expert", "DTC", "motorisation")}.</p>`;
    h += `<p><strong>Entrées auto-diagnostic disponibles :</strong> ${autoCount} fiche(s).</p>`;
    if (!autoCount) {
      h += '<div class="verification-needed">';
      h += "<p>La base auto-diagnostic n’a pas encore exposé de données exploitables via JSON ou extraction HTML/JS.</p>";
      h += `<p>URL configurée : <code>${esc(CONFIG.catalog.autoBaseUrl)}</code></p>`;
      h += "<p>Déposer un export JSON dans l’un des endpoints configurés, ou utiliser : Admin → Base technique → Importer JSON.</p>";
      h += "</div>";
      return h;
    }
    const autoMatches = matches.filter(m => m.source === "auto-diagnostic");
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
    const links = researchLinks(vehicleData.marque, vehicleData.modele, matches[0] ? matches[0].moteur : vehicleData.engine, matches[0] ? matches[0].symptomes : [], vehicleData.fuel);
    h += "<h4>C. Pistes de recherche externe</h4><ul>";
    links.forEach((l) => { h += `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`; });
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
    terms.forEach((t) => { h += `<div class="lexique-item"><strong>${esc(t)}</strong></div>`; });
    h += "</div>";
    return h;
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

  /* =========================================================
     ADMIN / SYNC / PDF (SIMPLIFIÉ)
     ========================================================= */
  const updateDataStatus = (msg) => {
    const el = q("#dataStatus");
    if (el) el.textContent = msg;
  };

  const updateAdminStats = () => {
    if (q("#statBrands")) q("#statBrands").textContent = Object.keys(index.brands).length;
    if (q("#statModels")) q("#statModels").textContent = Object.keys(index.models).length;
    if (q("#statEngines")) q("#statEngines").textContent = Object.keys(index.engines).length;
    if (q("#statEntries")) q("#statEntries").textContent = catalog.defects.length;
  };

  const renderAdmin = () => {
    updateAdminStats();
  };

  const registerServiceWorker = () => {
    try {
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js")
          .then((reg) => { swRegistration = reg; return navigator.serviceWorker.ready; })
          .then((reg) => { swRegistration = reg; console.log("[AR-EXPERT] Service Worker prêt."); })
          .catch((err) => console.warn("[AR-EXPERT] Service Worker non enregistré:", err));
      }
    } catch (e) { console.warn("[AR-EXPERT] Enregistrement SW impossible:", e); }
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

  const bindUi = () => {
    // Tabs Auth
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

    // Login Admin
    on("#adminLoginBtn", "click", async () => {
      const pwdEl = q("#adminPassword");
      const rememberEl = q("#rememberAdminPwd");
      const pwd = pwdEl ? pwdEl.value : "";
      const remember = rememberEl ? rememberEl.checked : false;
      if (!pwd) { authMessage("Mot de passe requis.", "error"); return; }
      const ok = await verifyAdminPassword(pwd);
      if (!ok) { authMessage("Mot de passe incorrect.", "error"); return; }
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
      if (!saved) { authMessage("Aucun mot de passe enregistré.", "warning"); return; }
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

    // Request Access
    on("#requestBtn", "click", () => {
      const nameEl = q("#reqName");
      const emailEl = q("#reqEmail");
      const reasonEl = q("#reqReason");
      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      const reason = reasonEl ? reasonEl.value.trim() : "";
      if (!name || !email || !reason) { authMessage("Nom, email et motif sont requis.", "error"); return; }
      const requests = getRequests();
      const emailKey = userEmailKey(email);
      const alreadyPending = requests.find((r) => r.emailNorm === emailKey && r.status === "pending");
      if (alreadyPending) { authMessage("Demande déjà en attente.", "warning"); return; }
      const existingApproved = findApprovedUser(name, email);
      if (existingApproved) { authMessage("Accès déjà accordé. Utilisez Connexion tiers.", "success"); return; }
      const req = migrateRequest({
        id: uid(), name, email, reason, status: "pending", date: new Date().toLocaleString("fr-FR"), ts: Date.now(), source: "formulaire-local"
      });
      requests.push(req);
      saveRequests(requests);
      publishAccessRequest(req);
      authMessage("Demande envoyée.", "success");
      if (nameEl) nameEl.value = "";
      if (emailEl) emailEl.value = "";
      if (reasonEl) reasonEl.value = "";
    });

    // Third Party Login
    on("#thirdLoginBtn", "click", () => {
      const nameEl = q("#loginName");
      const emailEl = q("#loginEmail");
      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      if (!email) { authMessage("Email requis.", "error"); return; }
      const user = findApprovedUser(name, email);
      if (!user) {
        const emailKey = userEmailKey(email);
        const pending = getRequests().find((r) => r.status === "pending" && r.emailNorm === emailKey);
        if (pending) {
          authMessage("Votre demande est en attente de validation admin.", "warning");
          return;
        }
        authMessage("Aucun accès approuvé trouvé pour cet email.", "error");
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

    // Brand Input Logic
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
    
    on("#brandPanel", "mousedown", (e) => {
      const btn = e.target.closest("[data-brand]");
      if (!btn) return;
      e.preventDefault();
      selectBrand(btn.getAttribute("data-brand"));
    });

    // Model Button Logic
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
      if (window.__tempModelOptions && window.__tempModelOptions[idx]) {
        selectModel(window.__tempModelOptions[idx]);
      }
    });

    // Engine Button Logic
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
      if (window.__tempEngineOptions && window.__tempEngineOptions[idx]) {
        selectEngine(window.__tempEngineOptions[idx]);
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".combo")) closeAllCombos();
    });

    on("#vehicleYear", "input", () => {
      if (selection.brand && selection.model) {
        renderEngineList("");
      }
      updateSelectionSummary();
    });

    // Analyze Btn
    on("#analyzeBtn", "click", () => {
      if (!currentUser) { toast("Connectez-vous.", "error"); return; }
      const info = dailyInfo();
      if (!info.allowed) { toast(`Limite de ${CONFIG.maxDailyAnalyses} analyses/jour atteinte.`, "warning"); return; }
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
      if (!text) { toast("Saisissez des faits ou importez un PDF.", "warning"); return; }
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

    // Admin Panel
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
          const user = upsertUser({ id: req.id, name: req.name, email: req.email, role: "user", status: "approved", daily: { date: todayKey(), count: 0 } });
          req.userId = user.key;
          notify("Accès approuvé", `${req.name} (${req.email})`);
        }
        saveRequests(reqs);
        renderAdmin();
        toast(action === "approve" ? "Demande acceptée." : "Demande refusée.", action === "approve" ? "success" : "warning");
      }
      if (action === "revoke" || action === "restore") {
        const emailKey = userEmailKey(btn.dataset.email || "");
        const users = getUsers();
        const idx = users.findIndex((u) => u.emailNorm === emailKey && u.role !== "admin");
        if (idx >= 0) {
          users[idx].status = action === "revoke" ? "revoked" : "approved";
          users[idx].updatedAt = Date.now();
          saveUsers(users);
          renderAdmin();
          enforceTierAccess();
          toast(action === "revoke" ? "Accès révoqué." : "Accès rétabli.", action === "revoke" ? "warning" : "success");
        }
      }
    });

    on("#reloadCatalogBtn", "click", () => {
      del(KEYS.AUTO_LAST_SYNC);
      syncRemoteCatalogPassive().then(() => {
        updateAdminStats();
        toast("Base rechargée depuis Auto-Diagnostic.", "success");
      });
    });

    on("#exportDataBtn", "click", () => {
      const data = {
        exportedAt: new Date().toISOString(),
        users: getUsers(),
        requests: getRequests(),
        catalogStats: {
          brands: Object.keys(index.brands).length,
          models: Object.keys(index.models).length,
          engines: Object.keys(index.engines).length,
          defects: catalog.defects.length
        }
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aide-redactionnelle-expert-data-v26.json";
      a.click();
      toast("Données exportées.", "success");
    });
  };

  /* =========================================================
     INIT
     ========================================================= */
  const init = async () => {
    initIndexOfflineFirst();
    
    updateAdminStats();
    updateDataStatus("Base locale massive historique chargée (Off-line First)");
    updateNotificationState();
    registerServiceWorker();
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
    
    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
    
    syncRemoteCatalogPassive();
    
    toast("Application prête. Couverture historique 2012-2026 activée.", "success");
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
