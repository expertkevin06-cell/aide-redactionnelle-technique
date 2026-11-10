(() => {
  "use strict";

  const VERSION = "v36-predictive-fix";
  const ADMIN_PASSWORD = "Kevin83600";
  const MAX_DAILY_ANALYSES = 10;

  const DB_NAME = "expert_auto_v36_predictive";
  const DB_VERSION = 1;
  const STORES = ["meta", "brands", "models", "engines", "defects", "assets"];

  const KEYS = {
    SESSION: "arex_session_v36",
    USERS: "arex_users_v36",
    REQUESTS: "arex_requests_v36",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v36",
    SETTINGS: "arex_settings_v36",
    LAST_SYNC: "arex_last_sync_v36"
  };

  const OLD_KEYS = {
    SESSION: "arex_session_v35",
    USERS: "arex_users_v35",
    REQUESTS: "arex_requests_v35",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v35",
    SETTINGS: "arex_settings_v35",
    LAST_SYNC: "arex_last_sync_v35"
  };

  const LOCAL_DATA_PATHS = [
    "./data/auto-diagnostic-export.json",
    "./data/apk-base.json",
    "./data/base.json"
  ];

  const SEPARATE_DATA_PATHS = [
    ["./data/brands.json", "brands"],
    ["./data/marques.json", "brands"],
    ["./data/models.json", "models"],
    ["./data/modeles.json", "models"],
    ["./data/vehicles.json", "models"],
    ["./data/engines.json", "engines"],
    ["./data/motorisations.json", "engines"],
    ["./data/moteurs.json", "engines"],
    ["./data/defects.json", "defects"],
    ["./data/pannes.json", "defects"],
    ["./data/rappels.json", "defects"],
    ["./data/recalls.json", "defects"],
    ["./data/technical-updates.json", "defects"]
  ];

  const REMOTE_BASES = [
    "https://expertkevin06-cell.github.io/auto-diagnostic/"
  ];

  /* =========================================================
     HELPERS DOM / TEXTE / STOCKAGE
     ========================================================= */
  const $ = (sel) => {
    try { return document.querySelector(sel); } catch { return null; }
  };

  const $$ = (sel) => {
    try { return Array.from(document.querySelectorAll(sel)); } catch { return []; }
  };

  const on = (sel, evt, fn) => {
    const el = $(sel);
    if (el) el.addEventListener(evt, fn);
  };

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
    const cur = load(newKey, null);
    if (cur != null) return cur;
    const old = load(oldKey, null);
    if (old != null) {
      save(newKey, old);
      return old;
    }
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

  const normSearch = (s) => {
    let v = String(s == null ? "" : s).toLowerCase();
    if (v.normalize) v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return v.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  };

  const splitList = (v) => String(v == null ? "" : v)
    .split(/[|,;\n]/)
    .map((x) => String(x || "").trim())
    .filter(Boolean);

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

  const containsAny = (text, list) => {
    const t = norm(text);
    return (list || []).some((x) => t.includes(norm(x)));
  };

  const isElectricLike = (fuel) => /electrique|bev|ev|hybride rechargeable|plug.in|phev/.test(norm(fuel));

  const debounce = (fn, ms) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  const ensureToast = () => {
    let t = $("#toast");
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
    el._timer = setTimeout(() => el.classList.add("hidden"), 5000);
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

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("Lecture impossible"));
    fr.readAsText(file);
  });

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("Lecture image impossible"));
    fr.readAsDataURL(file);
  });

  const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!n) return "0 o";
    const units = ["o", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + units[i];
  };

  /* =========================================================
     RECHERCHE PRÉDICTIVE ROBUSTE
     ========================================================= */
  const BRAND_ALIASES = {
    volkswagen: ["vw", "volkswagen"],
    mercedesbenz: ["mercedes", "mb", "mercedes benz"],
    landrover: ["land rover"],
    rangerover: ["range rover"],
    alfaromeo: ["alfa", "alfa romeo"],
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
    vag: ["volkswagen audi group"],
    peugeot: ["peugeot france"],
    renault: ["renault sa"],
    citroen: ["citroen france"],
    bmw: ["bayerische motoren werke"],
    audi: ["audi ag"],
    skoda: ["skoda auto"],
    seat: ["sociedad espanola de automoviles"],
    volvo: ["volvo cars"]
  };

  const brandFields = (name) => {
    const nk = normKey(name);
    const list = [name];
    const aliases = BRAND_ALIASES[nk];
    if (aliases && aliases.length) list.push(...aliases);
    return list;
  };

  const scoreFields = (fields, query) => {
    const q = normSearch(query);
    const tokens = q ? q.split(" ").filter(Boolean) : [];
    const cleanFields = (fields || []).map(normSearch).filter(Boolean);

    if (!q) return 1;
    if (!cleanFields.length) return 0;

    let matched = 0;
    tokens.forEach((t) => {
      if (cleanFields.some((f) => f.includes(t))) matched++;
    });

    if (tokens.length && matched === 0) return 0;

    let score = matched * 100;
    if (tokens.length && matched === tokens.length) score += 200;

    cleanFields.forEach((f) => {
      if (f === q) score += 1000;
      else if (f.startsWith(q)) score += 500;
      else if (f.includes(q)) score += 250;
    });

    return score;
  };

  const rankFuel = (fuel) => {
    const order = ["Essence", "Diesel", "Hybride", "Hybride rechargeable", "Hybride léger 48V", "GPL", "Électrique"];
    const i = order.indexOf(fuel);
    return i === -1 ? 99 : i;
  };

  /* =========================================================
     INDEXEDDB
     ========================================================= */
  let db = null;

  const openDb = () => new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const d = event.target.result;
        STORES.forEach((store) => {
          if (!d.objectStoreNames.contains(store)) {
            d.createObjectStore(store, { keyPath: "key" });
          }
        });
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  const idbAll = (store) => new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }

    try {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });

  const idbClear = (store) => new Promise((resolve) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  const idbPutAll = (store, items) => new Promise((resolve, reject) => {
    if (!db || !items || !items.length) {
      resolve();
      return;
    }

    try {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      items.forEach((item) => os.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Transaction IndexedDB en erreur"));
      tx.onabort = () => reject(tx.error || new Error("Transaction IndexedDB abortée"));
    } catch (e) {
      reject(e);
    }
  });

  const idbPutAllChunked = async (store, items) => {
    const chunk = 300;
    for (let i = 0; i < items.length; i += chunk) {
      await idbPutAll(store, items.slice(i, i + chunk));
    }
  };

  const idbGetAsset = (key) => new Promise((resolve) => {
    if (!db) {
      resolve(null);
      return;
    }

    try {
      const tx = db.transaction("assets", "readonly");
      const req = tx.objectStore("assets").get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  const idbSetAsset = (item) => new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }

    try {
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Échec sauvegarde asset"));
    } catch (e) {
      reject(e);
    }
  });

  const idbDeleteAsset = (key) => new Promise((resolve) => {
    if (!db) {
      resolve();
      return;
    }

    try {
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  /* =========================================================
     MÉMOIRE
     ========================================================= */
  const mem = {
    brands: new Map(),
    models: new Map(),
    engines: new Map(),
    defects: new Map()
  };

  const counts = () => ({
    brands: mem.brands.size,
    models: mem.models.size,
    engines: mem.engines.size,
    defects: mem.defects.size
  });

  const addSource = (obj, source) => {
    obj.sources = obj.sources || [];
    if (source && !obj.sources.includes(source)) obj.sources.push(source);
  };

  const recomputeCounts = () => {
    mem.brands.forEach((b) => { b.modelCount = 0; });
    mem.models.forEach((m) => { m.engineCount = 0; });

    mem.models.forEach((m) => {
      const b = mem.brands.get(m.brandKey);
      if (b) b.modelCount = (b.modelCount || 0) + 1;
    });

    mem.engines.forEach((e) => {
      const m = mem.models.get(e.modelKey);
      if (m) m.engineCount = (m.engineCount || 0) + 1;
    });
  };

  const ensureBrand = (name, source = "local") => {
    name = String(name || "").trim();
    if (!name) return false;

    const key = normKey(name);
    if (mem.brands.has(key)) {
      addSource(mem.brands.get(key), source);
      return false;
    }

    mem.brands.set(key, {
      key,
      name,
      modelCount: 0,
      sources: [source],
      updatedAt: Date.now()
    });

    return true;
  };

  const ensureModel = (brandName, modelName, source = "local") => {
    brandName = String(brandName || "").trim();
    modelName = String(modelName || "").trim();
    if (!brandName || !modelName) return false;

    ensureBrand(brandName, source);

    const bk = normKey(brandName);
    const key = `${bk}|${normKey(modelName)}`;

    if (mem.models.has(key)) {
      addSource(mem.models.get(key), source);
      return false;
    }

    mem.models.set(key, {
      key,
      brandKey: bk,
      brandName,
      name: modelName,
      engineCount: 0,
      sources: [source],
      updatedAt: Date.now()
    });

    return true;
  };

  const addEngine = (brandName, modelName, engine, power, fuel, transmission, code, source = "local") => {
    brandName = String(brandName || "").trim();
    modelName = String(modelName || "").trim();
    engine = String(engine || "").trim();

    if (!brandName || !modelName || !engine) return 0;

    ensureBrand(brandName, source);
    ensureModel(brandName, modelName, source);

    const bk = normKey(brandName);
    const mk = normKey(modelName);
    const modelKey = `${bk}|${mk}`;

    let added = 0;
    const powers = splitList(power);
    if (!powers.length) powers.push("");

    powers.forEach((p) => {
      const key = [
        modelKey,
        normKey(engine),
        normKey(p),
        normKey(fuel),
        normKey(transmission),
        normKey(code)
      ].join("|");

      if (mem.engines.has(key)) return;

      mem.engines.set(key, {
        key,
        modelKey,
        brandKey: bk,
        brandName,
        modelName,
        engine,
        power: String(p || "").trim(),
        fuel: String(fuel || "").trim(),
        transmission: String(transmission || "").trim(),
        code: String(code || "").trim(),
        displacement: /l|cm3|kwh|cylindrée/i.test(String(code || "")) ? String(code) : "",
        sources: [source],
        confidence: String(source || "").includes("distant") ? 0.98 : 0.95,
        updatedAt: Date.now()
      });

      added++;
    });

    return added;
  };

  const addDefect = (d) => {
    if (!d || !d.brand) return 0;

    const normalized = {
      brand: String(d.brand || "").trim(),
      models: unique(d.models || []),
      engines: unique(d.engines || []),
      powers: unique(d.powers || []),
      fuels: unique(d.fuels || []),
      symptoms: unique(d.symptoms || []),
      description: String(d.description || "").trim()
    };

    const key = normKey(JSON.stringify(normalized));
    if (mem.defects.has(key)) return 0;

    mem.defects.set(key, {
      key,
      brand: normalized.brand,
      models: normalized.models,
      engines: normalized.engines,
      powers: normalized.powers,
      fuels: normalized.fuels,
      symptoms: normalized.symptoms,
      severity: String(d.severity || "info").trim().toLowerCase(),
      description: normalized.description,
      legal: String(d.legal || "").trim(),
      recall: String(d.recall || "").trim(),
      tags: String(d.tags || "").trim(),
      dtc: String(d.dtc || "").trim(),
      source: String(d.source || "base locale").trim(),
      sourceUrl: String(d.sourceUrl || "").trim(),
      sources: [String(d.source || "base locale").trim()],
      updatedAt: Date.now()
    });

    return 1;
  };

  const clearMemory = () => {
    mem.brands.clear();
    mem.models.clear();
    mem.engines.clear();
    mem.defects.clear();
  };

  const loadMemoryFromDb = async () => {
    clearMemory();

    const brands = await idbAll("brands");
    const models = await idbAll("models");
    const engines = await idbAll("engines");
    const defects = await idbAll("defects");

    brands.forEach((b) => mem.brands.set(b.key, b));
    models.forEach((m) => mem.models.set(m.key, m));
    engines.forEach((e) => mem.engines.set(e.key, e));
    defects.forEach((d) => mem.defects.set(d.key, d));

    recomputeCounts();
  };

  const persistMemory = async () => {
    if (!db) return;

    await Promise.all([
      idbClear("brands"),
      idbClear("models"),
      idbClear("engines"),
      idbClear("defects")
    ]);

    await idbPutAllChunked("brands", [...mem.brands.values()]);
    await idbPutAllChunked("models", [...mem.models.values()]);
    await idbPutAllChunked("engines", [...mem.engines.values()]);
    await idbPutAllChunked("defects", [...mem.defects.values()]);

    await idbPutAll("meta", [{
      key: "state",
      version: VERSION,
      updatedAt: Date.now(),
      counts: counts()
    }]);
  };

  /* =========================================================
     NORMALISATION JSON / IMPORT
     ========================================================= */
  const getField = (obj, keys) => {
    if (!obj || typeof obj !== "object") return "";

    for (const k of keys) {
      if (obj[k] != null && String(obj[k]).trim()) return String(obj[k]).trim();
    }

    const lower = {};
    for (const p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        lower[normKey(p)] = p;
      }
    }

    for (const k of keys) {
      const real = lower[normKey(k)];
      if (real && obj[real] != null && String(obj[real]).trim()) return String(obj[real]).trim();
    }

    return "";
  };

  const getArray = (obj, keys) => {
    if (!obj || typeof obj !== "object") return [];

    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k];
    }

    const lower = {};
    for (const p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        lower[normKey(p)] = p;
      }
    }

    for (const k of keys) {
      const real = lower[normKey(k)];
      if (real && Array.isArray(obj[real])) return obj[real];
    }

    return [];
  };

  const pickString = (row, keys) => getField(row, keys);

  const toArrayStrings = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (v == null) return "";
          if (typeof v === "object") {
            return getField(v, ["name", "model", "modele", "engine", "motorisation", "moteur", "brand", "marque", "value", "text", "label"]) || JSON.stringify(v);
          }
          return String(v).trim();
        })
        .filter(Boolean);
    }

    if (value == null) return [];
    return splitList(value);
  };

  const pickArray = (row, keys) => {
    const arr = getArray(row, keys);
    if (arr.length) return toArrayStrings(arr);

    const s = pickString(row, keys);
    return s ? splitList(s) : [];
  };

  const inferKind = (row) => {
    if (typeof row === "string") return "brands";
    if (!row || typeof row !== "object") return null;

    const keys = Object.keys(row).map(normKey).join("|");

    if (/(symptoms?|symptomes?|pannes?|panne|defauts?|defaut|faults?|issues?|dtc|rappels?|rappel|recalls?|description|fiche|expertise)/.test(keys)) {
      return "defects";
    }

    if (/(engines?|motorisations?|moteurs?|power|puissance|fuel|energie|carburant|transmission|boite)/.test(keys)) {
      return "engines";
    }

    if (/(models?|modeles?|vehicles?|vehicules?)/.test(keys) && /(brands?|marques?)/.test(keys)) {
      return "models";
    }

    if (/(brands?|marques?|constructeurs?)/.test(keys)) {
      return "brands";
    }

    return null;
  };

  const ingestRow = (row, source, forcedKind) => {
    const stats = { brands: 0, models: 0, engines: 0, defects: 0, invalid: 0, duplicates: 0 };

    if (!row) {
      stats.invalid++;
      return stats;
    }

    if (typeof row === "string") {
      if (ensureBrand(row, source)) stats.brands++;
      else stats.duplicates++;
      return stats;
    }

    if (typeof row !== "object") {
      stats.invalid++;
      return stats;
    }

    const kind = forcedKind && forcedKind !== "auto" ? forcedKind : (inferKind(row) || "auto");

    const brand = pickString(row, ["brand", "marque", "b", "constructeur", "make", "brandName", "brand_name", "name", "nom", "label"]);
    const model = pickString(row, ["model", "modele", "modèle", "m", "vehicle", "vehicule", "modelName", "model_name", "name", "nom", "label"]);
    const engine = pickString(row, ["engine", "motorisation", "moteur", "e", "version", "variant", "powertrain", "engineName", "engine_name"]);
    const power = pickString(row, ["power", "puissance", "p", "ch", "kw", "hp"]);
    const fuel = pickString(row, ["fuel", "energie", "énergie", "type", "t", "carburant", "engineType", "energy"]);
    const transmission = pickString(row, ["transmission", "boite", "boîte", "gearbox", "tr"]);
    const code = pickString(row, ["code", "engineCode", "codeMoteur", "codemoteur", "cylindree", "cylindrée", "displacement", "d", "cyl"]);

    if (kind === "brands" || (kind === "auto" && brand && !model && !engine)) {
      if (brand) {
        if (ensureBrand(brand, source)) stats.brands++;
        else stats.duplicates++;
      } else {
        stats.invalid++;
      }
      return stats;
    }

    if (kind === "models" || (kind === "auto" && brand && model && !engine)) {
      if (brand && model) {
        if (ensureModel(brand, model, source)) stats.models++;
        else stats.duplicates++;
      } else {
        stats.invalid++;
      }
      return stats;
    }

    if (kind === "engines" || (kind === "auto" && brand && model && engine)) {
      if (brand && model && engine) {
        const added = addEngine(brand, model, engine, power, fuel, transmission, code, source);
        stats.engines += added;
        if (!added) stats.duplicates++;
      } else {
        stats.invalid++;
      }
      return stats;
    }

    if (kind === "defects") {
      if (!brand) {
        stats.invalid++;
        return stats;
      }

      const models = pickArray(row, ["models", "modeles", "model", "modele", "vehicle", "vehicule"]);
      if (!models.length && model) models.push(model);

      const engines = pickArray(row, ["engines", "motorisations", "moteurs", "engine", "motorisation", "moteur", "e"]);
      if (!engines.length && engine) engines.push(engine);

      const powers = pickArray(row, ["powers", "puissances", "power", "puissance", "p"]);
      if (!powers.length && power) powers.push(power);

      const fuels = pickArray(row, ["fuels", "energies", "fuel", "energie", "type", "t", "carburants", "carburant"]);
      if (!fuels.length && fuel) fuels.push(fuel);

      const symptoms = pickArray(row, ["symptoms", "symptomes", "s", "pannes", "panne", "defauts", "defaut", "problemes", "probleme", "faults", "issue", "issues"]);

      const description = pickString(row, [
        "description", "fiche", "expertise", "note", "n", "details", "resume", "résumé"
      ]);

      if (!symptoms.length && description) {
        symptoms.push(...splitList(description).slice(0, 8));
      }

      const tags = pickArray(row, ["tags", "tg", "keywords", "mots_cles", "motscles"]).join("|");
      const dtc = pickArray(row, ["dtc", "codes", "codeDtc", "code_defaut"]).join("|");

      const severity = (pickString(row, ["severity", "severite", "sev", "gravite"]) || "info").trim().toLowerCase();
      const legal = pickString(row, ["legal", "law", "baseLegale", "base_legale", "juridique"]);
      const recall = pickString(row, ["recall", "rappel", "campaign", "campagne", "rec", "tsb"]);
      const sourceUrl = pickString(row, ["sourceUrl", "url", "lien", "link", "href"]);

      const added = addDefect({
        brand,
        models,
        engines,
        powers,
        fuels,
        symptoms,
        severity,
        description,
        legal,
        recall,
        tags,
        dtc,
        source: pickString(row, ["source"]) || source,
        sourceUrl
      });

      if (added) stats.defects++;
      else stats.duplicates++;

      return stats;
    }

    if (brand && model && engine) {
      const added = addEngine(brand, model, engine, power, fuel, transmission, code, source);
      stats.engines += added;
      if (!added) stats.duplicates++;
      return stats;
    }

    if (brand && model) {
      if (ensureModel(brand, model, source)) stats.models++;
      else stats.duplicates++;
      return stats;
    }

    if (brand) {
      if (ensureBrand(brand, source)) stats.brands++;
      else stats.duplicates++;
      return stats;
    }

    stats.invalid++;
    return stats;
  };

  const addStats = (target, source) => {
    target.brands += source.brands || 0;
    target.models += source.models || 0;
    target.engines += source.engines || 0;
    target.defects += source.defects || 0;
    target.invalid += source.invalid || 0;
    target.duplicates += source.duplicates || 0;
  };

  const ingestPayload = (payload, source, forcedKind = "auto") => {
    const stats = { brands: 0, models: 0, engines: 0, defects: 0, invalid: 0, duplicates: 0 };

    const root = Array.isArray(payload)
      ? payload
      : (payload && typeof payload === "object"
        ? (payload.data || payload.catalog || payload.results || payload.items || payload.base || payload)
        : null);

    if (!root) return stats;

    const handle = (row, kind) => addStats(stats, ingestRow(row, source, kind));

    if (Array.isArray(root)) {
      root.forEach((row) => handle(row, forcedKind));
      return stats;
    }

    const brandArr = getArray(root, ["brands", "marques"]);
    const modelArr = getArray(root, ["models", "modeles", "vehicles", "vehicules"]);
    const engineArr = getArray(root, ["engines", "motorisations", "moteurs"]);
    const defectArr = getArray(root, ["defects", "pannes", "rappels", "recalls", "faults", "issues", "fiches", "fiches_expert"]);

    if (brandArr.length) brandArr.forEach((row) => handle(row, "brands"));
    if (modelArr.length) modelArr.forEach((row) => handle(row, "models"));
    if (engineArr.length) engineArr.forEach((row) => handle(row, "engines"));
    if (defectArr.length) defectArr.forEach((row) => handle(row, "defects"));

    if (!stats.brands && !stats.models && !stats.engines && !stats.defects) {
      const brandMap = root.brands || root.marques;
      if (brandMap && typeof brandMap === "object" && !Array.isArray(brandMap)) {
        Object.keys(brandMap).forEach((name) => handle({ brand: name }, "brands"));
      }

      const modelMap = root.models || root.modeles;
      if (modelMap && typeof modelMap === "object" && !Array.isArray(modelMap)) {
        Object.entries(modelMap).forEach(([brand, value]) => {
          toArrayStrings(value).forEach((model) => handle({ brand, model }, "models"));
        });
      }

      const engineMap = root.engines || root.motorisations || root.moteurs;
      if (engineMap && typeof engineMap === "object" && !Array.isArray(engineMap)) {
        Object.entries(engineMap).forEach(([key, value]) => {
          const parts = String(key).split("|");
          const brand = parts[0] || "";
          const model = parts[1] || "";

          toArrayStrings(value).forEach((item) => {
            if (typeof item === "string") {
              handle({ brand, model, engine: item }, "engines");
            } else if (item && typeof item === "object") {
              handle({ brand, model, ...item }, "engines");
            }
          });
        });
      }
    }

    if (!stats.brands && !stats.models && !stats.engines && !stats.defects) {
      Object.values(root).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((row) => handle(row, forcedKind));
        }
      });
    }

    return stats;
  };

  const validatePayloadPreview = (payload) => {
    const stats = { brands: 0, models: 0, engines: 0, defects: 0, invalid: 0 };

    const root = Array.isArray(payload)
      ? payload
      : (payload && typeof payload === "object"
        ? (payload.data || payload.catalog || payload.results || payload.items || payload.base || payload)
        : null);

    if (!root) return stats;

    const check = (row) => {
      if (!row) {
        stats.invalid++;
        return;
      }

      if (typeof row === "string") {
        stats.brands++;
        return;
      }

      if (typeof row !== "object") {
        stats.invalid++;
        return;
      }

      const kind = inferKind(row) || "auto";
      const brand = pickString(row, ["brand", "marque", "b", "constructeur", "make", "name", "nom", "label"]);
      const model = pickString(row, ["model", "modele", "modèle", "m", "vehicle", "vehicule", "name", "nom", "label"]);
      const engine = pickString(row, ["engine", "motorisation", "moteur", "e", "version", "variant"]);

      if (kind === "defects" && brand) stats.defects++;
      else if ((kind === "engines" || (kind === "auto" && brand && model && engine)) && brand && model && engine) stats.engines++;
      else if ((kind === "models" || (kind === "auto" && brand && model && !engine)) && brand && model) stats.models++;
      else if ((kind === "brands" || (kind === "auto" && brand && !model && !engine)) && brand) stats.brands++;
      else stats.invalid++;
    };

    if (Array.isArray(root)) {
      root.forEach(check);
      return stats;
    }

    const brandArr = getArray(root, ["brands", "marques"]);
    const modelArr = getArray(root, ["models", "modeles", "vehicles", "vehicules"]);
    const engineArr = getArray(root, ["engines", "motorisations", "moteurs"]);
    const defectArr = getArray(root, ["defects", "pannes", "rappels", "recalls", "faults", "issues", "fiches"]);

    brandArr.forEach(check);
    modelArr.forEach(check);
    engineArr.forEach(check);
    defectArr.forEach(check);

    if (!stats.brands && !stats.models && !stats.engines && !stats.defects) {
      Object.values(root).forEach((value) => {
        if (Array.isArray(value)) value.forEach(check);
      });
    }

    return stats;
  };

  /* =========================================================
     SEED LOCAL MINIMALISTE MAIS FONCTIONNEL
     ========================================================= */
  const SEED_BRANDS = [
    "Peugeot", "Citroen", "Renault", "Volkswagen", "Audi", "BMW", "Mercedes-Benz",
    "Toyota", "Skoda", "Tesla", "Ford", "Opel", "Seat", "Hyundai", "Kia"
  ];

  const SEED_MODELS = [
    ["Peugeot", "208"], ["Peugeot", "2008"], ["Peugeot", "308"], ["Peugeot", "3008"], ["Peugeot", "5008"],
    ["Citroen", "C3"], ["Citroen", "C4"], ["Citroen", "C5 Aircross"],
    ["Renault", "Clio"], ["Renault", "Captur"], ["Renault", "Megane"],
    ["Volkswagen", "Golf"], ["Volkswagen", "Polo"], ["Volkswagen", "Tiguan"],
    ["Audi", "A3"], ["Audi", "Q3"],
    ["BMW", "Serie 1"], ["BMW", "X1"],
    ["Mercedes-Benz", "Classe A"], ["Mercedes-Benz", "GLA"],
    ["Toyota", "Yaris"], ["Toyota", "Corolla"], ["Toyota", "RAV4"],
    ["Skoda", "Octavia"], ["Skoda", "Elroq"],
    ["Tesla", "Model 3"], ["Tesla", "Model Y"],
    ["Ford", "Focus"], ["Opel", "Corsa"], ["Seat", "Leon"],
    ["Hyundai", "Tucson"], ["Kia", "Sportage"]
  ];

  const SEED_ENGINES = [
    ["Peugeot", "208", "1.2 PureTech", "110ch|130ch", "Essence", "BVM6|EAT8", "EB2|1.2 L"],
    ["Peugeot", "208", "1.5 BlueHDi", "100ch", "Diesel", "BVM6", "DV5|1.5 L"],
    ["Peugeot", "208", "e-208", "100kW|115kW|156ch", "Électrique", "réducteur", "e-CMP|50 kWh"],

    ["Peugeot", "3008", "1.2 PureTech 130", "130ch", "Essence", "EAT8", "EB2|1.2 L"],
    ["Peugeot", "3008", "1.5 BlueHDi 130", "130ch", "Diesel", "EAT8", "DV5|1.5 L"],
    ["Peugeot", "3008", "Hybrid 225", "225ch", "Hybride rechargeable", "EAT8", "PHEV|1.6 L"],
    ["Peugeot", "3008", "e-3008", "210ch", "Électrique", "réducteur", "STLA Medium|73 kWh|97 kWh"],

    ["Renault", "Clio", "1.5 dCi", "90ch|110ch", "Diesel", "BVM6|EDC", "K9K|1.5 L"],
    ["Renault", "Clio", "E-Tech Hybrid", "140ch|145ch", "Hybride", "automatique", "TCe 140|1.6 L"],

    ["Volkswagen", "Golf", "1.5 TSI", "130ch|150ch", "Essence", "DSG|BVM6", "EA211 evo|1.5 L"],
    ["Volkswagen", "Golf", "2.0 TDI", "110ch|150ch|200ch", "Diesel", "DSG|BVM6", "EA288|2.0 L"],

    ["Tesla", "Model Y", "Long Range", "442ch|534ch", "Électrique", "AWD / réducteur", "BEV|75 kWh|82 kWh"],
    ["Skoda", "Elroq", "Elroq 60", "204ch", "Électrique", "RWD / réducteur", "MEB|63 kWh"]
  ];

  const SEED_DEFECTS = [
    {
      brand: "Peugeot",
      models: ["208", "2008", "308", "3008", "5008"],
      engines: ["EB2", "1.2 PureTech"],
      powers: ["110ch", "130ch"],
      fuels: ["Essence"],
      symptoms: ["courroie distribution", "wet belt", "désagrégation courroie", "crépine pompe à huile", "casse moteur", "pression huile basse", "consommation huile", "mode dégradé"],
      severity: "critique",
      description: "Courroie humide susceptible de se désagréger et d’obstruer la crépine de pompe à huile.",
      legal: "Vice caché 1641 C.civ.; tromperie L.213-1 C.consom.; pratique commerciale trompeuse L.121-2 C.consom.",
      recall: "TSB / extension Stellantis PureTech à vérifier via VIN",
      dtc: "P052B|P0011|P0300",
      tags: "moteur|distribution|courroie|huile|pompe",
      source: "base locale ingénieur"
    },
    {
      brand: "Renault",
      models: ["Clio", "Megane", "Scenic", "Kangoo"],
      engines: ["K9K", "1.5 dCi"],
      powers: ["90ch", "110ch"],
      fuels: ["Diesel"],
      symptoms: ["casse bielle", "claquement moteur", "usure coussinets", "pompe à huile", "bruit métallique", "pression huile basse", "voyant huile"],
      severity: "critique",
      description: "Risque de casse bielle / coussinets lié à la lubrification.",
      legal: "Vice caché 1641 C.civ.; responsabilité contractuelle 1231-1 C.civ.",
      recall: "Programme technique Renault K9K à vérifier via VIN",
      dtc: "P0524|P0525|P0300",
      tags: "moteur|huile|bielle|pompe",
      source: "base locale ingénieur"
    },
    {
      brand: "Tesla",
      models: ["Model 3", "Model Y"],
      engines: ["Électrique"],
      powers: [],
      fuels: ["Électrique"],
      symptoms: ["autopilot", "fsd", "phantom braking", "batterie 12v", "port de charge", "poignée", "logiciel", "dégradation batterie", "thermique", "autonomie", "adas", "caméra", "radar"],
      severity: "critique",
      description: "ADAS, batterie 12V, port de charge, dégradation batterie, logiciels, poignées, gestion thermique.",
      legal: "Sécurité L.423-1; conformité L.217-4; produits défectueux 1245.",
      recall: "NHTSA Tesla recalls; DGCCRF; SafetyGate.",
      dtc: "P0Axx|U1xxx|B1xxx",
      tags: "ADAS|batterie|charge|logiciel|sécurité",
      source: "base locale ingénieur"
    },
    {
      brand: "Skoda",
      models: ["Elroq", "Enyaq"],
      engines: ["MEB", "BMS", "batterie haute tension"],
      powers: ["55 kWh", "63 kWh", "77 kWh"],
      fuels: ["Électrique"],
      symptoms: ["autonomie réduite", "soh", "charge lente", "charge impossible", "déséquilibre cellules", "erreur BMS", "température batterie", "voyant batterie", "perte autonomie", "gonflement batterie", "odeur brûlée", "fumée"],
      severity: "critique",
      description: "Plateforme MEB : surveillance BMS, cellules, gestion thermique, dégradation d’autonomie.",
      legal: "Sécurité L.423-1 C.consom.; conformité L.217-4 C.consom.; produits défectueux 1245 C.civ.; vice caché 1641 C.civ.",
      recall: "Rappels EV/MEB; DGCCRF; KBA; NHTSA; vérification VIN; lecture SOH/BMS.",
      dtc: "P0Axx|U1xxx|P1xxx|B1xxx",
      tags: "batterie|charge|autonomie|électricité|sécurité|logiciel|MEB",
      source: "base locale ingénieur"
    }
  ];

  const seedLocal = () => {
    SEED_BRANDS.forEach((b) => ensureBrand(b, "seed-local"));
    SEED_MODELS.forEach(([b, m]) => ensureModel(b, m, "seed-local"));
    SEED_ENGINES.forEach(([b, m, e, p, f, tr, code]) => addEngine(b, m, e, p, f, tr, code, "seed-local"));
    SEED_DEFECTS.forEach(addDefect);
    recomputeCounts();
  };

  /* =========================================================
     ÉTAT GLOBAL
     ========================================================= */
  let currentUser = null;
  let vehicleData = {};
  let analysisData = {};
  let termesMobilises = new Set();
  let deferredPrompt = null;
  let swRegistration = null;
  let adminPollTimer = null;
  let autoSyncTimer = null;
  let lastPendingSignature = "";
  let broadcast = null;
  let syncBusy = false;
  let selectedJsonFile = null;

  const selection = { brand: null, model: null, engine: null };
  let engineFuelFilter = "all";

  try {
    if ("BroadcastChannel" in window) broadcast = new BroadcastChannel("arex_expert_channel_v36");
  } catch {
    broadcast = null;
  }

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
    const user = findApprovedUser(currentUser.name, currentUser.email) || currentUser;
    const daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;
    return { allowed: daily < MAX_DAILY_ANALYSES, remaining: Math.max(0, MAX_DAILY_ANALYSES - daily), unlimited: false };
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
    const el = $("#dailyCounter");
    if (!el) return;
    const info = dailyInfo();
    el.textContent = info.unlimited ? "👑 Admin illimité" : `📊 ${info.remaining}/${MAX_DAILY_ANALYSES}`;
  };

  const authMessage = (msg, type) => {
    const el = $("#authMsg");
    if (el) {
      el.textContent = msg;
      el.className = "auth-msg " + (type || "");
    } else {
      toast(msg, type || "info");
    }
  };

  const getSettings = () => loadWithMigration(KEYS.SETTINGS, OLD_KEYS.SETTINGS, { adminEmail: "", wallpaperOpacity: 35 }) || { adminEmail: "", wallpaperOpacity: 35 };
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
      toast("Accès approuvé importé.", "success");
      cleanUrlAfterParam();
      return true;
    } catch {
      toast("Lien d’accès invalide.", "error");
      return false;
    }
  };

  const pendingRequests = () => getRequests().filter((r) => r.status === "pending");
  const pendingSignature = () => pendingRequests().map((r) => r.id).sort().join("|");

  const updateNotificationBell = () => {
    const bell = $("#notifBellBtn");
    const badge = $("#notifBadge");
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
    const el = $("#notifState");
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
    if (!("Notification" in window)) {
      updateNotificationState();
      return "unsupported";
    }

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
        } catch {}
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

  const mailto = (to, subject, body) => {
    const url = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
    window.location.href = url;
  };

  const sendAdminMail = (req) => {
    const settings = getSettings();
    const adminEmail = settings.adminEmail || "";
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
    adminPollTimer = setInterval(pollAdminNotifications, 5000);
    const count = pendingRequests().length;
    if (count > 0) toast(`${count} demande(s) en attente`, "info");
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
    const btn = $("#useSavedPwdBtn");
    const saved = loadWithMigration(KEYS.ADMIN_PWD_HASH, OLD_KEYS.ADMIN_PWD_HASH, null);
    if (btn) btn.classList.toggle("hidden", !saved);
  };

  const verifyAdminPassword = async (input) => {
    if (!input) return false;
    const adminHash = await sha256(ADMIN_PASSWORD);
    const inputHash = await sha256(input);
    return inputHash === adminHash;
  };

  const loginAdminFromHash = async (savedHash) => {
    if (!savedHash) return false;
    const adminHash = await sha256(ADMIN_PASSWORD);
    return savedHash === adminHash;
  };

  const showApp = () => {
    const login = $("#loginScreen");
    if (login) login.classList.add("hidden");

    const app = $("#mainApp");
    if (app) app.classList.remove("hidden");

    const badge = $("#userBadge");
    if (badge) badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;

    const adminBtn = $("#adminPanelBtn");
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

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showLogin = () => {
    const login = $("#loginScreen");
    if (login) login.classList.remove("hidden");

    const app = $("#mainApp");
    if (app) app.classList.add("hidden");

    const admin = $("#adminPanel");
    if (admin) admin.classList.add("hidden");

    stopAdminPolling();
    updateNotificationBell();
    updateNotificationState();
    refreshSavedPasswordButton();
  };

  /* =========================================================
     STATUT / STATS
     ========================================================= */
  const setStatus = (msg) => {
    const el = $("#dataStatus");
    if (el) el.textContent = msg;
  };

  const updateStats = () => {
    const c = counts();

    if ($("#statBrands")) $("#statBrands").textContent = c.brands;
    if ($("#statModels")) $("#statModels").textContent = c.models;
    if ($("#statEngines")) $("#statEngines").textContent = c.engines;
    if ($("#statEntries")) $("#statEntries").textContent = c.defects;

    const last = loadWithMigration(KEYS.LAST_SYNC, OLD_KEYS.LAST_SYNC, 0);
    if ($("#lastSyncText")) {
      $("#lastSyncText").textContent = last
        ? `Dernière synchro : ${new Date(last).toLocaleString("fr-FR")}`
        : "Dernière synchro : jamais.";
    }

    if ($("#remoteStatus")) {
      $("#remoteStatus").textContent = `Version ${VERSION} • Recherche prédictive corrigée • Marques ${c.brands} / Modèles ${c.models} / Motorisations ${c.engines} / Pannes ${c.defects}`;
    }
  };

  /* =========================================================
     RECHERCHE PRÉDICTIVE / UI
     ========================================================= */
  const engineLabel = (e) => {
    const parts = [];
    if (e.fuel) parts.push(e.fuel);
    if (e.engine) parts.push(e.engine);
    if (e.displacement) parts.push(e.displacement);
    if (e.power) parts.push(e.power);
    if (e.transmission) parts.push(e.transmission);
    if (e.code) parts.push(e.code);
    return parts.filter(Boolean).join(" • ");
  };

  const getEnginesByModel = (modelKey) => [...mem.engines.values()].filter((e) => e.modelKey === modelKey);

  const searchBrands = (query) => {
    const q = normSearch(query);
    const arr = [...mem.brands.values()].map((b) => ({
      key: b.key,
      name: b.name,
      modelCount: b.modelCount || 0,
      score: scoreFields(brandFields(b.name), q)
    }));

    if (!q) {
      return arr.sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 300);
    }

    return arr
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fr"))
      .slice(0, 300);
  };

  const searchModels = (brandKey, query) => {
    const q = normSearch(query);
    const arr = [...mem.models.values()]
      .filter((m) => m.brandKey === brandKey)
      .map((m) => ({
        key: m.key,
        brandKey: m.brandKey,
        name: m.name,
        engineCount: m.engineCount || 0,
        score: scoreFields([m.name, m.brandName], q)
      }));

    if (!q) {
      return arr.sort((a, b) => a.name.localeCompare(b.name, "fr")).slice(0, 300);
    }

    return arr
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fr"))
      .slice(0, 300);
  };

  const searchEngines = (modelKey, query, fuelFilter) => {
    const q = normSearch(query);
    const all = getEnginesByModel(modelKey);

    const arr = all
      .map((e) => {
        if (fuelFilter && fuelFilter !== "all" && normSearch(e.fuel) !== normSearch(fuelFilter)) return null;
        return {
          ...e,
          score: scoreFields([engineLabel(e), e.engine, e.power, e.fuel, e.transmission, e.code], q)
        };
      })
      .filter(Boolean);

    const sortEngines = (a, b) => {
      const rf = rankFuel(a.fuel) - rankFuel(b.fuel);
      if (rf !== 0) return rf;
      return getPowerValue(b.power) - getPowerValue(a.power);
    };

    if (!q) {
      return arr.sort(sortEngines).slice(0, 500);
    }

    return arr
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || sortEngines(a, b))
      .slice(0, 500);
  };

  const closeAllCombos = (exceptId) => {
    ["brandPanel", "modelPanel", "enginePanel"].forEach((id) => {
      if (id === exceptId) return;
      const el = $("#" + id);
      if (el) el.classList.add("hidden");
    });
  };

  const renderBrandPanel = () => {
    const input = $("#brandInput");
    const panel = $("#brandPanel");
    if (!input || !panel) return;

    const options = searchBrands(input.value);
    panel.__options = options;

    if (!options.length) {
      panel.innerHTML = '<div class="empty">Aucune marque trouvée.</div>';
      panel.classList.remove("hidden");
      return;
    }

    panel.innerHTML = options.map((b, i) => `
      <button type="button" class="suggest-item" data-index="${i}">
        ${esc(b.name)}
        <small>${b.modelCount} modèle(s)</small>
      </button>
    `).join("");

    panel.classList.remove("hidden");
  };

  const renderModelList = (filter) => {
    const list = $("#modelList");
    if (!list) return;

    if (!selection.brand) {
      list.innerHTML = '<div class="empty">Sélectionnez une marque d’abord.</div>';
      list.__options = [];
      return;
    }

    const options = searchModels(selection.brand.key, filter || "");
    list.__options = options;

    if (!options.length) {
      list.innerHTML = '<div class="empty">Aucun modèle trouvé.</div>';
      return;
    }

    list.innerHTML = options.map((m, i) => `
      <button type="button" class="list-item" data-index="${i}">
        ${esc(m.name)}
        <small>${m.engineCount} motorisation(s)</small>
      </button>
    `).join("");
  };

  const renderEngineFilters = (engines) => {
    const wrap = $("#engineFilters");
    if (!wrap) return;

    const fuels = unique(engines.map((e) => e.fuel).filter(Boolean));
    const chips = [{ id: "all", label: "Toutes" }].concat(fuels.map((f) => ({ id: f, label: f })));

    wrap.innerHTML = chips.map((c) => `
      <button type="button" class="chip ${engineFuelFilter === c.id ? "active" : ""}" data-fuel-filter="${esc(c.id)}">${esc(c.label)}</button>
    `).join("");
  };

  const renderEnginePanel = (filter) => {
    const list = $("#engineList");
    if (!list) return;

    if (!selection.brand || !selection.model) {
      list.innerHTML = '<div class="empty">Sélectionnez un modèle d’abord.</div>';
      list.__options = [];
      if ($("#engineFilters")) $("#engineFilters").innerHTML = "";
      return;
    }

    const allEngines = getEnginesByModel(selection.model.key);
    renderEngineFilters(allEngines);

    const options = searchEngines(selection.model.key, filter || "", engineFuelFilter);
    list.__options = options;

    if (!options.length) {
      list.innerHTML = '<div class="empty">Aucune motorisation trouvée pour ce filtre.</div>';
      return;
    }

    list.innerHTML = options.map((e, i) => `
      <button type="button" class="list-item" data-index="${i}">
        ${esc(engineLabel(e))}
        <small>${esc((e.sources || []).join(", ") || "local")}</small>
      </button>
    `).join("");
  };

  const updateModelButton = () => {
    const btn = $("#modelButton");
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
    const btn = $("#engineButton");
    if (!btn) return;

    if (!selection.brand || !selection.model) {
      btn.disabled = true;
      btn.textContent = !selection.brand ? "Choisir d’abord une marque" : "Choisir d’abord un modèle";
      return;
    }

    btn.disabled = false;
    btn.textContent = selection.engine ? engineLabel(selection.engine) : "Choisir une motorisation";
  };

  const getSelectedVehicleData = () => {
    const kmEl = $("#vehicleKilometrage");
    const vinEl = $("#vehicleVin");

    return {
      marque: selection.brand ? selection.brand.name : "",
      modele: selection.model ? selection.model.name : "",
      engine: selection.engine ? selection.engine.engine : "",
      displacement: selection.engine ? selection.engine.displacement : "",
      power: selection.engine ? selection.engine.power : "",
      fuel: selection.engine ? selection.engine.fuel : "",
      transmission: selection.engine ? selection.engine.transmission : "",
      code: selection.engine ? selection.engine.code : "",
      engineSource: selection.engine ? ((selection.engine.sources || []).join(", ") || "local") : "",
      kilometrage: kmEl ? kmEl.value.trim() : "",
      vin: vinEl ? vinEl.value.trim() : ""
    };
  };

  const updateSelectionSummary = () => {
    const el = $("#selectionSummary");
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

  const selectBrand = (opt) => {
    if (!opt) return;

    selection.brand = { key: opt.key, name: opt.name };
    selection.model = null;
    selection.engine = null;
    engineFuelFilter = "all";

    const input = $("#brandInput");
    if (input) input.value = opt.name;

    closeAllCombos();
    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
  };

  const selectModel = (opt) => {
    if (!opt) return;

    selection.model = { key: opt.key, brandKey: opt.brandKey, name: opt.name };
    selection.engine = null;
    engineFuelFilter = "all";

    closeAllCombos();
    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
  };

  const selectEngine = (opt) => {
    if (!opt) return;

    selection.engine = {
      key: opt.key,
      modelKey: opt.modelKey,
      brandKey: opt.brandKey,
      brandName: opt.brandName,
      modelName: opt.modelName,
      engine: opt.engine,
      power: opt.power,
      fuel: opt.fuel,
      transmission: opt.transmission,
      code: opt.code,
      displacement: opt.displacement || "",
      sources: opt.sources || ["local"]
    };

    closeAllCombos();
    updateEngineButton();
    updateSelectionSummary();
  };

  const preserveSelection = () => {
    if (selection.brand) {
      const b = mem.brands.get(selection.brand.key) ||
        [...mem.brands.values()].find((x) => normSearch(x.name) === normSearch(selection.brand.name));

      if (!b) {
        selection.brand = null;
        selection.model = null;
        selection.engine = null;
      } else {
        selection.brand = { key: b.key, name: b.name };
      }
    }

    if (!selection.brand) {
      selection.model = null;
      selection.engine = null;
    }

    if (selection.brand && selection.model) {
      const m = mem.models.get(selection.model.key) ||
        [...mem.models.values()].find((x) => x.brandKey === selection.brand.key && normSearch(x.name) === normSearch(selection.model.name));

      if (!m) {
        selection.model = null;
        selection.engine = null;
      } else {
        selection.model = { key: m.key, brandKey: m.brandKey, name: m.name };
      }
    }

    if (!selection.model) {
      selection.engine = null;
    }

    if (selection.model && selection.engine) {
      const e = mem.engines.get(selection.engine.key) ||
        [...mem.engines.values()].find((x) =>
          x.modelKey === selection.model.key &&
          x.engine === selection.engine.engine &&
          x.power === selection.engine.power &&
          x.fuel === selection.engine.fuel &&
          x.transmission === selection.engine.transmission &&
          x.code === selection.engine.code
        );

      if (!e) {
        selection.engine = null;
      } else {
        selection.engine = { ...e };
      }
    }

    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();
  };

  const rerenderOpenPanels = () => {
    const brandPanel = $("#brandPanel");
    if (brandPanel && !brandPanel.classList.contains("hidden")) renderBrandPanel();

    const modelPanel = $("#modelPanel");
    if (modelPanel && !modelPanel.classList.contains("hidden")) {
      renderModelList($("#modelSearch") ? $("#modelSearch").value : "");
    }

    const enginePanel = $("#enginePanel");
    if (enginePanel && !enginePanel.classList.contains("hidden")) {
      renderEnginePanel($("#engineSearch") ? $("#engineSearch").value : "");
    }
  };

  const scheduleBrandRender = debounce(renderBrandPanel, 120);
  const scheduleModelRender = debounce(() => renderModelList($("#modelSearch") ? $("#modelSearch").value : ""), 120);
  const scheduleEngineRender = debounce(() => renderEnginePanel($("#engineSearch") ? $("#engineSearch").value : ""), 120);

  /* =========================================================
     CHARGEMENT / MISE À JOUR DES DONNÉES
     ========================================================= */
  const fetchText = async (url) => {
    try {
      const sep = url.includes("?") ? "&" : "?";
      const finalUrl = url + sep + "v=" + Date.now();
      const res = await fetch(finalUrl, { cache: "no-store", mode: "cors" });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.trim()) return null;
      if (text.trim().startsWith("<")) return null;
      return text;
    } catch {
      return null;
    }
  };

  const tryLoadUrl = async (url, kind, stats, sources) => {
    const text = await fetchText(url);
    if (!text) return false;

    try {
      const json = JSON.parse(text);
      const s = ingestPayload(json, url, kind);
      addStats(stats, s);
      sources.push(url);
      return true;
    } catch (e) {
      console.warn("[Expert Auto] JSON invalide:", url, e);
      return false;
    }
  };

  const refreshData = async (manual = false) => {
    if (syncBusy) return;
    syncBusy = true;

    setStatus(manual ? "Mise à jour manuelle des bases..." : "Mise à jour automatique des bases...");

    const stats = { brands: 0, models: 0, engines: 0, defects: 0, invalid: 0, duplicates: 0 };
    const sources = [];

    for (const path of LOCAL_DATA_PATHS) {
      await tryLoadUrl(path, "auto", stats, sources);
    }

    for (const [path, kind] of SEPARATE_DATA_PATHS) {
      await tryLoadUrl(path, kind, stats, sources);
    }

    for (const base of REMOTE_BASES) {
      const cleanBase = base.replace(/\/$/, "");
      for (const path of LOCAL_DATA_PATHS) {
        await tryLoadUrl(cleanBase + path.replace(/^\.\//, "/"), "auto", stats, sources);
      }
      for (const [path, kind] of SEPARATE_DATA_PATHS) {
        await tryLoadUrl(cleanBase + path.replace(/^\.\//, "/"), kind, stats, sources);
      }
    }

    if (mem.brands.size === 0) {
      seedLocal();
    }

    recomputeCounts();
    await persistMemory();
    save(KEYS.LAST_SYNC, Date.now());

    preserveSelection();
    updateStats();
    rerenderOpenPanels();

    const summary = `+${stats.brands} marques, +${stats.models} modèles, +${stats.engines} motorisations, +${stats.defects} pannes`;
    const src = sources.length ? `Sources : ${sources.length}` : "Aucune source JSON distante trouvée, base locale utilisée.";

    setStatus(`Mise à jour terminée • ${summary} • ${src}`);
    if (manual) toast("Mise à jour manuelle terminée.", "success");

    syncBusy = false;
  };

  const startAutoSync = () => {
    stopAutoSync();
    autoSyncTimer = setInterval(() => {
      if (!document.hidden && navigator.onLine) refreshData(false);
    }, 10 * 60 * 1000);
  };

  const stopAutoSync = () => {
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  };

  /* =========================================================
     ANALYSE CROISÉE
     ========================================================= */
  const addTerm = (...args) => {
    args.forEach((t) => termesMobilises.add(t));
    return `<span class="term">(${args.join(", ")})</span>`;
  };

  const extractDtcCodes = (text) => {
    const m = String(text || "").match(/\b[PCBU][0-9A-F]{3,4}\b/gi) || [];
    return unique(m.map((x) => x.toUpperCase()));
  };

  const brandMatches = (a, b) => {
    const na = normKey(a);
    const nb = normKey(b);
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

  const matchDefects = (v, text) => {
    const txt = norm(text);
    const results = [];

    mem.defects.forEach((d) => {
      if (v.marque && !brandMatches(d.brand, v.marque)) return;
      if (v.modele && d.models && d.models.length && !d.models.includes("*") && !d.models.some((m) => nameMatch(m, v.modele))) return;

      let score = 0;
      const found = [];

      (d.symptoms || []).forEach((s) => {
        if (txt.includes(norm(s))) {
          score++;
          found.push(s);
        }
      });

      if (v.engine && d.engines && d.engines.length) {
        if (d.engines.some((e) => norm(v.engine).includes(norm(e)) || norm(e).includes(norm(v.engine)))) score += 5;
      }

      if (v.fuel && d.fuels && d.fuels.length) {
        if (d.fuels.some((f) => norm(f) === norm(v.fuel))) score += 3;
      }

      if (v.power && d.powers && d.powers.length) {
        if (d.powers.some((p) => norm(p) === norm(v.power))) score += 2;
      }

      if (score >= 1) {
        results.push({
          constructeur: d.brand,
          modeles: d.models && d.models.length ? d.models : ["Non précisé"],
          moteur: d.engines && d.engines.length ? d.engines.join(", ") : (v.engine || "Non précisé"),
          puissance: d.powers && d.powers.length ? d.powers.join(", ") : (v.power || "Non précisée"),
          energie: d.fuels && d.fuels.length ? d.fuels.join(", ") : (v.fuel || "Non précisée"),
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
      { label: "Auto-Diagnostic", url: "https://expertkevin06-cell.github.io/auto-diagnostic/" },
      { label: "Recherche technique", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / TSB", url: "https://www.google.com/search?q=" + encodeURIComponent(`${baseQuery} safetygate TSB rappel défaut`) },
      { label: "KBA Rückruf", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} KBA Rückruf`) },
      { label: "VIN / campagne", url: "https://www.google.com/search?q=" + encodeURIComponent(`${brand} ${model} VIN recall campaign motorisation`) }
    ];
  };

  const orientationContext = (objective, flags, matches) => {
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
    let h = `<div class="box info"><strong>Objet :</strong> croisement technique dynamique ${addTerm("défauts connus", "rappels", "TSB", "DTC", "motorisation", "pannes récurrentes")}.</div>`;

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
    let h = `<div class="box info"><strong>Objet :</strong> qualification juridique renforcée par l’analyse technique ${addTerm("qualification juridique", "responsabilité", "garantie")}.</div>`;

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

    const links = researchLinks(vehicleData.marque, vehicleData.modele, matches[0] ? matches[0].moteur : vehicleData.engine, matches[0] ? matches[0].symptomes : [], vehicleData.fuel);
    h += `<h4>Pistes de recherche externe</h4><ul>`;
    links.forEach((l) => { h += `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`; });
    h += `</ul>`;

    if (objective) h += `<p><strong>Objectif déclaré :</strong> ${esc(objective)}</p>`;
    return h;
  };

  const secConclusion = (objective, matches, flags, vData) => {
    const high = matches.some((m) => m.confiance === "Haute");
    const critical = matches.some((m) => m.severite === "critique");
    const orientation = orientationContext(objective, flags, matches);

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

    html += `<div class="box medium"><strong>Rappel méthodologique :</strong> ce rapport effectue un croisement local/dynamique technique + juridique + motorisation. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>`;

    const result = $("#analysisResult");
    if (result) result.innerHTML = html;

    const section = $("#analysisSection");
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
      dtc: extractDtcCodes(all).length > 0 || allNorm.includes("dtc") || allNorm.includes("code défaut"),
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
    S.push(["II. ANALYSE TECHNIQUE CROISÉE", secTechnique(matches, flags, vehicleData)]);
    S.push(["III. ANALYSE JURIDIQUE RENFORCÉE", secJuridique(flags, matches)]);
    S.push(["IV. PREUVE, STRATÉGIE ET VÉRIFICATIONS", secPreuve(matches, flags, objective)]);
    S.push(["V. CONCLUSION ORIENTÉE SELON LE LITIGE", secConclusion(objective, matches, flags, vehicleData)]);
    S.push(["VI. LEXIQUE TECHNIQUE ET JURIDIQUE MOBILISÉ", secLexique()]);

    analysisData.sections = S;
    renderAnalysis();
  };

  /* =========================================================
     ADMIN RENDER
     ========================================================= */
  const renderAdminIfOpen = () => {
    const panel = $("#adminPanel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (!currentUser || currentUser.role !== "admin") return;
    renderAdmin();
  };

  const renderAdmin = () => {
    updateStats();
    renderPendingRequests();
    renderUsers();
    renderWallpaperPreview();

    const settings = getSettings();
    const emailInput = $("#adminEmailInput");
    if (emailInput) emailInput.value = settings.adminEmail || "";

    const opacityInput = $("#wallpaperOpacity");
    if (opacityInput) opacityInput.value = settings.wallpaperOpacity || 35;

    const opacityValue = $("#wallpaperValue");
    if (opacityValue) opacityValue.textContent = (settings.wallpaperOpacity || 35) + "%";
  };

  const renderPendingRequests = () => {
    const wrap = $("#pendingRequestsList");
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
    const wrap = $("#approvedUsersList");
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

  /* =========================================================
     FOND D'ÉCRAN + OPACITÉ
     ========================================================= */
  const injectEssentialStyles = () => {
    if ($("#essentialPredictiveStyles")) return;
    const st = document.createElement("style");
    st.id = "essentialPredictiveStyles";
    st.textContent = `
      .bg-wallpaper{
        position:fixed;
        inset:0;
        z-index:-1;
        pointer-events:none;
        background-size:cover;
        background-position:center;
        background-repeat:no-repeat;
        opacity:var(--wallpaper-opacity,0.35);
        transition:opacity .2s ease, background-image .2s ease;
      }
      .hidden{display:none !important;}
    `;
    document.head.appendChild(st);
  };

  const ensureWallpaperLayer = () => {
    let el = $("#bgWallpaper");
    if (!el) {
      el = document.createElement("div");
      el.id = "bgWallpaper";
      el.className = "bg-wallpaper";
      document.body.prepend(el);
    }
    return el;
  };

  const applyWallpaper = (dataUrl, opacity) => {
    const el = ensureWallpaperLayer();
    const settings = getSettings();

    const op = Math.max(0, Math.min(100, Number(opacity != null ? opacity : settings.wallpaperOpacity || 35)));
    settings.wallpaperOpacity = op;
    saveSettings(settings);

    document.documentElement.style.setProperty("--wallpaper-opacity", String(op / 100));

    if (dataUrl) {
      el.style.backgroundImage = `url(${dataUrl})`;
    } else {
      el.style.backgroundImage = "";
    }

    const range = $("#wallpaperOpacity");
    if (range) range.value = op;

    const val = $("#wallpaperValue");
    if (val) val.textContent = op + "%";

    renderWallpaperPreview(dataUrl);
  };

  const renderWallpaperPreview = (dataUrl) => {
    const preview = $("#wallpaperPreview");
    if (!preview) return;
    const bg = dataUrl || load(KEYS.SETTINGS + "_wallpaper_preview", null);
    preview.style.backgroundImage = bg ? `url(${bg})` : "";
  };

  const saveWallpaperToDb = async (dataUrl) => {
    await idbSetAsset({
      key: "wallpaper",
      type: "image",
      dataUrl,
      updatedAt: Date.now()
    });
    save(KEYS.SETTINGS + "_wallpaper_preview", dataUrl);
    applyWallpaper(dataUrl, getSettings().wallpaperOpacity || 35);
  };

  const loadWallpaper = async () => {
    const asset = await idbGetAsset("wallpaper");
    const settings = getSettings();
    applyWallpaper(asset ? asset.dataUrl : "", settings.wallpaperOpacity || 35);
  };

  const resetWallpaper = async () => {
    await idbDeleteAsset("wallpaper");
    del(KEYS.SETTINGS + "_wallpaper_preview");
    applyWallpaper("", getSettings().wallpaperOpacity || 35);
    toast("Fond réinitialisé.", "info");
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
    ctx.fillText("Recherche prédictive corrigée", 82, 370);
    ctx.fillText("Marque • Modèle • Motorisation", 82, 420);

    return c.toDataURL("image/png");
  };

  const downloadWallpaper = async () => {
    const asset = await idbGetAsset("wallpaper");
    const dataUrl = asset && asset.dataUrl ? asset.dataUrl : generateDefaultWallpaper();
    downloadDataUrl(dataUrl, "wallpaper.png");
    toast("Fond d’écran téléchargé.", "success");
  };

  /* =========================================================
     IMPORT JSON ADMIN
     ========================================================= */
  const setJsonStatus = (msg) => {
    const el = $("#jsonStatus");
    if (el) el.textContent = msg;
  };

  const setJsonProgress = (p) => {
    const el = $("#jsonProgress");
    if (el) el.value = Math.max(0, Math.min(100, Number(p) || 0));
  };

  const setJsonReport = (text) => {
    const el = $("#jsonReport");
    if (el) el.textContent = text || "";
  };

  const setSelectedJsonFile = (file) => {
    selectedJsonFile = file || null;
    const nameEl = $("#jsonFileName");
    if (nameEl) {
      nameEl.textContent = selectedJsonFile
        ? `${selectedJsonFile.name} • ${formatBytes(selectedJsonFile.size)}`
        : "Aucun fichier sélectionné.";
    }

    const validateBtn = $("#validateJsonBtn");
    const importBtn = $("#importJsonBtn");
    if (validateBtn) validateBtn.disabled = !selectedJsonFile;
    if (importBtn) importBtn.disabled = !selectedJsonFile;

    setJsonProgress(0);
    setJsonStatus(selectedJsonFile ? "Fichier prêt. Vérifie puis importe." : "Prêt.");
    setJsonReport("");
  };

  const formatJsonReport = (stats, imported) => {
    const lines = [];
    lines.push(`Marques : ${stats.brands}`);
    lines.push(`Modèles : ${stats.models}`);
    lines.push(`Motorisations : ${stats.engines}`);
    lines.push(`Pannes / rappels : ${stats.defects}`);
    if (stats.invalid) lines.push(`Lignes invalides : ${stats.invalid}`);
    if (imported) {
      lines.push("");
      lines.push("Import réalisé dans la base locale IndexedDB.");
      lines.push("Les listes Marque / Modèle / Motorisation sont immédiatement actualisées.");
    } else {
      lines.push("");
      lines.push("Vérification seulement : aucune écriture effectuée.");
    }
    return lines.join("\n");
  };

  const handleJsonAction = async (doImport) => {
    if (!selectedJsonFile) {
      setJsonStatus("Aucun fichier sélectionné.");
      return;
    }

    try {
      setJsonProgress(10);
      setJsonStatus("Lecture du fichier JSON...");

      const text = await readFileAsText(selectedJsonFile);

      setJsonProgress(35);
      setJsonStatus("Validation du JSON...");

      let payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        throw new Error("JSON invalide : " + e.message);
      }

      setJsonProgress(60);

      if (!doImport) {
        const preview = validatePayloadPreview(payload);
        setJsonProgress(100);
        setJsonStatus("Vérification terminée.");
        setJsonReport(formatJsonReport(preview, false));
        return;
      }

      setJsonStatus("Import dans la base locale...");

      const stats = ingestPayload(payload, "import-admin:" + selectedJsonFile.name, "auto");

      setJsonProgress(85);
      recomputeCounts();
      await persistMemory();

      preserveSelection();
      updateStats();
      rerenderOpenPanels();

      setJsonProgress(100);
      setJsonStatus("Import terminé.");
      setJsonReport(formatJsonReport(stats, true));

      toast("Import JSON réussi.", "success");
    } catch (e) {
      setJsonProgress(100);
      setJsonStatus("Échec de l’import.");
      setJsonReport("Erreur :\n" + String(e && e.message ? e.message : e));
      toast("Import JSON échoué.", "error");
    }
  };

  const exportBase = () => {
    const data = {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      counts: counts(),
      brands: [...mem.brands.values()],
      models: [...mem.models.values()],
      engines: [...mem.engines.values()],
      defects: [...mem.defects.values()]
    };

    downloadText(JSON.stringify(data, null, 2), "auto-diagnostic-export.json");
    toast("Base exportée.", "success");
  };

  const exportUserData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      users: getUsers(),
      requests: getRequests(),
      catalogStats: counts()
    };

    downloadText(JSON.stringify(data, null, 2), "expert-auto-users-v36.json");
    toast("Données utilisateurs exportées.", "success");
  };

  /* =========================================================
     SERVICE WORKER / INSTALL
     ========================================================= */
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
            console.log("[Expert Auto] SW prêt V36.");
          })
          .catch((err) => console.warn("[Expert Auto] SW non enregistré:", err));
      }
    } catch (e) {
      console.warn("[Expert Auto] SW impossible:", e);
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

  const updateInstallUI = () => {
    const btn = $("#installBtn");
    const hint = $("#installHint");
    if (!btn) return;

    if (deferredPrompt) {
      btn.disabled = false;
      btn.textContent = "📲 Installer l’application";
      if (hint) hint.textContent = "Installation PWA disponible directement depuis ce navigateur.";
    } else {
      btn.disabled = false;
      btn.textContent = "📲 Instructions d’installation";
      if (hint) hint.textContent = "Sur Android Chrome : menu ⋮ → “Ajouter à l’écran d’accueil”. Pour APK natif, inclure data/auto-diagnostic-export.json dans www/data/.";
    }
  };

  const downloadManifest = () => {
    fetch("./manifest.json", { cache: "no-store" })
      .then((r) => r.text())
      .then((txt) => downloadText(txt, "manifest.json"))
      .catch(() => toast("manifest.json indisponible.", "error"));
  };

  /* =========================================================
     PURGE ANNÉE
     ========================================================= */
  const purgeYearControls = () => {
    try {
      const remove = () => {
        const selectors = [
          "#vehicleYear",
          "[id*='year' i]",
          "[name*='annee' i]",
          "[data-field='year']",
          "[placeholder*='année' i]",
          "[placeholder*='millésime' i]"
        ];

        document.querySelectorAll(selectors.join(",")).forEach((el) => {
          const group = el.closest(".field, .input-group, .form-grid > div, .two-cols > div, div");
          if (group && /année|millésime|mise en circulation/i.test(group.textContent || "")) {
            group.remove();
          } else {
            el.remove();
          }
        });

        document.querySelectorAll("label").forEach((label) => {
          if (/année|millésime|mise en circulation/i.test(label.textContent || "")) {
            const group = label.closest(".field, .input-group, .form-grid > div, .two-cols > div, div");
            if (group) group.remove();
            else label.remove();
          }
        });
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", remove);
      } else {
        remove();
      }
    } catch (e) {
      console.warn("[Expert Auto] Purge année ignorée:", e);
    }
  };

  /* =========================================================
     BIND UI
     ========================================================= */
  const bindUi = () => {
    $$(".tab-btn[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".tab-btn[data-auth-tab]").forEach((b) => b.classList.remove("active"));
        $$(".auth-pane").forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        const pane = $("#" + btn.dataset.authTab + "Pane");
        if (pane) pane.classList.remove("hidden");
        authMessage("", "");
      });
    });

    on("#adminLoginBtn", "click", async () => {
      const pwdEl = $("#adminPassword");
      const rememberEl = $("#rememberAdminPwd");
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
      toast("Connexion admin via mot de passe mémorisé.", "success");
    });

    on("#requestBtn", "click", () => {
      const nameEl = $("#reqName");
      const emailEl = $("#reqEmail");
      const reasonEl = $("#reqReason");

      const name = nameEl ? nameEl.value.trim() : "";
      const email = emailEl ? emailEl.value.trim() : "";
      const reason = reasonEl ? reasonEl.value.trim() : "";

      if (!name || !email || !reason) {
        authMessage("Nom, email et motif sont requis.", "error");
        return;
      }

      const requests = getRequests();
      const emailKey = userEmailKey(email);

      if (requests.find((r) => r.emailNorm === emailKey && r.status === "pending")) {
        authMessage("Demande déjà en attente.", "warning");
        return;
      }

      if (findApprovedUser(name, email)) {
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
      publishAccessRequest(req);
      authMessage("Demande envoyée.", "success");

      if (nameEl) nameEl.value = "";
      if (emailEl) emailEl.value = "";
      if (reasonEl) reasonEl.value = "";
    });

    on("#thirdLoginBtn", "click", () => {
      const nameEl = $("#loginName");
      const emailEl = $("#loginEmail");
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

    /* ===== BRAND ===== */
    on("#brandInput", "input", () => {
      const input = $("#brandInput");
      const val = input ? input.value : "";

      if (!selection.brand || normSearch(val) !== normSearch(selection.brand.name)) {
        selection.brand = null;
        selection.model = null;
        selection.engine = null;
        engineFuelFilter = "all";
        updateModelButton();
        updateEngineButton();
        updateSelectionSummary();
      }

      scheduleBrandRender();
    });

    on("#brandInput", "focus", renderBrandPanel);

    on("#brandInput", "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const panel = $("#brandPanel");
        if (panel && !panel.classList.contains("hidden") && panel.__options && panel.__options.length) {
          selectBrand(panel.__options[0]);
        } else {
          const input = $("#brandInput");
          const opts = searchBrands(input ? input.value : "");
          if (opts.length) selectBrand(opts[0]);
        }
      }
    });

    on("#brandPanel", "click", (e) => {
      const btn = e.target.closest("button[data-index]");
      if (!btn) return;
      const panel = $("#brandPanel");
      const idx = Number(btn.dataset.index);
      const opt = panel && panel.__options ? panel.__options[idx] : null;
      if (opt) selectBrand(opt);
    });

    /* ===== MODEL ===== */
    on("#modelButton", "click", () => {
      if (!selection.brand) return;

      const panel = $("#modelPanel");
      const isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("modelPanel");

      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderModelList("");
        const search = $("#modelSearch");
        if (search) setTimeout(() => search.focus(), 30);
      }
    });

    on("#modelSearch", "input", scheduleModelRender);

    on("#modelSearch", "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const list = $("#modelList");
        if (list && list.__options && list.__options.length) {
          selectModel(list.__options[0]);
        }
      }
    });

    on("#modelList", "click", (e) => {
      const btn = e.target.closest("button[data-index]");
      if (!btn) return;
      const list = $("#modelList");
      const idx = Number(btn.dataset.index);
      const opt = list && list.__options ? list.__options[idx] : null;
      if (opt) selectModel(opt);
    });

    /* ===== ENGINE ===== */
    on("#engineButton", "click", () => {
      if (!selection.brand || !selection.model) return;

      const panel = $("#enginePanel");
      const isOpen = panel && !panel.classList.contains("hidden");
      closeAllCombos("enginePanel");

      if (!isOpen && panel) {
        panel.classList.remove("hidden");
        renderEnginePanel("");
        const search = $("#engineSearch");
        if (search) setTimeout(() => search.focus(), 30);
      }
    });

    on("#engineSearch", "input", scheduleEngineRender);

    on("#engineSearch", "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const list = $("#engineList");
        if (list && list.__options && list.__options.length) {
          selectEngine(list.__options[0]);
        }
      }
    });

    on("#engineFilters", "click", (e) => {
      const chip = e.target.closest("[data-fuel-filter]");
      if (!chip) return;
      engineFuelFilter = chip.getAttribute("data-fuel-filter");
      renderEnginePanel($("#engineSearch") ? $("#engineSearch").value : "");
    });

    on("#engineList", "click", (e) => {
      const btn = e.target.closest("button[data-index]");
      if (!btn) return;
      const list = $("#engineList");
      const idx = Number(btn.dataset.index);
      const opt = list && list.__options ? list.__options[idx] : null;
      if (opt) selectEngine(opt);
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".combo")) closeAllCombos();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllCombos();
    });

    /* ===== ANALYZE ===== */
    on("#analyzeBtn", "click", () => {
      if (!currentUser) { toast("Connectez-vous.", "error"); return; }

      const info = dailyInfo();
      if (!info.allowed) {
        toast(`Limite de ${MAX_DAILY_ANALYSES} analyses/jour atteinte.`, "warning");
        return;
      }

      const textEl = $("#textInput");
      const contextEl = $("#contextInfo");
      const objectiveEl = $("#objectiveInfo");
      const goalEl = $("#goalSelect");
      const sellerEl = $("#sellerType");

      const text = textEl ? textEl.value.trim() : "";
      const context = contextEl ? contextEl.value.trim() : "";
      const objective = (objectiveEl && objectiveEl.value.trim()) || (goalEl ? goalEl.value : "") || "";
      const sellerType = sellerEl ? sellerEl.value : "unknown";

      vehicleData = getSelectedVehicleData();

      if (!text) {
        toast("Saisissez des faits.", "warning");
        return;
      }

      termesMobilises = new Set();

      const btn = $("#analyzeBtn");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Analyse croisée en cours...';
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
            btn.innerHTML = "🔍 Lancer l’analyse croisée technique + juridique";
          }
        }
      }, 350);
    });

    /* ===== ADMIN ===== */
    on("#adminPanelBtn", "click", () => {
      if (!currentUser || currentUser.role !== "admin") return;
      const panel = $("#adminPanel");
      if (panel) panel.classList.remove("hidden");
      renderAdmin();
    });

    on("#closeAdminBtn", "click", () => {
      const panel = $("#adminPanel");
      if (panel) panel.classList.add("hidden");
    });

    $$(".tab-btn[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".tab-btn[data-admin-tab]").forEach((b) => b.classList.remove("active"));
        $$(".admin-pane").forEach((p) => p.classList.add("hidden"));
        btn.classList.add("active");
        const pane = $("#" + btn.dataset.adminTab + "Pane");
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
            id: req.id,
            name: req.name,
            email: req.email,
            role: "user",
            status: "approved",
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

    on("#syncNowBtn", "click", () => refreshData(true));
    on("#clearCacheBtn", "click", clearCacheAndReload);

    on("#importJsonInput", "change", (e) => {
      const file = e.target.files && e.target.files[0];
      setSelectedJsonFile(file);
      e.target.value = "";
    });

    on("#validateJsonBtn", "click", () => handleJsonAction(false));
    on("#importJsonBtn", "click", () => handleJsonAction(true));

    on("#exportBaseBtn", "click", exportBase);
    on("#exportDataBtn", "click", exportUserData);

    on("#wallpaperInput", "change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        if (file.size > 8 * 1024 * 1024) {
          toast("Image trop lourde. Max conseillé : 8 Mo.", "warning");
        }

        const dataUrl = await readFileAsDataUrl(file);
        await saveWallpaperToDb(dataUrl);
        toast("Fond d’écran appliqué et sauvegardé.", "success");
      } catch {
        toast("Impossible de lire l’image.", "error");
      }

      e.target.value = "";
    });

    on("#wallpaperOpacity", "input", (e) => {
      applyWallpaper(null, e.target.value);
    });

    on("#saveWallpaperBtn", "click", async () => {
      const asset = await idbGetAsset("wallpaper");
      applyWallpaper(asset ? asset.dataUrl : "", $("#wallpaperOpacity") ? $("#wallpaperOpacity").value : 35);
      toast("Fond d’écran sauvegardé.", "success");
    });

    on("#resetWallpaperBtn", "click", resetWallpaper);
    on("#downloadWallpaperBtn", "click", downloadWallpaper);
    on("#downloadWallpaperBtn2", "click", downloadWallpaper);
    on("#downloadManifestBtn", "click", downloadManifest);

    on("#saveSettingsBtn", "click", () => {
      const email = $("#adminEmailInput") ? $("#adminEmailInput").value.trim() : "";
      const settings = getSettings();
      settings.adminEmail = email;
      saveSettings(settings);
      toast("Paramètres enregistrés.", "success");
    });

    on("#installBtn", "click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        if (choice && choice.outcome === "accepted") toast("Application installée.", "success");
        deferredPrompt = null;
        updateInstallUI();
      } else {
        alert("Pour installer :\n- Android Chrome : menu ⋮ → Ajouter à l’écran d’accueil\n- iOS Safari : Partager → Sur l’écran d’accueil\n- APK natif : inclure data/auto-diagnostic-export.json dans www/data/.");
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

    window.addEventListener("online", () => refreshData(false));

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        enforceTierAccess();
        refreshData(false);
      }
    });
  };

  /* =========================================================
     INIT
     ========================================================= */
  const init = async () => {
    injectEssentialStyles();
    purgeYearControls();

    setStatus("Démarrage recherche prédictive corrigée...");

    db = await openDb();
    await loadMemoryFromDb();

    if (mem.brands.size === 0) {
      seedLocal();
      await persistMemory();
    } else {
      recomputeCounts();
    }

    bindUi();
    updateStats();
    updateNotificationState();
    registerServiceWorker();
    refreshSavedPasswordButton();
    updateInstallUI();

    await loadWallpaper();

    if (processIncomingAccessGrantFromUrl()) {
      updateNotificationBell();
      startAutoSync();
      return;
    }

    if (restoreSession()) showApp();
    else showLogin();

    updateModelButton();
    updateEngineButton();
    updateSelectionSummary();

    await refreshData(false);
    startAutoSync();

    setStatus("Prêt. Recherche prédictive marque / modèle / motorisation corrigée.");
    toast("Application prête.", "success");
  };

  const boot = () => {
    try {
      init().catch((e) => {
        console.error("[Expert Auto] Erreur init:", e);
        setStatus("Mode dégradé : " + (e && e.message ? e.message : "erreur inconnue"));
        const login = $("#loginScreen");
        if (login) login.classList.remove("hidden");
        const app = $("#mainApp");
        if (app) app.classList.add("hidden");
      });
    } catch (e) {
      console.error("[Expert Auto] Boot dégradé:", e);
      const status = $("#dataStatus");
      if (status) status.textContent = "Mode dégradé actif";
      const login = $("#loginScreen");
      if (login) login.classList.remove("hidden");
      const app = $("#mainApp");
      if (app) app.classList.add("hidden");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
