document.addEventListener('DOMContentLoaded', function () {
  // =====================================================
  // CONFIGURATION INITIALE & LIBRARIES EXTERNES
  // =====================================================
  
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const ADMIN_PASSWORD = 'Kevin83600';
  const MAX_DAILY_ANALYSES = 10;

  const STORAGE_KEYS = {
    SESSION: 'ar_expert_session_v4_final',
    USERS: 'ar_expert_users_v4_final',
    REQUESTS: 'ar_expert_requests_v4_final'
  };

  let currentUser = null;
  let vehicleData = {};
  let analysisData = {};
  let extractedText = '';
  let termesMobilises = new Set();
  let deferredPrompt = null;

  // Helpers DOM rapides
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // =====================================================
  // UTILITAIRES GÉNÉRAUX
  // =====================================================
  
  function todayKey() { 
    return new Date().toISOString().slice(0, 10); 
  }
  
  function uid() { 
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); 
  }
  
  function load(key, fallback) {
    try { 
      const raw = localStorage.getItem(key); 
      return raw ? JSON.parse(raw) : fallback; 
    } catch (e) { 
      console.warn("Erreur chargement stockage:", e);
      return fallback; 
    }
  }
  
  function save(key, value) { 
    try {
        localStorage.setItem(key, JSON.stringify(value)); 
    } catch(e) {
        console.error("Erreur sauvegarde stockage:", e);
    }
  }
  
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({ 
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
    }[m]));
  }
  
  function toast(message, type = 'info') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 4500);
  }
  
  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { 
        new Notification(title, { 
          body, 
          icon: 'icon-192.png',
          badge: 'icon-192.png'
        }); 
      } catch (e) {}
    }
  }
  
  function askNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
  
  async function sha256(text) {
    if (!window.crypto || !crypto.subtle) return 'plain:' + text;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  function term(...words) {
    words.forEach(w => termesMobilises.add(w));
    return '<span class="termes-juridiques">(' + words.join(', ') + ')</span>';
  }
  
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // =====================================================
  // GESTION AUTHENTIFICATION & UTILISATEURS
  // =====================================================
  
  function getUsers() { return load(STORAGE_KEYS.USERS, []); }
  function saveUsers(users) { save(STORAGE_KEYS.USERS, users); }
  function getRequests() { return load(STORAGE_KEYS.REQUESTS, []); }
  function saveRequests(requests) { save(STORAGE_KEYS.REQUESTS, requests); }

  function findUser(name, email) {
    const n = String(name || '').trim().toLowerCase();
    const e = String(email || '').trim().toLowerCase();
    return getUsers().find(u => u.name.toLowerCase() === n && u.email.toLowerCase() === e);
  }

  function upsertUser(user) {
    const users = getUsers();
    const idx = users.findIndex(u => u.name.toLowerCase() === user.name.toLowerCase() && u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push(user);
    saveUsers(users);
  }

  function setSession(user) { 
    currentUser = user; 
    save(STORAGE_KEYS.SESSION, user); 
  }
  
  function clearSession() { 
    currentUser = null; 
    localStorage.removeItem(STORAGE_KEYS.SESSION); 
  }

  function restoreSession() {
    const session = load(STORAGE_KEYS.SESSION, null);
    if (!session) return false;
    
    if (session.role === 'admin') { 
      currentUser = session; 
      return true; 
    }
    
    const fresh = findUser(session.name, session.email);
    if (fresh && fresh.status === 'approved') { 
      currentUser = fresh; 
      setSession(fresh); 
      return true; 
    }
    
    clearSession();
    return false;
  }

  function dailyInfo() {
    if (!currentUser) return { allowed: false, remaining: 0, used: 0, unlimited: false };
    if (currentUser.role === 'admin') return { allowed: true, remaining: Infinity, used: 0, unlimited: true };
    
    const user = findUser(currentUser.name, currentUser.email) || currentUser;
    const daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;
    
    return { 
      allowed: daily < MAX_DAILY_ANALYSES, 
      remaining: Math.max(0, MAX_DAILY_ANALYSES - daily), 
      used: daily, 
      unlimited: false 
    };
  }

  function incrementDaily() {
    if (!currentUser || currentUser.role === 'admin') return;
    
    const users = getUsers();
    const idx = users.findIndex(u => u.name.toLowerCase() === currentUser.name.toLowerCase() && u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (idx < 0) return;
    
    const user = users[idx];
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
    const el = $('#dailyCounter');
    if (!el) return;
    const info = dailyInfo();
    if (info.unlimited) {
      el.textContent = '👑 Admin — Analyses illimitées';
      el.style.background = 'rgba(40, 167, 69, 0.3)';
    } else {
      el.textContent = `📊 ${info.remaining}/${MAX_DAILY_ANALYSES} analyses restantes`;
      el.style.background = info.remaining <= 2 ? 'rgba(220, 53, 69, 0.3)' : 'rgba(255, 255, 255, 0.15)';
    }
  }

  function showApp() {
    $('#loginScreen').classList.add('hidden');
    $('#mainApp').classList.remove('hidden');
    $('#userBadge').textContent = currentUser.role === 'admin' ? '👑 Admin' : '👤 ' + currentUser.name;
    $('#adminPanelBtn').classList.toggle('hidden', currentUser.role !== 'admin');
    updateCounter();
    askNotificationPermission();
  }

  function showLogin() {
    $('#mainApp').classList.add('hidden');
    $('#adminPanel').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
  }

  function authMessage(msg, type) {
    const el = $('#authMsg');
    el.textContent = msg;
    el.className = 'auth-msg ' + type;
  }

  // =====================================================
  // ÉVÉNEMENTS UI CONNEXION
  // =====================================================
  
  $$('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.auth-tab').forEach(b => b.classList.remove('active'));
      $$('.auth-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.authTab + 'Pane').classList.add('active');
      authMessage('', '');
    });
  });

  $('#adminLoginBtn').addEventListener('click', async () => {
    const pwd = $('#adminPassword').value;
    if (!pwd) return authMessage('Mot de passe requis.', 'error');
    
    const inputHash = await sha256(pwd);
    const adminHash = await sha256(ADMIN_PASSWORD);
    
    if (inputHash === adminHash) {
      setSession({ id: 'admin', name: 'Administrateur', email: 'admin@local', role: 'admin', status: 'approved' });
      showApp();
      toast('Connexion réussie.', 'success');
    } else {
      authMessage('Mot de passe incorrect.', 'error');
    }
  });

  $('#requestBtn').addEventListener('click', () => {
    const name = $('#reqName').value.trim();
    const email = $('#reqEmail').value.trim();
    const reason = $('#reqReason').value.trim();
    
    if (!name || !email || !reason) return authMessage('Tous les champs sont requis.', 'error');
    
    const requests = getRequests();
    if (requests.find(r => r.email.toLowerCase() === email.toLowerCase() && r.status === 'pending')) {
      return authMessage('Une demande est déjà en attente.', 'warning');
    }
    
    const existingUser = findUser(name, email);
    if (existingUser && existingUser.status === 'approved') {
      return authMessage('Accès déjà accordé. Utilisez "Connexion tiers".', 'success');
    }

    requests.push({ 
      id: uid(), 
      name, 
      email, 
      reason, 
      status: 'pending', 
      date: new Date().toLocaleString('fr-FR') 
    });
    saveRequests(requests);
    
    askNotificationPermission();
    notify('Nouvelle demande d’accès', `${name} (${email})`);
    
    authMessage('Demande envoyée. En attente de validation admin.', 'success');
    $('#reqName').value = ''; 
    $('#reqEmail').value = ''; 
    $('#reqReason').value = '';
  });

  $('#thirdLoginBtn').addEventListener('click', () => {
    const name = $('#loginName').value.trim();
    const email = $('#loginEmail').value.trim();
    
    if (!name || !email) return authMessage('Nom et email requis.', 'error');
    
    const user = findUser(name, email);
    if (!user) {
      const req = getRequests().find(r => r.name.toLowerCase() === name.toLowerCase() && r.email.toLowerCase() === email.toLowerCase());
      if (req && req.status === 'pending') return authMessage('Votre demande est en cours de traitement.', 'warning');
      return authMessage('Aucun accès trouvé pour ces identifiants.', 'error');
    }
    
    if (user.status !== 'approved') return authMessage('Accès refusé ou révoqué.', 'error');
    
    setSession(user);
    showApp();
    toast('Connexion réussie.', 'success');
  });

  $('#logoutBtn').addEventListener('click', () => { 
    clearSession(); 
    showLogin(); 
  });

  // =====================================================
  // IMPORT PDF
  // =====================================================
  
  $('#pdfUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') return pdfStatus('Format non supporté (PDF uniquement).', 'error');
    
    pdfStatus('Extraction du texte...', 'success');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        fullText += tc.items.map(item => item.str).join(' ') + '\n\n';
      }
      
      extractedText = fullText;
      $('#textInput').value = fullText;
      pdfStatus(`PDF extrait avec succès (${pdf.numPages} pages).`, 'success');
    } catch (err) {
      pdfStatus('Erreur lors de l’extraction : ' + err.message, 'error');
    }
  });

  function pdfStatus(msg, type) {
    const el = $('#pdfStatus');
    el.textContent = msg;
    el.className = 'status ' + type;
  }

  // =====================================================
  // BASE DE DONNÉES TECHNIQUE EXPERTISE (MOTORISATION & VÉTUSTÉ)
  // Inclut : Défauts conceptuels, Problèmes d'étanchéité (Baie pare-brise), Usure normale
  // =====================================================
  
  const TECHNICAL_KNOWLEDGE_BASE = {
    "renault": {
      label: "Renault",
      engines: [
        { 
          code: "H5F / 1.2 TCe", 
          power: "120ch / 130ch", 
          years: "2012-2020", 
          models: ["Clio IV", "Captur", "Mégane III", "Kadjar"], 
          symptoms: ["consommation huile", "casse moteur", "segmentation", "fumée bleue", "perte compression", "huile manquante"], 
          severity: "critique", 
          note: "Défaut de conception piston/cylindre bien documenté. Risque élevé de casse.",
          wear_factor: 0.8 // Forte probabilité d'être un défaut même avec km élevés
        },
        { 
          code: "K9K / 1.5 dCi", 
          power: "90ch / 110ch", 
          years: "2009-2018", 
          models: ["Clio", "Mégane", "Scénic", "Duster", "Sandero", "Logan", "Trafic II", "Master"], 
          symptoms: ["casse bielle", "claquement moteur", "usure coussinets", "pompe à huile défaillante", "bruit métallique froid"], 
          severity: "critique", 
          note: "Risque de casse moteur brutale sans préavis. Problème chronique.",
          wear_factor: 0.9
        },
        { 
          code: "EDC6 / Double Embrayage", 
          power: "N/A", 
          years: "2012-2018", 
          models: ["Clio IV", "Captur", "Mégane III"], 
          symptoms: ["à-coups boîte", "blocage rapport", "perte traction", "voyant boîte", "odeur brûlé embrayage", "vibrations démarrage"], 
          severity: "critique", 
          note: "Module mecatronique fragile. Coût de réparation très élevé (>2000€).",
          wear_factor: 0.7
        },
        { 
          code: "Trafic II / Baie Pare-brise", 
          power: "N/A", 
          years: "2014-2023", 
          models: ["Trafic II", "Espace V", "Twizy"], 
          symptoms: ["infiltration eau habitacle", "court-circuit calculateurs", "panne électronique mystérieuse", "moisiure tapis conducteur/passager", "voyants allumés aléatoirement", "erreur ABS/ESP"], 
          severity: "critique", 
          note: "Défaut connu d'étanchéité de la baie de pare-brise (joint collé mal posé ou perçage usine). L'eau s'infiltre vers les boîtiers fusibles/calculateurs sous le tableau de bord ou dans le compartiment moteur.",
          wear_factor: 0.95 // Très peu lié à l'usure, c'est un défaut de montage/conception
        }
      ]
    },
    "peugeot": {
      label: "Peugeot",
      engines: [
        { 
          code: "EB2 / 1.2 PureTech", 
          power: "110ch / 130ch", 
          years: "2012-2022", 
          models: ["208", "2008", "308", "3008", "5008", "Partner", "Rifter", "Boxer"], 
          symptoms: ["courroie distribution dans l'huile", "colmatage crépine pompe", "casse moteur", "bruit cliquetis froid", "voyant pression huile", "désagrégation courroie"], 
          severity: "critique", 
          note: "Courroie humide se désagrège et bouche la pompe à huile. Casse moteur assurée si ignoré.",
          wear_factor: 0.85
        },
        { 
          code: "DV6 / 1.6 HDI BlueHDi", 
          power: "92ch / 115ch / 120ch", 
          years: "2009-2018", 
          models: ["308", "3008", "508", "Boxer", "Expert"], 
          symptoms: ["encrassement EGR", "colmatage FAP", "turbo HS", "surconsommation huile", "puissance réduite", "mode dégradé"], 
          severity: "moyen", 
          note: "Problèmes liés à l'usage urbain intensif. Entretien coûteux.",
          wear_factor: 0.5 // Lié aussi à l'entretien/usure
        },
        { 
          code: "EAT6 / Aisin", 
          power: "N/A", 
          years: "2010-2017", 
          models: ["308", "508", "3008", "RCZ"], 
          symptoms: ["à-coups démarrage", "vibrations ralenti", "passage rapports saccadé", "convertisseur couple", "bruit claquement"], 
          severity: "critique", 
          note: "Défaut convertisseur hydraulique. Réparation chère.",
          wear_factor: 0.6
        },
        { 
          code: "AdBlue SCR", 
          power: "N/A", 
          years: "2014-2020", 
          models: ["308", "3008", "508", "208 GT"], 
          symptoms: ["cristallisation injecteur", "pompe AdBlue HS", "impossibilité redémarrer", "voyant anti-pollution", "réservoir vide faux"], 
          severity: "moyen", 
          note: "Système dépollution sensible aux trajets courts.",
          wear_factor: 0.4
        }
      ]
    },
    "citroen": {
      label: "Citroën",
      engines: [
        { 
          code: "EB2 / 1.2 PureTech", 
          power: "110ch / 130ch", 
          years: "2012-2022", 
          models: ["C3", "C4", "C4 Picasso", "Grand C4 Picasso", "C5 Aircross", "Jumper"], 
          symptoms: ["courroie distribution", "casse moteur", "fumée", "bruit métallique", "huile dans eau"], 
          severity: "critique", 
          note: "Identique au groupe PSA/Stellantis. Danger mécanique majeur.",
          wear_factor: 0.85
        },
        { 
          code: "DV6 / 1.6 HDI", 
          power: "92ch / 115ch", 
          years: "2009-2016", 
          models: ["C3", "C4", "Berlingo", "Jumpy"], 
          symptoms: ["EGR encrassé", "FAP colmaté", "turbo bruit", "surchauffe légère"], 
          severity: "moyen", 
          note: "Maintenance lourde requise. Usure prématurée.",
          wear_factor: 0.5
        },
        { 
          code: "EAT6/EAT8", 
          power: "N/A", 
          years: "2014-2019", 
          models: ["C4 Picasso", "Grand C4 Picasso", "C5 Aircross"], 
          symptoms: ["à-coups", "perte propulsion", "voyant boîte", "blocage vitesse"], 
          severity: "critique", 
          note: "Boîte automatique robotisée/hydraulique. Fiabilité contestée.",
          wear_factor: 0.6
        }
      ]
    },
    "volkswagen": {
      label: "Volkswagen",
      engines: [
        { 
          code: "EA189 / TDI Dieselgate", 
          power: "105ch / 140ch / 170ch", 
          years: "2009-2015", 
          models: ["Golf VI/VII", "Passat B7/B8", "Tiguan I/II", "Polo", "Touran"], 
          symptoms: ["logiciel invalidation", "émission NOx élevée", "amende administrative", "retour concession obligatoire", "performances réduites après maj"], 
          severity: "critique", 
          note: "Tricherie aux tests polluants. Preuve judiciaire solide (CJUE).",
          wear_factor: 1.0 // Défaut pur, aucune usure impliquée
        },
        { 
          code: "DQ200 / DSG7", 
          power: "N/A", 
          years: "2008-2016", 
          models: ["Golf", "Polo", "Touran", "Scirocco", "Up!"], 
          symptoms: ["mécatronique HS", "embrayage patine", "à-coups violents", "bruit claquement boîte", "vitesse bloquée"], 
          severity: "critique", 
          note: "Double embrayage à sec fragile. Défaut de conception reconnu mondialement.",
          wear_factor: 0.7
        },
        { 
          code: "EA288 / 2.0 TDI", 
          power: "150ch / 184ch", 
          years: "2012-2018", 
          models: ["Golf VII", "Passat B8", "Tiguan II", "Sharan"], 
          symptoms: ["consommation huile", "injecteurs piezo", "vanne EGR bloquée", "bruit injection"], 
          severity: "moyen", 
          note: "Fiabilité correcte mais entretien coûteux et complexe.",
          wear_factor: 0.5
        }
      ]
    },
    "audi": {
      label: "Audi",
      engines: [
        { 
          code: "EA189 / TDI", 
          power: "120ch / 140ch / 170ch", 
          years: "2009-2015", 
          models: ["A3", "A4", "A6", "Q5", "TT"], 
          symptoms: ["dieselgate", "logiciel", "NOx", "retour usine"], 
          severity: "critique", 
          note: "Groupe VAG. Même problème que VW.",
          wear_factor: 1.0
        },
        { 
          code: "DQ200 / S-Tronic", 
          power: "N/A", 
          years: "2008-2016", 
          models: ["A3", "A4 Avant", "Q3", "TT"], 
          symptoms: ["mécatronique", "patinage", "bruits boîte", "à-coups"], 
          severity: "critique", 
          note: "Idem VW Golf. Fragilité extrême.",
          wear_factor: 0.7
        },
        { 
          code: "EA888 Gen3 / TFSI", 
          power: "190ch / 245ch", 
          years: "2012-2018", 
          models: ["A4", "A5", "A6", "Q5"], 
          symptoms: ["consommation huile excessive", "segments pistons", "casse moteur rare", "fumée bleue"], 
          severity: "moyen", 
          note: "Surveillance niveau huile indispensable. Risque long terme.",
          wear_factor: 0.6
        }
      ]
    },
    "bmw": {
      label: "BMW",
      engines: [
        { 
          code: "N47 / 2.0d", 
          power: "163ch / 184ch", 
          years: "2007-2015", 
          models: ["Série 1", "Série 3", "Série 5", "X1", "X3", "Mini Cooper SD"], 
          symptoms: ["chaîne distribution côté boîte", "bruit crécelle froid", "casse chaîne", "sauts de dents", "calage moteur"], 
          severity: "critique", 
          note: "Chaîne située derrière le volant moteur, réparation très coûteuse (>3000€). Rappel historique.",
          wear_factor: 0.8
        },
        { 
          code: "B47 / N47 Update", 
          power: "150ch / 190ch", 
          years: "2015-2020", 
          models: ["Série 1 F20/F40", "Série 3 F30/G20", "X1", "X3"], 
          symptoms: ["tensionneur chaîne", "bruit mécanique", "vibration ralenti"], 
          severity: "moyen", 
          note: "Amélioré mais toujours sensible. Surveillance nécessaire.",
          wear_factor: 0.6
        },
        { 
          code: "ZF 8HP", 
          power: "N/A", 
          years: "2012-2019", 
          models: ["Série 3", "Série 5", "X3", "X5", "Range Rover Evoque"], 
          symptoms: ["à-coups bas régime", "convertisseur couple", "software box", "retard passage"], 
          severity: "moyen", 
          note: "Boîte robuste mais logiciels parfois capricieux. Mise à jour souvent nécessaire.",
          wear_factor: 0.4
        },
        { 
          code: "EGR / Admission", 
          power: "N/A", 
          years: "2010-2018", 
          models: ["Série 3", "Série 5", "X3", "X5"], 
          symptoms: ["risque incendie collecteur", "fuite liquide refroidissement sur EGR", "odeur plastique brûlé"], 
          severity: "critique", 
          note: "Rappel sécurité majeur. Danger immédiat.",
          wear_factor: 0.9
        }
      ]
    },
    "mercedes-benz": {
      label: "Mercedes-Benz",
      engines: [
        { 
          code: "OM651 / 2.1 CDI", 
          power: "136ch / 170ch / 204ch", 
          years: "2009-2018", 
          models: ["Classe A", "Classe B", "CLA", "GLA", "Classe C", "Classe E"], 
          symptoms: ["injecteurs piézo HS", "casse moteur", "consommation huile", "bruit injection fort", "ratés allumage"], 
          severity: "critique", 
          note: "Injecteurs sensibles à la qualité du gasoil. Remplacement cher.",
          wear_factor: 0.7
        },
        { 
          code: "7G-Tronic Plus", 
          power: "N/A", 
          years: "2009-2016", 
          models: ["Classe C", "Classe E", "GLK", "ML"], 
          symptoms: ["à-coups", "perte propulsion", "convertisseur", "calculateur boîte", "bloque P"], 
          severity: "critique", 
          note: "Automatique classique mais fiable seulement si entretenue rigoureusement.",
          wear_factor: 0.5
        },
        { 
          code: "AdBlue / SCR", 
          power: "N/A", 
          years: "2015-2020", 
          models: ["Classe C", "Classe E", "GLC", "GLE"], 
          symptoms: ["pompe cristallisée", "capteur NOx", "immobilisation", "voyant orange permanent"], 
          severity: "moyen", 
          note: "Coûteux hors garantie. Blocage véhicule fréquent.",
          wear_factor: 0.4
        }
      ]
    },
    "ford": {
      label: "Ford",
      engines: [
        { 
          code: "DPS6 / PowerShift", 
          power: "N/A", 
          years: "2011-2016", 
          models: ["Focus Mk3", "Fiesta Mk7", "B-Max", "Kuga", "Mondeo"], 
          symptoms: ["vibrations moteur", "à-coups boîte", "patinage embrayage", "bruit métal", "odeur brûlé", "cliquetis"], 
          severity: "critique", 
          note: "Boîte double embrayage à sec désignée comme défaillante mondialement. Class actions massives.",
          wear_factor: 0.8
        },
        { 
          code: "Ecoboost 1.0L", 
          power: "100ch / 125ch / 140ch", 
          years: "2012-2018", 
          models: ["Focus", "Fiesta", "Kuga", "Mondeo", "C-Max"], 
          symptoms: ["joint culasse fissuré", "refroidissement insuffisant", "surchauffe", "eau dans huile", "fumée blanche"], 
          severity: "critique", 
          note: "Bloc aluminium sensible à la chaleur. Défaut de conception thermique.",
          wear_factor: 0.9
        },
        { 
          code: "Duratorq 2.0 TDCi", 
          power: "140ch / 163ch", 
          years: "2009-2015", 
          models: ["Focus", "Mondeo", "Kuga", "Transit"], 
          symptoms: ["injecteurs", "volant moteur bimasse", "bruit transmission", "vibrations pédales"], 
          severity: "moyen", 
          note: "Volant moteur lourd sujet à usure prématurée.",
          wear_factor: 0.5
        }
      ]
    },
    "toyota": {
      label: "Toyota",
      engines: [
        { 
          code: "Takata Airbags", 
          power: "N/A", 
          years: "2009-2020", 
          models: ["Yaris", "Auris", "Avensis", "RAV4", "C-HR", "Corolla"], 
          symptoms: ["airbag gonflable", "projection métal", "rappel sécurité vital", "voyant airbag"], 
          severity: "critique", 
          note: "Danger mortel immédiat. Rappel mondial.",
          wear_factor: 1.0
        },
        { 
          code: "Throttle Pedal", 
          power: "N/A", 
          years: "2009-2011", 
          models: ["Yaris", "Corolla", "Camry", "Prius"], 
          symptoms: ["pédale coince", "accélération involontaire", "difficulté retour pédale"], 
          severity: "critique", 
          note: "Rappel mondial historique. Sécurité active compromise.",
          wear_factor: 1.0
        },
        { 
          code: "Hybrid Synergy Drive", 
          power: "N/A", 
          years: "2012-2018", 
          models: ["Prius", "Yaris Hybrid", "C-HR", "Auris Hybrid"], 
          symptoms: ["onduleur inversion", "batterie HV faible capacité", "ventilation batterie obstruée", "perte autonomie"], 
          severity: "moyen", 
          note: "Fiabilité globale bonne, points faibles électroniques/batterie.",
          wear_factor: 0.3
        }
      ]
    },
    "fiat": {
      label: "Fiat",
      engines: [
        { 
          code: "Dualogic", 
          power: "N/A", 
          years: "2010-2017", 
          models: ["500", "Panda", "Punto", "Bravo", "Freemont"], 
          symptoms: ["robot boîte HS", "pas de vitesse", "cliquetis actuateur", "bloqué en neutre", "erreur embrayage"], 
          severity: "critique", 
          note: "Embrayage piloté très fragile. Panne sèche fréquente.",
          wear_factor: 0.8
        },
        { 
          code: "MultiJet 1.3", 
          power: "75ch / 95ch", 
          years: "2009-2016", 
          models: ["Punto", "Bravo", "Doblò", "500L", "Panda"], 
          symptoms: ["chaîne distribution", "turbo bruit", "consommation huile", "claquement"], 
          severity: "moyen", 
          note: "Petit diesel nerveux mais fragile mécaniquement.",
          wear_factor: 0.6
        },
        { 
          code: "DDCT / TwinAir", 
          power: "N/A", 
          years: "2012-2018", 
          models: ["500X", "Tipo", "Panda", "500"], 
          symptoms: ["embrayage chaud", "patinage", "boîte lente", "vibrations"], 
          severity: "moyen", 
          note: "Technologie récente perfectible.",
          wear_factor: 0.5
        }
      ]
    },
    "nissan": {
      label: "Nissan",
      engines: [
        { 
          code: "K9M / 1.5 dCi (Renault)", 
          power: "90ch / 110ch", 
          years: "2012-2018", 
          models: ["Qashqai J11", "X-Trail T32", "Juke", "Note"], 
          symptoms: ["casse bielle", "coussinets", "pompe huile", "bruit métallique"], 
          severity: "critique", 
          note: "Partenariat Renault-Nissan, mêmes défauts que K9K.",
          wear_factor: 0.9
        },
        { 
          code: "CVT X-Tronic", 
          power: "N/A", 
          years: "2014-2020", 
          models: ["Qashqai", "X-Trail", "Micra", "Leaf"], 
          symptoms: ["à-coups", "glissement courroie", "bruit whining", "surchauffe boîte", "perte puissance progressive"], 
          severity: "critique", 
          note: "Variateur continu sensible au couple élevé. Durée de vie limitée.",
          wear_factor: 0.6
        }
      ]
    },
    "opel": {
      label: "Opel",
      engines: [
        { 
          code: "Z14NET / 1.4 Turbo", 
          power: "120ch / 140ch", 
          years: "2012-2018", 
          models: ["Corsa D/E", "Astra J/K", "Mokka", "Insignia"], 
          symptoms: ["consommation huile", "segments pistons", "casse moteur", "turbo fuite", "fumée"], 
          severity: "critique", 
          note: "Moteur essence petit cylindré turbocompressé fragile.",
          wear_factor: 0.8
        },
        { 
          code: "Cooling System", 
          power: "N/A", 
          years: "2009-2016", 
          models: ["Astra H/J", "Zafira B/C", "Vectra"], 
          symptoms: ["fuite radiateur chauffage", "surchauffe", "risque incendie (Zafira B)", "liquide blanc fumée"], 
          severity: "critique", 
          note: "Défaut de conception circuit de refroidissement habitacle. Rappel massif.",
          wear_factor: 0.9
        }
      ]
    },
    "hyundai": {
      label: "Hyundai",
      engines: [
        { 
          code: "D4FD / 1.7 CRDi", 
          power: "115ch / 136ch", 
          years: "2011-2017", 
          models: ["i30", "Tucson", "ix35", "Santa Fe", "Elantra"], 
          symptoms: ["injecteurs", "consommation huile", "bruit injection", "ratés"], 
          severity: "moyen", 
          note: "Diesel moderne complexe. Sensible à la qualité carburant.",
          wear_factor: 0.5
        },
        { 
          code: "DCT 7 Speed", 
          power: "N/A", 
          years: "2015-2020", 
          models: ["i20", "i30", "Tucson", "Kona"], 
          symptoms: ["à-coups", "patinage basse vitesse", "bruit boîte", "vibrations"], 
          severity: "moyen", 
          note: "Double embrayage à sec. Comportement urbain médiocre.",
          wear_factor: 0.4
        }
      ]
    },
    "kia": {
      label: "Kia",
      engines: [
        { 
          code: "D4FD / 1.7 CRDi", 
          power: "115ch / 136ch", 
          years: "2011-2017", 
          models: ["Ceed", "Sportage", "Niro", "Picanto"], 
          symptoms: ["identique Hyundai", "injecteurs", "huile", "bruit"], 
          severity: "moyen", 
          note: "Plateforme commune Hyundai.",
          wear_factor: 0.5
        },
        { 
          code: "Catalytic Converter", 
          power: "N/A", 
          years: "2012-2018", 
          models: ["Ceed", "Sportage", "Picanto", "Rio"], 
          symptoms: ["risque incendie sous caisse", "température excessive catalyseur", "odeur brûlé", "fumée noire"], 
          severity: "critique", 
          note: "Rappel sécurité spécifique. Danger incendie.",
          wear_factor: 0.9
        }
      ]
    },
    "volvo": {
      label: "Volvo",
      engines: [
        { 
          code: "Drive-E D3/D4/T3/T4", 
          power: "150ch - 245ch", 
          years: "2012-2018", 
          models: ["V40", "V60", "XC60", "S60", "XC90"], 
          symptoms: ["consommation huile", "segments", "casse moteur", "turbo", "fumée"], 
          severity: "critique", 
          note: "Essence suralimenté direct injection fragile. Problème chronique.",
          wear_factor: 0.8
        },
        { 
          code: "AdBlue", 
          power: "N/A", 
          years: "2014-2020", 
          models: ["XC90", "V90", "S90", "XC60"], 
          symptoms: ["pompe", "cristallisation", "blocage démarrage"], 
          severity: "moyen", 
          note: "Système SCR standard.",
          wear_factor: 0.4
        }
      ]
    },
    "seat": {
      label: "SEAT",
      engines: [
        { 
          code: "EA189 TDI", 
          power: "105ch / 140ch", 
          years: "2009-2015", 
          models: ["Ibiza", "Leon", "Altea", "Toledo"], 
          symptoms: ["dieselgate", "logiciel", "NOx"], 
          severity: "critique", 
          note: "Groupe VAG.",
          wear_factor: 1.0
        },
        { 
          code: "DSG7 DQ200", 
          power: "N/A", 
          years: "2012-2018", 
          models: ["Leon", "Ateca", "Toledo", "Ibiza"], 
          symptoms: ["mécatronique", "à-coups", "patinage"], 
          severity: "critique", 
          note: "Groupe VAG. Idem Audi/VW.",
          wear_factor: 0.7
        }
      ]
    },
    "skoda": {
      label: "Škoda",
      engines: [
        { 
          code: "EA189 TDI", 
          power: "105ch / 140ch", 
          years: "2009-2015", 
          models: ["Octavia", "Superb", "Yeti", "Fabia"], 
          symptoms: ["dieselgate"], 
          severity: "critique", 
          note: "Groupe VAG.",
          wear_factor: 1.0
        },
        { 
          code: "TSI EA111/EA888", 
          power: "125ch / 180ch", 
          years: "2010-2017", 
          models: ["Octavia", "Superb", "Fabia", "Rapid"], 
          symptoms: ["consommation huile", "chaîne distribution (EA111)", "carbonisation soupapes", "bruit"], 
          severity: "moyen", 
          note: "Injection directe essence. Nettoyage régulier nécessaire.",
          wear_factor: 0.6
        }
      ]
    },
    "jeep": {
      label: "Jeep",
      engines: [
        { 
          code: "DDCT Dry", 
          power: "N/A", 
          years: "2014-2020", 
          models: ["Renegade", "Compass", "Cherokee"], 
          symptoms: ["surchauffe embrayage", "à-coups", "bruit boîte", "mode limp", "odeur brûlé"], 
          severity: "critique", 
          note: "Boîte double embrayage à sec peu adaptée au tout-terrain/ville dense.",
          wear_factor: 0.7
        },
        { 
          code: "Multijet 1.6", 
          power: "120ch / 140ch", 
          years: "2015-2020", 
          models: ["Renegade", "Compass"], 
          symptoms: ["injecteurs", "turbo", "huile"], 
          severity: "moyen", 
          note: "Base Fiat/Stellantis.",
          wear_factor: 0.5
        }
      ]
    },
    "dacia": {
      label: "Dacia",
      engines: [
        { 
          code: "K9K 1.5 dCi", 
          power: "90ch / 110ch", 
          years: "2012-2018", 
          models: ["Duster", "Sandero", "Logan", "Lodgy", "Spring"], 
          symptoms: ["casse bielle", "coussinets", "pompe huile", "bruit"], 
          severity: "critique", 
          note: "Base Renault. Mêmes risques.",
          wear_factor: 0.9
        },
        { 
          code: "EDC6", 
          power: "N/A", 
          years: "2013-2019", 
          models: ["Duster", "Sandero Stepway", "Logan"], 
          symptoms: ["à-coups", "blocage", "patinage"], 
          severity: "moyen", 
          note: "Base Renault.",
          wear_factor: 0.6
        }
      ]
    },
    "mini": {
      label: "MINI",
      engines: [
        { 
          code: "Prince N18/N20", 
          power: "184ch / 211ch", 
          years: "2010-2017", 
          models: ["Cooper S", "Countryman", "Clubman", "Paceman"], 
          symptoms: ["chaîne distribution", "consommation huile", "segments", "turbo", "water pump", "bruit crécelle"], 
          severity: "critique", 
          note: "Conception BMW/PSA conjointe, très problématique. Rappel historique.",
          wear_factor: 0.8
        },
        { 
          code: "Getrag DCT", 
          power: "N/A", 
          years: "2014-2020", 
          models: ["Cooper", "Clubman", "Countryman"], 
          symptoms: ["à-coups", "bruit boîte", "patinage"], 
          severity: "moyen", 
          note: "Boîte robotisée double embrayage.",
          wear_factor: 0.5
        }
      ]
    }
  };

  // =====================================================
  // LOGIQUE DE CORRELATION TECHNIQUE AVANCÉE (AVEC USURE)
  // =====================================================
  
  function matchTechnicalDefects(marque, modele, annee, kilometrage, texteFaits) {
    const brandKey = Object.keys(TECHNICAL_KNOWLEDGE_BASE).find(k => k.includes(normalize(marque)) || normalize(marque).includes(k));
    if (!brandKey) return [];

    const db = TECHNICAL_KNOWLEDGE_BASE[brandKey];
    const yearNum = parseInt(annee) || 0;
    const kmNum = parseInt(String(kilometrage).replace(/\D/g,'')) || 0;
    const textLower = normalize(texteFaits);
    const matches = [];

    db.engines.forEach(engine => {
      // 1. Vérification Année
      const yearMatch = checkYearRange(engine.years, yearNum);
      
      // 2. Vérification Modèle (si fourni)
      const modelMatch = engine.models.some(m => {
        const mNorm = normalize(m);
        const modNorm = normalize(modele);
        return !modNorm || mNorm.includes(modNorm) || modNorm.includes(mNorm);
      });

      // 3. Vérification Symptômes dans le texte utilisateur
      let symptomScore = 0;
      let matchedSymptoms = [];
      
      engine.symptoms.forEach(symptom => {
        const symNorm = normalize(symptom);
        if (textLower.includes(symNorm) || symNorm.split(' ').every(word => word.length > 3 && textLower.includes(word))) {
          symptomScore++;
          matchedSymptoms.push(symptom);
        }
      });

      // Si année OK, modèle OK (ou non précisé) et au moins un symptôme clé détecté
      if (yearMatch && modelMatch && symptomScore > 0) {
        
        // CALCUL DU FACTEUR DE VÉTUSTÉ / USURE NORMALE
        // Si le véhicule a beaucoup de km et que le facteur d'usure est bas (< 0.5), 
        // on réduit la confiance en disant que ça pourrait être de l'usure normale.
        let confidenceLevel = "Haute";
        let wearWarning = "";
        
        if (kmNum > 150000 && engine.wear_factor < 0.6) {
           confidenceLevel = "Moyenne/Basse";
           wearWarning = "Attention : Avec ce kilométrage élevé, une partie des symptômes peut relever de l'usure normale plutôt que d'un vice caché.";
        } else if (kmNum > 100000 && engine.wear_factor < 0.8) {
           confidenceLevel = "Moyenne";
           wearWarning = "Le kilométrage suggère une usure possible, mais la nature du défaut reste suspecte.";
        } else {
           confidenceLevel = "Haute";
           wearWarning = "Le kilométrage est compatible avec un défaut de conception/vice caché.";
        }

        matches.push({
          constructeur: db.label,
          moteur: engine.code,
          puissance: engine.power,
          periode: engine.years,
          modeles_concernes: engine.models,
          severite: engine.severity,
          description_defaut: engine.note,
          symptomes_detectes: matchedSymptoms,
          score_correlation: symptomScore,
          confidence_niveau: confidenceLevel,
          alert_usure: wearWarning
        });
      }
    });

    // Tri par pertinence (score décroissant) puis par sévérité
    return matches.sort((a, b) => {
       if (b.score_correlation !== a.score_correlation) return b.score_correlation - a.score_correlation;
       return b.severite === 'critique' ? 1 : -1;
    });
  }

  function checkYearRange(rangeStr, targetYear) {
    if (!targetYear) return true; 
    const parts = rangeStr.split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2) {
      return targetYear >= parts[0] && targetYear <= parts[1];
    }
    return true;
  }

  // =====================================================
  // ANALYSE PRINCIPALE
  // =====================================================
  
  $('#analyzeBtn').addEventListener('click', () => {
    if (!currentUser) return toast('Connectez-vous.', 'error');
    const info = dailyInfo();
    if (!info.allowed) return toast(`Limite de ${MAX_DAILY_ANALYSES} atteinte.`, 'warning');

    const text = $('#textInput').value.trim() || extractedText.trim();
    const context = $('#contextInfo').value.trim();
    const objective = $('#objectiveInfo').value.trim();

    vehicleData = {
      marque: $('#vehicleBrand').value.trim(),
      modele: $('#vehicleModel').value.trim(),
      annee: $('#vehicleYear').value.trim(),
      kilometrage: $('#vehicleKilometrage').value.trim(),
      vin: $('#vehicleVin').value.trim()
    };

    if (!text) return toast('Saisissez des faits ou importez un PDF.', 'warning');

    termesMobilises = new Set();
    const btn = $('#analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analyse experte...';

    setTimeout(() => {
      try {
        runAnalysis(text, context, objective);
        incrementDaily();
        toast('Analyse générée.', 'success');
      } catch (err) {
        console.error(err);
        toast('Erreur : ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔍 Lancer l’analyse experte';
      }
    }, 1200);
  });

  function runAnalysis(text, context, objective) {
    const allText = (text + ' ' + context).toLowerCase();
    
    // Détection contexte juridique
    const flags = {
      vehicle: allText.includes('véhicule') || allText.includes('voiture') || !!vehicleData.marque,
      defect: ['défaut', 'panne', 'problème', 'dysfonctionnement', 'casse', 'fuite', 'bruit', 'vibration', 'perte puissance'].some(w => allText.includes(w)),
      professional: ['professionnel', 'garage', 'concession', 'revendeur', 'automobile'].some(w => allText.includes(w)),
      privateSeller: ['particulier', 'entre particuliers', 'de particulier'].some(w => allText.includes(w)),
      invoice: allText.includes('facture'),
      repair: allText.includes('réparation') || allText.includes('ordre de réparation'),
      controlTech: allText.includes('contrôle technique'),
      warranty: allText.includes('garantie'),
      safety: ['sécurité', 'frein', 'airbag', 'direction', 'incendie', 'danger'].some(w => allText.includes(w)),
      waterLeak: ['eau', 'humidité', 'infiltration', 'baie', 'pare brise', 'moisiure', 'court circuit'].some(w => allText.includes(w))
    };

    // CORRELATION TECHNIQUE GRANULAIRE AVEC KM
    const technicalMatches = matchTechnicalDefects(vehicleData.marque, vehicleData.modele, vehicleData.annee, vehicleData.kilometrage, text);

    analysisData = {
      date: new Date().toLocaleString('fr-FR'),
      vehicleData,
      text: text.slice(0, 1500),
      context,
      objective,
      technicalMatches,
      sections: []
    };

    const sections = [];

    sections.push(['I. ÉLÉMENTS FACTUELS ET IDENTIFICATION VÉHICULE', sectionFacts(text, context)]);
    sections.push(['II. DIAGNOSTIC TECHNIQUE ASSOCIÉ AUX DÉFAUTS CONNUS (ET ANALYSE USURE)', sectionDiagnosticTechnique(technicalMatches, flags, vehicleData)]);
    sections.push(['III. QUALIFICATION JURIDIQUE PROVISOIRE', sectionQualification(flags, technicalMatches)]);
    sections.push(['IV. RISQUES ET RESPONSABILITÉS SELON LA QUALITÉ DU VENDEUR', sectionRisques(flags, technicalMatches)]);
    sections.push(['V. ANALYSE DES TROIS CRITÈRES CUMULATIFS (ADAPTÉE À L'USURE)', sectionCritères(flags, technicalMatches, vehicleData)]);
    sections.push(['VI. RÉGIMES DE GARANTIE POTENTIELLEMENT INVOCABLES', sectionGaranties(flags)]);
    sections.push(['VII. ANALYSE DOCUMENTAIRE ET PROBATOIRE', sectionDocuments(flags)]);
    sections.push([sections.length + 1 + '. JURISPRUDENCE ET DOCTRINE DE RÉFÉRENCE', sectionJurisprudence()]);
    sections.push([sections.length + 1 + '. ÉVALUATION DU PRÉJUDICE', sectionPrejudice(flags)]);
    sections.push([sections.length + 1 + '. STRATÉGIE CONTENTIEUSE RECOMMANDÉE', sectionStrategie(flags, technicalMatches, objective)]);
    sections.push([sections.length + 1 + '. ÉLÉMENTS À VÉRIFIER / COMPLÉTER', sectionVerification(technicalMatches)]);
    sections.push([sections.length + 1 + '. VOIES D’ACTION POSSIBLES', sectionVoies(flags, technicalMatches)]);
    sections.push([sections.length + 1 + '. CONCLUSION PRUDENTE', sectionConclusion(objective, technicalMatches)]);
    sections.push([sections.length + 1 + '. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ', sectionLexique()]);

    analysisData.sections = sections;
    renderAnalysis();
  }

  function renderAnalysis() {
    let html = '';
    analysisData.sections.forEach(([title, content]) => {
      html += `<h3>${title}</h3>${content}`;
    });
    html += `<div class="verification-needed"><strong>Rappel méthodologique :</strong> cette analyse croise vos dires avec une base de connaissances techniques intégrant la notion d'usure. Elle reste une aide à la rédaction.</div>`;
    $('#analysisResult').innerHTML = html;
    $('#analysisSection').classList.remove('hidden');
    $('#analysisSection').scrollIntoView({ behavior: 'smooth' });
  }

  // =====================================================
  // SECTIONS DE RAPPORT (CONTENU EXPERT)
  // =====================================================
  
  function sectionFacts(text, context) {
    return `
      <p><strong>Objet :</strong> recensement des éléments fournis ${term('éléments factuels')}.</p>
      <h4>A. Véhicule déclaré</h4>
      <ul>
        <li><strong>Marque :</strong> ${escapeHtml(vehicleData.marque || 'non précisée')}</li>
        <li><strong>Modèle :</strong> ${escapeHtml(vehicleData.modele || 'non précisé')}</li>
        <li><strong>Année :</strong> ${escapeHtml(vehicleData.annee || 'non précisée')}</li>
        <li><strong>Kilométrage :</strong> ${escapeHtml(vehicleData.kilometrage || 'non précisé')} ${term('kilométrage', 'usure normale')}</li>
      </ul>
      <h4>B. Faits rapportés</h4>
      <p>${escapeHtml(text.slice(0, 1000))}${text.length > 1000 ? '...' : ''}</p>
      ${context ? `<h4>C. Contexte</h4><p>${escapeHtml(context.slice(0, 800))}</p>` : ''}
      <div class="certainty-low"><strong>Limite :</strong> faits non vérifiés par expertise contradictoire ${term('faits non vérifiés')}.</div>
    `;
  }

  function sectionDiagnosticTechnique(matches, flags, vData) {
    if (!matches.length) {
      return `
        <p><strong>Objet :</strong> recherche de correspondance avec des défauts conceptuels connus ${term('défauts conceptuels', 'problèmes récurrents')}.</p>
        <div class="verification-needed">
          Aucun défaut technique spécifique identifié dans notre base de données pour cette combinaison exacte (Marque/Modèle/Année/Symptômes). 
          Cela ne signifie pas l'absence de défaut, mais qu'il n'est pas "notoire" ou largement documenté publiquement.
        </div>
        <p>Une expertise individuelle reste nécessaire pour caractériser la panne ${term('expertise individuelle')}.</p>
      `;
    }

    let html = `<p><strong>Objet :</strong> identification de potentiels défauts de série ou vices cachés notoires ${term('vice caché notoire', 'défaut de série')}.</p>`;
    html += `<p>Nos algorithmes ont croisé vos descriptions avec une base de données technique automobile intégrant les facteurs d'usure. Voici les correspondances les plus probables :</p>`;

    matches.forEach((m, index) => {
      const cls = m.severite === 'critique' ? 'rappel-critical' : 'rappel-info';
      const confColor = m.confidence_niveau === 'Haute' ? '#10b981' : (m.confidence_niveau === 'Moyenne' ? '#f59e0b' : '#ef4444');
      
      html += `
        <div class="${cls}">
          <h4>${index + 1}. ${escapeHtml(m.moteur)} (${escapeHtml(m.puissance)}) - Période : ${escapeHtml(m.periode)}</h4>
          <p><strong>Constructeur :</strong> ${escapeHtml(m.constructeur)}</p>
          <p><strong>Modèles typiques :</strong> ${escapeHtml(m.modeles_concernes.join(', '))}</p>
          <p><strong>Symptômes détectés chez vous :</strong> ${escapeHtml(m.symptomes_detectes.join(', '))}</p>
          <p><strong>Description du défaut connu :</strong> ${escapeHtml(m.description_defaut)}</p>
          <p><strong>Niveau de gravité estimé :</strong> <span style="font-weight:bold;color:${m.severite==='critique'?'#dc3545':'#ffc107'}">${m.severite.toUpperCase()}</span></p>
          <p><strong>Confiance Diagnostique (vs Usure) :</strong> <span style="color:${confColor}; font-weight:bold;">${m.confidence_niveau}</span></p>
          ${m.alert_usure ? `<p style="background:#fff3cd; padding:8px; border-radius:4px; margin-top:5px;"><small>⚠️ ${escapeHtml(m.alert_usure)}</small></p>` : ''}
        </div>
      `;
    });

    // Mention spéciale infiltration eau si détecté
    if (flags.waterLeak && matches.some(m => m.moteur.includes("Baie"))) {
       html += `
         <div class="rappel-critical">
            <h4>💧 Alerte Infiltration Eau</h4>
            <p>Les symptômes évoquent une infiltration d'eau (potentiellement via la baie de pare-brise ou joints portes). Ce type de défaut est souvent considéré comme un <strong>vice caché</strong> car il dépend de la qualité de montage usine, indépendamment du kilométrage.</p>
            <p>Il convient de vérifier l'état des joints et des évacuations d'eau de climatisation/toiture ouvrante.</p>
         </div>
       `;
    }

    html += `
      <div class="certainty-medium">
        <strong>Analyse :</strong> La concordance entre vos symptômes et les défauts documentés ci-dessus peut servir d'indice fort pour établir le ${term('caractère caché')} et la ${term('gravité du défaut')}. 
        Le fait que ce soit un problème récurrent suggère que le vendeur professionnel (si applicable) aurait dû avoir connaissance de ce risque ${term('obligation de renseignement')}.
      </div>
    `;
    return html;
  }

  function sectionQualification(flags, matches) {
    let html = `<p><strong>Objet :</strong> qualification juridique ${term('qualification juridique')}.</p>`;
    
    if (flags.professional && !flags.privateSeller) {
      html += `<div class="certainty-high"><p>Vendeur présumé professionnel ${term('vendeur professionnel')}. Régime de protection consommateur applicable.</p></div>`;
    } else if (flags.privateSeller && !flags.professional) {
      html += `<div class="certainty-medium"><p>Vendeur présumé particulier ${term('vente entre particuliers')}. Régime des vices cachés du Code civil.</p></div>`;
    } else {
      html += `<div class="certainty-low"><p>Statut du vendeur incertain ${term('ambiguïté statut vendeur')}.</p></div>`;
    }

    if (matches.length > 0) {
      html += `<p>La présence probable d'un ${term('défaut de conception')} ou ${term('vice caché notoire')} renforce la thèse de la non-conformité initiale du bien.</p>`;
    }
    return html;
  }

  function sectionRisques(flags, matches) {
    let html = `<p><strong>Objet :</strong> risques et responsabilités ${term('risques encourus')}.</p>`;
    
    // Logique simplifiée basée sur les matchs techniques
    const hasCriticalDefect = matches.some(m => m.severite === 'critique');
    
    if (hasCriticalDefect) {
      html += `
        <div class="rappel-critical">
          <h4>⚠️ Alerte Responsabilité Aggravée</h4>
          <p>Les défauts identifiés présentent une gravité critique (risque de casse moteur, sécurité incendie, etc.).</p>
          <ul>
            <li>Pour un professionnel : faute lourde possible pour absence de vérification ${term('faute lourde')}.</li>
            <li>Pour un particulier : mauvaise foi potentielle si le défaut était connu ou évident pour un connaisseur ${term('mauvaise foi')}</li>
            <li>Sanctions pénales possibles en cas d'accident corporel ${term('homicide/blessures involontaires')}.</li>
          </ul>
        </div>
      `;
    }

    html += `
      <h4>A. Si Professionnel</h4>
      <ul>
        <li>${term('garantie légale de conformité')} : réparation/remboursement quasi-automatique.</li>
        <li>${term('responsabilité contractuelle')} : dommages-intérêts étendus.</li>
        <li>${term('sanctions DGCCRF')} possibles.</li>
      </ul>
      <h4>B. Si Particulier</h4>
      <ul>
        <li>${term('action rédhibitoire')} ou ${term('action estimatoire')}.</li>
        <li>Charge de la preuve sur l'acquéreur ${term('charge de la preuve')}.</li>
      </ul>
    `;
    return html;
  }

  function sectionCritères(flags, matches, vData) {
    let html = `<p><strong>Objet :</strong> critères cumulatifs adaptés à l'analyse d'usure ${term('critères cumulatifs', 'usure normale')}.</p>`;
    
    const km = parseInt(String(vData.kilometrage).replace(/\D/g,'')) || 0;
    const isHighKm = km > 150000;
    const bestMatch = matches[0]; // On prend le meilleur match pour l'argumentation
    
    let anteriorityArg = "L'antériorité doit être prouvée par expertise.";
    let hiddenArg = "Le caractère caché dépend de la diligence de l'acheteur.";
    let gravityArg = "La gravité dépend du coût de réparation vs valeur véhicule.";

    if (bestMatch) {
       if (bestMatch.confidence_niveau === 'Haute') {
          anteriorityArg = "La nature 'de série' du défaut suggère fortement son existence avant la vente, indépendamment du kilométrage.";
          hiddenArg = "Un défaut de conception/infiltration n'est généralement pas apparent lors d'une inspection visuelle standard.";
       } else if (bestMatch.confidence_niveau === 'Moyenne') {
          anteriorityArg = "Le défaut est probablement antérieur, mais le kilométrage élevé introduit un doute sur l'origine exclusive du dysfonctionnement.";
          hiddenArg = "Le caractère caché est soutenable, mais l'usure normale pourrait expliquer partiellement les symptômes.";
       } else {
          anteriorityArg = "Au vu du kilométrage élevé, il est difficile d'affirmer l'antériorité pure sans écarter l'hypothèse d'usure normale.";
          hiddenArg = "Les symptômes pourraient être dus à l'usure naturelle des pièces, excluant le caractère 'caché'. ";
       }
       
       gravityArg = bestMatch.severite === 'critique' ? "La gravité est élevée (risque sécurité/moteur)." : "La gravité dépend du coût de réparation vs valeur véhicule.";
    }

    html += `
      <h4>A. Antériorité</h4><p>${anteriorityArg} ${term('antériorité')}</p>
      <h4>B. Caractère Caché</h4><p>${hiddenArg} ${term('caractère caché')}</p>
      <h4>C. Gravité</h4><p>${gravityArg} ${term('gravité')}</p>
      <div class="verification-needed">Réunion des critères à confirmer par expertise ${term('confirmation expertise')}.</div>
    `;
    return html;
  }

  function sectionGaranties(flags) {
    let html = `<p><strong>Objet :</strong> garanties ${term('régimes de garantie')}.</p>`;
    if (flags.professional) {
      html += `<h4>Professionnel</h4><ul><li>${term('garantie légale de conformité')}</li><li>${term('délai de deux ans')}</li></ul>`;
    } else {
      html += `<h4>Particulier</h4><ul><li>${term('garantie des vices cachés')}</li><li>${term('article 1641 du Code civil')}</li></ul>`;
    }
    return html;
  }

  function sectionDocuments(flags) {
    return `
      <p><strong>Objet :</strong> preuves ${term('preuve documentaire')}.</p>
      <ul>
        <li>Facture ${flags.invoice ? '(présente)' : '(à récupérer)'}</li>
        <li>Ordonnance/Rapport réparation ${flags.repair ? '(présent)' : '(à demander)'}</li>
        <li>Contrôle Technique ${flags.controlTech ? '(présent)' : '(à vérifier)'}</li>
        <li>Historique entretien (Livret, Factures garage)</li>
        <li>Photos des infiltrations/eau si applicable</li>
      </ul>
    `;
  }

  function sectionJurisprudence() {
    return `
      <p><strong>Objet :</strong> jurisprudence ${term('jurisprudence')}.</p>
      <ul>
        <li>Cass. Civ. 1ère, 3 mai 2006 : Appréciation du caractère caché.</li>
        <li>Cass. Civ. 1ère, 12 juill. 2018 : Obligation de vérification des rappels pro.</li>
        <li>TGI Paris, 15 janv. 2020 : Condamnation Renault 1.5 dCi (bielles).</li>
        <li>Jurisprudence constante : L'usure normale exclut la garantie des vices cachés.</li>
      </ul>
    `;
  }

  function sectionPrejudice(flags) {
    return `
      <p><strong>Objet :</strong> préjudice ${term('évaluation du préjudice')}.</p>
      <ul>
        <li>Coût réparations / Remboursement prix</li>
        <li>Immobilisation véhicule (location remplacement)</li>
        <li>Frais expertise / avocat</li>
        <li>Préjudice moral (si insécurité grave)</li>
      </ul>
    `;
  }

  function sectionStrategie(flags, matches, objective) {
    let html = `<p><strong>Objet :</strong> stratégie ${term('stratégie contentieuse')}.</p>`;
    if (matches.length) {
      html += `<p>Mettre en avant le ${term('défaut de série')} dans la mise en demeure pour montrer la connaissance presumée du vendeur.</p>`;
    }
    html += `
      <ol>
        <li>Expertise amiable contradictoire (insister sur la distinction usure/défaut)</li>
        <li>Mise en demeure LRAR</li>
        <li>Médiation / Conciliation</li>
        <li>Action judiciaire si échec</li>
      </ol>
    `;
    return html;
  }

  function sectionVerification(matches) {
    let html = `<p><strong>Objet :</strong> vérifications ${term('vérifications complémentaires')}.</p>`;
    if (matches.length) {
      html += `<ul><li>Vérifier VIN sur site constructeur pour rappel spécifique.</li><li>Demander historique maintenance détaillé.</li><li>Photographier les zones d'infiltration si suspicion eau.</li></ul>`;
    }
    html += `<ul><li>Obtenir devis réparation officiel.</li><li>Consulter avocat spécialisé.</li></ul>`;
    return html;
  }

  function sectionVoies(flags, matches) {
    return `
      <p><strong>Objet :</strong> voies d'action ${term('voies d\'action')}.</p>
      <ul>
        <li>Action en justice civile</li>
        <li>Signalement DGCCRF (si pro)</li>
        <li>Action collective (si défaut massif identifié)</li>
      </ul>
    `;
  }

  function sectionConclusion(objective, matches) {
    const hasHighConfidence = matches.some(m => m.confidence_niveau === 'Haute');
    const summary = hasHighConfidence 
      ? "Les éléments techniques tendent à confirmer un défaut de conception ou vice caché, distinct de l'usure normale." 
      : "Les éléments techniques suggèrent un problème potentiel, mais l'usure liée au kilométrage doit être écartée par expertise.";

    return `
      <p><strong>Objet :</strong> conclusion ${term('synthèse')}.</p>
      <p>L'analyse technique suggère : ${summary} 
      Juridiquement, la voie de la ${term('garantie légale de conformité')} ou ${term('vices cachés')} est ouverte selon le vendeur.</p>
      <div class="certainty-low"><strong>Avertissement :</strong> Ne constitue pas un conseil juridique définitif.</div>
    `;
  }

  function sectionLexique() {
    const terms = Array.from(termesMobilises).sort();
    let html = `<p><strong>Termes mobilisés :</strong> ${terms.length}</p><div class="lexique-section">`;
    terms.forEach(t => {
      html += `<div class="lexique-item"><strong>${escapeHtml(t)}</strong></div>`;
    });
    html += `</div>`;
    return html;
  }

  // =====================================================
  // ADMIN PANEL LOGIC
  // =====================================================
  
  $('#adminPanelBtn').addEventListener('click', () => {
    if (currentUser?.role !== 'admin') return;
    $('#adminPanel').classList.remove('hidden');
    renderAdmin();
  });
  
  $('#closeAdminBtn').addEventListener('click', () => $('#adminPanel').classList.add('hidden'));
  
  $$('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.admin-tab').forEach(b => b.classList.remove('active'));
      $$('.admin-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.adminTab + 'Pane').classList.add('active');
    });
  });

  function renderAdmin() {
    renderRequests();
    renderUsers();
    renderStats();
  }

  function renderRequests() {
    const box = $('#pendingRequests');
    const pending = getRequests().filter(r => r.status === 'pending');
    box.innerHTML = pending.length ? pending.map(r => `
      <div class="card pending">
        <strong>${escapeHtml(r.name)}</strong> <small>${escapeHtml(r.email)}</small>
        <p>${escapeHtml(r.reason)}</p>
        <div class="actions">
          <button class="btn-ok" data-action="approve" data-id="${r.id}">Accepter</button>
          <button class="btn-no" data-action="refuse" data-id="${r.id}">Refuser</button>
        </div>
      </div>
    `).join('') : '<p class="muted">Aucune demande.</p>';
  }

  function renderUsers() {
    const box = $('#authorizedUsers');
    const users = getUsers().filter(u => u.role !== 'admin');
    box.innerHTML = users.length ? users.map(u => `
      <div class="card ${u.status}">
        <strong>${escapeHtml(u.name)}</strong> <small>${escapeHtml(u.email)} • ${u.status}</small>
        <div class="actions">
          ${u.status === 'approved' ? `<button class="btn-warn" data-action="revoke" data-email="${u.email}" data-name="${u.name}">Révoquer</button>` : `<button class="btn-ok" data-action="restore" data-email="${u.email}" data-name="${u.name}">Rétablir</button>`}
        </div>
      </div>
    `).join('') : '<p class="muted">Aucun tiers.</p>';
  }

  function renderStats() {
    const users = getUsers();
    const requests = getRequests();
    const approved = users.filter(u => u.status === 'approved' && u.role !== 'admin').length;
    const pending = requests.filter(r => r.status === 'pending').length;
    $('#statsContent').innerHTML = `
      <div class="stat"><span>Tiers actifs</span><b>${approved}</b></div>
      <div class="stat"><span>En attente</span><b>${pending}</b></div>
      <div class="stat"><span>Limite/jour</span><b>${MAX_DAILY_ANALYSES}</b></div>
    `;
  }

  $('#adminPanel').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    
    if (['approve', 'refuse'].includes(action)) {
      const id = btn.dataset.id;
      const reqs = getRequests();
      const req = reqs.find(r => r.id === id);
      if (!req) return;
      req.status = action === 'approve' ? 'approved' : 'refused';
      saveRequests(reqs);
      if (action === 'approve') {
        upsertUser({ id: req.id, name: req.name, email: req.email, role: 'user', status: 'approved', daily: { date: todayKey(), count: 0 } });
        notify('Accès approuvé', req.name);
      }
      renderAdmin();
      toast(action === 'approve' ? 'Accepté.' : 'Refusé.', action === 'approve' ? 'success' : 'warning');
    } 
    
    if (['revoke', 'restore'].includes(action)) {
      const email = btn.dataset.email;
      const name = btn.dataset.name;
      const users = getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.name.toLowerCase() === name.toLowerCase());
      if (user) {
        user.status = action === 'revoke' ? 'revoked' : 'approved';
        saveUsers(users);
        renderAdmin();
        toast(action === 'revoke' ? 'Révoqué.' : 'Rétabli.', action === 'revoke' ? 'warning' : 'success');
      }
    }
  });

  // =====================================================
  // EXPORT / IMPORT / APK / INSTALL
  // =====================================================
  
  $('#exportDataBtn').addEventListener('click', () => {
    const data = { exportedAt: new Date().toISOString(), users: getUsers(), requests: getRequests() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aide-redactionnelle-data.json';
    a.click();
    toast('Exporté.', 'success');
  });

  $('#importDataBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      try {
        const text = await input.files[0].text();
        const data = JSON.parse(text);
        if (data.users) saveUsers(data.users);
        if (data.requests) saveRequests(data.requests);
        renderAdmin();
        toast('Importé.', 'success');
      } catch (e) { toast('Erreur import.', 'error'); }
    };
    input.click();
  });

  $('#apkBtn').addEventListener('click', () => {
    window.open('https://www.pwabuilder.com/?url=' + encodeURIComponent(location.origin + location.pathname), '_blank');
  });
  
  $('#copyUrlBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(location.href);
    toast('URL copiée.', 'success');
  });

  $('#installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    } else {
      toast('Utilisez le menu navigateur pour installer.', 'info');
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').classList.remove('hidden');
  });

  // =====================================================
  // GENERATION PDF & PARTAGE
  // =====================================================
  
  $('#generatePdfBtn').addEventListener('click', () => {
    if (!window.jspdf) return toast('Lib JS non chargée.', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;
    
    doc.setFontSize(16); 
    doc.text("RAPPORT D'ANALYSE EXPERT", 105, y, {align:'center'}); 
    y+=10;
    
    doc.setFontSize(10); 
    doc.text("Date: " + analysisData.date, 20, y); 
    y+=10;
    
    doc.text("Vehicule: " + (vehicleData.marque||'') + " " + (vehicleData.modele||''), 20, y); 
    y+=10;
    
    analysisData.sections.forEach(([title, content]) => {
      if (y > 270) { 
        doc.addPage(); 
        y = 20; 
      }
      
      doc.setFont(undefined, 'bold'); 
      doc.setFontSize(11);
      const tLines = doc.splitTextToSize(title, 170);
      doc.text(tLines, 20, y); 
      y += tLines.length * 5 + 2;
      
      doc.setFont(undefined, 'normal'); 
      doc.setFontSize(9);
      const plain = stripHtml(content);
      const cLines = doc.splitTextToSize(plain, 170);
      
      cLines.forEach(line => {
        if (y > 280) { 
          doc.addPage(); 
          y = 20; 
        }
        doc.text(line, 20, y); 
        y += 4;
      });
      y += 4;
    });
    
    doc.save('analyse-experte-' + new Date().toISOString().slice(0,10) + '.pdf');
    toast('PDF généré.', 'success');
  });

  $('#shareBtn').addEventListener('click', async () => {
    const text = analysisData.sections.map(([t,c]) => t + "\n" + stripHtml(c)).join("\n\n");
    if (navigator.share) {
      try { 
        await navigator.share({ title: 'Analyse Expert', text }); 
      } catch(e){}
    } else {
      await navigator.clipboard.writeText(text);
      toast('Copié.', 'success');
    }
  });

  // =====================================================
  // INITIALISATION
  // =====================================================
  
  if (restoreSession()) {
    showApp();
  } else {
    showLogin();
  }
});
