document.addEventListener('DOMContentLoaded', function () {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // =====================================================
  // CONFIG
  // =====================================================
  const ADMIN_PASSWORD = 'Kevin83600';
  const MAX_DAILY_ANALYSES = 10;

  const STORAGE = {
    session: 'ar_expert_session',
    users: 'ar_expert_users',
    requests: 'ar_expert_requests'
  };

  let currentUser = null;
  let vehicleData = {};
  let analysisData = {};
  let extractedText = '';
  let termesMobilises = new Set();
  let deferredPrompt = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // =====================================================
  // UTILITAIRES
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
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
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
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function term(...words) {
    words.forEach((w) => termesMobilises.add(w));
    return '<span class="termes-juridiques">(' + words.join(', ') + ')</span>';
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // =====================================================
  // AUTH / UTILISATEURS
  // =====================================================
  function getUsers() {
    return load(STORAGE.users, []);
  }

  function saveUsers(users) {
    save(STORAGE.users, users);
  }

  function getRequests() {
    return load(STORAGE.requests, []);
  }

  function saveRequests(requests) {
    save(STORAGE.requests, requests);
  }

  function findUser(name, email) {
    const n = String(name || '').trim().toLowerCase();
    const e = String(email || '').trim().toLowerCase();
    return getUsers().find((u) => u.name.toLowerCase() === n && u.email.toLowerCase() === e);
  }

  function upsertUser(user) {
    const users = getUsers();
    const idx = users.findIndex(
      (u) => u.name.toLowerCase() === user.name.toLowerCase() && u.email.toLowerCase() === user.email.toLowerCase()
    );
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push(user);
    saveUsers(users);
  }

  function setSession(user) {
    currentUser = user;
    save(STORAGE.session, user);
  }

  function clearSession() {
    currentUser = null;
    localStorage.removeItem(STORAGE.session);
  }

  function restoreSession() {
    const session = load(STORAGE.session, null);
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
    const idx = users.findIndex(
      (u) => u.name.toLowerCase() === currentUser.name.toLowerCase() && u.email.toLowerCase() === currentUser.email.toLowerCase()
    );
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
      el.textContent = '👑 Admin — analyses illimitées';
    } else {
      el.textContent = `📊 ${info.remaining}/${MAX_DAILY_ANALYSES} analyses restantes aujourd’hui`;
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

  function authMessage(message, type) {
    const el = $('#authMsg');
    el.textContent = message;
    el.className = 'auth-msg ' + type;
  }

  // =====================================================
  // UI CONNEXION
  // =====================================================
  $$('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.auth-tab').forEach((b) => b.classList.remove('active'));
      $$('.auth-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#' + btn.dataset.authTab + 'Pane').classList.add('active');
      authMessage('', '');
    });
  });

  $('#adminLoginBtn').addEventListener('click', async () => {
    const pwd = $('#adminPassword').value;
    if (!pwd) return authMessage('Veuillez saisir le mot de passe.', 'error');

    const inputHash = await sha256(pwd);
    const adminHash = await sha256(ADMIN_PASSWORD);

    if (inputHash === adminHash) {
      const adminUser = {
        id: 'admin',
        name: 'Administrateur',
        email: 'admin@local',
        role: 'admin',
        status: 'approved'
      };
      setSession(adminUser);
      showApp();
      toast('Connexion administrateur réussie.', 'success');
    } else {
      authMessage('Mot de passe incorrect.', 'error');
    }
  });

  $('#requestBtn').addEventListener('click', () => {
    const name = $('#reqName').value.trim();
    const email = $('#reqEmail').value.trim();
    const reason = $('#reqReason').value.trim();

    if (!name || !email || !reason) {
      return authMessage('Nom, email et motif sont obligatoires.', 'error');
    }

    const requests = getRequests();
    const existingPending = requests.find(
      (r) => r.email.toLowerCase() === email.toLowerCase() && r.status === 'pending'
    );
    if (existingPending) {
      return authMessage('Une demande est déjà en attente pour cet email.', 'warning');
    }

    const existingUser = findUser(name, email);
    if (existingUser && existingUser.status === 'approved') {
      return authMessage('Accès déjà accordé. Utilisez “Connexion tiers”.', 'success');
    }

    const request = {
      id: uid(),
      name,
      email,
      reason,
      status: 'pending',
      date: new Date().toLocaleString('fr-FR')
    };

    requests.push(request);
    saveRequests(requests);

    askNotificationPermission();
    notify('Nouvelle demande d’accès', `${name} (${email}) demande l’accès.`);

    authMessage('Demande envoyée. Elle est visible dans le panneau admin de cet appareil/navigateur.', 'success');

    $('#reqName').value = '';
    $('#reqEmail').value = '';
    $('#reqReason').value = '';
  });

  $('#thirdLoginBtn').addEventListener('click', () => {
    const name = $('#loginName').value.trim();
    const email = $('#loginEmail').value.trim();

    if (!name || !email) return authMessage('Nom et email sont obligatoires.', 'error');

    const user = findUser(name, email);
    if (!user) {
      const request = getRequests().find(
        (r) => r.name.toLowerCase() === name.toLowerCase() && r.email.toLowerCase() === email.toLowerCase()
      );
      if (request && request.status === 'pending') {
        return authMessage('Votre demande est en attente de validation.', 'warning');
      }
      return authMessage('Aucun accès trouvé pour ce nom/email.', 'error');
    }

    if (user.status !== 'approved') {
      return authMessage('Accès refusé ou révoqué.', 'error');
    }

    setSession(user);
    showApp();
    toast('Connexion réussie.', 'success');
  });

  $('#logoutBtn').addEventListener('click', () => {
    clearSession();
    showLogin();
  });

  // =====================================================
  // PDF UPLOAD
  // =====================================================
  $('#pdfUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      return pdfStatus('Veuillez sélectionner un fichier PDF.', 'error');
    }

    pdfStatus('Extraction du PDF en cours…', 'success');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(' ') + '\n\n';
      }

      extractedText = fullText;
      $('#textInput').value = fullText;
      pdfStatus(`PDF extrait avec succès (${pdf.numPages} page(s)).`, 'success');
    } catch (err) {
      pdfStatus('Erreur lors de l’extraction : ' + err.message, 'error');
    }
  });

  function pdfStatus(message, type) {
    const el = $('#pdfStatus');
    el.textContent = message;
    el.className = 'status ' + type;
  }

  // =====================================================
  // BASE RAPPELS / PROBLÈMES CONNUS
  // =====================================================
  const RECALL_DB = {
    renault: {
      label: 'Renault',
      items: [
        { years: '2012-2018', models: 'Clio IV, Captur, Megane III', issue: 'Boîte EDC6', detail: 'À-coups, pertes de puissance, défaillance du module de commande.', severity: 'critique', ref: 'Campagnes constructeur R20-001 / R21-003 (à vérifier).' },
        { years: '2012-2020', models: 'Clio IV, Captur, Kadjar', issue: 'Moteur 1.2 TCe H5F', detail: 'Consommation d’huile anormale, risque de casse moteur.', severity: 'critique', ref: 'Actions collectives et nombreux retours documentés.' },
        { years: '2009-2016', models: 'Megane III, Scenic III', issue: 'Moteur 1.5 dCi K9K', detail: 'Casse de bielle, usure prématurée des coussinets.', severity: 'critique', ref: 'Décisions judiciaires et campagnes techniques.' }
      ]
    },
    peugeot: {
      label: 'Peugeot',
      items: [
        { years: '2012-2018', models: '208, 308, 3008, 5008', issue: 'Moteur 1.2 PureTech EB2', detail: 'Désagrégation de courroie de distribution dans l’huile, risque de casse moteur.', severity: 'critique', ref: 'Campagnes R21-014 / R22-008 (à vérifier).' },
        { years: '2010-2017', models: '308, 508, 3008', issue: 'Boîte EAT6', detail: 'À-coups, perte de puissance, défaillance du convertisseur.', severity: 'critique', ref: 'Contentieux et bulletins techniques.' }
      ]
    },
    citroen: {
      label: 'Citroën',
      items: [
        { years: '2012-2018', models: 'C3, C4, C4 Picasso, C5 Aircross', issue: 'Moteur 1.2 PureTech EB2', detail: 'Même famille de défaut que Peugeot / Stellantis.', severity: 'critique', ref: 'Campagnes constructeur.' },
        { years: '2014-2019', models: 'C4 Picasso, Grand C4 Picasso', issue: 'Boîte EAT6/EAT8', detail: 'À-coups, perte de puissance.', severity: 'critique', ref: 'Décisions judiciaires et rappels techniques.' }
      ]
    },
    volkswagen: {
      label: 'Volkswagen',
      items: [
        { years: '2009-2015', models: 'Golf, Passat, Tiguan', issue: 'Dieselgate TDI', detail: 'Dispositif d’invalidation des mesures antipollution.', severity: 'critique', ref: 'CJUE C-693/18 et contentieux massifs.' },
        { years: '2008-2016', models: 'Golf, Passat, Scirocco', issue: 'Boîte DSG7 DQ200', detail: 'Défaillance mécatronique, à-coups, perte de propulsion.', severity: 'critique', ref: 'Rappels mondiaux.' }
      ]
    },
    audi: {
      label: 'Audi',
      items: [
        { years: '2009-2015', models: 'A3, A4, A6, Q5', issue: 'Dieselgate TDI', detail: 'Groupe VAG, dispositif d’invalidation.', severity: 'critique', ref: 'Affaire Dieselgate.' },
        { years: '2008-2016', models: 'A3, A4, Q3', issue: 'Boîte S-Tronic DQ200', detail: 'Défaillance mécatronique.', severity: 'critique', ref: 'Rappels techniques.' }
      ]
    },
    bmw: {
      label: 'BMW',
      items: [
        { years: '2007-2015', models: 'Serie 1, Serie 3, Serie 5', issue: 'Moteur N47 2.0d', detail: 'Casse de chaîne de distribution côté boîte.', severity: 'critique', ref: 'Contentieux internationaux.' },
        { years: '2010-2018', models: 'Serie 3, Serie 5, X3, X5', issue: 'Système EGR', detail: 'Risque d’incendie du collecteur d’admission.', severity: 'critique', ref: 'Rappel sécurité 18V-001 (à vérifier).' }
      ]
    },
    mercedes: {
      label: 'Mercedes-Benz',
      items: [
        { years: '2009-2016', models: 'Classe C, Classe E, GLK', issue: 'Boîte 7G-Tronic', detail: 'À-coups, perte de propulsion, défauts électroniques.', severity: 'critique', ref: 'Campagnes multiples.' },
        { years: '2010-2018', models: 'Classe A, Classe B, CLA', issue: 'Moteur OM651', detail: 'Défaillance d’injecteurs, consommation d’huile.', severity: 'critique', ref: 'Rappels constructeur.' }
      ]
    },
    ford: {
      label: 'Ford',
      items: [
        { years: '2011-2016', models: 'Focus, Fiesta, B-Max', issue: 'Boîte PowerShift DPS6', detail: 'Défaillance de boîte double embrayage, à-coups, perte de propulsion.', severity: 'critique', ref: 'Class actions et contentieux.' },
        { years: '2012-2018', models: 'Focus, C-Max, Kuga', issue: 'Moteur 1.0 EcoBoost', detail: 'Surchauffe, défaut de refroidissement, risque de casse.', severity: 'critique', ref: 'Rappels techniques.' }
      ]
    },
    toyota: {
      label: 'Toyota',
      items: [
        { years: '2009-2011', models: 'Yaris, Auris, Avensis', issue: 'Pédale d’accélérateur', detail: 'Risque de blocage de la pédale.', severity: 'critique', ref: 'Rappel mondial.' },
        { years: '2014-2020', models: 'Yaris, C-HR, RAV4', issue: 'Airbags Takata', detail: 'Risque de projection métallique.', severity: 'critique', ref: 'Rappel mondial Takata.' }
      ]
    },
    fiat: {
      label: 'Fiat',
      items: [
        { years: '2010-2017', models: '500, Panda, Punto', issue: 'Boîte Dualogic', detail: 'Défaillance de l’actuateur, perte de propulsion.', severity: 'critique', ref: 'Campagnes constructeur.' },
        { years: '2009-2016', models: 'Punto, Bravo, Doblo', issue: 'Moteur 1.3 MultiJet', detail: 'Chaîne de distribution, turbo, consommation d’huile.', severity: 'critique', ref: 'Retours techniques.' }
      ]
    },
    nissan: {
      label: 'Nissan',
      items: [
        { years: '2012-2018', models: 'Qashqai, X-Trail', issue: 'Moteur 1.5 dCi K9K', detail: 'Casse de bielle, usure des coussinets.', severity: 'critique', ref: 'Partenariat Renault.' },
        { years: '2014-2020', models: 'Qashqai, X-Trail', issue: 'Boîte X-Tronic CVT', detail: 'À-coups, perte de propulsion.', severity: 'critique', ref: 'Campagnes techniques.' }
      ]
    },
    opel: {
      label: 'Opel',
      items: [
        { years: '2012-2018', models: 'Corsa, Astra, Mokka', issue: 'Moteur 1.4 Turbo', detail: 'Consommation d’huile, risque de casse moteur.', severity: 'critique', ref: 'Rappels constructeur.' },
        { years: '2009-2016', models: 'Astra, Zafira', issue: 'Refroidissement', detail: 'Fuite, surchauffe, risque d’incendie sur certaines séries.', severity: 'critique', ref: 'Rappel sécurité.' }
      ]
    },
    hyundai: {
      label: 'Hyundai',
      items: [
        { years: '2011-2017', models: 'i30, Tucson, ix35', issue: 'Moteur 1.7 CRDi', detail: 'Injecteurs, consommation d’huile, casse moteur.', severity: 'moyenne', ref: 'Campagnes techniques.' },
        { years: '2015-2020', models: 'i20, i30, Tucson', issue: 'Boîte DCT', detail: 'À-coups, défaillance mécatronique.', severity: 'moyenne', ref: 'Rappels constructeur.' }
      ]
    },
    kia: {
      label: 'Kia',
      items: [
        { years: '2011-2017', models: 'Ceed, Sportage, Niro', issue: 'Moteur 1.7 CRDi', detail: 'Mêmes familles de défauts que Hyundai.', severity: 'moyenne', ref: 'Campagnes techniques.' },
        { years: '2012-2018', models: 'Ceed, Sportage', issue: 'Catalyseur', detail: 'Risque d’incendie sur certaines références.', severity: 'critique', ref: 'Rappel sécurité.' }
      ]
    },
    volvo: {
      label: 'Volvo',
      items: [
        { years: '2012-2018', models: 'V40, V60, XC60', issue: 'Moteurs Drive-E', detail: 'Consommation d’huile, défaillance segments.', severity: 'critique', ref: 'Campagnes constructeur.' },
        { years: '2014-2020', models: 'XC90, V90, S90', issue: 'AdBlue', detail: 'Cristallisation, défaillance pompe.', severity: 'moyenne', ref: 'Bulletins techniques.' }
      ]
    },
    seat: {
      label: 'SEAT',
      items: [
        { years: '2009-2015', models: 'Ibiza, Leon, Altea', issue: 'Dieselgate TDI', detail: 'Groupe VAG.', severity: 'critique', ref: 'Affaire Dieselgate.' },
        { years: '2012-2018', models: 'Leon, Ateca', issue: 'Boîte DSG7', detail: 'Défaillance mécatronique.', severity: 'critique', ref: 'Rappels VAG.' }
      ]
    },
    skoda: {
      label: 'Škoda',
      items: [
        { years: '2009-2015', models: 'Octavia, Superb, Yeti', issue: 'Dieselgate TDI', detail: 'Groupe VAG.', severity: 'critique', ref: 'Affaire Dieselgate.' },
        { years: '2010-2017', models: 'Octavia, Superb', issue: 'Moteurs TSI', detail: 'Consommation d’huile.', severity: 'critique', ref: 'Campagnes constructeur.' }
      ]
    },
    jeep: {
      label: 'Jeep',
      items: [
        { years: '2014-2020', models: 'Renegade, Compass, Cherokee', issue: 'Boîte DCT', detail: 'Défaillance double embrayage à sec.', severity: 'critique', ref: 'Rappels Stellantis.' },
        { years: '2015-2020', models: 'Renegade, Compass', issue: 'Moteur 1.6 MultiJet', detail: 'Injecteurs, consommation d’huile.', severity: 'moyenne', ref: 'Bulletins techniques.' }
      ]
    },
    dacia: {
      label: 'Dacia',
      items: [
        { years: '2012-2018', models: 'Duster, Sandero, Logan', issue: 'Moteur 1.5 dCi K9K', detail: 'Casse de bielle.', severity: 'critique', ref: 'Base Renault.' },
        { years: '2013-2019', models: 'Duster', issue: 'Boîte EDC', detail: 'Défaillance double embrayage.', severity: 'moyenne', ref: 'Campagnes techniques.' }
      ]
    },
    mini: {
      label: 'MINI',
      items: [
        { years: '2010-2017', models: 'Cooper, Cooper S, Countryman', issue: 'Moteurs Prince N18/N20', detail: 'Consommation d’huile, chaîne de distribution.', severity: 'critique', ref: 'Contentieux UK/Allemagne.' },
        { years: '2014-2020', models: 'Cooper, Clubman', issue: 'Boîte DCT Getrag', detail: 'À-coups, perte de propulsion.', severity: 'moyenne', ref: 'Rappels techniques.' }
      ]
    }
  };

  const TRANSVERSAL_ISSUES = [
    {
      name: 'Airbags Takata',
      years: '2009-2020',
      brands: ['Toyota', 'Honda', 'Nissan', 'Mazda', 'BMW', 'Mercedes', 'Ford', 'Fiat', 'Volkswagen', 'Audi', 'SEAT', 'Škoda', 'Opel'],
      detail: 'Défaut de générateur de gaz pouvant projeter des fragments métalliques.',
      severity: 'critique',
      ref: 'Rappel mondial, ANSM/NHTSA.'
    },
    {
      name: 'Dieselgate / dispositif d’invalidation',
      years: '2009-2015',
      brands: ['Volkswagen', 'Audi', 'SEAT', 'Škoda', 'Mercedes', 'BMW', 'Opel', 'Peugeot', 'Citroën', 'Renault', 'Fiat', 'Jeep', 'Volvo'],
      detail: 'Logiciel ou stratégie de mesure faussant les tests antipollution.',
      severity: 'critique',
      ref: 'CJUE C-693/18 et contentieux nationaux.'
    }
  ];

  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function yearInRange(range, year) {
    if (!year) return true;
    const match = String(range).match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (!match) return true;
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    return year >= start && year <= end;
  }

  function matchRecalls() {
    const brand = normalize(vehicleData.marque);
    const model = normalize(vehicleData.modele);
    const year = parseInt(vehicleData.annee, 10) || 0;

    const hits = [];
    const transversal = [];

    Object.entries(RECALL_DB).forEach(([key, brandData]) => {
      if (!brand || key.includes(brand) || brand.includes(key)) {
        brandData.items.forEach((item) => {
          const itemModels = normalize(item.models);
          const yearOk = yearInRange(item.years, year);
          const modelOk = !model || itemModels.includes(model);
          if (yearOk && modelOk) {
            hits.push({
              constructeur: brandData.label,
              ...item
            });
          }
        });
      }
    });

    TRANSVERSAL_ISSUES.forEach((issue) => {
      const issueBrands = issue.brands.map(normalize);
      const brandOk = !brand || issueBrands.some((b) => b.includes(brand) || brand.includes(b));
      if (brandOk && yearInRange(issue.years, year)) {
        transversal.push(issue);
      }
    });

    return { hits, transversal };
  }

  // =====================================================
  // ANALYSE
  // =====================================================
  $('#analyzeBtn').addEventListener('click', () => {
    if (!currentUser) {
      toast('Veuillez vous connecter.', 'error');
      return;
    }

    const info = dailyInfo();
    if (!info.allowed) {
      toast(`Limite de ${MAX_DAILY_ANALYSES} analyses par jour atteinte.`, 'warning');
      return;
    }

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

    if (!text) {
      toast('Saisissez des faits ou importez un PDF.', 'warning');
      return;
    }

    termesMobilises = new Set();

    const btn = $('#analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analyse experte en cours…';

    setTimeout(() => {
      try {
        runAnalysis(text, context, objective);
        incrementDaily();
        toast('Analyse experte générée.', 'success');
      } catch (err) {
        console.error(err);
        toast('Erreur lors de l’analyse : ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔍 Lancer l’analyse experte';
      }
    }, 900);
  });

  function runAnalysis(text, context, objective) {
    const all = (text + ' ' + context).toLowerCase();

    const flags = {
      vehicle: all.includes('véhicule') || all.includes('voiture') || all.includes('auto') || !!vehicleData.marque,
      defect: ['défaut', 'panne', 'problème', 'dysfonctionnement', 'casse', 'fuite', 'vibration', 'bruit', 'surchauffe', 'perte de puissance', 'à-coup'].some((w) => all.includes(w)),
      professional: ['professionnel', 'garage', 'concession', 'concessionnaire', 'vendeur pro', 'automobile'].some((w) => all.includes(w)),
      privateSeller: ['particulier', 'entre particuliers', 'de particulier', 'vends', 'vende'].some((w) => all.includes(w)),
      invoice: all.includes('facture'),
      repair: all.includes('réparation') || all.includes('ordre de réparation') || all.includes(' devis'),
      controlTech: all.includes('contrôle technique'),
      warranty: all.includes('garantie'),
      safety: ['sécurité', 'frein', 'airbag', 'direction', 'incendie', 'danger', 'immobilisation'].some((w) => all.includes(w))
    };

    const recallData = matchRecalls();

    analysisData = {
      date: new Date().toLocaleString('fr-FR'),
      vehicleData,
      text: text.slice(0, 1500),
      context,
      objective,
      sections: []
    };

    const sections = [];

    sections.push(['I. ÉLÉMENTS FACTUELS ET CONSTATS NON VÉRIFIÉS', sectionFacts(text, context)]);
    sections.push(['II. QUALIFICATION JURIDIQUE PROVISOIRE', sectionQualification(flags)]);
    sections.push(['III. RISQUES ET RESPONSABILITÉS SELON LA QUALITÉ DU VENDEUR', sectionRisques(flags, recallData)]);
    sections.push(['IV. ANALYSE DES TROIS CRITÈRES CUMULATIFS', sectionCritères(flags)]);
    sections.push(['V. RÉGIMES DE GARANTIE POTENTIELLEMENT INVOCABLES', sectionGaranties(flags)]);
    sections.push(['VI. ANALYSE TECHNIQUE NIVEAU INGÉNIEUR', sectionTechnique(flags, recallData)]);
    sections.push(['VII. ANALYSE DOCUMENTAIRE ET PROBATOIRE', sectionDocuments(flags)]);

    if (recallData.hits.length || recallData.transversal.length) {
      sections.push(['VIII. RAPPELS CONSTRUCTEURS ET PROBLÈMES CONNUS', sectionRappels(recallData)]);
    }

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'IX' : 'VIII') + '. JURISPRUDENCE ET DOCTRINE DE RÉFÉRENCE',
      sectionJurisprudence()
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'X' : 'IX') + '. ÉVALUATION DU PRÉJUDICE',
      sectionPrejudice(flags)
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'XI' : 'X') + '. STRATÉGIE CONTENTIEUSE ET PROCÉDURALE',
      sectionStrategie(flags, recallData, objective)
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'XII' : 'XI') + '. ÉLÉMENTS À VÉRIFIER / COMPLÉTER',
      sectionVerification(recallData)
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'XIII' : 'XII') + '. VOIES D’ACTION POSSIBLES',
      sectionVoies(flags, recallData)
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'XIV' : 'XIII') + '. CONCLUSION PRUDENTE',
      sectionConclusion(objective, recallData)
    ]);

    sections.push([
      (recallData.hits.length || recallData.transversal.length ? 'XV' : 'XIV') + '. LEXIQUE JURIDIQUE ET TECHNIQUE MOBILISÉ',
      sectionLexique()
    ]);

    analysisData.sections = sections;
    renderAnalysis();
  }

  function renderAnalysis() {
    let html = '';
    analysisData.sections.forEach(([title, content]) => {
      html += `<h3>${title}</h3>${content}`;
    });

    html += `
      <div class="verification-needed">
        <strong>Rappel méthodologique :</strong> les conclusions ci-dessus sont formulées de manière prudente,
        conditionnelle et factuelle. Elles doivent être corroborées par pièces, expertises et, le cas échéant,
        l’analyse d’un avocat ou d’un expert judiciaire.
      </div>
    `;

    $('#analysisResult').innerHTML = html;
    $('#analysisSection').classList.remove('hidden');
    $('#analysisSection').scrollIntoView({ behavior: 'smooth' });
  }

  // =====================================================
  // SECTIONS
  // =====================================================
  function sectionFacts(text, context) {
    return `
      <p><strong>Objet :</strong> recensement des éléments fournis, sans qualification définitive ${term('éléments factuels', 'constats non vérifiés')}.</p>

      <h4>A. Véhicule déclaré</h4>
      <ul>
        <li><strong>Marque :</strong> ${escapeHtml(vehicleData.marque || 'non précisée')}</li>
        <li><strong>Modèle :</strong> ${escapeHtml(vehicleData.modele || 'non précisé')}</li>
        <li><strong>Année :</strong> ${escapeHtml(vehicleData.annee || 'non précisée')}</li>
        ${vehicleData.kilometrage ? `<li><strong>Kilométrage :</strong> ${escapeHtml(vehicleData.kilometrage)}</li>` : ''}
        ${vehicleData.vin ? `<li><strong>VIN :</strong> ${escapeHtml(vehicleData.vin.slice(0, 8))}… ${term('VIN', 'identification du véhicule')}</li>` : ''}
      </ul>

      <h4>B. Faits rapportés</h4>
      <div class="verification-needed">
        <em>Extraits de la saisie utilisateur, non vérifiés par expertise contradictoire ${term('faits non vérifiés', 'absence d’expertise')}.</em>
      </div>
      <p>${escapeHtml(text.slice(0, 1000))}${text.length > 1000 ? '…' : ''}</p>

      ${context ? `<h4>C. Contexte fourni</h4><p>${escapeHtml(context.slice(0, 800))}${context.length > 800 ? '…' : ''}</p>` : ''}

      <div class="certainty-low">
        <strong>Limite :</strong> cette section ne valide pas les faits. Une expertise technique contradictoire
        ${term('expertise contradictoire', 'principe du contradictoire')} peut être nécessaire pour établir la matérialité,
        la date d’apparition et l’imputabilité des désordres ${term('antériorité', 'lien de causalité')}.
      </div>
    `;
  }

  function sectionQualification(flags) {
    let html = `<p><strong>Objet :</strong> qualification juridique provisoire au regard du droit français ${term('qualification juridique', 'droit français')}.</p>`;

    html += `<h4>A. Nature de l’opération</h4>`;
    if (flags.vehicle) {
      html += `
        <p>Les éléments évoquent une vente de véhicule automobile ${term('vente', 'bien meuble corporel', 'article 1582 du Code civil')}.
        Si cette qualification est confirmée, le régime applicable pourrait combiner :</p>
        <ul>
          <li>le droit commun de la vente ${term('droit commun des obligations')} ;</li>
          <li>le droit de la consommation si le vendeur est professionnel ${term('droit de la consommation', 'ordre public de protection')} ;</li>
          <li>la jurisprudence civile en matière automobile ${term('jurisprudence', 'Cour de cassation')}.</li>
        </ul>
      `;
    } else {
      html += `<p>La nature exacte de l’opération n’est pas établie ${term('qualification incertaine')}.</p>`;
    }

    html += `<h4>B. Qualité du vendeur</h4>`;
    if (flags.professional && !flags.privateSeller) {
      html += `
        <div class="certainty-medium">
          <p>Le vendeur paraît professionnel ${term('vendeur professionnel', 'relation B2C')}.
          Sous réserve de vérification, cela ouvrirait potentiellement droit à :</p>
          <ul>
            <li>${term('garantie légale de conformité')} ;</li>
            <li>${term('renversement de la charge de la preuve')} ;</li>
            <li>${term('obligation d’information renforcée')} ;</li>
            <li>${term('interdiction des clauses abusives')}.</li>
          </ul>
        </div>
      `;
    } else if (flags.privateSeller && !flags.professional) {
      html += `
        <div class="certainty-medium">
          <p>Le vendeur paraît être un particulier ${term('vente entre particuliers', 'relation C2C')}.
          Le régime le plus probable serait alors celui de la ${term('garantie des vices cachés', 'articles 1641 et suivants du Code civil')},
          avec une charge de la preuve plus lourde pour l’acquéreur ${term('charge de la preuve')}.</p>
        </div>
      `;
    } else if (flags.privateSeller && flags.professional) {
      html += `<div class="certainty-low"><p>Le contexte mentionne à la fois particulier et professionnel ${term('ambiguïté sur la qualité du vendeur')}. Une clarification est indispensable ${term('qualification du vendeur')}.</p></div>`;
    } else {
      html += `<div class="certainty-low"><p>La qualité du vendeur n’est pas établie ${term('absence de qualification du vendeur')}.</p></div>`;
    }

    html += `<h4>C. Nature des désordres</h4>`;
    if (flags.defect) {
      html += `
        <p>Des désordres sont rapportés. Plusieurs qualifications pourraient être envisagées, sans exclusivité ${term('qualifications alternatives')} :</p>
        <ul>
          <li>${term('défaut de conformité')} ;</li>
          <li>${term('défaut de délivrance conforme')} ;</li>
          <li>${term('manquement à l’obligation d’information')} ;</li>
          <li>${term('vice caché')} au sens du Code civil, si les conditions sont réunies.</li>
        </ul>
        <div class="verification-needed">
          La qualification définitive dépendra de l’expertise technique, des documents contractuels et de la chronologie ${term('faisceau d’indices')}.
        </div>
      `;
    } else {
      html += `<p>Aucun désordre clairement identifié dans les éléments fournis ${term('absence de désordre caractérisé')}.</p>`;
    }

    return html;
  }

  function sectionRisques(flags, recallData) {
    let html = `<p><strong>Objet :</strong> risques et responsabilités selon la qualité du vendeur ${term('risques encourus', 'responsabilités', 'qualité du vendeur')}.</p>`;

    html += `
      <h3>A. Si le vendeur est un particulier</h3>
      <h4>A.1. Risques civils du vendeur particulier</h4>
      <ul>
        <li>${term('action rédhibitoire')} : résolution de la vente avec restitution ${term('article 1644 du Code civil')} ;</li>
        <li>${term('action estimatoire')} : réduction du prix ${term('article 1644 du Code civil')} ;</li>
        <li>${term('dommages et intérêts')} si la mauvaise foi est rapportée ${term('mauvaise foi', 'article 1645 du Code civil')} ;</li>
        <li>${term('frais d’expertise')} susceptibles d’être mis à la charge du vendeur ${term('article 1646 du Code civil')}.</li>
      </ul>

      <h4>A.2. Risques pénaux possibles</h4>
      <ul>
        <li>${term('tromperie')} ${term('article L.213-1 du Code de la consommation')} : jusqu’à 2 ans d’emprisonnement et 300 000 € d’amende ${term('sanctions pénales')} ;</li>
        <li>${term('faux et usage de faux')} ${term('articles 441-1 et suivants du Code pénal')} : jusqu’à 3 ans et 45 000 € ;</li>
        <li>${term('escroquerie')} ${term('article 313-1 du Code pénal')} : jusqu’à 5 ans et 375 000 € ;</li>
        <li>${term('mise en danger d’autrui')} ${term('article 223-1 du Code pénal')} : selon circonstances.</li>
      </ul>

      <h4>A.3. Limites pour l’acquéreur</h4>
      <ul>
        <li>pas de ${term('garantie légale de conformité')} si le vendeur n’est pas professionnel ;</li>
        <li>${term('charge de la preuve')} pesant sur l’acquéreur ;</li>
        <li>${term('délai bref')} pour l’action en vice caché ${term('article 1648 du Code civil')} ;</li>
        <li>possible ${term('clause de vente en l’état')}, opposable sauf mauvaise foi ${term('opposabilité de la clause')}.</li>
      </ul>
    `;

    html += `
      <h3>B. Si le vendeur est un professionnel</h3>
      <h4>B.1. Risques civils du professionnel</h4>
      <ul>
        <li>${term('garantie légale de conformité')} ${term('Code de la consommation')} : réparation, remplacement, réduction ou résolution ;</li>
        <li>${term('garantie des vices cachés')} avec ${term('présomption de connaissance')} du professionnel ${term('article 1645 du Code civil')} ;</li>
        <li>${term('responsabilité contractuelle')} ${term('article 1231-1 du Code civil')} ;</li>
        <li>${term('nullité pour dol')} ${term('article 1137 du Code civil')} en cas de réticence dolosive ;</li>
        <li>${term('manquement à l’obligation d’information précontractuelle')} ${term('article 1112-1 du Code civil')}.</li>
      </ul>

      <h4>B.2. Risques pénaux du professionnel</h4>
      <ul>
        <li>${term('tromperie')} ${term('article L.213-1 du Code de la consommation')} ;</li>
        <li>${term('pratique commerciale trompeuse')} ${term('Code de la consommation')} ;</li>
        <li>${term('pratique commerciale agressive')} ;</li>
        <li>${term('homicide involontaire')} ou ${term('blessures involontaires')} ${term('articles 221-6 et 222-19 du Code pénal')} si un défaut non révélé cause un accident ;</li>
        <li>${term('mise en danger d’autrui')} ${term('article 223-1 du Code pénal')}.</li>
      </ul>

      <h4>B.3. Risques administratifs</h4>
      <ul>
        <li>${term('sanctions DGCCRF')} ;</li>
        <li>${term('injonction de cesser')} sous ${term('astreinte')} ;</li>
        <li>${term('publication de la décision')} ;</li>
        <li>${term('retrait ou suspension d’agrément')} pour certaines activités réglementées.</li>
      </ul>

      <h4>B.4. Obligations renforcées du vendeur automobile</h4>
      <ul>
        <li>${term('obligation de délivrance conforme')} ;</li>
        <li>${term('obligation d’information renforcée')} ;</li>
        <li>${term('obligation de conseil')} ;</li>
        <li>${term('obligation de vérification des rappels')} ${term('Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485')} ;</li>
        <li>${term('obligation de traçabilité')} et ${term('transparence sur l’historique')}.</li>
      </ul>

      <div class="certainty-high">
        <strong>Appréciation :</strong> face à un professionnel, l’acquéreur bénéficie d’une protection plus étendue
        ${term('protection renforcée du consommateur')}, tandis que les risques du vendeur sont civils, pénaux et administratifs
        ${term('cumul des responsabilités')}.
      </div>
    `;

    if (recallData.hits.length || recallData.transversal.length) {
      html += `
        <h3>C. Impact potentiel des rappels identifiés</h3>
        <p>Sous réserve de vérification par VIN et par pièces ${term('vérification VIN', 'preuve documentaire')} :</p>
        <ul>
          <li>la connaissance du défaut par le constructeur peut renforcer la démonstration du ${term('caractère caché')} ;</li>
          <li>un rappel de sécurité peut caractériser la ${term('gravité du défaut')} ;</li>
          <li>la non-information du vendeur peut engager sa ${term('responsabilité pour défaut d’information')} ;</li>
          <li>un défaut de conception peut ouvrir une ${term('responsabilité du fait des produits défectueux')} ${term('articles 1245 et suivants du Code civil')}.</li>
        </ul>
        <div class="verification-needed">
          La seule existence d’un rappel ne suffit pas à établir automatiquement la responsabilité du vendeur dans le cas d’espèce
          ${term('non-automaticité de la responsabilité')}.
        </div>
      `;
    }

    return html;
  }

  function sectionCritères(flags) {
    let html = `<p><strong>Objet :</strong> examen prudent des trois critères cumulatifs ${term('critères cumulatifs', 'réunion cumulative')}.</p>`;

    html += `
      <h4>A. Antériorité</h4>
      <p>Le défaut doit exister au jour de la vente ${term('antériorité du défaut')}.</p>
      ${flags.defect ? `
        <div class="certainty-medium">
          <p>Des désordres sont rapportés, mais leur date d’apparition n’est pas établie avec certitude ${term('preuve de l’antériorité')}.</p>
          <ul>
            <li>${term('expertise technique')} pour dater l’origine ;</li>
            <li>${term('historique d’entretien')} ;</li>
            <li>${term('absence de mention dans les documents de vente')} ;</li>
            <li>${term('nature du défaut')} permettant d’écarter une cause postérieure.</li>
          </ul>
        </div>
      ` : `<div class="certainty-low"><p>Aucun élément d’antériorité n’est fourni ${term('défaut de preuve')}.</p></div>`}
    `;

    html += `
      <h4>B. Caractère caché</h4>
      <p>Le défaut doit être non apparent ${term('caractère caché', 'inapparence')}.</p>
      ${flags.defect ? `
        <div class="certainty-medium">
          <p>Le caractère caché peut être soutenu si le défaut n’était pas décelable par un examen attentif ${term('examen attentif', 'diligence de l’acquéreur')}.</p>
          <ul>
            <li>${term('absence de mention au contrôle technique')} ;</li>
            <li>${term('nécessité d’un test spécifique')} ;</li>
            <li>${term('compétences limitées de l’acquéreur')}.</li>
          </ul>
        </div>
      ` : `<div class="certainty-low"><p>Pas d’élément permettant d’établir l’inapparence ${term('défaut de preuve sur le caractère caché')}.</p></div>`}
    `;

    html += `
      <h4>C. Gravité</h4>
      <p>Le défaut doit rendre le bien impropre à l’usage ou diminuer tellement cet usage ${term('gravité du défaut', 'impropriété à l’usage')}.</p>
      ${flags.defect ? `
        <div class="certainty-medium">
          <p>La gravité devra être appréciée in concreto ${term('appréciation in concreto')} :</p>
          <ul>
            <li>${term('coût des réparations')} vs ${term('valeur vénale')} ;</li>
            <li>${term('atteinte à la sécurité')} ;</li>
            <li>${term('impossibilité d’usage normal')} ;</li>
            <li>${term('perte de valeur')}.</li>
          </ul>
        </div>
      ` : `<div class="certainty-low"><p>Pas d’élément de gravité établi ${term('défaut de preuve sur la gravité')}.</p></div>`}
    `;

    html += `
      <div class="certainty-low">
        <strong>Conclusion :</strong> la réunion des trois critères ne peut être affirmée sur la seule base des éléments fournis
        ${term('absence de certitude probatoire')}. Une ${term('expertise contradictoire')} et un ${term('examen documentaire')} sont nécessaires.
      </div>
    `;

    return html;
  }

  function sectionGaranties(flags) {
    let html = `<p><strong>Objet :</strong> régimes de garantie potentiellement invocables ${term('régimes de garantie')}.</p>`;

    if (flags.professional) {
      html += `
        <h4>A. Garantie légale de conformité</h4>
        <p>Applicable au vendeur professionnel ${term('vendeur professionnel')}.</p>
        <ul>
          <li>${term('délai de deux ans')} à compter de la délivrance ${term('Code de la consommation')} ;</li>
          <li>${term('présomption d’antériorité')} pendant les premiers mois ${term('présomption simple')} ;</li>
          <li>${term('réparation')} ou ${term('remplacement')} ;</li>
          <li>à défaut, ${term('réduction du prix')} ou ${term('résolution de la vente')}.</li>
        </ul>

        <h4>B. Obligation de délivrance conforme</h4>
        <p>${term('article 1604 du Code civil')} : le vendeur doit délivrer un bien conforme ${term('conformité du bien')}.</p>

        <h4>C. Responsabilité contractuelle</h4>
        <p>${term('article 1231-1 du Code civil')} : réparation du préjudice résultant de l’inexécution ${term('inexécution contractuelle')}.</p>

        <h4>D. Dol / réticence dolosive</h4>
        <p>${term('article 1137 du Code civil')} : nullité possible en cas de manœuvres ou réticences ${term('dol', 'réticence dolosive')}.</p>
      `;
    } else {
      html += `
        <h4>A. Garantie des vices cachés</h4>
        <p>Régime de droit commun applicable notamment aux ventes entre particuliers ${term('articles 1641 et suivants du Code civil')}.</p>
        <ul>
          <li>${term('action rédhibitoire')} ;</li>
          <li>${term('action estimatoire')} ;</li>
          <li>${term('dommages et intérêts')} en cas de mauvaise foi ${term('article 1645 du Code civil')}.</li>
        </ul>
      `;
    }

    if (flags.warranty) {
      html += `
        <h4>E. Garantie commerciale</h4>
        <p>Si une ${term('garantie commerciale')} existe, ses conditions doivent être lues ${term('conditions générales de vente')}.
        Elle peut se cumuler avec les garanties légales ${term('cumul des garanties')}.</p>
      `;
    }

    html += `<div class="verification-needed">Le régime définitif dépend de la preuve de la qualité du vendeur et de la chronologie ${term('qualification du vendeur', 'dies a quo')}.</div>`;
    return html;
  }

  function sectionTechnique(flags, recallData) {
    let html = `<p><strong>Objet :</strong> analyse technique méthodique ${term('analyse technique', 'méthodologie d’ingénierie')}.</p>`;

    html += `
      <h4>A. Méthode recommandée</h4>
      <ul>
        <li>${term('analyse fonctionnelle')} des fonctions dégradées ;</li>
        <li>${term('recherche de cause racine')} ${term('root cause analysis')} ;</li>
        <li>${term('lecture des codes défaut')} ${term('OBD', 'DTC')} ;</li>
        <li>${term('contrôle dimensionnel')} et ${term('analyse métallurgique')} si rupture ;</li>
        <li>${term('comparaison aux spécifications constructeur')} ${term('TSB', 'bulletins techniques')}.</li>
      </ul>

      <h4>B. Sous-systèmes à explorer</h4>
      <ul>
        <li>${term('groupe motopropulseur')} : moteur, boîte, embrayage, transmission ;</li>
        <li>${term('système de freinage')} : ABS, ESP, disques, plaquettes ;</li>
        <li>${term('direction')} et ${term('liaison au sol')} ;</li>
        <li>${term('système électrique')} : calculateurs, capteurs, faisceaux ;</li>
        <li>${term('sécurité passive')} : airbags, ceintures ;</li>
        <li>${term('dépollution')} : FAP, EGR, AdBlue ;</li>
        <li>${term('carrosserie/structure')} : corrosion, chocs antérieurs.</li>
      </ul>
    `;

    if (flags.safety) {
      html += `
        <div class="rappel-critical">
          <h4>⚠️ Alerte sécurité</h4>
          <p>Les éléments évoquent un risque potentiel pour la sécurité ${term('défaut de sécurité')}.</p>
          <ul>
            <li>immobilisation prudente du véhicule ${term('principe de précaution')} ;</li>
            <li>expertise rapide ${term('expertise technique')} ;</li>
            <li>signalement possible aux autorités ${term('DGCCRF')} ;</li>
            <li>responsabilité aggravée en cas de maintien en circulation ${term('faute aggravée')}.</li>
          </ul>
        </div>
      `;
    }

    if (recallData.hits.length) {
      html += `
        <h4>C. Correspondance avec problèmes connus</h4>
        <p>Certains désordres rapportés peuvent rejoindre des familles techniques déjà documentées ${term('problème récurrent', 'défaut de série')}.</p>
      `;
    }

    html += `<div class="verification-needed">Cette section ne remplace pas un diagnostic réalisé par un professionnel agréé ou un expert judiciaire ${term('expert judiciaire')}.</div>`;
    return html;
  }

  function sectionDocuments(flags) {
    let html = `<p><strong>Objet :</strong> analyse probatoire ${term('analyse probatoire', 'faisceau d’indices')}.</p>`;

    html += `<h4>A. Documents mentionnés</h4><ul>`;
    if (flags.invoice) html += `<li>${term('facture de vente')} : date, description du bien, clauses ${term('conditions contractuelles')}.</li>`;
    if (flags.repair) html += `<li>${term('ordre de réparation')} : chronologie, coûts, récurrence ${term('historique technique')}.</li>`;
    if (flags.controlTech) html += `<li>${term('contrôle technique')} : défauts relevés, date, limites du diagnostic ${term('rapport de contrôle')}.</li>`;
    if (!flags.invoice && !flags.repair && !flags.controlTech) html += `<li>Aucun document précis mentionné ${term('insuffisance probatoire')}.</li>`;
    html += `</ul>`;

    html += `
      <h4>B. Documents à rechercher</h4>
      <ul>
        <li>${term('bon de commande')} ;</li>
        <li>${term('certificat de cession')} ;</li>
        <li>${term('carte grise')} ;</li>
        <li>${term('carnet d’entretien')} ;</li>
        <li>${term('factures d’atelier')} ;</li>
        <li>${term('rapport de contrôle technique')} ;</li>
        <li>${term('preuve de réalisation des rappels')} ;</li>
        <li>${term('échanges écrits')} avec le vendeur ${term('preuve écrite')} ;</li>
        <li>${term('devis de réparation')} ${term('évaluation du préjudice')}.</li>
      </ul>

      <h4>C. Portée probatoire</h4>
      <ul>
        <li>les documents manquants du professionnel peuvent fonder des ${term('présomptions de faute')} ;</li>
        <li>les écrits de l’acquéreur doivent être conservés ${term('intégrité des preuves')} ;</li>
        <li>la chronologie est déterminante ${term('dies a quo', 'antériorité')}.</li>
      </ul>
    `;

    return html;
  }

  function sectionRappels(recallData) {
    let html = `<p><strong>Objet :</strong> rappels constructeurs et problèmes connus potentiellement concernés ${term('campagnes de rappel', 'problèmes récurrents')}.</p>`;

    if (recallData.hits.length) {
      html += `<h4>A. Rappels identifiés par marque/modèle/année</h4>`;
      recallData.hits.forEach((r) => {
        const cls = r.severity === 'critique' ? 'rappel-critical' : 'rappel-info';
        html += `
          <div class="${cls}">
            <h4>${escapeHtml(r.issue)} (${escapeHtml(r.years)})</h4>
            <p><strong>Constructeur :</strong> ${escapeHtml(r.constructeur)}</p>
            <p><strong>Modèles :</strong> ${escapeHtml(r.models)}</p>
            <p><strong>Description :</strong> ${escapeHtml(r.detail)}</p>
            <p><strong>Référence :</strong> ${escapeHtml(r.ref)}</p>
          </div>
        `;
      });
    }

    if (recallData.transversal.length) {
      html += `<h4>B. Problèmes transversaux</h4>`;
      recallData.transversal.forEach((t) => {
        html += `
          <div class="rappel-critical">
            <h4>⚠️ ${escapeHtml(t.name)} (${escapeHtml(t.years)})</h4>
            <p>${escapeHtml(t.detail)}</p>
            <p><strong>Marques :</strong> ${escapeHtml(t.brands.join(', '))}</p>
            <p><strong>Référence :</strong> ${escapeHtml(t.ref)}</p>
          </div>
        `;
      });
    }

    html += `
      <h4>C. Portage juridique prudent</h4>
      <ul>
        <li>le rappel peut renforcer le ${term('caractère caché')} ;</li>
        <li>le rappel de sécurité peut caractériser la ${term('gravité')} ;</li>
        <li>la connaissance par le constructeur peut nourrir la preuve du ${term('défaut de conception')} ;</li>
        <li>le vendeur professionnel peut avoir manqué à son ${term('obligation de vérification des rappels')}.</li>
      </ul>
      <div class="verification-needed">
        Vérifier impérativement par VIN si le véhicule est visé, si le rappel a été réalisé, et si le désordre constaté correspond au rappel ${term('corrélation technique')}.
      </div>
    `;

    return html;
  }

  function sectionJurisprudence() {
    return `
      <p><strong>Objet :</strong> repères jurisprudentiels et doctrinaux ${term('jurisprudence de référence', 'doctrine')}.</p>

      <h4>A. Vente et conformité</h4>
      <ul>
        <li>${term('article 1582 du Code civil')} : définition de la vente ;</li>
        <li>${term('article 1604 du Code civil')} : obligation de délivrance ;</li>
        <li>${term('articles 1641 et suivants du Code civil')} : vices cachés ;</li>
        <li>${term('Code de la consommation')} : garantie légale de conformité pour les professionnels.</li>
      </ul>

      <h4>B. Information et dol</h4>
      <ul>
        <li>${term('article 1112-1 du Code civil')} : information précontractuelle ;</li>
        <li>${term('article 1137 du Code civil')} : dol ;</li>
        <li>${term('réticence dolosive')} : dissimulation d’information déterminante.</li>
      </ul>

      <h4>C. Responsabilité du fait des produits</h4>
      <ul>
        <li>${term('articles 1245 et suivants du Code civil')} : produits défectueux ;</li>
        <li>${term('défaut de conception')} ;</li>
        <li>${term('responsabilité du constructeur')}.</li>
      </ul>

      <h4>D. Jurisprudence souvent citée</h4>
      <ul>
        <li>${term('Cass. civ. 1ère, 3 mai 2006, n° 03-18.852')} : appréciation du caractère caché selon l’acquéreur ;</li>
        <li>${term('Cass. civ. 1ère, 17 janvier 2006, n° 03-15.694')} : gravité appréciée in concreto ;</li>
        <li>${term('Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485')} : obligation de vérification des rappels par le professionnel.</li>
      </ul>

      <div class="verification-needed">
        Les références doivent être actualisées et vérifiées au cas d’espèce ${term('actualité jurisprudentielle')}.
      </div>
    `;
  }

  function sectionPrejudice(flags) {
    return `
      <p><strong>Objet :</strong> catégories de préjudice potentiellement invocables ${term('évaluation du préjudice', 'réparation intégrale')}.</p>

      <h4>A. Préjudice économique</h4>
      <ul>
        <li>${term('frais de réparation')} ;</li>
        <li>${term('moins-value')} / ${term('perte de valeur')} ;</li>
        <li>${term('frais d’expertise')} ;</li>
        <li>${term('frais de location')} d’un véhicule de remplacement ;</li>
        <li>${term('manque à gagner')} si usage professionnel ;</li>
        <li>${term('frais de justice')} dans les limites légales.</li>
      </ul>

      <h4>B. Préjudice moral</h4>
      <ul>
        <li>${term('préjudice d’anxiété')} en cas d’insécurité ;</li>
        <li>${term('trouble dans les conditions d’existence')} ;</li>
        <li>${term('perte de temps')} et démarches.</li>
      </ul>

      ${flags.safety ? `
        <h4>C. Préjudice corporel éventuel</h4>
        <ul>
          <li>${term('souffrances endurées')} ${term('pretium doloris')} ;</li>
          <li>${term('déficit fonctionnel temporaires ou permanents')} ;</li>
          <li>${term('préjudice esthétique')}.</li>
        </ul>
      ` : ''}

      <div class="verification-needed">
        L’évaluation chiffrée nécessite devis, factures, expertise et, le cas échéant, expertise médicale ${term('preuve du préjudice')}.
      </div>
    `;
  }

  function sectionStrategie(flags, recallData, objective) {
    let html = `<p><strong>Objet :</strong> stratégie prudente, amiable puis contentieuse ${term('stratégie contentieuse', 'modes alternatifs de règlement des différends')}.</p>`;

    html += `
      <h4>A. Phase amiable</h4>
      <ul>
        <li>${term('mise en demeure')} par ${term('lettre recommandée avec accusé de réception')} ;</li>
        <li>${term('conciliation')} ou ${term('médiation')} ${term('médiateur de la consommation')} ;</li>
        <li>${term('expertise amiable contradictoire')}.</li>
      </ul>

      <h4>B. Phase contentieuse</h4>
      <ul>
        <li>${term('assignation')} devant la juridiction compétente ${term('tribunal judiciaire')} ;</li>
        <li>${term('demande d’expertise judiciaire')} ${term('article 143 et suivants du Code de procédure civile')} ;</li>
        <li>le cas échéant, ${term('référé')} en cas d’urgence ${term('article 834 du Code de procédure civile')} ;</li>
        <li>${term('mesures conservatoires')} si risque d’insolvabilité ${term('saisie conservatoire')}.</li>
      </ul>

      <h4>C. Choix du fondement</h4>
      <ul>
        <li>si professionnel : ${term('garantie légale de conformité')} en priorité ${term('action principale')} ;</li>
        <li>subsidiairement : ${term('garantie des vices cachés')} ${term('action subsidiaire')} ;</li>
        <li>si dissimulation : ${term('nullité pour dol')} et ${term('dommages et intérêts')} ;</li>
        <li>si défaut de conception : ${term('responsabilité du fait des produits défectueux')} contre le constructeur.</li>
      </ul>
    `;

    if (recallData.hits.length || recallData.transversal.length) {
      html += `
        <h4>D. Voie liée aux rappels</h4>
        <ul>
          <li>vérification VIN ${term('preuve technique')} ;</li>
          <li>recherche d’${term('action de groupe')} ou d’actions collectives ${term('action collective')} ;</li>
          <li>signalement ${term('DGCCRF')} si danger ${term('sécurité des produits')}.</li>
        </ul>
      `;
    }

    if (objective) {
      html += `<h4>E. Objectif déclaré</h4><p>${escapeHtml(objective)}</p>`;
    }

    html += `<div class="verification-needed">La stratégie doit être validée par un avocat au regard des pièces, délais et coût d’opportunité ${term('intérêt à agir')}.</div>`;
    return html;
  }

  function sectionVerification(recallData) {
    let html = `<p><strong>Objet :</strong> points de vérification indispensables ${term('vérifications complémentaires')}.</p>`;

    html += `
      <h4>A. Techniques</h4>
      <ul>
        <li>${term('expertise contradictoire')} ;</li>
        <li>${term('lecture OBD')} et codes défaut ;</li>
        <li>${term('contrôle technique')} actualisé ;</li>
        <li>${term('essai routier')} si pertinent.</li>
      </ul>

      <h4>B. Documentaires</h4>
      <ul>
        <li>${term('facture')} et ${term('CGV')} ;</li>
        <li>${term('historique d’entretien')} ;</li>
        <li>${term('certificat de rappel')} ;</li>
        <li>${term('échanges écrits')}.</li>
      </ul>

      <h4>C. Juridiques</h4>
      <ul>
        <li>${term('qualité du vendeur')} ;</li>
        <li>${term('date de vente')} et ${term('délais de prescription')} ;</li>
        <li>${term('compétence juridictionnelle')} ;</li>
        <li>${term('recevabilité des actions')}.</li>
      </ul>
    `;

    if (recallData.hits.length) {
      html += `
        <h4>D. Rappels</h4>
        <ul>
          <li>vérifier le VIN sur les bases officielles ${term('Sécurité Routière')} ;</li>
          <li>demander la preuve de réalisation ${term('charge de la preuve')} ;</li>
          <li>vérifier la correspondance exacte du désordre ${term('lien de causalité technique')}.</li>
        </ul>
      `;
    }

    return html;
  }

  function sectionVoies(flags, recallData) {
    let html = `<p><strong>Objet :</strong> voies d’action possibles, sans garantie de succès ${term('voies d’action')}.</p>`;

    html += `
      <h4>A. Contre le vendeur</h4>
      <ul>
        <li>${term('action en garantie légale de conformité')} si professionnel ;</li>
        <li>${term('action en garantie des vices cachés')} ;</li>
        <li>${term('action en résolution')} ;</li>
        <li>${term('action en réduction du prix')} ;</li>
        <li>${term('action en dommages et intérêts')} ;</li>
        <li>${term('action en nullité pour dol')} si dissimulation caractérisée.</li>
      </ul>
    `;

    if (flags.professional) {
      html += `
        <h4>B. Voies complémentaires contre un professionnel</h4>
        <ul>
          <li>${term('signalement DGCCRF')} ;</li>
          <li>${term('médiation de la consommation')} ;</li>
          <li>${term('action pour clause abusive')}.</li>
        </ul>
      `;
    }

    if (recallData.hits.length || recallData.transversal.length) {
      html += `
        <h4>C. Contre le constructeur</h4>
        <ul>
          <li>${term('responsabilité du fait des produits défectueux')} ;</li>
          <li>${term('action collective')} si existante ;</li>
          <li>${term('signalement de sécurité')}.</li>
        </ul>
      `;
    }

    html += `<div class="verification-needed">Chaque voie suppose d’évaluer coût, délai, preuve et opportunité ${term('analyse coût/bénéfice')}.</div>`;
    return html;
  }

  function sectionConclusion(objective, recallData) {
    let html = `<p><strong>Objet :</strong> synthèse prudente ${term('synthèse', 'conclusion provisoire')}.</p>`;

    html += `
      <h4>A. Ce que les éléments permettent de dire</h4>
      <ul>
        <li>des faits sont rapportés, sans être encore vérifiés ${term('faits allégués')} ;</li>
        <li>plusieurs qualifications juridiques sont potentiellement envisageables ${term('qualifications alternatives')} ;</li>
        ${recallData.hits.length || recallData.transversal.length ? '<li>des rappels ou problèmes connus pourraient utilement être rapprochés du cas ${term(‘corrélation technique’)}</li>' : ''}
        <li>la stratégie dépendra surtout de la qualité du vendeur ${term('vendeur professionnel', 'vendeur particulier')}.</li>
      </ul>

      <h4>B. Ce qu’il ne faut pas affirmer</h4>
      <ul>
        <li>pas de certitude sur l’${term('antériorité')} sans expertise ;</li>
        <li>pas de certitude sur le ${term('caractère caché')} sans examen des pièces ;</li>
        <li>pas de certitude sur la ${term('gravité')} sans évaluation coût/valeur/sécurité ;</li>
        <li>pas de garantie de succès judiciaire ${term('aléa de preuve')}.</li>
      </ul>

      <h4>C. Recommandations immédiates</h4>
      <ul>
        <li>constituer un ${term('dossier probatoire')} complet ;</li>
        <li>sécuriser les ${term('preuves écrites')} ;</li>
        <li>faire réaliser une ${term('expertise contradictoire')} ;</li>
        <li>vérifier les ${term('rappels constructeurs')} par VIN ;</li>
        <li>adresser une ${term('mise en demeure')} motivée ;</li>
        <li>consulter un ${term('avocat spécialisé')} en droit de la consommation / automobile.</li>
      </ul>
    `;

    if (objective) {
      html += `<h4>D. Au regard de l’objectif</h4><p>${escapeHtml(objective)}</p>`;
    }

    html += `
      <div class="certainty-low">
        <strong>Avertissement final :</strong> ce document est une aide à la rédaction. Il ne constitue pas un conseil juridique personnalisé
        ${term('non-conseil juridique')} et ne dispense pas de l’examen d’un professionnel du droit ${term('professionnel du droit')}.
      </div>
    `;

    return html;
  }

  function sectionLexique() {
    const LEXIQUE = {
      'vente': 'Contrat par lequel un vendeur transfère la propriété d’un bien à un acquéreur moyennant un prix.',
      'bien meuble corporel': 'Bien matériel pouvant être déplacé.',
      'article 1582 du Code civil': 'Article définissant la vente.',
      'droit commun des obligations': 'Règles générales applicables aux obligations.',
      'droit de la consommation': 'Droit protecteur du consommateur face au professionnel.',
      'ordre public de protection': 'Règles impératives protégeant une partie faible.',
      'vendeur professionnel': 'Personne agissant dans le cadre de son activité professionnelle.',
      'relation B2C': 'Relation professionnel-consommateur.',
      'vente entre particuliers': 'Vente conclue entre deux non-professionnels.',
      'relation C2C': 'Relation entre consommateurs.',
      'garantie des vices cachés': 'Garantie légale des articles 1641 et suivants du Code civil.',
      'articles 1641 et suivants du Code civil': 'Régime des vices cachés.',
      'action rédhibitoire': 'Action en résolution pour vice caché.',
      'action estimatoire': 'Action en réduction du prix pour vice caché.',
      'article 1644 du Code civil': 'Article offrant le choix entre résolution et réduction.',
      'article 1645 du Code civil': 'Article relatif à la mauvaise foi du vendeur.',
      'article 1646 du Code civil': 'Article relatif aux frais d’expertise.',
      'article 1648 du Code civil': 'Article relatif au délai de l’action en vice caché.',
      'mauvaise foi': 'Connaissance du vice par le vendeur.',
      'dommages et intérêts': 'Réparation pécuniaire du préjudice.',
      'frais d’expertise': 'Coûts de l’expertise.',
      'tromperie': 'Infraction portant sur la tromperie quant aux qualités du bien.',
      'article L.213-1 du Code de la consommation': 'Texte réprimant la tromperie.',
      'faux et usage de faux': 'Falsification et utilisation d’un document faux.',
      'articles 441-1 et suivants du Code pénal': 'Textes réprimant le faux.',
      'escroquerie': 'Obtention indue par manœuvres frauduleuses.',
      'article 313-1 du Code pénal': 'Texte définissant l’escroquerie.',
      'mise en danger d’autrui': 'Exposition d’autrui à un risque immédiat.',
      'article 223-1 du Code pénal': 'Texte réprimant la mise en danger.',
      'garantie légale de conformité': 'Garantie applicable au vendeur professionnel.',
      'renversement de la charge de la preuve': 'Mécanisme probatoire défavorable au professionnel.',
      'obligation d’information renforcée': 'Devoir d’information accru du professionnel.',
      'interdiction des clauses abusives': 'Régime protecteur contre les clauses déséquilibrées.',
      'charge de la preuve': 'Obligation d’établir les faits que l’on invoque.',
      'délai bref': 'Délai de prescription court.',
      'clause de vente en l’état': 'Clause limitant la garantie, encadrée juridiquement.',
      'opposabilité de la clause': 'Possibilité d’invoquer une clause.',
      'responsabilité contractuelle': 'Responsabilité née du contrat.',
      'article 1231-1 du Code civil': 'Régime de la responsabilité contractuelle.',
      'nullité pour dol': 'Sanction d’un vice du consentement par manœuvre ou réticence.',
      'article 1137 du Code civil': 'Texte relatif au dol.',
      'réticence dolosive': 'Dissimulation intentionnelle d’une information déterminante.',
      'manquement à l’obligation d’information précontractuelle': 'Défaut d’information avant contrat.',
      'article 1112-1 du Code civil': 'Obligation d’information précontractuelle.',
      'pratique commerciale trompeuse': 'Pratique induisant le consommateur en erreur.',
      'pratique commerciale agressive': 'Pratique altérant la liberté de choix du consommateur.',
      'homicide involontaire': 'Infraction pénale en cas de décès par imprudence.',
      'blessures involontaires': 'Infraction pénale en cas de lésions par imprudence.',
      'articles 221-6 et 222-19 du Code pénal': 'Textes réprimant les atteintes involontaires.',
      'sanctions DGCCRF': 'Sanctions administratives en matière de consommation.',
      'injonction de cesser': 'Ordre administratif de mettre fin à une pratique.',
      'astreinte': 'Somme due en cas de retard d’exécution.',
      'publication de la décision': 'Mesure administrative de publicité.',
      'retrait ou suspension d’agrément': 'Sanction administrative d’activité.',
      'obligation de délivrance conforme': 'Devoir de remettre un bien conforme.',
      'article 1604 du Code civil': 'Obligation de délivrance.',
      'obligation de conseil': 'Devoir d’accompagner l’acquéreur.',
      'obligation de vérification des rappels': 'Devoir de contrôler les campagnes constructeur.',
      'Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485': 'Arrêt souvent cité sur les rappels.',
      'obligation de traçabilité': 'Devoir de conserver l’historique technique.',
      'transparence sur l’historique': 'Communication exhaustive de la vie du véhicule.',
      'cumul des responsabilités': 'Possibilité de combiner plusieurs fondements.',
      'responsabilité du fait des produits défectueux': 'Régime de la responsabilité du producteur.',
      'articles 1245 et suivants du Code civil': 'Produits défectueux.',
      'vérification VIN': 'Contrôle par numéro de série.',
      'caractère caché': 'Défaut non apparent.',
      'gravité du défaut': 'Importance du désordre.',
      'responsabilité pour défaut d’information': 'Mise en cause pour omission d’information.',
      'non-automaticité de la responsabilité': 'La responsabilité doit être démontrée cas par cas.',
      'éléments factuels': 'Faits matériels rapportés.',
      'constats non vérifiés': 'Éléments soumis à contrôle.',
      'VIN': 'Numéro d’identification du véhicule.',
      'identification du véhicule': 'Détermination précise du bien.',
      'faits non vérifiés': 'Faits allégués non établis.',
      'absence d’expertise': 'Défaut de vérification technique indépendante.',
      'expertise contradictoire': 'Expertise réalisée en présence des parties.',
      'principe du contradictoire': 'Chaque partie doit pouvoir discuter les éléments.',
      'antériorité': 'Existence antérieure du défaut.',
      'lien de causalité': 'Relation entre cause et dommage.',
      'qualification juridique': 'Rattachement des faits à une catégorie de droit.',
      'droit français': 'Droit applicable en France.',
      'qualification incertaine': 'Absence de certitude sur la catégorie juridique.',
      'jurisprudence': 'Ensemble des décisions de justice.',
      'Cour de cassation': 'Juridiction suprême de l’ordre judiciaire.',
      'qualifications alternatives': 'Plusieurs qualifications envisageables.',
      'défaut de conformité': 'Non-conformité du bien.',
      'défaut de délivrance conforme': 'Manquement à l’obligation de délivrance.',
      'manquement à l’obligation d’information': 'Défaut d’information.',
      'vice caché': 'Défaut caché au sens du Code civil.',
      'faisceau d’indices': 'Ensemble d’éléments convergents.',
      'qualification du vendeur': 'Détermination du statut du vendeur.',
      'absence de qualification du vendeur': 'Statut non établi.',
      'absence de désordre caractérisé': 'Pas de problème identifié.',
      'risques encourus': 'Conséquences potentielles.',
      'responsabilités': 'Obligations de répondre d’un dommage.',
      'qualité du vendeur': 'Statut juridique du vendeur.',
      'action rédhibitoire': 'Action en résolution.',
      'restitution': 'Retour des prestations.',
      'sanctions pénales': 'Peines prononcées par un juge pénal.',
      'garantie légale de conformité': 'Régime protecteur du consommateur.',
      'présomption de connaissance': 'Le professionnel est présumé connaître les défauts.',
      'Code de la consommation': 'Texte protecteur du consommateur.',
      'délai de deux ans': 'Délai de la garantie légale de conformité.',
      'présomption d’antériorité': 'Présomption selon laquelle le défaut existait déjà.',
      'présomption simple': 'Présomption pouvant être renversée.',
      'réparation': 'Remise en état.',
      'remplacement': 'Échange du bien.',
      'réduction du prix': 'Diminution du prix.',
      'résolution de la vente': 'Annulation rétroactive.',
      'conformité du bien': 'Adéquation du bien aux attentes.',
      'inexécution contractuelle': 'Non-exécution des obligations.',
      'dol': 'Manœuvre ou réticence dolosive.',
      'garantie commerciale': 'Garantie conventionnelle.',
      'conditions générales de vente': 'Document contractuel standard.',
      'cumul des garanties': 'Combinaison de plusieurs garanties.',
      'dies a quo': 'Point de départ d’un délai.',
      'preuve de l’antériorité': 'Établissement de l’origine antérieure.',
      'expertise technique': 'Examen par un spécialiste.',
      'historique d’entretien': 'Suivi des interventions.',
      'absence de mention dans les documents de vente': 'Silence documentaire.',
      'nature du défaut': 'Caractéristique technique du désordre.',
      'examen attentif': 'Vérification soigneuse.',
      'diligence de l’acquéreur': 'Attention raisonnable de l’acheteur.',
      'absence de mention au contrôle technique': 'Silence du CT.',
      'nécessité d’un test spécifique': 'Détection par essai particulier.',
      'compétences limitées de l’acquéreur': 'Non-professionnalisme de l’acheteur.',
      'appréciation in concreto': 'Appréciation au cas par cas.',
      'coût des réparations': 'Prix de la remise en état.',
      'valeur vénale': 'Valeur marchande.',
      'atteinte à la sécurité': 'Risque pour les personnes.',
      'impossibilité d’usage normal': 'Le bien ne sert plus normalement.',
      'perte de valeur': 'Moins-value.',
      'absence de certitude probatoire': 'Preuve insuffisante.',
      'examen documentaire': 'Analyse des pièces.',
      'régimes de garantie': 'Ensembles de règles protectrices.',
      'analyse technique': 'Examen d’ingénierie.',
      'méthodologie d’ingénierie': 'Méthode structurée.',
      'analyse fonctionnelle': 'Étude des fonctions du système.',
      'recherche de cause racine': 'Identification de l’origine première.',
      'root cause analysis': 'Méthode RCA.',
      'lecture des codes défaut': 'Lecture OBD.',
      'OBD': 'Diagnostic embarqué.',
      'DTC': 'Codes de défaut.',
      'contrôle dimensionnel': 'Vérification des cotes.',
      'analyse métallurgique': 'Étude des ruptures métal.',
      'comparaison aux spécifications constructeur': 'Référentiel technique.',
      'TSB': 'Bulletins techniques constructeur.',
      'bulletins techniques': 'Documents du constructeur.',
      'groupe motopropulseur': 'Moteur et transmission.',
      'système de freinage': 'Freins, ABS, ESP.',
      'direction': 'Organe de pilotage.',
      'liaison au sol': 'Suspension et trains roulants.',
      'système électrique': 'Calculateurs et capteurs.',
      'sécurité passive': 'Airbags, ceintures.',
      'dépollution': 'FAP, EGR, AdBlue.',
      'carrosserie/structure': 'Châssis et tôlerie.',
      'défaut de sécurité': 'Risque d’accident.',
      'principe de précaution': 'Méthode évitant le risque.',
      'DGCCRF': 'Autorité de concurrence et consommation.',
      'faute aggravée': 'Manquement particulièrement grave.',
      'problème récurrent': 'Défaut fréquent.',
      'défaut de série': 'Défaut touchant une série.',
      'expert judiciaire': 'Expert inscrit près une cour.',
      'analyse probatoire': 'Étude des preuves.',
      'conditions contractuelles': 'Clauses du contrat.',
      'historique technique': 'Suivi des interventions.',
      'rapport de contrôle': 'Document du contrôle technique.',
      'insuffisance probatoire': 'Preuves insuffisantes.',
      'bon de commande': 'Document de commande.',
      'certificat de cession': 'Document de transfert.',
      'carte grise': 'Certificat d’immatriculation.',
      'carnet d’entretien': 'Suivi d’entretien.',
      'factures d’atelier': 'Preuves de réparations.',
      'preuve de réalisation des rappels': 'Attestation de rappel.',
      'échanges écrits': 'Courriers, emails.',
      'preuve écrite': 'Preuve par écrit.',
      'devis de réparation': 'Estimation chiffrée.',
      'évaluation du préjudice': 'Chiffrage du dommage.',
      'présomptions de faute': 'Indices de manquement.',
      'intégrité des preuves': 'Conservation des pièces.',
      'campagnes de rappel': 'Rappels constructeurs.',
      'problèmes récurrents': 'Défauts fréquents.',
      'corrélation technique': 'Rapprochement technique.',
      'jurisprudence de référence': 'Décisions de repère.',
      'doctrine': 'Travaux des auteurs.',
      'actualité jurisprudentielle': 'État récent de la jurisprudence.',
      'moins-value': 'Perte de valeur.',
      'frais de location': 'Location de remplacement.',
      'manque à gagner': 'Perte de revenus.',
      'frais de justice': 'Dépens et honoraires.',
      'préjudice d’anxiété': 'Souffrance psychologique.',
      'trouble dans les conditions d’existence': 'Gêne quotidienne.',
      'perte de temps': 'Temps perdu.',
      'souffrances endurées': 'Pretium doloris.',
      'pretium doloris': 'Prix de la douleur.',
      'déficit fonctionnel temporaires ou permanents': 'Séquelles physiques/psychiques.',
      'préjudice esthétique': 'Atteinte à l’apparence.',
      'preuve du préjudice': 'Établissement du dommage.',
      'stratégie contentieuse': 'Plan d’action judiciaire.',
      'modes alternatifs de règlement des différends': 'MARD.',
      'mise en demeure': 'Somme formelle.',
      'lettre recommandée avec accusé de réception': 'Forme probatoire.',
      'conciliation': 'Règlement amiable assisté.',
      'médiation': 'Processus amiable structuré.',
      'médiateur de la consommation': 'Médiateur agréé.',
      'expertise amiable contradictoire': 'Expertise non judiciaire entre parties.',
      'assignation': 'Acte introductif d’instance.',
      'tribunal judiciaire': 'Juridiction de droit commun.',
      'demande d’expertise judiciaire': 'Mesure d’instruction.',
      'article 143 et suivants du Code de procédure civile': 'Expertise judiciaire.',
      'référé': 'Procédure d’urgence.',
      'article 834 du Code de procédure civile': 'Référé.',
      'mesures conservatoires': 'Sûretés procédurales.',
      'saisie conservatoire': 'Blocage de biens.',
      'action principale': 'Fondement prioritaire.',
      'action subsidiaire': 'Fondement de repli.',
      'preuve technique': 'Élément technique de preuve.',
      'action de groupe': 'Action collective consommation.',
      'action collective': 'Regroupement de victimes.',
      'sécurité des produits': 'Régime de sécurité.',
      'intérêt à agir': 'Condition de recevabilité.',
      'vérifications complémentaires': 'Contrôles additionnels.',
      'lecture OBD': 'Diagnostic électronique.',
      'essai routier': 'Test en circulation.',
      'CGV': 'Conditions générales de vente.',
      'Sécurité Routière': 'Site officiel des rappels.',
      'lien de causalité technique': 'Corrélation cause/dommage.',
      'voies d’action': 'Options juridiques.',
      'signalement de sécurité': 'Alerte autorité.',
      'analyse coût/bénéfice': 'Arbitrage stratégique.',
      'synthèse': 'Résumé structuré.',
      'conclusion provisoire': 'Conclusion non définitive.',
      'faits allégués': 'Faits annoncés, non prouvés.',
      'corrélation technique': 'Rapprochement des désordres.',
      'aléa de preuve': 'Risque probatoire.',
      'dossier probatoire': 'Ensemble des preuves.',
      'avocat spécialisé': 'Conseil juridique compétent.',
      'non-conseil juridique': 'Document informatif.',
      'professionnel du droit': 'Avocat, magicien du droit, juriste qualifié.'
    };

    const terms = Array.from(termesMobilises).sort();
    let html = `<p><strong>Objet :</strong> lexique des termes mobilisés ${term('lexique', 'terminologie juridique', 'terminologie technique')}.</p>`;
    html += `<p><strong>Nombre de termes mobilisés :</strong> ${terms.length}</p>`;
    html += `<div class="lexique-section">`;

    if (!terms.length) {
      html += `<p>Aucun terme spécifique n’a été mobilisé.</p>`;
    } else {
      terms.forEach((t) => {
        const def = LEXIQUE[t] || 'Terme juridique ou technique mobilisé dans l’analyse.';
        html += `
          <div class="lexique-item">
            <div class="lexique-terme">${escapeHtml(t)}</div>
            <div class="lexique-definition">${escapeHtml(def)}</div>
          </div>
        `;
      });
    }

    html += `</div>`;
    html += `<div class="verification-needed">Les définitions sont indicatives et ne remplacent pas les textes officiels ou l’avis d’un professionnel du droit ${term('référence aux textes officiels')}.</div>`;
    return html;
  }

  // =====================================================
  // ADMIN PANEL
  // =====================================================
  $('#adminPanelBtn').addEventListener('click', () => {
    if (currentUser?.role !== 'admin') return;
    $('#adminPanel').classList.remove('hidden');
    renderAdmin();
  });

  $('#closeAdminBtn').addEventListener('click', () => {
    $('#adminPanel').classList.add('hidden');
  });

  $$('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.admin-tab').forEach((b) => b.classList.remove('active'));
      $$('.admin-pane').forEach((p) => p.classList.remove('active'));
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
    const pending = getRequests().filter((r) => r.status === 'pending');
    if (!pending.length) {
      box.innerHTML = '<p class="muted">Aucune demande en attente.</p>';
      return;
    }

    box.innerHTML = pending.map((r) => `
      <div class="card pending">
        <div>
          <strong>${escapeHtml(r.name)}</strong><br>
          <small>${escapeHtml(r.email)} • ${escapeHtml(r.date)}</small>
          <p>${escapeHtml(r.reason)}</p>
        </div>
        <div class="actions">
          <button class="btn-ok" data-action="approve" data-id="${escapeHtml(r.id)}">Accepter</button>
          <button class="btn-no" data-action="refuse" data-id="${escapeHtml(r.id)}">Refuser</button>
        </div>
      </div>
    `).join('');
  }

  function renderUsers() {
    const box = $('#authorizedUsers');
    const users = getUsers().filter((u) => u.role !== 'admin');
    if (!users.length) {
      box.innerHTML = '<p class="muted">Aucun tiers enregistré.</p>';
      return;
    }

    box.innerHTML = users.map((u) => `
      <div class="card ${escapeHtml(u.status)}">
        <div>
          <strong>${escapeHtml(u.name)}</strong><br>
          <small>${escapeHtml(u.email)} • statut : ${escapeHtml(u.status)}</small>
        </div>
        <div class="actions">
          ${u.status === 'approved' ? `<button class="btn-warn" data-action="revoke" data-email="${escapeHtml(u.email)}" data-name="${escapeHtml(u.name)}">Révoquer</button>` : ''}
          ${u.status !== 'approved' ? `<button class="btn-ok" data-action="restore" data-email="${escapeHtml(u.email)}" data-name="${escapeHtml(u.name)}">Rétablir</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderStats() {
    const users = getUsers();
    const requests = getRequests();
    const today = todayKey();

    const approved = users.filter((u) => u.status === 'approved' && u.role !== 'admin').length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const blocked = users.filter((u) => u.status !== 'approved' && u.role !== 'admin').length + requests.filter((r) => r.status === 'refused').length;
    const analysesToday = users.reduce((sum, u) => sum + (u.daily && u.daily.date === today ? u.daily.count : 0), 0);

    $('#statsContent').innerHTML = `
      <div class="stat"><span>Tiers autorisés</span><b>${approved}</b></div>
      <div class="stat"><span>Demandes en attente</span><b>${pending}</b></div>
      <div class="stat"><span>Refusés / révoqués</span><b>${blocked}</b></div>
      <div class="stat"><span>Analyses tiers aujourd’hui</span><b>${analysesToday}</b></div>
      <div class="stat"><span>Limite par tiers</span><b>${MAX_DAILY_ANALYSES}/jour</b></div>
    `;
  }

  $('#adminPanel').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === 'approve' || action === 'refuse') {
      const id = btn.dataset.id;
      const requests = getRequests();
      const req = requests.find((r) => r.id === id);
      if (!req) return;

      req.status = action === 'approve' ? 'approved' : 'refused';
      req.decisionDate = new Date().toLocaleString('fr-FR');
      saveRequests(requests);

      if (action === 'approve') {
        upsertUser({
          id: req.id || uid(),
          name: req.name,
          email: req.email,
          role: 'user',
          status: 'approved',
          approvedDate: req.decisionDate,
          daily: { date: todayKey(), count: 0 }
        });
        notify('Accès approuvé', `${req.name} peut désormais se connecter.`);
      }

      renderAdmin();
      toast(action === 'approve' ? 'Demande acceptée.' : 'Demande refusée.', action === 'approve' ? 'success' : 'warning');
      return;
    }

    if (action === 'revoke' || action === 'restore') {
      const email = btn.dataset.email;
      const name = btn.dataset.name;
      const users = getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.name.toLowerCase() === name.toLowerCase());
      if (!user) return;

      user.status = action === 'revoke' ? 'revoked' : 'approved';
      if (action === 'revoke') user.revokedDate = new Date().toLocaleString('fr-FR');
      saveUsers(users);

      const requests = getRequests();
      const req = requests.find((r) => r.email.toLowerCase() === email.toLowerCase() && r.name.toLowerCase() === name.toLowerCase());
      if (req) req.status = user.status;
      saveRequests(requests);

      renderAdmin();
      toast(action === 'revoke' ? 'Accès révoqué.' : 'Accès rétabli.', action === 'revoke' ? 'warning' : 'success');
    }
  });

  // =====================================================
  // EXPORT / IMPORT / APK / INSTALL
  // =====================================================
  $('#exportDataBtn').addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      users: getUsers(),
      requests: getRequests()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aide-redactionnelle-donnees.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Données exportées.', 'success');
  });

  $('#importDataBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.users)) saveUsers(data.users);
        if (Array.isArray(data.requests)) saveRequests(data.requests);
        renderAdmin();
        toast('Données importées.', 'success');
      } catch (err) {
        toast('Fichier JSON invalide.', 'error');
      }
    };
    input.click();
  });

  $('#apkBtn').addEventListener('click', () => {
    const url = location.origin + location.pathname;
    window.open('https://www.pwabuilder.com/?url=' + encodeURIComponent(url), '_blank');
    toast('PWABuilder ouvert dans un nouvel onglet.', 'info');
  });

  $('#copyUrlBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('URL copiée.', 'success');
    } catch (e) {
      toast('Copie impossible.', 'error');
    }
  });

  $('#installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      toast(choice.outcome === 'accepted' ? 'Installation lancée.' : 'Installation annulée.', choice.outcome === 'accepted' ? 'success' : 'warning');
    } else {
      toast('Utilisez le menu du navigateur : Installer l’application.', 'info');
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').classList.remove('hidden');
    $('#installBtn2')?.classList.remove('hidden');
  });

  // =====================================================
  // PDF / PARTAGE
  // =====================================================
  $('#generatePdfBtn').addEventListener('click', () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast('Bibliothèque PDF non chargée.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('RAPPORT D’ANALYSE TECHNIQUE ET JURIDIQUE', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Aide Rédactionnelle Expert — droit français', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.text('Date : ' + analysisData.date, margin, y);
    y += 6;

    if (vehicleData.marque) {
      doc.text('Véhicule : ' + vehicleData.marque + ' ' + (vehicleData.modele || '') + ' (' + (vehicleData.annee || '') + ')', margin, y);
      y += 6;
    }

    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Avertissement : document généré automatiquement. Ne remplace pas un conseil juridique ou une expertise.', margin, y);
    y += 4;
    doc.text('Les conclusions sont prudentes, factuelles et conditionnelles.', margin, y);
    y += 8;
    doc.setTextColor(0);

    analysisData.sections.forEach(([title, content]) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }

      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(title, maxWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 5 + 3;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      const plain = stripHtml(content);
      const lines = doc.splitTextToSize(plain, maxWidth);

      lines.forEach((line) => {
        if (y > 275) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 4;
      });

      y += 4;
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('Page ' + i + '/' + pageCount + ' — Aide Rédactionnelle Expert', pageWidth / 2, 290, { align: 'center' });
    }

    doc.save('analyse-experte-' + new Date().toISOString().slice(0, 10) + '.pdf');
    toast('PDF généré.', 'success');
  });

  $('#shareBtn').addEventListener('click', async () => {
    const text =
      'Analyse technique et juridique — ' + analysisData.date + '\n\n' +
      analysisData.sections.map(([title, content]) => title + '\n' + stripHtml(content)).join('\n\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Analyse Aide Rédactionnelle Expert',
          text
        });
        toast('Partage lancé.', 'success');
        return;
      } catch (e) {}
    }

    try {
      await navigator.clipboard.writeText(text);
      toast('Analyse copiée dans le presse-papiers.', 'success');
    } catch (e) {
      toast('Copie impossible.', 'error');
    }
  });

  // =====================================================
  // INIT
  // =====================================================
  if (restoreSession()) {
    showApp();
  } else {
    showLogin();
  }
});
