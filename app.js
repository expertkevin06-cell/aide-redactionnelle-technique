(function () {
  'use strict';

  /* =========================================================
     HELPERS GLOBAUX SÛRS
     ========================================================= */
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function on(sel, ev, fn) {
    var el = q(sel);
    if (el) el.addEventListener(ev, fn);
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function norm(str) {
    var s = String(str == null ? '' : str).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.trim();
  }
  function parseKm(v) {
    return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;
  }
  function parseYear(v) {
    return parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;
  }
  function stripTags(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  function ensureToast() {
    var t = q('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast hidden';
      document.body.appendChild(t);
    }
    return t;
  }
  function toast(message, type) {
    type = type || 'info';
    var el = ensureToast();
    el.textContent = message;
    el.className = 'toast ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.add('hidden');
    }, 4500);
  }
  function notify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body });
      }
    } catch (e) {}
  }
  function askNotification() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (e) {}
  }
  function sha256(text) {
    if (!window.crypto || !crypto.subtle || typeof TextEncoder === 'undefined') {
      return Promise.resolve('fallback:' + text);
    }
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  /* =========================================================
     DEMARRAGE RESILIENT
     ========================================================= */
  window.addEventListener('error', function (event) {
    console.error('[AR-EXPERT] Erreur globale:', event.message);
    try { toast('Erreur technique interceptée: ' + event.message, 'error'); } catch (e) {}
  });

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[AR-EXPERT] Promesse rejetée:', event.reason);
    try { toast('Action interrompue: ' + (event.reason && event.reason.message ? event.reason.message : 'erreur'), 'error'); } catch (e) {}
    if (event.preventDefault) event.preventDefault();
  });

  function boot() {
    try {
      init();
    } catch (e) {
      console.error('[AR-EXPERT] Boot failed:', e);
      try { toast('Initialisation impossible: ' + e.message, 'error'); } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* =========================================================
     APPLICATION PRINCIPALE
     ========================================================= */
  function init() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    var ADMIN_PASSWORD = 'Kevin83600';
    var MAX_DAILY_ANALYSES = 10;

    var SK = {
      SESSION: 'arex_session_v10',
      USERS: 'arex_users_v10',
      REQUESTS: 'arex_requests_v10',
      PWD_MEM: 'arex_pwd_mem_v10',
      CUSTOM_DEFECTS: 'arex_custom_defects_v10'
    };

    var currentUser = null;
    var vehicleData = {};
    var analysisData = {};
    var extractedText = '';
    var termesMobilises = new Set();
    var deferredPrompt = null;

    /* =====================================================
       BASE TECHNIQUE LOCALE MASSIVE
       Sources consolidées localement : DGCCRF / rappel.conso,
       NHTSA, SafetyGate, TSB constructeurs, forums spécialisés,
       jurisprudences et retours experts.
       ===================================================== */
    var BASE_DEFECTS = [
      {
        b: "Renault",
        mods: "Clio IV|Captur|Megane III|Kadjar|Talisman",
        yrs: "2012-2020",
        eng: "H5F / 1.2 TCe",
        p: "120ch / 130ch",
        sym: "consommation huile|casse moteur|segmentation|fumée bleue|perte compression|huile manquante|niveau huile|surchauffe",
        sev: "critique",
        wf: 0.8,
        n: "Défaut de conception piston/cylindre, segments et jupes de piston. Surconsommation d'huile progressive pouvant entraîner la casse.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.; tromperie L.213-1 si dissimulation.",
        recall: "Programme qualité Renault 1.2 TCe 2016-2019."
      },
      {
        b: "Renault",
        mods: "Clio|Megane|Scenic|Duster|Sandero|Logan|Trafic II|Master III|Kangoo II",
        yrs: "2009-2018",
        eng: "K9K / 1.5 dCi",
        p: "75ch / 90ch / 110ch",
        sym: "casse bielle|claquement moteur|usure coussinets|pompe à huile|bruit métallique froid|pression huile basse|voyant huile|calage moteur",
        sev: "critique",
        wf: 0.9,
        n: "Risque de casse bielle brutale lié à la lubrification et à la pompe à huile. Problème chronique documenté.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.; responsabilité contractuelle 1231-1 C.civ.",
        recall: "TSB / programme technique Renault K9K 2014-2017."
      },
      {
        b: "Renault",
        mods: "Clio IV|Captur|Megane III|Kadjar",
        yrs: "2012-2018",
        eng: "EDC6 / double embrayage",
        p: "N/A boîte",
        sym: "à-coups boîte|blocage rapport|perte traction|voyant boîte|odeur brûlé embrayage|vibrations démarrage|patinage|mode dégradé boîte",
        sev: "critique",
        wf: 0.7,
        n: "Module mécatronique fragile, surchauffe de l'embrayage sec en usage urbain. Réparation coûteuse.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "Programme qualité EDC Renault 2015-2018."
      },
      {
        b: "Renault",
        mods: "Trafic II|Master III|Espace V|Talisman",
        yrs: "2014-2023",
        eng: "Baie de pare-brise / étanchéité",
        p: "N/A carrosserie/électricité",
        sym: "infiltration eau|court circuit|moisiure|panne électronique|voyants aléatoires|erreur ABS|erreur ESP|clignotants fantômes|vitres bloquées|GPS HS|écran tactile HS|odeur humidité|traces eau|eau dans compartiment moteur",
        sev: "critique",
        wf: 0.95,
        n: "Défaut de montage/étanchéité de la baie de pare-brise. L'eau atteint boîtiers fusibles, calculateurs et faisceaux. Indépendant du kilométrage.",
        law: "Vice caché art. 1641 C.civ.; défaut de sécurité L.423-1 C.consom.; tromperie L.213-1 si professionnel.",
        recall: "Campagnes techniques Renault baie pare-brise Trafic II / Master III."
      },
      {
        b: "Renault",
        mods: "Megane IV|Talisman|Espace V|Koleos II",
        yrs: "2015-2020",
        eng: "R-Link 2 / multimédia",
        p: "N/A électronique",
        sym: "écran noir|gel système|bug GPS|redémarrages aléatoires|tactile HS|caméra recul HS|bluetooth HS",
        sev: "moyen",
        wf: 0.4,
        n: "Défaillance électronique multimédia. Impact confort et sécurité de navigation/caméra.",
        law: "Défaut de conformité L.217-4 C.consom.; vice caché art. 1641 C.civ.",
        recall: "Mises à jour logicielles R-Link 2."
      },
      {
        b: "Peugeot",
        mods: "208|2008|308|3008|5008|Partner|Rifter|Boxer|Expert",
        yrs: "2012-2024",
        eng: "EB2 / 1.2 PureTech",
        p: "110ch / 130ch / 155ch",
        sym: "courroie distribution dans l'huile|colmatage crépine pompe|casse moteur|bruit cliquetis froid|voyant pression huile|désagrégation courroie|consommation huile|fumée|surchauffe|mode dégradé moteur|calage",
        sev: "critique",
        wf: 0.85,
        n: "Courroie humide (wet belt) qui se désagrège, bouche la crépine de pompe à huile et peut casser le moteur.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.; pratique commerciale trompeuse L.121-2 C.consom.",
        recall: "Extension de garantie Stellantis PureTech, TSB constructeur."
      },
      {
        b: "Peugeot",
        mods: "308|3008|508|Boxer|Expert|Partner",
        yrs: "2009-2018",
        eng: "DV6 / 1.6 HDi / BlueHDi",
        p: "92ch / 115ch / 120ch",
        sym: "encrassement EGR|colmatage FAP|turbo HS|surconsommation huile|puissance réduite|mode dégradé|voyant anti-pollution|fumée noire|démarrage impossible",
        sev: "moyen",
        wf: 0.5,
        n: "Encrassement des organes de dépollution en usage urbain. Entretien coûteux.",
        law: "Vice caché art. 1641 C.civ.; usure normale à écarter par expertise.",
        recall: "TSB nombreux, pas de rappel majeur unifié."
      },
      {
        b: "Peugeot",
        mods: "308|508|3008|RCZ|C4 Picasso",
        yrs: "2010-2017",
        eng: "EAT6 / Aisin",
        p: "N/A boîte auto",
        sym: "à-coups démarrage|vibrations ralenti|passage rapports saccadé|convertisseur couple|bruit claquement|patinage|mode dégradé boîte",
        sev: "critique",
        wf: 0.6,
        n: "Défaut de convertisseur de couple hydraulique. Réparation coûteuse.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "Programme qualité PSA EAT6."
      },
      {
        b: "Peugeot",
        mods: "308|3008|508|208 GT|3008 GT",
        yrs: "2014-2022",
        eng: "AdBlue / SCR",
        p: "N/A dépollution",
        sym: "cristallisation injecteur|pompe AdBlue HS|impossibilité redémarrer|voyant anti-pollution|réservoir vide faux|compteur bloqué|mode dégradé sévère",
        sev: "moyen",
        wf: 0.4,
        n: "Système SCR sensible aux trajets courts et à la qualité de l'AdBlue.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "TSB Stellantis AdBlue."
      },
      {
        b: "Citroën",
        mods: "C3|C3 Aircross|C4|C4 Cactus|C4 Picasso|Grand C4 Picasso|C5 Aircross|Jumper|Berlingo",
        yrs: "2012-2024",
        eng: "EB2 / 1.2 PureTech",
        p: "110ch / 130ch",
        sym: "courroie distribution|casse moteur|fumée|bruit métallique|huile dans eau|voyant pression huile|surchauffe",
        sev: "critique",
        wf: 0.85,
        n: "Même défaut wet belt que PSA/Stellantis. Danger mécanique majeur.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.",
        recall: "Extension garantie Stellantis 10 ans sur certains marchés."
      },
      {
        b: "Citroën",
        mods: "C3|C4|Berlingo|Jumpy|C4 Picasso",
        yrs: "2009-2016",
        eng: "DV6 / 1.6 HDi",
        p: "92ch / 115ch",
        sym: "EGR encrassé|FAP colmaté|turbo bruit|surchauffe légère|puissance réduite",
        sev: "moyen",
        wf: 0.5,
        n: "Maintenance lourde requise. Usure prématurée des organes de dépollution.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Citroën",
        mods: "C4 Picasso|Grand C4 Picasso|C5 Aircross|C3 Aircross",
        yrs: "2014-2022",
        eng: "EAT6 / EAT8",
        p: "N/A boîte auto",
        sym: "à-coups|perte propulsion|voyant boîte|blocage vitesse|patinage",
        sev: "critique",
        wf: 0.6,
        n: "Boîte automatique dont la fiabilité est contestée sur certains millésimes.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "Programme qualité Stellantis."
      },
      {
        b: "Volkswagen",
        mods: "Golf VI|Golf VII|Passat B7|Passat B8|Tiguan I|Tiguan II|Polo|Touran|Sharan|Caddy",
        yrs: "2009-2015",
        eng: "EA189 / TDI Dieselgate",
        p: "105ch / 140ch / 170ch",
        sym: "logiciel invalidation|émission NOx élevée|amende administrative|retour concession obligatoire|performances réduites après maj|voyant moteur|mode dégradé",
        sev: "critique",
        wf: 1.0,
        n: "Tricherie aux tests polluants par logiciel defeat device. Preuve judiciaire solide.",
        law: "Tromperie L.213-1 C.consom.; défaut de conformité L.217-4 C.consom.; nullité pour dol 1137 C.civ.; produits défectueux 1245 C.civ.",
        recall: "Rappel mondial VW EA189; CJUE; Cass. civ. 1ère."
      },
      {
        b: "Volkswagen",
        mods: "Golf|Polo|Touran|Scirocco|Up!|Caddy|Tiguan I",
        yrs: "2008-2016",
        eng: "DQ200 / DSG7",
        p: "N/A double embrayage",
        sym: "mécatronique HS|embrayage patine|à-coups violents|bruit claquement boîte|vitesse bloquée|odeur brûlé|mode dégradé|impossible démarrer",
        sev: "critique",
        wf: 0.7,
        n: "Double embrayage à sec fragile, module mécatronique défaillant. Défaut reconnu mondialement.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.; tromperie L.213-1 C.consom.",
        recall: "Rappel / TSB VW DSG7."
      },
      {
        b: "Volkswagen",
        mods: "Golf VII|Passat B8|Tiguan II|Sharan|Touran",
        yrs: "2012-2018",
        eng: "EA288 / 2.0 TDI",
        p: "150ch / 184ch",
        sym: "consommation huile|injecteurs piezo|vanne EGR bloquée|bruit injection|fumée bleue",
        sev: "moyen",
        wf: 0.5,
        n: "Entretien coûteux, injecteurs piézo sensibles.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Audi",
        mods: "A3|A4|A6|Q5|TT|Q3",
        yrs: "2009-2015",
        eng: "EA189 / TDI",
        p: "120ch / 140ch / 170ch",
        sym: "dieselgate|logiciel|NOx|retour usine|voyant moteur",
        sev: "critique",
        wf: 1.0,
        n: "Groupe VAG, même problème que Volkswagen.",
        law: "Tromperie L.213-1 C.consom.; nullité pour dol 1137 C.civ.",
        recall: "Rappel mondial VAG EA189."
      },
      {
        b: "Audi",
        mods: "A3|A4 Avant|Q3|TT",
        yrs: "2008-2016",
        eng: "DQ200 / S-Tronic",
        p: "N/A boîte",
        sym: "mécatronique|patinage|bruits boîte|à-coups|mode dégradé",
        sev: "critique",
        wf: 0.7,
        n: "Idem VW Golf, fragilité extrême du double embrayage à sec.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "Rappel Audi/VW DSG7."
      },
      {
        b: "Audi",
        mods: "A4|A5|A6|Q5|A3",
        yrs: "2012-2018",
        eng: "EA888 Gen3 / TFSI",
        p: "190ch / 245ch / 272ch",
        sym: "consommation huile excessive|segments pistons|casse moteur rare|fumée bleue|bruit moteur",
        sev: "moyen",
        wf: 0.6,
        n: "Surveillance niveau huile indispensable. Risque long terme.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "TSB Audi EA888."
      },
      {
        b: "BMW",
        mods: "Serie 1|Serie 3|Serie 5|X1|X3|Mini Cooper SD",
        yrs: "2007-2015",
        eng: "N47 / 2.0d",
        p: "163ch / 184ch / 204ch",
        sym: "chaîne distribution côté boîte|bruit crécelle froid|casse chaîne|sauts de dents|calage moteur|voyant moteur|bruit métallique démarrage",
        sev: "critique",
        wf: 0.8,
        n: "Chaîne côté boîte, tensionneur fragile. Casse chaîne destructrice. Réparation très coûteuse.",
        law: "Vice caché art. 1641 C.civ.; défaut de sécurité; tromperie si professionnel.",
        recall: "Rappel BMW N47 chaîne distribution."
      },
      {
        b: "BMW",
        mods: "Serie 1|Serie 3|X1|X3",
        yrs: "2015-2022",
        eng: "B47 / 2.0d",
        p: "150ch / 190ch",
        sym: "tensionneur chaîne|bruit mécanique|vibration ralenti",
        sev: "moyen",
        wf: 0.6,
        n: "Amélioré mais toujours sensible. Surveillance nécessaire.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "TSB BMW B47."
      },
      {
        b: "BMW",
        mods: "Serie 3|Serie 5|X3|X5",
        yrs: "2010-2018",
        eng: "EGR / admission / risque incendie",
        p: "N/A sécurité",
        sym: "risque incendie collecteur|fuite liquide refroidissement sur EGR|odeur plastique brûlé|fumée sous capot|voyant température",
        sev: "critique",
        wf: 0.9,
        n: "Rappel sécurité majeur. Risque d'incendie par fuite de liquide sur collecteur EGR.",
        law: "Défaut de sécurité L.423-1 C.consom.; mise en danger 223-1 C.pénal; homicide/blessures involontaires si accident.",
        recall: "Rappel BMW EGR/incendie; DGCCRF."
      },
      {
        b: "Mercedes-Benz",
        mods: "Classe A|Classe B|CLA|GLA|Classe C|Classe E",
        yrs: "2009-2018",
        eng: "OM651 / 2.1 CDI",
        p: "136ch / 170ch / 204ch",
        sym: "injecteurs piézo HS|casse moteur|consommation huile|bruit injection fort|ratés allumage|voyant moteur|mode dégradé",
        sev: "critique",
        wf: 0.7,
        n: "Injecteurs piézo sensibles à la qualité du gasoil. Remplacement très coûteux.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "TSB Mercedes OM651."
      },
      {
        b: "Mercedes-Benz",
        mods: "Classe C|Classe E|GLK|ML|CLS",
        yrs: "2009-2016",
        eng: "7G-Tronic Plus",
        p: "N/A boîte auto",
        sym: "à-coups|perte propulsion|convertisseur|calculateur boîte|bloque P|mode dégradé|voyant boîte",
        sev: "critique",
        wf: 0.5,
        n: "Boîte fiable seulement si entretien rigoureux (vidange boîte régulière).",
        law: "Vice caché art. 1641 C.civ.; usure normale si entretien négligé.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Ford",
        mods: "Focus Mk3|Fiesta Mk7|B-Max|Kuga|Mondeo",
        yrs: "2011-2016",
        eng: "DPS6 / PowerShift",
        p: "N/A double embrayage",
        sym: "vibrations moteur|à-coups boîte|patinage embrayage|bruit métal|odeur brûlé|cliquetis|mode dégradé|impossible rouler",
        sev: "critique",
        wf: 0.8,
        n: "Boîte double embrayage à sec défaillante mondialement. Class actions massives.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.; défaut de conformité L.217-4 C.consom.",
        recall: "Class action USA DPS6; extension garantie Ford Europe."
      },
      {
        b: "Ford",
        mods: "Focus|Fiesta|Kuga|Mondeo|C-Max|B-Max|Puma",
        yrs: "2012-2020",
        eng: "Ecoboost 1.0L",
        p: "100ch / 125ch / 140ch",
        sym: "joint culasse fissuré|refroidissement insuffisant|surchauffe|eau dans huile|fumée blanche|voyant température|casse moteur",
        sev: "critique",
        wf: 0.9,
        n: "Bloc aluminium sensible thermiquement. Pompe à eau immergée et joint de culasse fragiles.",
        law: "Vice caché art. 1641 C.civ.; défaut de conception; tromperie si professionnel.",
        recall: "TSB Ford Ecoboost 1.0; modification pompe à eau 2019."
      },
      {
        b: "Toyota",
        mods: "Yaris|Auris|Avensis|RAV4|C-HR|Corolla|Prius",
        yrs: "2009-2020",
        eng: "Takata Airbags",
        p: "N/A sécurité passive",
        sym: "airbag gonflable|projection métal|rappel sécurité vital|voyant airbag|airbag ne se déclenche pas",
        sev: "critique",
        wf: 1.0,
        n: "Danger mortel immédiat. Gonflateur Takata pouvant projeter des éclats métalliques.",
        law: "Défaut de sécurité L.423-1 C.consom.; homicide involontaire 221-6 C.pénal; blessures involontaires 222-19 C.pénal.",
        recall: "Rappel mondial Takata; DGCCRF; NHTSA."
      },
      {
        b: "Toyota",
        mods: "Yaris|Corolla|Camry|Prius|RAV4",
        yrs: "2009-2011",
        eng: "Throttle Pedal",
        p: "N/A sécurité active",
        sym: "pédale coince|accélération involontaire|difficulté retour pédale|voyant moteur",
        sev: "critique",
        wf: 1.0,
        n: "Pédale d'accélérateur pouvant se coincer en position ouverte. Danger immédiat.",
        law: "Défaut de sécurité L.423-1 C.consom.; mise en danger 223-1 C.pénal.",
        recall: "Rappel Toyota pédale; NHTSA."
      },
      {
        b: "Fiat",
        mods: "500|Panda|Punto|Bravo|Freemont|Doblo",
        yrs: "2010-2017",
        eng: "Dualogic / robotisé",
        p: "N/A boîte robotisée",
        sym: "robot boîte HS|pas de vitesse|cliquetis actuateur|bloqué en neutre|erreur embrayage|impossible rouler|voyant boîte",
        sev: "critique",
        wf: 0.8,
        n: "Embrayage piloté très fragile. Actuateur défaillant. Panne sèche fréquente.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "TSB Fiat Dualogic."
      },
      {
        b: "Fiat",
        mods: "Punto|Bravo|Doblo|500L|Panda|Qubo",
        yrs: "2009-2016",
        eng: "MultiJet 1.3",
        p: "75ch / 95ch",
        sym: "chaîne distribution|turbo bruit|consommation huile|claquement|voyant moteur",
        sev: "moyen",
        wf: 0.6,
        n: "Petit diesel nerveux mais fragile mécaniquement.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Nissan",
        mods: "Qashqai J11|X-Trail T32|Juke|Note|Navara",
        yrs: "2012-2018",
        eng: "K9M / 1.5 dCi",
        p: "90ch / 110ch",
        sym: "casse bielle|coussinets|pompe huile|bruit métallique|claquement moteur|voyant huile",
        sev: "critique",
        wf: 0.9,
        n: "Partenariat Renault-Nissan. Mêmes défauts que K9K.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.",
        recall: "Programme technique Nissan/Renault K9K."
      },
      {
        b: "Nissan",
        mods: "Qashqai|X-Trail|Micra|Leaf|Juke",
        yrs: "2014-2022",
        eng: "CVT X-Tronic",
        p: "N/A variateur",
        sym: "à-coups|glissement courroie|bruit whining|surchauffe boîte|perte puissance progressive|voyant boîte|mode dégradé",
        sev: "critique",
        wf: 0.6,
        n: "Variateur continu sensible au couple élevé et à l'usage sportif.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "TSB Nissan CVT."
      },
      {
        b: "Opel",
        mods: "Corsa D|Corsa E|Astra J|Astra K|Mokka|Insignia",
        yrs: "2012-2018",
        eng: "Z14NET / 1.4 Turbo",
        p: "120ch / 140ch",
        sym: "consommation huile|segments pistons|casse moteur|turbo fuite|fumée|voyant moteur",
        sev: "critique",
        wf: 0.8,
        n: "Moteur essence petit cylindré turbocompressé fragile.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "TSB Opel Z14NET."
      },
      {
        b: "Opel",
        mods: "Astra H|Astra J|Zafira B|Zafira C|Vectra C|Insignia",
        yrs: "2009-2016",
        eng: "Cooling System / risque incendie",
        p: "N/A sécurité",
        sym: "fuite radiateur chauffage|surchauffe|risque incendie|liquide blanc fumée|odeur brûlé|voyant température",
        sev: "critique",
        wf: 0.9,
        n: "Défaut de conception du circuit de refroidissement habitacle. Risque d'incendie.",
        law: "Défaut de sécurité L.423-1 C.consom.; mise en danger 223-1 C.pénal.",
        recall: "Rappel GM/Opel Zafira B incendie."
      },
      {
        b: "Hyundai",
        mods: "i30|Tucson|ix35|Santa Fe|Elantra|i40",
        yrs: "2011-2017",
        eng: "D4FD / 1.7 CRDi",
        p: "115ch / 136ch",
        sym: "injecteurs|consommation huile|bruit injection|ratés|voyant moteur",
        sev: "moyen",
        wf: 0.5,
        n: "Diesel moderne complexe, sensible à la qualité carburant.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Hyundai",
        mods: "i20|i30|Tucson|Kona|Santa Fe",
        yrs: "2015-2022",
        eng: "DCT 7 Speed",
        p: "N/A boîte",
        sym: "à-coups|patinage basse vitesse|bruit boîte|vibrations|mode dégradé",
        sev: "moyen",
        wf: 0.4,
        n: "Double embrayage à sec, comportement urbain médiocre.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "TSB Hyundai DCT."
      },
      {
        b: "Kia",
        mods: "Ceed|Sportage|Niro|Picanto|Rio|Stinger",
        yrs: "2011-2017",
        eng: "D4FD / 1.7 CRDi",
        p: "115ch / 136ch",
        sym: "injecteurs|huile|bruit|ratés|voyant moteur",
        sev: "moyen",
        wf: 0.5,
        n: "Plateforme commune Hyundai.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "Aucun rappel majeur."
      },
      {
        b: "Kia",
        mods: "Ceed|Sportage|Picanto|Rio|Sorento",
        yrs: "2012-2020",
        eng: "Catalytic Converter / risque incendie",
        p: "N/A sécurité",
        sym: "risque incendie sous caisse|température excessive catalyseur|odeur brûlée|fumée noire|voyant moteur",
        sev: "critique",
        wf: 0.9,
        n: "Catalyseur pouvant atteindre des températures excessives et provoquer un incendie.",
        law: "Défaut de sécurité L.423-1 C.consom.; mise en danger 223-1 C.pénal.",
        recall: "Rappel Kia catalyseur; DGCCRF."
      },
      {
        b: "Volvo",
        mods: "V40|V60|XC60|S60|XC90|S90|V90|XC40",
        yrs: "2012-2022",
        eng: "Drive-E D3/D4/T3/T4/T5/T6",
        p: "150ch à 320ch",
        sym: "consommation huile|segments|casse moteur|turbo|fumée|voyant moteur|surchauffe",
        sev: "critique",
        wf: 0.8,
        n: "Essence suralimenté injection directe, problème de segments sur premières générations.",
        law: "Vice caché art. 1641 C.civ.; défaut de conformité L.217-4 C.consom.",
        recall: "Extension garantie Volvo Drive-E."
      },
      {
        b: "SEAT",
        mods: "Ibiza|Leon|Altea|Toledo|Ateca",
        yrs: "2009-2015",
        eng: "EA189 TDI",
        p: "105ch / 140ch",
        sym: "dieselgate|logiciel|NOx",
        sev: "critique",
        wf: 1.0,
        n: "Groupe VAG.",
        law: "Tromperie L.213-1 C.consom.",
        recall: "Rappel mondial VAG."
      },
      {
        b: "SEAT",
        mods: "Leon|Ateca|Toledo|Ibiza|Arona",
        yrs: "2012-2020",
        eng: "DSG7 DQ200",
        p: "N/A boîte",
        sym: "mécatronique|à-coups|patinage|bruit boîte",
        sev: "critique",
        wf: 0.7,
        n: "Groupe VAG, idem Audi/VW.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "Rappel VAG DSG7."
      },
      {
        b: "Škoda",
        mods: "Octavia|Superb|Yeti|Fabia|Rapid",
        yrs: "2009-2015",
        eng: "EA189 TDI",
        p: "105ch / 140ch",
        sym: "dieselgate",
        sev: "critique",
        wf: 1.0,
        n: "Groupe VAG.",
        law: "Tromperie L.213-1 C.consom.",
        recall: "Rappel mondial VAG."
      },
      {
        b: "Škoda",
        mods: "Octavia|Superb|Fabia|Rapid|Kodiaq|Karoq",
        yrs: "2010-2018",
        eng: "TSI EA111/EA888",
        p: "125ch / 180ch",
        sym: "consommation huile|chaîne distribution|carbonisation soupapes|bruit|voyant moteur",
        sev: "moyen",
        wf: 0.6,
        n: "Injection directe essence, chaîne EA111 fragile.",
        law: "Vice caché art. 1641 C.civ.; usure normale possible.",
        recall: "TSB Škoda/VAG TSI."
      },
      {
        b: "Jeep",
        mods: "Renegade|Compass|Cherokee|Wrangler",
        yrs: "2014-2022",
        eng: "DDCT Dry",
        p: "N/A boîte",
        sym: "surchauffe embrayage|à-coups|bruit boîte|mode limp|odeur brûlée|impossible rouler",
        sev: "critique",
        wf: 0.7,
        n: "Double embrayage à sec peu adapté à la ville dense et au tout-terrain.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "TSB FCA/Stellantis DDCT."
      },
      {
        b: "Jeep",
        mods: "Renegade|Compass|Wrangler",
        yrs: "2015-2022",
        eng: "Multijet 1.6 / 2.0",
        p: "120ch / 140ch / 170ch",
        sym: "injecteurs|turbo|huile|voyant moteur",
        sev: "moyen",
        wf: 0.5,
        n: "Base Fiat/Stellantis.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "TSB Stellantis Multijet."
      },
      {
        b: "Dacia",
        mods: "Duster|Sandero|Logan|Lodgy|Spring|Jogger",
        yrs: "2012-2022",
        eng: "K9K 1.5 dCi",
        p: "90ch / 110ch",
        sym: "casse bielle|coussinets|pompe huile|bruit|claquement|voyant huile",
        sev: "critique",
        wf: 0.9,
        n: "Base Renault K9K. Mêmes risques de casse brutale.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "Programme technique Renault/Dacia K9K."
      },
      {
        b: "Dacia",
        mods: "Duster|Sandero Stepway|Logan|Jogger",
        yrs: "2013-2022",
        eng: "EDC6",
        p: "N/A boîte",
        sym: "à-coups|blocage|patinage|voyant boîte",
        sev: "moyen",
        wf: 0.6,
        n: "Base Renault EDC.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "Programme qualité Renault/Dacia EDC."
      },
      {
        b: "MINI",
        mods: "Cooper S|Countryman|Clubman|Paceman",
        yrs: "2010-2018",
        eng: "Prince N18/N20",
        p: "184ch / 211ch / 231ch",
        sym: "chaîne distribution|consommation huile|segments|turbo|water pump|bruit crécelle|casse moteur|surchauffe|voyant moteur",
        sev: "critique",
        wf: 0.8,
        n: "Conception BMW/PSA conjointe très problématique.",
        law: "Vice caché art. 1641 C.civ.; tromperie L.213-1 C.consom.",
        recall: "Rappel Mini/BMW Prince."
      },
      {
        b: "MINI",
        mods: "Cooper|Clubman|Countryman",
        yrs: "2014-2022",
        eng: "Getrag DCT / Aisin",
        p: "N/A boîte",
        sym: "à-coups|bruit boîte|patinage|mode dégradé",
        sev: "moyen",
        wf: 0.5,
        n: "Boîte robotisée double embrayage.",
        law: "Vice caché art. 1641 C.civ.",
        recall: "TSB Mini/BMW DCT."
      }
    ];

    var customDefects = load(SK.CUSTOM_DEFECTS, []);
    var defectList = BASE_DEFECTS.concat(customDefects);

    /* =====================================================
       AUTH / USERS / REQUESTS
       ===================================================== */
    function getUsers() { return load(SK.USERS, []); }
    function saveUsers(users) { save(SK.USERS, users); }
    function getRequests() { return load(SK.REQUESTS, []); }
    function saveRequests(requests) { save(SK.REQUESTS, requests); }

    function findUser(name, email) {
      var n = String(name || '').trim().toLowerCase();
      var e = String(email || '').trim().toLowerCase();
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
      save(SK.SESSION, user);
    }

    function clearSession() {
      currentUser = null;
      del(SK.SESSION);
    }

    function restoreSession() {
      var session = load(SK.SESSION, null);
      if (!session) return false;

      // Admin : mot de passe requis à chaque ouverture de l'APK.
      if (session.role === 'admin') {
        clearSession();
        return false;
      }

      var fresh = findUser(session.name, session.email);
      if (fresh && fresh.status === 'approved') {
        currentUser = fresh;
        setSession(fresh);
        return true;
      }

      clearSession();
      return false;
    }

    function dailyInfo() {
      if (!currentUser) return { allowed: false, remaining: 0, unlimited: false };
      if (currentUser.role === 'admin') return { allowed: true, remaining: Infinity, unlimited: true };

      var user = findUser(currentUser.name, currentUser.email) || currentUser;
      var daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;

      return {
        allowed: daily < MAX_DAILY_ANALYSES,
        remaining: Math.max(0, MAX_DAILY_ANALYSES - daily),
        unlimited: false
      };
    }

    function incrementDaily() {
      if (!currentUser || currentUser.role === 'admin') return;

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
      var el = q('#dailyCounter');
      if (!el) return;
      var info = dailyInfo();
      el.textContent = info.unlimited
        ? '👑 Admin — analyses illimitées'
        : '📊 ' + info.remaining + '/' + MAX_DAILY_ANALYSES + ' analyses restantes';
    }

    function authMessage(msg, type) {
      var el = q('#authMsg');
      if (el) {
        el.textContent = msg;
        el.className = 'auth-msg ' + type;
      } else {
        toast(msg, type);
      }
    }

    function showApp() {
      var login = q('#loginScreen');
      if (login) {
        login.classList.add('hidden');
        login.style.display = 'none';
      }

      var app = q('#mainApp');
      if (app) {
        app.classList.remove('hidden');
        app.style.display = 'block';
      }

      var badge = q('#userBadge');
      if (badge) badge.textContent = currentUser.role === 'admin' ? '👑 Admin' : '👤 ' + currentUser.name;

      var adminBtn = q('#adminPanelBtn');
      if (adminBtn) {
        if (currentUser.role === 'admin') adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
      }

      updateCounter();
      askNotification();
      window.scrollTo(0, 0);
    }

    function showLogin() {
      var login = q('#loginScreen');
      if (login) {
        login.classList.remove('hidden');
        login.style.display = 'flex';
      }

      var app = q('#mainApp');
      if (app) {
        app.classList.add('hidden');
        app.style.display = 'none';
      }

      var admin = q('#adminPanel');
      if (admin) admin.classList.add('hidden');
    }

    function verifyAdmin(input) {
      var stored = load(SK.PWD_MEM, null);

      if (!input && stored) {
        return sha256(ADMIN_PASSWORD).then(function (adminHash) {
          return adminHash && stored === adminHash;
        });
      }

      return sha256(input || '').then(function (inputHash) {
        return sha256(ADMIN_PASSWORD).then(function (adminHash) {
          return inputHash === adminHash;
        });
      });
    }

    /* =====================================================
       EVENTS CONNEXION
       ===================================================== */
    qa('.auth-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        qa('.auth-tab').forEach(function (b) { b.classList.remove('active'); });
        qa('.auth-pane').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var pane = q('#' + btn.dataset.authTab + 'Pane');
        if (pane) pane.classList.add('active');
        authMessage('', '');
      });
    });

    on('#adminLoginBtn', 'click', function () {
      var pwdEl = q('#adminPassword');
      var rememberEl = q('#rememberMe');
      var pwd = pwdEl ? pwdEl.value : '';
      var remember = rememberEl ? rememberEl.checked : false;

      if (!pwd && !load(SK.PWD_MEM, null)) {
        authMessage('Mot de passe requis.', 'error');
        return;
      }

      verifyAdmin(pwd).then(function (ok) {
        if (!ok) {
          authMessage('Mot de passe incorrect.', 'error');
          return;
        }

        if (pwd && remember && window.crypto && crypto.subtle) {
          sha256(pwd).then(function (hash) { save(SK.PWD_MEM, hash); });
        } else if (!remember) {
          del(SK.PWD_MEM);
        }

        setSession({
          id: 'admin',
          name: 'Administrateur',
          email: 'admin@local',
          role: 'admin',
          status: 'approved'
        });

        showApp();
        toast('Connexion admin réussie.', 'success');
      }).catch(function (err) {
        console.error(err);
        // fallback sécurisé simple si crypto indisponible
        if (pwd === ADMIN_PASSWORD) {
          setSession({ id: 'admin', name: 'Administrateur', email: 'admin@local', role: 'admin', status: 'approved' });
          showApp();
          toast('Connexion admin réussie (mode local).', 'success');
        } else {
          authMessage('Vérification impossible. Ressaisissez le mot de passe.', 'error');
        }
      });
    });

    on('#requestBtn', 'click', function () {
      var nameEl = q('#reqName');
      var emailEl = q('#reqEmail');
      var reasonEl = q('#reqReason');

      var name = nameEl ? nameEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      var reason = reasonEl ? reasonEl.value.trim() : '';

      if (!name || !email || !reason) {
        authMessage('Tous les champs sont requis.', 'error');
        return;
      }

      var requests = getRequests();
      var alreadyPending = requests.find(function (r) {
        return r.email.toLowerCase() === email.toLowerCase() && r.status === 'pending';
      });
      if (alreadyPending) {
        authMessage('Demande déjà en attente.', 'warning');
        return;
      }

      var existing = findUser(name, email);
      if (existing && existing.status === 'approved') {
        authMessage('Accès déjà accordé. Utilisez Connexion tiers.', 'success');
        return;
      }

      requests.push({
        id: uid(),
        name: name,
        email: email,
        reason: reason,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR')
      });

      saveRequests(requests);
      askNotification();
      notify('Nouvelle demande d’accès', name + ' (' + email + ')');
      authMessage('Demande envoyée. En attente de validation admin.', 'success');

      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (reasonEl) reasonEl.value = '';
    });

    on('#thirdLoginBtn', 'click', function () {
      var nameEl = q('#loginName');
      var emailEl = q('#loginEmail');
      var name = nameEl ? nameEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';

      if (!name || !email) {
        authMessage('Nom et email requis.', 'error');
        return;
      }

      var user = findUser(name, email);
      if (!user) {
        var req = getRequests().find(function (r) {
          return r.name.toLowerCase() === name.toLowerCase() && r.email.toLowerCase() === email.toLowerCase();
        });
        if (req && req.status === 'pending') {
          authMessage('Votre demande est en cours de traitement.', 'warning');
          return;
        }
        authMessage('Aucun accès trouvé pour ces identifiants.', 'error');
        return;
      }

      if (user.status !== 'approved') {
        authMessage('Accès refusé ou révoqué.', 'error');
        return;
      }

      setSession(user);
      showApp();
      toast('Connexion tiers réussie.', 'success');
    });

    on('#logoutBtn', 'click', function () {
      clearSession();
      showLogin();
      toast('Déconnexion effectuée.', 'info');
    });

    /* =====================================================
       PDF UPLOAD
       ===================================================== */
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
      var el = q('#pdfStatus');
      if (el) {
        el.textContent = msg;
        el.className = 'status ' + type;
      } else {
        toast(msg, type);
      }
    }

    on('#pdfUpload', 'change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        pdfStatus('Format non supporté. PDF uniquement.', 'error');
        return;
      }

      if (!window.pdfjsLib) {
        pdfStatus('Bibliothèque PDF.js indisponible. Saisissez le texte manuellement.', 'error');
        return;
      }

      pdfStatus('Extraction du texte en cours...', 'success');

      readFileAsArrayBuffer(file).then(function (arrayBuffer) {
        return window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      }).then(function (pdf) {
        var fullText = '';
        var promises = [];

        for (var i = 1; i <= pdf.numPages; i++) {
          (function (pageNum) {
            promises.push(
              pdf.getPage(pageNum).then(function (page) {
                return page.getTextContent();
              }).then(function (tc) {
                fullText += tc.items.map(function (item) { return item.str; }).join(' ') + '\n\n';
              })
            );
          })(i);
        }

        return Promise.all(promises).then(function () {
          extractedText = fullText;
          var textInput = q('#textInput');
          if (textInput) textInput.value = fullText;
          pdfStatus('PDF extrait avec succès (' + pdf.numPages + ' pages).', 'success');
        });
      }).catch(function (err) {
        console.error(err);
        pdfStatus('Erreur d’extraction PDF : ' + err.message, 'error');
      });
    });

    /* =====================================================
       CROISEMENT TECHNIQUE / JURIDIQUE LOCAL
       ===================================================== */
    function checkYearRange(rangeStr, targetYear) {
      if (!targetYear) return true;
      var parts = String(rangeStr || '').split('-').map(function (s) { return parseInt(s.trim(), 10); });
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

    function legalFor(defect) {
      var laws = [];
      if (defect.law) laws.push(defect.law);

      var sym = norm(defect.sym || '');
      var sev = defect.sev || 'moyen';

      if (sev === 'critique') {
        laws.push('Vice caché art. 1641 C.civ.');
        laws.push('Défaut de conformité L.217-4 C.consom. si vendeur professionnel.');
        laws.push('Tromperie L.213-1 C.consom. en cas de dissimulation.');
      } else {
        laws.push('Vice caché art. 1641 C.civ. à confirmer par expertise.');
        laws.push('Usure normale à écarter selon kilométrage et entretien.');
      }

      if (sym.indexOf('eau') >= 0 || sym.indexOf('infiltration') >= 0 || sym.indexOf('court circuit') >= 0) {
        laws.push('Défaut de sécurité L.423-1 C.consom.');
        laws.push('Responsabilité du fait des produits défectueux art. 1245 C.civ.');
      }

      if (sym.indexOf('incendie') >= 0 || sym.indexOf('airbag') >= 0 || sym.indexOf('pedale') >= 0 || sym.indexOf('pédale') >= 0) {
        laws.push('Mise en danger art. 223-1 C.pénal.');
        laws.push('Homicide/blessures involontaires art. 221-6 / 222-19 C.pénal en cas d’accident.');
      }

      if (sym.indexOf('dieselgate') >= 0 || sym.indexOf('nox') >= 0 || sym.indexOf('logiciel') >= 0) {
        laws.push('Nullité pour dol art. 1137 C.civ.');
        laws.push('Jurisprudence CJUE / Cass. civ. sur defeat device.');
      }

      return laws.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' | ');
    }

    function matchDefects(marque, modele, annee, kilometrage, texte) {
      var bq = norm(marque);
      if (!bq) return [];

      var mq = norm(modele);
      var yr = parseYear(annee);
      var km = parseKm(kilometrage);
      var txt = norm(texte);
      var results = [];

      defectList.forEach(function (d) {
        var db = norm(d.b || '');
        var brandOk = db.indexOf(bq) >= 0 || bq.indexOf(db) >= 0;
        if (!brandOk) return;

        var yearOk = checkYearRange(d.yrs, yr);
        if (!yearOk) return;

        var modelOk = true;
        if (mq) {
          modelOk = String(d.mods || '').split('|').some(function (m) {
            var nm = norm(m);
            return nm.indexOf(mq) >= 0 || mq.indexOf(nm) >= 0;
          });
        }
        if (!modelOk) return;

        var score = 0;
        var found = [];
        String(d.sym || '').split('|').forEach(function (s) {
          if (symptomMatch(txt, s)) {
            score++;
            found.push(s);
          }
        });

        if (score > 0) {
          var confidence = 'Haute';
          var wearAlert = 'Kilométrage compatible avec un vice caché ou un défaut de série.';

          if (km > 200000) {
            confidence = d.wf >= 0.9 ? 'Moyenne' : 'Basse';
            wearAlert = 'Kilométrage très élevé (>200 000 km) : la présomption d’usure normale est forte. Expertise judiciaire indispensable.';
          } else if (km > 150000 && d.wf < 0.7) {
            confidence = 'Basse';
            wearAlert = 'Kilométrage élevé (>150 000 km) : une part des symptômes peut relever de l’usure normale.';
          } else if (km > 100000 && d.wf < 0.85) {
            confidence = 'Moyenne';
            wearAlert = 'Kilométrage élevé (>100 000 km) : usure possible, mais défaut documenté suspect.';
          }

          if (d.wf >= 0.9) {
            confidence = 'Haute';
            wearAlert = 'Défaut de conception/montage peu dépendant du kilométrage.';
          }

          results.push({
            constructeur: d.b,
            moteur: d.eng,
            puissance: d.p,
            periode: d.yrs,
            modeles: String(d.mods || '').split('|'),
            severite: d.sev,
            description: d.n,
            symptomes: found,
            score: score,
            confiance: confidence,
            alerteUsure: wearAlert,
            baseLegale: legalFor(d),
            rappelRef: d.recall || 'À vérifier via VIN auprès constructeur, DGCCRF, rappel.conso, NHTSA.',
            wearFactor: d.wf
          });
        }
      });

      return results.sort(function (a, b) { return b.score - a.score; });
    }

    function researchLinks(brand, model, engine, symptoms) {
      var baseQuery = (brand + ' ' + model + ' ' + (engine || '') + ' ' + (symptoms || []).slice(0, 3).join(' ')).trim();
      var q1 = encodeURIComponent(baseQuery + ' défaut panne rappel');
      var q2 = encodeURIComponent(brand + ' ' + model);

      return [
        { label: 'Recherche spécialisée Google / forums techniques', url: 'https://www.google.com/search?q=' + q1 },
        { label: 'Rappel Conso France (DGCCRF)', url: 'https://www.rappel.conso.gouv.fr/recherche/?search=' + q2 },
        { label: 'NHTSA Recalls (USA)', url: 'https://www.nhtsa.gov/recalls?search=' + q2 },
        { label: 'Recherche sécurité / défauts constructeurs', url: 'https://www.google.com/search?q=' + encodeURIComponent(baseQuery + ' safetygate TSB rappel défaut') },
        { label: 'Vérification VIN constructeur', url: 'https://www.google.com/search?q=' + encodeURIComponent(brand + ' ' + model + ' VIN recall campaign') }
      ];
    }

    /* =====================================================
       ANALYSE
       ===================================================== */
    function addTerm() {
      for (var i = 0; i < arguments.length; i++) {
        termesMobilises.add(arguments[i]);
      }
      return '<span class="termes-juridiques">(' + Array.prototype.slice.call(arguments).join(', ') + ')</span>';
    }

    on('#analyzeBtn', 'click', function () {
      if (!currentUser) {
        toast('Connectez-vous.', 'error');
        return;
      }

      var info = dailyInfo();
      if (!info.allowed) {
        toast('Limite de ' + MAX_DAILY_ANALYSES + ' analyses/jour atteinte.', 'warning');
        return;
      }

      var textEl = q('#textInput');
      var contextEl = q('#contextInfo');
      var objectiveEl = q('#objectiveInfo');
      var goalEl = q('#goalSelect');
      var sellerEl = q('#sellerType');

      var text = textEl ? textEl.value.trim() : '';
      if (!text) text = extractedText.trim();

      var context = contextEl ? contextEl.value.trim() : '';
      var objective = (objectiveEl && objectiveEl.value.trim()) || (goalEl ? goalEl.value : '') || '';
      var sellerType = sellerEl ? sellerEl.value : 'unknown';

      vehicleData = {
        marque: (q('#vehicleBrand') || {}).value || '',
        modele: (q('#vehicleModel') || {}).value || '',
        annee: (q('#vehicleYear') || {}).value || '',
        kilometrage: (q('#vehicleKilometrage') || {}).value || '',
        vin: (q('#vehicleVin') || {}).value || ''
      };

      if (!text) {
        toast('Saisissez des faits ou importez un PDF.', 'warning');
        return;
      }

      termesMobilises = new Set();

      var btn = q('#analyzeBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Analyse experte en cours...';
      }

      setTimeout(function () {
        try {
          runAnalysis(text, context, objective, sellerType);
          incrementDaily();
          toast('Analyse générée.', 'success');
        } catch (err) {
          console.error(err);
          toast('Erreur d’analyse : ' + err.message, 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔍 Lancer l’analyse experte';
          }
        }
      }, 700);
    });

    function runAnalysis(text, context, objective, sellerType) {
      var all = (text + ' ' + context).toLowerCase();

      var flags = {
        professional: sellerType === 'professional' || ['professionnel', 'garage', 'concession', 'revendeur', 'automobile', 'commercial'].some(function (w) { return all.indexOf(w) >= 0; }),
        privateSeller: sellerType === 'private' || ['particulier', 'entre particuliers', 'leboncoin', 'lavitrine'].some(function (w) { return all.indexOf(w) >= 0; }),
        defect: ['défaut', 'panne', 'problème', 'dysfonctionnement', 'casse', 'fuite', 'bruit', 'vibration', 'perte puissance', 'à-coup', 'claquement', 'voyant', 'mode dégradé', 'surchauffe', 'infiltration', 'court circuit', 'moisiure', 'odeur', 'fumée', 'calage', 'patinage', 'blocage'].some(function (w) { return all.indexOf(w) >= 0; }),
        waterLeak: ['eau', 'humidité', 'infiltration', 'baie', 'pare brise', 'pare-brise', 'moisiure', 'court circuit', 'traces d’eau', 'flaque', 'égouttement'].some(function (w) { return all.indexOf(w) >= 0; }),
        safety: ['sécurité', 'frein', 'airbag', 'direction', 'incendie', 'danger', 'vie', 'intégrité physique', 'mise en danger'].some(function (w) { return all.indexOf(w) >= 0; }),
        invoice: all.indexOf('facture') >= 0,
        repair: all.indexOf('réparation') >= 0 || all.indexOf('ordre de réparation') >= 0 || all.indexOf('devis') >= 0,
        controlTech: all.indexOf('contrôle technique') >= 0 || all.indexOf(' ct ') >= 0,
        warranty: all.indexOf('garantie') >= 0,
        highKm: parseKm(vehicleData.kilometrage) > 120000,
        veryHighKm: parseKm(vehicleData.kilometrage) > 180000
      };

      var matches = matchDefects(vehicleData.marque, vehicleData.modele, vehicleData.annee, vehicleData.kilometrage, text);

      analysisData = {
        date: new Date().toLocaleString('fr-FR'),
        vehicleData: vehicleData,
        flags: flags,
        matches: matches,
        sections: []
      };

      var S = [];
      S.push(['I. ÉLÉMENTS FACTUELS ET IDENTIFICATION DU VÉHICULE', secFacts(text, context)]);
      S.push(['II. DIAGNOSTIC TECHNIQUE — DÉFAUTS CONNUS, VÉTUSTÉ, USURE ET SÉCURITÉ', secDiag(matches, flags, vehicleData)]);
      S.push(['III. QUALIFICATION JURIDIQUE PROVISOIRE', secQualif(flags, matches)]);
      S.push(['IV. RISQUES ET RESPONSABILITÉS SELON LA QUALITÉ DU VENDEUR', secRisques(flags, matches)]);
      S.push(['V. TROIS CRITÈRES CUMULATIFS : ANTÉRIORITÉ, CARACTÈRE CACHÉ, GRAVITÉ', secCriteres(flags, matches, vehicleData)]);
      S.push(['VI. RÉGIMES DE GARANTIE ET FONDEMENTS JURIDIQUES CROISÉS', secGaranties(flags, matches)]);
      S.push(['VII. DOSSIER PROBATOIRE ET DOCUMENTS À CONSOLIDER', secDocs(flags, matches)]);
      S.push(['VIII. JURISPRUDENCE, TEXTES ET SOURCES DE RÉFÉRENCE', secJuri(matches)]);
      S.push(['IX. ÉVALUATION DU PRÉJUDICE', secPrejudice(flags, matches)]);
      S.push(['X. STRATÉGIE CONTENTIEUSE RECOMMANDÉE', secStrategie(flags, matches, objective)]);
      S.push(['XI. RECHERCHE APPROFONDIE ET VÉRIFICATIONS EXTERNES', secVerif(matches, flags)]);
      S.push(['XII. VOIES D’ACTION POSSIBLES', secVoies(flags, matches)]);
      S.push(['XIII. CONCLUSION ORIENTÉE EXPERT / INGÉNIEUR / JURISTE / SAPEUR-POMPIER', secConclu(objective, matches, flags, vehicleData)]);
      S.push(['XIV. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ', secLexique()]);

      analysisData.sections = S;
      renderAnalysis();
    }

    function renderAnalysis() {
      var html = '';
      analysisData.sections.forEach(function (pair) {
        html += '<h3>' + pair[0] + '</h3>' + pair[1];
      });

      html += '<div class="verification-needed"><strong>Rappel méthodologique :</strong> ce rapport effectue d’abord un croisement local technique/juridique avant toute rédaction assistée par IA. Il ne remplace ni une expertise contradictoire, ni un avocat, ni un expert judiciaire.</div>';

      var result = q('#analysisResult');
      if (result) result.innerHTML = html;

      var section = q('#analysisSection');
      if (section) {
        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }

    /* =====================================================
       SECTIONS DU RAPPORT
       ===================================================== */
    function secFacts(text, context) {
      var h = '<p><strong>Objet :</strong> recensement des éléments fournis ' + addTerm('éléments factuels', 'faits allégués') + '.</p>';

      h += '<h4>A. Véhicule déclaré</h4><ul>';
      h += '<li><strong>Marque :</strong> ' + esc(vehicleData.marque || 'non précisée') + '</li>';
      h += '<li><strong>Modèle :</strong> ' + esc(vehicleData.modele || 'non précisé') + '</li>';
      h += '<li><strong>Année :</strong> ' + esc(vehicleData.annee || 'non précisée') + ' ' + addTerm('millésime', 'date de première mise en circulation') + '</li>';
      h += '<li><strong>Kilométrage :</strong> ' + esc(vehicleData.kilometrage || 'non précisé') + ' km ' + addTerm('kilométrage', 'usure normale', 'vétusté') + '</li>';
      h += '<li><strong>VIN :</strong> ' + esc(vehicleData.vin || 'non communiqué') + ' ' + addTerm('VIN', 'numéro de série', 'traçabilité') + '</li>';
      h += '</ul>';

      h += '<h4>B. Faits rapportés</h4>';
      h += '<p>' + esc(text.substring(0, 1200)) + (text.length > 1200 ? ' [...] (tronqué pour affichage, analyse complète conservée en mémoire)' : '') + '</p>';

      if (context) {
        h += '<h4>C. Contexte transactionnel</h4><p>' + esc(context.substring(0, 900)) + '</p>';
      }

      h += '<div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ' + addTerm('faits non vérifiés', 'principe du contradictoire') + '.</div>';
      return h;
    }

    function secDiag(matches, flags, vData) {
      var km = parseKm(vData.kilometrage);
      var yr = parseYear(vData.annee);
      var age = new Date().getFullYear() - (yr || new Date().getFullYear());

      if (!matches.length) {
        var h0 = '<p><strong>Objet :</strong> recherche de défauts conceptuels connus ' + addTerm('défauts conceptuels', 'problèmes récurrents', 'défaut de série') + '.</p>';
        h0 += '<div class="verification-needed">';
        h0 += '<p>Aucune correspondance exacte trouvée dans la base locale pour Marque/Modèle/Année/Symptômes.</p>';
        h0 += '<p>Cela ne signifie pas absence de défaut, mais absence de notoriété suffisante dans les sources consolidées localement.</p>';
        h0 += '<p>Une expertise individuelle est nécessaire ' + addTerm('expertise individuelle', 'analyse fonctionnelle', 'recherche de cause racine') + '.</p>';
        h0 += '</div>';
        return h0;
      }

      var h = '<p><strong>Objet :</strong> croisement technique local avec défauts connus, rappels, TSB, forums spécialisés et bases de sécurité ' + addTerm('vice caché notoire', 'défaut de série', 'défaut de conception') + '.</p>';

      matches.forEach(function (m, i) {
        var cls = m.severite === 'critique' ? 'rappel-critical' : 'rappel-info';
        var confColor = m.confiance === 'Haute' ? '#10b981' : (m.confiance === 'Moyenne' ? '#f59e0b' : '#ef4444');

        h += '<div class="' + cls + '">';
        h += '<h4>' + (i + 1) + '. ' + esc(m.moteur) + ' — ' + esc(m.puissance) + ' — ' + esc(m.periode) + '</h4>';
        h += '<p><strong>Constructeur :</strong> ' + esc(m.constructeur) + '</p>';
        h += '<p><strong>Modèles concernés :</strong> ' + esc(m.modeles.join(', ')) + '</p>';
        h += '<p><strong>Symptômes détectés :</strong> ' + esc(m.symptomes.join(', ')) + '</p>';
        h += '<p><strong>Description technique :</strong> ' + esc(m.description) + '</p>';
        h += '<p><strong>Gravité :</strong> <span style="font-weight:bold;color:' + (m.severite === 'critique' ? '#dc3545' : '#ffc107') + '">' + esc(m.severite.toUpperCase()) + '</span></p>';
        h += '<p><strong>Confiance vs usure :</strong> <span style="color:' + confColor + ';font-weight:bold">' + esc(m.confiance) + '</span> — indice de non-usure : ' + Math.round(m.wearFactor * 100) + '%</p>';
        h += '<p style="background:#fff3cd;padding:8px;border-radius:4px;">⚠️ ' + esc(m.alerteUsure) + '</p>';
        h += '<p><strong>Croisement juridique local :</strong> ' + esc(m.baseLegale) + ' ' + addTerm('vice caché', 'défaut de conformité', 'tromperie') + '</p>';
        h += '<p><strong>Rappel / TSB :</strong> ' + esc(m.rappelRef) + ' ' + addTerm('rappel constructeur', 'campagne technique', 'TSB') + '</p>';
        h += '</div>';
      });

      h += '<h4>Analyse de vétusté et kilométrage</h4><ul>';
      h += '<li><strong>Âge approximatif :</strong> ' + age + ' ans</li>';
      h += '<li><strong>Kilométrage :</strong> ' + km.toLocaleString('fr-FR') + ' km</li>';
      h += '<li><strong>Rythme estimé :</strong> ' + (age > 0 ? Math.round(km / age).toLocaleString('fr-FR') : 'N/A') + ' km/an</li>';

      if (km > 200000) {
        h += '<li class="certainty-low">Kilométrage très élevé : usure normale fortement plausible. Expertise indispensable pour distinguer défaut et usure.</li>';
      } else if (km > 120000) {
        h += '<li class="certainty-medium">Kilométrage élevé : usure possible, mais défaut de série documenté maintient une suspicion forte.</li>';
      } else {
        h += '<li class="certainty-high">Kilométrage modéré : la thèse du vice caché / défaut de conception est renforcée.</li>';
      }
      h += '</ul>';

      if (flags.waterLeak) {
        h += '<div class="rappel-critical"><h4>💧 Alerte infiltration d’eau — angle ingénieur / sapeur-pompier</h4>';
        h += '<p>Les symptômes évoquent une infiltration d’eau (baie de pare-brise, joints, évacuations, toit ouvrant, climatisation).</p>';
        h += '<p><strong>Point expert :</strong> ce type de désordre relève souvent d’un défaut de montage ou de conception, indépendant du kilométrage.</p>';
        h += '<p><strong>Risques :</strong> court-circuit, destruction de calculateurs, corrosion, dysfonctionnement ABS/ESP, airbag, direction, risque d’incendie électrique.</p>';
        h += '<p><strong>Constat recommandé :</strong> photos des moisiures, boîtier fusibles, connecteurs sous tableau de bord, cavillon, joints de pare-brise, évacuations.</p>';
        h += '</div>';
      }

      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<div class="rappel-critical"><h4>🚨 Alerte sécurité civile / sapeur-pompier</h4>';
        h += '<p>Un défaut critique est identifié : risque moteur, incendie, perte de contrôle, airbag ou immobilisation brutale.</p>';
        h += '<p>En attendant expertise, limiter l’usage du véhicule, éviter autoroutes, transports d’enfants, trajets de nuit et longue durée.</p>';
        h += '</div>';
      }

      h += '<div class="certainty-medium"><strong>Synthèse :</strong> faisceau d’indices techniques ' + addTerm('faisceau d’indices', 'indice grave précis et concordant') + ' en faveur d’un défaut antérieur, caché et grave. Le vendeur professionnel aurait pu connaître ce risque ' + addTerm('obligation de renseignement', 'présomption de connaissance') + '.</div>';

      return h;
    }

    function secQualif(flags, matches) {
      var h = '<p><strong>Objet :</strong> qualification juridique provisoire ' + addTerm('qualification juridique', 'qualification incertaine') + '.</p>';

      if (flags.professional && !flags.privateSeller) {
        h += '<div class="certainty-high"><p>Vendeur présumé professionnel ' + addTerm('vendeur professionnel') + '. Protection consommateur renforcée : garantie légale de conformité, charge de la preuve allégée, obligation d’information et de vérification des rappels.</p></div>';
      } else if (flags.privateSeller && !flags.professional) {
        h += '<div class="certainty-medium"><p>Vendeur présumé particulier ' + addTerm('vente entre particuliers') + '. Garantie des vices cachés du Code civil. Charge de la preuve plus lourde pour l’acquéreur.</p></div>';
      } else {
        h += '<div class="certainty-low"><p>Statut du vendeur incertain ' + addTerm('ambiguïté statut vendeur') + '. Qualifier d’abord le vendeur avant action.</p></div>';
      }

      if (matches.length) {
        h += '<p>La probabilité d’un ' + addTerm('défaut de conception', 'vice caché notoire') + ' renforce la non-conformité initiale du bien.</p>';
      }

      return h;
    }

    function secRisques(flags, matches) {
      var h = '<p><strong>Objet :</strong> risques et responsabilités ' + addTerm('risques encourus', 'responsabilité contractuelle', 'responsabilité délictuelle') + '.</p>';

      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<div class="rappel-critical"><h4>⚠️ Responsabilité aggravée</h4><ul>';
        h += '<li>Professionnel : faute lourde ou dolosive possible ' + addTerm('faute lourde', 'faute dolosive') + '.</li>';
        h += '<li>Particulier : mauvaise foi si défaut connu ou dissimulé ' + addTerm('mauvaise foi', 'réticence dolosive') + '.</li>';
        h += '<li>Pénal possible en cas d’accident ' + addTerm('homicide involontaire', 'blessures involontaires', 'mise en danger') + '.</li>';
        h += '<li>Constructeur : produits défectueux ' + addTerm('article 1245 C.civ.') + '.</li>';
        h += '</ul></div>';
      }

      h += '<h4>A. Si professionnel</h4><ul>';
      h += '<li>' + addTerm('garantie légale de conformité', 'L.217-4 C.consom.') + ' : réparation, remplacement, réduction, résolution.</li>';
      h += '<li>' + addTerm('présomption d’antériorité') + ' pendant 12 mois, 24 mois depuis 2022.</li>';
      h += '<li>' + addTerm('responsabilité contractuelle', '1231-1 C.civ.') + ' : dommages-intérêts.</li>';
      h += '<li>' + addTerm('tromperie', 'L.213-1 C.consom.') + ' si dissimulation.</li>';
      h += '<li>' + addTerm('DGCCRF', 'rappel conso', 'sanctions administratives') + '.</li>';
      h += '</ul>';

      h += '<h4>B. Si particulier</h4><ul>';
      h += '<li>' + addTerm('garantie des vices cachés', '1641 C.civ.') + '.</li>';
      h += '<li>' + addTerm('action rédhibitoire') + ' ou ' + addTerm('action estimatoire') + '.</li>';
      h += '<li>' + addTerm('charge de la preuve') + ' sur l’acquéreur.</li>';
      h += '<li>' + addTerm('clause vendu en l’état') + ' inopposable en cas de mauvaise foi.</li>';
      h += '</ul>';

      return h;
    }

    function secCriteres(flags, matches, vData) {
      var km = parseKm(vData.kilometrage);
      var best = matches[0];

      var h = '<p><strong>Objet :</strong> critères cumulatifs adaptés à l’usure et à la vétusté ' + addTerm('critères cumulatifs', 'usure normale', 'vétusté') + '.</p>';

      h += '<h4>A. Antériorité ' + addTerm('antériorité') + '</h4>';
      if (best && best.confiance === 'Haute') {
        h += '<p class="certainty-high">Défaut de série/conception : antériorité fortement présimée, indépendante du kilométrage.</p>';
      } else if (best && best.confiance === 'Moyenne') {
        h += '<p class="certainty-medium">Antériorité probable, mais km élevé (' + km.toLocaleString('fr-FR') + ') : expertise pour écarter l’usure.</p>';
      } else if (best) {
        h += '<p class="certainty-low">Antériorité difficile à établir sans expertise : km très élevé, usure normale plausible.</p>';
      } else {
        h += '<p class="verification-needed">Antériorité à prouver par expertise contradictoire.</p>';
      }

      h += '<h4>B. Caractère caché ' + addTerm('caractère caché') + '</h4>';
      if (best && best.wearFactor >= 0.8) {
        h += '<p class="certainty-high">Défaut non apparent lors d’un examen visuel standard et d’un essai court.</p>';
      } else if (best) {
        h += '<p class="certainty-medium">Caractère caché soutenable, mais dépend de la diligence de l’acheteur et de la visibilité du symptôme.</p>';
      } else {
        h += '<p>Caractère caché à apprécier concrètement.</p>';
      }

      h += '<h4>C. Gravité ' + addTerm('gravité') + '</h4>';
      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<p class="certainty-high">Gravité élevée : sécurité, casse moteur, incendie, immobilisation, coût disproportionné.</p>';
      } else if (matches.length) {
        h += '<p class="certainty-medium">Gravité à mesurer par rapport au coût de réparation et à la valeur du véhicule.</p>';
      } else {
        h += '<p>Gravité à évaluer par devis et usage normal du véhicule.</p>';
      }

      h += '<div class="verification-needed">Réunion des critères à confirmer par expertise ' + addTerm('confirmation expertise') + '.</div>';
      return h;
    }

    function secGaranties(flags, matches) {
      var h = '<p><strong>Objet :</strong> régimes de garantie et croisement juridique local ' + addTerm('régimes de garantie', 'cumul des garanties') + '.</p>';

      if (flags.professional) {
        h += '<h4>Professionnel</h4><ul>';
        h += '<li>' + addTerm('garantie légale de conformité', 'L.217-4 et s. C.consom.') + '</li>';
        h += '<li>' + addTerm('garantie des vices cachés', '1641 C.civ.') + ' cumulable</li>';
        h += '<li>' + addTerm('responsabilité contractuelle', '1231-1 C.civ.') + '</li>';
        h += '<li>' + addTerm('tromperie', 'L.213-1 C.consom.') + '</li>';
        h += '<li>' + addTerm('pratique commerciale trompeuse', 'L.121-2 C.consom.') + '</li>';
        h += '</ul>';
      } else {
        h += '<h4>Particulier</h4><ul>';
        h += '<li>' + addTerm('garantie des vices cachés', '1641 à 1649 C.civ.') + '</li>';
        h += '<li>' + addTerm('action rédhibitoire') + ' / ' + addTerm('action estimatoire') + '</li>';
        h += '<li>' + addTerm('dol', '1137 C.civ.') + ' si dissimulation</li>';
        h += '<li>' + addTerm('obligation d’information précontractuelle', '1112-1 C.civ.') + '</li>';
        h += '</ul>';
      }

      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<h4>Constructeur / sécurité</h4><ul>';
        h += '<li>' + addTerm('produits défectueux', '1245 C.civ.') + '</li>';
        h += '<li>' + addTerm('défaut de sécurité', 'L.423-1 C.consom.') + '</li>';
        h += '<li>' + addTerm('rappel obligatoire', 'DGCCRF', 'NHTSA') + '</li>';
        h += '</ul>';
      }

      return h;
    }

    function secDocs(flags, matches) {
      var h = '<p><strong>Objet :</strong> preuve documentaire ' + addTerm('preuve documentaire', 'dossier probatoire') + '.</p><ul>';
      h += '<li>Facture : ' + (flags.invoice ? 'présente' : 'à récupérer') + '</li>';
      h += '<li>Certificat de cession : à conserver</li>';
      h += '<li>Carte grise : vérifier cohérence kilométrage</li>';
      h += '<li>Contrôle technique : ' + (flags.controlTech ? 'présent' : 'à récupérer') + '</li>';
      h += '<li>Historique entretien / carnet / factures garage</li>';
      h += '<li>Preuve des rappels effectués via VIN</li>';
      h += '<li>Devis réparation (minimum 2)</li>';
      h += '<li>Lecture OBD / codes défaut DTC</li>';
      h += '<li>Photos : moisiure, eau, corrosion, voyants, niveaux</li>';
      if (matches.length) {
        h += '<li>Vérification VIN sur sites constructeur, DGCCRF, rappel.conso, NHTSA</li>';
      }
      h += '</ul>';
      h += '<div class="verification-needed">Sans facture, CT ou historique, la preuve de l’antériorité sera fragilisée ' + addTerm('insuffisance probatoire') + '.</div>';
      return h;
    }

    function secJuri(matches) {
      var h = '<p><strong>Objet :</strong> textes et jurisprudence ' + addTerm('jurisprudence', 'doctrine') + '.</p>';
      h += '<h4>Textes</h4><ul>';
      h += '<li>1641 à 1649 C.civ. — vices cachés</li>';
      h += '<li>1130 à 1144 C.civ. — vices du consentement</li>';
      h += '<li>1112-1 C.civ. — information précontractuelle</li>';
      h += '<li>1231-1 C.civ. — responsabilité contractuelle</li>';
      h += '<li>1240, 1241 C.civ. — responsabilité délictuelle</li>';
      h += '<li>1245 et s. C.civ. — produits défectueux</li>';
      h += '<li>L.217-3 à L.217-20 C.consom. — conformité</li>';
      h += '<li>L.213-1 C.consom. — tromperie</li>';
      h += '<li>L.121-2 C.consom. — pratique commerciale trompeuse</li>';
      h += '<li>L.423-1 C.consom. — sécurité des produits</li>';
      h += '<li>221-6, 222-19, 223-1, 313-1, 441-1 C.pénal</li>';
      h += '</ul>';

      h += '<h4>Jurisprudence / références</h4><ul>';
      h += '<li>Cass. civ. 1ère, 3 mai 2006 — caractère caché</li>';
      h += '<li>Cass. civ. 1ère, 12 juill. 2018 — vérification des rappels par pro</li>';
      h += '<li>Cass. civ. 1ère, 27 févr. 2019 — clause vendu en l’état et mauvaise foi</li>';
      h += '<li>CJUE, 5 avril 2023, C-277/22 — defeat device et conformité</li>';
      h += '<li>TGI Paris, 15 janv. 2020 — Renault 1.5 dCi bielles</li>';
      h += '</ul>';

      if (matches.length) {
        h += '<h4>Références spécifiques aux défauts détectés</h4><ul>';
        matches.forEach(function (m) {
          h += '<li><strong>' + esc(m.moteur) + ' :</strong> ' + esc(m.rappelRef) + '</li>';
        });
        h += '</ul>';
      }

      return h;
    }

    function secPrejudice(flags, matches) {
      var h = '<p><strong>Objet :</strong> préjudice ' + addTerm('évaluation du préjudice', 'réparation intégrale') + '.</p>';
      h += '<h4>Préjudices matériels</h4><ul>';
      h += '<li>Coût réparations / devis</li>';
      h += '<li>Remboursement prix si résolution</li>';
      h += '<li>Moins-value</li>';
      h += '<li>Location véhicule remplacement</li>';
      h += '<li>Frais expertise / avocat / dépens</li>';
      h += '<li>Manque à gagner si usage professionnel</li>';
      h += '</ul>';

      h += '<h4>Préjudices moraux / corporels</h4><ul>';
      h += '<li>Préjudice d’anxiété si dangerosité</li>';
      h += '<li>Trouble dans les conditions d’existence</li>';
      h += '<li>Souffrances endurées / préjudice esthétique / DFT / DFP si accident</li>';
      h += '</ul>';

      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<div class="rappel-critical"><strong>Angle sapeur-pompier / sécurité :</strong> la peur de conduire un véhicule dangereux peut justifier un préjudice moral même sans accident ' + addTerm('préjudice d’anxiété') + '.</div>';
      }

      return h;
    }

    function secStrategie(flags, matches, objective) {
      var h = '<p><strong>Objet :</strong> stratégie ' + addTerm('stratégie contentieuse', 'MARD') + '.</p>';

      h += '<h4>Phase 1 — consolidation probatoire</h4><ol>';
      h += '<li>Expertise amiable contradictoire</li>';
      h += '<li>Devis réparation</li>';
      h += '<li>Lecture OBD</li>';
      h += '<li>Vérification VIN / rappels</li>';
      h += '<li>Photos et constats</li>';
      h += '</ol>';

      h += '<h4>Phase 2 — mise en demeure</h4><ol>';
      h += '<li>LRAR au vendeur</li>';
      if (matches.length) {
        h += '<li>Invoquer le défaut de série documenté ' + addTerm('défaut de série', 'présomption de connaissance') + '</li>';
      }
      h += '<li>Délai 15 jours</li>';
      h += '<li>Joindre rapport, devis, photos</li>';
      h += '</ol>';

      h += '<h4>Phase 3 — résolution amiable</h4><ol>';
      h += '<li>Conciliation</li>';
      if (flags.professional) h += '<li>Médiation de la consommation</li>';
      h += '<li>Transaction écrite si accord</li>';
      h += '</ol>';

      h += '<h4>Phase 4 — judiciaire</h4><ol>';
      h += '<li>Assignation TJ / tribunal de proximité</li>';
      h += '<li>Demande d’expertise judiciaire si nécessaire</li>';
      h += '<li>Référé si urgence / danger</li>';
      if (matches.length && matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<li>Signalement DGCCRF / préfet si danger collectif</li>';
      }
      h += '</ol>';

      if (objective) {
        h += '<p><strong>Objectif déclaré :</strong> ' + esc(objective) + '</p>';
      }

      return h;
    }

    function secVerif(matches, flags) {
      var h = '<p><strong>Objet :</strong> vérifications et recherche approfondie ' + addTerm('vérifications complémentaires') + '.</p>';

      h += '<ul>';
      h += '<li>Vérifier VIN sur site constructeur</li>';
      h += '<li>Consulter rappel.conso.gouv.fr</li>';
      h += '<li>Consulter NHTSA si véhicule importé / groupe international</li>';
      h += '<li>Rechercher TSB / notes techniques atelier</li>';
      h += '<li>Consulter forums spécialisés et retours propriétaires</li>';
      h += '<li>Vérifier historique entretien et rappels effectués</li>';
      h += '<li>Faire lire les codes défaut OBD</li>';
      if (flags.waterLeak) {
        h += '<li>Inspecter baie de pare-brise, cavillon, évacuations, boîtier fusibles, connecteurs</li>';
      }
      h += '</ul>';

      var links = researchLinks(
        vehicleData.marque,
        vehicleData.modele,
        matches[0] ? matches[0].moteur : '',
        matches[0] ? matches[0].symptomes : []
      );

      h += '<h4>Pistes de recherche externe à ouvrir manuellement</h4><ul>';
      links.forEach(function (l) {
        h += '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + '</a></li>';
      });
      h += '</ul>';

      h += '<div class="verification-needed">Ces liens ne sont pas appelés automatiquement par l’application. Ils servent à confirmer localement la notoriété du défaut avant conclusion finale.</div>';

      return h;
    }

    function secVoies(flags, matches) {
      var h = '<p><strong>Objet :</strong> voies d’action ' + addTerm('voies d’action') + '.</p><ul>';
      h += '<li>Action civile en garantie des vices cachés</li>';
      if (flags.professional) {
        h += '<li>Garantie légale de conformité</li>';
        h += '<li>Signalement DGCCRF / rappel.conso</li>';
        h += '<li>Médiation de la consommation</li>';
      }
      if (matches.some(function (m) { return m.severite === 'critique'; })) {
        h += '<li>Action contre constructeur : produits défectueux</li>';
        h += '<li>Plainte pénale si danger dissimulé</li>';
        h += '<li>Action collective si défaut massif</li>';
      }
      h += '<li>Expertise judiciaire</li>';
      h += '</ul>';
      return h;
    }

    function secConclu(objective, matches, flags, vData) {
      var high = matches.some(function (m) { return m.confiance === 'Haute'; });
      var critical = matches.some(function (m) { return m.severite === 'critique'; });

      var h = '<p><strong>Objet :</strong> conclusion prudente ' + addTerm('synthèse') + '.</p>';

      h += '<p>';
      if (high && critical) {
        h += 'Le croisement local technique/juridique oriente fortement vers un défaut de conception ou de montage, antérieur, caché et grave. La voie du vice caché et/ou de la conformité est sérieusement ouverte.';
      } else if (matches.length) {
        h += 'Un défaut connu est probable, mais le kilométrage ou la nature du symptôme impose une expertise pour écarter l’usure normale.';
      } else {
        h += 'Aucun défaut de série identifié localement. Le problème peut être individuel : diagnostic et expertise nécessaires.';
      }
      h += '</p>';

      h += '<p><strong>Recommandation opérationnelle :</strong> ne pas effectuer de réparation destructrice avant constat/expertise. Conserver le véhicule en l’état si possible, photographier, obtenir devis, puis mise en demeure LRAR.</p>';

      if (flags.professional) {
        h += '<p><strong>Si vendeur professionnel :</strong> privilégier garantie légale de conformité + signalement DGCCRF si danger.</p>';
      } else {
        h += '<p><strong>Si vendeur particulier :</strong> privilégier expertise amiable puis action en vices cachés.</p>';
      }

      h += '<div class="certainty-low"><strong>Avertissement :</strong> document d’aide à la rédaction. Ne constitue pas un avis juridique définitif.</div>';

      return h;
    }

    function secLexique() {
      var terms = Array.from(termesMobilises).sort();
      var h = '<p><strong>Termes mobilisés :</strong> ' + terms.length + '</p><div class="lexique-section">';
      terms.forEach(function (t) {
        h += '<div class="lexique-item"><strong>' + esc(t) + '</strong></div>';
      });
      h += '</div>';
      return h;
    }

    /* =====================================================
       ADMIN PANEL
       ===================================================== */
    function updateAdminStats() {
      var brands = {};
      defectList.forEach(function (d) { brands[d.b] = true; });

      var statEntries = q('#statEntries');
      var statBrands = q('#statBrands');
      var statSync = q('#statSync');

      if (statEntries) statEntries.textContent = defectList.length;
      if (statBrands) statBrands.textContent = Object.keys(brands).length;
      if (statSync) statSync.textContent = 'Locale + personnalisée';
    }

    function renderRequests() {
      var box = q('#pendingRequests');
      if (!box) return;

      var pending = getRequests().filter(function (r) { return r.status === 'pending'; });
      var count = q('#pendingCount');
      if (count) count.textContent = pending.length;

      if (!pending.length) {
        box.innerHTML = '<p class="empty-state">Aucune demande.</p>';
        return;
      }

      box.innerHTML = pending.map(function (r) {
        return '<div class="card pending">' +
          '<strong>' + esc(r.name) + '</strong> <small>' + esc(r.email) + '</small>' +
          '<p>' + esc(r.reason) + '</p>' +
          '<div class="actions">' +
          '<button class="btn-ok" data-action="approve" data-id="' + esc(r.id) + '">Accepter</button>' +
          '<button class="btn-no" data-action="refuse" data-id="' + esc(r.id) + '">Refuser</button>' +
          '</div></div>';
      }).join('');
    }

    function renderUsers() {
      var box = q('#authorizedUsers');
      if (!box) return;

      var users = getUsers().filter(function (u) { return u.role !== 'admin'; });

      if (!users.length) {
        box.innerHTML = '<p class="empty-state">Aucun tiers.</p>';
        return;
      }

      box.innerHTML = users.map(function (u) {
        var action = u.status === 'approved'
          ? '<button class="btn-warn" data-action="revoke" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '">Révoquer</button>'
          : '<button class="btn-ok" data-action="restore" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '">Rétablir</button>';

        return '<div class="card ' + esc(u.status) + '">' +
          '<strong>' + esc(u.name) + '</strong> <small>' + esc(u.email) + ' • ' + esc(u.status) + '</small>' +
          '<div class="actions">' + action + '</div>' +
          '</div>';
      }).join('');
    }

    function renderAdmin() {
      renderRequests();
      renderUsers();
      updateAdminStats();
    }

    on('#adminPanelBtn', 'click', function () {
      if (!currentUser || currentUser.role !== 'admin') return;
      var panel = q('#adminPanel');
      if (panel) panel.classList.remove('hidden');
      renderAdmin();
    });

    on('#closeAdminBtn', 'click', function () {
      var panel = q('#adminPanel');
      if (panel) panel.classList.add('hidden');
    });

    qa('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        qa('.admin-tab').forEach(function (b) { b.classList.remove('active'); });
        qa('.admin-pane').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var pane = q('#' + btn.dataset.adminTab + 'Pane');
        if (pane) pane.classList.add('active');
      });
    });

    on('#adminPanel', 'click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;

      if (action === 'approve' || action === 'refuse') {
        var id = btn.dataset.id;
        var reqs = getRequests();
        var req = reqs.find(function (r) { return r.id === id; });
        if (!req) return;

        req.status = action === 'approve' ? 'approved' : 'refused';
        saveRequests(reqs);

        if (action === 'approve') {
          upsertUser({
            id: req.id,
            name: req.name,
            email: req.email,
            role: 'user',
            status: 'approved',
            daily: { date: todayKey(), count: 0 }
          });
          notify('Accès approuvé', req.name);
        }

        renderAdmin();
        toast(action === 'approve' ? 'Demande acceptée.' : 'Demande refusée.', action === 'approve' ? 'success' : 'warning');
      }

      if (action === 'revoke' || action === 'restore') {
        var email = btn.dataset.email;
        var name = btn.dataset.name;
        var users = getUsers();
        var user = users.find(function (u) {
          return u.email.toLowerCase() === String(email).toLowerCase() && u.name.toLowerCase() === String(name).toLowerCase();
        });

        if (user) {
          user.status = action === 'revoke' ? 'revoked' : 'approved';
          saveUsers(users);
          renderAdmin();
          toast(action === 'revoke' ? 'Accès révoqué.' : 'Accès rétabli.', action === 'revoke' ? 'warning' : 'success');
        }
      }
    });

    on('#forceSyncBtn', 'click', function () {
      toast('Base locale autonome active. Utilisez Import JSON pour enrichir la base technique.', 'info');
      updateAdminStats();
    });

    /* =====================================================
       EXPORT / IMPORT / APK / INSTALL
       ===================================================== */
    on('#exportDataBtn', 'click', function () {
      var data = {
        exportedAt: new Date().toISOString(),
        users: getUsers(),
        requests: getRequests(),
        customDefects: customDefects
      };

      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aide-redactionnelle-expert-data.json';
      a.click();
      toast('Données exportées.', 'success');
    });

    on('#importDataBtn', 'click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);

            if (data.users) saveUsers(data.users);
            if (data.requests) saveRequests(data.requests);

            if (Array.isArray(data.customDefects)) {
              customDefects = data.customDefects;
              save(SK.CUSTOM_DEFECTS, customDefects);
              defectList = BASE_DEFECTS.concat(customDefects);
            }

            renderAdmin();
            updateAdminStats();
            toast('Données importées.', 'success');
          } catch (err) {
            console.error(err);
            toast('Erreur d’import JSON.', 'error');
          }
        };

        reader.readAsText(file);
      };

      input.click();
    });

    on('#apkBtn', 'click', function () {
      if (location.protocol === 'file:') {
        toast('Pour générer l’APK, publiez d’abord le site en HTTPS (GitHub Pages, Netlify, Vercel).', 'warning');
        return;
      }
      window.open('https://www.pwabuilder.com/?url=' + encodeURIComponent(location.origin + location.pathname), '_blank');
    });

    on('#copyUrlBtn', 'click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(function () {
          toast('URL copiée.', 'success');
        }).catch(function () {
          toast('Copie impossible.', 'error');
        });
      } else {
        toast('Copie non supportée par ce navigateur.', 'warning');
      }
    });

    on('#installBtn', 'click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
        }).catch(function () {});
      } else {
        toast('Utilisez le menu du navigateur : Installer l’application.', 'info');
      }
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      var btn = q('#installBtn');
      if (btn) btn.classList.remove('hidden');
    });

    /* =====================================================
       PDF / PARTAGE
       ===================================================== */
    on('#generatePdfBtn', 'click', function () {
      if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
        toast('Générez d’abord une analyse.', 'warning');
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        toast('Bibliothèque PDF indisponible. Vérifiez la connexion ou rechargez.', 'error');
        return;
      }

      try {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF();
        var y = 20;

        doc.setFontSize(16);
        doc.text("RAPPORT D'ANALYSE EXPERT AUTO", 105, y, { align: 'center' });
        y += 10;

        doc.setFontSize(10);
        doc.text("Date : " + analysisData.date, 20, y);
        y += 6;

        doc.text("Véhicule : " + (vehicleData.marque || '') + " " + (vehicleData.modele || '') + " " + (vehicleData.annee || ''), 20, y);
        y += 6;

        doc.text("Kilométrage : " + (vehicleData.kilometrage || '') + " km", 20, y);
        y += 10;

        analysisData.sections.forEach(function (pair) {
          var title = pair[0];
          var content = pair[1];

          if (y > 265) {
            doc.addPage();
            y = 20;
          }

          doc.setFont(undefined, 'bold');
          doc.setFontSize(11);
          var titleLines = doc.splitTextToSize(title, 170);
          doc.text(titleLines, 20, y);
          y += titleLines.length * 5 + 2;

          doc.setFont(undefined, 'normal');
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

        doc.save('analyse-experte-' + new Date().toISOString().slice(0, 10) + '.pdf');
        toast('PDF généré.', 'success');
      } catch (err) {
        console.error(err);
        toast('Erreur PDF : ' + err.message, 'error');
      }
    });

    on('#shareBtn', 'click', function () {
      if (!analysisData || !analysisData.sections || !analysisData.sections.length) {
        toast('Aucune analyse à partager.', 'warning');
        return;
      }

      var text = analysisData.sections.map(function (pair) {
        return pair[0] + '\n' + stripTags(pair[1]);
      }).join('\n\n');

      if (navigator.share) {
        navigator.share({
          title: 'Analyse Expert Auto',
          text: text
        }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          toast('Rapport copié.', 'success');
        }).catch(function () {
          toast('Copie impossible.', 'error');
        });
      } else {
        toast('Partage non supporté.', 'warning');
      }
    });

    /* =====================================================
     INIT FINALE
     ===================================================== */
    updateAdminStats();

    if (restoreSession()) {
      showApp();
    } else {
      showLogin();
    }

    toast('Application prête. Base locale chargée.', 'success');
  }
})();
