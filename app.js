(() => {
  "use strict";

  const APP_VERSION = "v30-dynamic-auto-diagnostic-apk";

  window.addEventListener("error", (e) => {
    console.warn("[EXPERT-AUTO] Erreur globale:", e?.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.warn("[EXPERT-AUTO] Promesse rejetée:", e?.reason);
    if (e.preventDefault) e.preventDefault();
  });

  const q = (sel) => { try { return document.querySelector(sel); } catch { return null; } };
  const qa = (sel) => { try { return Array.from(document.querySelectorAll(sel)); } catch { return []; } };
  const on = (sel, evt, fn) => { const el = q(sel); if (el) el.addEventListener(evt, fn); };

  const todayKey = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
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
    const cur = load(newKey, null);
    if (cur != null) return cur;
    const old = load(oldKey, null);
    if (old != null) { save(newKey, old); return old; }
    return fallback;
  };

  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const norm = (s) => {
    let v = String(s == null ? "" : s).toLowerCase();
    if (v.normalize) v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return v.trim();
  };

  const normKey = (s) => norm(s).replace(/[^a-z0-9]+/g, "");

  const unique = (arr) => {
    const seen = new Set();
    return (arr || []).filter((x) => {
      const k = norm(x);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const parseKm = (v) => parseInt(String(v == null ? "" : v).replace(/[^0-9]/g, ""), 10) || 0;

  const getPowerValue = (p) => {
    const m = String(p || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const splitList = (v) => String(v == null ? "" : v)
    .split(/[|,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

  const expandPowers = (p) => {
    const parts = splitList(p);
    return parts.length ? parts : [""];
  };

  const containsAny = (text, list) => {
    const t = norm(text);
    return (list || []).some((x) => t.includes(norm(x)));
  };

  const isElectricLike = (fuel) => /electrique|bev|ev|hybride rechargeable|plug.in|phev/.test(norm(fuel));

  const brandMatches = (a, b) => {
    const na = normKey(a), nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;

    const aliases = {
      volkswagen: ["vw"],
      mercedesbenz: ["mercedes", "mb"],
      landrover: ["land rover"],
      rangerover: ["range rover"],
      alfaromeo: ["alfa"],
      chevrolet: ["chevy"],
      tesla: ["tesla motors"],
      byd: ["build your dreams"],
      mg: ["morris garages"],
      hyundai: ["hyundai motor"],
      kia: ["kia motors"],
      toyota: ["toyota motor corp"],
      honda: ["honda motor co"],
      ford: ["ford motor co"],
      opel: ["adam opel ag"],
      psa: ["peugeot citroen"],
      stellantis: ["psa fca"],
      vag: ["volkswagen audi group"]
    };

    if (aliases[na]?.includes(nb)) return true;
    if (aliases[nb]?.includes(na)) return true;
    if (na.length > 3 && nb.includes(na)) return true;
    if (nb.length > 3 && na.includes(nb)) return true;
    return false;
  };

  const nameMatch = (a, b) => {
    const na = normKey(a), nb = normKey(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.length > 2 && nb.includes(na)) return true;
    if (nb.length > 2 && na.includes(nb)) return true;
    return false;
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

  const toast = (msg, type = "info") => {
    const el = ensureToast();
    el.textContent = msg;
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
    if (!window.crypto?.subtle || typeof TextEncoder === "undefined") return simpleHash(text);
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

  const valToString = (v) => Array.isArray(v) ? v.join("|") : (v == null ? "" : String(v));

  const getField = (obj, keys) => {
    if (!obj || typeof obj !== "object") return "";
    for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
    const lower = {};
    for (const p in obj) if (Object.prototype.hasOwnProperty.call(obj, p)) lower[normKey(p)] = p;
    for (const k of keys) {
      const lk = lower[normKey(k)];
      if (lk && obj[lk] != null && obj[lk] !== "") return obj[lk];
    }
    return "";
  };

  const getBrandField = (o) => valToString(getField(o, ["b", "brand", "marque", "constructeur", "make"]));
  const getModelField = (o) => valToString(getField(o, ["m", "model", "modele", "modèle", "vehicle", "vehicule"]));
  const getEngineField = (o) => valToString(getField(o, ["e", "engine", "motorisation", "moteur", "powertrain", "version", "variant"]));
  const getPowerField = (o) => valToString(getField(o, ["p", "power", "puissance", "ch", "kw"]));
  const getFuelField = (o) => valToString(getField(o, ["t", "type", "fuel", "energie", "énergie", "carburant", "engineType"]));
  const getTransField = (o) => valToString(getField(o, ["tr", "transmission", "boite", "boîte", "gearbox"]));
  const getCodeField = (o) => valToString(getField(o, ["code", "codeMoteur", "engineCode", "codemoteur", "d", "cyl", "cylindree", "cylindrée", "displacement"]));
  const getSymptomsField = (o) => valToString(getField(o, ["s", "symptoms", "symptomes", "panne", "pannes", "defaut", "défaut", "probleme", "problème", "issue", "fault"]));

  const extractArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.results)) return payload.results;
    if (payload && Array.isArray(payload.catalog)) return payload.catalog;
    return [];
  };

  const fetchJson = async (url, timeoutMs = 9000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const tryFetchJson = async (urls) => {
    for (const url of urls || []) {
      try {
        return await fetchJson(url);
      } catch {}
    }
    return null;
  };

  const CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    pollAdminMs: 5000,
    syncIntervalMs: 5 * 60 * 1000,
    remote: {
      base: "https://expertkevin06-cell.github.io/auto-diagnostic/",
      endpoints: {
        brands: [
          "data/brands.json",
          "data/marques.json",
          "api/brands.json"
        ],
        models: [
          "data/models.json",
          "data/vehicles.json",
          "data/modeles.json",
          "api/models.json"
        ],
        engines: [
          "data/engines.json",
          "data/motorisations.json",
          "data/moteurs.json",
          "api/engines.json"
        ],
        defects: [
          "data/defects.json",
          "data/pannes.json",
          "data/recalls.json",
          "data/rappels.json",
          "data/technical-updates.json",
          "api/defects.json"
        ]
      }
    },
    mail: {
      adminEmail: ""
    }
  };

  const KEYS = {
    SESSION: "arex_session_v30",
    USERS: "arex_users_v30",
    REQUESTS: "arex_requests_v30",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v30",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v30",
    BACKGROUND: "arex_background_v30",
    SETTINGS: "arex_settings_v30"
  };

  const OLD_KEYS = {
    SESSION: "arex_session_v29",
    USERS: "arex_users_v29",
    REQUESTS: "arex_requests_v29",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v29",
    AUTO_LAST_SYNC: "arex_auto_last_sync_v29"
  };

  let currentUser = null;
  let vehicleData = {};
  let analysisData = {};
  let termesMobilises = new Set();
  let deferredPrompt = null;
  let swRegistration = null;
  let adminPollTimer = null;
  let liveSyncTimer = null;
  let lastPendingSignature = "";
  let broadcast = null;

  const selection = { brand: null, model: null, engine: null };
  let engineFuelFilter = "all";

  const index = {
    brands: {},
    models: {}
  };

  const catalog = {
    defects: [],
    defectKeys: new Set()
  };

  try {
    if ("BroadcastChannel" in window) broadcast = new BroadcastChannel("arex_expert_channel_v30");
  } catch { broadcast = null; }

  /* =========================================================
     AUTH / USERS / REQUESTS
     ========================================================= */
  const normIdentity = (v) => norm(String(v == null ? "" : v)).replace(/\s+/g, " ").trim();
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

  const getUsers = () => (loadWithMigration(KEYS.USERS, OLD_KEYS.USERS, []) || []).map(migrateUser);
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

  const getRequests = () => (loadWithMigration(KEYS.REQUESTS, OLD_KEYS.REQUESTS, []) || []).map(migrateRequest);
  const saveRequests = (requests) => save(KEYS.REQUESTS, (requests || []).map(migrateRequest));

  const findApprovedUser = (name, email) => {
    const emailKey = userEmailKey(email);
    if (!emailKey) return null;
    return getUsers().find((u) =>
      u.status === "approved" &&
      u.role !== "admin" &&
      (u.key === userCompositeKey(name, email) || u.emailNorm === emailKey)
    ) || null;
  };

  const upsertUser = (user) => {
    const next = migrateUser(user);
    const users = getUsers();
    const idx = users.findIndex((u) => u.key === next.key || (u.emailNorm === next.emailNorm && u.role !== "admin"));
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
    el.textContent = info.unlimited ? "👑 Admin illimité" : `📊 ${info.remaining}/${CONFIG.maxDailyAnalyses}`;
  };

  const authMessage = (msg, type) => {
    const el = q("#authMsg");
    if (el) { el.textContent = msg; el.className = "auth-msg " + (type || ""); }
    else toast(msg, type || "info");
  };

  const getSettings = () => loadWithMigration(KEYS.SETTINGS, "arex_settings_v29", { adminEmail: "" }) || { adminEmail: "" };
  const saveSettings = (s) => save(KEYS.SETTINGS, s);

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
      if (!payload?.email) return false;
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
      toast("Accès approuvé importé.", "success");
      cleanUrlAfterParam();
      return true;
    } catch {
      toast("Lien d’accès invalide.", "error");
      return false;
    }
  };

  const processIncomingAccessRequestFromUrl = () => {
    try {
      const raw = getQueryParam("access_request");
      if (!raw) return false;
      const payload = JSON.parse(b64UrlToUtf8(raw));
      if (!payload?.email) return false;
      const req = migrateRequest({
        id: uid(),
        name: payload.name || payload.email,
        email: payload.email,
        reason: payload.reason || "Demande via lien partagé",
        status: "pending",
        date: new Date().toLocaleString("fr-FR"),
        ts: Date.now(),
        source: "lien-partage"
      });
      const requests = getRequests();
      requests.push(req);
      saveRequests(requests);
      publishAccessRequest(req);
      cleanUrlAfterParam();
      toast("Demande importée.", "success");
      return true;
    } catch {
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
    if (el) el.textContent = "État notifications : " + (labels[state] || state);
  };

  const askNotification = async () => {
    if (!("Notification" in window)) { updateNotificationState(); return "unsupported"; }
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      updateNotificationState();
      return Notification.permission;
    }
    try {
      const p = await Notification.requestPermission();
      updateNotificationState();
      return p;
    } catch {
      updateNotificationState();
      return Notification.permission || "denied";
    }
  };

  const showSystemNotification = async (title, body, tag) => {
    const options = { body: body || "", tag: tag || "arex-" + Date.now(), data: { url: "./index.html" } };
    const fallback = () => {
      if ("Notification" in window && Notification.permission === "granted") {
        try { const n = new Notification(title, options); n.onclick = () => window.focus(); } catch {}
      }
    };
    if (swRegistration?.showNotification) {
      try { await swRegistration.showNotification(title, options); return; } catch { fallback(); return; }
    }
    fallback();
  };

  const notify = (title, body, tag) => showSystemNotification(title, body, tag);

  const mailto = (to, subject, body) => {
    const url = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
    window.location.href = url;
  };

  const sendAdminMail = (req) => {
    const settings = getSettings();
    const adminEmail = settings.adminEmail || CONFIG.mail.adminEmail || "";
    if (!adminEmail) return;
    mailto(
      adminEmail,
      "[Expert Auto] Nouvelle demande d’accès",
      `Nouvelle demande d'accès\n\nNom: ${req.name}\nEmail: ${req.email}\nMotif: ${req.reason}\nDate: ${req.date}`
    );
  };

  const sendUserApprovalMail = (user, grantUrl) => {
    mailto(
      user.email,
      "[Expert Auto] Votre accès a été approuvé",
      `Bonjour ${user.name},\n\nVotre accès a été approuvé.\n\nLien d'accès :\n${grantUrl}\n\nCordialement,\nL'administrateur.`
    );
  };

  const onAccessRequestReceived = (req) => {
    if (!currentUser || currentUser.role !== "admin" || !req) return;
    notify("Nouvelle demande d’accès", `${req.name || "Tiers"} — ${req.email || ""}`, "access-" + (req.id || Date.now()));
    updateNotificationBell();
    renderAdminIfOpen();
    sendAdminMail(req);
    toast("Nouvelle demande : " + (req.name || "Tiers"), "info");
  };

  const pollAdminNotifications = () => {
    if (!currentUser || currentUser.role !== "admin") return;
    const sig = pendingSignature();
    if (sig === lastPendingSignature) { updateNotificationBell(); return; }
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
    adminPollTimer = setInterval(pollAdminNotifications, CONFIG.pollAdminMs);
    const count = pendingRequests().length;
    if (count > 0) toast(`${count} demande(s) en attente`, "info");
  };

  const stopAdminPolling = () => {
    if (adminPollTimer) { clearInterval(adminPollTimer); adminPollTimer = null; }
  };

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
    if (btn) btn.classList.toggle("hidden", !saved);
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
    if (login) login.classList.add("hidden");
    const app = q("#mainApp");
    if (app) app.classList.remove("hidden");
    const badge = q("#userBadge");
    if (badge) badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;
    const adminBtn = q("#adminPanelBtn");
    if (adminBtn) adminBtn.classList.toggle("hidden", currentUser.role !== "admin");
    updateCounter();
    updateNotificationBell();
    updateNotificationState();
    updateSelectionSummary();
    if (currentUser?.role === "admin") { startAdminPolling(); askNotification(); } else { stopAdminPolling(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLogin = () => {
    const login = q("#loginScreen");
    if (login) login.classList.remove("hidden");
    const app = q("#mainApp");
    if (app) app.classList.add("hidden");
    const admin = q("#adminPanel");
    if (admin) admin.classList.add("hidden");
    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  };

  /* =========================================================
     BASE LOCALE DE SECOURS
     ========================================================= */
  const SEED_VEHICLES = [
    ["Peugeot", "208", "1.2 VTi", "82ch", "Essence", "BVM5", "EB2|1.2 L"],
    ["Peugeot", "208", "1.2 PureTech", "110ch|130ch", "Essence", "BVM5|ETG6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "208", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5|ETG6", "DV6|1.6 L"],
    ["Peugeot", "208", "1.5 BlueHDi", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Peugeot", "208", "e-208", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],

    ["Peugeot", "2008", "1.2 PureTech", "82ch|110ch|130ch", "Essence", "BVM5|ETG6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "2008", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5|ETG6", "DV6|1.6 L"],
    ["Peugeot", "2008", "1.5 BlueHDi", "100ch|130ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "2008", "e-2008", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],

    ["Peugeot", "308", "1.6 THP", "125ch|150ch|200ch", "Essence", "BVM6|EAT6", "EP6|1.6 L"],
    ["Peugeot", "308", "1.2 PureTech", "110ch|130ch", "Essence", "BVM5|ETG6|EAT6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "308", "1.6 HDi", "92ch|115ch", "Diesel", "BVM5|ETG6", "DV6|1.6 L"],
    ["Peugeot", "308", "2.0 HDi", "150ch", "Diesel", "BVM6|EAT6", "DW10|2.0 L"],
    ["Peugeot", "308", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "308", "Hybrid 180", "180ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "308", "e-308", "115kW|150kW", "Électrique", "réducteur", "eCMP|54 kWh"],

    ["Peugeot", "3008", "1.2 PureTech 130", "130ch", "Essence", "EAT6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "3008", "1.6 PureTech 180", "180ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "3008", "1.6 PureTech 225", "225ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "3008", "1.5 BlueHDi 120", "120ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "3008", "2.0 BlueHDi 150", "150ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "3008", "2.0 BlueHDi 180", "180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "3008", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "3008", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "3008", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "3008", "e-3008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Peugeot", "5008", "1.2 PureTech 130", "130ch", "Essence", "EAT6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "5008", "1.6 PureTech 180", "180ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "5008", "1.6 PureTech 225", "225ch", "Essence", "EAT8", "EP6FDT|1.6 L"],
    ["Peugeot", "5008", "1.5 BlueHDi 120", "120ch", "Diesel", "BVM6|EAT8", "DV5|1.5 L"],
    ["Peugeot", "5008", "2.0 BlueHDi 150", "150ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "5008", "2.0 BlueHDi 180", "180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Peugeot", "5008", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "5008", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],
    ["Peugeot", "5008", "1.6 Hybrid 130", "130ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008", "1.6 Hybrid 180", "180ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Peugeot", "5008", "e-5008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Citroen", "C3", "1.2 PureTech", "82ch|110ch|130ch", "Essence", "BVM5|BVM6|EAT6", "EB2|1.2 L"],
    ["Citroen", "C3", "1.5 BlueHDi", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Citroen", "C3", "ë-C3", "94ch|118ch", "Électrique", "réducteur", "eCMP|44 kWh"],

    ["Citroen", "C4", "1.2 PureTech", "100ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Citroen", "C4", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Citroen", "C4", "ë-C4", "100kW|115kW|156ch", "Électrique", "réducteur", "eCMP|50 kWh"],

    ["Citroen", "C5 Aircross", "1.2 PureTech", "130ch|180ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Citroen", "C5 Aircross", "1.5 BlueHDi", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Citroen", "C5 Aircross", "2.0 BlueHDi", "160ch|180ch", "Diesel", "EAT8", "DW10|2.0 L"],
    ["Citroen", "C5 Aircross", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Citroen", "C5 Aircross", "Hybrid4 300", "300ch", "Hybride rechargeable", "EAT8 4x4", "PHEV4|1.6 L"],

    ["Renault", "Clio", "1.2 16V", "75ch", "Essence", "BVM5", "D4F|1.2 L"],
    ["Renault", "Clio", "0.9 TCe", "90ch", "Essence", "BVM5|EDC", "H4B|0.9 L"],
    ["Renault", "Clio", "1.5 dCi", "75ch|90ch|110ch|115ch", "Diesel", "BVM5|BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Clio", "1.0 TCe", "65ch|90ch|100ch", "Essence", "BVM5|BVM6", "H4D|1.0 L"],
    ["Renault", "Clio", "1.3 TCe", "100ch|130ch|140ch|155ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Clio", "E-Tech Hybrid", "140ch|145ch", "Hybride", "automatique", "TCe 140|1.6 L"],

    ["Renault", "Captur", "1.2 TCe", "120ch", "Essence", "EDC", "H5F|1.2 L"],
    ["Renault", "Captur", "1.5 dCi", "90ch|110ch", "Diesel", "EDC|BVM6", "K9K|1.5 L"],
    ["Renault", "Captur", "1.0 TCe", "90ch|100ch", "Essence", "BVM6", "H4D|1.0 L"],
    ["Renault", "Captur", "1.3 TCe", "130ch|155ch", "Essence", "EDC", "H5H|1.3 L"],
    ["Renault", "Captur", "1.5 Blue dCi", "100ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Captur", "E-Tech Hybrid", "140ch|160ch", "Hybride", "automatique", "TCe 160|1.6 L"],

    ["Renault", "Megane", "1.5 dCi", "90ch|110ch|115ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Megane", "1.2 TCe", "130ch", "Essence", "EDC", "H5F|1.2 L"],
    ["Renault", "Megane", "1.3 TCe", "100ch|140ch|160ch", "Essence", "BVM6|EDC", "H5H|1.3 L"],
    ["Renault", "Megane", "E-Tech Hybrid", "160ch|205ch", "Hybride", "automatique", "TCe 200|1.6 L"],
    ["Renault", "Megane", "Evolution 60 kWh", "130ch|220ch", "Électrique", "réducteur", "CMF-EV|60 kWh"],
    ["Renault", "Megane", "Iconic 60 kWh", "220ch", "Électrique", "réducteur", "CMF-EV|60 kWh"],

    ["Volkswagen", "Golf", "1.0 TSI", "85ch|110ch|125ch", "Essence", "BVM6|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Golf", "1.4 TSI", "125ch|150ch", "Essence", "DSG", "EA211|1.4 L"],
    ["Volkswagen", "Golf", "1.5 TSI", "130ch|150ch|180ch", "Essence", "DSG|BVM6", "EA211 evo|1.5 L"],
    ["Volkswagen", "Golf", "2.0 TSI", "230ch|310ch|320ch", "Essence", "DSG", "EA888|2.0 L"],
    ["Volkswagen", "Golf", "1.6 TDI", "90ch|110ch|115ch", "Diesel", "BVM5|DSG", "EA288|1.6 L"],
    ["Volkswagen", "Golf", "2.0 TDI", "110ch|150ch|184ch|200ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],
    ["Volkswagen", "Golf", "GTE", "204ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],
    ["Volkswagen", "Golf", "eTSI", "110ch|130ch|150ch", "Hybride léger 48V", "DSG", "EA211 evo|1.0 L|1.5 L"],
    ["Volkswagen", "Golf", "eHybrid", "204ch|245ch", "Hybride rechargeable", "DSG", "PHEV|1.5 L"],

    ["Volkswagen", "Polo", "1.0 MPI", "65ch|75ch", "Essence", "BVM5", "EA211|1.0 L"],
    ["Volkswagen", "Polo", "1.0 TSI", "95ch|110ch|115ch", "Essence", "BVM5|DSG", "EA211|1.0 L"],
    ["Volkswagen", "Polo", "1.5 TSI", "150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Polo", "1.6 TDI", "80ch|95ch|115ch", "Diesel", "BVM5|DSG", "EA288|1.6 L"],
    ["Volkswagen", "Polo", "2.0 TDI", "95ch|115ch|150ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],

    ["Volkswagen", "Tiguan", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Volkswagen", "Tiguan", "2.0 TSI", "190ch|245ch|320ch", "Essence", "DSG 4Motion", "EA888|2.0 L"],
    ["Volkswagen", "Tiguan", "2.0 TDI", "150ch|190ch|200ch", "Diesel", "DSG|4Motion", "EA288|2.0 L"],
    ["Volkswagen", "Tiguan", "eHybrid", "245ch|300ch", "Hybride rechargeable", "DSG 4Motion", "PHEV|1.4 L|2.0 L"],

    ["Audi", "A3", "1.4 TFSI", "125ch|150ch", "Essence", "S tronic", "EA211|1.4 L"],
    ["Audi", "A3", "2.0 TFSI", "190ch|204ch|230ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "A3", "2.0 TDI", "150ch|184ch", "Diesel", "S tronic|quattro", "EA288|2.0 L"],
    ["Audi", "A3", "30 TFSI", "110ch", "Essence", "S tronic", "EA211|1.0 L"],
    ["Audi", "A3", "35 TFSI", "150ch", "Essence", "S tronic", "EA211 evo|1.5 L"],
    ["Audi", "A3", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "A3", "45 TFSI e", "245ch|310ch", "Hybride rechargeable", "S tronic", "PHEV|1.4 L"],

    ["Audi", "Q3", "30 TFSI", "110ch|150ch", "Essence", "S tronic", "EA211|1.0 L|1.5 L"],
    ["Audi", "Q3", "40 TFSI", "190ch|204ch", "Essence", "S tronic quattro", "EA888|2.0 L"],
    ["Audi", "Q3", "35 TDI", "150ch", "Diesel", "S tronic", "EA288|2.0 L"],
    ["Audi", "Q3", "40 TDI", "190ch", "Diesel", "S tronic quattro", "EA288|2.0 L"],
    ["Audi", "Q3", "45 TFSI e", "245ch", "Hybride rechargeable", "S tronic quattro", "PHEV|1.4 L"],

    ["BMW", "Serie 1", "116i", "109ch|136ch", "Essence", "BVM6|Steptronic", "B38/N13|1.5 L|1.6 L"],
    ["BMW", "Serie 1", "118i", "136ch|156ch|170ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "Serie 1", "120i", "170ch|218ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["BMW", "Serie 1", "125i", "245ch", "Essence", "Steptronic xDrive", "B48|2.0 L"],
    ["BMW", "Serie 1", "116d", "116ch", "Diesel", "BVM6|Steptronic", "B37|1.5 L"],
    ["BMW", "Serie 1", "118d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "Serie 1", "120d", "163ch|190ch", "Diesel", "Steptronic|xDrive", "B47|2.0 L"],

    ["BMW", "X1", "sDrive18i", "136ch|170ch", "Essence", "BVM6|Steptronic", "B38|1.5 L"],
    ["BMW", "X1", "sDrive18d", "150ch", "Diesel", "BVM6|Steptronic", "B47|2.0 L"],
    ["BMW", "X1", "sDrive20i", "178ch|204ch", "Essence", "Steptronic", "B48|2.0 L"],
    ["BMW", "X1", "xDrive25e", "245ch", "Hybride rechargeable", "Steptronic xDrive", "PHEV|1.5 L"],

    ["Mercedes-Benz", "Classe A", "A180", "120ch|122ch|136ch", "Essence", "7G-DCT", "M282/M270|1.3 L|1.6 L"],
    ["Mercedes-Benz", "Classe A", "A200", "156ch|163ch|184ch|190ch", "Essence", "7G-DCT|8G-DCT", "M282/M260/M270|1.3 L|2.0 L"],
    ["Mercedes-Benz", "Classe A", "A250", "224ch", "Essence", "8G-DCT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A", "AMG A35", "306ch", "Essence", "AMG SPEEDSHIFT 4MATIC", "M260|2.0 L"],
    ["Mercedes-Benz", "Classe A", "A180d", "116ch", "Diesel", "7G-DCT", "OM654|1.5 L|2.0 L"],
    ["Mercedes-Benz", "Classe A", "A200d", "150ch", "Diesel", "8G-DCT", "OM654|2.0 L"],
    ["Mercedes-Benz", "Classe A", "A250e", "218ch", "Hybride rechargeable", "8G-DCT", "PHEV|1.3 L"],

    ["Toyota", "Yaris", "1.0 VVT-i", "69ch|72ch", "Essence", "BVM5", "1KR-FE|1.0 L"],
    ["Toyota", "Yaris", "1.33 VVT-i", "101ch", "Essence", "Multidrive S", "2NR-FE|1.3 L"],
    ["Toyota", "Yaris", "1.5 D-4D", "100ch", "Diesel", "BVM5", "ND|1.5 L"],
    ["Toyota", "Yaris", "1.5 Hybrid", "116ch|130ch", "Hybride", "e-CVT", "THS II|1.5 L"],
    ["Toyota", "Yaris", "GR Yaris", "261ch|280ch", "Essence", "BVM6 4x4", "G16E-GTS|1.6 L"],

    ["Toyota", "Corolla", "1.8 Hybrid", "122ch|140ch", "Hybride", "e-CVT", "THS II|1.8 L"],
    ["Toyota", "Corolla", "2.0 Hybrid", "184ch|196ch", "Hybride", "e-CVT", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla", "2.0", "169ch|197ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "Corolla", "1.8 Plug-in Hybrid", "196ch", "Hybride rechargeable", "e-CVT", "PHEV|1.8 L"],

    ["Toyota", "RAV4", "2.0", "171ch", "Essence", "BVM6|Direct Shift", "Dynamic Force|2.0 L"],
    ["Toyota", "RAV4", "2.5 Hybrid", "218ch|222ch", "Hybride", "e-CVT AWD-i", "THS II|2.5 L"],
    ["Toyota", "RAV4", "2.5 Plug-in Hybrid", "306ch|320ch", "Hybride rechargeable", "e-CVT AWD-i", "PHEV|2.5 L"],
    ["Toyota", "RAV4", "2.5 D-4D", "150ch|200ch", "Diesel", "BVM6|Direct Shift 4x4", "GD|2.5 L"],

    ["Skoda", "Octavia", "1.4 TSI", "125ch|150ch", "Essence", "DSG|BVM6", "EA211|1.4 L"],
    ["Skoda", "Octavia", "1.5 TSI", "110ch|150ch", "Essence", "BVM6|DSG", "EA211 evo|1.5 L"],
    ["Skoda", "Octavia", "2.0 TSI", "190ch|265ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Skoda", "Octavia", "1.6 TDI", "110ch|115ch", "Diesel", "DSG|BVM5", "EA288|1.6 L"],
    ["Skoda", "Octavia", "2.0 TDI", "115ch|150ch|184ch|200ch", "Diesel", "DSG|4x4", "EA288|2.0 L"],
    ["Skoda", "Octavia", "iV", "204ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],

    ["Skoda", "Elroq", "Elroq 50", "170ch", "Électrique", "RWD / réducteur", "MEB|55 kWh"],
    ["Skoda", "Elroq", "Elroq 60", "204ch", "Électrique", "RWD / réducteur", "MEB|63 kWh"],
    ["Skoda", "Elroq", "Elroq 85", "286ch", "Électrique", "RWD / réducteur", "MEB|77 kWh"],
    ["Skoda", "Elroq", "Elroq 85x", "286ch", "Électrique", "AWD / réducteur", "MEB|77 kWh"],

    ["Tesla", "Model 3", "Standard Range Plus", "283ch", "Électrique", "RWD / réducteur", "BEV|57.5 kWh|60 kWh"],
    ["Tesla", "Model 3", "Long Range", "351ch|442ch", "Électrique", "RWD/AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model 3", "Performance", "513ch|534ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model Y", "Standard Range", "299ch", "Électrique", "RWD / réducteur", "BEV|60 kWh|62.5 kWh"],
    ["Tesla", "Model Y", "Long Range", "442ch|534ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model Y", "Performance", "534ch|615ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Tesla", "Model S", "Long Range", "670ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model S", "Plaid", "1020ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model X", "Long Range", "670ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],
    ["Tesla", "Model X", "Plaid", "1020ch", "Électrique", "AWD / réducteur", "BEV|100 kWh"],

    ["Ford", "Focus", "1.0 EcoBoost", "100ch|125ch|155ch", "Essence", "BVM5|BVM6|PowerShift", "EcoBoost|1.0 L"],
    ["Ford", "Focus", "1.5 EcoBoost", "150ch|182ch", "Essence", "BVM6|PowerShift", "EcoBoost|1.5 L"],
    ["Ford", "Focus", "1.5 TDCi", "95ch|120ch", "Diesel", "BVM5|BVM6", "TDCi|1.5 L"],
    ["Ford", "Focus", "2.0 EcoBlue", "150ch|190ch", "Diesel", "BVM6|Auto", "EcoBlue|2.0 L"],
    ["Ford", "Focus", "2.3 EcoBoost ST", "280ch", "Essence", "BVM6", "EcoBoost|2.3 L"],

    ["Opel", "Corsa", "1.2", "75ch|100ch|130ch", "Essence", "BVM5|BVM6|EAT8", "EB2|1.2 L"],
    ["Opel", "Corsa", "1.5 Diesel", "100ch|130ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Opel", "Corsa", "Corsa Electric", "136ch", "Électrique", "réducteur", "eCMP|50 kWh"],

    ["Seat", "Leon", "1.0 TSI", "110ch", "Essence", "DSG", "EA211|1.0 L"],
    ["Seat", "Leon", "1.5 TSI", "130ch|150ch", "Essence", "DSG", "EA211 evo|1.5 L"],
    ["Seat", "Leon", "2.0 TSI", "190ch|310ch", "Essence", "DSG 4x4", "EA888|2.0 L"],
    ["Seat", "Leon", "2.0 TDI", "115ch|150ch", "Diesel", "DSG", "EA288|2.0 L"],
    ["Seat", "Leon", "e-HYBRID", "204ch|245ch", "Hybride rechargeable", "DSG", "PHEV|1.4 L"],

    ["Hyundai", "Tucson", "1.6 TGDI", "150ch|177ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson", "1.6 CRDi", "115ch|136ch", "Diesel", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Hyundai", "Tucson", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Hyundai", "Tucson", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique", "PHEV|1.6 L"],

    ["Kia", "Sportage", "1.6 TGDI", "150ch|180ch", "Essence", "BVM6|DCT", "Smartstream|1.6 L"],
    ["Kia", "Sportage", "1.6 CRDi", "136ch", "Diesel", "BVM6|DCT 4x4", "Smartstream|1.6 L"],
    ["Kia", "Sportage", "1.6 Hybrid", "215ch|230ch", "Hybride", "automatique", "HEV|1.6 L"],
    ["Kia", "Sportage", "1.6 Plug-in Hybrid", "253ch|265ch", "Hybride rechargeable", "automatique 4x4", "PHEV|1.6 L"]
  ];

  const SEED_DEFECTS = [
    {
      brand: "Peugeot",
      models: ["208", "2008", "308", "3008", "5008", "Partner", "Rifter", "Boxer"],
      engines: ["EB2", "1.2 PureTech"],
      powers: ["100ch", "110ch", "130ch", "155ch"],
      fuels: ["Essence"],
      symptoms: ["courroie distribution", "wet belt", "désagrégation courroie", "crépine pompe", "casse moteur", "cliquetis", "pression huile", "consommation huile", "surchauffe", "mode dégradé"],
      severity: "critique",
      description: "Courroie humide susceptible de se désagréger, d’obstruer la crépine de pompe à huile et d’entraîner une casse moteur.",
      legal: "Vice caché 1641 C.civ.; tromperie L.213-1; pratique commerciale trompeuse L.121-2.",
      recall: "Extensions / TSB Stellantis PureTech; DGCCRF; forums techniques.",
      tags: "moteur|distribution|courroie|huile|pompe|critique",
      dtc: "P052B|P0011|P0300|P0420",
      source: "base locale"
    },
    {
      brand: "Renault",
      models: ["Clio", "Megane", "Scenic", "Duster", "Kangoo", "Trafic", "Master"],
      engines: ["K9K", "1.5 dCi"],
      powers: ["75ch", "90ch", "100ch", "110ch", "115ch"],
      fuels: ["Diesel"],
      symptoms: ["casse bielle", "claquement moteur", "usure coussinets", "pompe à huile", "bruit métallique", "pression huile basse", "voyant huile", "calage"],
      severity: "critique",
      description: "Risque de casse bielle / coussinets lié à la lubrification et à la pompe à huile.",
      legal: "Vice caché 1641 C.civ.; tromperie L.213-1; responsabilité contractuelle 1231-1 C.civ.",
      recall: "Programmes techniques Renault K9K; TSB; jurisprudences.",
      tags: "moteur|huile|bielle|pompe|bruit|critique",
      dtc: "P0524|P0525|P0300|P0301",
      source: "base locale"
    },
    {
      brand: "Tesla",
      models: ["Model 3", "Model Y", "Model S", "Model X"],
      engines: ["Électrique"],
      powers: [],
      fuels: ["Électrique"],
      symptoms: ["autopilot", "fsd", "phantom braking", "batterie 12v", "port de charge", "poignée", "logiciel", "dégradation batterie", "thermique", "autonomie", "adas", "caméra", "radar"],
      severity: "critique",
      description: "ADAS, batterie 12V, port de charge, dégradation batterie, logiciels, poignées, gestion thermique.",
      legal: "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245; pénal si accident.",
      recall: "NHTSA Tesla recalls; DGCCRF; SafetyGate.",
      tags: "ADAS|batterie|charge|logiciel|sécurité",
      dtc: "P0Axx|U1xxx|B1xxx",
      source: "base locale"
    },
    {
      brand: "Skoda",
      models: ["Elroq", "Enyaq"],
      engines: ["MEB", "BMS", "batterie haute tension"],
      powers: ["55 kWh", "63 kWh", "77 kWh"],
      fuels: ["Électrique"],
      symptoms: ["autonomie réduite", "soh", "charge lente", "charge impossible", "déséquilibre cellules", "erreur BMS", "température batterie", "voyant batterie", "perte autonomie", "batterie froide", "chauffe batterie", "gonflement batterie", "odeur brûlée", "fumée"],
      severity: "critique",
      description: "Plateforme MEB : surveillance BMS, cellules, gestion thermique, dégradation d’autonomie et cohérence capacité annoncée / usage réel.",
      legal: "Sécurité L.423-1 C.consom.; conformité L.217-4 C.consom.; produits défectueux art. 1245 C.civ.; vice caché art. 1641 C.civ.",
      recall: "Rappels EV/MEB; DGCCRF; KBA; NHTSA; vérification VIN; lecture SOH/BMS.",
      tags: "batterie|charge|autonomie|électricité|sécurité|logiciel|MEB",
      dtc: "P0Axx|U1xxx|P1xxx|B1xxx",
      source: "base locale"
    }
  ];

  /* =========================================================
     INDEXATION
     ========================================================= */
  const addVehicle = (b, m, e, p, f, tr, code, source = "seed") => {
    if (!b || !m || !e) return;
    const bk = normKey(b);
    const mk = normKey(m);
    if (!index.brands[bk]) index.brands[bk] = { name: b, models: [] };

    const modelKey = `${bk}|${mk}`;
    if (!index.models[modelKey]) {
      index.models[modelKey] = {
        brand: b,
        name: m,
        engines: [],
        engineKeys: new Set()
      };
      index.brands[bk].models.push(index.models[modelKey]);
    }

    const powers = expandPowers(p);
    powers.forEach((power) => {
      const engineKey = normKey(`${e}|${power}|${f}|${tr}|${code}`);
      if (index.models[modelKey].engineKeys.has(engineKey)) return;
      index.models[modelKey].engineKeys.add(engineKey);

      index.models[modelKey].engines.push({
        brand: b,
        model: m,
        engine: e,
        power: power || "",
        fuel: f || "",
        transmission: tr || "",
        code: code || "",
        displacement: /l|cm3|cylindrée/i.test(code || "") ? code : "",
        source,
        confidence: source === "seed" ? 0.94 : 0.98
      });
    });
  };

  const addDefect = (d) => {
    if (!d?.brand) return;
    const key = normKey(`${d.brand}|${(d.models || []).join(",")}|${(d.engines || []).join(",")}|${(d.symptoms || []).join(",")}`);
    if (catalog.defectKeys.has(key)) return;
    catalog.defectKeys.add(key);
    catalog.defects.push({
      brand: d.brand,
      models: d.models || [],
      engines: d.engines || [],
      powers: d.powers || [],
      fuels: d.fuels || [],
      symptoms: d.symptoms || [],
      severity: d.severity || "info",
      description: d.description || "",
      legal: d.legal || "",
      recall: d.recall || "",
      tags: d.tags || "",
      dtc: d.dtc || "",
      source: d.source || "base locale",
      sourceUrl: d.sourceUrl || ""
    });
  };

  const initSeed = () => {
    index.brands = {};
    index.models = {};
    catalog.defects = [];
    catalog.defectKeys = new Set();

    SEED_VEHICLES.forEach(([b, m, e, p, f, tr, code]) => addVehicle(b, m, e, p, f, tr, code, "seed"));
    SEED_DEFECTS.forEach(addDefect);
  };

  /* =========================================================
     SYNCHRONISATION DISTANTE
     ========================================================= */
  const remoteUrl = (path) => {
    const base = CONFIG.remote.base.replace(/\/$/, "");
    return `${base}/${String(path).replace(/^\//, "")}`;
  };

  const mergeRemoteBrands = (payload) => {
    const rows = extractArray(payload);
    rows.forEach((row) => {
      const name = typeof row === "string" ? row : getBrandField(row);
      if (!name) return;
      const bk = normKey(name);
      if (!index.brands[bk]) index.brands[bk] = { name, models: [] };
      else index.brands[bk].name = index.brands[bk].name || name;
    });
  };

  const mergeRemoteModels = (payload) => {
    const rows = extractArray(payload);
    rows.forEach((row) => {
      const b = getBrandField(row);
      const m = getModelField(row);
      if (!b || !m) return;
      const bk = normKey(b), mk = normKey(m);
      if (!index.brands[bk]) index.brands[bk] = { name: b, models: [] };
      const modelKey = `${bk}|${mk}`;
      if (!index.models[modelKey]) {
        index.models[modelKey] = { brand: b, name: m, engines: [], engineKeys: new Set() };
        index.brands[bk].models.push(index.models[modelKey]);
      }
    });
  };

  const mergeRemoteEngines = (payload) => {
    const rows = extractArray(payload);
    rows.forEach((row) => {
      const b = getBrandField(row);
      const m = getModelField(row);
      const e = getEngineField(row);
      if (!b || !m || !e) return;
      addVehicle(
        b,
        m,
        e,
        getPowerField(row),
        getFuelField(row),
        getTransField(row),
        getCodeField(row),
        "auto-diagnostic distant"
      );
    });
  };

  const mergeRemoteDefects = (payload) => {
    const rows = extractArray(payload);
    rows.forEach((row) => {
      const brand = getBrandField(row);
      if (!brand) return;

      const models = splitList(getModelField(row) || row.models || row.modeles || "*");
      const engines = splitList(getEngineField(row) || row.engines || row.motorisations || row.moteurs);
      const powers = splitList(getPowerField(row) || row.powers || row.puissances);
      const fuels = splitList(getFuelField(row) || row.fuels || row.energies || row.carburants);
      const symptoms = splitList(getSymptomsField(row) || row.symptoms || row.symptomes);

      addDefect({
        brand,
        models,
        engines,
        powers,
        fuels,
        symptoms,
        severity: row.severity || row.severite || row.sev || "info",
        description: row.description || row.n || row.note || row.details || "",
        legal: row.legal || row.law || row.baseLegale || "",
        recall: row.recall || row.rec || row.rappel || row.recalls || "",
        tags: row.tags || row.tg || "",
        dtc: row.dtc || row.codes || row.codeDtc || "",
        source: row.source || "auto-diagnostic distant",
        sourceUrl: row.sourceUrl || row.url || row.link || ""
      });
    });
  };

  const updateDataStatus = (msg) => {
    const el = q("#dataStatus");
    if (el) el.textContent = msg;
  };

  const refreshSelectionLists = () => {
    if (selection.brand) renderModelList(q("#modelSearch")?.value || "");
    if (selection.brand && selection.model) renderEngineList(q("#engineSearch")?.value || "");
    updateSelectionSummary();
  };

  const syncRemoteCatalog = async (manual = false) => {
    updateDataStatus("Synchronisation dynamique Auto-Diagnostic...");
    const ep = CONFIG.remote.endpoints;

    const [brands, models, engines, defects] = await Promise.all([
      tryFetchJson(ep.brands.map(remoteUrl)),
      tryFetchJson(ep.models.map(remoteUrl)),
      tryFetchJson(ep.engines.map(remoteUrl)),
      tryFetchJson(ep.defects.map(remoteUrl))
    ]);

    let merged = 0;
    if (brands) { mergeRemoteBrands(brands); merged++; }
    if (models) { mergeRemoteModels(models); merged++; }
    if (engines) { mergeRemoteEngines(engines); merged++; }
    if (defects) { mergeRemoteDefects(defects); merged++; }

    save(KEYS.AUTO_LAST_SYNC, Date.now());
    updateAdminStats();
    refreshSelectionLists();

    if (merged > 0) {
      updateDataStatus(`Synchronisation dynamique réussie • ${merged} source(s) distante(s) intégrée(s)`);
      if (manual) toast("Base Auto-Diagnostic synchronisée.", "success");
    } else {
      updateDataStatus("Mode secours local actif • Endpoints distants non répondants ou absents");
      if (manual) toast("Aucun endpoint distant exploitable. Base locale conservée.", "warning");
    }
  };

  const startLiveSync = () => {
    stopLiveSync();
    liveSyncTimer = setInterval(() => syncRemoteCatalog(false), CONFIG.syncIntervalMs);
  };

  const stopLiveSync = () => {
    if (liveSyncTimer) { clearInterval(liveSyncTimer); liveSyncTimer = null; }
  };

  /* =========================================================
     PREDICTION / UI
     ========================================================= */
  const predictBrands = (query) => {
    const qq = norm(query);
    const all = Object.values(index.brands).map((b) => ({ name: b.name, id: normKey(b.name), modelCount: b.models.length }));
    if (!qq) return all.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200);
    return all.filter((b) => norm(b.name).includes(qq)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200);
  };

  const predictModels = (brandName, query) => {
    if (!brandName) return [];
    const bk = normKey(brandName);
    const brandData = index.brands[bk];
    if (!brandData) return [];
    const qq = norm(query);
    return brandData.models
      .filter((m) => !qq || norm(m.name).includes(qq))
      .map((m) => ({
        id: `${bk}|${normKey(m.name)}`,
        brand: m.brand,
        name: m.name,
        engineCount: m.engines.length,
        source: m.source || "local"
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 300);
  };

  const predictEngines = (brandName, modelName) => {
    if (!brandName || !modelName) return [];
    const modelKey = `${normKey(brandName)}|${normKey(modelName)}`;
    const modelData = index.models[modelKey];
    if (!modelData) return [];

    return modelData.engines.map((e) => ({
      id: `${modelKey}|${normKey(e.engine)}|${normKey(e.power)}`,
      ...e
    })).sort((a, b) => {
      const rank = ["Essence", "Diesel", "Hybride", "Hybride rechargeable", "Hybride léger 48V", "GPL", "Électrique"];
      const ra = rank.indexOf(a.fuel);
      const rb = rank.indexOf(b.fuel);
      if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
      return getPowerValue(b.power) - getPowerValue(a.power);
    });
  };

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
    const brands = predictBrands(input.value);
    if (!brands.length) {
      panel.innerHTML = '<div class="empty">Aucune marque trouvée.</div>';
      panel.classList.remove("hidden");
      return;
    }
    panel.innerHTML = brands.map((b) => `
      <button type="button" class="suggest-item" data-brand="${esc(b.name)}">
        ${esc(b.name)}
        <small>${b.modelCount} modèle(s)</small>
      </button>
    `).join("");
    panel.classList.remove("hidden");
  };

  const selectBrand = (name) => {
    selection.brand = { name };
    selection.model = null;
    selection.engine = null;
    engineFuelFilter = "all";
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
    btn.disabled = false;
    btn.textContent = selection.model ? selection.model.name : "Choisir un modèle";
  };

  const updateEngineButton = () => {
    const btn = q("#engineButton");
    if (!btn) return;
    if (!selection.brand || !selection.model) {
      btn.disabled = true;
      btn.textContent = !selection.brand ? "Choisir d’abord une marque" : "Choisir d’abord un modèle";
      return;
    }
    btn.disabled = false;
    btn.textContent = selection.engine ? engineLabel(selection.engine) : "Choisir une motorisation";
  };

  const engineLabel = (o) => {
    const parts = [];
    if (o.fuel) parts.push(o.fuel);
    if (o.engine) parts.push(o.engine);
    if (o.displacement) parts.push(o.displacement);
    if (o.power) parts.push(o.power);
    if (o.transmission) parts.push(o.transmission);
    if (o.code) parts.push(o.code);
    return parts.filter(Boolean).join(" • ");
  };

  const renderModelList = (filter) => {
    const list = q("#modelList");
    if (!list) return;
    if (!selection.brand) {
      list.innerHTML = '<div class="empty">Sélectionnez une marque d’abord.</div>';
      return;
    }
    const models = predictModels(selection.brand.name, filter);
    if (!models.length) {
      list.innerHTML = '<div class="empty">Aucun modèle trouvé.</div>';
      return;
    }
    list.innerHTML = models.map((m, i) => `
      <button type="button" class="list-item" data-model-index="${i}">
        ${esc(m.name)}
        <small>${m.engineCount} motorisation(s)</small>
      </button>
    `).join("");
    window.__tempModelOptions = models;
  };

  const renderEngineFilters = (engines) => {
    const wrap = q("#engineFilters");
    if (!wrap) return;
    const fuels = unique(engines.map((e) => e.fuel).filter(Boolean));
    const chips = [{ id: "all", label: "Toutes" }].concat(fuels.map((f) => ({ id: f, label: f })));
    wrap.innerHTML = chips.map((c) => `
      <button type="button" class="chip ${engineFuelFilter === c.id ? "active" : ""}" data-fuel-filter="${esc(c.id)}">${esc(c.label)}</button>
    `).join("");
  };

  const renderEngineList = (filter) => {
    const list = q("#engineList");
    if (!list) return;
    if (!selection.brand || !selection.model) {
      list.innerHTML = '<div class="empty">Sélectionnez un modèle d’abord.</div>';
      return;
    }

    const engines = predictEngines(selection.brand.name, selection.model.name);
    renderEngineFilters(engines);

    const f = norm(filter || "");
    const filtered = engines.filter((e) => {
      const fuelOk = engineFuelFilter === "all" || norm(e.fuel) === norm(engineFuelFilter);
      const textOk = !f || norm(engineLabel(e)).includes(f);
      return fuelOk && textOk;
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="empty">Aucune motorisation trouvée pour ce filtre.</div>';
      return;
    }

    list.innerHTML = filtered.map((e, i) => `
      <button type="button" class="list-item" data-engine-index="${i}">
        ${esc(engineLabel(e))}
        <small>${esc(e.source || "local")}</small>
      </button>
    `).join("");

    window.__tempEngineOptions = filtered;
  };

  const selectModel = (opt) => {
    if (!opt) return;
    selection.model = opt;
    selection.engine = null;
    engineFuelFilter = "all";
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

  const getSelectedVehicleData = () => {
    const brandEl = q("#brandInput");
    const kmEl = q("#vehicleKilometrage");
    const vinEl = q("#vehicleVin");
    return {
      marque: selection.brand ? selection.brand.name : (brandEl ? brandEl.value.trim() : ""),
      modele: selection.model ? selection.model.name : "",
      engine: selection.engine ? selection.engine.engine : "",
      displacement: selection.engine ? selection.engine.displacement : "",
      power: selection.engine ? selection.engine.power : "",
      fuel: selection.engine ? selection.engine.fuel : "",
      transmission: selection.engine ? selection.engine.transmission : "",
      code: selection.engine ? selection.engine.code : "",
      engineSource: selection.engine ? selection.engine.source : "",
      kilometrage: kmEl ? kmEl.value.trim() : "",
      vin: vinEl ? vinEl.value.trim() : ""
    };
  };

  const updateSelectionSummary = () => {
    const el = q("#selectionSummary");
    if (!el) return;
    const v = getSelectedVehicleData();
    if (!v.marque && !v.modele && !v.engine) {
      el.textContent = "Aucune sélection véhicule complète.";
      return;
    }
    const parts = [];
    if (v.marque) parts.push(v.marque);
    if (v.modele) parts.push(v.modele);
    if (v.engine) parts.push(v.engine);
    if (v.displacement) parts.push(v.displacement);
    if (v.power) parts.push(v.power);
    if (v.fuel) parts.push(v.fuel);
    if (v.transmission) parts.push(v.transmission);
    if (v.code) parts.push(v.code);
    el.textContent = "Sélection retenue : " + parts.join(" • ");
  };

  /* =========================================================
     ANALYSE CROISÉE
     ========================================================= */
  const addTerm = (...args) => {
    args.forEach((t) => termesMobilises.add(t));
    return `<span class="term">(${args.join(", ")})</span>`;
  };

  const matchDefects = (v, text) => {
    const txt = norm(text);
    const results = [];

    catalog.defects.forEach((d) => {
      if (v.marque && !brandMatches(d.brand, v.marque)) return;
      if (v.modele && d.models.length && !d.models.includes("*") && !d.models.some((m) => nameMatch(m, v.modele))) return;

      let score = 0;
      const found = [];

      (d.symptoms || []).forEach((s) => {
        if (txt.includes(norm(s))) {
          score++;
          found.push(s);
        }
      });

      if (v.engine && d.engines?.length) {
        if (d.engines.some((e) => norm(v.engine).includes(norm(e)) || norm(e).includes(norm(v.engine)))) score += 5;
      }

      if (v.fuel && d.fuels?.length) {
        if (d.fuels.some((f) => norm(f) === norm(v.fuel))) score += 3;
      }

      if (v.power && d.powers?.length) {
        if (d.powers.some((p) => norm(p) === norm(v.power))) score += 2;
      }

      if (score >= 1) {
        results.push({
          constructeur: d.brand,
          modeles: d.models?.length ? d.models : ["Non précisé"],
          moteur: d.engines?.join(", ") || v.engine || "Non précisé",
          puissance: d.powers?.join(", ") || v.power || "Non précisée",
          energie: d.fuels?.join(", ") || v.fuel || "Non précisée",
          severite: d.severity,
          description: d.description,
          symptomes: found.length ? found : (d.symptoms || []).slice(0, 3),
          score,
          confiance: score > 6 ? "Haute" : (score > 3 ? "Moyenne" : "Basse"),
          legal: d.legal,
          recall: d.recall,
          tags: d.tags,
          dtc: d.dtc,
          source: d.source,
          sourceUrl: d.sourceUrl
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 12);
  };

  const researchLinks = (brand, model, engine, symptoms, fuel) => {
    const baseQuery = `${brand} ${model} ${engine || ""} ${fuel || ""} ${(symptoms || []).slice(0, 3).join(" ")}`.trim();
    const q1 = encodeURIComponent(`${baseQuery} défaut panne rappel DTC motorisation puissance`);
    const q2 = encodeURIComponent(`${brand} ${model}`);
    return [
      { label: "Auto-Diagnostic", url: CONFIG.remote.base },
      { label: "Recherche technique", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / TSB", url: "https://www.google.com/search?q=" + encodeURIComponent(`${baseQuery} safetygate TSB rappel défaut`) },
      { label: "KBA Rückruf", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} KBA Rückruf`) },
      { label: "VIN / campagne", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} VIN recall campaign motorisation`) }
    ];
  };

  const orientationContext = (objective, sellerType, flags, matches) => {
    const obj = norm(objective);
    if (obj.includes("annulation") || obj.includes("résolution") || obj.includes("remboursement total")) {
      return "Orientation prioritaire : résolution / annulation de vente, avec accent sur gravité, impassibilité à l’usage normal et éventuelle impossibilité d’utilisation conforme.";
    }
    if (obj.includes("réparation") || obj.includes("prise en charge")) {
      return "Orientation prioritaire : prise en charge chiffrée de la réparation, avec accent sur antériorité, défaut de série et coût de remise en état.";
    }
    if (obj.includes("indemnisation")) {
      return "Orientation prioritaire : indemnisation du préjudice, avec accent sur perte de valeur d’usage, immobilisation, trouble de jouissance et risque sécurité.";
    }
    if (flags.professional) {
      return "Orientation prioritaire : responsabilité du professionnel, obligation de conseil, vérification des rappels et conformité.";
    }
    if (flags.privateSeller) {
      return "Orientation prioritaire : vice caché, mauvaise foi éventuelle et charge probatoire renforcée.";
    }
    if (matches.some((m) => m.severite === "critique")) {
      return "Orientation prioritaire : sécurité produit, dangerosité et limitation immédiate d’usage.";
    }
    return "Orientation générale : consolidation probatoire avant qualification définitive.";
  };

  const secIdentification = (text, context) => {
    let h = `<div class="box info"><strong>Objet :</strong> recensement des éléments fournis ${addTerm("éléments factuels", "faits allégués")}.</div>`;
    h += `<div class="kv">
      <div>Marque</div><div>${esc(vehicleData.marque || "non précisée")}</div>
      <div>Modèle</div><div>${esc(vehicleData.modele || "non précisé")}</div>
      <div>Motorisation</div><div>${esc(vehicleData.engine || "non précisée")}</div>
      <div>Cylindrée / capacité</div><div>${esc(vehicleData.displacement || "non précisée")}</div>
      <div>Puissance</div><div>${esc(vehicleData.power || "non précisée")}</div>
      <div>Énergie</div><div>${esc(vehicleData.fuel || "non précisée")}</div>
      <div>Transmission / boîte</div><div>${esc(vehicleData.transmission || "non précisée")}</div>
      <div>Code moteur / système</div><div>${esc(vehicleData.code || "non communiqué")}</div>
      <div>Kilométrage</div><div>${esc(vehicleData.kilometrage || "non précisé")} km ${addTerm("kilométrage", "usure normale", "vétusté")}</div>
      <div>VIN</div><div>${esc(vehicleData.vin || "non communiqué")} ${addTerm("VIN", "traçabilité", "numéro de série")}</div>
    </div>`;
    h += `<h4>Faits rapportés</h4><p>${esc(String(text || "").substring(0, 1800))}${String(text || "").length > 1800 ? " [...]" : ""}</p>`;
    if (context) h += `<h4>Contexte transactionnel</h4><p>${esc(String(context).substring(0, 1200))}</p>`;
    h += `<div class="box low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ${addTerm("principe du contradictoire", "constat amiable")}.</div>`;
    return h;
  };

  const secTechnique = (matches, flags, vData) => {
    const km = parseKm(vData.kilometrage);
    let h = `<div class="box info"><strong>Objet :</strong> croisement dynamique avec la base technique Auto-Diagnostic ${addTerm("défauts connus", "rappels", "TSB", "DTC", "motorisation", "pannes récurrentes")}.</div>`;

    if (!matches.length) {
      h += `<div class="box medium">
        <p>Aucune correspondance exacte trouvée dans la base technique chargée pour Marque / Modèle / Motorisation / Symptômes.</p>
        <p>Cela n’exclut pas un défaut individuel. Une lecture OBD / DTC et une expertise technique restent nécessaires ${addTerm("expertise individuelle", "cause racine")}.</p>
      </div>`;
      return h;
    }

    matches.forEach((m, i) => {
      const cls = m.severite === "critique" ? "box low" : "box info";
      h += `<div class="${cls}">
        <h4>${i + 1}. ${esc(m.moteur)} — ${esc(m.puissance)} — ${esc(m.energie)}</h4>
        <div class="kv">
          <div>Constructeur</div><div>${esc(m.constructeur)}</div>
          <div>Modèles</div><div>${esc(m.modeles.join(", "))}</div>
          <div>Symptômes corrélés</div><div>${esc(m.symptomes.join(", "))}</div>
          <div>Gravité</div><div>${esc(String(m.severite).toUpperCase())}</div>
          <div>Confiance</div><div>${esc(m.confiance)}</div>
          <div>DTC</div><div>${esc(m.dtc || "non précisé")}</div>
          <div>Source</div><div>${esc(m.source || "base locale")}${m.sourceUrl ? ` — <a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener noreferrer">ouvrir</a>` : ""}</div>
        </div>
        <p><strong>Description :</strong> ${esc(m.description)}</p>
        <p><strong>Appui juridique technique :</strong> ${esc(m.legal || "à compléter")} ${addTerm("vice caché", "défaut de conformité", "sécurité produit")}</p>
        <p><strong>Rappel / TSB :</strong> ${esc(m.recall || "à vérifier via VIN / constructeur")}</p>
      </div>`;
    });

    h += `<h4>Analyse d’usure / kilométrage</h4>
      <ul>
        <li><strong>Kilométrage :</strong> ${km.toLocaleString("fr-FR")} km</li>
        ${km > 200000 ? '<li class="box low">Kilométrage très élevé : usure normale plausible. Expertise indispensable pour distinguer défaut et usure.</li>' : ""}
        ${km > 120000 && km <= 200000 ? '<li class="box medium">Kilométrage élevé : usure possible, mais un défaut de série documenté maintient une suspicion forte.</li>' : ""}
        ${km <= 120000 ? '<li class="box high">Kilométrage modéré : la thèse du vice caché / défaut de conception est renforcée.</li>' : ""}
      </ul>`;

    if (flags.waterLeak) {
      h += `<div class="box low">
        <h4>💧 Alerte infiltration d’eau</h4>
        <p>Symptômes évocateurs d’infiltration : baies, joints, évacuations, toit ouvrant, climatisation, calculateurs.</p>
        <p><strong>Risques :</strong> court-circuit, corrosion, dysfonctionnement ABS/ESP, airbag, direction, incendie électrique.</p>
        <p><strong>Constat recommandé :</strong> photos moisiures, boîtier fusibles, connecteurs sous tableau de bord, joints, évacuations.</p>
      </div>`;
    }

    if (flags.dtc) {
      h += `<div class="box info">
        <h4>🧾 Angle DTC</h4>
        <p>Des mentions de codes défaut semblent présentes. Faire extraire la liste complète par diagnostiqueur indépendant, horodater le rapport, croiser avec la base Auto-Diagnostic et les TSB.</p>
      </div>`;
    }

    if (matches.some((m) => m.severite === "critique")) {
      h += `<div class="box low">
        <h4>🚨 Alerte sécurité</h4>
        <p>Défaut critique identifié : risque moteur, incendie, perte de contrôle, airbag, batterie ou immobilisation brutale.</p>
        <p>En attendant expertise, limiter l’usage du véhicule, éviter autoroutes, transports d’enfants, trajets de nuit et longue durée.</p>
      </div>`;
    }

    return h;
  };

  const secJuridique = (flags, matches) => {
    let h = `<div class="box info"><strong>Objet :</strong> qualification juridique renforcée par l’analyse technique croisée ${addTerm("qualification juridique", "responsabilité", "garantie")}.</div>`;

    if (flags.professional && !flags.privateSeller) {
      h += `<div class="box high"><p>Vendeur présumé professionnel ${addTerm("vendeur professionnel")}. Protection consommateur renforcée : garantie légale de conformité, charge de la preuve allégée, obligation d’information et de vérification des rappels.</p></div>`;
    } else if (flags.privateSeller && !flags.professional) {
      h += `<div class="box medium"><p>Vendeur présumé particulier ${addTerm("vente entre particuliers")}. Garantie des vices cachés du Code civil. Charge de la preuve plus lourde pour l’acquéreur.</p></div>`;
    } else {
      h += `<div class="box low"><p>Statut du vendeur incertain ${addTerm("ambiguïté statut vendeur")}. Qualifier d’abord le vendeur avant action.</p></div>`;
    }

    h += `<h4>Critères cumulatifs</h4>
      <ul>
        <li><strong>Antériorité :</strong> ${matches.some((m) => m.confiance === "Haute") ? "renforcée par défaut de série / logiciel / conception." : "à confirmer par expertise."} ${addTerm("antériorité")}</li>
        <li><strong>Caractère caché :</strong> ${matches.some((m) => m.severite === "critique") ? "soutenable, défaut non visible lors d’un examen standard." : "à apprécier concrètement."} ${addTerm("caractère caché")}</li>
        <li><strong>Gravité :</strong> ${matches.some((m) => m.severite === "critique") ? "élevée : sécurité, casse, incendie, immobilisation, coût disproportionné." : "à mesurer par devis et usage normal."} ${addTerm("gravité")}</li>
      </ul>`;

    h += `<h4>Régimes mobilisables</h4><ul>
      <li>${addTerm("garantie des vices cachés", "1641 C.civ.")}</li>`;

    if (flags.professional) {
      h += `<li>${addTerm("garantie légale de conformité", "L.217-4 C.consom.")}</li>
            <li>${addTerm("responsabilité contractuelle", "1231-1 C.civ.")}</li>
            <li>${addTerm("tromperie", "L.213-1 C.consom.")}</li>
            <li>${addTerm("pratique commerciale trompeuse", "L.121-2 C.consom.")}</li>`;
    } else {
      h += `<li>${addTerm("dol", "1137 C.civ.")} si dissimulation</li>
            <li>${addTerm("obligation d’information précontractuelle", "1112-1 C.civ.")}</li>`;
    }

    h += `<li>${addTerm("produits défectueux", "1245 C.civ.")}</li>
          <li>${addTerm("défaut de sécurité", "L.423-1 C.consom.")}</li>
        </ul>`;

    if (flags.diesel) {
      h += `<h4>Incidence diesel</h4><ul>
        <li>Conformité antipollution ${addTerm("L.217-4 C.consom.")}</li>
        <li>Tromperie si dispositif illicite ou dissimulation ${addTerm("L.213-1 C.consom.")}</li>
        <li>Rappel / campagne technique ${addTerm("DGCCRF", "KBA", "NHTSA")}</li>
      </ul>`;
    }

    if (flags.electricLike) {
      h += `<h4>Incidence électrifiée</h4><ul>
        <li>Sécurité batterie / charge / BMS ${addTerm("L.423-1 C.consom.")}</li>
        <li>Conformité logiciel / autonomie ${addTerm("L.217-4 C.consom.")}</li>
        <li>Produits défectueux ${addTerm("1245 C.civ.")}</li>
      </ul>`;
    }

    return h;
  };

  const secPreuve = (matches, flags, objective) => {
    let h = `<div class="box info"><strong>Objet :</strong> dossier probatoire et stratégie ${addTerm("preuve documentaire", "stratégie contentieuse")}.</div>`;
    h += `<h4>Documents à consolider</h4><ul>
      <li>Facture d’achat : ${flags.invoice ? "présente" : "à récupérer"}</li>
      <li>Certificat de cession / carte grise : vérifier motorisation, énergie, puissance, cylindrée, kilométrage</li>
      <li>Contrôle technique : ${flags.controlTech ? "présent" : "à récupérer"}</li>
      <li>Historique entretien / carnet / factures garage</li>
      <li>Preuve des rappels effectués via VIN</li>
      <li>Devis réparation (minimum 2)</li>
      <li>Lecture OBD / codes défaut DTC</li>
      <li>Export des fiches Auto-Diagnostic corrélées</li>
      <li>Photos : moisiure, eau, corrosion, voyants, niveaux, batterie, charge</li>
    </ul>`;

    h += `<h4>Stratégie recommandée</h4><ol>
      <li>Expertise amiable contradictoire</li>
      <li>Devis réparation</li>
      <li>Lecture OBD / DTC</li>
      <li>Export / impression des fiches Auto-Diagnostic corrélées</li>
      <li>Vérification VIN / rappels / motorisation</li>
      <li>Mise en demeure LRAR au vendeur</li>`;

    if (matches.length) h += `<li>Invoquer le défaut de série documenté ${addTerm("défaut de série", "présomption de connaissance")}</li>`;
    h += `<li>Conciliation / médiation si professionnel</li>
          <li>Assignation / expertise judiciaire si nécessaire</li>`;
    if (matches.some((m) => m.severite === "critique")) h += `<li>Signalement DGCCRF / préfet / NHTSA / KBA si danger collectif</li>`;
    h += `</ol>`;

    const links = researchLinks(vehicleData.marque, vehicleData.modele, matches[0]?.moteur || vehicleData.engine, matches[0]?.symptomes || [], vehicleData.fuel);
    h += `<h4>Pistes de recherche externe</h4><ul>`;
    links.forEach((l) => { h += `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`; });
    h += `</ul>`;

    if (objective) h += `<p><strong>Objectif déclaré :</strong> ${esc(objective)}</p>`;
    return h;
  };

  const secConclusion = (objective, matches, flags, vData) => {
    const high = matches.some((m) => m.confiance === "Haute");
    const critical = matches.some((m) => m.severite === "critique");
    const orientation = orientationContext(objective, flags.professional ? "professional" : flags.privateSeller ? "private" : "unknown", flags, matches);

    let score = 20;
    score += matches.reduce((acc, m) => acc + Math.min(m.score, 8), 0);
    if (flags.professional) score += 15;
    if (critical) score += 20;
    if (high) score += 15;
    if (parseKm(vData.kilometrage) < 120000) score += 10;
    score = Math.max(0, Math.min(100, score));

    let level = "À consolider";
    let cls = "box medium";
    if (score >= 75) { level = "Solide"; cls = "box high"; }
    else if (score <= 35) { level = "Fragile"; cls = "box low"; }

    let h = `<div class="${cls}">
      <h3>Indice de solidité du dossier : ${score}/100 — ${level}</h3>
      <p><strong>${orientation}</strong></p>
      <p><strong>Sélections prises en compte :</strong> ${esc(vData.marque || "marque non précisée")} / ${esc(vData.modele || "modèle non précisé")} / ${esc(vData.engine || "motorisation non précisée")} / ${esc(vData.power || "puissance non précisée")} / ${esc(vData.fuel || "énergie non précisée")}.</p>`;

    if (high && critical) {
      h += `<p>Le croisement technique et juridique oriente fortement vers un défaut antérieur, caché et grave. La base Auto-Diagnostic renforce le caractère documenté et non isolé du désordre.</p>`;
    } else if (matches.length) {
      h += `<p>Un défaut connu est probable, mais le kilométrage, la motorisation ou la nature du symptôme impose une expertise pour écarter l’usure normale.</p>`;
    } else {
      h += `<p>Aucun défaut de série identifié localement. Le problème peut être individuel : diagnostic et expertise nécessaires.</p>`;
    }

    if (flags.diesel) h += `<p><strong>Incidence diesel :</strong> conformité antipollution, tromperie, rappel et sécurité produit peuvent être mobilisés.</p>`;
    if (flags.electricLike) h += `<p><strong>Incidence électrifiée :</strong> batterie, autonomie, charge, logiciel, sécurité incendie et produits défectueux peuvent être mobilisés.</p>`;

    h += `<p><strong>Recommandation opérationnelle :</strong> ne pas effectuer de réparation destructrice avant constat/expertise. Conserver le véhicule en l’état si possible, photographier, obtenir devis, exporter les fiches corrélées, puis mise en demeure LRAR.</p>`;

    if (flags.professional) {
      h += `<p><strong>Si vendeur professionnel :</strong> privilégier garantie légale de conformité + signalement DGCCRF si danger.</p>`;
    } else {
      h += `<p><strong>Si vendeur particulier :</strong> privilégier expertise amiable puis action en vices cachés.</p>`;
    }

    h += `<p class="muted"><strong>Avertissement :</strong> document d’aide à la rédaction. Ne constitue pas un avis juridique définitif.</p></div>`;
    return h;
  };

  const secLexique = () => {
    const terms = Array.from(termesMobilises).sort();
    let h = `<div class="box info"><strong>Termes mobilisés :</strong> ${terms.length}</div><div class="box">`;
    terms.forEach((t) => { h += `<div><strong>${esc(t)}</strong></div>`; });
    h += `</div>`;
    return h;
  };

  const renderAnalysis = () => {
    let html = "";
    analysisData.sections.forEach(([title, body]) => {
      html += `<h3>${title}</h3>${body}`;
    });
    html += `<div class="box medium"><strong>Rappel méthodologique :</strong> ce rapport effectue un croisement local/dynamique technique + juridique + motorisation + Auto-Diagnostic. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>`;
    const result = q("#analysisResult");
    if (result) result.innerHTML = html;
    const section = q("#analysisSection");
    if (section) {
      section.classList.remove("hidden");
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const runAnalysis = (text, context, objective, sellerType) => {
    const all = `${text} ${context}`.toLowerCase();
    const allNorm = norm(all);
    const fuelNorm = norm(vehicleData.fuel || "");

    const flags = {
      professional: sellerType === "professional" || containsAny(all, ["professionnel", "garage", "concession", "revendeur"]),
      privateSeller: sellerType === "private" || containsAny(all, ["particulier", "entre particuliers", "leboncoin"]),
      waterLeak: containsAny(all, ["eau", "humidité", "infiltration", "baie", "pare brise", "moisiure"]),
      ev: isElectricLike(fuelNorm) || containsAny(all, ["batterie", "charge", "autonomie", "electrique", "hybride", "BMS"]),
      diesel: fuelNorm.includes("diesel") || containsAny(allNorm, ["diesel", "egr", "fap", "adblue", "nox"]),
      electricLike: isElectricLike(fuelNorm),
      dtc: /\bp[0-9a-z]{3,5}\b/i.test(all) || allNorm.includes("dtc") || allNorm.includes("code défaut"),
      invoice: all.includes("facture"),
      controlTech: all.includes("contrôle technique") || all.includes(" ct ")
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
    S.push(["I. IDENTIFICATION DU VÉHICULE", secIdentification(text, context)]);
    S.push(["II. ANALYSE TECHNIQUE CROISÉE AUTO-DIAGNOSTIC", secTechnique(matches, flags, vehicleData)]);
    S.push(["III. ANALYSE JURIDIQUE RENFORCÉE", secJuridique(flags, matches)]);
    S.push(["IV. PREUVE, STRATÉGIE ET VÉRIFICATIONS", secPreuve(matches, flags, objective)]);
    S.push(["V. CONCLUSION ORIENTÉE SELON LE LITIGE", secConclusion(objective, matches, flags, vehicleData)]);
    S.push(["VI. LEXIQUE TECHNIQUE ET JURIDIQUE MOBILISÉ", secLexique()]);

    analysisData.sections = S;
    renderAnalysis();
  };

  /* =========================================================
     ADMIN / WALLPAPER / APK
     ========================================================= */
  const updateAdminStats = () => {
    const brands = Object.keys(index.brands).length;
    const models = Object.keys(index.models).length;
    let engines = 0;
    Object.values(index.models).forEach((m) => engines += m.engines.length);

    if (q("#statBrands")) q("#statBrands").textContent = brands;
    if (q("#statModels")) q("#statModels").textContent = models;
    if (q("#statEngines")) q("#statEngines").textContent = engines;
    if (q("#statEntries")) q("#statEntries").textContent = catalog.defects.length;

    const last = loadWithMigration(KEYS.AUTO_LAST_SYNC, OLD_KEYS.AUTO_LAST_SYNC, 0);
    if (q("#lastSyncText")) q("#lastSyncText").textContent = last ? `Dernière synchro : ${new Date(last).toLocaleString("fr-FR")}` : "Dernière synchro : jamais.";
  };

  const renderAdminIfOpen = () => {
    const panel = q("#adminPanel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (!currentUser || currentUser.role !== "admin") return;
    renderAdmin();
  };

  const renderAdmin = () => {
    updateAdminStats();
    renderPendingRequests();
    renderUsers();
    renderWallpaperPreview();
    const settings = getSettings();
    const emailInput = q("#adminEmailInput");
    if (emailInput) emailInput.value = settings.adminEmail || "";
  };

  const renderPendingRequests = () => {
    const wrap = q("#pendingRequestsList");
    if (!wrap) return;
    const reqs = pendingRequests();
    if (!reqs.length) {
      wrap.innerHTML = '<div class="empty">Aucune demande en attente.</div>';
      return;
    }
    wrap.innerHTML = reqs.map((r) => `
      <div class="admin-item">
        <div class="admin-item-head">
          <div>
            <strong>${esc(r.name)}</strong><br/>
            <span class="muted">${esc(r.email)}</span>
          </div>
          <span class="pill soft">${esc(r.date)}</span>
        </div>
        <div class="muted">${esc(r.reason)}</div>
        <div class="admin-actions">
          <button class="small-btn" data-action="approve" data-id="${esc(r.id)}">✔ Accepter</button>
          <button class="small-btn" data-action="refuse" data-id="${esc(r.id)}">✖ Refuser</button>
          <button class="small-btn" data-action="mail-admin" data-id="${esc(r.id)}">✉ Mail admin</button>
        </div>
      </div>
    `).join("");
  };

  const renderUsers = () => {
    const wrap = q("#approvedUsersList");
    if (!wrap) return;
    const users = getUsers().filter((u) => u.role !== "admin");
    if (!users.length) {
      wrap.innerHTML = '<div class="empty">Aucun compte tiers.</div>';
      return;
    }
    wrap.innerHTML = users.map((u) => {
      const grantUrl = makeAccessGrantUrl(u);
      return `
        <div class="admin-item">
          <div class="admin-item-head">
            <div>
              <strong>${esc(u.name)}</strong><br/>
              <span class="muted">${esc(u.email)}</span>
            </div>
            <span class="pill ${u.status === "approved" ? "" : "soft"}">${esc(u.status)}</span>
          </div>
          <div class="admin-actions">
            <button class="small-btn" data-action="copy-link" data-url="${esc(grantUrl)}">🔗 Copier lien</button>
            <button class="small-btn" data-action="mail-user" data-email="${esc(u.email)}" data-name="${esc(u.name)}" data-url="${esc(grantUrl)}">✉ Mail utilisateur</button>
            ${u.status === "approved"
              ? `<button class="small-btn" data-action="revoke" data-email="${esc(u.email)}">⛔ Révoquer</button>`
              : `<button class="small-btn" data-action="restore" data-email="${esc(u.email)}">♻ Rétablir</button>`}
          </div>
        </div>
      `;
    }).join("");
  };

  const applyBackground = (dataUrl, persist = true) => {
    if (dataUrl) {
      document.body.classList.add("has-custom-bg");
      document.documentElement.style.setProperty("--custom-bg", `url(${dataUrl})`);
      if (persist) {
        try { save(KEYS.BACKGROUND, dataUrl); } catch { toast("Fond trop lourd à sauvegarder.", "warning"); }
      }
    } else {
      document.body.classList.remove("has-custom-bg");
      document.documentElement.style.removeProperty("--custom-bg");
      if (persist) del(KEYS.BACKGROUND);
    }
    renderWallpaperPreview();
  };

  const renderWallpaperPreview = () => {
    const preview = q("#wallpaperPreview");
    if (!preview) return;
    const bg = load(KEYS.BACKGROUND, null);
    preview.style.backgroundImage = bg ? `url(${bg})` : "";
  };

  const generateDefaultWallpaper = () => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext("2d");

    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#07101f");
    g.addColorStop(0.45, "#0f172a");
    g.addColorStop(1, "#111827");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    const glow = ctx.createRadialGradient(220, 240, 20, 220, 240, 520);
    glow.addColorStop(0, "rgba(59,130,246,0.45)");
    glow.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);

    const glow2 = ctx.createRadialGradient(860, 360, 20, 860, 360, 500);
    glow2.addColorStop(0, "rgba(139,92,246,0.35)");
    glow2.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * 2.2 + 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 82px Inter, Arial, sans-serif";
    ctx.fillText("Expert Auto", 80, 300);

    ctx.fillStyle = "rgba(148,163,184,0.95)";
    ctx.font = "36px Inter, Arial, sans-serif";
    ctx.fillText("Analyse croisée technique + juridique", 82, 370);
    ctx.fillText("Dynamic Auto-Diagnostic • PWA / APK", 82, 420);

    return c.toDataURL("image/png");
  };

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadText = (text, filename, mime = "application/json") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadWallpaper = () => {
    const bg = load(KEYS.BACKGROUND, null) || generateDefaultWallpaper();
    downloadDataUrl(bg, "wallpaper.png");
    toast("Fond d’écran téléchargé pour intégration APK.", "success");
  };

  const downloadManifest = () => {
    fetch("./manifest.json", { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => downloadText(txt, "manifest.json"))
      .catch(() => toast("manifest.json indisponible.", "error"));
  };

  const downloadCapacitorConfig = () => {
    fetch("./capacitor.config.json", { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => downloadText(txt, "capacitor.config.json"))
      .catch(() => toast("capacitor.config.json indisponible.", "error"));
  };

  const updateInstallUI = () => {
    const btn = q("#installBtn");
    const hint = q("#installHint");
    if (!btn) return;
    if (deferredPrompt) {
      btn.disabled = false;
      btn.textContent = "📲 Installer l’application";
      if (hint) hint.textContent = "Installation PWA disponible directement depuis ce navigateur.";
    } else {
      btn.disabled = false;
      btn.textContent = "📲 Instructions d’installation";
      if (hint) hint.textContent = "Sur Android Chrome : menu ⋮ → “Ajouter à l’écran d’accueil”. Pour un APK natif, utiliser Capacitor et le fichier wallpaper.png.";
    }
  };

  const registerServiceWorker = () => {
    try {
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js")
          .then((reg) => {
            swRegistration = reg;
            return navigator.serviceWorker.ready;
          })
          .then((reg) => {
            swRegistration = reg;
            console.log("[EXPERT-AUTO] SW prêt.");
            try {
              if (reg.periodicSync?.register) {
                reg.periodicSync.register("catalog-sync", { minInterval: 60 * 60 * 1000 }).catch(() => {});
              } else if (reg.sync?.register) {
                reg.sync.register("catalog-sync").catch(() => {});
              }
            } catch {}
          })
          .catch((err) => console.warn("[EXPERT-AUTO] SW non enregistré:", err));
      }
    } catch (e) { console.warn("[EXPERT-AUTO] SW impossible:", e); }
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

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsText(file);
  });

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const importJsonFile = async (file, type) => {
    try {
      const txt = await readFileAsText(file);
      const json = JSON.parse(txt);
      if (type === "models") mergeRemoteModels(json);
      if (type === "engines") mergeRemoteEngines(json);
      if (type === "defects") mergeRemoteDefects(json);
      updateAdminStats();
      refreshSelectionLists();
      toast("Import JSON réussi.", "success");
    } catch (e) {
      console.warn(e);
      toast("Import JSON échoué : fichier invalide.", "error");
    }
  };

  /* =========================================================
     BIND UI
     ========================================================= */
  const bindUi = () => {
    qa(".tab-btn[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qa(".tab-btn[data-auth-tab]").forEach((b) => b.classList.remove("active"));
        qa(".auth-pane").forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        const pane = q("#" + btn.dataset.authTab + "Pane");
        if (pane) pane.classList.remove("hidden");
        authMessage("", "");
      });
    });

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
      if (requests.find((r) => r.emailNorm === emailKey && r.status === "pending")) {
        authMessage("Demande déjà en attente.", "warning"); return;
      }
      if (findApprovedUser(name, email)) {
        authMessage("Accès déjà accordé. Utilisez Connexion tiers.", "success"); return;
      }
      const req = migrateRequest({
        id: uid(), name, email, reason, status: "pending",
        date: new Date().toLocaleString("fr-FR"), ts: Date.now(), source: "formulaire-local"
      });
      requests.push(req);
      saveRequests(requests);
      publishAccessRequest(req);
      authMessage("Demande envoyée.", "success");
      if (nameEl) nameEl.value = "";
      if (emailEl) emailEl.value = "";
      if (reasonEl) reasonEl.value = "";
    });

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
        if (pending) { authMessage("Votre demande est en attente de validation admin.", "warning"); return; }
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

    on("#brandInput", "input", () => {
      selection.brand = null;
      selection.model = null;
      selection.engine = null;
      engineFuelFilter = "all";
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

    on("#modelSearch", "input", function () { renderModelList(this.value); });

    on("#modelList", "mousedown", (e) => {
      const btn = e.target.closest("[data-model-index]");
      if (!btn) return;
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-model-index"), 10);
      if (window.__tempModelOptions?.[idx]) selectModel(window.__tempModelOptions[idx]);
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

    on("#engineSearch", "input", function () { renderEngineList(this.value); });

    on("#engineFilters", "click", (e) => {
      const chip = e.target.closest("[data-fuel-filter]");
      if (!chip) return;
      engineFuelFilter = chip.getAttribute("data-fuel-filter");
      renderEngineList(q("#engineSearch")?.value || "");
    });

    on("#engineList", "mousedown", (e) => {
      const btn = e.target.closest("[data-engine-index]");
      if (!btn) return;
      e.preventDefault();
      const idx = parseInt(btn.getAttribute("data-engine-index"), 10);
      if (window.__tempEngineOptions?.[idx]) selectEngine(window.__tempEngineOptions[idx]);
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".combo")) closeAllCombos();
    });

    on("#analyzeBtn", "click", () => {
      if (!currentUser) { toast("Connectez-vous.", "error"); return; }
      const info = dailyInfo();
      if (!info.allowed) { toast(`Limite de ${CONFIG.maxDailyAnalyses} analyses/jour atteinte.`, "warning"); return; }

      const textEl = q("#textInput");
      const contextEl = q("#contextInfo");
      const objectiveEl = q("#objectiveInfo");
      const goalEl = q("#goalSelect");
      const sellerEl = q("#sellerType");

      const text = (textEl?.value || "").trim();
      const context = (contextEl?.value || "").trim();
      const objective = (objectiveEl?.value || "").trim() || (goalEl?.value || "");
      const sellerType = sellerEl?.value || "unknown";

      vehicleData = getSelectedVehicleData();
      if (!text) { toast("Saisissez des faits.", "warning"); return; }

      termesMobilises = new Set();
      const btn = q("#analyzeBtn");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Analyse croisée dynamique en cours...';
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
            btn.innerHTML = "🔍 Lancer l’analyse croisée technique + juridique + Auto-Diagnostic";
          }
        }
      }, 500);
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

    qa(".tab-btn[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qa(".tab-btn[data-admin-tab]").forEach((b) => b.classList.remove("active"));
        qa(".admin-pane").forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        const pane = q("#" + btn.dataset.adminTab + "Pane");
        if (pane) pane.classList.remove("hidden");
      });
    });

    on("#adminPanel", "click", async (e) => {
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
            id: req.id, name: req.name, email: req.email, role: "user", status: "approved",
            daily: { date: todayKey(), count: 0 }
          });
          req.userId = user.key;
          notify("Accès approuvé", `${req.name} (${req.email})`);
          const grantUrl = makeAccessGrantUrl(user);
          sendUserApprovalMail(user, grantUrl);
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

      if (action === "copy-link") {
        const url = btn.dataset.url || "";
        try {
          await navigator.clipboard.writeText(url);
          toast("Lien copié.", "success");
        } catch {
          prompt("Copiez le lien :", url);
        }
      }

      if (action === "mail-user") {
        const email = btn.dataset.email || "";
        const name = btn.dataset.name || "";
        const url = btn.dataset.url || "";
        mailto(email, "[Expert Auto] Votre accès", `Bonjour ${name},\n\nVotre lien d'accès :\n${url}`);
      }

      if (action === "mail-admin") {
        const id = btn.dataset.id;
        const req = getRequests().find((r) => r.id === id);
        if (req) sendAdminMail(req);
      }
    });

    on("#syncNowBtn", "click", () => syncRemoteCatalog(true));
    on("#clearCacheBtn", "click", clearCacheAndReload);

    on("#exportDataBtn", "click", () => {
      const data = {
        exportedAt: new Date().toISOString(),
        users: getUsers(),
        requests: getRequests(),
        catalogStats: {
          brands: Object.keys(index.brands).length,
          models: Object.keys(index.models).length,
          defects: catalog.defects.length
        }
      };
      downloadText(JSON.stringify(data, null, 2), "expert-auto-data-v30.json");
      toast("Données exportées.", "success");
    });

    on("#importModelsInput", "change", async (e) => {
      const file = e.target.files?.[0];
      if (file) await importJsonFile(file, "models");
      e.target.value = "";
    });

    on("#importEnginesInput", "change", async (e) => {
      const file = e.target.files?.[0];
      if (file) await importJsonFile(file, "engines");
      e.target.value = "";
    });

    on("#importDefectsInput", "change", async (e) => {
      const file = e.target.files?.[0];
      if (file) await importJsonFile(file, "defects");
      e.target.value = "";
    });

    on("#wallpaperInput", "change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        applyBackground(dataUrl, true);
        toast("Fond d’écran appliqué.", "success");
      } catch {
        toast("Impossible de lire l’image.", "error");
      }
      e.target.value = "";
    });

    on("#resetWallpaperBtn", "click", () => {
      applyBackground(null, true);
      toast("Fond réinitialisé.", "info");
    });

    on("#downloadWallpaperBtn", "click", downloadWallpaper);
    on("#downloadWallpaperBtn2", "click", downloadWallpaper);
    on("#downloadManifestBtn", "click", downloadManifest);
    on("#downloadCapacitorBtn", "click", downloadCapacitorConfig);

    on("#saveSettingsBtn", "click", () => {
      const email = (q("#adminEmailInput")?.value || "").trim();
      saveSettings({ adminEmail: email });
      toast("Paramètres enregistrés.", "success");
    });

    on("#installBtn", "click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        if (choice?.outcome === "accepted") toast("Application installée.", "success");
        deferredPrompt = null;
        updateInstallUI();
      } else {
        alert("Pour installer :\n- Android Chrome : menu ⋮ → Ajouter à l’écran d’accueil\n- iOS Safari : Partager → Sur l’écran d’accueil\n- APK natif : suivre APK-README.md avec Capacitor.");
      }
    });

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      updateInstallUI();
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      updateInstallUI();
      toast("Application installée.", "success");
    });

    window.addEventListener("online", () => syncRemoteCatalog(false));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        enforceTierAccess();
        syncRemoteCatalog(false);
      }
    });

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "periodic-sync") syncRemoteCatalog(false);
      });
    }
  };

  /* =========================================================
     INIT
     ========================================================= */
  const init = async () => {
    initSeed();
    applyBackground(load(KEYS.BACKGROUND, null), false);
    updateAdminStats();
    updateNotificationState();
    registerServiceWorker();
    refreshSavedPasswordButton();
    updateInstallUI();

    processIncomingAccessRequestFromUrl();
    if (processIncomingAccessGrantFromUrl()) {
      updateNotificationBell();
      startLiveSync();
      return;
    }

    if (restoreSession()) showApp();
    else showLogin();

    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();

    await syncRemoteCatalog(false);
    startLiveSync();

    toast("Application prête. Analyse dynamique sans filtre année.", "success");
  };

  const boot = () => {
    try {
      bindUi();
      init();
    } catch (e) {
      console.warn("[EXPERT-AUTO] Boot dégradé:", e);
      const status = q("#dataStatus");
      if (status) status.textContent = "Mode dégradé actif";
      const login = q("#loginScreen");
      if (login) login.classList.remove("hidden");
      const app = q("#mainApp");
      if (app) app.classList.add("hidden");
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
