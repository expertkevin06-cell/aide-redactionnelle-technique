document.addEventListener('DOMContentLoaded', function () {
  // =====================================================
  // CONFIGURATION
  // =====================================================
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const ADMIN_PASSWORD = 'Kevin83600';
  const MAX_DAILY_ANALYSES = 10;

  const STORAGE_KEYS = {
    SESSION: 'ar_expert_session_v5_fixed',
    USERS: 'ar_expert_users_v5_fixed',
    REQUESTS: 'ar_expert_requests_v5_fixed'
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
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  
  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } 
    catch (e) { return fallback; }
  }
  
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  
  function toast(message, type = 'info') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 4000);
  }
  
  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (e) {}
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
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  // =====================================================
  // AUTH LOGIC
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
    if (!currentUser) return { allowed: false, remaining: 0, unlimited: false };
    if (currentUser.role === 'admin') return { allowed: true, remaining: Infinity, unlimited: true };
    
    const user = findUser(currentUser.name, currentUser.email) || currentUser;
    const daily = user.daily && user.daily.date === todayKey() ? user.daily.count : 0;
    
    return { 
      allowed: daily < MAX_DAILY_ANALYSES, 
      remaining: Math.max(0, MAX_DAILY_ANALYSES - daily), 
      unlimited: false 
    };
  }

  function incrementDaily() {
    if (!currentUser || currentUser.role === 'admin') return;
    const users = getUsers();
    const idx = users.findIndex(u => u.name.toLowerCase() === currentUser.name.toLowerCase() && u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (idx < 0) return;
    const user = users[idx];
    if (!user.daily || user.daily.date !== todayKey()) user.daily = { date: todayKey(), count: 0 };
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
      el.textContent = '👑 Admin — Illimité';
    } else {
      el.textContent = `📊 ${info.remaining}/${MAX_DAILY_ANALYSES} restantes`;
    }
  }

  // CORRECTION MAJEURE : Fonction showApp robuste
  function showApp() {
    console.log("Show App called for:", currentUser);
    
    // Masquer Login
    const loginScreen = $('#loginScreen');
    if(loginScreen) loginScreen.style.display = 'none';
    
    // Afficher Main App
    const mainApp = $('#mainApp');
    if(mainApp) {
        mainApp.classList.remove('hidden');
        mainApp.style.display = 'block'; // Force block pour éviter conflits CSS
    }
    
    // Mettre à jour Badge
    const badge = $('#userBadge');
    if(badge) badge.textContent = currentUser.role === 'admin' ? '👑 Admin' : '👤 ' + currentUser.name;
    
    // Gérer boutons Admin
    const adminBtn = $('#adminPanelBtn');
    if(adminBtn) {
        if(currentUser.role === 'admin') adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
    }
    
    updateCounter();
    askNotificationPermission();
    
    // Scroll top
    window.scrollTo(0,0);
  }

  function showLogin() {
    const loginScreen = $('#loginScreen');
    if(loginScreen) loginScreen.style.display = 'flex';
    
    const mainApp = $('#mainApp');
    if(mainApp) mainApp.classList.add('hidden');
    
    const adminPanel = $('#adminPanel');
    if(adminPanel) adminPanel.classList.add('hidden');
  }

  function authMessage(msg, type) {
    const el = $('#authMsg');
    if(!el) return;
    el.textContent = msg;
    el.className = 'auth-msg ' + type;
  }

  // =====================================================
  // EVENT LISTENERS UI
  // =====================================================
  $$('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.auth-tab').forEach(b => b.classList.remove('active'));
      $$('.auth-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const paneId = btn.dataset.authTab + 'Pane';
      const pane = $( '#' + paneId );
      if(pane) pane.classList.add('active');
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
      return authMessage('Demande déjà en attente.', 'warning');
    }
    
    const existingUser = findUser(name, email);
    if (existingUser && existingUser.status === 'approved') {
      return authMessage('Accès déjà accordé.', 'success');
    }

    requests.push({ id: uid(), name, email, reason, status: 'pending', date: new Date().toLocaleString('fr-FR') });
    saveRequests(requests);
    askNotificationPermission();
    notify('Nouvelle demande', `${name}`);
    authMessage('Demande envoyée.', 'success');
    $('#reqName').value = ''; $('#reqEmail').value = ''; $('#reqReason').value = '';
  });

  $('#thirdLoginBtn').addEventListener('click', () => {
    const name = $('#loginName').value.trim();
    const email = $('#loginEmail').value.trim();
    if (!name || !email) return authMessage('Nom et email requis.', 'error');
    
    const user = findUser(name, email);
    if (!user) {
      const req = getRequests().find(r => r.name.toLowerCase() === name.toLowerCase() && r.email.toLowerCase() === email.toLowerCase());
      if (req && req.status === 'pending') return authMessage('En attente de validation.', 'warning');
      return authMessage('Aucun accès trouvé.', 'error');
    }
    if (user.status !== 'approved') return authMessage('Accès refusé/révoqué.', 'error');
    
    setSession(user);
    showApp();
    toast('Connecté.', 'success');
  });

  $('#logoutBtn').addEventListener('click', () => { clearSession(); showLogin(); });

  // =====================================================
  // PDF UPLOAD
  // =====================================================
  $('#pdfUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return pdfStatus('PDF uniquement.', 'error');
    
    pdfStatus('Extraction...', 'success');
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
      pdfStatus(`OK (${pdf.numPages} pages)`, 'success');
    } catch (err) {
      pdfStatus('Erreur: ' + err.message, 'error');
    }
  });

  function pdfStatus(msg, type) {
    const el = $('#pdfStatus');
    if(el) { el.textContent = msg; el.className = 'status ' + type; }
  }

  // =====================================================
  // BASE TECHNIQUE EXPERT (USURE + INFILTRATION)
  // =====================================================
  const TECHNICAL_KNOWLEDGE_BASE = {
    "renault": {
      label: "Renault",
      engines: [
        { code: "H5F / 1.2 TCe", power: "120ch", years: "2012-2020", models: ["Clio IV", "Captur", "Megane III"], symptoms: ["consommation huile", "casse moteur", "segmentation"], severity: "critique", note: "Defaut conception piston.", wear_factor: 0.8 },
        { code: "K9K / 1.5 dCi", power: "90ch", years: "2009-2018", models: ["Clio", "Megane", "Scenic", "Duster", "Trafic II"], symptoms: ["casse bielle", "claquement", "pompe huile"], severity: "critique", note: "Risque casse brutale.", wear_factor: 0.9 },
        { code: "EDC6", power: "N/A", years: "2012-2018", models: ["Clio IV", "Captur"], symptoms: ["a-coups", "blocage rapport", "voyant boite"], severity: "critique", note: "Mechatronique fragile.", wear_factor: 0.7 },
        { code: "Baie Pare-brise / Etancheite", power: "N/A", years: "2014-2023", models: ["Trafic II", "Master", "Espace V"], symptoms: ["infiltration eau", "court circuit", "moisiure", "panne electronique"], severity: "critique", note: "Defaut joint usine/collage. Independant du km.", wear_factor: 0.95 }
      ]
    },
    "peugeot": {
      label: "Peugeot",
      engines: [
        { code: "EB2 / 1.2 PureTech", power: "110ch", years: "2012-2022", models: ["208", "308", "3008"], symptoms: ["courroie distribution", "casse moteur", "bruit cliquetis"], severity: "critique", note: "Courroie humide degregation.", wear_factor: 0.85 },
        { code: "DV6 / 1.6 HDI", power: "92ch", years: "2009-2018", models: ["308", "3008", "508"], symptoms: ["EGR encrasse", "FAP colmate", "turbo HS"], severity: "moyen", note: "Usage urbain intensif.", wear_factor: 0.5 }
      ]
    },
    "citroen": {
      label: "Citroën",
      engines: [
        { code: "EB2 / 1.2 PureTech", power: "110ch", years: "2012-2022", models: ["C3", "C4", "C4 Picasso"], symptoms: ["courroie distribution", "casse moteur"], severity: "critique", note: "Identique PSA.", wear_factor: 0.85 }
      ]
    },
    "volkswagen": {
      label: "Volkswagen",
      engines: [
        { code: "EA189 TDI", power: "105ch", years: "2009-2015", models: ["Golf", "Passat", "Tiguan"], symptoms: ["dieselgate", "logiciel", "NOx"], severity: "critique", note: "Tricherie pollution.", wear_factor: 1.0 },
        { code: "DSG7 DQ200", power: "N/A", years: "2008-2016", models: ["Golf", "Polo"], symptoms: ["mecatronique HS", "patinage", "a-coups"], severity: "critique", note: "Double embrayage sec fragile.", wear_factor: 0.7 }
      ]
    },
    "bmw": {
      label: "BMW",
      engines: [
        { code: "N47 2.0d", power: "163ch", years: "2007-2015", models: ["Serie 1", "Serie 3", "X1"], symptoms: ["chaine distribution", "bruit crecelle", "casse chaine"], severity: "critique", note: "Chaine cote boite.", wear_factor: 0.8 }
      ]
    },
    "ford": {
      label: "Ford",
      engines: [
        { code: "PowerShift DPS6", power: "N/A", years: "2011-2016", models: ["Focus", "Fiesta"], symptoms: ["vibrations", "a-coups", "odeur brule"], severity: "critique", note: "Boite defaillante mondiale.", wear_factor: 0.8 },
        { code: "Ecoboost 1.0L", power: "100ch", years: "2012-2018", models: ["Focus", "Fiesta"], symptoms: ["joint culasse", "surchauffe", "eau dans huile"], severity: "critique", note: "Defaut thermique.", wear_factor: 0.9 }
      ]
    }
  };

  function matchTechnicalDefects(marque, modele, annee, kilometrage, texteFaits) {
    const brandKey = Object.keys(TECHNICAL_KNOWLEDGE_BASE).find(k => k.includes(normalize(marque)) || normalize(marque).includes(k));
    if (!brandKey) return [];

    const db = TECHNICAL_KNOWLEDGE_BASE[brandKey];
    const yearNum = parseInt(annee) || 0;
    const kmNum = parseInt(String(kilometrage).replace(/\D/g,'')) || 0;
    const textLower = normalize(texteFaits);
    const matches = [];

    db.engines.forEach(engine => {
      const yearMatch = checkYearRange(engine.years, yearNum);
      const modelMatch = engine.models.some(m => {
        const mNorm = normalize(m);
        const modNorm = normalize(modele);
        return !modNorm || mNorm.includes(modNorm) || modNorm.includes(mNorm);
      });

      let symptomScore = 0;
      let matchedSymptoms = [];
      engine.symptoms.forEach(symptom => {
        const symNorm = normalize(symptom);
        if (textLower.includes(symNorm) || symNorm.split(' ').every(word => word.length > 3 && textLower.includes(word))) {
          symptomScore++;
          matchedSymptoms.push(symptom);
        }
      });

      if (yearMatch && modelMatch && symptomScore > 0) {
        let confidenceLevel = "Haute";
        let wearWarning = "";
        
        if (kmNum > 150000 && engine.wear_factor < 0.6) {
           confidenceLevel = "Basse";
           wearWarning = "Km eleve : risque fort d'usure normale.";
        } else if (kmNum > 100000 && engine.wear_factor < 0.8) {
           confidenceLevel = "Moyenne";
           wearWarning = "Km eleve : usure possible mais defaut suspect.";
        } else {
           confidenceLevel = "Haute";
           wearWarning = "Km compatible avec vice cache/defaut serie.";
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
    return matches.sort((a, b) => b.score_correlation - a.score_correlation);
  }

  function checkYearRange(rangeStr, targetYear) {
    if (!targetYear) return true; 
    const parts = rangeStr.split('-').map(s => parseInt(s.trim()));
    if (parts.length === 2) return targetYear >= parts[0] && targetYear <= parts[1];
    return true;
  }

  // =====================================================
  // ANALYSE PRINCIPALE
  // =====================================================
  $('#analyzeBtn').addEventListener('click', () => {
    if (!currentUser) return toast('Connectez-vous.', 'error');
    const info = dailyInfo();
    if (!info.allowed) return toast(`Limite atteinte (${MAX_DAILY_ANALYSES}).`, 'warning');

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

    if (!text) return toast('Saisissez des faits.', 'warning');

    termesMobilises = new Set();
    const btn = $('#analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analyse...';

    setTimeout(() => {
      try {
        runAnalysis(text, context, objective);
        incrementDaily();
        toast('Analyse generee.', 'success');
      } catch (err) {
        console.error(err);
        toast('Erreur analyse.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔍 Lancer l’analyse experte';
      }
    }, 1000);
  });

  function runAnalysis(text, context, objective) {
    const allText = (text + ' ' + context).toLowerCase();
    const flags = {
      professional: ['professionnel', 'garage', 'concession'].some(w => allText.includes(w)),
      privateSeller: ['particulier', 'entre particuliers'].some(w => allText.includes(w)),
      defect: ['defaut', 'panne', 'bruit', 'fuite', 'a-coup'].some(w => allText.includes(w)),
      waterLeak: ['eau', 'humidite', 'infiltration', 'baie', 'pare brise'].some(w => allText.includes(w))
    };

    const technicalMatches = matchTechnicalDefects(vehicleData.marque, vehicleData.modele, vehicleData.annee, vehicleData.kilometrage, text);

    analysisData = {
      date: new Date().toLocaleString('fr-FR'),
      vehicleData,
      sections: []
    };

    const sections = [];
    sections.push(['I. FAITS & IDENTIFICATION', sectionFacts(text, context)]);
    sections.push(['II. DIAGNOSTIC TECHNIQUE & USURE', sectionDiagnosticTechnique(technicalMatches, flags, vehicleData)]);
    sections.push(['III. QUALIFICATION JURIDIQUE', sectionQualification(flags, technicalMatches)]);
    sections.push(['IV. RISQUES VENDEUR', sectionRisques(flags, technicalMatches)]);
    sections.push(['V. CRITERES CUMULATIFS', sectionCritères(flags, technicalMatches, vehicleData)]);
    sections.push(['VI. GARANTIES', sectionGaranties(flags)]);
    sections.push(['VII. DOCUMENTS', sectionDocuments(flags)]);
    sections.push(['VIII. JURISPRUDENCE', sectionJurisprudence()]);
    sections.push(['IX. PREJUDICE', sectionPrejudice(flags)]);
    sections.push(['X. STRATEGIE', sectionStrategie(flags, technicalMatches, objective)]);
    sections.push(['XI. VERIFICATIONS', sectionVerification(technicalMatches)]);
    sections.push(['XII. VOIES ACTION', sectionVoies(flags, technicalMatches)]);
    sections.push(['XIII. CONCLUSION', sectionConclusion(objective, technicalMatches)]);
    sections.push(['XIV. LEXIQUE', sectionLexique()]);

    analysisData.sections = sections;
    renderAnalysis();
  }

  function renderAnalysis() {
    let html = '';
    analysisData.sections.forEach(([title, content]) => {
      html += `<h3>${title}</h3>${content}`;
    });
    html += `<div class="verification-needed"><strong>Note:</strong> Aide a la redaction. Non substitutif a un avis legal.</div>`;
    $('#analysisResult').innerHTML = html;
    $('#analysisSection').classList.remove('hidden');
    $('#analysisSection').scrollIntoView({ behavior: 'smooth' });
  }

  // --- SECTIONS CONTENT (Condensed for brevity but functional) ---
  function sectionFacts(text, context) {
    return `<p><strong>Vehicule:</strong> ${escapeHtml(vehicleData.marque)} ${escapeHtml(vehicleData.modele)} (${escapeHtml(vehicleData.annee)}) - Km: ${escapeHtml(vehicleData.kilometrage)}</p>
    <p><strong>Faits:</strong> ${escapeHtml(text.slice(0,500))}...</p>
    ${context ? `<p><strong>Contexte:</strong> ${escapeHtml(context.slice(0,300))}...</p>` : ''}
    <div class="certainty-low">Faits non verifies par expertise ${term('faits non verifies')}.</div>`;
  }

  function sectionDiagnosticTechnique(matches, flags, vData) {
    if (!matches.length) return `<div class="verification-needed">Aucun defaut connu identifie pour cette combo. Expertise individuelle requise ${term('expertise individuelle')}.</div>`;
    
    let html = `<p>Correspondances techniques trouvees :</p>`;
    matches.forEach((m, i) => {
      const cls = m.severite === 'critique' ? 'rappel-critical' : 'rappel-info';
      const confColor = m.confidence_niveau === 'Haute' ? '#10b981' : (m.confidence_niveau === 'Moyenne' ? '#f59e0b' : '#ef4444');
      html += `
        <div class="${cls}">
          <h4>${i+1}. ${escapeHtml(m.moteur)} (${escapeHtml(m.puissance)})</h4>
          <p><strong>Symptomes:</strong> ${escapeHtml(m.symptomes_detectes.join(', '))}</p>
          <p><strong>Description:</strong> ${escapeHtml(m.description_defaut)}</p>
          <p><strong>Confiance vs Usure:</strong> <span style="color:${confColor};font-weight:bold">${m.confidence_niveau}</span></p>
          ${m.alert_usure ? `<p style="background:#fff3cd;padding:5px;border-radius:4px;font-size:0.9em">⚠️ ${escapeHtml(m.alert_usure)}</p>` : ''}
        </div>
      `;
    });
    if (flags.waterLeak) html += `<div class="rappel-critical"><h4>💧 Alerte Infiltration</h4><p>Risque infiltration eau detecte. Souvent vice cache independant du km.</p></div>`;
    return html;
  }

  function sectionQualification(flags, matches) {
    let html = `<p><strong>Objet:</strong> Qualification provisoire ${term('qualification juridique')}.</p>`;
    if (flags.professional) html += `<div class="certainty-high">Vendeur Pro ${term('vendeur professionnel')}.</div>`;
    else if (flags.privateSeller) html += `<div class="certainty-medium">Vendeur Particulier ${term('vente entre particuliers')}.</div>`;
    else html += `<div class="certainty-low">Statut incertain.</div>`;
    if (matches.length) html += `<p>Presence probable de ${term('vice cache notoire')}.</p>`;
    return html;
  }

  function sectionRisques(flags, matches) {
    let html = `<p><strong>Objet:</strong> Risques ${term('risques encourus')}.</p>`;
    if (matches.some(m=>m.severite==='critique')) html += `<div class="rappel-critical"><h4>⚠️ Gravite Critique</h4><p>Risque securite/moteur. Faute lourde possible si pro.</p></div>`;
    html += `<ul><li>Si Pro: ${term('garantie legale de conformite')}</li><li>Si Particulier: ${term('action redhibitoire')}</li></ul>`;
    return html;
  }

  function sectionCritères(flags, matches, vData) {
    const km = parseInt(String(vData.kilometrage).replace(/\D/g,'')) || 0;
    const bestMatch = matches[0];
    let argAnteriorite = "A prouver par expertise.";
    let argCache = "Depend diligence acheteur.";
    
    if(bestMatch) {
       if(bestMatch.confidence_niveau === 'Haute') {
         argAnteriorite = "Nature serie suggere anterieur.";
         argCache = "Defaut conception non apparent.";
       } else if (bestMatch.confidence_niveau === 'Basse') {
         argAnteriorite = "Km eleve: doute anterieur vs usure.";
         argCache = "Usure normale possible.";
       }
    }
    return `<h4>A. Anteriorite</h4><p>${argAnteriorite} ${term('anteriorite')}</p>
            <h4>B. Caracter Cache</h4><p>${argCache} ${term('caractere cache')}</p>
            <h4>C. Gravite</h4><p>${matches.some(m=>m.severite==='critique')?'Elevee':'Variable'} ${term('gravite')}</p>`;
  }

  function sectionGaranties(flags) {
    if (flags.professional) return `<h4>Pro</h4><ul><li>${term('garantie legale de conformite')}</li></ul>`;
    return `<h4>Particulier</h4><ul><li>${term('garantie des vices caches')}</li></ul>`;
  }

  function sectionDocuments(flags) {
    return `<ul><li>Facture ${flags.invoice?'(Oui)':'(Non)'}</li><li>CT ${flags.controlTech?'(Oui)':'(Non)'}</li><li>Photos infiltrations si eau</li></ul>`;
  }

  function sectionJurisprudence() {
    return `<ul><li>Cass. Civ. 1ère, 3 mai 2006: Caracte cache.</li><li>Cass. Civ. 1ère, 12 juill. 2018: Rappels pro.</li></ul>`;
  }

  function sectionPrejudice(flags) {
    return `<ul><li>Reparation prix</li><li>Frais expertise</li><li>Immobilisation</li></ul>`;
  }

  function sectionStrategie(flags, matches, objective) {
    let html = `<ol><li>Expertise amiable (distinction usure)</li><li>Mise en demeure LRAR</li><li>Mediation/Jugement</li></ol>`;
    if(matches.length) html += `<p>Mettre en avant ${term('defaut de serie')}.</p>`;
    return html;
  }

  function sectionVerification(matches) {
    return `<ul><li>Verif VIN rappels</li><li>Historique entretien</li><li>Devis reparation</li></ul>`;
  }

  function sectionVoies(flags, matches) {
    return `<ul><li>Action civile</li><li>Signalement DGCCRF (si pro)</li></ul>`;
  }

  function sectionConclusion(objective, matches) {
    const highConf = matches.some(m=>m.confidence_niveau==='Haute');
    return `<p>L'analyse ${highConf?'confirme un defaut probable':'suggere un probleme a verifier'}.</p><div class="certainty-low">Non-conseil juridique definitif.</div>`;
  }

  function sectionLexique() {
    const terms = Array.from(termesMobilises).sort();
    let html = `<p><strong>Termes:</strong> ${terms.length}</p><div class="lexique-section">`;
    terms.forEach(t => html += `<div class="lexique-item"><strong>${escapeHtml(t)}</strong></div>`);
    html += `</div>`;
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
  // EXPORT / IMPORT / APK
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
    // IMPORTANT: Doit etre sur https://...github.io pour que PWABuilder fonctionne
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
      toast('Utilisez menu navigateur -> Installer.', 'info');
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').classList.remove('hidden');
  });

  // =====================================================
  // PDF GENERATION
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
      if (y > 270) { doc.addPage(); y = 20; }
      
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
        if (y > 280) { doc.addPage(); y = 20; }
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
      try { await navigator.share({ title: 'Analyse Expert', text }); } catch(e){}
    } else {
      await navigator.clipboard.writeText(text);
      toast('Copié.', 'success');
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
