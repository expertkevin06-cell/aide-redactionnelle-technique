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

  const OLD_KEYS = {
    SESSION: "arex_session_v24",
    USERS: "arex_users_v24",
    REQUESTS: "arex_requests_v24",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v24",
    TECH_UPDATES: "arex_tech_updates_v24",
    LAST_UPDATE: "arex_last_update_v24",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v24",
    CATALOG_CFG: "arex_catalog_cfg_v24",
    IMPORTED_RAW: "arex_imported_raw_v24"
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
     BASE DE DONNÉES MASSIVE EMBARQUÉE (OFFLINE FIRST)
     Inclut Skoda Elroq 2025, Tesla, BYD, etc.
     Format: [Marque, Modèle, Années, MoteurLabel, Puissance, Energie, Boite, Code/Cyl/KWh]
     ========================================================= */
  const EMBEDDED_MASTER_DB = [
    // --- FRANCE ---
    ["Renault", "Clio V", "2019-2026", "1.0 TCe", "65ch|90ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Renault", "Clio V", "2019-2026", "1.3 TCe", "100ch|130ch|140ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Clio V", "2019-2026", "1.5 dCi", "75ch|100ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Clio V", "2019-2026", "E-Tech Hybrid", "140ch|145ch", "Hybride", "automatique", "TCe 140|1.6 L"],
    ["Renault", "Captur II", "2020-2026", "1.0 TCe", "90ch|100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Renault", "Captur II", "2020-2026", "1.3 TCe", "130ch|155ch", "Essence", "EDC", "H5H|1.3 L"],
    ["Renault", "Captur II", "2020-2026", "1.5 Blue dCi", "100ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Captur II", "2020-2026", "E-Tech Hybrid", "140ch|160ch", "Hybride", "automatique", "TCe 160|1.6 L"],
    ["Renault", "Megane IV", "2016-2024", "1.3 TCe", "100ch|140ch|160ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Megane IV", "2016-2024", "1.5 dCi", "90ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Megane IV", "2020-2024", "E-Tech Hybrid", "160ch|205ch", "Hybride", "automatique", "TCe 200|1.6 L"],
    ["Renault", "Scenic IV", "2016-2024", "1.3 TCe", "115ch|140ch|160ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Scenic IV", "2016-2024", "1.5 dCi", "95ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Austral", "2022-2026", "1.2 TCe 130", "130ch", "Essence", "BVM6", "HFT|1.2 L"],
    ["Renault", "Austral", "2022-2026", "E-Tech Hybrid 200", "200ch", "Hybride", "automatique", "TCe 200|1.2 L"],
    ["Renault", "Austral", "2022-2026", "E-Tech Plug-in Hybrid 260", "260ch", "Hybride rechargeable", "automatique", "PHEV 260|1.2 L"],
    ["Renault", "Arkana", "2021-2026", "1.3 TCe", "140ch|160ch", "Essence", "EDC", "H5H|1.3 L"],
    ["Renault", "Arkana", "2021-2026", "E-Tech Hybrid", "145ch|160ch", "Hybride", "automatique", "TCe 160|1.6 L"],
    ["Renault", "Kangoo III", "2021-2026", "1.3 TCe", "100ch|130ch", "Essence", "BVM6", "H5H|1.3 L"],
    ["Renault", "Kangoo III", "2021-2026", "1.5 Blue dCi", "85ch|100ch|115ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Renault", "Kangoo III", "2021-2026", "E-Tech Electric", "100kW|136ch", "Électrique", "réducteur", "eKangoo|45 kWh"],
    ["Renault", "Trafic III", "2014-2026", "2.0 dCi", "120ch|150ch|170ch", "Diesel", "BVM6", "M9R|2.0 L"],
    ["Renault", "Master III", "2010-2026", "2.3 dCi", "100ch|125ch|135ch|150ch", "Diesel", "BVM6", "9H|2.3 L"],
    ["Renault", "Master III", "2019-2026", "2.0 dCi", "136ch|160ch|180ch", "Diesel", "BVM6|EDC", "M9R|2.0 L"],
    ["Renault", "Zoe II", "2019-2024", "R110/R135", "110ch|135ch", "Électrique", "réducteur", "Zoe|52 kWh"],
    ["Renault", "Megane E-Tech", "2022-2026", "Evolution 60 kWh", "130ch|220ch", "Électrique", "réducteur", "CMF-EV|60 kWh"],
    ["Renault", "Megane E-Tech", "2022-2026", "Iconic 60 kWh", "220ch", "Électrique", "réducteur", "CMF-EV|60 kWh"],
    ["Renault", "Scenic E-Tech", "2024-2026", "60 kWh", "170ch|210ch", "Électrique", "réducteur", "CMF-EV|60 kWh"],
    ["Renault", "Scenic E-Tech", "2024-2026", "87 kWh", "210ch", "Électrique", "réducteur", "CMF-EV|87 kWh"],

    ["Dacia", "Sandero III", "2020-2026", "1.0 SCe", "65ch|75ch", "Essence", "BVM5", "SCe|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.0 TCe", "90ch|100ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.0 ECO-G 100", "100ch", "GPL", "BVM6", "ECO-G|1.0 L"],
    ["Dacia", "Sandero III", "2020-2026", "1.5 Blue dCi", "100ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Dacia", "Duster III", "2024-2026", "1.0 TCe", "100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Dacia", "Duster III", "2024-2026", "1.2 TCe", "130ch|140ch", "Essence", "BVM6|EDC", "H5F|1.2 L"],
    ["Dacia", "Duster III", "2024-2026", "1.5 Blue dCi", "100ch|115ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Dacia", "Duster III", "2024-2026", "Hybrid 140", "140ch", "Hybride", "automatique", "TCe 140|1.0 L"],
    ["Dacia", "Logan MCV", "2020-2026", "1.0 SCe", "75ch", "Essence", "BVM5", "SCe|1.0 L"],
    ["Dacia", "Logan MCV", "2020-2026", "1.0 TCe", "90ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Dacia", "Jogger", "2021-2026", "1.0 TCe", "100ch|110ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Dacia", "Jogger", "2021-2026", "1.5 Blue dCi", "100ch", "Diesel", "BVM6", "K9K|1.5 L"],
    ["Dacia", "Spring", "2021-2026", "45 ch", "45ch", "Électrique", "réducteur", "Spring|26.8 kWh"],
    ["Dacia", "Spring", "2024-2026", "65 ch", "65ch", "Électrique", "réducteur", "Spring|27 kWh"],

    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 75", "75ch", "Essence", "BVM5", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 100", "100ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "208 II", "2019-2026", "1.5 BlueHDi 100", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Peugeot", "208 II", "2019-2026", "e-208", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],
    ["Peugeot", "2008 II", "2019-2026", "1.2 PureTech 100", "100ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "2008 II", "2019-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "2008 II", "2019-2026", "1.5 BlueHDi 100|130", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "2008 II", "2019-2026", "e-2008", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],
    ["Peugeot", "308 III", "2021-2026", "1.2 PureTech 110", "110ch", "Essence", "BVM6", "EB2|1.2 L"],
    ["Peugeot", "308 III", "2021-2026", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "308 III", "2021-2026", "1.5 BlueHDi 130", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "308 III", "2021-2026", "Hybrid 180", "180ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308 III", "2021-2026", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308 III", "2021-2026", "e-308", "115kW|150kW", "Électrique", "réducteur", "eCMP|54 kWh"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 225", "225ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "1.6 Hybrid 320 4x4", "320ch", "Hybride rechargeable", "automatique 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "3008 III", "2024-2026", "e-3008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 225", "225ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "1.6 Hybrid 320 4x4", "320ch", "Hybride rechargeable", "automatique 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "5008 III", "2024-2026", "e-5008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],
    ["Peugeot", "Partner III", "2018-2026", "1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "Partner III", "2018-2026", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "Partner III", "2018-2026", "e-Partner", "100kW|136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Peugeot", "Rifter", "2018-2026", "1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "Rifter", "2018-2026", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "Rifter", "2018-2026", "e-Rifter", "100kW|136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Peugeot", "Boxer", "2014-2026", "2.2 BlueHDi", "120ch|140ch|165ch", "Diesel", "BVM6", "DW12|2.2 L"],
    ["Peugeot", "Boxer", "2014-2026", "3.0 BlueHDi", "160ch|180ch", "Diesel", "BVM6", "DV6|3.0 L"],
    ["Peugeot", "Boxer", "2021-2026", "e-Boxer", "90kW|122ch", "Électrique", "réducteur", "eBoxer|70 kWh"],

    ["Citroen", "C3 III", "2016-2026", "1.2 PureTech", "82ch|100ch|110ch|130ch", "Essence", "BVM5|BVM6|EAT6", "EB2|1.2 L"],
    ["Citroen", "C3 III", "2016-2026", "1.5 BlueHDi", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Citroen", "C3 III", "2024-2026", "ë-C3", "94ch|118ch", "Électrique", "réducteur", "eCMP|44 kWh"],
    ["Citroen", "C3 Aircross", "2017-2026", "1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT6", "EB2|1.2 L"],
    ["Citroen", "C3 Aircross", "2017-2026", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT6", "DV5|1.5 L"],
    ["Citroen", "C4", "2020-2026", "1.2 PureTech", "100ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Citroen", "C4", "2020-2026", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Citroen", "C4", "2020-2026", "ë-C4", "100kW|115kW|156ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Citroen", "C4 Cactus", "2014-2024", "1.2 PureTech", "82ch|100ch|110ch|130ch", "Essence", "BVM5|BVM6|EAT6", "EB2|1.2 L"],
    ["Citroen", "C4 Cactus", "2014-2024", "1.6 BlueHDi", "100ch|120ch", "Diesel", "BVM6|EAT6", "DV6|1.6 L"],
    ["Citroen", "C5 Aircross", "2018-2026", "1.2 PureTech", "130ch|180ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Citroen", "C5 Aircross", "2018-2026", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Citroen", "C5 Aircross", "2018-2026", "2.0 BlueHDi", "160ch|180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Citroen", "C5 Aircross", "2019-2026", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Citroen", "C5 Aircross", "2020-2026", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Citroen", "Berlingo", "2018-2026", "1.2 PureTech", "100ch|110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Citroen", "Berlingo", "2018-2026", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Citroen", "Berlingo", "2018-2026", "ë-Berlingo", "100kW|136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Citroen", "Jumper", "2014-2026", "2.2 BlueHDi", "120ch|140ch|165ch", "Diesel", "BVM6", "DW12|2.2 L"],
    ["Citroen", "Jumper", "2014-2026", "3.0 BlueHDi", "160ch|180ch", "Diesel", "BVM6", "DV6|3.0 L"],
    ["Citroen", "Jumper", "2021-2026", "ë-Jumper", "90kW|122ch", "Électrique", "réducteur", "eJumper|70 kWh"],

    ["DS", "DS 3 Crossback", "2018-2026", "1.2 PureTech", "100ch|130ch|155ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["DS", "DS 3 Crossback", "2018-2026", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["DS", "DS 3 Crossback", "2019-2026", "E-Tense", "136ch", "Électrique", "réducteur", "e-CMP|50 kWh"],
    ["DS", "DS 4", "2021-2026", "1.2 PureTech", "130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["DS", "DS 4", "2021-2026", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["DS", "DS 4", "2021-2026", "E-Tense 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["DS", "DS 7 Crossback", "2018-2026", "1.6 PureTech", "180ch|225ch", "Essence", "EAT8", "EP6F|1.6 L"],
    ["DS", "DS 7 Crossback", "2018-2026", "2.0 BlueHDi", "130ch|180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["DS", "DS 7 Crossback", "2019-2026", "E-Tense 4x4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["DS", "DS 7 Crossback", "2021-2026", "E-Tense 4x4 360", "360ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],

    // --- EUROPE ---
    ["Volkswagen", "Polo VI", "2017-2026", "1.0 MPI", "65ch|75ch", "Essence", "BVM5", "EA211|1.0 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM5|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "1.6 TDI", "80ch", "Diesel", "BVM5", "EA288|1.6 L"],
    ["Volkswagen", "Polo VI", "2017-2026", "2.0 TDI", "95ch|115ch|150ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
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
    ["Volkswagen", "T-Cross", "2019-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM6|DSG", "EA211|1.0 L"],
    ["Volkswagen", "T-Cross", "2019-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "T-Cross", "2019-2026", "1.6 TDI", "95ch", "Diesel", "DSG", "EA288|1.6 L"],
    ["Volkswagen", "T-Cross", "2019-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG", "EA288|2.0 L"],
    ["Volkswagen", "Taigo", "2021-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM6|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Taigo", "2021-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "T-Roc", "2017-2026", "1.0 TSI", "110ch|150ch", "Essence", "DSG", "EA211|1.0 L"],
    ["Volkswagen", "T-Roc", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "T-Roc", "2017-2026", "2.0 TSI", "190ch|300ch", "Essence", "DSG 4Motion", "EA888|2.0 L"],
    ["Volkswagen", "T-Roc", "2017-2026", "2.0 TDI", "150ch|190ch", "Diesel", "DSG|4Motion", "EA288|2.0 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "2.0 TSI", "190ch|245ch|320ch", "Essence", "DSG 4Motion", "EA888|2.0 L"],
    ["Volkswagen", "Tiguan II", "2016-2026", "2.0 TDI", "150ch|190ch|200ch", "Diesel", "DSG|4Motion", "EA288|2.0 L"],
    ["Volkswagen", "Tiguan II", "2019-2026", "eHybrid", "245ch|300ch", "Hybride rechargeable", "DSG 4Motion", "PHEV|1.4 L|2.0 L"],
    ["Volkswagen", "Touran", "2015-2026", "1.5 TSI", "130ch|150ch", "Essence", "DSG|BVM6", "EA211 evo|1.5 L"],
    ["Volkswagen", "Touran", "2015-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Caddy V", "2020-2026", "1.5 TSI", "114ch", "Essence", "DSG|BVM6", "EA211|1.5 L"],
    ["Volkswagen", "Caddy V", "2020-2026", "2.0 TDI", "102ch|122ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Caddy V", "2020-2026", "e-Caddy", "83kW|113ch", "Électrique", "réducteur", "eCaddy|37 kWh|45 kWh"],
    ["Volkswagen", "ID.3", "2020-2026", "Pure Performance", "145ch|174ch|204ch", "Électrique", "réducteur", "MEB|58 kWh|77 kWh"],
    ["Volkswagen", "ID.3", "2020-2026", "Pro", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.3", "2020-2026", "Pro S", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.3", "2020-2026", "GTX", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.4", "2021-2026", "Pure", "174ch", "Électrique", "réducteur", "MEB|52 kWh|58 kWh"],
    ["Volkswagen", "ID.4", "2021-2026", "Pro", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.4", "2021-2026", "Pro Performance", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.4", "2021-2026", "GTX", "299ch", "Électrique", "AWD / réducteur", "MEB|77 kWh|86 kWh"],
    ["Volkswagen", "ID.5", "2022-2026", "Pro", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Volkswagen", "ID.5", "2022-2026", "GTX", "299ch", "Électrique", "AWD / réducteur", "MEB|77 kWh|86 kWh"],
    ["Volkswagen", "ID.7", "2024-2026", "Pro", "286ch", "Électrique", "réducteur", "MEB|77 kWh|86 kWh"],
    ["Volkswagen", "ID.7", "2024-2026", "GTX", "340ch", "Électrique", "AWD / réducteur", "MEB|86 kWh"],

    ["Audi", "A1", "2018-2026", "25 TFSI", "95ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "A1", "2018-2026", "30 TFSI", "110ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "A1", "2018-2026", "35 TFSI", "150ch", "Essence", "S tronic", "EA211|1.5 L"],
    ["Audi", "A1", "2018-2026", "30 TDI", "116ch", "Diesel", "S tronic", "EA288|1.6 L"],
    ["Audi", "A1", "2018-2026", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "A3", "2020-2026", "30 TFSI", "110ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "A3", "2020-2026", "35 TFSI", "150ch", "Essence", "S tronic", "EA211 evo|1.5 L"],
    ["Audi", "A3", "2020-2026", "40 TFSI", "204ch", "Essence", "S tronic", "EA888|2.0 L"],
    ["Audi", "A3", "2020-2026", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "A3", "2020-2026", "40 TDI", "204ch", "Diesel", "S tronic quattro", "EA288|2.0 L"],
    ["Audi", "A3", "2020-2026", "Sportback 45 TFSI e", "245ch|310ch", "Hybride rechargeable", "S tronic", "PHEV|1.4 L"],
    ["Audi", "A4", "2015-2024", "35 TFSI", "150ch", "Essence", "S tronic", "EA211|1.4 L|2.0 L"],
    ["Audi", "A4", "2015-2024", "40 TFSI", "190ch|245ch", "Essence", "S tronic", "EA888|2.0 L"],
    ["Audi", "A4", "2015-2024", "35 TDI", "163ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "A4", "2015-2024", "40 TDI", "190ch|204ch", "Diesel", "S tronic|quattro", "EA288|2.0 L"],
    ["Audi", "A4", "2015-2024", "50 TDI", "286ch", "Diesel", "tiptronic quattro", "EA288|2.0 L"],
    ["Audi", "Q2", "2016-2026", "30 TFSI", "110ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "Q2", "2016-2026", "35 TFSI", "150ch", "Essence", "S tronic", "EA211|1.4 L|1.5 L"],
    ["Audi", "Q2", "2016-2026", "40 TFSI", "190ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "Q2", "2016-2026", "30 TDI", "116ch", "Diesel", "S tronic", "EA288|1.6 L"],
    ["Audi", "Q2", "2016-2026", "35 TDI", "150ch", "Diesel", "S tronic|quattro", "EA288|2.0 L"],
    ["Audi", "Q3", "2018-2026", "30 TFSI", "110ch|150ch", "Essence", "S tronic", "EA211|1.0 L|1.5 L"],
    ["Audi", "Q3", "2018-2026", "40 TFSI", "190ch|204ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "Q3", "2018-2026", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "Q3", "2018-2026", "40 TDI", "190ch", "Diesel", "S tronic quattro", "EA288|2.0 L"],
    ["Audi", "Q3", "2019-2026", "45 TFSI e", "245ch", "Hybride rechargeable", "S tronic quattro", "PHEV|1.4 L"],
    ["Audi", "Q5", "2017-2026", "40 TFSI", "204ch|245ch", "Essence", "tiptronic quattro", "EA888|2.0 L"],
    ["Audi", "Q5", "2017-2026", "45 TFSI", "265ch", "Essence", "tiptronic quattro", "EA888|2.0 L"],
    ["Audi", "Q5", "2017-2026", "40 TDI", "204ch", "Diesel", "tiptronic quattro", "EA288|2.0 L"],
    ["Audi", "Q5", "2017-2026", "50 TDI", "286ch", "Diesel", "tiptronic quattro", "EA288|3.0 L"],
    ["Audi", "Q5", "2019-2026", "55 TFSI e", "367ch", "Hybride rechargeable", "tiptronic quattro", "PHEV|3.0 L"],
    ["Audi", "Q4 e-tron", "2021-2026", "35 e-tron", "170ch", "Électrique", "réducteur", "MEB|52 kWh|55 kWh"],
    ["Audi", "Q4 e-tron", "2021-2026", "40 e-tron", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Audi", "Q4 e-tron", "2021-2026", "50 e-tron quattro", "299ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],
    ["Audi", "e-tron GT", "2021-2026", "e-tron GT quattro", "476ch|530ch", "Électrique", "AWD / réducteur", "J1|86 kWh|93 kWh"],
    ["Audi", "e-tron GT", "2021-2026", "RS e-tron GT", "598ch|646ch", "Électrique", "AWD / réducteur", "J1|93 kWh|105 kWh"],

    ["Skoda", "Fabia IV", "2021-2026", "1.0 MPI", "65ch|80ch", "Essence", "BVM5", "EA211|1.0 L"],
    ["Skoda", "Fabia IV", "2021-2026", "1.0 TSI", "95ch|110ch", "Essence", "BVM5|DSG", "EA211|1.0 L"],
    ["Skoda", "Fabia IV", "2021-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Octavia IV", "2020-2026", "1.5 TSI", "110ch|150ch", "Essence", "BVM6|DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Octavia IV", "2020-2026", "2.0 TSI", "190ch|265ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Octavia IV", "2020-2026", "2.0 TDI", "115ch|150ch|200ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Octavia IV", "2020-2026", "iV", "204ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],
    ["Skoda", "Superb III", "2015-2024", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Superb III", "2015-2024", "2.0 TSI", "190ch|272ch|280ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Superb III", "2015-2024", "2.0 TDI", "150ch|190ch|200ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Superb III", "2019-2024", "iV", "218ch", "Hybride rechargeable", "DSG 4x4", "PHEV|1.4 L"],
    ["Skoda", "Karoq", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Karoq", "2017-2026", "2.0 TSI", "190ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Karoq", "2017-2026", "2.0 TDI", "150ch|190ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Kodiaq", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Kodiaq", "2017-2026", "2.0 TSI", "190ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Kodiaq", "2017-2026", "2.0 TDI", "150ch|200ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Kodiaq", "2021-2026", "iV", "245ch", "Hybride rechargeable", "DSG 4x4", "PHEV|2.0 L"],
    ["Skoda", "Enyaq", "2021-2026", "60", "180ch|204ch", "Électrique", "réducteur", "MEB|63 kWh"],
    ["Skoda", "Enyaq", "2021-2026", "80", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Skoda", "Enyaq", "2021-2026", "80x", "265ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],
    ["Skoda", "Enyaq", "2021-2026", "vRS", "340ch", "Électrique", "AWD / réducteur", "MEB|77 kWh|82 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 50", "55 kWh|125kW|170ch", "Électrique", "RWD / réducteur", "MEB|55 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 60", "63 kWh|150kW|204ch", "Électrique", "RWD / réducteur", "MEB|63 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 85", "77 kWh|210kW|286ch", "Électrique", "RWD / réducteur", "MEB|77 kWh"],
    ["Skoda", "Elroq", "2024-2026", "Elroq 85x", "77 kWh|210kW|286ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],

    ["Seat", "Ibiza IV", "2017-2026", "1.0 MPI", "75ch|80ch", "Essence", "BVM5", "EA211|1.0 L"],
    ["Seat", "Ibiza IV", "2017-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM5|DSG", "EA211|1.0 L"],
    ["Seat", "Ibiza IV", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Ibiza IV", "2017-2026", "FR 2.0 TSI", "190ch", "Essence", "DSG", "EA888|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "1.0 TSI", "110ch", "Essence", "DSG", "EA211|1.0 L"],
    ["Seat", "Leon IV", "2020-2026", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Leon IV", "2020-2026", "2.0 TSI", "190ch|310ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG", "EA288|2.0 L"],
    ["Seat", "Leon IV", "2020-2026", "e-HYBRID", "204ch|245ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],
    ["Seat", "Ateca", "2016-2026", "1.0 TSI", "110ch|150ch", "Essence", "DSG", "EA211|1.0 L|1.5 L"],
    ["Seat", "Ateca", "2016-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Ateca", "2016-2026", "2.0 TSI", "190ch", "Essence", "DSG 4Drive", "EA888|2.0 L"],
    ["Seat", "Ateca", "2016-2026", "2.0 TDI", "150ch|190ch", "Diesel", "DSG|4Drive", "EA288|2.0 L"],
    ["Seat", "Arona", "2017-2026", "1.0 TSI", "95ch|110ch|115ch", "Essence", "DSG", "EA211|1.0 L"],
    ["Seat", "Arona", "2017-2026", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Arona", "2017-2026", "2.0 TDI", "115ch|150ch", "Diesel", "DSG", "EA288|2.0 L"],
    ["Seat", "Born", "2021-2026", "Pure", "150ch|170ch", "Électrique", "réducteur", "MEB|54 kWh|58 kWh"],
    ["Seat", "Born", "2021-2026", "Elite", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Seat", "Born", "2021-2026", "vZ", "231ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Seat", "Tavascan", "2024-2026", "Endurance", "210ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Seat", "Tavascan", "2024-2026", "vZ", "340ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],

    ["Cupra", "Leon", "2021-2026", "2.0 TSI", "310ch", "Essence", "DSG 4Drive", "EA888|2.0 L"],
    ["Cupra", "Leon", "2021-2026", "e-HYBRID", "340ch", "Hybride rechargeable", "DSG 4Drive", "PHEV|1.5 L"],
    ["Cupra", "Ateca", "2018-2026", "2.0 TSI", "300ch", "Essence", "DSG 4Drive", "EA888|2.0 L"],
    ["Cupra", "Formentor", "2020-2026", "2.0 TSI", "310ch", "Essence", "DSG 4Drive", "EA888|2.0 L"],
    ["Cupra", "Formentor", "2020-2026", "e-HYBRID", "245ch|340ch", "Hybride rechargeable", "DSG 4Drive", "PHEV|1.5 L"],
    ["Cupra", "Formentor", "2024-2026", "VZ", "333ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],
    ["Cupra", "Born", "2021-2026", "Pure", "150ch|170ch", "Électrique", "réducteur", "MEB|54 kWh|58 kWh"],
    ["Cupra", "Born", "2021-2026", "Elite", "204ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Cupra", "Born", "2021-2026", "vZ", "231ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Cupra", "Tavascan", "2024-2026", "Endurance", "210ch", "Électrique", "réducteur", "MEB|77 kWh"],
    ["Cupra", "Tavascan", "2024-2026", "VZ", "340ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],

    ["BMW", "Serie 1", "2019-2026", "116i", "109ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1", "2019-2026", "118i", "136ch|156ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1", "2019-2026", "120i", "170ch|218ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["BMW", "Serie 1", "2019-2026", "125i", "245ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "Serie 1", "2019-2026", "116d", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["BMW", "Serie 1", "2019-2026", "118d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "Serie 1", "2019-2026", "120d", "163ch|190ch", "Diesel", "Steptronic|xDrive", "B47|2.0 L"],
    ["BMW", "Serie 3", "2019-2026", "320i", "170ch|184ch", "Essence", "BVM8|Steptronic", "B48|2.0 L"],
    ["BMW", "Serie 3", "2019-2026", "330i", "245ch|258ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "Serie 3", "2019-2026", "M340i", "374ch", "Essence", "Steptronic xDrive", "B58|3.0 L"],
    ["BMW", "Serie 3", "2019-2026", "318d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "Serie 3", "2019-2026", "320d", "163ch|190ch", "Diesel", "BVM6|Steptronic xDrive", "B47|2.0 L"],
    ["BMW", "Serie 3", "2019-2026", "330d", "286ch|292ch", "Diesel", "Steptronic xDrive", "B57|3.0 L"],
    ["BMW", "Serie 3", "2019-2026", "330e", "292ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|2.0 L"],
    ["BMW", "X1", "2015-2026", "sDrive18i", "136ch|170ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "X1", "2015-2026", "sDrive20i", "178ch|204ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["BMW", "X1", "2015-2026", "xDrive25i", "231ch|245ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "X1", "2015-2026", "sDrive16d", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["BMW", "X1", "2015-2026", "sDrive18d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "X1", "2015-2026", "sDrive20d", "190ch", "Diesel", "Steptronic|xDrive", "B47|2.0 L"],
    ["BMW", "X1", "2020-2026", "xDrive25e", "245ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|1.5 L"],
    ["BMW", "X3", "2018-2026", "xDrive20i", "184ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "X3", "2018-2026", "xDrive30i", "245ch|252ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "X3", "2018-2026", "M40i", "340ch|374ch", "Essence", "Steptronic xDrive", "B58|3.0 L"],
    ["BMW", "X3", "2018-2026", "xDrive20d", "190ch", "Diesel", "Steptronic xDrive", "B47|2.0 L"],
    ["BMW", "X3", "2018-2026", "xDrive30d", "286ch|292ch", "Diesel", "Steptronic xDrive", "B57|3.0 L"],
    ["BMW", "X3", "2019-2026", "xDrive30e", "292ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|2.0 L"],
    ["BMW", "X5", "2019-2026", "xDrive40i", "340ch", "Essence", "Steptronic xDrive", "B58|3.0 L"],
    ["BMW", "X5", "2019-2026", "xDrive50i", "462ch", "Essence", "Steptronic xDrive", "N63|4.4 L"],
    ["BMW", "X5", "2019-2026", "xDrive30d", "286ch", "Diesel", "Steptronic xDrive", "B57|3.0 L"],
    ["BMW", "X5", "2019-2026", "xDrive40d", "340ch", "Diesel", "Steptronic xDrive", "B57|3.0 L"],
    ["BMW", "X5", "2019-2026", "xDrive45e", "394ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|3.0 L"],
    ["BMW", "i4", "2021-2026", "eDrive35", "286ch", "Électrique", "RWD / réducteur", "BEV|70 kWh"],
    ["BMW", "i4", "2021-2026", "eDrive40", "340ch", "Électrique", "RWD / réducteur", "BEV|80 kWh"],
    ["BMW", "i4", "2021-2026", "M50", "544ch", "Électrique", "AWD / réducteur", "BEV|80 kWh"],
    ["BMW", "iX", "2021-2026", "xDrive40", "326ch", "Électrique", "AWD / réducteur", "BEV|76.6 kWh"],
    ["BMW", "iX", "2021-2026", "xDrive50", "523ch", "Électrique", "AWD / réducteur", "BEV|105.2 kWh"],
    ["BMW", "iX", "2021-2026", "M60", "619ch", "Électrique", "AWD / réducteur", "BEV|105.2 kWh"],
    ["BMW", "iX1", "2022-2026", "eDrive20", "184ch", "Électrique", "RWD / réducteur", "FAAR|64.7 kWh"],
    ["BMW", "iX1", "2022-2026", "eDrive30", "272ch", "Électrique", "RWD / réducteur", "FAAR|66.4 kWh"],
    ["BMW", "iX1", "2022-2026", "xDrive30", "313ch", "Électrique", "AWD / réducteur", "FAAR|66.4 kWh"],

    ["Mini", "Cooper", "2021-2026", "Cooper", "136ch|156ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["Mini", "Cooper", "2021-2026", "Cooper S", "178ch|204ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["Mini", "Cooper", "2021-2026", "John Cooper Works", "231ch|300ch", "Essence", "Steptronic 4x4", "B48|2.0 L"],
    ["Mini", "Cooper", "2021-2026", "Cooper SE", "224ch", "Hybride rechargeable", "Steptronic", "PHEV|1.5 L"],
    ["Mini", "Cooper", "2024-2026", "Cooper E", "184ch|218ch", "Électrique", "réducteur", "BEV|40.7 kWh|54.2 kWh"],
    ["Mini", "Countryman", "2017-2026", "Cooper", "136ch|156ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["Mini", "Countryman", "2017-2026", "Cooper S", "178ch|204ch", "Essence", "Steptronic|ALL4", "B48|2.0 L"],
    ["Mini", "Countryman", "2017-2026", "One D", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["Mini", "Countryman", "2017-2026", "Cooper SD", "190ch", "Diesel", "Steptronic ALL4", "B47|2.0 L"],
    ["Mini", "Countryman", "2017-2026", "Cooper SE ALL4", "224ch", "Hybride rechargeable", "Steptronic ALL4", "PHEV|1.5 L"],
    ["Mini", "Countryman", "2024-2026", "Countryman E", "313ch", "Électrique", "AWD / réducteur", "BEV|66.4 kWh"],

    ["Mercedes-Benz", "Classe A", "2018-2026", "A180", "120ch|136ch", "Essence", "7G-DCT", "M282|1.3 L"],
    ["Mercedes-Benz", "Classe A", "2018-2026", "A200", "163ch|190ch", "Essence", "7G-DCT|8G-DCT", "M282/M260|1.3 L|2.0 L"],
    ["Mercedes-Benz", "Classe A", "2018-2026", "A250", "224ch", "Essence", "8G-DCT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A", "2018-2026", "AMG A35", "306ch", "Essence", "AMG SPEEDSHIFT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A", "2018-2026", "A180d", "116ch", "Diesel", "7G-DCT", "OM654|1.5 L|2.0 L"],
    ["Mercedes-Benz", "Classe A", "2018-2026", "A200d", "150ch", "Diesel", "8G-DCT", "OM654|2.0 L"],
    ["Mercedes-Benz", "Classe A", "2020-2026", "A250e", "218ch", "Hybride rechargeable", "8G-DCT", "PHEV|1.3 L"],
    ["Mercedes-Benz", "Classe C", "2021-2026", "C180", "170ch", "Essence", "9G-Tronic", "M264|1.5 L"],
    ["Mercedes-Benz", "Classe C", "2021-2026", "C200", "204ch", "Essence", "9G-Tronic", "M264|1.5 L"],
    ["Mercedes-Benz", "Classe C", "2021-2026", "C300", "258ch", "Essence", "9G-Tronic 4MATIC", "M264|2.0 L"],
    ["Mercedes-Benz", "Classe C", "2021-2026", "C220d", "200ch", "Diesel", "9G-Tronic", "OM654|2.0 L"],
    ["Mercedes-Benz", "Classe C", "2021-2026", "C300de", "313ch", "Hybride rechargeable", "9G-Tronic 4MATIC", "PHEV|2.0 L"],
    ["Mercedes-Benz", "GLA", "2020-2026", "GLA180", "120ch|136ch", "Essence", "7G-DCT", "M282|1.3 L"],
    ["Mercedes-Benz", "GLA", "2020-2026", "GLA200", "163ch|190ch", "Essence", "7G-DCT|8G-DCT", "M282/M260|1.3 L|2.0 L"],
    ["Mercedes-Benz", "GLA", "2020-2026", "GLA250", "224ch", "Essence", "8G-DCT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "GLA", "2020-2026", "GLA200d", "150ch", "Diesel", "8G-DCT", "OM654|2.0 L"],
    ["Mercedes-Benz", "GLA", "2020-2026", "GLA250e", "218ch", "Hybride rechargeable", "8G-DCT", "PHEV|1.3 L"],
    ["Mercedes-Benz", "GLC", "2019-2026", "GLC200", "197ch", "Essence", "9G-Tronic", "M264|2.0 L"],
    ["Mercedes-Benz", "GLC", "2019-2026", "GLC300", "258ch", "Essence", "9G-Tronic 4MATIC", "M264|2.0 L"],
    ["Mercedes-Benz", "GLC", "2019-2026", "GLC220d", "197ch|200ch", "Diesel", "9G-Tronic|4MATIC", "OM654|2.0 L"],
    ["Mercedes-Benz", "GLC", "2019-2026", "GLC300d", "245ch|272ch", "Diesel", "9G-Tronic 4MATIC", "OM654|2.0 L"],
    ["Mercedes-Benz", "GLC", "2020-2026", "GLC300e", "313ch", "Hybride rechargeable", "9G-Tronic 4MATIC", "PHEV|2.0 L"],
    ["Mercedes-Benz", "GLC", "2024-2026", "GLC400e", "381ch", "Hybride rechargeable", "9G-Tronic 4MATIC", "PHEV|2.0 L"],
    ["Mercedes-Benz", "EQA", "2021-2026", "EQA 250", "190ch", "Électrique", "réducteur", "EVA|66.5 kWh"],
    ["Mercedes-Benz", "EQA", "2021-2026", "EQA 350 4MATIC", "292ch", "Électrique", "AWD / réducteur", "EVA|66.5 kWh"],
    ["Mercedes-Benz", "EQB", "2021-2026", "EQB 250", "190ch", "Électrique", "réducteur", "EVA|66.5 kWh"],
    ["Mercedes-Benz", "EQB", "2021-2026", "EQB 350 4MATIC", "292ch", "Électrique", "AWD / réducteur", "EVA|66.5 kWh"],
    ["Mercedes-Benz", "EQE", "2022-2026", "EQE 350", "292ch", "Électrique", "RWD / réducteur", "EVA|90.6 kWh"],
    ["Mercedes-Benz", "EQE", "2022-2026", "EQE 43 4MATIC", "476ch", "Électrique", "AWD / réducteur", "EVA|90.6 kWh"],
    ["Mercedes-Benz", "EQE", "2022-2026", "EQE 53 4MATIC+", "626ch", "Électrique", "AWD / réducteur", "EVA|90.6 kWh"],
    ["Mercedes-Benz", "EQS", "2021-2026", "EQS 450+", "333ch", "Électrique", "RWD / réducteur", "EVA|107.8 kWh"],
    ["Mercedes-Benz", "EQS", "2021-2026", "EQS 580 4MATIC", "544ch", "Électrique", "AWD / réducteur", "EVA|107.8 kWh"],
    ["Mercedes-Benz", "EQS", "2021-2026", "AMG EQS 53", "658ch|761ch", "Électrique", "AWD / réducteur", "EVA|107.8 kWh"],

    ["Volvo", "XC40", "2018-2026", "B3", "163ch", "Hybride léger 48V", "automatique", "B3|2.0 L"],
    ["Volvo", "XC40", "2018-2026", "B4", "197ch", "Hybride léger 48V", "automatique AWD", "B4|2.0 L"],
    ["Volvo", "XC40", "2018-2026", "T2", "130ch", "Essence", "automatique", "T2|1.5 L"],
    ["Volvo", "XC40", "2018-2026", "T3", "163ch", "Essence", "automatique", "T3|1.5 L"],
    ["Volvo", "XC40", "2018-2026", "T4", "197ch", "Essence", "automatique AWD", "T4|2.0 L"],
    ["Volvo", "XC40", "2018-2026", "T5", "249ch", "Essence", "automatique AWD", "T5|2.0 L"],
    ["Volvo", "XC40", "2019-2026", "Recharge T5", "262ch", "Hybride rechargeable", "automatique AWD", "PHEV|1.5 L"],
    ["Volvo", "XC40", "2019-2026", "Recharge T8", "390ch|405ch", "Hybride rechargeable", "automatique AWD", "PHEV|2.0 L"],
    ["Volvo", "XC40", "2021-2026", "Pure Electric", "231ch|408ch", "Électrique", "RWD/AWD / réducteur", "CMA-EV|69 kWh"],
    ["Volvo", "XC60", "2018-2026", "B4", "197ch", "Hybride léger 48V", "automatique", "B4|2.0 L"],
    ["Volvo", "XC60", "2018-2026", "B5", "250ch", "Hybride léger 48V", "automatique AWD", "B5|2.0 L"],
    ["Volvo", "XC60", "2018-2026", "T5", "250ch", "Essence", "automatique AWD", "T5|2.0 L"],
    ["Volvo", "XC60", "2018-2026", "T6", "300ch", "Essence", "automatique AWD", "T6|2.0 L"],
    ["Volvo", "XC60", "2019-2026", "Recharge T6", "340ch", "Hybride rechargeable", "automatique AWD", "PHEV|2.0 L"],
    ["Volvo", "XC60", "2019-2026", "Recharge T8", "455ch", "Hybride rechargeable", "automatique AWD", "PHEV|2.0 L"],
    ["Volvo", "EX30", "2024-2026", "Single Motor", "272ch", "Électrique", "RWD / réducteur", "SEA|51 kWh|69 kWh"],
    ["Volvo", "EX30", "2024-2026", "Twin Motor", "428ch", "Électrique", "AWD / réducteur", "SEA|69 kWh"],

    ["Porsche", "Macan", "2014-2026", "Macan", "252ch|265ch", "Essence", "PDK", "V6|2.0 L|3.0 L"],
    ["Porsche", "Macan", "2014-2026", "Macan S", "354ch|380ch", "Essence", "PDK", "V6|3.0 L"],
    ["Porsche", "Macan", "2014-2026", "Macan GTS", "440ch", "Essence", "PDK", "V6|2.9 L"],
    ["Porsche", "Macan", "2014-2026", "Macan Turbo", "400ch|440ch", "Essence", "PDK", "V6|2.9 L"],
    ["Porsche", "Macan", "2024-2026", "Macan Electric", "340ch|639ch", "Électrique", "RWD/AWD / réducteur", "PPE|95 kWh"],
    ["Porsche", "Cayenne", "2018-2026", "Cayenne", "340ch", "Essence", "Tiptronic", "V6|3.0 L"],
    ["Porsche", "Cayenne", "2018-2026", "Cayenne S", "440ch|474ch", "Essence", "Tiptronic", "V6|4.0 L"],
    ["Porsche", "Cayenne", "2018-2026", "Cayenne Turbo", "550ch|649ch", "Essence", "Tiptronic", "V8|4.0 L"],
    ["Porsche", "Cayenne", "2018-2026", "Cayenne E-Hybrid", "462ch", "Hybride rechargeable", "Tiptronic", "PHEV|3.0 L"],
    ["Porsche", "Cayenne", "2023-2026", "Cayenne Turbo E-Hybrid", "739ch", "Hybride rechargeable", "Tiptronic", "PHEV|4.0 L"],
    ["Porsche", "Taycan", "2020-2026", "Taycan", "326ch|408ch", "Électrique", "AWD / réducteur", "J1|79.2 kWh|93.4 kWh"],
    ["Porsche", "Taycan", "2020-2026", "4S", "530ch|571ch", "Électrique", "AWD / réducteur", "J1|79.2 kWh|93.4 kWh"],
    ["Porsche", "Taycan", "2020-2026", "Turbo", "680ch|761ch", "Électrique", "AWD / réducteur", "J1|93.4 kWh"],
    ["Porsche", "Taycan", "2020-2026", "Turbo S", "761ch|800ch", "Électrique", "AWD / réducteur", "J1|93.4 kWh"],

    ["Land Rover", "Defender", "2020-2026", "D200", "200ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Defender", "2020-2026", "D240", "240ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Defender", "2020-2026", "D300", "300ch", "Diesel", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Defender", "2020-2026", "P300", "300ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Defender", "2020-2026", "P400", "400ch", "Essence", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Defender", "2020-2026", "P525", "525ch", "Essence", "automatique 4x4", "V8|5.0 L"],
    ["Land Rover", "Defender", "2020-2026", "PHEV P400e", "404ch", "Hybride rechargeable", "automatique 4x4", "PHEV|2.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "D250", "249ch", "Diesel", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "D300", "299ch", "Diesel", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "P360", "360ch", "Essence", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "P400", "400ch", "Essence", "automatique 4x4", "Ingenium|3.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "P510e", "510ch", "Hybride rechargeable", "automatique 4x4", "PHEV|3.0 L"],
    ["Land Rover", "Range Rover", "2022-2026", "SV P615e", "615ch", "Hybride rechargeable", "automatique 4x4", "PHEV|4.4 L"],
    ["Land Rover", "Range Rover Evoque", "2019-2026", "D150", "150ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Range Rover Evoque", "2019-2026", "D180", "180ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Range Rover Evoque", "2019-2026", "P200", "200ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Range Rover Evoque", "2019-2026", "P250", "249ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Range Rover Evoque", "2019-2026", "P300e", "309ch", "Hybride rechargeable", "automatique 4x4", "PHEV|1.5 L"],
    ["Land Rover", "Discovery Sport", "2020-2026", "D165", "163ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Discovery Sport", "2020-2026", "D180", "180ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Discovery Sport", "2020-2026", "P200", "200ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Discovery Sport", "2020-2026", "P250", "249ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Land Rover", "Discovery Sport", "2020-2026", "P300e", "309ch", "Hybride rechargeable", "automatique 4x4", "PHEV|1.5 L"],

    ["Jaguar", "I-Pace", "2018-2026", "S", "400ch", "Électrique", "AWD / réducteur", "BEV|90 kWh"],
    ["Jaguar", "I-Pace", "2018-2026", "SE", "400ch", "Électrique", "AWD / réducteur", "BEV|90 kWh"],
    ["Jaguar", "I-Pace", "2018-2026", "HSE", "400ch", "Électrique", "AWD / réducteur", "BEV|90 kWh"],
    ["Jaguar", "F-Pace", "2016-2026", "D165", "163ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Jaguar", "F-Pace", "2016-2026", "D200", "204ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Jaguar", "F-Pace", "2016-2026", "D250", "249ch", "Diesel", "automatique 4x4", "Ingenium|2.0 L"],
    ["Jaguar", "F-Pace", "2016-2026", "D300", "299ch", "Diesel", "automatique 4x4", "Ingenium|3.0 L"],
    ["Jaguar", "F-Pace", "2016-2026", "P250", "247ch", "Essence", "automatique 4x4", "Ingenium|2.0 L"],
    ["Jaguar", "F-Pace", "2016-2026", "P340", "340ch", "Essence", "automatique 4x4", "Ingenium|3.0 L"],
    ["Jaguar", "F-Pace", "2018-2026", "P400e", "404ch", "Hybride rechargeable", "automatique 4x4", "PHEV|2.0 L"],

    ["Opel", "Corsa F", "2019-2026", "1.2", "75ch|100ch|130ch", "Essence", "BVM5|BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Corsa F", "2019-2026", "1.2 Turbo", "100ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Corsa F", "2019-2026", "1.5 Diesel", "100ch|130ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Opel", "Corsa F", "2019-2026", "Corsa Electric", "136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Opel", "Astra", "2021-2026", "1.2 Turbo", "110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Astra", "2021-2026", "1.2 Turbo Hybrid", "130ch", "Hybride léger 48V", "EAT8", "EB2|1.2 L"],
    ["Opel", "Astra", "2021-2026", "1.5 Diesel", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Opel", "Astra", "2021-2026", "Hybrid", "180ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Opel", "Astra", "2021-2026", "Hybrid4", "225ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Opel", "Mokka", "2020-2026", "1.2 Turbo", "100ch|130ch|145ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Mokka", "2020-2026", "1.5 Diesel", "110ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Opel", "Mokka", "2020-2026", "Mokka Electric", "136ch", "Électrique", "réducteur", "eCMP|50 kWh"],
    ["Opel", "Grandland", "2022-2026", "1.2 Turbo", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Opel", "Grandland", "2022-2026", "1.6 Turbo", "180ch|225ch", "Essence", "EAT8", "EP6F|1.6 L"],
    ["Opel", "Grandland", "2022-2026", "Hybrid4", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Opel", "Grandland", "2024-2026", "Electric", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Fiat", "500", "2007-2026", "1.0 Hybrid", "70ch", "Hybride léger 48V", "automatique", "Firefly|1.0 L"],
    ["Fiat", "500", "2007-2026", "1.2", "69ch", "Essence", "BVM5", "188|1.2 L"],
    ["Fiat", "500", "2007-2026", "0.9 TwinAir", "85ch|105ch", "Essence", "BVM5", "TwinAir|0.9 L"],
    ["Fiat", "500", "2007-2026", "1.4", "95ch", "Essence", "BVM5", "134|1.4 L"],
    ["Fiat", "500", "2007-2026", "1.3 MultiJet", "95ch", "Diesel", "BVM5", "MultiJet|1.3 L"],
    ["Fiat", "500e", "2020-2026", "42 kWh", "87kW|118ch", "Électrique", "réducteur", "500e|42 kWh"],
    ["Fiat", "500e", "2020-2026", "24 kWh", "63kW|87ch", "Électrique", "réducteur", "500e|23.8 kWh"],
    ["Fiat", "Panda", "2012-2026", "1.0 Hybrid", "70ch", "Hybride léger 48V", "automatique", "Firefly|1.0 L"],
    ["Fiat", "Panda", "2012-2026", "0.9 TwinAir", "85ch|105ch", "Essence", "BVM5", "TwinAir|0.9 L"],
    ["Fiat", "Panda", "2012-2026", "1.2", "69ch", "Essence", "BVM5", "188|1.2 L"],
    ["Fiat", "Panda", "2012-2026", "1.3 MultiJet", "95ch", "Diesel", "BVM5", "MultiJet|1.3 L"],
    ["Fiat", "Tipo", "2016-2026", "1.0 Hybrid", "100ch", "Hybride léger 48V", "BVM6", "Firefly|1.0 L"],
    ["Fiat", "Tipo", "2016-2026", "1.4", "95ch", "Essence", "BVM5", "134|1.4 L"],
    ["Fiat", "Tipo", "2016-2026", "1.6 E-Torq", "110ch", "Essence", "BVM6", "E-Torq|1.6 L"],
    ["Fiat", "Tipo", "2016-2026", "1.3 MultiJet", "95ch", "Diesel", "BVM5", "MultiJet|1.3 L"],
    ["Fiat", "Tipo", "2016-2026", "1.6 MultiJet", "120ch|130ch", "Diesel", "BVM6", "MultiJet|1.6 L"],
    ["Fiat", "Tonale", "2022-2026", "1.5 Hybrid", "130ch", "Hybride léger 48V", "automatique", "Firefly|1.5 L"],
    ["Fiat", "Tonale", "2022-2026", "1.3 Plug-in Hybrid", "190ch", "Hybride rechargeable", "automatique", "PHEV|1.3 L"],
    ["Fiat", "Tonale", "2022-2026", "1.3 Plug-in Hybrid", "280ch", "Hybride rechargeable", "automatique 4x4", "PHEV4|1.3 L"],

    ["Alfa Romeo", "Giulia", "2016-2026", "2.0 Turbo", "200ch|280ch", "Essence", "automatique", "2.0 Turbo|2.0 L"],
    ["Alfa Romeo", "Giulia", "2016-2026", "2.2 Diesel", "160ch|210ch", "Diesel", "automatique", "2.2 JTDM|2.2 L"],
    ["Alfa Romeo", "Giulia", "2016-2026", "Quadrifoglio", "510ch", "Essence", "automatique", "2.9 V6|2.9 L"],
    ["Alfa Romeo", "Stelvio", "2017-2026", "2.0 Turbo", "200ch|280ch", "Essence", "automatique Q4", "2.0 Turbo|2.0 L"],
    ["Alfa Romeo", "Stelvio", "2017-2026", "2.2 Diesel", "160ch|210ch", "Diesel", "automatique Q4", "2.2 JTDM|2.2 L"],
    ["Alfa Romeo", "Stelvio", "2017-2026", "Quadrifoglio", "510ch", "Essence", "automatique Q4", "2.9 V6|2.9 L"],
    ["Alfa Romeo", "Tonale", "2022-2026", "1.5 Hybrid", "130ch", "Hybride léger 48V", "automatique", "Firefly|1.5 L"],
    ["Alfa Romeo", "Tonale", "2022-2026", "1.3 Plug-in Hybrid", "190ch", "Hybride rechargeable", "automatique", "PHEV|1.3 L"],
    ["Alfa Romeo", "Tonale", "2022-2026", "1.3 Plug-in Hybrid", "280ch", "Hybride rechargeable", "automatique Q4", "PHEV4|1.3 L"],

    // --- ASIE ---
    ["Toyota", "Yaris", "2020-2026", "1.0", "72ch", "Essence", "BVM5", "1KR-FE|1.0 L"],
    ["Toyota", "Yaris", "2020-2026", "1.5 Hybrid", "116ch|130ch", "Hybride", "e-CVT", "THS II|1.5 L"],
    ["Toyota", "Yaris", "2020-2026", "GR Yaris", "261ch|280ch", "Essence", "BVM6 4x4", "G16E-GTS|1.6 L"],
    ["Toyota", "Corolla", "2019-2026", "1.8 Hybrid", "122ch|140ch", "Hybride", "e-CVT", "THS II|1.8 L"],
    ["Toyota", "Corolla", "2019-2026", "2.0 Hybrid", "184ch|196ch", "Hybride", "e-CVT", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla", "2019-2026", "2.0", "169ch|197ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla", "2019-2026", "1.8 Plug-in Hybrid", "196ch", "Hybride rechargeable", "e-CVT", "PHEV|1.8 L"],
    ["Toyota", "RAV4", "2018-2026", "2.0", "171ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "RAV4", "2018-2026", "2.5 Hybrid", "218ch|222ch", "Hybride", "e-CVT AWD-i", "THS II|2.5 L"],
    ["Toyota", "RAV4", "2020-2026", "2.5 Plug-in Hybrid", "306ch|320ch", "Hybride rechargeable", "e-CVT AWD-i", "PHEV|2.5 L"],
    ["Toyota", "RAV4", "2018-2026", "2.5 D-4D", "150ch|200ch", "Diesel", "BVM6|Direct Shift 4x4", "GD|2.5 L"],
    ["Toyota", "C-HR", "2018-2026", "1.2 Turbo", "116ch", "Essence", "BVM6|CVT", "8NR-FTS|1.2 L"],
    ["Toyota", "C-HR", "2018-2026", "1.8 Hybrid", "122ch|140ch", "Hybride", "e-CVT", "THS II|1.8 L"],
    ["Toyota", "C-HR", "2023-2026", "2.0 Hybrid", "184ch|197ch", "Hybride", "e-CVT AWD-i", "Dynamic Force|2.0 L"],
    ["Toyota", "Prius", "2016-2026", "1.8 Hybrid", "122ch|136ch", "Hybride", "e-CVT", "THS II|1.8 L"],
    ["Toyota", "Prius", "2022-2026", "2.0 Hybrid", "197ch", "Hybride", "e-CVT", "Dynamic Force|2.0 L"],
    ["Toyota", "Prius", "2023-2026", "2.0 Plug-in Hybrid", "223ch", "Hybride rechargeable", "e-CVT", "PHEV|2.0 L"],

    ["Lexus", "UX", "2018-2026", "200", "146ch|176ch", "Hybride", "e-CVT", "THS II|2.0 L"],
    ["Lexus", "UX", "2018-2026", "250h", "178ch|197ch", "Hybride", "e-CVT AWD", "Dynamic Force|2.0 L"],
    ["Lexus", "UX", "2020-2026", "300e", "204ch", "Électrique", "AWD / réducteur", "BEV|54.3 kWh"],
    ["Lexus", "NX", "2022-2026", "350h", "240ch|244ch", "Hybride", "e-CVT AWD", "THS II|2.5 L"],
    ["Lexus", "NX", "2022-2026", "450h+", "309ch", "Hybride rechargeable", "e-CVT AWD", "PHEV|2.5 L"],
    ["Lexus", "NX", "2022-2026", "350", "275ch", "Essence", "automatique AWD", "T24A|2.4 L"],
    ["Lexus", "RX", "2023-2026", "350h", "246ch|250ch", "Hybride", "e-CVT AWD", "THS V|2.5 L"],
    ["Lexus", "RX", "2023-2026", "500h", "371ch", "Hybride", "automatique AWD", "Multi Stage|2.4 L"],
    ["Lexus", "RX", "2023-2026", "450h+", "309ch", "Hybride rechargeable", "e-CVT AWD", "PHEV|2.5 L"],

    ["Honda", "Jazz", "2020-2026", "1.5 i-MMD", "109ch", "Hybride", "e-CVT", "i-MMD|1.5 L"],
    ["Honda", "Jazz", "2020-2026", "1.5", "130ch", "Essence", "BVM6|CVT", "L15|1.5 L"],
    ["Honda", "CR-V", "2018-2026", "1.5 Turbo", "190ch", "Essence", "CVT 4x4", "L15B|1.5 L"],
    ["Honda", "CR-V", "2023-2026", "2.0 e:HEV", "184ch|207ch", "Hybride", "e-CVT AWD", "e:HEV|2.0 L"],
    ["Honda", "CR-V", "2023-2026", "2.0 e:PHEV", "207ch", "Hybride rechargeable", "e-CVT AWD", "e:PHEV|2.0 L"],
    ["Honda", "e:Ny1", "2023-2026", "e:Ny1", "204ch", "Électrique", "réducteur", "BEV|68.8 kWh"],

    ["Nissan", "Qashqai", "2021-2026", "1.3 DIG-T", "140ch|158ch|160ch", "Essence", "BVM6|Xtronic 4x4", "HR13|1.3 L"],
    ["Nissan", "Qashqai", "2022-2026", "1.5 e-POWER", "190ch|204ch", "Hybride", "automatique", "e-POWER|1.5 L"],
    ["Nissan", "Qashqai", "2021-2026", "1.5 dCi", "115ch|150ch", "Diesel", "BVM6|Xtronic 4x4", "K9K|1.5 L"],
    ["Nissan", "X-Trail", "2022-2026", "1.5 e-POWER", "204ch", "Hybride", "automatique 4x4", "e-POWER|1.5 L"],
    ["Nissan", "X-Trail", "2022-2026", "1.3 DIG-T", "160ch", "Essence", "Xtronic 4x4", "HR13|1.3 L"],
    ["Nissan", "Ariya", "2022-2026", "Single Motor", "214ch|302ch", "Électrique", "RWD / réducteur", "CMF-EV|64 kWh|87 kWh"],
    ["Nissan", "Ariya", "2022-2026", "Dual Motor e-4ORCE", "302ch|394ch", "Électrique", "AWD / réducteur", "CMF-EV|64 kWh|87 kWh"],
    ["Nissan", "Leaf", "2017-2026", "40 kWh", "150ch", "Électrique", "réducteur", "ZE1|40 kWh"],
    ["Nissan", "Leaf", "2017-2026", "62 kWh e+", "217ch", "Électrique", "réducteur", "ZE1|62 kWh"],

    ["Mazda", "3", "2019-2026", "1.5 Skyactiv-G", "122ch", "Essence", "BVM6|SKYACTIV-Drive", "Skyactiv-G|1.5 L"],
    ["Mazda", "3", "2019-2026", "2.0 Skyactiv-G", "165ch", "Essence", "BVM6|SKYACTIV-Drive", "Skyactiv-G|2.0 L"],
    ["Mazda", "3", "2019-2026", "1.5 Skyactiv-X", "150ch|186ch", "Essence", "BVM6|SKYACTIV-Drive", "Skyactiv-X|1.5 L"],
    ["Mazda", "3", "2019-2026", "1.8 Skyactiv-D", "116ch|122ch", "Diesel", "BVM6|SKYACTIV-Drive", "Skyactiv-D|1.8 L"],
    ["Mazda", "CX-5", "2017-2026", "2.0 Skyactiv-G", "165ch", "Essence", "BVM6|SKYACTIV-Drive 4x4", "Skyactiv-G|2.0 L"],
    ["Mazda", "CX-5", "2017-2026", "2.5 Skyactiv-G", "194ch", "Essence", "SKYACTIV-Drive 4x4", "Skyactiv-G|2.5 L"],
    ["Mazda", "CX-5", "2017-2026", "1.8 Skyactiv-D", "120ch|145ch", "Diesel", "BVM6|SKYACTIV-Drive 4x4", "Skyactiv-D|1.8 L"],
    ["Mazda", "CX-5", "2017-2026", "2.2 Skyactiv-D", "150ch|184ch", "Diesel", "SKYACTIV-Drive 4x4", "Skyactiv-D|2.2 L"],
    ["Mazda", "MX-30", "2020-2026", "e-Skyactiv EV", "145ch", "Électrique", "réducteur", "BEV|35.5 kWh"],
    ["Mazda", "MX-30", "2022-2026", "e-Skyactiv R-EV", "170ch", "Hybride rechargeable", "automatique", "REEV|17 kWh|50 km EV"],

    ["Subaru", "XV", "2017-2026", "1.6 i", "115ch", "Essence", "CVT 4x4", "FB|1.6 L"],
    ["Subaru", "XV", "2017-2026", "2.0 i", "150ch|156ch", "Essence", "CVT 4x4", "FB|2.0 L"],
    ["Subaru", "XV", "2019-2026", "2.0 e-BOXER", "150ch", "Hybride léger 48V", "CVT 4x4", "e-BOXER|2.0 L"],
    ["Subaru", "Forester", "2018-2026", "2.0 i", "150ch|156ch", "Essence", "CVT 4x4", "FB|2.0 L"],
    ["Subaru", "Forester", "2018-2026", "2.0 e-BOXER", "150ch", "Hybride léger 48V", "CVT 4x4", "e-BOXER|2.0 L"],
    ["Subaru", "Forester", "2018-2026", "2.0D", "147ch|163ch", "Diesel", "CVT 4x4", "EE20|2.0 L"],

    ["Suzuki", "Swift", "2017-2026", "1.2 Dualjet", "83ch|90ch", "Essence", "BVM5|AGS", "Dualjet|1.2 L"],
    ["Suzuki", "Swift", "2017-2026", "1.0 Boosterjet", "112ch|136ch", "Essence", "BVM6|AGS", "Boosterjet|1.0 L"],
    ["Suzuki", "Swift", "2021-2026", "1.2 Hybrid", "82ch|94ch", "Hybride léger 48V", "BVM5|AGS", "Smart Hybrid|1.2 L"],
    ["Suzuki", "Vitara", "2015-2026", "1.4 Boosterjet", "150ch", "Essence", "BVM6|Auto 4x4", "Boosterjet|1.4 L"],
    ["Suzuki", "Vitara", "2015-2026", "1.6 DDiS", "120ch", "Diesel", "BVM6|Auto 4x4", "DDiS|1.6 L"],
    ["Suzuki", "Vitara", "2021-2026", "1.4 Hybrid AllGrip", "129ch", "Hybride léger 48V", "Auto 4x4", "Smart Hybrid|1.4 L"],
    ["Suzuki", "S-Cross", "2022-2026", "1.4 Boosterjet", "129ch", "Essence", "BVM6|Auto 4x4", "Boosterjet|1.4 L"],
    ["Suzuki", "S-Cross", "2022-2026", "1.5 DDiS", "105ch", "Diesel", "BVM6", "DDiS|1.5 L"],
    ["Suzuki", "S-Cross", "2024-2026", "1.5 Full Hybrid", "116ch", "Hybride", "automatique", "HEV|1.5 L"],

    ["Mitsubishi", "ASX", "2023-2026", "1.5 MIVEC", "106ch", "Essence", "CVT", "MIVEC|1.5 L"],
    ["Mitsubishi", "ASX", "2023-2026", "PHEV", "218ch", "Hybride rechargeable", "automatique 4x4", "PHEV|11.5 kWh"],
    ["Mitsubishi", "Outlander", "2021-2026", "2.0 MIVEC", "167ch", "Essence", "CVT 4x4", "MIVEC|2.0 L"],
    ["Mitsubishi", "Outlander", "2021-2026", "PHEV", "224ch|309ch", "Hybride rechargeable", "automatique 4x4", "PHEV|20 kWh|22.7 kWh"],

    ["Hyundai", "Tucson", "2021-2026", "1.6 TGDI", "150ch|177ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson", "2021-2026", "1.6 TGDI 48V", "150ch|177ch", "Hybride léger 48V", "DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson", "2021-2026", "1.6 CRDi 48V", "115ch|136ch", "Diesel", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson", "2021-2026", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Hyundai", "Tucson", "2021-2026", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Hyundai", "Kona", "2018-2026", "1.0 T-GDI", "120ch", "Essence", "DCT", "Smartstream|1.0 L"],
    ["Hyundai", "Kona", "2018-2026", "1.6 T-GDI", "198ch", "Essence", "DCT 4x4", "Smartstream|1.6 L"],
    ["Hyundai", "Kona", "2018-2026", "1.6 CRDi", "115ch|136ch", "Diesel", "DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Kona", "2018-2026", "Electric", "136ch|204ch|218ch", "Électrique", "RWD/AWD / réducteur", "BEV|39 kWh|64 kWh"],
    ["Hyundai", "IONIQ 5", "2021-2026", "Light", "170ch", "Électrique", "RWD / réducteur", "E-GMP|53 kWh"],
    ["Hyundai", "IONIQ 5", "2021-2026", "Long Range", "228ch", "Électrique", "RWD / réducteur", "E-GMP|72.6 kWh"],
    ["Hyundai", "IONIQ 5", "2021-2026", "AWD", "306ch|325ch", "Électrique", "AWD / réducteur", "E-GMP|72.6 kWh"],
    ["Hyundai", "IONIQ 5", "2021-2026", "N", "650ch", "Électrique", "AWD / réducteur", "E-GMP|84 kWh"],
    ["Hyundai", "IONIQ 6", "2022-2026", "Standard", "151ch", "Électrique", "RWD / réducteur", "E-GMP|53 kWh"],
    ["Hyundai", "IONIQ 6", "2022-2026", "Long Range", "228ch", "Électrique", "RWD / réducteur", "E-GMP|77.4 kWh"],
    ["Hyundai", "IONIQ 6", "2022-2026", "AWD", "325ch", "Électrique", "AWD / réducteur", "E-GMP|77.4 kWh"],

    ["Kia", "Ceed", "2018-2026", "1.0 T-GDI", "120ch", "Essence", "BVM6|DCT", "Smartstream|1.0 L"],
    ["Kia", "Ceed", "2018-2026", "1.4 T-GDI", "140ch", "Essence", "DCT", "Smartstream|1.4 L"],
    ["Kia", "Ceed", "2018-2026", "1.5 T-GDI", "160ch", "Essence", "IVT", "Smartstream|1.5 L"],
    ["Kia", "Ceed", "2018-2026", "1.6 CRDi", "115ch|136ch", "Diesel", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Kia", "Ceed", "2022-2026", "1.6 Hybrid", "140ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Kia", "Ceed", "2022-2026", "1.6 Plug-in Hybrid", "171ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Kia", "Sportage", "2022-2026", "1.6 TGDI", "150ch|180ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Kia", "Sportage", "2022-2026", "1.6 CRDi", "136ch", "Diesel", "BVM6|DCT 4x4", "Smartstream|1.6 L"],
    ["Kia", "Sportage", "2022-2026", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Kia", "Sportage", "2022-2026", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique 4x4", "PHEV|1.6 L"],
    ["Kia", "Niro", "2022-2026", "1.6 Hybrid", "140ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Kia", "Niro", "2022-2026", "1.6 Plug-in Hybrid", "183ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],
    ["Kia", "Niro", "2022-2026", "Electric", "204ch", "Électrique", "réducteur", "BEV|64.8 kWh"],
    ["Kia", "EV6", "2021-2026", "Light", "151ch", "Électrique", "RWD / réducteur", "E-GMP|52.5 kWh"],
    ["Kia", "EV6", "2021-2026", "Standard", "151ch|228ch", "Électrique", "RWD / réducteur", "E-GMP|52.5 kWh|77.4 kWh"],
    ["Kia", "EV6", "2021-2026", "Long Range", "228ch|325ch", "Électrique", "RWD/AWD / réducteur", "E-GMP|77.4 kWh"],
    ["Kia", "EV6", "2021-2026", "GT", "430ch|585ch", "Électrique", "AWD / réducteur", "E-GMP|77.4 kWh"],
    ["Kia", "EV9", "2024-2026", "Long Range", "204ch", "Électrique", "RWD / réducteur", "E-GMP|99.8 kWh"],
    ["Kia", "EV9", "2024-2026", "AWD", "385ch|400ch", "Électrique", "AWD / réducteur", "E-GMP|99.8 kWh"],

    ["MG", "MG4", "2022-2026", "Standard Range", "170ch", "Électrique", "RWD / réducteur", "BEV|51 kWh"],
    ["MG", "MG4", "2022-2026", "Long Range", "170ch|204ch", "Électrique", "RWD / réducteur", "BEV|64 kWh"],
    ["MG", "MG4", "2022-2026", "XPOWER", "435ch", "Électrique", "AWD / réducteur", "BEV|64 kWh"],
    ["MG", "MG ZS EV", "2019-2026", "ZS EV", "143ch|177ch", "Électrique", "réducteur", "BEV|44.5 kWh|50.3 kWh"],
    ["MG", "MG5", "2021-2026", "1.5 Turbo", "169ch", "Essence", "BVM6|CVT", "SAIC|1.5 L"],
    ["MG", "MG5", "2022-2026", "MG5 Electric", "156ch|170ch", "Électrique", "réducteur", "BEV|51 kWh|61.7 kWh"],
    ["MG", "Marvel R", "2021-2026", "Standard Range", "180ch", "Électrique", "RWD / réducteur", "BEV|70 kWh"],
    ["MG", "Marvel R", "2021-2026", "Long Range AWD", "288ch", "Électrique", "AWD / réducteur", "BEV|70 kWh"],

    ["BYD", "Atto 3", "2022-2026", "Comfort", "204ch", "Électrique", "réducteur", "Blade Battery|60.5 kWh"],
    ["BYD", "Atto 3", "2022-2026", "Design", "204ch", "Électrique", "réducteur", "Blade Battery|60.5 kWh"],
    ["BYD", "Dolphin", "2023-2026", "Comfort", "95ch|177ch", "Électrique", "réducteur", "Blade Battery|44.9 kWh|60.4 kWh"],
    ["BYD", "Dolphin", "2023-2026", "Design", "204ch", "Électrique", "réducteur", "Blade Battery|60.4 kWh"],
    ["BYD", "Seal", "2023-2026", "Comfort", "204ch", "Électrique", "RWD / réducteur", "Blade Battery|61.4 kWh"],
    ["BYD", "Seal", "2023-2026", "Design", "313ch", "Électrique", "RWD / réducteur", "Blade Battery|82.5 kWh"],
    ["BYD", "Seal", "2023-2026", "AWD Performance", "530ch", "Électrique", "AWD / réducteur", "Blade Battery|82.5 kWh"],

    // --- AMÉRIQUE ---
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

    ["Jeep", "Renegade", "2014-2026", "1.0 T3", "120ch", "Essence", "BVM6|DDCT", "Firefly|1.0 L"],
    ["Jeep", "Renegade", "2014-2026", "1.3 T4", "150ch", "Essence", "DDCT|4x4", "Hurricane|1.3 L"],
    ["Jeep", "Renegade", "2014-2026", "1.6 MultiJet", "120ch|130ch", "Diesel", "BVM6|DDCT", "MultiJet|1.6 L"],
    ["Jeep", "Renegade", "2014-2026", "2.0 MultiJet 4x4", "140ch|170ch", "Diesel", "BVM9 4x4", "MultiJet|2.0 L"],
    ["Jeep", "Compass", "2017-2026", "1.3 T4", "130ch|150ch|175ch", "Essence", "DDCT|4x4", "Hurricane|1.3 L"],
    ["Jeep", "Compass", "2017-2026", "1.6 MultiJet", "120ch|130ch", "Diesel", "BVM6|DDCT", "MultiJet|1.6 L"],
    ["Jeep", "Compass", "2017-2026", "2.0 MultiJet 4x4", "140ch|170ch", "Diesel", "BVM9 4x4", "MultiJet|2.0 L"],
    ["Jeep", "Compass", "2021-2026", "4xe", "240ch", "Hybride rechargeable", "automatique 4x4", "PHEV4xe|1.3 L"],
    ["Jeep", "Grand Cherokee", "2021-2026", "3.6 V6", "286ch", "Essence", "automatique 4x4", "Pentastar|3.6 L"],
    ["Jeep", "Grand Cherokee", "2021-2026", "2.0 Turbo", "270ch", "Essence", "automatique 4x4", "Hurricane|2.0 L"],
    ["Jeep", "Grand Cherokee", "2021-2026", "4xe", "381ch", "Hybride rechargeable", "automatique 4x4", "PHEV4xe|2.0 L"],

    ["Ford", "Fiesta", "2017-2023", "1.0 EcoBoost", "100ch|125ch|140ch|155ch", "Essence", "BVM5|BVM6|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Fiesta", "2017-2023", "1.1", "70ch|85ch|100ch", "Essence", "BVM5", "Ti-VCT|1.1 L"],
    ["Ford", "Fiesta", "2017-2023", "1.5 EcoBoost ST", "200ch", "Essence", "BVM6", "EcoBoost|1.5 L"],
    ["Ford", "Fiesta", "2017-2023", "1.5 TDCi", "95ch|120ch", "Diesel", "BVM5|BVM6", "TDCi|1.5 L"],
    ["Ford", "Focus", "2018-2025", "1.0 EcoBoost", "100ch|125ch|155ch", "Essence", "BVM6|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Focus", "2018-2025", "1.5 EcoBoost", "150ch|182ch", "Essence", "BVM6|PowerShift", "EcoBoost|1.5 L"],
    ["Ford", "Focus", "2018-2025", "2.3 EcoBoost ST", "280ch", "Essence", "BVM6", "EcoBoost|2.3 L"],
    ["Ford", "Focus", "2018-2025", "1.5 EcoBlue", "95ch|120ch", "Diesel", "BVM6", "EcoBlue|1.5 L"],
    ["Ford", "Focus", "2018-2025", "2.0 EcoBlue", "150ch|190ch", "Diesel", "BVM6|Auto", "EcoBlue|2.0 L"],
    ["Ford", "Puma", "2019-2026", "1.0 EcoBoost Hybrid", "125ch|155ch", "Hybride léger 48V", "BVM6|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Puma", "2019-2026", "1.0 EcoBoost", "100ch|125ch", "Essence", "BVM6", "EcoBoost|1.0 L"],
    ["Ford", "Puma", "2019-2026", "1.5 EcoBlue", "120ch", "Diesel", "BVM6", "EcoBlue|1.5 L"],
    ["Ford", "Puma", "2019-2026", "ST", "190ch", "Essence", "BVM6", "EcoBoost|1.5 L"],
    ["Ford", "Kuga", "2020-2026", "1.5 EcoBoost", "120ch|150ch", "Essence", "BVM6|Auto", "EcoBoost|1.5 L"],
    ["Ford", "Kuga", "2020-2026", "2.5 Plug-in Hybrid", "225ch", "Hybride rechargeable", "automatique", "PHEV|2.5 L"],
    ["Ford", "Kuga", "2020-2026", "2.5 Full Hybrid", "190ch", "Hybride", "automatique", "HEV|2.5 L"],
    ["Ford", "Kuga", "2020-2026", "2.0 EcoBlue", "120ch|150ch|190ch", "Diesel", "BVM6|Auto 4x4", "EcoBlue|2.0 L"],
    ["Ford", "Mustang Mach-E", "2021-2026", "Standard Range RWD", "269ch|294ch", "Électrique", "RWD / réducteur", "BEV|70 kWh|88 kWh"],
    ["Ford", "Mustang Mach-E", "2021-2026", "Extended Range RWD", "294ch|351ch", "Électrique", "RWD / réducteur", "BEV|88 kWh"],
    ["Ford", "Mustang Mach-E", "2021-2026", "GT AWD", "487ch|534ch", "Électrique", "AWD / réducteur", "BEV|88 kWh"],
    ["Ford", "Transit", "2014-2026", "2.0 EcoBlue", "105ch|125ch|170ch|185ch", "Diesel", "BVM6|Auto", "EcoBlue|2.0 L"],
    ["Ford", "Transit", "2022-2026", "E-Transit", "269ch", "Électrique", "réducteur", "BEV|68 kWh"],

    ["Chevrolet", "Bolt EV", "2017-2026", "Bolt EV", "204ch", "Électrique", "réducteur", "BEV|66 kWh"],
    ["Chevrolet", "Bolt EUV", "2021-2026", "Bolt EUV", "204ch", "Électrique", "réducteur", "BEV|66 kWh"],
    ["Chevrolet", "Equinox EV", "2024-2026", "Front Drive", "213ch", "Électrique", "RWD / réducteur", "Ultium|85 kWh"],
    ["Chevrolet", "Equinox EV", "2024-2026", "AWD", "290ch", "Électrique", "AWD / réducteur", "Ultium|85 kWh"],

    ["Ram", "1500", "2019-2026", "3.6 V6", "305ch", "Essence", "automatique 4x4", "Pentastar|3.6 L"],
    ["Ram", "1500", "2019-2026", "5.7 HEMI V8", "395ch", "Essence", "automatique 4x4", "HEMI|5.7 L"],
    ["Ram", "1500", "2019-2026", "3.0 EcoDiesel", "260ch|420ch", "Diesel", "automatique 4x4", "EcoDiesel|3.0 L"],

    ["Chrysler", "Pacifica", "2017-2026", "3.6 V6", "287ch", "Essence", "automatique", "Pentastar|3.6 L"],
    ["Chrysler", "Pacifica", "2021-2026", "Hybrid", "260ch", "Hybride", "automatique", "eFlite|3.6 L"]
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
        source: "secours local massif",
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

    // Fallback intelligent : si aucune correspondance stricte d'année mais qu'il y a des moteurs, on les montre tous
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
     UI DROPDOWN & EVENEMENTS (CORRECTION MAJEURE BOUTON GRISÉ)
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
    updateEngineButton(); // Appel crucial
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

    // CORRECTION MAJEURE : Si Marque ET Modèle sont présents, le bouton EST ACTIF
    // Peu importe si l'index est prêt ou non, on permet le clic pour afficher le menu
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
      list.innerHTML = '<div class="combo-empty">Aucune motorisation compatible trouvée pour cette année/modèle.</div>';
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
    
    // PRÉPARATION IMMÉDIATE DES MOTEURS POUR DÉVERROUILLER LE BOUTON
    renderEngineList(""); 
    
    updateEngineButton(); // Met à jour l'état visuel (devient actif)
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
     ANALYSE / RAPPORT (IDENTIQUE À V24 MAIS ROBUSTE)
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

  // Helpers de rendu section (identiques à v24)
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
      a.download = "aide-redactionnelle-expert-data-v25.json";
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
    updateDataStatus("Base locale massive chargée (Off-line First)");
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
    
    toast("Application prête. Toutes les marques/modèles 2017-2027 disponibles.", "success");
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
