(() => {
  "use strict";

  /* =========================================================
     ADMIN JSON IMPORT MODULE
     Version : 1.0
     Objectif : importer un JSON massif dans IndexedDB
     Base cible : expert_auto_apk_v31
     ========================================================= */

  const DB_NAME = "expert_auto_apk_v31";
  const DB_VERSION = 1;
  const STORES = ["meta", "brands", "models", "engines", "defects"];
  const SOURCE = "import-json-admin";
  const MAX_FILE_BYTES = 80 * 1024 * 1024; // 80 Mo

  const $ = (sel, root = document) => {
    try {
      return (root || document).querySelector(sel);
    } catch {
      return null;
    }
  };

  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const norm = (v) => {
    let s = String(v == null ? "" : v).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s.trim();
  };

  const normKey = (v) => norm(v).replace(/[^a-z0-9]+/g, "");

  const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!n) return "0 o";
    const units = ["o", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + units[i];
  };

  const toList = (v) => {
    if (Array.isArray(v)) {
      return v
        .map((x) => {
          if (x == null) return "";
          if (typeof x === "object") {
            return String(
              x.name ||
              x.model ||
              x.modele ||
              x.engine ||
              x.motorisation ||
              x.moteur ||
              x.brand ||
              x.marque ||
              x.value ||
              ""
            ).trim();
          }
          return String(x).trim();
        })
        .filter(Boolean);
    }

    if (v == null) return [];

    return String(v)
      .split(/[|,;\n]/)
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  };

  const firstString = (obj, keys) => {
    if (!obj || typeof obj !== "object") return "";

    for (const k of keys) {
      const v = obj[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }

    const lower = {};
    for (const p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        lower[normKey(p)] = p;
      }
    }

    for (const k of keys) {
      const real = lower[normKey(k)];
      if (real) {
        const v = obj[real];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }

    return "";
  };

  const firstList = (obj, keys) => {
    if (!obj || typeof obj !== "object") return [];

    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v) && v.length) return toList(v);
      if (typeof v === "string" && v.trim()) return toList(v);
    }

    const lower = {};
    for (const p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        lower[normKey(p)] = p;
      }
    }

    for (const k of keys) {
      const real = lower[normKey(k)];
      if (real) {
        const v = obj[real];
        if (Array.isArray(v) && v.length) return toList(v);
        if (typeof v === "string" && v.trim()) return toList(v);
      }
    }

    return [];
  };

  const getArray = (obj, keys) => {
    if (!obj || typeof obj !== "object") return null;

    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) return v;
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

    return null;
  };

  const getBrand = (row) => firstString(row, [
    "brand", "marque", "b", "constructeur", "make", "brandName", "brand_name"
  ]);

  const getModel = (row) => firstString(row, [
    "model", "modele", "modèle", "m", "vehicle", "vehicule", "modelName", "model_name"
  ]);

  const getEngine = (row) => firstString(row, [
    "engine", "motorisation", "moteur", "e", "version", "variant", "powertrain"
  ]);

  const getPower = (row) => firstString(row, [
    "power", "puissance", "p", "ch", "kw", "hp"
  ]);

  const getFuel = (row) => firstString(row, [
    "fuel", "energie", "énergie", "type", "t", "carburant", "engineType", "energy"
  ]);

  const getTransmission = (row) => firstString(row, [
    "transmission", "boite", "boîte", "gearbox", "tr"
  ]);

  const getCode = (row) => firstString(row, [
    "code", "engineCode", "codeMoteur", "codemoteur",
    "cylindree", "cylindrée", "displacement", "d", "cyl"
  ]);

  const expandPowers = (p) => {
    const list = toList(p);
    return list.length ? list : [""];
  };

  const inferKind = (row) => {
    if (typeof row === "string") return "brands";
    if (!row || typeof row !== "object") return null;

    const keys = Object.keys(row).map(normKey).join("|");

    if (/(symptoms?|symptomes?|pannes?|defauts?|faults?|issues?|dtc|rappels?|recalls?|description|fiche|expertise)/.test(keys)) {
      return "defects";
    }

    if (/(engines?|motorisations?|moteurs?|power|puissance|fuel|energie|carburant)/.test(keys)) {
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

  const normalizeBrandRow = (row) => {
    if (typeof row === "string") {
      const name = row.trim();
      return name ? { name } : null;
    }

    if (!row || typeof row !== "object") return null;

    const name = getBrand(row) || firstString(row, ["name", "nom", "label"]);
    return name ? { name } : null;
  };

  const normalizeModelRow = (row) => {
    if (!row || typeof row !== "object") return null;

    const brand = getBrand(row);
    const model = getModel(row) || firstString(row, ["name", "nom", "label"]);

    return brand && model ? { brand, model } : null;
  };

  const normalizeEngineRows = (row) => {
    if (!row || typeof row !== "object") return [];

    const brand = getBrand(row);
    const model = getModel(row);
    const engine = getEngine(row);

    if (!brand || !model || !engine) return [];

    const powers = expandPowers(getPower(row));

    return powers.map((power) => ({
      brand,
      model,
      engine,
      power: String(power || "").trim(),
      fuel: getFuel(row),
      transmission: getTransmission(row),
      code: getCode(row)
    }));
  };

  const normalizeDefectRow = (row) => {
    if (!row || typeof row !== "object") return null;

    const brand = getBrand(row);
    if (!brand) return null;

    const models = firstList(row, [
      "models", "modeles", "model", "modele", "m", "vehicle", "vehicule"
    ]);

    const engines = firstList(row, [
      "engines", "motorisations", "moteurs", "engine", "motorisation", "moteur", "e"
    ]);

    const powers = firstList(row, [
      "powers", "puissances", "power", "puissance", "p"
    ]);

    const fuels = firstList(row, [
      "fuels", "energies", "fuel", "energie", "type", "t", "carburants", "carburant"
    ]);

    const symptoms = firstList(row, [
      "symptoms", "symptomes", "s", "pannes", "panne",
      "defauts", "defaut", "problemes", "probleme",
      "faults", "issue", "issues"
    ]);

    const severity = String(
      firstString(row, ["severity", "severite", "sev", "gravite"]) || "info"
    ).trim().toLowerCase();

    const description = firstString(row, [
      "description", "fiche", "expertise", "note", "n",
      "details", "resume", "résumé"
    ]);

    const legal = firstString(row, [
      "legal", "law", "baseLegale", "base_legale", "juridique"
    ]);

    const recall = firstString(row, [
      "recall", "rappel", "campaign", "campagne", "rec", "tsb"
    ]);

    const tags = firstList(row, [
      "tags", "tg", "mots_cles", "motscles", "keywords"
    ]).join("|");

    const dtc = firstList(row, [
      "dtc", "codes", "codeDtc", "code"
    ]).join("|");

    const source = firstString(row, ["source"]) || SOURCE;
    const sourceUrl = firstString(row, [
      "sourceUrl", "url", "lien", "link", "href"
    ]);

    return {
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
      source,
      sourceUrl
    };
  };

  const parsePayload = (payload) => {
    const parsed = {
      brands: [],
      models: [],
      engines: [],
      defects: []
    };

    const pushBrand = (row) => {
      const n = normalizeBrandRow(row);
      if (n) parsed.brands.push(n);
    };

    const pushModel = (row) => {
      const n = normalizeModelRow(row);
      if (n) parsed.models.push(n);
    };

    const pushEngine = (row) => {
      const rows = normalizeEngineRows(row);
      rows.forEach((r) => parsed.engines.push(r));
    };

    const pushDefect = (row) => {
      const n = normalizeDefectRow(row);
      if (n) parsed.defects.push(n);
    };

    const handleRow = (row) => {
      const kind = inferKind(row);

      if (kind === "brands") {
        pushBrand(row);
        return;
      }

      if (kind === "models") {
        pushModel(row);
        return;
      }

      if (kind === "engines") {
        pushEngine(row);
        return;
      }

      if (kind === "defects") {
        pushDefect(row);
        return;
      }

      // Secours : on tente dans l'ordre le plus précis
      const engines = normalizeEngineRows(row);
      if (engines.length) {
        engines.forEach((r) => parsed.engines.push(r));
        return;
      }

      const model = normalizeModelRow(row);
      if (model) {
        parsed.models.push(model);
        return;
      }

      const brand = normalizeBrandRow(row);
      if (brand) {
        parsed.brands.push(brand);
      }
    };

    if (Array.isArray(payload)) {
      payload.forEach(handleRow);
      return parsed;
    }

    if (!payload || typeof payload !== "object") {
      return parsed;
    }

    const root =
      payload.data ||
      payload.catalog ||
      payload.results ||
      payload.items ||
      payload.base ||
      payload;

    // Marques
    const brandArr = getArray(root, ["brands", "marques", "brand", "marque"]);
    if (brandArr) {
      brandArr.forEach(pushBrand);
    } else if (root.brands && typeof root.brands === "object" && !Array.isArray(root.brands)) {
      Object.keys(root.brands).forEach((k) => pushBrand({ brand: k }));
    } else if (root.marques && typeof root.marques === "object" && !Array.isArray(root.marques)) {
      Object.keys(root.marques).forEach((k) => pushBrand({ brand: k }));
    }

    // Modèles
    const modelArr = getArray(root, [
      "models", "modeles", "model", "modele", "vehicles", "vehicules"
    ]);

    if (modelArr) {
      modelArr.forEach(pushModel);
    } else if (root.models && typeof root.models === "object" && !Array.isArray(root.models)) {
      Object.entries(root.models).forEach(([brand, value]) => {
        toList(value).forEach((model) => pushModel({ brand, model }));
      });
    }

    // Motorisations
    const engineArr = getArray(root, [
      "engines", "motorisations", "moteurs", "engine", "motorisation"
    ]);

    if (engineArr) {
      engineArr.forEach(pushEngine);
    } else if (root.engines && typeof root.engines === "object" && !Array.isArray(root.engines)) {
      Object.entries(root.engines).forEach(([key, value]) => {
        const parts = String(key).split("|");
        const brand = parts[0] || "";
        const model = parts[1] || "";

        toList(value).forEach((item) => {
          if (typeof item === "string") {
            pushEngine({ brand, model, engine: item });
          } else if (item && typeof item === "object") {
            pushEngine({ brand, model, ...item });
          }
        });
      });
    }

    // Pannes / rappels / DTC
    const defectArr = getArray(root, [
      "defects", "pannes", "rappels", "recalls", "faults", "issues", "fiches"
    ]);

    if (defectArr) {
      defectArr.forEach(pushDefect);
    }

    // Si rien trouvé, scanner toutes les valeurs tableaux
    if (
      !parsed.brands.length &&
      !parsed.models.length &&
      !parsed.engines.length &&
      !parsed.defects.length
    ) {
      Object.values(root).forEach((v) => {
        if (Array.isArray(v)) v.forEach(handleRow);
      });
    }

    return parsed;
  };

  const validateParsed = (parsed) => {
    const stats = {
      fileName: "",
      fileSize: 0,
      brands: { received: parsed.brands.length, valid: 0, invalid: 0 },
      models: { received: parsed.models.length, valid: 0, invalid: 0 },
      engines: { received: parsed.engines.length, valid: 0, invalid: 0 },
      defects: { received: parsed.defects.length, valid: 0, invalid: 0 },
      errors: []
    };

    parsed.brands = parsed.brands.filter((b) => {
      const ok = !!b.name;
      if (ok) stats.brands.valid++;
      else stats.brands.invalid++;
      return ok;
    });

    parsed.models = parsed.models.filter((m) => {
      const ok = !!m.brand && !!m.model;
      if (ok) stats.models.valid++;
      else stats.models.invalid++;
      return ok;
    });

    parsed.engines = parsed.engines.filter((e) => {
      const ok = !!e.brand && !!e.model && !!e.engine;
      if (ok) stats.engines.valid++;
      else stats.engines.invalid++;
      return ok;
    });

    parsed.defects = parsed.defects.filter((d) => {
      const ok = !!d.brand;
      if (ok) stats.defects.valid++;
      else stats.defects.invalid++;
      return ok;
    });

    return stats;
  };

  const openDb = () => new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "key" });
          }
        });
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  const getIdbKeys = (db, store) => new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }

    try {
      const tx = db.transaction(store, "readonly");
      const os = tx.objectStore(store);

      if (typeof os.getAllKeys === "function") {
        const req = os.getAllKeys();
        req.onsuccess = () => resolve((req.result || []).map((k) => String(k)));
        req.onerror = () => resolve([]);
      } else {
        const req = os.getAll();
        req.onsuccess = () => {
          const rows = req.result || [];
          resolve(rows.map((r) => String(r && r.key ? r.key : "")));
        };
        req.onerror = () => resolve([]);
      }
    } catch {
      resolve([]);
    }
  });

  const idbCount = (db, store) => new Promise((resolve) => {
    if (!db) {
      resolve(0);
      return;
    }

    try {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).count();
      req.onsuccess = () => resolve(Number(req.result || 0));
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });

  const putAll = (db, store, items) => new Promise((resolve, reject) => {
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

  const putChunked = async (db, store, items) => {
    const chunkSize = 300;
    for (let i = 0; i < items.length; i += chunkSize) {
      await putAll(db, store, items.slice(i, i + chunkSize));
    }
  };

  const writeToDb = async (parsed) => {
    const db = await openDb();

    if (!db) {
      throw new Error("IndexedDB indisponible. Sors du mode privé et utilise Chrome, Edge ou Firefox.");
    }

    const [brandKeysRaw, modelKeysRaw, engineKeysRaw, defectKeysRaw] = await Promise.all([
      getIdbKeys(db, "brands"),
      getIdbKeys(db, "models"),
      getIdbKeys(db, "engines"),
      getIdbKeys(db, "defects")
    ]);

    const brandKeys = new Set(brandKeysRaw);
    const modelKeys = new Set(modelKeysRaw);
    const engineKeys = new Set(engineKeysRaw);
    const defectKeys = new Set(defectKeysRaw);

    const inserts = {
      brands: [],
      models: [],
      engines: [],
      defects: []
    };

    let duplicates = 0;

    const addBrand = (name) => {
      const key = normKey(name);
      if (!key) return false;

      if (brandKeys.has(key)) {
        duplicates++;
        return false;
      }

      brandKeys.add(key);
      inserts.brands.push({
        key,
        name: String(name || "").trim(),
        modelCount: 0,
        sources: [SOURCE],
        updatedAt: Date.now()
      });

      return true;
    };

    const addModel = (brand, model) => {
      const bk = normKey(brand);
      const mk = normKey(model);

      if (!bk || !mk) return false;

      if (!brandKeys.has(bk)) {
        addBrand(brand);
      }

      const key = `${bk}|${mk}`;

      if (modelKeys.has(key)) {
        duplicates++;
        return false;
      }

      modelKeys.add(key);
      inserts.models.push({
        key,
        brandKey: bk,
        brandName: String(brand || "").trim(),
        name: String(model || "").trim(),
        engineCount: 0,
        sources: [SOURCE],
        updatedAt: Date.now()
      });

      return true;
    };

    parsed.brands.forEach((b) => addBrand(b.name));

    parsed.models.forEach((m) => addModel(m.brand, m.model));

    parsed.engines.forEach((e) => {
      addBrand(e.brand);
      addModel(e.brand, e.model);

      const bk = normKey(e.brand);
      const mk = normKey(e.model);
      const modelKey = `${bk}|${mk}`;

      const key = [
        modelKey,
        normKey(e.engine),
        normKey(e.power),
        normKey(e.fuel),
        normKey(e.transmission),
        normKey(e.code)
      ].join("|");

      if (engineKeys.has(key)) {
        duplicates++;
        return;
      }

      engineKeys.add(key);

      inserts.engines.push({
        key,
        modelKey,
        brandKey: bk,
        brandName: String(e.brand || "").trim(),
        modelName: String(e.model || "").trim(),
        engine: String(e.engine || "").trim(),
        power: String(e.power || "").trim(),
        fuel: String(e.fuel || "").trim(),
        transmission: String(e.transmission || "").trim(),
        code: String(e.code || "").trim(),
        displacement: /l|cm3|cylindrée/i.test(String(e.code || "")) ? String(e.code) : "",
        sources: [SOURCE],
        confidence: 0.99,
        updatedAt: Date.now()
      });
    });

    parsed.defects.forEach((d) => {
      const key = normKey(JSON.stringify({
        b: d.brand,
        m: d.models || [],
        e: d.engines || [],
        p: d.powers || [],
        f: d.fuels || [],
        s: d.symptoms || [],
        desc: d.description || ""
      }));

      if (defectKeys.has(key)) {
        duplicates++;
        return;
      }

      defectKeys.add(key);

      inserts.defects.push({
        key,
        brand: String(d.brand || "").trim(),
        models: d.models || [],
        engines: d.engines || [],
        powers: d.powers || [],
        fuels: d.fuels || [],
        symptoms: d.symptoms || [],
        severity: String(d.severity || "info").trim(),
        description: String(d.description || "").trim(),
        legal: String(d.legal || "").trim(),
        recall: String(d.recall || "").trim(),
        tags: String(d.tags || "").trim(),
        dtc: String(d.dtc || "").trim(),
        source: String(d.source || SOURCE).trim(),
        sourceUrl: String(d.sourceUrl || "").trim(),
        sources: [String(d.source || SOURCE).trim()],
        updatedAt: Date.now()
      });
    });

    await putChunked(db, "brands", inserts.brands);
    await putChunked(db, "models", inserts.models);
    await putChunked(db, "engines", inserts.engines);
    await putChunked(db, "defects", inserts.defects);

    const inserted =
      inserts.brands.length +
      inserts.models.length +
      inserts.engines.length +
      inserts.defects.length;

    return {
      inserted,
      duplicates,
      details: {
        brands: inserts.brands.length,
        models: inserts.models.length,
        engines: inserts.engines.length,
        defects: inserts.defects.length
      }
    };
  };

  const formatReport = (stats, write) => {
    const lines = [];

    lines.push(`Fichier : ${stats.fileName || "-"} (${formatBytes(stats.fileSize || 0)})`);
    lines.push("");
    lines.push(`Marques : reçues ${stats.brands.received}, valides ${stats.brands.valid}, invalides ${stats.brands.invalid}`);
    lines.push(`Modèles : reçus ${stats.models.received}, valides ${stats.models.valid}, invalides ${stats.models.invalid}`);
    lines.push(`Motorisations : reçues ${stats.engines.received}, valides ${stats.engines.valid}, invalides ${stats.engines.invalid}`);
    lines.push(`Pannes / rappels : reçus ${stats.defects.received}, valides ${stats.defects.valid}, invalides ${stats.defects.invalid}`);

    if (write) {
      lines.push("");
      lines.push("--- Import effectué ---");
      lines.push(`Nouvelles entrées写入 : ${write.inserted}`);
      lines.push(`Doublons ignorés : ${write.duplicates}`);
      lines.push(`Marques ajoutées : ${write.details.brands}`);
      lines.push(`Modèles ajoutés : ${write.details.models}`);
      lines.push(`Motorisations ajoutées : ${write.details.engines}`);
      lines.push(`Pannes / rappels ajoutés : ${write.details.defects}`);
      lines.push("");
      lines.push("Action requise : clique sur 'Recharger l’application' pour charger la base en mémoire.");
    } else {
      lines.push("");
      lines.push("Mode vérification : rien n’a été écrit dans IndexedDB.");
    }

    if (stats.errors && stats.errors.length) {
      lines.push("");
      lines.push("Erreurs :");
      stats.errors.forEach((e) => lines.push("- " + e));
    }

    return lines.join("\n");
  };

  const readFileText = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("Lecture du fichier impossible"));
    fr.readAsText(file);
  });

  const isAdminSession = () => {
    const keys = [
      "arex_session_v31",
      "arex_session_v30",
      "arex_session_v29"
    ];

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const session = JSON.parse(raw);
        if (session && session.role === "admin") return true;
      } catch {}
    }

    return false;
  };

  const refreshAdminVisibility = () => {
    const block = $("#apkJsonAdminBlock");
    if (!block) return;
    block.classList.toggle("admin-ready", isAdminSession());
  };

  const updateVisibleCounts = async () => {
    const db = await openDb();
    if (!db) return;

    const [brands, models, engines, defects] = await Promise.all([
      idbCount(db, "brands"),
      idbCount(db, "models"),
      idbCount(db, "engines"),
      idbCount(db, "defects")
    ]);

    const setIf = (sel, value, prefix = "") => {
      const el = $(sel);
      if (el) el.textContent = prefix + value;
    };

    setIf("#statBrands", brands);
    setIf("#statModels", models);
    setIf("#statEngines", engines);
    setIf("#statEntries", defects);

    setIf("#apkCountBrands", brands, "Marques: ");
    setIf("#apkCountModels", models, "Modèles: ");
    setIf("#apkCountEngines", engines, "Motorisations: ");
    setIf("#apkCountDefects", defects, "Pannes: ");
  };

  const injectStyles = () => {
    if ($("#apkJsonAdminStyles")) return;

    const style = document.createElement("style");
    style.id = "apkJsonAdminStyles";
    style.textContent = `
      .apk-json-admin{
        display:none;
        margin-top:14px;
        padding:14px;
        border-radius:16px;
        background:rgba(2,6,23,0.30);
        border:1px solid rgba(148,163,184,0.18);
        color:#e5eefc;
      }
      .apk-json-admin.admin-ready{
        display:block;
      }
      .apk-json-admin h3{
        margin:0 0 8px;
        font-size:1.08rem;
      }
      .apk-json-admin .muted{
        color:#94a3b8;
        font-size:0.92rem;
      }
      .apk-json-admin .row-actions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin:12px 0;
      }
      .apk-json-admin .btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:10px 14px;
        border-radius:12px;
        border:1px solid rgba(148,163,184,0.22);
        background:rgba(255,255,255,0.06);
        color:#e5eefc;
        cursor:pointer;
        font-weight:700;
        font-size:0.94rem;
      }
      .apk-json-admin .btn.primary{
        background:linear-gradient(135deg,#3b82f6,#8b5cf6);
        border-color:transparent;
        color:white;
      }
      .apk-json-admin .btn.ghost{
        background:rgba(255,255,255,0.04);
      }
      .apk-json-admin .btn.apk-action{
        background:linear-gradient(135deg,#06b6d4,#22c55e);
        border-color:transparent;
        color:white;
      }
      .apk-json-admin .btn:disabled{
        opacity:0.55;
        cursor:not-allowed;
      }
      .apk-json-drop{
        margin:10px 0;
        padding:16px;
        border-radius:14px;
        border:1px dashed rgba(148,163,184,0.35);
        background:rgba(255,255,255,0.03);
        text-align:center;
        cursor:pointer;
        transition:0.18s ease;
      }
      .apk-json-drop.dragging{
        border-color:#22d3ee;
        background:rgba(34,211,238,0.08);
      }
      .apk-json-admin progress{
        width:100%;
        height:10px;
        border-radius:999px;
        overflow:hidden;
        margin:10px 0;
      }
      .apk-json-report{
        max-height:260px;
        overflow:auto;
        white-space:pre-wrap;
        word-break:break-word;
        background:rgba(2,6,23,0.42);
        border:1px solid rgba(148,163,184,0.16);
        border-radius:12px;
        padding:12px;
        font-size:0.86rem;
        color:#dbeafe;
      }
      .apk-json-admin .hidden{
        display:none !important;
      }
    `;

    document.head.appendChild(style);
  };

  const bindBlock = (root) => {
    const input = $("#apkJsonFileInput", root);
    const dropZone = $("#apkJsonDropZone", root);
    const fileNameEl = $("#apkJsonFileName", root);
    const validateBtn = $("#apkJsonValidateBtn", root);
    const importBtn = $("#apkJsonImportBtn", root);
    const reloadBtn = $("#apkJsonReloadBtn", root);
    const progressEl = $("#apkJsonProgress", root);
    const statusEl = $("#apkJsonStatus", root);
    const reportEl = $("#apkJsonReport", root);

    let selectedFile = null;

    const setStatus = (msg) => {
      if (statusEl) statusEl.textContent = msg;
    };

    const setProgress = (p) => {
      if (progressEl) progressEl.value = Math.max(0, Math.min(100, Number(p) || 0));
    };

    const setSelectedFile = (file) => {
      selectedFile = file || null;

      if (fileNameEl) {
        fileNameEl.textContent = selectedFile
          ? `${selectedFile.name} • ${formatBytes(selectedFile.size)}`
          : "Aucun fichier sélectionné.";
      }

      if (validateBtn) validateBtn.disabled = !selectedFile;
      if (importBtn) importBtn.disabled = !selectedFile;
      if (reloadBtn) reloadBtn.classList.add("hidden");
      if (reportEl) reportEl.textContent = "";
      if (progressEl) progressEl.value = 0;

      setStatus(selectedFile
        ? "Fichier chargé. Tu peux vérifier puis importer."
        : "Prêt."
      );
    };

    const handleAction = async (doImport) => {
      if (!selectedFile) {
        setStatus("Aucun fichier sélectionné.");
        return;
      }

      if (selectedFile.size > MAX_FILE_BYTES) {
        setStatus("Fichier trop volumineux.");
        if (reportEl) {
          reportEl.textContent =
            `Fichier trop volumineux : ${formatBytes(selectedFile.size)}.\n` +
            `Limite sécurisée : ${formatBytes(MAX_FILE_BYTES)}.`;
        }
        return;
      }

      try {
        setProgress(5);
        setStatus("Lecture du fichier JSON...");

        const text = await readFileText(selectedFile);

        setProgress(20);
        setStatus("Analyse du JSON...");

        let payload;
        try {
          payload = JSON.parse(text);
        } catch (e) {
          throw new Error("JSON invalide : " + e.message);
        }

        const parsed = parsePayload(payload);
        const stats = validateParsed(parsed);

        stats.fileName = selectedFile.name;
        stats.fileSize = selectedFile.size;

        if (!doImport) {
          setProgress(100);
          setStatus("Vérification terminée. Aucun import effectué.");
          if (reportEl) reportEl.textContent = formatReport(stats, null);
          return;
        }

        setProgress(45);
        setStatus("Écriture dans IndexedDB...");

        const write = await writeToDb(parsed);

        setProgress(100);
        setStatus("Import terminé. Recharge l’application pour charger la base en mémoire.");

        if (reportEl) reportEl.textContent = formatReport(stats, write);
        if (reloadBtn) reloadBtn.classList.remove("hidden");

        await updateVisibleCounts();
      } catch (e) {
        setProgress(100);
        setStatus("Échec de l’import.");

        if (reportEl) {
          reportEl.textContent =
            "Erreur :\n" +
            String(e && e.message ? e.message : e);
        }
      }
    };

    if (input) {
      input.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        setSelectedFile(file);
      });
    }

    if (dropZone) {
      dropZone.addEventListener("click", () => {
        if (input) input.click();
      });

      ["dragover", "dragenter"].forEach((evt) => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add("dragging");
        });
      });

      ["dragleave", "drop"].forEach((evt) => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("dragging");
        });
      });

      dropZone.addEventListener("drop", (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) setSelectedFile(file);
      });
    }

    if (validateBtn) {
      validateBtn.addEventListener("click", () => handleAction(false));
    }

    if (importBtn) {
      importBtn.addEventListener("click", () => handleAction(true));
    }

    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        location.reload(true);
      });
    }
  };

  const createBlockHtml = () => `
    <h3>📥 Import JSON admin — marques / modèles / motorisations / pannes</h3>
    <p class="muted">
      Importe un fichier JSON exporté depuis Auto Diagnostic Pro ou tout export compatible.
      Clés françaises et anglaises acceptées : marque/brand, modele/model, motorisation/engine, panne/defect, etc.
    </p>

    <div id="apkJsonDropZone" class="apk-json-drop">
      Glisse un fichier .json ici, ou clique pour sélectionner un fichier
    </div>

    <label class="btn primary">
      Choisir un fichier JSON
      <input id="apkJsonFileInput" type="file" accept=".json,application/json,text/plain" hidden />
    </label>

    <div id="apkJsonFileName" class="muted">Aucun fichier sélectionné.</div>

    <div class="row-actions">
      <button id="apkJsonValidateBtn" class="btn ghost" disabled>🔎 Vérifier sans importer</button>
      <button id="apkJsonImportBtn" class="btn primary" disabled>💾 Importer dans IndexedDB</button>
      <button id="apkJsonReloadBtn" class="btn apk-action hidden">🔄 Recharger l’application</button>
    </div>

    <progress id="apkJsonProgress" max="100" value="0"></progress>
    <div id="apkJsonStatus" class="muted">Prêt.</div>
    <pre id="apkJsonReport" class="apk-json-report"></pre>
  `;

  const ensureAdminBlock = () => {
    if ($("#apkJsonAdminBlock")) return true;

    const target =
      $("#dataPane") ||
      $("#adminPanel .modal-card") ||
      $("#adminPanel");

    if (!target) return false;

    const block = document.createElement("div");
    block.id = "apkJsonAdminBlock";
    block.className = "apk-json-admin";
    block.innerHTML = createBlockHtml();

    target.appendChild(block);
    bindBlock(block);
    refreshAdminVisibility();

    return true;
  };

  const init = () => {
    injectStyles();

    if (ensureAdminBlock()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (ensureAdminBlock()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => observer.disconnect(), 20000);

    setInterval(refreshAdminVisibility, 2000);
    window.addEventListener("storage", refreshAdminVisibility);
    document.addEventListener("click", refreshAdminVisibility, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }
})();
