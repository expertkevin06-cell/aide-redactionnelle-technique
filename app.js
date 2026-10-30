(function () {
  "use strict";

  /* =========================================================
     PROTECTION GLOBALE : AUCUNE ERREUR NE BLOQUE LE DEMARRAGE
     ========================================================= */
  window.addEventListener("error", function (event) {
    console.error("[AR-EXPERT] Erreur globale:", event.message);
    try { toast("Erreur interceptée: " + event.message, "error"); } catch (e) {}
  });

  window.addEventListener("unhandledrejection", function (event) {
    console.error("[AR-EXPERT] Promesse rejetée:", event.reason);
    try {
      toast("Action interrompue: " + (event.reason && event.reason.message ? event.reason.message : "erreur"), "error");
    } catch (e) {}
    if (event.preventDefault) event.preventDefault();
  });

  /* =========================================================
     HELPERS
     ========================================================= */
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

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

  function notify(title, body) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body });
      }
    } catch (e) {}
  }

  function askNotification() {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (e) {}
  }

  function sha256(text) {
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === "undefined") {
      return Promise.resolve("fallback:" + text);
    }
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function addTerm() {
    for (var i = 0; i < arguments.length; i++) {
      termesMobilises.add(arguments[i]);
    }
    return '<span class="termes-juridiques">(' + Array.prototype.slice.call(arguments).join(", ") + ")</span>";
  }

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  var CONFIG = {
    adminPassword: "Kevin83600",
    maxDailyAnalyses: 10,
    updateIntervalDays: 30,
    updateUrl: "./data/technical-updates.json"
  };

  var KEYS = {
    SESSION: "arex_session_v11",
    USERS: "arex_users_v11",
    REQUESTS: "arex_requests_v11",
    ADMIN_PWD_HASH: "arex_admin_pwd_hash_v11",
    TECH_UPDATES: "arex_tech_updates_v11",
    LAST_UPDATE: "arex_last_update_v11",
    LAST_BOOT: "arex_last_boot_v11"
  };

  var currentUser = null;
  var vehicleData = {};
  var analysisData = {};
  var extractedText = "";
  var termesMobilises = new Set();
  var deferredPrompt = null;
  var techUpdates = [];
  var broadcast = null;

  try {
    if ("BroadcastChannel" in window) {
      broadcast = new BroadcastChannel("arex_expert_channel");
    }
  } catch (e) {
    broadcast = null;
  }

  /* =========================================================
     BASE TECHNIQUE LOCALE MASSIVE 2017-2027
     Format compact :
     D(brand, models, years, engine, power, symptoms, severity, wearFactor, note, legal, recall, tags)
     ========================================================= */
  function D(b, m, y, e, p, s, sev, wf, n, law, rec, tg) {
    return {
      b: b,
      m: m,
      y: y,
      e: e,
      p: p,
      s: s,
      sev: sev,
      wf: wf,
      n: n,
      law: law,
      rec: rec,
      tg: tg
    };
  }

  var SEED_DEFECTS = [
    /* -----------------------------
       RENAULT / DACIA / FRANCE
       ----------------------------- */
    D("Renault", "Clio V|Captur II|Megane IV|Arkane|Scenic|Austral", "2017-2027", "1.0 TCe / 1.3 TCe H5Ht", "90ch-160ch",
      "consommation huile|turbo|wastegate|bruit chaine|voyant moteur|perte puissance|mode degrade|fumee|surchauffe",
      "critique", 0.75,
      "Petits essence turbo : surconsommation huile, turbo, chaine de distribution, PCV, perte de puissance et mode degrade.",
      "Vice cache art. 1641 C.civ.; defaut de conformite L.217-4 C.consom.; tromperie L.213-1 C.consom.",
      "TSB Renault TCe; forums proprietaires; rappel.conso",
      "moteur|turbo|conso|huile|puissance|distribution"),

    D("Renault", "Clio|Megane|Scenic|Duster|Kangoo|Trafic|Master", "2017-2022", "K9K / 1.5 dCi", "75ch-110ch",
      "casse bielle|claquement moteur|usure coussinets|pompe a huile|bruit metallique|pression huile basse|voyant huile|calage",
      "critique", 0.9,
      "Risque de casse bielle/coussinets lie a la lubrification et a la pompe a huile. Defaut chronique documente.",
      "Vice cache art. 1641 C.civ.; tromperie L.213-1; responsabilite contractuelle 1231-1 C.civ.",
      "Programme technique Renault K9K; TSB; jurisprudences",
      "moteur|huile|bielle|pompe|bruit|critique"),

    D("Renault", "Clio IV|Captur|Megane III|Kadjar|Austral", "2017-2024", "EDC6 / double embrayage", "N/A boite",
      "a-coups boite|blocage rapport|patinage|voyant boite|odeur brulee|vibrations|mode degrade|perte traction",
      "critique", 0.7,
      "Boite EDC : module mecatronique fragile, surchauffe embrayage en ville, reparation couteuse.",
      "Vice cache 1641 C.civ.; conformite L.217-4 C.consom.",
      "Programme qualite EDC Renault; forums",
      "boite|embrayage|mecatronique|a-coups"),

    D("Renault", "Trafic II|Master III|Espace V|Talisman", "2017-2027", "Carrosserie / electricite", "N/A",
      "infiltration eau|baie pare-brise|court circuit|moisiure|panne electronique|voyants aleatoires|erreur ABS|erreur ESP|corrosion|oeuf humidite",
      "critique", 0.95,
      "Defaut d'etancheite de la baie de pare-brise ou des evaicuations. L'eau atteint calculateurs, boitiers fusibles, faisceaux. Independant du kilometrage.",
      "Vice cache 1641 C.civ.; defaut de securite L.423-1 C.consom.; produits defectueux 1245 C.civ.",
      "Campagnes techniques Renault; forums Trafic/Master; DGCCRF",
      "eau|electricite|court-circuit|adas|securite|carrosserie"),

    D("Renault", "Megane E-Tech|Scenic E-Tech|Austral E-Tech|Captur E-Tech", "2022-2027", "E-Tech hybride / Full E-Tech electrique", "145ch-220ch",
      "autonomie reduite|voyant batterie|charge lente|charge DC|DC-DC|batterie 12V|BMS|software|ADAS|camera|radar|mode degrade",
      "critique", 0.9,
      "Plateformes electrifiees recentes : BMS, batterie 12V, charge, logiciel, capteurs ADAS, autonomie reelle.",
      "Conformite L.217-4 C.consom.; securite L.423-1; produits defectueux 1245 C.civ.",
      "Rappels Renault EV/hybride; DGCCRF; NHTSA si importe",
      "batterie|charge|autonomie|adas|logiciel|electricite"),

    D("Dacia", "Sandero|Duster|Logan|Lodgy|Jogger|Spring", "2017-2027", "K9K 1.5 dCi / EDC / LPG / Electric", "75ch-110ch",
      "casse bielle|pompe huile|bruit moteur|a-coups|patinage|voyant boite|autonomie|charge|batterie 12V",
      "critique", 0.85,
      "Base Renault K9K/EDC pour thermique; Spring : batterie, charge, autonomie, logiciel.",
      "Vice cache 1641 C.civ.; conformite L.217-4 si pro.",
      "TSB Dacia/Renault; forums",
      "moteur|boite|batterie|charge"),

    D("Peugeot", "208|2008|308|3008|5008|Partner|Rifter|Boxer", "2017-2024", "EB2 / 1.2 PureTech", "100ch-155ch",
      "courroie distribution|wet belt|desagregration courroie|crepine pompe|casse moteur|bruit cliquetis|voyant pression huile|consommation huile|surchauffe|mode degrade",
      "critique", 0.85,
      "Courroie humide qui se desagrege, bouche la crepine de pompe a huile et peut casser le moteur.",
      "Vice cache 1641 C.civ.; tromperie L.213-1; pratique commerciale trompeuse L.121-2.",
      "Extension garantie Stellantis PureTech; TSB; DGCCRF",
      "moteur|distribution|courroie|huile|pompe|critique"),

    D("Peugeot", "308|3008|508|Expert|Boxer", "2017-2024", "DV6 / 1.6 BlueHDi", "92ch-130ch",
      "EGR encrasse|FAP colmate|turbo HS|AdBlue|cristallisation|voyant antipollution|puissance reduite|mode degrade|fumee noire|conso gasoil",
      "moyen", 0.5,
      "Systemes de depollution sensibles aux trajets courts, a-froids, qualite carburant et entretien.",
      "Vice cache 1641 C.civ.; usure normale a ecarter par expertise.",
      "TSB PSA/Stellantis; forums",
      "diesel|EGR|FAP|AdBlue|turbo|pollution"),

    D("Peugeot", "308|3008|5008|e-208|e-2008", "2017-2027", "EAT8 / e-CMP electrique", "N/A",
      "a-coups|convertisseur|vibrations|patinage|voyant boite|autonomie|charge|BMS|batterie 12V|software|ADAS",
      "critique", 0.65,
      "Boite EAT8 et plateformes electriques e-CMP : convertisseur, logiciel, batterie, charge, ADAS.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Programme qualite Stellantis; rappels EV",
      "boite|batterie|charge|adas|logiciel"),

    D("Citroen", "C3|C3 Aircross|C4|C4 Cactus|C5 Aircross|Berlingo|Jumper", "2017-2024", "EB2 1.2 PureTech / BlueHDi", "100ch-130ch",
      "courroie distribution|casse moteur|bruit metallique|EGR|FAP|turbo|consommation huile|voyant moteur|surchauffe",
      "critique", 0.85,
      "Memes architectures PSA/Stellantis : wet belt, depollution, turbo, huile.",
      "Vice cache 1641 C.civ.; tromperie L.213-1.",
      "TSB Stellantis; forums",
      "moteur|distribution|diesel|turbo|huile"),

    D("Citroen", "e-C3|e-C4|C5 Aircross Hybrid", "2020-2027", "Electrique / hybride rechargeable", "N/A",
      "autonomie|charge AC|charge DC|batterie|BMS|12V|software|ADAS|camera|radar|chauffage|climatisation",
      "critique", 0.9,
      "Batterie, charge, logiciel, autonomie reelle, capteurs ADAS, confort thermique.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels Stellantis EV; DGCCRF",
      "batterie|charge|autonomie|adas|logiciel"),

    D("DS Automobiles", "DS 3 Crossback E-Tense|DS 4|DS 7 Crossback E-Tense", "2019-2027", "PureTech / BlueHDi / E-Tense 4x4", "130ch-360ch",
      "courroie|EGR|FAP|AdBlue|hybride|batterie|charge|software|ADAS|voyant moteur|perte puissance",
      "critique", 0.8,
      "Combine defectes PSA thermiques et plateformes hybrides rechargeables complexes.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "TSB Stellantis; forums DS",
      "moteur|hybride|batterie|adas|logiciel"),

    /* -----------------------------
       VOLKSWAGEN GROUP
       ----------------------------- */
    D("Volkswagen", "Golf 8|Polo|T-Cross|Taigo|Tiguan|Touran|Caddy", "2017-2027", "EA211 1.0 TSI / 1.5 TSI", "95ch-150ch",
      "consommation huile|turbo|chaine|voyant moteur|perte puissance|mode degrade|fumee|surchauffe|carbonisation",
      "moyen", 0.6,
      "Moteurs downsizing turbo : surveillance huile, turbo, chaine, encrassement, logiciel moteur.",
      "Vice cache 1641; conformite L.217-4 si pro.",
      "TSB VAG; forums Golf 8",
      "moteur|turbo|huile|distribution"),

    D("Volkswagen", "Golf|Passat|Tiguan|Touran|Sharan|Caddy", "2017-2024", "EA288 Evo 2.0 TDI", "115ch-200ch",
      "AdBlue|cristallisation|pompe AdBlue|NOx|EGR|FAP|capteur NOx|voyant antipollution|mode degrade|impossibilite redemarrer",
      "moyen", 0.45,
      "Chaine de depollution diesel : AdBlue, NOx, EGR, FAP, logiciel moteur.",
      "Vice cache 1641; tromperie L.213-1 si dissimulation; conformite L.217-4.",
      "Rappels VAG diesel; CJUE; DGCCRF",
      "diesel|AdBlue|NOx|EGR|FAP|pollution"),

    D("Volkswagen", "Golf|Polo|T-Cross|Taigo|Tiguan|Touran", "2017-2024", "DSG DQ200 / DQ381", "N/A boite",
      "a-coups|mecatronique|patinage|bruit claquement|voyant boite|mode degrade|blocage vitesse|odeur brulee",
      "critique", 0.7,
      "Boites DSG : mecatronique, embrayage, convertisseur, logiciel boite.",
      "Vice cache 1641; conformite L.217-4; tromperie L.213-1.",
      "Rappels/TSB VAG DSG; class actions",
      "boite|DSG|mecatronique|embrayage"),

    D("Volkswagen", "ID.3|ID.4|ID.5|ID.7", "2020-2027", "MEB electrique", "145ch-286ch",
      "autonomie|charge AC|charge DC|BMS|cellules|logiciel|software|ADAS|Travel Assist|camera|radar|12V|DC-DC|porte de charge|thermal derating",
      "critique", 0.92,
      "Plateforme MEB : logiciel, charge, batterie, autonomie, ADAS, batterie 12V, DC-DC.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels VW ID; KBA Allemagne; NHTSA; DGCCRF",
      "batterie|charge|autonomie|adas|logiciel|electricite"),

    D("Audi", "A1|A3|A4|A5|Q2|Q3|Q5", "2017-2027", "EA211 / EA888 / DSG", "110ch-265ch",
      "consommation huile|turbo|chaine|DSG|mecatronique|a-coups|voyant moteur|mode degrade|AdBlue|FAP",
      "critique", 0.7,
      "Groupe VAG : moteurs turbo, DSG, depollution diesel, logiciel.",
      "Vice cache 1641; conformite L.217-4; tromperie L.213-1.",
      "TSB Audi/VAG; rappels",
      "moteur|boite|DSG|diesel|turbo"),

    D("Audi", "Q4 e-tron|e-tron GT|A6 e-tron|Q6 e-tron", "2021-2027", "Electrique PPE/MEB", "204ch-544ch",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|DC-DC|thermal|logiciel",
      "critique", 0.92,
      "Modeles electriques Audi : batterie, charge rapide, logiciel, ADAS, gestion thermique.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels Audi e-tron; KBA; NHTSA",
      "batterie|charge|ADAS|logiciel|electricite"),

    D("Skoda", "Fabia|Octavia|Superb|Karoq|Kodiaq|Enyaq", "2017-2027", "TSI / TDI / DSG / MEB", "95ch-299ch",
      "consommation huile|turbo|DSG|AdBlue|FAP|batterie|charge|autonomie|software|ADAS",
      "critique", 0.7,
      "Base VAG : TSI/TDI, DSG, Enyaq MEB, logiciel et ADAS.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Skoda/VAG; rappels Enyaq",
      "moteur|boite|batterie|ADAS|logiciel"),

    D("SEAT / Cupra", "Ibiza|Leon|Ateca|Arona|Toledo|Born|Tavascan", "2017-2027", "TSI / TDI / DSG / MEB", "95ch-326ch",
      "DSG|mecatronique|a-coups|consommation huile|turbo|batterie|charge|autonomie|software|ADAS",
      "critique", 0.7,
      "Groupe VAG : DSG, moteurs turbo, Cupra Born/Tavascan sur base MEB.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "TSB Seat/Cupra; rappels VAG",
      "boite|DSG|batterie|ADAS|logiciel"),

    /* -----------------------------
       BMW / MERCEDES / VOLVO / PORSCHE / JLR
       ----------------------------- */
    D("BMW", "Serie 1|Serie 2|Serie 3|Serie 4|X1|X2|X3|X4", "2017-2027", "B38 / B46 / B48 / B58", "136ch-387ch",
      "consommation huile|turbo|vanne PCV|refroidissement|pompe a eau|voyant moteur|perte puissance|surchauffe|fuite liquide|fuite huile",
      "critique", 0.75,
      "Moteurs BMW turbo : PCV, refroidissement, pompes a eau, fuites huile/liquide, logiciel moteur.",
      "Vice cache 1641; defaut de securite L.423-1 si fuite sur echappement; conformite L.217-4.",
      "TSB BMW; rappels pompe a eau; forums",
      "moteur|turbo|huile|liquide|refroidissement|fuite"),

    D("BMW", "Serie 3|Serie 5|X3|X5|X7", "2017-2027", "B47 / 2.0d / 3.0d", "150ch-400ch",
      "chaine distribution|tensionneur|bruit crecelle|claquement|voyant moteur|mode degrade|AdBlue|NOx|FAP",
      "critique", 0.8,
      "Chaines de distribution diesel/essence, tensionneurs, depollution AdBlue/NOx.",
      "Vice cache 1641; tromperie L.213-1 si dissimulation.",
      "Rappels BMW chaine; TSB diesel",
      "distribution|chaine|diesel|AdBlue|bruit"),

    D("BMW", "iX1|iX3|i4|iX|i7", "2021-2027", "Electrique / PHEV", "204ch-650ch",
      "batterie|charge AC|charge DC|autonomie|BMS|software|iDrive|ADAS|camera|radar|12V|DC-DC|thermal",
      "critique", 0.9,
      "Plateformes electrifiees BMW : batterie, charge, logiciel, ADAS, gestion thermique.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels BMW i; KBA; NHTSA",
      "batterie|charge|ADAS|logiciel|electricite"),

    D("Mercedes-Benz", "Classe A|Classe B|CLA|GLA|Classe C|Classe E|GLC|GLE", "2017-2027", "M254 / OM654 / 48V", "120ch-435ch",
      "turbo|AdBlue|NOx|capteur|voyant moteur|mode degrade|consommation huile|fuite|48V|batterie secondaire|EQ Boost",
      "critique", 0.7,
      "Motorisations recentrees : turbo, AdBlue, NOx, micro-hybridation 48V, fuites, logiciel.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "TSB Mercedes; rappels diesel/48V",
      "moteur|turbo|AdBlue|48V|fuite|logiciel"),

    D("Mercedes-Benz", "Classe C|Classe E|GLC|GLE|EQE|EQS|EQB|EQA", "2017-2027", "9G-Tronic / EQ electrique", "N/A",
      "a-coups|convertisseur|calculateur boite|voyant boite|batterie|charge|autonomie|MBUX|software|ADAS|Distance Pilot|Active Brake",
      "critique", 0.65,
      "Boites 9G et plateformes EQ : logiciel, ADAS, batterie, charge, autonomie.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Mercedes EQ/ADAS; KBA",
      "boite|batterie|ADAS|logiciel|charge"),

    D("Volvo", "XC40|XC60|XC90|V60|V90|S60|S90|C40|EX30|EX40|EC40", "2017-2027", "Drive-E / 48V / PHEV / Recharge", "150ch-455ch",
      "consommation huile|turbo|compresseur|chaine|48V|batterie PHEV|charge|autonomie|Pilot Assist|camera|radar|software",
      "critique", 0.8,
      "Drive-E essence : huile/turbo/chaine. Electrification : 48V, PHEV, batterie, ADAS Pilot Assist.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Volvo; TSB Drive-E; DGCCRF",
      "moteur|huile|turbo|batterie|ADAS|logiciel"),

    D("Porsche", "Macan|Cayenne|Panamera|Taycan|911", "2017-2027", "PDK / Turbo / Taycan electrique", "245ch-761ch",
      "PDK|a-coups|embrayage|volant moteur|batterie|charge|autonomie|software|ADAS|thermal|12V",
      "critique", 0.7,
      "PDK, hybrides, Taycan : batterie, charge, logiciel, gestion thermique, ADAS.",
      "Vice cache 1641; conformite L.217-4; produits defectueux 1245.",
      "Rappels Porsche; TSB Taycan",
      "boite|PDK|batterie|charge|ADAS"),

    D("Land Rover / Jaguar", "Defender|Discovery|Range Rover|Evoque|Velar|F-Pace|E-Pace|I-Pace", "2017-2027", "Ingenium / PHEV / I-Pace", "163ch-550ch",
      "consommation huile|turbo|refroidissement|fuite liquide|incendie|PHEV|batterie|charge|software|Pivi|ADAS|camera|radar",
      "critique", 0.8,
      "Ingenium : huile/refroidissement/fuites. PHEV/EV : batterie, charge, logiciel, ADAS.",
      "Vice cache 1641; securite L.423-1; produits defectueux 1245.",
      "Rappels JLR; incendie Ingenium; forums",
      "moteur|fuite|incendie|batterie|ADAS|logiciel"),

    /* -----------------------------
       OPEL / FIAT / ALFA / MINI / FORD / TESLA / JEEP
       ----------------------------- */
    D("Opel", "Corsa|Astra|Mokka|Grandland|Zafira|Combo", "2017-2027", "PureTech / BlueHDi / e-Corsa", "75ch-130ch",
      "courroie distribution|EGR|FAP|AdBlue|batterie|charge|autonomie|software|ADAS",
      "critique", 0.8,
      "Base PSA/Stellantis : wet belt, depollution, e-Corsa batterie/charge.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Opel/Stellantis",
      "moteur|distribution|diesel|batterie"),

    D("Fiat", "500|500e|Panda|Tipo|Tonale|Doblo", "2017-2027", "FireFly / Hybrid / 500e electrique", "70ch-150ch",
      "hybridation 48V|batterie 12V|charge|autonomie|software|Dualogic|a-coups|embrayage|robot",
      "critique", 0.75,
      "Micro-hybridation 48V, 500e electrique, boites robotisees Dualogic/EDC selon modeles.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Fiat 500e/Hybrid; TSB Stellantis",
      "48V|batterie|charge|boite|logiciel"),

    D("Alfa Romeo", "Giulia|Stelvio|Tonale", "2017-2027", "2.0 Turbo / PHEV Tonale", "160ch-280ch",
      "turbo|consommation huile|refroidissement|PHEV|batterie|charge|software|ADAS|boite ZF",
      "critique", 0.75,
      "2.0 turbo, plateforme Giorgio, Tonale PHEV : batterie, charge, logiciel, ADAS.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Alfa/Stellantis; forums",
      "moteur|turbo|PHEV|batterie|ADAS"),

    D("MINI", "Cooper|Cooper S|Countryman|Clubman|Aceman", "2017-2027", "B38 / B48 / Getrag / Aisin / Electrique", "136ch-306ch",
      "chaine distribution|consommation huile|turbo|water pump|boite|a-coups|patinage|batterie|charge|software|ADAS",
      "critique", 0.8,
      "Moteurs BMW/PSA Prince puis BMW : chaine, huile, turbo, boites, electrification.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels MINI/BMW; TSB",
      "distribution|huile|turbo|boite|batterie"),

    D("Ford", "Fiesta|Focus|Puma|Kuga|Explorer|Transit", "2017-2027", "EcoBoost 1.0 / 1.5 / 2.3 / PowerShift", "95ch-280ch",
      "joint culasse|surchauffe|refroidissement|pompe a eau|eau dans huile|fumee blanche|PowerShift|a-coups|embrayage|vibrations|odeur brulee",
      "critique", 0.85,
      "EcoBoost 1.0 : refroidissement/joint culasse. PowerShift : embrayage sec fragile.",
      "Vice cache 1641; tromperie L.213-1; conformite L.217-4.",
      "Class actions PowerShift; TSB Ford EcoBoost",
      "moteur|refroidissement|culasse|boite|embrayage"),

    D("Ford", "Mustang Mach-E", "2021-2027", "Electrique", "269ch-487ch",
      "batterie|charge|autonomie|BMS|software|BlueCruise|ADAS|camera|radar|12V|porte de charge|thermal",
      "critique", 0.9,
      "Plateforme electrique Ford : batterie, charge, logiciel, BlueCruise, ADAS.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels Ford Mach-E; NHTSA",
      "batterie|charge|ADAS|logiciel"),

    D("Tesla", "Model 3|Model Y|Model S|Model X", "2017-2027", "Electrique", "283ch-1020ch",
      "Autopilot|FSD|phantom braking|12V battery|charging port|door handle|software|battery degradation|thermal|range|ADAS|camera|radar",
      "critique", 0.92,
      "ADAS, batterie 12V, port de charge, degradation batterie, logiciels, poignées, gestion thermique.",
      "Securite L.423-1; conformite L.217-4; produits defectueux 1245; penal si accident.",
      "NHTSA Tesla recalls; DGCCRF; SafetyGate",
      "ADAS|batterie|charge|logiciel|securite"),

    D("Jeep", "Renegade|Compass|Wrangler|Grand Cherokee|Grand Cherokee 4xe", "2017-2027", "DDCT / Hurricane / 4xe PHEV", "120ch-490ch",
      "DDCT|surchauffe embrayage|a-coups|bruit boite|mode limp|PHEV|batterie|charge|autonomie|software|ADAS",
      "critique", 0.75,
      "Boite DDCT en ville, 4xe : batterie, charge, logiciel, ADAS.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB FCA/Stellantis; rappels 4xe",
      "boite|embrayage|PHEV|batterie|ADAS"),

    /* -----------------------------
       TOYOTA / LEXUS / HONDA / NISSAN / MAZDA / SUBARU / SUZUKI / MITSUBISHI
       ----------------------------- */
    D("Toyota", "Yaris|Corolla|Camry|RAV4|C-HR|Prius|Hilux|Land Cruiser", "2017-2027", "Hybride THS / Dynamic Force / D-4D", "100ch-309ch",
      "batterie hybride|refroidissement batterie|CVT|bruit|vibration|12V|Toyota Safety Sense|camera|radar|ADAS|consommation|mode degrade",
      "critique", 0.65,
      "Hybrides Toyota : batterie, ventilation, CVT, 12V, ADAS Toyota Safety Sense.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Toyota hybride/ADAS; NHTSA",
      "hybride|batterie|CVT|ADAS|12V"),

    D("Lexus", "UX|NX|RX|ES|IS|LBX", "2017-2027", "Hybride / Multi-stage Hybrid", "180ch-414ch",
      "batterie hybride|CVT|refroidissement|ADAS|camera|radar|software|12V|autonomie hybride",
      "moyen", 0.6,
      "Architecture hybride Lexus : batterie, CVT, ADAS, logiciel.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Lexus/Toyota",
      "hybride|batterie|ADAS|CVT"),

    D("Honda", "Jazz|Civic|HR-V|CR-V|Accord|e:Ny1", "2017-2027", "1.0 / 1.5 Turbo / i-MMD / electrique", "130ch-212ch",
      "turbo|CVT|bruit|vibration|huile|refroidissement|batterie|charge|autonomie|Honda Sensing|ADAS|camera|radar",
      "critique", 0.7,
      "Turbo/HV/CVT et Honda Sensing. e:Ny1 : batterie, charge, logiciel.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels Honda; TSB i-MMD",
      "moteur|turbo|CVT|ADAS|batterie"),

    D("Nissan", "Qashqai|X-Trail|Juke|Ariya|Leaf|Navara", "2017-2027", "1.3 TCe / CVT / e-POWER / electrique", "140ch-306ch",
      "CVT|a-coups|glissement|surchauffe|e-POWER|batterie|charge|autonomie|ProPILOT|ADAS|camera|radar|software|12V",
      "critique", 0.75,
      "CVT/X-Tronic, e-POWER, Ariya/Leaf : batterie, charge, ADAS ProPILOT, logiciel.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Nissan CVT/ADAS; NHTSA",
      "CVT|boite|batterie|ADAS|logiciel"),

    D("Mazda", "2|3|CX-3|CX-30|CX-5|CX-60|MX-30", "2017-2027", "Skyactiv-G / Skyactiv-X / MX-30 range extender", "110ch-327ch",
      "compression|huile|bruit|CVT?|boite auto|mild hybrid|48V|batterie MX-30|charge|autonomie|ADAS|i-Activsense",
      "moyen", 0.6,
      "Skyactiv-X compression, mild hybrid 48V, MX-30 electrique/range extender, ADAS.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Mazda; forums",
      "moteur|48V|batterie|ADAS"),

    D("Subaru", "XV|Forester|Outback|Impreza|WRX", "2017-2027", "Boxer / Lineartronic CVT", "115ch-275ch",
      "CVT|bruit|vibration|huile|refroidissement|EyeSight|ADAS|camera|radar|logiciel",
      "moyen", 0.6,
      "CVT Lineartronic et EyeSight : capteurs, logiciel, entretien.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels Subaru EyeSight; NHTSA",
      "CVT|ADAS|huile|logiciel"),

    D("Suzuki", "Swift|Ignis|Vitara|S-Cross|Jimny|ACROSS", "2017-2027", "Boosterjet / Mild Hybrid / AllGrip", "90ch-136ch",
      "turbo|48V|batterie 12V|CVT|AllGrip|ADAS|camera|radar|software|conso",
      "moyen", 0.55,
      "Micro-hybridation 48V, CVT, ADAS Suzuki Safety Support.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB Suzuki; forums",
      "48V|turbo|CVT|ADAS"),

    D("Mitsubishi", "Space Star|ASX|Eclipse Cross|Outlander|Outlander PHEV", "2017-2027", "CVT / PHEV 4WD", "105ch-224ch",
      "CVT|bruit|surchauffe|PHEV|batterie|charge|autonomie|ADAS|camera|radar|software",
      "critique", 0.7,
      "Outlander PHEV : batterie, charge, gestion 4WD, CVT, ADAS.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels Mitsubishi PHEV; NHTSA",
      "CVT|PHEV|batterie|ADAS"),

    /* -----------------------------
       HYUNDAI / KIA / GENESIS
       ----------------------------- */
    D("Hyundai", "i10|i20|i30|Bayon|Tucson|Santa Fe|Kona|IONIQ 5|IONIQ 6", "2017-2027", "Smartstream / Theta / Gamma / E-GMP", "80ch-325ch",
      "consommation huile|turbo|DSCT|a-coups|batterie|charge|autonomie|BMS|Bluelink|ADAS|camera|radar|software|12V",
      "critique", 0.75,
      "Moteurs turbo, boites DCT, plateformes E-GMP : batterie, charge rapide, ADAS, logiciel.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Hyundai/Kia; NHTSA; KBA",
      "moteur|boite|batterie|ADAS|logiciel"),

    D("Kia", "Picanto|Ceed|Stonic|Sportage|Sorento|Niro|EV6|EV9", "2017-2027", "Smartstream / DCT / E-GMP", "84ch-585ch",
      "DCT|a-coups|embrayage|batterie|charge|autonomie|BMS|ADAS|camera|radar|software|12V|V2L",
      "critique", 0.75,
      "DCT, EV6/EV9 : batterie, charge, V2L, ADAS, logiciel.",
      "Vice cache 1641; conformite L.217-4; securite L.423-1.",
      "Rappels Kia EV; NHTSA",
      "boite|batterie|charge|ADAS|logiciel"),

    /* -----------------------------
       CHINOIS / NOUVELLES MARQUES EV
       ----------------------------- */
    D("MG / SAIC", "MG3|MG ZS|MG ZS EV|MG4|MG5|Marvel R|Cyster", "2019-2027", "Electrique / PHEV / essence", "116ch-435ch",
      "batterie|charge AC|charge DC|autonomie|BMS|software|ADAS|port de charge|12V|camera|radar|thermal derating",
      "critique", 0.9,
      "Plateformes SAIC/MG : batterie, charge, logiciel, ADAS, autonomie reelle, temperature.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels MG; DGCCRF; SafetyGate",
      "batterie|charge|ADAS|logiciel|autonomie"),

    D("BYD", "Atto 3|Dolphin|Seal|Han|Tang", "2022-2027", "Blade Battery electrique / PHEV", "177ch-530ch",
      "batterie Blade|charge|autonomie|BMS|DiLink|software|ADAS|camera|radar|12V|thermal|port de charge",
      "critique", 0.9,
      "BYD : batterie Blade, charge, logiciel DiLink, ADAS, gestion thermique.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels BYD; DGCCRF; NHTSA si importe",
      "batterie|charge|ADAS|logiciel"),

    D("Leapmotor", "T03|C10|B10", "2023-2027", "Electrique", "95ch-218ch",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|connectivite",
      "critique", 0.88,
      "Nouvelles plateformes chinoises EV : batterie, charge, logiciel, ADAS.",
      "Conformite L.217-4; securite L.423-1.",
      "Rappels Leapmotor; DGCCRF",
      "batterie|charge|ADAS|logiciel"),

    D("XPeng / NIO / Aiways / Ora", "G6|P7|ET5|ES6|U5|Funky Cat|03", "2020-2027", "Electrique", "150ch-600ch",
      "batterie|charge|swap|autonomie|BMS|software|ADAS|camera|lidar|radar|12V|connectivite|thermal",
      "critique", 0.9,
      "EV chinois premium : batterie, charge/swap, ADAS avancés, lidar, logiciel.",
      "Conformite L.217-4; securite L.423-1; produits defectueux 1245.",
      "Rappels constructeurs chinois; SafetyGate",
      "batterie|charge|ADAS|logiciel|autonomie"),

    D("Chery / Omoda / Jaecoo", "Omoda 5|Jaecoo 7|Tiggo", "2023-2027", "1.6 TGDI / DCT / PHEV", "147ch-300ch+",
      "turbo|DCT|a-coups|embrayage|batterie|charge|autonomie|ADAS|camera|radar|software|conso",
      "critique", 0.75,
      "Nouvelles marques chinoises : turbo, DCT, PHEV, ADAS, logiciel.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels Chery/Omoda; DGCCRF",
      "moteur|boite|DCT|ADAS|batterie"),

    D("Geely / Smart / Lotus", "Coolray|Emgrand|Smart #1|Smart #3|Eletre", "2022-2027", "Electrique / hybride", "200ch-600ch+",
      "batterie|charge|autonomie|BMS|software|ADAS|camera|radar|12V|connectivite",
      "critique", 0.88,
      "Plateformes SEA/Geely : batterie, charge, logiciel, ADAS.",
      "Conformite L.217-4; securite L.423-1.",
      "Rappels Geely/Smart; SafetyGate",
      "batterie|charge|ADAS|logiciel"),

    D("Maxus / LDV / GWM", "eDeliver|W90|Tank|Ora", "2019-2027", "Electrique / hybride / utilitaire", "130ch-400ch",
      "batterie|charge|autonomie|BMS|software|ADAS|12V|fuite|refroidissement|utilitaire",
      "critique", 0.85,
      "Utilitaires et SUV chinois electrifies : batterie, charge, logiciel, refroidissement.",
      "Conformite L.217-4; securite L.423-1.",
      "Rappels Maxus/LDV/GWM",
      "batterie|charge|utilitaire|ADAS"),

    /* -----------------------------
       AMERICAIN / GENERAL MOTORS / RAM / CHRYSLER
       ----------------------------- */
    D("Chevrolet / GMC / Cadillac", "Bolt EV|Bolt EUV|Lyriq|Hummer EV", "2017-2027", "Electrique Ultium / Bolt", "204ch-1000ch",
      "incendie|batterie|thermal runaway|charge|recall|BMS|software|ADAS|Super Cruise|autonomie|12V",
      "critique", 1.0,
      "Bolt : rappel mondial incendie batterie. Ultium/Super Cruise : logiciel, charge, ADAS.",
      "Securite L.423-1; produits defectueux 1245; penal si accident; conformite L.217-4.",
      "NHTSA Bolt recall; GM recalls; DGCCRF",
      "incendie|batterie|charge|ADAS|logiciel"),

    D("RAM / Chrysler / Dodge", "1500|Pacifica|Pacifica Hybrid|Charger", "2017-2027", "Diesel / PHEV / Hurricane / Electrique", "250ch-670ch",
      "turbo|boite|8-speed|PHEV|batterie|charge|autonomie|software|ADAS|fuel pump|fuite carburant",
      "critique", 0.75,
      "Gros moteurs, boites auto, PHEV, pompes a carburant, ADAS.",
      "Vice cache 1641; securite L.423-1; conformite L.217-4.",
      "NHTSA RAM/Chrysler; recalls",
      "moteur|boite|PHEV|carburant|ADAS"),

    /* -----------------------------
       THEMES TRANSVERSAUX SECURITE
       ----------------------------- */
    D("Toutes marques", "Vehicules 2017-2027", "2017-2027", "ADAS / conduite assistee", "N/A",
      "ADAS|camera|radar|lidar|phantom braking|lane keeping|traffic jam assist|emergency brake|calibration|software|mise a jour",
      "critique", 0.95,
      "Defauts ADAS : calibration, capteurs, logiciel, freinage fantome, assistance autoroute.",
      "Securite L.423-1; conformite L.217-4; produits defectueux 1245; penal si accident.",
      "NHTSA ADAS; Euro NCAP; DGCCRF; SafetyGate",
      "ADAS|logiciel|securite|capteurs"),

    D("Toutes marques", "Hybrides / electriques 2017-2027", "2017-2027", "Batterie HV / 12V / charge", "N/A",
      "batterie|BMS|charge AC|charge DC|autonomie|thermal runaway|incendie|12V|DC-DC|software|cell imbalance",
      "critique", 0.95,
      "Batteries haute tension, desequilibre cellules, charge, incendie, batterie 12V, DC-DC.",
      "Securite L.423-1; produits defectueux 1245; conformite L.217-4.",
      "NHTSA battery recalls; DGCCRF; KBA",
      "batterie|charge|incendie|electricite|securite"),

    D("Toutes marques", "Diesel 2017-2027", "2017-2027", "Dépollution diesel", "N/A",
      "EGR|FAP|DPF|AdBlue|NOx|capteur NOx|cristallisation|pompe AdBlue|regeneration|voyant antipollution|mode degrade|fumee noire",
      "moyen", 0.5,
      "Systemes EGR/FAP/AdBlue/NOx : encrassement, capteurs, regeneration, logiciel.",
      "Vice cache 1641; usure normale a ecarter; tromperie L.213-1 si logiciel.",
      "Rappels diesel; CJUE; DGCCRF",
      "diesel|EGR|FAP|AdBlue|NOx|pollution"),

    D("Toutes marques", "Essence turbo 2017-2027", "2017-2027", "Downsizing turbo", "N/A",
      "turbo|wastegate|actuateur|consommation huile|PCV|segments|LSPI|preignition|carbonisation|voyant moteur|perte puissance",
      "critique", 0.7,
      "Turbo, PCV, segments, LSPI/pre-ignition, encrassement, perte de puissance.",
      "Vice cache 1641; conformite L.217-4.",
      "TSB constructeurs; forums",
      "moteur|turbo|huile|combustion|puissance"),

    D("Toutes marques", "Boites auto/robotisees 2017-2027", "2017-2027", "DSG / EDC / DCT / CVT / PowerShift / PDK", "N/A",
      "a-coups|patinage|embrayage|mecatronique|convertisseur|voyant boite|mode degrade|surchauffe|odeur brulee|bruit",
      "critique", 0.7,
      "Boites automatiques/robotisees : mecatronique, embrayage, convertisseur, logiciel.",
      "Vice cache 1641; conformite L.217-4.",
      "Rappels boites; TSB",
      "boite|embrayage|DSG|CVT|logiciel"),

    D("Toutes marques", "Electricite / carrosserie 2017-2027", "2017-2027", "Faisceaux / etancheite", "N/A",
      "court circuit|infiltration eau|corrosion|faisceau|boitier fusibles|calculateurs|voyants aleatoires|incendie electrique|odeur brulee",
      "critique", 0.9,
      "Infiltrations, corrosion, courts-circuits, faisceaux, calculateurs, risque incendie electrique.",
      "Securite L.423-1; vice cache 1641; produits defectueux 1245.",
      "Rappels incendie electrique; NHTSA; DGCCRF",
      "electricite|eau|incendie|corrosion|securite"),

    D("Toutes marques", "Fuites de fluides 2017-2027", "2017-2027", "Carburant / huile / liquide", "N/A",
      "fuite carburant|fuite huile|fuite liquide refroidissement|fuite frein|fuite direction|incendie|odeur|niveau bas|voyant",
      "critique", 0.85,
      "Fuites de fluides : risque incendie, perte de freinage, surchauffe, pollution.",
      "Securite L.423-1; vice cache 1641; penal si accident.",
      "Rappels fuites; NHTSA; DGCCRF",
      "fuite|incendie|frein|refroidissement|securite")
  ];

  /* =========================================================
     NORMALISATION / FUSION DES DEF AUTS
     ========================================================= */
  function normalizeDefect(d) {
    return {
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
  }

  function defectKey(d) {
    return norm(d.b) + "|" + norm(d.e) + "|" + norm(d.y) + "|" + norm(d.m).slice(0, 40);
  }

  function mergeDefects(base, incoming) {
    var map = new Map();
    base.forEach(function (d) { map.set(defectKey(d), d); });
    incoming.forEach(function (d) {
      var nd = normalizeDefect(d);
      if (!nd.b || !nd.s) return;
      map.set(defectKey(nd), nd);
    });
    return Array.from(map.values());
  }

  function allDefects() {
    return SEED_DEFECTS.concat(techUpdates);
  }

  /* =========================================================
     MISE A JOUR AUTOMATIQUE TOUS LES 30 JOURS
     ========================================================= */
  function checkAutoUpdate(manual) {
    try {
      var last = load(KEYS.LAST_UPDATE, 0);
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
    var statusEl = q("#dataStatus");
    if (statusEl) statusEl.textContent = manual ? "Recherche de mise à jour..." : "Mise à jour périodique en arrière-plan...";

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

  function updateDataStatus(msg) {
    var el = q("#dataStatus");
    if (el) el.textContent = msg;
  }

  /* =========================================================
     AUTH / USERS / REQUESTS
     ========================================================= */
  function getUsers() { return load(KEYS.USERS, []); }
  function saveUsers(users) { save(KEYS.USERS, users); }

  function getRequests() { return load(KEYS.REQUESTS, []); }
  function saveRequests(requests) { save(KEYS.REQUESTS, requests); }

  function findUser(name, email) {
    var n = String(name || "").trim().toLowerCase();
    var e = String(email || "").trim().toLowerCase();
    return getUsers().find(function (u) {
      return u.name.toLowerCase() === n && u.email.toLowerCase() === e;
    });
  }

  function upsertUser(user) {
    var users = getUsers();
    var idx = users.findIndex(function (u) {
      return u.name.toLowerCase() === user.name.toLowerCase() && u.email.toLowerCase() === user.email.toLowerCase();
    });
    if (idx >= 0) users[idx] = Object.assign({}, users[idx], user);
    else users.push(user);
    saveUsers(users);
  }

  function setSession(user) {
    currentUser = user;
    save(KEYS.SESSION, user);
  }

  function clearSession() {
    currentUser = null;
    del(KEYS.SESSION);
  }

  function restoreSession() {
    var session = load(KEYS.SESSION, null);
    if (!session) return false;

    // Admin : jamais de restauration automatique. Mot de passe requis à chaque ouverture.
    if (session.role === "admin") {
      clearSession();
      return false;
    }

    var fresh = findUser(session.name, session.email);
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
      return u.name.toLowerCase() === currentUser.name.toLowerCase() &&
             u.email.toLowerCase() === currentUser.email.toLowerCase();
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
    if (badge) badge.textContent = currentUser.role === "admin" ? "👑 Admin" : "👤 " + currentUser.name;

    var adminBtn = q("#adminPanelBtn");
    if (adminBtn) {
      if (currentUser.role === "admin") adminBtn.classList.remove("hidden");
      else adminBtn.classList.add("hidden");
    }

    updateCounter();
    askNotification();
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

    refreshSavedPasswordButton();
  }

  function refreshSavedPasswordButton() {
    var btn = q("#useSavedPwdBtn");
    var saved = load(KEYS.ADMIN_PWD_HASH, null);
    if (!btn) return;

    if (saved) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  }

  function verifyAdminPassword(input) {
    return sha256(ADMIN_PASSWORD_SAFE()).then(function (adminHash) {
      if (!input) return Promise.resolve(false);
      return sha256(input).then(function (inputHash) {
        return inputHash === adminHash;
      });
    });
  }

  function ADMIN_PASSWORD_SAFE() {
    return CONFIG.adminPassword;
  }

  function loginAdminFromHash(hash) {
    return sha256(ADMIN_PASSWORD_SAFE()).then(function (adminHash) {
      return hash === adminHash;
    });
  }

  /* =========================================================
     EVENTS CONNEXION
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
        sha256(pwd).then(function (h) { save(KEYS.ADMIN_PWD_HASH, h); refreshSavedPasswordButton(); });
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
      // Fallback local si crypto indisponible
      if (pwd === ADMIN_PASSWORD_SAFE()) {
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
    var saved = load(KEYS.ADMIN_PWD_HASH, null);
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
      authMessage("Tous les champs sont requis.", "error");
      return;
    }

    var requests = getRequests();
    var alreadyPending = requests.find(function (r) {
      return r.email.toLowerCase() === email.toLowerCase() && r.status === "pending";
    });

    if (alreadyPending) {
      authMessage("Demande déjà en attente.", "warning");
      return;
    }

    var existing = findUser(name, email);
    if (existing && existing.status === "approved") {
      authMessage("Accès déjà accordé. Utilisez Connexion tiers.", "success");
      return;
    }

    var req = {
      id: uid(),
      name: name,
      email: email,
      reason: reason,
      status: "pending",
      date: new Date().toLocaleString("fr-FR")
    };

    requests.push(req);
    saveRequests(requests);

    askNotification();
    notify("Nouvelle demande d’accès", name + " (" + email + ")");

    if (broadcast) {
      try { broadcast.postMessage({ type: "request", payload: req }); } catch (e) {}
    }

    authMessage("Demande envoyée. En attente de validation admin.", "success");

    if (nameEl) nameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (reasonEl) reasonEl.value = "";
  });

  on("#thirdLoginBtn", "click", function () {
    var nameEl = q("#loginName");
    var emailEl = q("#loginEmail");
    var name = nameEl ? nameEl.value.trim() : "";
    var email = emailEl ? emailEl.value.trim() : "";

    if (!name || !email) {
      authMessage("Nom et email requis.", "error");
      return;
    }

    var user = findUser(name, email);
    if (!user) {
      var req = getRequests().find(function (r) {
        return r.name.toLowerCase() === name.toLowerCase() && r.email.toLowerCase() === email.toLowerCase();
      });
      if (req && req.status === "pending") {
        authMessage("Votre demande est en cours de traitement.", "warning");
        return;
      }
      authMessage("Aucun accès trouvé pour ces identifiants.", "error");
      return;
    }

    if (user.status !== "approved") {
      authMessage("Accès refusé ou révoqué.", "error");
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

  /* =========================================================
     CONTROLE TIERS EN TEMPS REEL LOCAL
     ========================================================= */
  function enforceTierAccess() {
    if (!currentUser || currentUser.role === "admin") return;

    var fresh = findUser(currentUser.name, currentUser.email);
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

  setInterval(enforceTierAccess, 15000);

  window.addEventListener("storage", function (e) {
    if (e.key === KEYS.USERS || e.key === KEYS.REQUESTS) {
      if (currentUser && currentUser.role === "admin") renderAdmin();
      enforceTierAccess();
    }
  });

  if (broadcast) {
    broadcast.onmessage = function (event) {
      try {
        var data = event.data || {};
        if (data.type === "request" && currentUser && currentUser.role === "admin") {
          renderAdmin();
          notify("Demande reçue", data.payload && data.payload.name ? data.payload.name : "Nouvelle demande");
        }
        if (data.type === "access-change") {
          enforceTierAccess();
          if (currentUser && currentUser.role === "admin") renderAdmin();
        }
      } catch (e) {}
    };
  }

  /* =========================================================
     PDF UPLOAD
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

  on("#pdfUpload", "change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      pdfStatus("Format non supporté. PDF uniquement.", "error");
      return;
    }

    if (!window.pdfjsLib) {
      pdfStatus("Bibliothèque PDF.js indisponible. Saisissez le texte manuellement.", "error");
      return;
    }

    pdfStatus("Extraction du texte en cours...", "success");

    readFileAsArrayBuffer(file)
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
        console.error(err);
        pdfStatus("Erreur d’extraction PDF : " + err.message, "error");
      });
  });

  /* =========================================================
     MATCHING TECHNIQUE / JURIDIQUE
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

    if (sev === "critique") {
      laws.push("Vice caché art. 1641 C.civ.");
      laws.push("Défaut de conformité L.217-4 C.consom. si vendeur professionnel.");
      laws.push("Tromperie L.213-1 C.consom. en cas de dissimulation.");
    } else {
      laws.push("Vice caché art. 1641 C.civ. à confirmer par expertise.");
      laws.push("Usure normale à écarter selon kilométrage, entretien et usage.");
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

    if (tags.indexOf("batterie") >= 0 || symptoms.indexOf("thermal runaway") >= 0) {
      laws.push("Risque incendie batterie : sécurité L.423-1, produits défectueux 1245 C.civ.");
    }

    return laws.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" | ");
  }

  function matchDefects(marque, modele, annee, kilometrage, texte) {
    var bq = norm(marque);
    if (!bq) return [];

    var mq = norm(modele);
    var yr = parseYear(annee);
    var km = parseKm(kilometrage);
    var txt = norm(texte);
    var results = [];

    allDefects().forEach(function (d) {
      var db = norm(d.b || "");
      var brandOk = db.indexOf(bq) >= 0 || bq.indexOf(db) >= 0 || db === "toutes marques";
      if (!brandOk) return;

      var yearOk = checkYearRange(d.y, yr);
      if (!yearOk) return;

      var modelOk = true;
      if (mq && d.m && d.m !== "Vehicules 2017-2027") {
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
          modeles: String(d.m || "").split("|"),
          severite: d.sev,
          description: d.n,
          symptomes: found.length ? found : String(d.s || "").split("|").slice(0, 3),
          score: score,
          confiance: confidence,
          alerteUsure: wearAlert,
          baseLegale: legalFor(d),
          rappelRef: d.rec || "À vérifier via VIN auprès constructeur, DGCCRF, rappel.conso, NHTSA, KBA, SafetyGate.",
          wearFactor: d.wf,
          tags: d.tg
        });
      }
    });

    return results.sort(function (a, b) { return b.score - a.score; });
  }

  function researchLinks(brand, model, engine, symptoms) {
    var baseQuery = (brand + " " + model + " " + (engine || "") + " " + (symptoms || []).slice(0, 3).join(" ")).trim();
    var q1 = encodeURIComponent(baseQuery + " défaut panne rappel incendie");
    var q2 = encodeURIComponent(brand + " " + model);

    return [
      { label: "Recherche spécialisée Google / forums techniques", url: "https://www.google.com/search?q=" + q1 },
      { label: "Rappel Conso France (DGCCRF)", url: "https://www.rappel.conso.gouv.fr/recherche/?search=" + q2 },
      { label: "NHTSA Recalls (USA)", url: "https://www.nhtsa.gov/recalls?search=" + q2 },
      { label: "SafetyGate / défauts constructeurs", url: "https://www.google.com/search?q=" + encodeURIComponent(baseQuery + " safetygate TSB rappel défaut") },
      { label: "Rappels allemands KBA", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " KBA Rückruf") },
      { label: "Vérification VIN constructeur", url: "https://www.google.com/search?q=" + encodeURIComponent(brand + " " + model + " VIN recall campaign") }
    ];
  }

  /* =========================================================
     ANALYSE PRINCIPALE
     ========================================================= */
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

    vehicleData = {
      marque: (q("#vehicleBrand") || {}).value || "",
      modele: (q("#vehicleModel") || {}).value || "",
      annee: (q("#vehicleYear") || {}).value || "",
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
      btn.innerHTML = '<span class="spinner"></span> Analyse experte en cours...';
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
          btn.innerHTML = "🔍 Lancer l’analyse croisée technique + juridique";
        }
      }
    }, 700);
  });

  function runAnalysis(text, context, objective, sellerType) {
    var all = (text + " " + context).toLowerCase();

    var flags = {
      professional: sellerType === "professional" || ["professionnel", "garage", "concession", "revendeur", "automobile", "commercial"].some(function (w) { return all.indexOf(w) >= 0; }),
      privateSeller: sellerType === "private" || ["particulier", "entre particuliers", "leboncoin", "lavitrine"].some(function (w) { return all.indexOf(w) >= 0; }),
      defect: ["défaut", "panne", "problème", "dysfonctionnement", "casse", "fuite", "bruit", "vibration", "perte puissance", "à-coup", "claquement", "voyant", "mode dégradé", "surchauffe", "infiltration", "court circuit", "moisiure", "odeur", "fumée", "calage", "patinage", "blocage"].some(function (w) { return all.indexOf(w) >= 0; }),
      waterLeak: ["eau", "humidité", "infiltration", "baie", "pare brise", "pare-brise", "moisiure", "court circuit", "traces d’eau", "flaque", "égouttement"].some(function (w) { return all.indexOf(w) >= 0; }),
      safety: ["sécurité", "frein", "airbag", "direction", "incendie", "danger", "vie", "intégrité physique", "mise en danger", "ADAS", "autopilot"].some(function (w) { return all.indexOf(w) >= 0; }),
      ev: ["batterie", "charge", "autonomie", "electrique", "électrique", "hybride", "BMS", "DC", "AC", "recharge"].some(function (w) { return all.indexOf(w) >= 0; }),
      invoice: all.indexOf("facture") >= 0,
      repair: all.indexOf("réparation") >= 0 || all.indexOf("ordre de réparation") >= 0 || all.indexOf("devis") >= 0,
      controlTech: all.indexOf("contrôle technique") >= 0 || all.indexOf(" ct ") >= 0,
      warranty: all.indexOf("garantie") >= 0,
      highKm: parseKm(vehicleData.kilometrage) > 120000,
      veryHighKm: parseKm(vehicleData.kilometrage) > 180000
    };

    var matches = matchDefects(vehicleData.marque, vehicleData.modele, vehicleData.annee, vehicleData.kilometrage, text);

    analysisData = {
      date: new Date().toLocaleString("fr-FR"),
      vehicleData: vehicleData,
      flags: flags,
      matches: matches,
      sections: []
    };

    var S = [];
    S.push(["I. ÉLÉMENTS FACTUELS ET IDENTIFICATION DU VÉHICULE", secFacts(text, context)]);
    S.push(["II. DIAGNOSTIC TECHNIQUE — DÉFAUTS CONNUS, VÉTUSTÉ, USURE, SÉCURITÉ", secDiag(matches, flags, vehicleData)]);
    S.push(["III. QUALIFICATION JURIDIQUE PROVISOIRE", secQualif(flags, matches)]);
    S.push(["IV. RISQUES ET RESPONSABILITÉS SELON LA QUALITÉ DU VENDEUR", secRisques(flags, matches)]);
    S.push(["V. TROIS CRITÈRES CUMULATIFS : ANTÉRIORITÉ, CARACTÈRE CACHÉ, GRAVITÉ", secCriteres(flags, matches, vehicleData)]);
    S.push(["VI. RÉGIMES DE GARANTIE ET FONDEMENTS JURIDIQUES CROISÉS", secGaranties(flags, matches)]);
    S.push(["VII. DOSSIER PROBATOIRE ET DOCUMENTS À CONSOLIDER", secDocs(flags, matches)]);
    S.push(["VIII. JURISPRUDENCE, TEXTES ET SOURCES DE RÉFÉRENCE", secJuri(matches)]);
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

    html += '<div class="verification-needed"><strong>Rappel méthodologique :</strong> ce rapport effectue d’abord un croisement local technique/juridique avant toute rédaction assistée par IA. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>';

    var result = q("#analysisResult");
    if (result) result.innerHTML = html;

    var section = q("#analysisSection");
    if (section) {
      section.classList.remove("hidden");
      section.scrollIntoView({ behavior: "smooth" });
    }
  }

  /* =========================================================
     SECTIONS
     ========================================================= */
  function secFacts(text, context) {
    var h = "<p><strong>Objet :</strong> recensement des éléments fournis " + addTerm("éléments factuels", "faits allégués") + ".</p>";

    h += "<h4>A. Véhicule déclaré</h4><ul>";
    h += "<li><strong>Marque :</strong> " + esc(vehicleData.marque || "non précisée") + "</li>";
    h += "<li><strong>Modèle :</strong> " + esc(vehicleData.modele || "non précisé") + "</li>";
    h += "<li><strong>Année :</strong> " + esc(vehicleData.annee || "non précisée") + " " + addTerm("millésime", "date de première mise en circulation") + "</li>";
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

    if (!matches.length) {
      var h0 = "<p><strong>Objet :</strong> recherche de défauts conceptuels connus " + addTerm("défauts conceptuels", "problèmes récurrents", "défaut de série") + ".</p>";
      h0 += '<div class="verification-needed">';
      h0 += "<p>Aucune correspondance exacte trouvée dans la base locale pour Marque/Modèle/Année/Symptômes.</p>";
      h0 += "<p>Cela ne signifie pas absence de défaut, mais absence de notoriété suffisante dans les sources consolidées localement.</p>";
      h0 += "<p>Une expertise individuelle est nécessaire " + addTerm("expertise individuelle", "analyse fonctionnelle", "recherche de cause racine") + ".</p>";
      h0 += "</div>";
      return h0;
    }

    var h = "<p><strong>Objet :</strong> croisement technique local avec défauts connus, rappels, TSB, forums spécialisés, DGCCRF, NHTSA, SafetyGate, KBA et bases de sécurité " + addTerm("vice caché notoire", "défaut de série", "défaut de conception") + ".</p>";

    matches.forEach(function (m, i) {
      var cls = m.severite === "critique" ? "rappel-critical" : "rappel-info";
      var confColor = m.confiance === "Haute" ? "#10b981" : (m.confiance === "Moyenne" ? "#f59e0b" : "#ef4444");

      h += '<div class="' + cls + '">';
      h += "<h4>" + (i + 1) + ". " + esc(m.moteur) + " — " + esc(m.puissance) + " — " + esc(m.periode) + "</h4>";
      h += "<p><strong>Constructeur :</strong> " + esc(m.constructeur) + "</p>";
      h += "<p><strong>Modèles concernés :</strong> " + esc(m.modeles.join(", ")) + "</p>";
      h += "<p><strong>Symptômes détectés :</strong> " + esc(m.symptomes.join(", ")) + "</p>";
      h += "<p><strong>Tags système :</strong> " + esc(m.tags || "non précisé") + "</p>";
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

    if (flags.ev) {
      h += '<div class="rappel-info"><h4>🔋 Angle électrique / batterie / charge</h4>';
      h += "<p>Le dossier évoque batterie, charge, autonomie ou système électrique/hybride.</p>";
      h += "<p><strong>Vérifications :</strong> état de santé batterie (SOH), équilibrage cellules, BMS, charge AC/DC, température, logiciel, batterie 12V, DC-DC, isolation HV.</p>";
      h += "<p><strong>Sécurité :</strong> en cas d’odeur, fumée, échauffement, gonflement batterie ou erreur isolement, immobiliser le véhicule et éloigner les personnes.</p>";
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

    return h;
  }

  function secCriteres(flags, matches, vData) {
    var km = parseKm(vData.kilometrage);
    var best = matches[0];

    var h = "<p><strong>Objet :</strong> critères cumulatifs adaptés à l’usure et à la vétusté " + addTerm("critères cumulatifs", "usure normale", "vétusté") + ".</p>";

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

    return h;
  }

  function secDocs(flags, matches) {
    var h = "<p><strong>Objet :</strong> preuve documentaire " + addTerm("preuve documentaire", "dossier probatoire") + ".</p><ul>";
    h += "<li>Facture : " + (flags.invoice ? "présente" : "à récupérer") + "</li>";
    h += "<li>Certificat de cession : à conserver</li>";
    h += "<li>Carte grise : vérifier cohérence kilométrage</li>";
    h += "<li>Contrôle technique : " + (flags.controlTech ? "présent" : "à récupérer") + "</li>";
    h += "<li>Historique entretien / carnet / factures garage</li>";
    h += "<li>Preuve des rappels effectués via VIN</li>";
    h += "<li>Devis réparation (minimum 2)</li>";
    h += "<li>Lecture OBD / codes défaut DTC</li>";
    h += "<li>Photos : moisiure, eau, corrosion, voyants, niveaux, batterie, charge</li>";
    if (matches.length) {
      h += "<li>Vérification VIN sur sites constructeur, DGCCRF, rappel.conso, NHTSA, KBA, SafetyGate</li>";
    }
    h += "</ul>";
    h += '<div class="verification-needed">Sans facture, CT ou historique, la preuve de l’antériorité sera fragilisée ' + addTerm("insuffisance probatoire") + ".</div>";
    return h;
  }

  function secJuri(matches) {
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
    h += "<li>NHTSA / KBA / DGCCRF — rappels sécurité, batteries, ADAS, incendies</li>";
    h += "</ul>";

    if (matches.length) {
      h += "<h4>Références spécifiques aux défauts détectés</h4><ul>";
      matches.forEach(function (m) {
        h += "<li><strong>" + esc(m.moteur) + " :</strong> " + esc(m.rappelRef) + "</li>";
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

    return h;
  }

  function secStrategie(flags, matches, objective) {
    var h = "<p><strong>Objet :</strong> stratégie " + addTerm("stratégie contentieuse", "MARD") + ".</p>";

    h += "<h4>Phase 1 — consolidation probatoire</h4><ol>";
    h += "<li>Expertise amiable contradictoire</li>";
    h += "<li>Devis réparation</li>";
    h += "<li>Lecture OBD</li>";
    h += "<li>Vérification VIN / rappels</li>";
    h += "<li>Photos et constats</li>";
    h += "</ol>";

    h += "<h4>Phase 2 — mise en demeure</h4><ol>";
    h += "<li>LRAR au vendeur</li>";
    if (matches.length) {
      h += "<li>Invoquer le défaut de série documenté " + addTerm("défaut de série", "présomption de connaissance") + "</li>";
    }
    h += "<li>Délai 15 jours</li>";
    h += "<li>Joindre rapport, devis, photos</li>";
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
    if (flags.ev) {
      h += "<li>Contrôler SOH batterie, BMS, charge AC/DC, température, isolation HV, batterie 12V</li>";
    }
    h += "</ul>";

    var links = researchLinks(
      vehicleData.marque,
      vehicleData.modele,
      matches[0] ? matches[0].moteur : "",
      matches[0] ? matches[0].symptomes : []
    );

    h += "<h4>Pistes de recherche externe à ouvrir manuellement</h4><ul>";
    links.forEach(function (l) {
      h += '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + "</a></li>";
    });
    h += "</ul>";

    h += '<div class="verification-needed">Ces liens ne sont pas appelés automatiquement par l’application. Ils servent à confirmer localement la notoriété du défaut avant conclusion finale.</div>';

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
    h += "<li>Expertise judiciaire</li>";
    h += "</ul>";
    return h;
  }

  function secConclu(objective, matches, flags, vData) {
    var high = matches.some(function (m) { return m.confiance === "Haute"; });
    var critical = matches.some(function (m) { return m.severite === "critique"; });

    var h = "<p><strong>Objet :</strong> conclusion prudente " + addTerm("synthèse") + ".</p>";

    h += "<p>";
    if (high && critical) {
      h += "Le croisement local technique/juridique oriente fortement vers un défaut de conception, de montage, de logiciel ou de sécurité, antérieur, caché et grave. La voie du vice caché et/ou de la conformité est sérieusement ouverte.";
    } else if (matches.length) {
      h += "Un défaut connu est probable, mais le kilométrage ou la nature du symptôme impose une expertise pour écarter l’usure normale.";
    } else {
      h += "Aucun défaut de série identifié localement. Le problème peut être individuel : diagnostic et expertise nécessaires.";
    }
    h += "</p>";

    h += "<p><strong>Recommandation opérationnelle :</strong> ne pas effectuer de réparation destructrice avant constat/expertise. Conserver le véhicule en l’état si possible, photographier, obtenir devis, puis mise en demeure LRAR.</p>";

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
    allDefects().forEach(function (d) { brands[d.b] = true; });

    var statEntries = q("#statEntries");
    var statBrands = q("#statBrands");
    var statSync = q("#statSync");

    if (statEntries) statEntries.textContent = allDefects().length;
    if (statBrands) statBrands.textContent = Object.keys(brands).length;

    var last = load(KEYS.LAST_UPDATE, 0);
    if (statSync) statSync.textContent = last ? new Date(last).toLocaleString("fr-FR") : "Jamais";
  }

  function renderRequests() {
    var box = q("#pendingRequests");
    if (!box) return;

    var pending = getRequests().filter(function (r) { return r.status === "pending"; });
    var count = q("#pendingCount");
    if (count) count.textContent = pending.length;

    if (!pending.length) {
      box.innerHTML = '<p class="empty-state">Aucune demande.</p>';
      return;
    }

    box.innerHTML = pending.map(function (r) {
      return '<div class="card pending">' +
        "<strong>" + esc(r.name) + "</strong> <small>" + esc(r.email) + "</small>" +
        "<p>" + esc(r.reason) + "</p>" +
        "<div class=\"actions\">" +
        '<button class="btn-ok" data-action="approve" data-id="' + esc(r.id) + '">Accepter</button>' +
        '<button class="btn-no" data-action="refuse" data-id="' + esc(r.id) + '">Refuser</button>' +
        "</div></div>";
    }).join("");
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
        ? '<button class="btn-warn" data-action="revoke" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '">Révoquer</button>'
        : '<button class="btn-ok" data-action="restore" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '">Rétablir</button>';

      return '<div class="card ' + esc(u.status) + '">' +
        "<strong>" + esc(u.name) + "</strong> <small>" + esc(u.email) + " • " + esc(u.status) + "</small>" +
        '<div class="actions">' + action + "</div>" +
        "</div>";
    }).join("");
  }

  function renderAdmin() {
    renderRequests();
    renderUsers();
    updateAdminStats();
  }

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
      saveRequests(reqs);

      if (action === "approve") {
        upsertUser({
          id: req.id,
          name: req.name,
          email: req.email,
          role: "user",
          status: "approved",
          daily: { date: todayKey(), count: 0 }
        });
        notify("Accès approuvé", req.name);
      }

      if (broadcast) {
        try { broadcast.postMessage({ type: "access-change", payload: { email: req.email, status: req.status } }); } catch (e2) {}
      }

      renderAdmin();
      toast(action === "approve" ? "Demande acceptée." : "Demande refusée.", action === "approve" ? "success" : "warning");
    }

    if (action === "revoke" || action === "restore") {
      var email = btn.dataset.email;
      var name = btn.dataset.name;
      var users = getUsers();
      var user = users.find(function (u) {
        return u.email.toLowerCase() === String(email).toLowerCase() && u.name.toLowerCase() === String(name).toLowerCase();
      });

      if (user) {
        user.status = action === "revoke" ? "revoked" : "approved";
        saveUsers(users);

        if (broadcast) {
          try { broadcast.postMessage({ type: "access-change", payload: { email: user.email, status: user.status } }); } catch (e2) {}
        }

        renderAdmin();
        enforceTierAccess();
        toast(action === "revoke" ? "Accès révoqué." : "Accès rétabli.", action === "revoke" ? "warning" : "success");
      }
    }
  });

  on("#forceUpdateBtn", "click", function () {
    fetchUpdate(true);
  });

  /* =========================================================
     EXPORT / IMPORT / APK / INSTALL
     ========================================================= */
  on("#exportDataBtn", "click", function () {
    var data = {
      exportedAt: new Date().toISOString(),
      users: getUsers(),
      requests: getRequests(),
      defects: techUpdates
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aide-redactionnelle-expert-data.json";
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

          var incoming = Array.isArray(data) ? data : (data.defects || data.updates || []);
          if (Array.isArray(incoming)) {
            techUpdates = mergeDefects(techUpdates, incoming);
            save(KEYS.TECH_UPDATES, techUpdates);
            save(KEYS.LAST_UPDATE, Date.now());
          }

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

  /* =========================================================
     PDF / PARTAGE
     ========================================================= */
  on("#generatePdfBtn", "click", function () {
    if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
      toast("Générez d’abord une analyse.", "warning");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast("Bibliothèque PDF indisponible. Vérifiez la connexion ou rechargez.", "error");
      return;
    }

    try {
      var jsPDF = window.jspdf.jsPDF;
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
    } catch (err) {
      console.error(err);
      toast("Erreur PDF : " + err.message, "error");
    }
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
     SERVICE WORKER
     ========================================================= */
  function registerServiceWorker() {
    try {
      if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js").catch(function (err) {
          console.warn("[AR-EXPERT] SW non enregistré:", err);
        });
      }
    } catch (e) {}
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    try {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
    } catch (e) {}

    techUpdates = load(KEYS.TECH_UPDATES, []);
    updateAdminStats();
    updateDataStatus("Base locale ingénieur chargée");

    checkAutoUpdate(false);
    registerServiceWorker();
    refreshSavedPasswordButton();

    if (restoreSession()) {
      showApp();
    } else {
      showLogin();
    }

    toast("Application prête. Base locale chargée.", "success");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
