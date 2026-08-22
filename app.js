// ============================================================
// AIDE RÉDACTIONNELLE - Analyse Technique et Juridique Automobile
// Version avec traçabilité des termes juridiques + Risques/Responsabilités
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    let extractedText = '';
    let analysisData = {};
    let vehicleData = {};
    let termesMobilises = new Set();

    // ============================================================
    // FONCTION UTILITAIRE : Formatage des termes juridiques
    // ============================================================
    
    function termes(...mots) {
        mots.forEach(m => termesMobilises.add(m));
        return '<span class="termes-juridiques">(' + mots.join(', ') + ')</span>';
    }

    // ============================================================
    // BASE DE DONNÉES DES RAPPELS
    // ============================================================
    
    const rappelsConstructeurs = {
        "renault": {
            marque: "Renault",
            rappels: [
                { annees: "2012-2018", modele: "Clio IV, Captur, Mégane III", probleme: "Boîte EDC6 (double embrayage)", description: "Problèmes de passage de rapports, à-coups, perte de puissance, défaillance du module de commande.", severite: "critique", reference: "Campagnes R20-001, R21-003." },
                { annees: "2012-2020", modele: "Clio IV, Captur, Kadjar", probleme: "Moteur 1.2 TCe (H5F) - Consommation d'huile", description: "Consommation excessive d'huile moteur, casse moteur, problème de segmentation.", severite: "critique", reference: "Action collective UFC-Que Choisir 2021." },
                { annees: "2009-2016", modele: "Mégane III, Scénic III", probleme: "Moteur 1.5 dCi (K9K) - Casse de bielle", description: "Casse de bielle, usure prématurée des coussinets, défaillance pompe à huile.", severite: "critique", reference: "TGI Paris, 15 janvier 2020." },
                { annees: "2015-2020", modele: "Mégane IV, Talisman", probleme: "Écran R-Link 2", description: "Défaillance écran tactile, gel du système.", severite: "moyenne", reference: "Campagnes techniques constructeur." }
            ]
        },
        "peugeot": {
            marque: "Peugeot",
            rappels: [
                { annees: "2012-2018", modele: "208, 308, 3008, 5008", probleme: "Moteur 1.2 PureTech (EB2)", description: "Désagrégation courroie distribution dans l'huile, colmatage crépine, casse moteur.", severite: "critique", reference: "R21-014, R22-008. UFC-Que Choisir." },
                { annees: "2010-2017", modele: "308, 508, 3008", probleme: "Boîte EAT6 (Aisin)", description: "À-coups, perte de puissance, défaillance convertisseur de couple.", severite: "critique", reference: "TGI Nanterre, 12 mars 2019." },
                { annees: "2009-2016", modele: "308, 508, Partner", probleme: "Moteur 1.6 HDI/BlueHDi (DV6)", description: "Encrassement EGR, colmatage FAP, défaillance turbo.", severite: "moyenne", reference: "Multiple campagnes." },
                { annees: "2014-2020", modele: "308, 3008, 5008", probleme: "Système AdBlue", description: "Cristallisation, défaillance pompe, immobilisation.", severite: "moyenne", reference: "R20-022." }
            ]
        },
        "citroen": {
            marque: "Citroën",
            rappels: [
                { annees: "2012-2018", modele: "C3, C4, C4 Picasso, C5 Aircross", probleme: "Moteur 1.2 PureTech (EB2)", description: "Désagrégation courroie distribution (même défaut Peugeot/Stellantis).", severite: "critique", reference: "R21-014." },
                { annees: "2009-2016", modele: "C3, C4, Berlingo", probleme: "Moteur 1.6 HDI (DV6)", description: "Encrassement EGR/FAP, casse turbo.", severite: "moyenne", reference: "Campagnes multiples." },
                { annees: "2014-2019", modele: "C4 Picasso", probleme: "Boîte EAT6/EAT8", description: "À-coups, perte de puissance.", severite: "critique", reference: "TGI Paris, 8 juin 2020." }
            ]
        },
        "volkswagen": {
            marque: "Volkswagen",
            rappels: [
                { annees: "2009-2015", modele: "Golf VI, Golf VII, Passat, Tiguan", probleme: "Dieselgate - Moteurs TDI", description: "Dispositif d'invalidation émissions polluantes.", severite: "critique", reference: "CJUE C-693/18." },
                { annees: "2008-2016", modele: "Golf, Passat, Scirocco", probleme: "Boîte DSG7 (DQ200)", description: "Défaillance mécatronique, perte de propulsion.", severite: "critique", reference: "Rappel mondial 23V-001." },
                { annees: "2012-2018", modele: "Golf VII, Passat, Tiguan", probleme: "Moteur 2.0 TDI (EA288)", description: "Consommation huile, défaillance injecteurs.", severite: "moyenne", reference: "Campagnes multiples." }
            ]
        },
        "audi": {
            marque: "Audi",
            rappels: [
                { annees: "2009-2015", modele: "A3, A4, A6, Q5", probleme: "Dieselgate TDI", description: "Dispositif d'invalidation (groupe VAG).", severite: "critique", reference: "Affaire Dieselgate." },
                { annees: "2008-2016", modele: "A3, A4, Q3", probleme: "Boîte S-Tronic (DQ200)", description: "Défaillance mécatronique.", severite: "critique", reference: "23V-001." },
                { annees: "2010-2018", modele: "A4, A5, A6", probleme: "Consommation huile TFSI", description: "Segmentation pistons, casse moteur.", severite: "critique", reference: "TGI Munich." }
            ]
        },
        "bmw": {
            marque: "BMW",
            rappels: [
                { annees: "2007-2015", modele: "Série 1, Série 3, Série 5", probleme: "Moteur N47 (2.0d)", description: "Casse chaîne de distribution côté boîte.", severite: "critique", reference: "TGI Munich 2018." },
                { annees: "2010-2018", modele: "Série 3, Série 5, X3, X5", probleme: "Système EGR", description: "Risque incendie collecteur admission.", severite: "critique", reference: "18V-001." },
                { annees: "2012-2019", modele: "Série 3 (F30), Série 5 (F10)", probleme: "Boîte ZF 8HP", description: "À-coups, perte de puissance.", severite: "moyenne", reference: "Campagnes techniques." }
            ]
        },
        "mercedes": {
            marque: "Mercedes-Benz",
            rappels: [
                { annees: "2009-2016", modele: "Classe C, Classe E, GLK", probleme: "Boîte 7G-Tronic", description: "À-coups, perte de propulsion.", severite: "critique", reference: "Campagnes multiples." },
                { annees: "2010-2018", modele: "Classe A, Classe B, CLA", probleme: "Moteur OM651 (2.1 CDI)", description: "Défaillance injecteurs piézoélectriques.", severite: "critique", reference: "R19-003." },
                { annees: "2015-2020", modele: "Classe C, Classe E", probleme: "Système AdBlue", description: "Cristallisation, défaillance pompe.", severite: "moyenne", reference: "R20-015." }
            ]
        },
        "ford": {
            marque: "Ford",
            rappels: [
                { annees: "2011-2016", modele: "Focus, Fiesta, B-Max", probleme: "Boîte PowerShift (DPS6)", description: "Défaillance boîte double embrayage.", severite: "critique", reference: "Class action USA 2020." },
                { annees: "2012-2018", modele: "Focus, C-Max, Kuga", probleme: "Moteur 1.0 EcoBoost", description: "Surchauffe, casse moteur.", severite: "critique", reference: "19V-001." },
                { annees: "2009-2015", modele: "Focus, Mondeo", probleme: "Moteur 2.0 TDCi", description: "Défaillance injecteurs, turbo.", severite: "moyenne", reference: "Campagnes multiples." }
            ]
        },
        "toyota": {
            marque: "Toyota",
            rappels: [
                { annees: "2009-2011", modele: "Yaris, Auris, Avensis", probleme: "Pédale d'accélérateur", description: "Risque blocage pédale.", severite: "critique", reference: "Rappel mondial 2010." },
                { annees: "2012-2018", modele: "Yaris, Auris, C-HR", probleme: "Système hybride HSD", description: "Défaillance onduleur, batterie.", severite: "moyenne", reference: "Campagnes techniques." },
                { annees: "2014-2020", modele: "Yaris, C-HR, RAV4", probleme: "Airbags Takata", description: "Projections métalliques.", severite: "critique", reference: "ANSM 2020." }
            ]
        },
        "fiat": {
            marque: "Fiat",
            rappels: [
                { annees: "2010-2017", modele: "500, Panda, Punto", probleme: "Boîte Dualogic", description: "Défaillance robot de boîte.", severite: "critique", reference: "R18-002." },
                { annees: "2009-2016", modele: "Punto, Bravo, Doblò", probleme: "Moteur 1.3 MultiJet", description: "Casse chaîne distribution, turbo.", severite: "critique", reference: "Campagnes multiples." },
                { annees: "2012-2018", modele: "500X, Tipo", probleme: "Boîte DCT", description: "Défaillance mécatronique.", severite: "moyenne", reference: "R20-008." }
            ]
        },
        "nissan": {
            marque: "Nissan",
            rappels: [
                { annees: "2012-2018", modele: "Qashqai, X-Trail", probleme: "Moteur 1.5 dCi (K9K)", description: "Casse bielle (même défaut Renault).", severite: "critique", reference: "R19-005." },
                { annees: "2014-2020", modele: "Qashqai, X-Trail", probleme: "Boîte X-Tronic CVT", description: "Défaillance CVT.", severite: "critique", reference: "R21-007." }
            ]
        },
        "opel": {
            marque: "Opel",
            rappels: [
                { annees: "2012-2018", modele: "Corsa, Astra, Mokka", probleme: "Moteur 1.4 Turbo", description: "Consommation huile, casse moteur.", severite: "critique", reference: "R19-003." },
                { annees: "2009-2016", modele: "Astra, Zafira", probleme: "Système refroidissement", description: "Fuite liquide, surchauffe, risque incendie.", severite: "critique", reference: "Rappel incendie 2015." }
            ]
        },
        "hyundai": {
            marque: "Hyundai",
            rappels: [
                { annees: "2011-2017", modele: "i30, Tucson, ix35", probleme: "Moteur 1.7 CRDi", description: "Défaillance injecteurs, casse moteur.", severite: "moyenne", reference: "R18-004." },
                { annees: "2015-2020", modele: "i20, i30, Tucson", probleme: "Boîte DCT", description: "Défaillance mécatronique.", severite: "moyenne", reference: "R20-011." }
            ]
        },
        "kia": {
            marque: "Kia",
            rappels: [
                { annees: "2011-2017", modele: "Ceed, Sportage, Niro", probleme: "Moteur 1.7 CRDi", description: "Mêmes défauts Hyundai.", severite: "moyenne", reference: "R18-004." },
                { annees: "2012-2018", modele: "Ceed, Sportage", probleme: "Catalyseur", description: "Risque incendie.", severite: "critique", reference: "Rappel sécurité 2019." }
            ]
        },
        "volvo": {
            marque: "Volvo",
            rappels: [
                { annees: "2012-2018", modele: "V40, V60, XC60", probleme: "Moteur Drive-E", description: "Consommation huile, casse moteur.", severite: "critique", reference: "R20-009." },
                { annees: "2014-2020", modele: "XC90, V90, S90", probleme: "Système AdBlue", description: "Cristallisation.", severite: "moyenne", reference: "R21-002." }
            ]
        },
        "seat": {
            marque: "SEAT",
            rappels: [
                { annees: "2009-2015", modele: "Ibiza, Leon, Altea", probleme: "Dieselgate TDI", description: "Dispositif d'invalidation (VAG).", severite: "critique", reference: "Dieselgate." },
                { annees: "2012-2018", modele: "Leon, Ateca", probleme: "Boîte DSG7", description: "Défaillance mécatronique.", severite: "critique", reference: "23V-001." }
            ]
        },
        "skoda": {
            marque: "Škoda",
            rappels: [
                { annees: "2009-2015", modele: "Octavia, Superb, Yeti", probleme: "Dieselgate TDI", description: "Dispositif d'invalidation (VAG).", severite: "critique", reference: "Dieselgate." },
                { annees: "2010-2017", modele: "Octavia, Superb", probleme: "Consommation huile TSI", description: "Consommation excessive.", severite: "critique", reference: "Campagne rappel." }
            ]
        },
        "jeep": {
            marque: "Jeep",
            rappels: [
                { annees: "2014-2020", modele: "Renegade, Compass, Cherokee", probleme: "Boîte DCT", description: "Défaillance double embrayage à sec.", severite: "critique", reference: "R20-012." },
                { annees: "2015-2020", modele: "Renegade, Compass", probleme: "Moteur 1.6 MultiJet", description: "Défaillance injecteurs.", severite: "moyenne", reference: "R19-008." }
            ]
        },
        "dacia": {
            marque: "Dacia",
            rappels: [
                { annees: "2012-2018", modele: "Duster, Sandero, Logan", probleme: "Moteur 1.5 dCi (K9K)", description: "Casse bielle (Renault).", severite: "critique", reference: "R19-005." },
                { annees: "2013-2019", modele: "Duster", probleme: "Boîte EDC", description: "Défaillance double embrayage.", severite: "moyenne", reference: "R20-006." }
            ]
        },
        "mini": {
            marque: "MINI",
            rappels: [
                { annees: "2010-2017", modele: "Cooper, Cooper S, Countryman", probleme: "Moteur N18/N20 (Prince BMW)", description: "Consommation huile, chaîne distribution.", severite: "critique", reference: "Action collective UK 2019." },
                { annees: "2014-2020", modele: "Cooper, Clubman", probleme: "Boîte DCT Getrag", description: "À-coups, perte propulsion.", severite: "moyenne", reference: "R20-007." }
            ]
        }
    };

    const problemesTransversaux = [
        {
            nom: "Airbags Takata",
            annees: "2009-2020",
            marques: ["Toyota", "Honda", "Nissan", "Mazda", "BMW", "Mercedes", "Ford", "Chrysler", "Fiat", "Volkswagen", "Audi", "SEAT", "Škoda", "Opel", "Chevrolet", "Cadillac"],
            description: "Défaut fabrication générateurs gaz, projections métalliques mortelles.",
            severite: "critique",
            reference: "ANSM. NHTSA. 20+ morts documentées."
        },
        {
            nom: "Dieselgate - Dispositif d'invalidation",
            annees: "2009-2015",
            marques: ["Volkswagen", "Audi", "SEAT", "Škoda", "Mercedes", "BMW", "Opel", "Peugeot", "Citroën", "Renault", "Fiat", "Jeep", "Volvo"],
            description: "Logiciel truquant tests antipollution. Émissions 10 à 40 fois supérieures aux normes.",
            severite: "critique",
            reference: "CJUE C-693/18. TGI Paris."
        }
    ];

    // ============================================================
    // ÉLÉMENTS DOM
    // ============================================================
    
    const textInput = document.getElementById('textInput');
    const pdfUpload = document.getElementById('pdfUpload');
    const pdfStatus = document.getElementById('pdfStatus');
    const contextInfo = document.getElementById('contextInfo');
    const objectiveInfo = document.getElementById('objectiveInfo');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisSection = document.getElementById('analysisSection');
    const analysisResult = document.getElementById('analysisResult');
    const generatePdfBtn = document.getElementById('generatePdfBtn');
    const shareBtn = document.getElementById('shareBtn');
    
    const vehicleBrand = document.getElementById('vehicleBrand');
    const vehicleModel = document.getElementById('vehicleModel');
    const vehicleYear = document.getElementById('vehicleYear');
    const vehicleKilometrage = document.getElementById('vehicleKilometrage');
    const vehicleVin = document.getElementById('vehicleVin');

    console.log('✅ Application chargée');

    // ============================================================
    // GESTION PDF
    // ============================================================
    
    if (pdfUpload) {
        pdfUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type !== 'application/pdf') {
                showStatus(' Veuillez sélectionner un fichier PDF', 'error');
                return;
            }

            showStatus(' Extraction en cours...', 'success');

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }

                extractedText = fullText;
                textInput.value = fullText;
                showStatus('✅ PDF extrait (' + pdf.numPages + ' pages)', 'success');
            } catch (error) {
                showStatus('❌ Erreur: ' + error.message, 'error');
            }
        });
    }

    function showStatus(message, type) {
        if (pdfStatus) {
            pdfStatus.textContent = message;
            pdfStatus.className = 'status ' + type;
        }
    }

    // ============================================================
    // BOUTON ANALYSE
    // ============================================================
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', function() {
            const text = textInput ? textInput.value.trim() : '';
            const context = contextInfo ? contextInfo.value.trim() : '';
            const objective = objectiveInfo ? objectiveInfo.value.trim() : '';
            
            vehicleData = {
                marque: vehicleBrand ? vehicleBrand.value.trim() : '',
                modele: vehicleModel ? vehicleModel.value.trim() : '',
                annee: vehicleYear ? vehicleYear.value.trim() : '',
                kilometrage: vehicleKilometrage ? vehicleKilometrage.value.trim() : '',
                vin: vehicleVin ? vehicleVin.value.trim() : ''
            };

            if (!text && !extractedText) {
                alert('⚠️ Veuillez saisir du texte ou importer un PDF');
                return;
            }

            termesMobilises = new Set();

            analyzeBtn.innerHTML = '<span class="loading"></span> Analyse en cours...';
            analyzeBtn.disabled = true;

            setTimeout(() => {
                performAnalysis(text || extractedText, context, objective);
                analyzeBtn.innerHTML = '🔍 Lancer l\'analyse factuelle';
                analyzeBtn.disabled = false;
            }, 1500);
        });
    }

    // ============================================================
    // ANALYSE RAPPELS
    // ============================================================
    
    function analyserRappels(marque, modele, annee) {
        const resultats = { rappelsTrouves: [], problemesTransversaux: [], recommandations: [] };
        if (!marque) return resultats;
        
        const marqueLower = marque.toLowerCase();
        const anneeNum = parseInt(annee);
        
        for (const [key, data] of Object.entries(rappelsConstructeurs)) {
            if (marqueLower.includes(key) || key.includes(marqueLower)) {
                data.rappels.forEach(rappel => {
                    const anneesMatch = verifierAnnees(rappel.annees, anneeNum);
                    const modeleMatch = !modele || rappel.modele.toLowerCase().includes(modele.toLowerCase());
                    if (anneesMatch && modeleMatch) {
                        resultats.rappelsTrouves.push({ ...rappel, constructeur: data.marque });
                    }
                });
            }
        }
        
        problemesTransversaux.forEach(probleme => {
            const marqueConcernee = probleme.marques.some(m => 
                marqueLower.includes(m.toLowerCase()) || m.toLowerCase().includes(marqueLower)
            );
            if (marqueConcernee && verifierAnnees(probleme.annees, anneeNum)) {
                resultats.problemesTransversaux.push(probleme);
            }
        });
        
        if (resultats.rappelsTrouves.length > 0) {
            resultats.recommandations.push("Vérifier auprès du constructeur ou d'un concessionnaire agréé si le véhicule a fait l'objet des campagnes de rappel identifiées, en communiquant le numéro VIN.");
            resultats.recommandations.push("Consulter le site de la Sécurité Routière (securite-routiere.gouv.fr) pour vérifier les rappels en cours.");
            resultats.recommandations.push("Demander au vendeur la preuve de réalisation des opérations de rappel.");
        }
        
        if (resultats.problemesTransversaux.length > 0) {
            resultats.recommandations.push("Se renseigner sur l'existence d'actions collectives en cours concernant les problèmes transversaux identifiés.");
        }
        
        return resultats;
    }
    
    function verifierAnnees(plageAnnees, anneeRecherchee) {
        if (!anneeRecherchee || isNaN(anneeRecherchee)) return true;
        const match = plageAnnees.match(/(\d{4})-(\d{4})/);
        if (match) {
            const anneeDebut = parseInt(match[1]);
            const anneeFin = parseInt(match[2]);
            return anneeRecherchee >= anneeDebut && anneeRecherchee <= anneeFin;
        }
        return true;
    }

    // ============================================================
    // ANALYSE PRINCIPALE
    // ============================================================
    
    function performAnalysis(text, context, objective) {
        analysisData = {
            date: new Date().toLocaleDateString('fr-FR'),
            text: text.substring(0, 1500),
            context: context,
            objective: objective,
            vehicleData: vehicleData,
            sections: []
        };

        const fullText = (text + ' ' + context).toLowerCase();
        const hasVehicle = fullText.includes('véhicule') || fullText.includes('voiture') || fullText.includes('automobile') || vehicleData.marque;
        const hasDefect = fullText.includes('défaut') || fullText.includes('panne') || fullText.includes('problème') || fullText.includes('dysfonctionnement') || fullText.includes('casse');
        const hasProfessional = fullText.includes('professionnel') || fullText.includes('garage') || fullText.includes('concession') || fullText.includes('vendeur professionnel');
        const hasParticulier = fullText.includes('particulier');
        const hasInvoice = fullText.includes('facture');
        const hasRepair = fullText.includes('réparation') || fullText.includes('ordre de réparation');
        const hasControlTech = fullText.includes('contrôle technique');
        const hasWarranty = fullText.includes('garantie');

        const rappelsData = analyserRappels(vehicleData.marque, vehicleData.modele, vehicleData.annee);

        analysisData.sections.push({
            title: "I. ÉLÉMENTS FACTUELS CONSTATÉS",
            content: generateElementsFactuels(text, context, vehicleData)
        });

        analysisData.sections.push({
            title: "II. QUALIFICATION JURIDIQUE DE LA SITUATION",
            content: generateQualification(hasVehicle, hasDefect, hasProfessional, hasParticulier)
        });

        // NOUVELLE SECTION : Risques et Responsabilités
        analysisData.sections.push({
            title: "III. RISQUES ET RESPONSABILITÉS ENCOURUS SELON LA QUALITÉ DU VENDEUR",
            content: generateRisquesResponsabilites(hasProfessional, hasParticulier, hasDefect, rappelsData)
        });

        analysisData.sections.push({
            title: "IV. ANALYSE DES TROIS CRITÈRES CUMULATIFS",
            content: generateCriteresAnalysis(text, context, hasDefect)
        });

        analysisData.sections.push({
            title: "V. RÉGIMES DE GARANTIE POTENTIELLEMENT APPLICABLES",
            content: generateGarantiesAnalysis(hasProfessional, hasWarranty)
        });

        analysisData.sections.push({
            title: "VI. ANALYSE DOCUMENTAIRE",
            content: generateDocumentaireAnalysis(hasInvoice, hasRepair, hasControlTech)
        });

        if (rappelsData.rappelsTrouves.length > 0 || rappelsData.problemesTransversaux.length > 0) {
            analysisData.sections.push({
                title: "VII. CAMPAGNES DE RAPPEL ET PROBLÈMES CONNUS POTENTIELLEMENT CONCERNÉS",
                content: generateRappelsAnalysis(rappelsData, vehicleData)
            });
        }

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "VIII" : "VII") + ". JURISPRUDENCE DE RÉFÉRENCE",
            content: generateJurisprudenceAnalysis()
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "IX" : "VIII") + ". ÉLÉMENTS À VÉRIFIER ET COMPLÉTER",
            content: generateVerificationNeeded(text, context, rappelsData)
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "X" : "IX") + ". VOIES D'ACTION POSSIBLES",
            content: generateVoiesAction(hasProfessional, rappelsData)
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "XI" : "X") + ". CONCLUSION ET RECOMMANDATIONS",
            content: generateConclusion(objective, rappelsData)
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "XII" : "XI") + ". LEXIQUE JURIDIQUE MOBILISÉ DANS LA PRÉSENTE ANALYSE",
            content: generateLexique()
        });

        displayAnalysis();
    }

    // ============================================================
    // NOUVELLE SECTION : RISQUES ET RESPONSABILITÉS
    // ============================================================
    
    function generateRisquesResponsabilites(hasProfessional, hasParticulier, hasDefect, rappelsData) {
        let content = "<p><strong>Objet :</strong> Identification des risques et responsabilités encourus par les différentes parties, selon la qualité du vendeur et le contexte présenté " + termes('risques encourus', 'responsabilités', 'qualité du vendeur', 'régime de responsabilité') + ".</p>";
        
        content += "<p>La détermination des risques et responsabilités dépend fondamentalement de la qualité du vendeur (particulier ou professionnel), de la nature des défauts constatés et des circonstances de la vente " + termes('détermination des responsabilités', 'nature des défauts', 'circonstances de la vente') + ".</p>";
        
        // ============================================================
        // A. VENTE PAR UN PARTICULIER
        // ============================================================
        
        content += "<h3>A. VENTE CONCLUE PAR UN PARTICULIER (vendeur non-professionnel)</h3>";
        
        content += "<h4>A.1. Risques encourus par le vendeur particulier</h4>";
        content += "<p>Lorsque la vente est conclue par un particulier, le vendeur est soumis au régime de la garantie des vices cachés des articles 1641 et suivants du Code civil " + termes('garantie des vices cachés', 'articles 1641 et suivants du Code civil', 'vente entre particuliers') + ".</p>";
        
        content += "<p><strong>Risques civils encourus par le vendeur particulier :</strong></p>";
        content += "<ul>";
        content += "<li><strong>Action en résolution de la vente (action rédhibitoire)</strong> : l'acheteur peut demander l'annulation de la vente avec restitution du prix et du véhicule " + termes('action rédhibitoire', 'résolution de la vente', 'restitution', 'article 1644 du Code civil') + " ;</li>";
        content += "<li><strong>Action en réduction du prix (action estimatoire)</strong> : l'acheteur peut demander une diminution du prix proportionnelle au défaut " + termes('action estimatoire', 'réduction du prix', 'article 1644 du Code civil') + " ;</li>";
        content += "<li><strong>Dommages et intérêts</strong> : si le vendeur connaissait le vice (mauvaise foi), il peut être condamné à des dommages et intérêts en plus de la restitution du prix " + termes('dommages et intérêts', 'mauvaise foi', 'article 1645 du Code civil', 'scienter') + " ;</li>";
        content += "<li><strong>Frais de l'expertise</strong> : en cas de succès de l'action de l'acheteur, les frais d'expertise peuvent être mis à la charge du vendeur " + termes('frais d'expertise', 'article 1646 du Code civil') + ".</li>";
        content += "</ul>";
        
        content += "<p><strong>Risques pénaux encourus par le vendeur particulier :</strong></p>";
        content += "<ul>";
        content += "<li><strong>Tromperie</strong> (article L.213-1 du Code de la consommation) : en cas de fausse déclaration sur les caractéristiques du véhicule (kilométrage trafiqué, accident dissimulé, etc.) - peine encourue : 2 ans d'emprisonnement et 300 000 € d'amende " + termes('tromperie', 'article L.213-1 du Code de la consommation', 'sanctions pénales') + " ;</li>";
        content += "<li><strong>Faux et usage de faux</strong> (articles 441-1 et suivants du Code pénal) : en cas de falsification de documents (carte grise, contrôle technique, facture) - peine encourue : 3 ans d'emprisonnement et 45 000 € d'amende " + termes('faux', 'usage de faux', 'articles 441-1 et suivants du Code pénal') + " ;</li>";
        content += "<li><strong>Escroquerie</strong> (article 313-1 du Code pénal) : en cas de manœuvres frauduleuses pour obtenir le paiement - peine encourue : 5 ans d'emprisonnement et 375 000 € d'amende " + termes('escroquerie', 'article 313-1 du Code pénal', 'manœuvres frauduleuses') + " ;</li>";
        content += "<li><strong>Mise en danger d'autrui</strong> (article 223-1 du Code pénal) : si le vendeur a sciemment vendu un véhicule dangereux - peine encourue : 1 an d'emprisonnement et 15 000 € d'amende " + termes('mise en danger d'autrui', 'article 223-1 du Code pénal') + ".</li>";
        content += "</ul>";
        
        content += "<p><strong>Risques spécifiques liés aux rappels constructeurs (si applicable) :</strong></p>";
        if (rappelsData.rappelsTrouves.length > 0 || rappelsData.problemesTransversaux.length > 0) {
            content += "<ul>";
            content += "<li>Si le vendeur particulier avait connaissance d'un rappel non effectué et ne l'a pas disclosed à l'acheteur, cela peut caractériser la mauvaise foi au sens de l'article 1645 du Code civil " + termes('mauvaise foi', 'non-disclosure', 'rappel non effectué') + " ;</li>";
            content += "<li>La dissimulation d'un rappel de sécurité peut être qualifiée de tromperie aggravée " + termes('tromperie aggravée', 'sécurité') + " ;</li>";
            content += "<li>En cas d'accident lié à un défaut objet d'un rappel non effectué, la responsabilité civile du vendeur peut être engagée sur le fondement de la responsabilité du fait des choses (article 1242 du Code civil) " + termes('responsabilité du fait des choses', 'article 1242 du Code civil') + ".</li>";
            content += "</ul>";
        } else {
            content += "<p>Aucun rappel constructeur spécifique n'a été identifié pour ce véhicule dans la base de données. Toutefois, il convient de vérifier l'existence éventuelle d'autres rappels via le numéro VIN " + termes('vérification VIN') + ".</p>";
        }
        
        content += "<h4>A.2. Limites de protection pour l'acheteur face à un vendeur particulier</h4>";
        content += "<p>L'acheteur face à un vendeur particulier dispose de recours plus limités que face à un professionnel " + termes('limites de protection', 'recours limités') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Pas de garantie légale de conformité</strong> : ce régime (article L.217-4 du Code de la consommation) ne s'applique qu'aux ventes par des professionnels " + termes('inapplicabilité de la garantie légale de conformité', 'vente entre particuliers') + " ;</li>";
        content += "<li><strong>Charge de la preuve sur l'acheteur</strong> : c'est à l'acheteur de prouver l'existence du vice caché, son antériorité et sa gravité (pas de renversement de la charge de la preuve) " + termes('charge de la preuve sur l'acheteur', 'onus probandi') + " ;</li>";
        content += "<li><strong>Délai de prescription plus court</strong> : l'action en garantie des vices cachés se prescrit par 2 ans à compter de la découverte du vice (article 1648 du Code civil) " + termes('délai de prescription de 2 ans', 'article 1648 du Code civil', 'délai bref') + " ;</li>";
        content += "<li><strong>Obligation de diligence de l'acheteur</strong> : l'acheteur doit avoir examiné le véhicule avec attention ; les défauts apparents ne peuvent être invoqués " + termes('diligence de l'acheteur', 'défaut apparent', 'examen attentif') + " ;</li>";
        content += "<li><strong>Clause d'exonération possible</strong> : le vendeur particulier peut insérer une clause de vente \"en l'état\" ou \"sans garantie\", qui peut être opposable sauf en cas de mauvaise foi de sa part " + termes('clause d'exonération', 'vente en l'état', 'opposabilité de la clause') + ".</li>";
        content += "</ul>";
        
        content += "<div class='certainty-medium'>";
        content += "<strong>⚖️ Appréciation :</strong> Face à un vendeur particulier, l'acheteur dispose de recours effectifs mais plus limités que face à un professionnel. La preuve de la mauvaise foi du vendeur (connaissance du vice) est déterminante pour obtenir des dommages et intérêts " + termes('preuve de la mauvaise foi', 'connaissance du vice', 'dommages et intérêts') + ".";
        content += "</div>";
        
        // ============================================================
        // B. VENTE PAR UN PROFESSIONNEL
        // ============================================================
        
        content += "<h3>B. VENTE CONCLUE PAR UN PROFESSIONNEL (vendeur professionnel)</h3>";
        
        content += "<h4>B.1. Risques encourus par le vendeur professionnel</h4>";
        content += "<p>Lorsque la vente est conclue par un professionnel, le vendeur est soumis à un régime de responsabilité beaucoup plus étendu, combinant plusieurs fondements juridiques " + termes('régime de responsabilité étendu', 'cumul des fondements', 'vendeur professionnel') + ".</p>";
        
        content += "<p><strong>Risques civils encourus par le vendeur professionnel :</strong></p>";
        content += "<ul>";
        content += "<li><strong>Action en garantie légale de conformité</strong> (articles L.217-4 et suivants du Code de la consommation) : l'acheteur peut exiger la réparation, le remplacement, la réduction du prix ou la résolution de la vente, sans avoir à prouver la faute du vendeur " + termes('action en garantie légale de conformité', 'articles L.217-4 et suivants du Code de la consommation', 'responsabilité sans faute') + " ;</li>";
        content += "<li><strong>Action en garantie des vices cachés</strong> (articles 1641 et suivants du Code civil) : action cumulative ou alternative, avec dommages et intérêts si le vendeur professionnel est présumé connaître le vice (article 1645 du Code civil) " + termes('action en garantie des vices cachés', 'présomption de connaissance du professionnel', 'article 1645 du Code civil') + " ;</li>";
        content += "<li><strong>Action en résolution pour inexécution</strong> (article 1224 du Code civil) : en cas de manquement grave aux obligations contractuelles " + termes('action en résolution pour inexécution', 'article 1224 du Code civil', 'inexécution contractuelle') + " ;</li>";
        content += "<li><strong>Action en nullité pour dol</strong> (article 1137 du Code civil) : en cas de réticence dolosive ou de manœuvres trompeuses " + termes('action en nullité pour dol', 'réticence dolosive', 'article 1137 du Code civil') + " ;</li>";
        content += "<li><strong>Action en responsabilité précontractuelle</strong> : en cas de manquement à l'obligation d'information précontractuelle (article 1112-1 du Code civil) " + termes('responsabilité précontractuelle', 'article 1112-1 du Code civil', 'obligation d'information précontractuelle') + " ;</li>";
        content += "<li><strong>Dommages et intérêts étendus</strong> : le vendeur professionnel peut être condamné à réparer l'intégralité du préjudice, y compris le préjudice moral et les frais accessoires " + termes('dommages et intérêts étendus', 'réparation intégrale', 'préjudice moral') + ".</li>";
        content += "</ul>";
        
        content += "<p><strong>Risques pénaux encourus par le vendeur professionnel :</strong></p>";
        content += "<ul>";
        content += "<li><strong>Tromperie</strong> (article L.213-1 du Code de la consommation) : 2 ans d'emprisonnement et 300 000 € d'amende (peine pouvant être portée à 10% du chiffre d'affaires) " + termes('tromperie', 'article L.213-1 du Code de la consommation', 'amende proportionnelle au CA') + " ;</li>";
        content += "<li><strong>Pratique commerciale trompeuse</strong> (article L.121-2 du Code de la consommation) : 2 ans d'emprisonnement et 300 000 € d'amende " + termes('pratique commerciale trompeuse', 'article L.121-2 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Pratique commerciale agressive</strong> (article L.121-6 du Code de la consommation) : mêmes peines " + termes('pratique commerciale agressive', 'article L.121-6 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Défaut d'information sur les caractéristiques essentielles</strong> (article L.111-1 du Code de la consommation) : sanctions pénales et administratives " + termes('défaut d'information', 'article L.111-1 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Non-respect des obligations de rappel</strong> : sanctions administratives de la DGCCRF, pouvant aller jusqu'à l'interdiction temporaire d'exercer " + termes('sanctions administratives', 'DGCCRF', 'interdiction d'exercer') + " ;</li>";
        content += "<li><strong>Mise en danger d'autrui</strong> (article 223-1 du Code pénal) : 1 an d'emprisonnement et 15 000 € d'amende " + termes('mise en danger d'autrui', 'article 223-1 du Code pénal') + " ;</li>";
        content += "<li><strong>Homicide ou blessures involontaires</strong> (articles 221-6 et 222-19 du Code pénal) : si un défaut non révélé cause un accident - jusqu'à 3 ans d'emprisonnement et 45 000 € d'amende (aggravé pour les professionnels) " + termes('homicide involontaire', 'blessures involontaires', 'articles 221-6 et 222-19 du Code pénal') + ".</li>";
        content += "</ul>";
        
        content += "<p><strong>Risques administratifs encourus par le vendeur professionnel :</strong></p>";
        content += "<ul>";
        content += "<li><strong>Sanctions de la DGCCRF</strong> : injonctions, amendes administratives (jusqu'à 300 000 € pour une personne morale), publication de la décision " + termes('sanctions DGCCRF', 'amendes administratives', 'publication de la décision') + " ;</li>";
        content += "<li><strong>Retrait ou rappel de produits</strong> : obligation de rappeler les véhicules vendus présentant un danger " + termes('retrait de produits', 'rappel de produits', 'obligation de sécurité') + " ;</li>";
        content += "<li><strong>Suspension ou retrait d'agrément</strong> : pour les professions réglementées (garagistes, concessionnaires) " + termes('suspension d'agrément', 'retrait d'agrément', 'professions réglementées') + " ;</li>";
        content += "<li><strong>Injonction de cesser</strong> : ordre de cesser les pratiques illicites sous astreinte " + termes('injonction de cesser', 'astreinte') + " ;</li>";
        content += "<li><strong>Signalement au parquet</strong> : transmission du dossier au procureur de la République pour poursuites pénales " + termes('signalement au parquet', 'poursuites pénales') + ".</li>";
        content += "</ul>";
        
        content += "<h4>B.2. Obligations spécifiques du vendeur professionnel automobile</h4>";
        content += "<p>Le vendeur professionnel automobile est soumis à des obligations renforcées, dont le non-respect expose à des risques spécifiques " + termes('obligations renforcées', 'vendeur automobile') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Obligation de délivrance conforme</strong> (article 1604 du Code civil) : délivrer un bien exempt de tout défaut " + termes('obligation de délivrance conforme', 'article 1604 du Code civil') + " ;</li>";
        content += "<li><strong>Obligation d'information renforcée</strong> : révéler tout défaut connu ou décelable (Cass. civ. 1ère, 3 mars 2011, n° 10-10.315) " + termes('obligation d'information renforcée', 'défaut connu ou décelable') + " ;</li>";
        content += "<li><strong>Obligation de vérification des rappels</strong> : vérifier si le véhicule a fait l'objet de campagnes de rappel et en informer l'acquéreur (Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485) " + termes('obligation de vérification des rappels', 'Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485') + " ;</li>";
        content += "<li><strong>Obligation de conseil</strong> : conseiller l'acquéreur sur le choix du véhicule adapté à ses besoins " + termes('obligation de conseil', 'adéquation aux besoins') + " ;</li>";
        content += "<li><strong>Obligation de sécurité</strong> : ne pas vendre un véhicule présentant un danger pour la sécurité " + termes('obligation de sécurité', 'sécurité du véhicule') + " ;</li>";
        content += "<li><strong>Obligation de traçabilité</strong> : conserver les documents relatifs aux interventions réalisées " + termes('obligation de traçabilité', 'conservation des documents') + " ;</li>";
        content += "<li><strong>Obligation de transparence sur l'historique</strong> : fournir un historique complet et vérifié du véhicule " + termes('obligation de transparence', 'historique vérifié') + ".</li>";
        content += "</ul>";
        
        content += "<h4>B.3. Avantages procéduraux pour l'acheteur face à un professionnel</h4>";
        content += "<ul>";
        content += "<li><strong>Renversement de la charge de la preuve</strong> : c'est au professionnel de prouver qu'il n'a pas fauté " + termes('renversement de la charge de la preuve', 'présomption de faute') + " ;</li>";
        content += "<li><strong>Présomption de connaissance des vices</strong> : le professionnel est présumé connaître les défauts (article 1645 du Code civil) " + termes('présomption de connaissance', 'article 1645 du Code civil') + " ;</li>";
        content += "<li><strong>Délai de garantie de 2 ans</strong> : délai de la garantie légale de conformité, avec présomption d'antériorité pendant les 6 premiers mois " + termes('délai de 2 ans', 'présomption d'antériorité de 6 mois') + " ;</li>";
        content += "<li><strong>Nullité des clauses d'exonération</strong> : les clauses limitant la responsabilité du professionnel sont réputées non écrites " + termes('nullité des clauses d'exonération', 'clauses réputées non écrites') + " ;</li>";
        content += "<li><strong>Accès à la médiation de la consommation</strong> : possibilité de saisir gratuitement un médiateur " + termes('médiation de la consommation', 'article L.612-1 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Action de groupe</strong> : possibilité de rejoindre une action collective en cas de préjudices similaires subis par plusieurs consommateurs " + termes('action de groupe', 'article L.623-1 du Code de la consommation') + ".</li>";
        content += "</ul>";
        
        content += "<div class='certainty-high'>";
        content += "<strong>⚖️ Appréciation :</strong> Face à un vendeur professionnel, l'acheteur bénéficie d'une protection juridique étendue, avec plusieurs régimes de garantie cumulables, un renversement de la charge de la preuve et des sanctions pénales et administratives dissuasives. Les risques encourus par le vendeur professionnel sont significatifs, tant sur le plan civil (dommages et intérêts, résolution) que pénal (emprisonnement, amendes) et administratif (sanctions DGCCRF) " + termes('protection étendue de l\'acheteur', 'risques significatifs pour le professionnel', 'cumul des sanctions') + ".";
        content += "</div>";
        
        // ============================================================
        // C. CAS PARTICULIERS
        // ============================================================
        
        content += "<h3>C. CAS PARTICULIERS ET SITUATIONS INTERMÉDIAIRES</h3>";
        
        content += "<h4>C.1. Vendeur occasionnel (personne vendant plusieurs véhicules sans être professionnel)</h4>";
        content += "<p>Certaines personnes vendent régulièrement des véhicules sans avoir le statut de professionnel. La jurisprudence requalifie parfois ces ventes en ventes professionnelles " + termes('vendeur occasionnel', 'requalification en vendeur professionnel', 'activité dissimulée') + ".</p>";
        content += "<ul>";
        content += "<li><strong>Critères de requalification</strong> : fréquence des ventes, recherche de profit, publicité, organisation de l'activité " + termes('critères de requalification', 'activité habituelle', 'recherche de profit') + " ;</li>";
        content += "<li><strong>Conséquences</strong> : application du régime professionnel avec toutes ses obligations et sanctions " + termes('application du régime professionnel', 'obligations renforcées') + " ;</li>";
        content += "<li><strong>Risques pour le vendeur</strong> : exercice illégal d'une profession réglementée (article L.221-1 du Code de la consommation) - 1 an d'emprisonnement et 15 000 € d'amende " + termes('exercice illégal', 'article L.221-1 du Code de la consommation') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C.2. Mandataire ou intermédiaire</h4>";
        content += "<p>Lorsque la vente est conclue par l'intermédiaire d'un mandataire (concessionnaire agissant pour le compte d'un particulier, centrale d'achat, etc.) " + termes('mandataire', 'intermédiaire', 'vente par mandataire') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Responsabilité du mandataire</strong> : si le mandataire est un professionnel, il engage sa responsabilité professionnelle " + termes('responsabilité du mandataire professionnel') + " ;</li>";
        content += "<li><strong>Responsabilité du mandant</strong> : le propriétaire du véhicule reste responsable des vices cachés " + termes('responsabilité du mandant', 'vices cachés') + " ;</li>";
        content += "<li><strong>Responsabilité solidaire possible</strong> : dans certains cas, mandant et mandataire peuvent être tenus solidairement " + termes('responsabilité solidaire', 'solidarité passive') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C.3. Importateur parallèle ou vendeur hors réseau officiel</h4>";
        content += "<p>Cas des véhicules importés hors du réseau officiel du constructeur " + termes('importateur parallèle', 'vente hors réseau') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Responsabilité du vendeur</strong> : même régime que tout vendeur professionnel " + termes('responsabilité du vendeur professionnel') + " ;</li>";
        content += "<li><strong>Difficultés supplémentaires</strong> : historique du véhicule difficile à vérifier, rappels constructeur potentiellement non applicables dans le pays d'importation " + termes('difficultés de vérification', 'rappels non applicables') + " ;</li>";
        content += "<li><strong>Garantie constructeur limitée</strong> : la garantie constructeur peut ne pas s'appliquer aux véhicules importés parallèlement " + termes('garantie constructeur limitée', 'importation parallèle') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C.4. Vente aux enchères</h4>";
        content += "<p>Cas des ventes aux enchères publiques (enchères judiciaires, ventes de faillite, etc.) " + termes('vente aux enchères', 'enchères judiciaires') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Régime spécifique</strong> : application de l'article 1649 du Code civil (pas de garantie pour les ventes judiciaires) " + termes('article 1649 du Code civil', 'pas de garantie pour ventes judiciaires') + " ;</li>";
        content += "<li><strong>Exceptions</strong> : la garantie peut s'appliquer en cas de dol ou de vice caché non divulgué " + termes('exception pour dol', 'vice caché non divulgué') + " ;</li>";
        content += "<li><strong>Risques accrus pour l'acheteur</strong> : principe \"caveat emptor\" (que l'acheteur prenne garde) " + termes('caveat emptor', 'risques accrus pour l\'acheteur') + ".</li>";
        content += "</ul>";
        
        // ============================================================
        // D. TABLEAU RÉCAPITULATIF
        // ============================================================
        
        content += "<h3>D. TABLEAU RÉCAPITULATIF DES SANCTIONS ENCOURUES</h3>";
        
        content += "<h4>D.1. Sanctions civiles</h4>";
        content += "<ul>";
        content += "<li><strong>Vendeur particulier</strong> : résolution de la vente OU réduction du prix + dommages et intérêts si mauvaise foi prouvée " + termes('sanctions civiles vendeur particulier') + " ;</li>";
        content += "<li><strong>Vendeur professionnel</strong> : réparation, remplacement, réduction du prix, résolution de la vente + dommages et intérêts (présomption de mauvaise foi) " + termes('sanctions civiles vendeur professionnel', 'présomption de mauvaise foi') + " ;</li>";
        content += "<li><strong>Montant des dommages et intérêts</strong> : variable selon le préjudice, peut inclure le prix du véhicule, les frais de réparation, la perte de valeur, le préjudice moral, les frais de justice " + termes('montant des dommages et intérêts', 'préjudice économique', 'préjudice moral', 'frais de justice') + ".</li>";
        content += "</ul>";
        
        content += "<h4>D.2. Sanctions pénales (cumulables avec les sanctions civiles)</h4>";
        content += "<ul>";
        content += "<li><strong>Tromperie</strong> : 2 ans d'emprisonnement + 300 000 € d'amende " + termes('tromperie', 'sanctions pénales') + " ;</li>";
        content += "<li><strong>Pratique commerciale trompeuse</strong> : 2 ans d'emprisonnement + 300 000 € d'amende " + termes('pratique commerciale trompeuse') + " ;</li>";
        content += "<li><strong>Faux et usage de faux</strong> : 3 ans d'emprisonnement + 45 000 € d'amende " + termes('faux et usage de faux') + " ;</li>";
        content += "<li><strong>Escroquerie</strong> : 5 ans d'emprisonnement + 375 000 € d'amende " + termes('escroquerie') + " ;</li>";
        content += "<li><strong>Mise en danger d'autrui</strong> : 1 an d'emprisonnement + 15 000 € d'amende " + termes('mise en danger d\'autrui') + " ;</li>";
        content += "<li><strong>Blessures involontaires</strong> : jusqu'à 3 ans d'emprisonnement + 45 000 € d'amende " + termes('blessures involontaires') + " ;</li>";
        content += "<li><strong>Homicide involontaire</strong> : jusqu'à 3 ans d'emprisonnement + 45 000 € d'amende " + termes('homicide involontaire') + ".</li>";
        content += "</ul>";
        
        content += "<h4>D.3. Sanctions administratives (vendeur professionnel uniquement)</h4>";
        content += "<ul>";
        content += "<li><strong>Amende administrative DGCCRF</strong> : jusqu'à 300 000 € pour une personne morale " + termes('amende administrative DGCCRF') + " ;</li>";
        content += "<li><strong>Publication de la décision</strong> : aux frais du professionnel " + termes('publication de la décision') + " ;</li>";
        content += "<li><strong>Injonction de cesser</strong> : sous astreinte " + termes('injonction de cesser', 'astreinte') + " ;</li>";
        content += "<li><strong>Retrait d'agrément</strong> : pour les professions réglementées " + termes('retrait d\'agrément') + " ;</li>";
        content += "<li><strong>Interdiction temporaire d'exercer</strong> : dans les cas graves " + termes('interdiction temporaire d\'exercer') + ".</li>";
        content += "</ul>";
        
        // ============================================================
        // E. DÉLAIS DE PRESCRIPTION
        // ============================================================
        
        content += "<h3>E. DÉLAIS DE PRESCRIPTION APPLICABLES</h3>";
        content += "<p>Les délais de prescription varient selon la nature de l'action et la qualité du vendeur " + termes('délais de prescription', 'forclusion') + " :</p>";
        
        content += "<h4>E.1. Actions civiles</h4>";
        content += "<ul>";
        content += "<li><strong>Garantie légale de conformité</strong> (vendeur professionnel) : 2 ans à compter de la délivrance du bien (article L.217-16 du Code de la consommation) " + termes('délai de 2 ans', 'article L.217-16 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Garantie des vices cachés</strong> : 2 ans à compter de la découverte du vice (article 1648 du Code civil) " + termes('délai de 2 ans', 'article 1648 du Code civil', 'découverte du vice') + " ;</li>";
        content += "<li><strong>Responsabilité contractuelle de droit commun</strong> : 5 ans à compter de la connaissance du fait générateur (article 2224 du Code civil) " + termes('délai de 5 ans', 'article 2224 du Code civil') + " ;</li>";
        content += "<li><strong>Responsabilité délictuelle</strong> : 5 ans à compter de la manifestation du dommage (article 2224 du Code civil) " + termes('délai de 5 ans', 'responsabilité délictuelle') + " ;</li>";
        content += "<li><strong>Responsabilité du fait des produits défectueux</strong> : 3 ans à compter de la connaissance du dommage, avec une durée maximale de 10 ans après la mise en circulation du produit (article 1245-16 du Code civil) " + termes('délai de 3 ans', 'article 1245-16 du Code civil', 'durée maximale de 10 ans') + " ;</li>";
        content += "<li><strong>Action en nullité pour dol</strong> : 5 ans à compter de la découverte du dol (article 1304 du Code civil) " + termes('délai de 5 ans', 'article 1304 du Code civil', 'découverte du dol') + " ;</li>";
        content += "<li><strong>Action en résolution pour inexécution</strong> : 5 ans (article 2224 du Code civil) " + termes('délai de 5 ans', 'article 2224 du Code civil') + ".</li>";
        content += "</ul>";
        
        content += "<h4>E.2. Actions pénales</h4>";
        content += "<ul>";
        content += "<li><strong>Contraventions</strong> : 1 an " + termes('prescription contraventionnelle', '1 an') + " ;</li>";
        content += "<li><strong>Délits</strong> (tromperie, escroquerie, etc.) : 6 ans (article 8 du Code de procédure pénale) " + termes('prescription délictuelle', '6 ans', 'article 8 du Code de procédure pénale') + " ;</li>";
        content += "<li><strong>Crimes</strong> : 20 ans " + termes('prescription criminelle', '20 ans') + ".</li>";
        content += "</ul>";
        
        content += "<h4>E.3. Actions administratives</h4>";
        content += "<ul>";
        content += "<li><strong>Sanctions administratives de la DGCCRF</strong> : 3 ans à compter des faits (article L.233-7 du Code de la consommation) " + termes('délai de 3 ans', 'article L.233-7 du Code de la consommation') + ".</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>⚠️ Important :</strong> Les délais de prescription sont d'ordre public. Une fois le délai écoulé, l'action n'est plus recevable, sauf cas d'interruption ou de suspension du délai (reconnaissance de dette, action en justice, etc.) " + termes('interruption de la prescription', 'suspension de la prescription', 'reconnaissance de dette') + ". Il est impératif de vérifier les délais applicables au cas spécifique avant d'engager toute action.";
        content += "</div>";
        
        // ============================================================
        // F. CONSÉQUENCES PRATIQUES
        // ============================================================
        
        content += "<h3>F. CONSÉQUENCES PRATIQUES SELON LE CONTEXTE</h3>";
        
        content += "<h4>F.1. Si le vendeur est un particulier</h4>";
        content += "<ul>";
        content += "<li><strong>Pour l'acheteur</strong> : privilégier l'action en garantie des vices cachés, réunir la preuve de la mauvaise foi du vendeur, agir rapidement dans le délai de 2 ans " + termes('stratégie pour l\'acheteur', 'action en garantie des vices cachés') + " ;</li>";
        content += "<li><strong>Pour le vendeur</strong> : risque limité à la résolution de la vente ou à la réduction du prix, sauf si mauvaise foi prouvée " + termes('risque limité pour le vendeur particulier') + " ;</li>";
        content += "<li><strong>Recommandation</strong> : tentative de conciliation préalable, médiation, puis action en justice si nécessaire " + termes('conciliation préalable', 'médiation') + ".</li>";
        content += "</ul>";
        
        content += "<h4>F.2. Si le vendeur est un professionnel</h4>";
        content += "<ul>";
        content += "<li><strong>Pour l'acheteur</strong> : privilégier l'action en garantie légale de conformité (plus favorable), cumuler si possible avec l'action en garantie des vices cachés, saisir la DGCCRF en cas de pratiques trompeuses " + termes('stratégie pour l\'acheteur', 'cumul des actions', 'signalement DGCCRF') + " ;</li>";
        content += "<li><strong>Pour le vendeur</strong> : risques civils, pénaux et administratifs cumulatifs, importance de la prévention et de la conformité " + termes('risques cumulatifs pour le professionnel', 'prévention', 'conformité') + " ;</li>";
        content += "<li><strong>Recommandation</strong> : mise en demeure formelle, médiation de la consommation, action en justice si nécessaire, signalement aux autorités " + termes('mise en demeure', 'médiation de la consommation', 'signalement aux autorités') + ".</li>";
        content += "</ul>";
        
        content += "<h4>F.3. Si la qualité du vendeur est incertaine</h4>";
        content += "<ul>";
        content += "<li><strong>Vérification préalable</strong> : consulter le registre du commerce (Infogreffe, Pappers, Societe.com) pour vérifier l'existence d'une immatriculation " + termes('vérification du statut', 'registre du commerce', 'immatriculation') + " ;</li>";
        content += "<li><strong>Critères d'appréciation</strong> : fréquence des ventes, publicité, organisation de l'activité, recherche de profit " + termes('critères d'appréciation du statut professionnel') + " ;</li>";
        content += "<li><strong>En cas de doute</strong> : agir sur les deux fondements (professionnel et particulier) en alternatif " + termes('actions alternatives', 'subsidiarité') + " ;</li>";
        content += "<li><strong>Recommandation</strong> : consulter un avocat pour déterminer la stratégie optimale " + termes('conseil d\'avocat', 'stratégie optimale') + ".</li>";
        content += "</ul>";
        
        content += "<div class='certainty-low'>";
        content += "<strong>️ Limite de l'analyse :</strong> La présente analyse des risques et responsabilités est basée sur les éléments fournis et sur le droit français en vigueur. Elle ne constitue pas un conseil juridique personnalisé. Les risques effectifs dépendent des circonstances spécifiques de chaque affaire et doivent être appréciés par un professionnel du droit " + termes('limite de l\'analyse', 'non-conseil juridique personnalisé', 'appréciation au cas par cas') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION I - ÉLÉMENTS FACTUELS
    // ============================================================
    
    function generateElementsFactuels(text, context, vehicleData) {
        let content = "<p><strong>Objet :</strong> Recensement des éléments factuels fournis par l'utilisateur, sans interprétation.</p>";
        
        content += "<h4>A. Informations sur le véhicule</h4><ul>";
        content += "<li><strong>Marque :</strong> " + (vehicleData.marque || 'non précisée') + "</li>";
        content += "<li><strong>Modèle :</strong> " + (vehicleData.modele || 'non précisé') + "</li>";
        content += "<li><strong>Année de mise en circulation :</strong> " + (vehicleData.annee || 'non précisée') + "</li>";
        if (vehicleData.kilometrage) content += "<li><strong>Kilométrage :</strong> " + vehicleData.kilometrage + "</li>";
        if (vehicleData.vin) content += "<li><strong>VIN :</strong> " + vehicleData.vin.substring(0, 8) + "..." + "</li>";
        content += "</ul>";
        
        content += "<h4>B. Faits décrits par l'utilisateur</h4>";
        content += "<div class='verification-needed'><em>Éléments extraits textuellement, non vérifiés :</em></div>";
        content += "<p>" + text.substring(0, 800) + (text.length > 800 ? "..." : "") + "</p>";
        
        if (context) {
            content += "<h4>C. Contexte fourni</h4>";
            content += "<p>" + context.substring(0, 600) + (context.length > 600 ? "..." : "") + "</p>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>⚠️ Limite :</strong> Cette section reprend uniquement les éléments fournis. Elle ne constitue pas une vérification factuelle. Une expertise technique contradictoire peut être nécessaire pour établir les faits de manière certaine.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION II - QUALIFICATION JURIDIQUE
    // ============================================================
    
    function generateQualification(hasVehicle, hasDefect, hasProfessional, hasParticulier) {
        let content = "<p><strong>Objet :</strong> Qualification juridique de la situation selon les éléments fournis.</p>";
        
        content += "<h4>A. Nature de la transaction</h4>";
        
        if (hasVehicle) {
            content += "<p>Les éléments fournis évoquent une transaction portant sur un véhicule automobile. Si cette qualification est confirmée, la vente est qualifiée de vente de bien meuble corporel " + termes('vente', 'bien meuble corporel', 'contrat de vente') + ", soumise :</p>";
            content += "<ul>";
            content += "<li>Aux dispositions du Code civil relatives à la vente (articles 1582 et suivants) " + termes('droit commun des obligations') + " ;</li>";
            content += "<li>Aux dispositions du Code de la consommation si le vendeur est un professionnel " + termes('droit de la consommation', 'ordre public de protection') + " ;</li>";
            content += "<li>À la jurisprudence de la Cour de cassation en matière de vente automobile.</li>";
            content += "</ul>";
        } else {
            content += "<p>La nature de la transaction n'est pas clairement établie. Il convient de préciser s'il s'agit d'une vente, d'une prestation de service, ou d'une autre opération juridique " + termes('qualification juridique', 'nature du contrat') + ".</p>";
        }
        
        content += "<h4>B. Qualité des parties</h4>";
        
        if (hasProfessional && !hasParticulier) {
            content += "<p class='certainty-high'>Selon les éléments fournis, la transaction semble avoir été conclue avec un vendeur professionnel " + termes('vendeur professionnel', 'relation B2C', 'qualité de professionnel') + ". Si cette qualification est confirmée, le régime de protection du consommateur s'applique, avec :</p>";
            content += "<ul>";
            content += "<li>Un renversement de la charge de la preuve à l'encontre du professionnel " + termes('renversement de la charge de la preuve', 'présomption de connaissance') + " ;</li>";
            content += "<li>L'interdiction des clauses abusives " + termes('clause abusive', 'déséquilibre significatif') + " ;</li>";
            content += "<li>Une obligation d'information renforcée du vendeur " + termes('obligation d\'information renforcée', 'obligation précontractuelle') + ".</li>";
            content += "</ul>";
        } else if (hasParticulier && !hasProfessional) {
            content += "<p class='certainty-medium'>Selon les éléments fournis, la transaction semble avoir été conclue entre particuliers " + termes('vente entre particuliers', 'relation C2C') + ". Dans ce cas, le régime de la garantie des vices cachés du Code civil s'applique (articles 1641 et suivants) " + termes('garantie des vices cachés', 'article 1641 du Code civil') + ", avec des conditions plus strictes pour l'acquéreur.</p>";
        } else if (hasProfessional && hasParticulier) {
            content += "<p class='certainty-low'>Les éléments fournis mentionnent à la fois un professionnel et un particulier. Il convient de clarifier la qualité exacte du vendeur " + termes('qualification des parties', 'qualité du vendeur') + " pour déterminer le régime applicable.</p>";
        } else {
            content += "<p class='certainty-low'>La qualité du vendeur n'est pas établie. Cette information est déterminante pour le choix du régime juridique applicable " + termes('régime juridique applicable', 'qualification du vendeur') + ".</p>";
        }
        
        content += "<h4>C. Nature des désordres évoqués</h4>";
        
        if (hasDefect) {
            content += "<p>Les éléments fournis évoquent des désordres ou dysfonctionnements. Selon leur nature, plusieurs qualifications juridiques sont potentiellement envisageables " + termes('qualification des désordres') + " :</p>";
            content += "<ul>";
            content += "<li><strong>Défaut de conformité</strong> : si le bien ne présente pas les qualités attendues " + termes('défaut de conformité', 'non-conformité') + " ;</li>";
            content += "<li><strong>Manquement à l'obligation de délivrance</strong> : si le vendeur n'a pas délivré un bien exempt de vices " + termes('obligation de délivrance', 'délivrance conforme') + " ;</li>";
            content += "<li><strong>Manquement à l'obligation d'information</strong> : si le vendeur n'a pas révélé des informations essentielles " + termes('manquement à l\'obligation d\'information', 'réticence dolosive') + ".</li>";
            content += "</ul>";
            content += "<p class='verification-needed'><strong>À vérifier :</strong> La qualification définitive dépendra de l'expertise technique et de l'examen des documents contractuels " + termes('preuve', 'expertise contradictoire') + ".</p>";
        } else {
            content += "<p>Aucun désordre spécifique n'est clairement identifié. Il convient de préciser la nature exacte des problèmes constatés " + termes('caractérisation du défaut') + ".</p>";
        }
        
        return content;
    }

    // ============================================================
    // SECTION IV - TROIS CRITÈRES CUMULATIFS
    // ============================================================
    
    function generateCriteresAnalysis(text, context, hasDefect) {
        let content = "<p><strong>Objet :</strong> Examen des trois critères cumulatifs requis pour caractériser la responsabilité du vendeur, selon les éléments fournis.</p>";
        
        content += "<p>La jurisprudence de la Cour de cassation impose la réunion cumulative de trois critères " + termes('critères cumulatifs', 'réunion cumulative') + ". L'analyse ci-dessous examine chaque critère au regard des éléments fournis.</p>";
        
        content += "<h4>A. Premier critère : Antériorité du défaut au moment de la vente</h4>";
        content += "<p><strong>Exigence :</strong> Le désordre doit exister antérieurement à la vente, même s'il ne se manifeste que postérieurement " + termes('antériorité du défaut', 'fait générateur antérieur') + ".</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les éléments décrivent des dysfonctionnements. Cependant, la date d'apparition exacte du défaut n'est pas établie avec certitude à ce stade " + termes('date d\'apparition du défaut', 'lien de causalité') + ".</p>";
            content += "<p><strong>Pour établir l'antériorité, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Faire réaliser une expertise technique permettant de dater l'apparition du défaut " + termes('expertise technique', 'rapport d\'expertise') + " ;</li>";
            content += "<li>Vérifier l'absence de mention du défaut dans les documents de vente " + termes('preuve documentaire', 'état des lieux') + " ;</li>";
            content += "<li>Analyser la nature du défaut (défaut de fabrication, usure anormale) pour écarter une survenance postérieure " + termes('défaut de fabrication', 'usure anormale', 'cause étrangère') + " ;</li>";
            content += "<li>Examiner l'historique d'entretien du véhicule " + termes('historique d\'entretien', 'traçabilité') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 14 décembre 2010, n° 09-69.614 " + termes('jurisprudence', 'antériorité déduite de la nature du défaut') + ".</p>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> L'antériorité ne peut être définitivement établie sans expertise technique contradictoire " + termes('expertise contradictoire', 'principe du contradictoire') + ".</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir l'antériorité d'un défaut n'est fourni à ce stade " + termes('défaut de preuve') + ".</p>";
        }
        
        content += "<h4>B. Deuxième critère : Caractère caché du défaut</h4>";
        content += "<p><strong>Exigence :</strong> Le défaut doit être non apparent, c'est-à-dire non décelable par un examen attentif lors de la vente " + termes('caractère caché', 'défaut non apparent', 'inapparence') + ".</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les dysfonctionnements décrits semblent ne pas avoir été détectés lors de la vente. Cependant, le caractère caché doit être apprécié au regard des compétences de l'acquéreur " + termes('appréciation in concreto', 'compétences de l\'acquéreur') + ".</p>";
            content += "<p><strong>Pour établir le caractère caché, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Vérifier que le défaut n'était pas mentionné dans les documents contractuels " + termes('documents contractuels', 'transparence contractuelle') + " ;</li>";
            content += "<li>Établir que l'acquéreur non-professionnel ne pouvait pas le détecter lors d'un examen visuel standard " + termes('examen attentif', 'diligence de l\'acquéreur') + " ;</li>";
            content += "<li>Vérifier que le rapport de contrôle technique ne mentionnait pas le défaut " + termes('contrôle technique', 'rapport de contrôle') + " ;</li>";
            content += "<li>Démontrer que le défaut nécessitait des tests spécifiques pour être détecté " + termes('tests spécifiques', 'expertise spécialisée') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 3 mai 2006, n° 03-18.852 " + termes('caractère caché apprécié selon les compétences de l\'acquéreur') + ".</p>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> Le caractère caché dépend des circonstances spécifiques de la vente et des compétences de l'acquéreur " + termes('circonstances de la vente', 'qualité de l\'acquéreur') + ".</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir le caractère caché d'un défaut n'est fourni à ce stade " + termes('défaut de preuve sur l\'inapparence') + ".</p>";
        }
        
        content += "<h4>C. Troisième critère : Gravité du défaut</h4>";
        content += "<p><strong>Exigence :</strong> Le défaut doit être suffisamment grave pour rendre le bien impropre à son usage, ou diminuer tellement cet usage que l'acquéreur ne l'aurait pas acquis ou aurait payé un moindre prix " + termes('gravité du défaut', 'impropriété à l\'usage', 'diminution d\'usage') + ".</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les dysfonctionnements décrits peuvent potentiellement caractériser une certaine gravité, mais celle-ci doit être appréciée au cas par cas " + termes('appréciation in concreto de la gravité') + ".</p>";
            content += "<p><strong>Pour établir la gravité, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Évaluer l'impact du défaut sur la sécurité du véhicule et de ses occupants " + termes('sécurité', 'défaut de sécurité') + " ;</li>";
            content += "<li>Comparer le coût des réparations à la valeur du véhicule " + termes('coût des réparations', 'valeur vénale', 'proportionnalité') + " ;</li>";
            content += "<li>Vérifier si le véhicule peut encore être utilisé dans des conditions normales " + termes('usage normal', 'destination du bien') + " ;</li>";
            content += "<li>Évaluer la dépréciation de la valeur vénale du bien " + termes('dépréciation', 'moins-value', 'préjudice économique') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 17 janvier 2006, n° 03-15.694 " + termes('gravité appréciée in concreto') + ".</p>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> La gravité doit être appréciée au regard des circonstances spécifiques et, le cas échéant, d'une expertise technique " + termes('expertise technique', 'évaluation du préjudice') + ".</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir la gravité d'un défaut n'est fourni à ce stade " + termes('défaut de preuve sur la gravité') + ".</p>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>Conclusion sur les critères :</strong> La réunion des trois critères cumulatifs ne peut être définitivement établie sur la base des seuls éléments fournis " + termes('réunion cumulative des critères', 'caractérisation de la responsabilité') + ". Une expertise technique contradictoire et l'examen approfondi des documents contractuels sont nécessaires pour caractériser avec certitude la responsabilité du vendeur " + termes('responsabilité du vendeur', 'lien de causalité', 'faute') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION V - GARANTIES
    // ============================================================
    
    function generateGarantiesAnalysis(hasProfessional, hasWarranty) {
        let content = "<p><strong>Objet :</strong> Présentation des régimes de garantie potentiellement applicables, selon la qualification des parties.</p>";
        
        content += "<p>Les régimes de garantie applicables dépendent de la qualité du vendeur et des circonstances de la vente " + termes('régime de garantie applicable', 'qualification des parties') + ".</p>";
        
        if (hasProfessional) {
            content += "<h4>A. Garantie légale de conformité (vendeur professionnel)</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur professionnel est tenu de délivrer un bien conforme au contrat " + termes('garantie légale de conformité', 'obligation de conformité', 'article L.217-4 du Code de la consommation') + ".</p>";
            content += "<p><strong>Conditions :</strong></p>";
            content += "<ul>";
            content += "<li>Le bien doit être conforme aux qualités présentées par le vendeur " + termes('conformité aux qualités présentées') + " ;</li>";
            content += "<li>Le bien doit être propre à l'usage habituellement attendu " + termes('usage habituellement attendu', 'destination du bien') + " ;</li>";
            content += "<li>Le bien doit présenter les qualités que l'acquéreur peut légitimement attendre " + termes('attentes légitimes de l\'acquéreur') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Régime :</strong></p>";
            content += "<ul>";
            content += "<li>Délai d'action : deux ans à compter de la délivrance " + termes('délai de deux ans', 'délai de garantie', 'délai de prescription') + " ;</li>";
            content += "<li>Présomption d'antériorité si le défaut se manifeste dans les six mois " + termes('présomption d\'antériorité', 'délai de six mois') + " ;</li>";
            content += "<li>Options : réparation, remplacement, réduction du prix ou résolution de la vente " + termes('réparation', 'remplacement', 'réduction du prix', 'résolution de la vente') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 17 mai 2011, n° 10-14.479 " + termes('ordre public de protection', 'caractère d\'ordre public de la garantie') + ".</p>";
            
            content += "<h4>B. Garantie légale de délivrance conforme</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur est tenu de délivrer un bien exempt de tout défaut de conformité existant au moment de la délivrance " + termes('garantie légale de délivrance', 'délivrance conforme', 'article 1604 du Code civil') + ".</p>";
            content += "<p>Le vendeur professionnel est présumé connaître les défauts du bien qu'il commercialise " + termes('présomption de connaissance', 'renversement de la charge de la preuve') + ", ce qui renverse la charge de la preuve à son encontre " + termes('charge de la preuve', 'onus probandi') + ".</p>";
            
            content += "<h4>C. Obligation de résultat du vendeur professionnel</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur professionnel est tenu à une obligation de résultat concernant la conformité du bien vendu " + termes('obligation de résultat', 'obligation contractuelle') + ".</p>";
            content += "<ul>";
            content += "<li>Responsabilité de plein droit en cas de défaut " + termes('responsabilité de plein droit', 'responsabilité contractuelle') + " ;</li>";
            content += "<li>Exonération possible uniquement par preuve d'une cause étrangère " + termes('cause étrangère', 'force majeure', 'fait d\'un tiers', 'faute de la victime') + " ;</li>";
            content += "<li>Clauses d'exonération réputées non écrites " + termes('clause réputée non écrite', 'nullité de la clause') + ".</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 26 mai 2011, n° 10-13.847 " + termes('obligation de résultat du vendeur professionnel') + ".</p>";
            
            content += "<h4>D. Obligation d'information renforcée</h4>";
            content += "<p>Le vendeur professionnel automobile est tenu d'une obligation d'information et de conseil renforcée " + termes('obligation d\'information renforcée', 'obligation de conseil') + ". Il doit révéler à l'acquéreur tout défaut connu ou décelable du véhicule " + termes('défaut connu', 'défaut décelable', 'devoir de révélation') + ".</p>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 3 mars 2011, n° 10-10.315 " + termes('obligation d\'information du vendeur automobile') + ".</p>";
        }
        
        if (hasWarranty) {
            content += "<h4>E. Garantie commerciale contractuelle</h4>";
            content += "<p>Si une garantie commerciale a été souscrite, ses conditions spécifiques (durée, étendue, exclusions) doivent être examinées dans le contrat " + termes('garantie commerciale', 'garantie contractuelle', 'conditions générales de vente') + ". Cette garantie s'ajoute aux garanties légales sans s'y substituer " + termes('cumul des garanties', 'non-substitution') + ".</p>";
        }
        
        content += "<div class='verification-needed'>";
        content += "<strong>À vérifier :</strong> Le régime applicable dépend de la qualification exacte du vendeur et des circonstances de la vente " + termes('qualification du vendeur', 'circonstances de la vente') + ". Il convient de consulter un professionnel du droit pour déterminer le régime le plus favorable " + termes('conseil juridique', 'avocat spécialisé') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION VI - ANALYSE DOCUMENTAIRE
    // ============================================================
    
    function generateDocumentaireAnalysis(hasInvoice, hasRepair, hasControlTech) {
        let content = "<p><strong>Objet :</strong> Analyse des documents mentionnés et identification des documents manquants potentiellement utiles.</p>";
        
        content += "<h4>A. Documents mentionnés dans les éléments fournis</h4><ul>";
        
        if (hasInvoice) {
            content += "<li><strong>Facture de vente :</strong> mentionnée " + termes('facture', 'document contractuel', 'preuve de la vente') + ". Ce document est essentiel car il fixe les obligations du vendeur et décrit le bien vendu " + termes('obligations contractuelles', 'description du bien') + ". Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La description exacte du véhicule " + termes('identification du bien') + " ;</li>";
            content += "<li>Les éventuelles clauses d'exonération (susceptibles d'être réputées non écrites si abusives) " + termes('clause d\'exonération', 'clause abusive', 'réputée non écrite') + " ;</li>";
            content += "<li>L'absence de mention de défauts " + termes('silence sur les défauts', 'réticence') + " ;</li>";
            content += "<li>La date de vente (pour le calcul des délais de garantie) " + termes('date de vente', 'point de départ des délais', 'dies a quo') + ".</li>";
            content += "</ul>";
        }
        
        if (hasRepair) {
            content += "<li><strong>Ordre de réparation :</strong> mentionné " + termes('ordre de réparation', 'document technique', 'historique des interventions') + ". Ce document permet de retracer l'historique des interventions " + termes('traçabilité', 'chronologie') + ". Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La chronologie des défaillances " + termes('chronologie des faits') + " ;</li>";
            content += "<li>La nature des réparations effectuées " + termes('nature des réparations') + " ;</li>";
            content += "<li>Le coût des interventions " + termes('coût des réparations', 'préjudice économique') + " ;</li>";
            content += "<li>La récurrence éventuelle des mêmes dysfonctionnements " + termes('récurrence', 'défaut persistant') + ".</li>";
            content += "</ul>";
        }
        
        if (hasControlTech) {
            content += "<li><strong>Contrôle technique :</strong> mentionné " + termes('contrôle technique', 'document officiel', 'rapport de contrôle') + ". Ce document officiel permet d'identifier les défauts constatés. Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La date du contrôle " + termes('date du contrôle') + " ;</li>";
            content += "<li>Les défauts mentionnés et leur gravité " + termes('défauts constatés', 'gravité') + " ;</li>";
            content += "<li>L'absence de mention de certains défauts (pouvant caractériser une insuffisance du diagnostic) " + termes('insuffisance du diagnostic', 'défaut de contrôle') + ".</li>";
            content += "</ul>";
        }
        
        if (!hasInvoice && !hasRepair && !hasControlTech) {
            content += "<li>Aucun document spécifique n'est mentionné dans les éléments fournis " + termes('défaut de preuve documentaire') + ".</li>";
        }
        
        content += "</ul>";
        
        content += "<h4>B. Documents potentiellement utiles non mentionnés</h4>";
        content += "<p>Selon la situation, les documents suivants peuvent s'avérer utiles " + termes('preuve documentaire', 'faisceau d\'indices') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Bon de commande</strong> " + termes('bon de commande', 'engagement contractuel') + " ;</li>";
        content += "<li><strong>État descriptif du véhicule à l'entrée en atelier</strong> " + termes('état des lieux', 'état initial') + " ;</li>";
        content += "<li><strong>État descriptif à la sortie</strong> " + termes('état de sortie', 'conformité des réparations') + " ;</li>";
        content += "<li><strong>Historique complet d'entretien</strong> " + termes('historique d\'entretien', 'carnet d\'entretien') + " ;</li>";
        content += "<li><strong>Diagnostic technique préalable à la vente</strong> " + termes('diagnostic technique', 'expertise préalable') + " ;</li>";
        content += "<li><strong>Fiche d'entretien du véhicule</strong> " + termes('fiche d\'entretien', 'suivi d\'entretien') + " ;</li>";
        content += "<li><strong>Certificat de réalisation des campagnes de rappel</strong> " + termes('certificat de rappel', 'réalisation des rappels') + " ;</li>";
        content += "<li><strong>Correspondances avec le vendeur</strong> " + termes('correspondances', 'preuve écrite', 'reconnaissance de dette implicite') + " ;</li>";
        content += "<li><strong>Devis de réparation</strong> " + termes('devis', 'évaluation du préjudice') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C. Conséquences probatoires</h4>";
        content += "<p>L'absence de certains documents peut " + termes('conséquences probatoires') + " :</p>";
        content += "<ul>";
        content += "<li>Caractériser un manquement du professionnel à ses obligations de traçabilité " + termes('manquement à l\'obligation de traçabilité') + " ;</li>";
        content += "<li>Constituer des présomptions de faute " + termes('présomption de faute', 'faisceau d\'indices') + " ;</li>";
        content += "<li>Rendre plus difficile l'établissement de certains faits " + termes('difficulté probatoire', 'charge de la preuve') + ".</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>Recommandation :</strong> Il convient de réunir l'ensemble des documents disponibles et de rechercher les documents manquants auprès du vendeur ou des organismes compétents " + termes('constitution du dossier', 'réunion des preuves') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION VII - RAPPELS
    // ============================================================
    
    function generateRappelsAnalysis(rappelsData, vehicleData) {
        let content = "<p><strong>Objet :</strong> Identification des campagnes de rappel constructeur et problèmes récurrents documentés, potentiellement applicables au véhicule concerné.</p>";
        
        content += "<p>L'analyse croisée des informations fournies avec la base de données des campagnes de rappel documentées permet d'identifier des éléments potentiellement pertinents " + termes('analyse croisée', 'corrélation') + ". Ces informations sont présentées à titre indicatif et doivent être vérifiées " + termes('vérification nécessaire', 'caractère indicatif') + ".</p>";
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>A. Campagnes de rappel constructeur identifiées</h4>";
            content += "<p>Les campagnes de rappel suivantes ont été identifiées pour un véhicule <strong>" + 
                (vehicleData.marque || 'non précisé') + " " + 
                (vehicleData.modele || '') + " (" + 
                (vehicleData.annee || 'année non précisée') + ")</strong> " + termes('identification du véhicule', 'correspondance modèle/année') + " :</p>";
            
            rappelsData.rappelsTrouves.forEach((rappel) => {
                const classeCSS = rappel.severite === 'critique' ? 'rappel-critical' : 
                                  rappel.severite === 'moyenne' ? 'rappel-info' : 'rappel-alert';
                const icone = rappel.severite === 'critique' ? '' : '🟡';
                
                content += "<div class='" + classeCSS + "'>";
                content += "<h4>" + icone + " " + rappel.probleme + " (" + rappel.annees + ")</h4>";
                content += "<p><strong>Modèles concernés :</strong> " + rappel.modele + " " + termes('périmètre du rappel') + "</p>";
                content += "<p><strong>Description technique documentée :</strong> " + rappel.description + " " + termes('défaut technique documenté') + "</p>";
                content += "<p><strong>Référence :</strong> " + rappel.reference + " " + termes('référence du rappel', 'source officielle') + "</p>";
                content += "<p><strong>Constructeur :</strong> " + rappel.constructeur + " " + termes('responsabilité du constructeur') + "</p>";
                content += "</div>";
            });
        }
        
        if (rappelsData.problemesTransversaux.length > 0) {
            content += "<h4>B. Problèmes transversaux documentés</h4>";
            content += "<p>Les problèmes suivants concernent de nombreux constructeurs et font l'objet d'actions collectives documentées " + termes('problème transversal', 'défaut systémique', 'action collective') + " :</p>";
            
            rappelsData.problemesTransversaux.forEach(probleme => {
                const classeCSS = probleme.severite === 'critique' ? 'rappel-critical' : 'rappel-alert';
                
                content += "<div class='" + classeCSS + "'>";
                content += "<h4>⚠️ " + probleme.nom + " (" + probleme.annees + ")</h4>";
                content += "<p><strong>Description :</strong> " + probleme.description + " " + termes('défaut de fabrication', 'défaut de conception') + "</p>";
                content += "<p><strong>Marques concernées :</strong> " + probleme.marques.join(', ') + " " + termes('périmètre du problème') + "</p>";
                content += "<p><strong>Référence :</strong> " + probleme.reference + " " + termes('référence juridique') + "</p>";
                content += "</div>";
            });
        }
        
        content += "<h4>C. Interprétation juridique potentielle</h4>";
        content += "<p><strong>Sous réserve de vérification</strong>, l'existence de campagnes de rappel et de problèmes récurrents documentés peut, le cas échéant " + termes('interprétation juridique', 'qualification potentielle') + " :</p>";
        content += "<ul>";
        content += "<li>Établir que le constructeur avait connaissance du défaut " + termes('connaissance du défaut', 'scienter', 'faute intentionnelle') + ", ce qui peut caractériser la faute du vendeur professionnel qui n'a pas informé l'acquéreur " + termes('faute du vendeur', 'manquement à l\'obligation d\'information') + " ;</li>";
        content += "<li>Renforcer la démonstration du caractère caché du défaut " + termes('renforcement du caractère caché', 'inapparence') + ", les défauts faisant l'objet de rappels étant par nature difficiles à détecter " + termes('défaut non décelable') + " ;</li>";
        content += "<li>Caractériser la gravité du défaut pour les rappels de sécurité " + termes('gravité', 'sécurité', 'défaut de sécurité') + " ;</li>";
        content += "<li>Caractériser un défaut de conception engageant la responsabilité du constructeur " + termes('défaut de conception', 'responsabilité du fait des produits défectueux', 'article 1245 et suivants du Code civil') + " ;</li>";
        content += "<li>Caractériser un manquement du vendeur à son obligation d'information s'il n'a pas vérifié les rappels en cours " + termes('manquement à l\'obligation de vérification', 'obligation de diligence') + ".</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>⚠️ Important :</strong> La simple existence d'une campagne de rappel ne caractérise pas automatiquement la responsabilité du vendeur dans le cas spécifique " + termes('non-automaticité de la responsabilité', 'nécessité de vérification au cas par cas') + ". Il convient de vérifier :";
        content += "<ul>";
        content += "<li>Si le véhicule concerné est effectivement visé par le rappel (vérification par VIN) " + termes('vérification par VIN', 'correspondance véhicule/rappel') + " ;</li>";
        content += "<li>Si le rappel a été réalisé ou non " + termes('réalisation du rappel', 'exécution de l\'obligation') + " ;</li>";
        content += "<li>Si le vendeur avait connaissance du rappel " + termes('connaissance du vendeur', 'scienter') + " ;</li>";
        content += "<li>Si le défaut constaté correspond bien au défaut objet du rappel " + termes('correspondance des défauts', 'lien de causalité') + ".</li>";
        content += "</ul>";
        content += "</div>";
        
        if (rappelsData.recommandations.length > 0) {
            content += "<h4>D. Recommandations de vérification</h4><ul>";
            rappelsData.recommandations.forEach(rec => {
                content += "<li>" + rec + "</li>";
            });
            content += "</ul>";
        }
        
        return content;
    }

    // ============================================================
    // SECTION VIII - JURISPRUDENCE
    // ============================================================
    
    function generateJurisprudenceAnalysis() {
        let content = "<p><strong>Objet :</strong> Présentation de la jurisprudence de référence potentiellement applicable " + termes('jurisprudence de référence', 'précédents judiciaires') + ".</p>";
        
        content += "<p>Les arrêts ci-dessous sont présentés à titre de référence. Leur applicabilité au cas spécifique dépend des circonstances exactes de l'affaire et doit être appréciée par un professionnel du droit " + termes('applicabilité au cas d\'espèce', 'autorité relative de la chose jugée') + ".</p>";
        
        content += "<h4>A. Garantie légale de conformité</h4>";
        content += "<p><strong>Cass. civ. 1ère, 17 mai 2011, n° 10-14.479</strong> " + termes('arrêt de principe', 'Cour de cassation') + "</p>";
        content += "<p><strong>Principe :</strong> La garantie légale de conformité est d'ordre public et ne peut être écartée par stipulation contractuelle " + termes('ordre public de protection', 'caractère impératif', 'nullité de la clause contraire') + ". Le vendeur professionnel est tenu de délivrer un bien conforme " + termes('obligation de conformité') + ".</p>";
        
        content += "<h4>B. Obligation d'information du vendeur professionnel</h4>";
        content += "<p><strong>Cass. civ. 1ère, 3 mars 2011, n° 10-10.315</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel automobile est tenu d'une obligation d'information renforcée et doit révéler à l'acquéreur tout défaut connu ou décelable du véhicule " + termes('obligation d\'information renforcée', 'devoir de révélation', 'réticence dolosive') + ".</p>";
        
        content += "<h4>C. Obligation de résultat du vendeur</h4>";
        content += "<p><strong>Cass. civ. 1ère, 26 mai 2011, n° 10-13.847</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel est tenu d'une obligation de résultat en ce qui concerne la conformité du bien vendu " + termes('obligation de résultat', 'responsabilité de plein droit') + ".</p>";
        
        content += "<h4>D. Caractère caché du défaut</h4>";
        content += "<p><strong>Cass. civ. 1ère, 3 mai 2006, n° 03-18.852</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> Le caractère caché s'apprécie au regard des compétences de l'acquéreur " + termes('appréciation in concreto', 'compétences de l\'acquéreur') + ". Un défaut est caché lorsqu'il ne peut être découvert que par un expert ou à l'occasion d'une utilisation prolongée " + termes('inapparence', 'défaut non décelable') + ".</p>";
        
        content += "<h4>E. Gravité du défaut</h4>";
        content += "<p><strong>Cass. civ. 1ère, 17 janvier 2006, n° 03-15.694</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> La gravité s'apprécie in concreto, au regard de l'usage attendu par l'acquéreur " + termes('appréciation in concreto de la gravité', 'usage attendu') + ".</p>";
        
        content += "<h4>F. Résolution de la vente</h4>";
        content += "<p><strong>Cass. civ. 1ère, 14 décembre 2010, n° 09-69.614</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> La résolution de la vente est admise lorsque le défaut de conformité est suffisamment grave pour que l'acquéreur n'aurait pas acquis le bien ou aurait payé un moindre prix " + termes('résolution de la vente', 'réduction du prix', 'alternative de l\'acquéreur') + ".</p>";
        
        content += "<h4>G. Campagnes de rappel</h4>";
        content += "<p><strong>Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485</strong> " + termes('arrêt de principe') + "</p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel a l'obligation de vérifier si le véhicule a fait l'objet de campagnes de rappel et d'en informer l'acquéreur " + termes('obligation de vérification des rappels', 'obligation d\'information sur les rappels') + ".</p>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>⚠️ Important :</strong> La jurisprudence évolue constamment " + termes('évolution jurisprudentielle', 'actualité du droit') + ". Les arrêts cités sont présentés à titre de référence. Il convient de vérifier leur actualité et leur applicabilité au cas spécifique avec un professionnel du droit " + termes('vérification de l\'actualité jurisprudentielle', 'conseil juridique') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION IX - ÉLÉMENTS À VÉRIFIER
    // ============================================================
    
    function generateVerificationNeeded(text, context, rappelsData) {
        let content = "<p><strong>Objet :</strong> Recensement des éléments nécessitant une vérification complémentaire pour étayer l'analyse " + termes('vérification complémentaire', 'complétude de l\'analyse') + ".</p>";
        
        content += "<p>L'analyse présentée repose sur les éléments fournis par l'utilisateur. Les points suivants nécessitent une vérification complémentaire pour établir les faits de manière certaine " + termes('établissement des faits', 'preuve certaine') + " :</p>";
        
        content += "<h4>A. Vérifications techniques</h4><ul>";
        content += "<li><strong>Expertise technique contradictoire :</strong> faire réaliser une expertise par un expert agréé pour établir la nature, la cause et la date d'apparition des défauts " + termes('expertise contradictoire', 'principe du contradictoire', 'rapport d\'expertise') + " ;</li>";
        content += "<li><strong>Vérification des rappels constructeur :</strong> consulter le site de la Sécurité Routière avec le numéro VIN " + termes('vérification VIN', 'base de données officielle') + " ;</li>";
        content += "<li><strong>Contrôle technique complémentaire :</strong> faire réaliser un contrôle technique pour établir l'état actuel du véhicule " + termes('contrôle technique', 'état actuel') + " ;</li>";
        content += "<li><strong>Diagnostic électronique :</strong> faire réaliser un diagnostic complet par un professionnel agréé " + termes('diagnostic électronique', 'valise de diagnostic') + ".</li>";
        content += "</ul>";
        
        content += "<h4>B. Vérifications documentaires</h4><ul>";
        content += "<li><strong>Examen des documents contractuels :</strong> vérifier les clauses de la facture, du bon de commande, des conditions générales de vente " + termes('examen des clauses', 'conditions générales de vente', 'CGV') + " ;</li>";
        content += "<li><strong>Historique du véhicule :</strong> obtenir l'historique complet auprès du constructeur ou d'un concessionnaire agréé " + termes('historique véhicule', 'fichier constructeur') + " ;</li>";
        content += "<li><strong>Vérification des garanties :</strong> vérifier les garanties légales et commerciales applicables " + termes('garanties applicables', 'cumul des garanties') + " ;</li>";
        content += "<li><strong>Recherche de jurisprudence actualisée :</strong> vérifier l'existence de décisions récentes sur des faits similaires " + termes('recherche jurisprudentielle', 'actualité jurisprudentielle') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C. Vérifications juridiques</h4><ul>";
        content += "<li><strong>Qualification exacte du vendeur :</strong> vérifier s'il s'agit d'un professionnel ou d'un particulier " + termes('qualification du vendeur', 'qualité des parties') + " ;</li>";
        content += "<li><strong>Date de vente :</strong> vérifier la date exacte pour le calcul des délais de garantie " + termes('date de vente', 'dies a quo', 'point de départ des délais') + " ;</li>";
        content += "<li><strong>Délais de prescription :</strong> vérifier que les actions envisagées ne sont pas prescrites " + termes('délai de prescription', 'forclusion', 'prescription extinctive') + " ;</li>";
        content += "<li><strong>Compétence juridictionnelle :</strong> déterminer le tribunal compétent " + termes('compétence juridictionnelle', 'tribunal judiciaire', 'règle de compétence') + ".</li>";
        content += "</ul>";
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>D. Vérifications spécifiques aux rappels identifiés</h4><ul>";
            content += "<li>Vérifier par VIN si le véhicule est effectivement concerné par les rappels identifiés " + termes('vérification VIN', 'correspondance véhicule/rappel') + " ;</li>";
            content += "<li>Vérifier si les opérations de rappel ont été réalisées " + termes('réalisation du rappel', 'exécution de l\'obligation') + " ;</li>";
            content += "<li>Demander au vendeur la preuve de réalisation des rappels " + termes('preuve de réalisation', 'charge de la preuve') + " ;</li>";
            content += "<li>Vérifier si le défaut constaté correspond au défaut objet du rappel " + termes('correspondance des défauts', 'lien de causalité') + ".</li>";
            content += "</ul>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>⚠️ Limite de l'analyse :</strong> La présente analyse ne se substitue pas à une expertise technique contradictoire ni à l'avis d'un professionnel du droit " + termes('limite de l\'analyse', 'non-substitution au conseil juridique') + ". Les conclusions présentées sont formulées de manière prudente et doivent être vérifiées " + termes('prudence', 'vérification nécessaire') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION X - VOIES D'ACTION
    // ============================================================
    
    function generateVoiesAction(hasProfessional, rappelsData) {
        let content = "<p><strong>Objet :</strong> Présentation des voies d'action potentiellement envisageables, selon la qualification de la situation " + termes('voies d\'action', 'options procédurales') + ".</p>";
        
        content += "<p>Les voies d'action ci-dessous sont présentées à titre informatif. Leur opportunité et leur faisabilité dépendent des circonstances spécifiques de l'affaire et doivent être appréciées avec un professionnel du droit " + termes('opportunité de l\'action', 'faisabilité', 'conseil juridique') + ".</p>";
        
        content += "<h4>A. Actions envisageables contre le vendeur</h4><ul>";
        content += "<li><strong>Action en garantie légale de conformité</strong> (si vendeur professionnel) : réparation, remplacement, réduction du prix ou résolution de la vente " + termes('action en garantie légale de conformité', 'article L.217-4 du Code de la consommation', 'options de l\'acquéreur') + " ;</li>";
        content += "<li><strong>Action en résolution de la vente</strong> : remboursement intégral du prix avec restitution du véhicule " + termes('action en résolution', 'restitution', 'remboursement intégral') + " ;</li>";
        content += "<li><strong>Action en réduction du prix</strong> : remboursement partiel proportionnel à la dépréciation " + termes('action en réduction du prix', 'réduction proportionnelle', 'dépréciation') + " ;</li>";
        content += "<li><strong>Action en dommages et intérêts</strong> : réparation du préjudice subi (frais de réparation, perte de valeur, préjudice moral) " + termes('action en dommages et intérêts', 'réparation du préjudice', 'préjudice économique', 'préjudice moral') + " ;</li>";
        content += "<li><strong>Action en nullité pour dol</strong> : en cas de dissimulation intentionnelle du défaut " + termes('action en nullité pour dol', 'réticence dolosive', 'manœuvres dolosives', 'article 1137 du Code civil') + " ;</li>";
        content += "<li><strong>Action en garantie des vices cachés</strong> (Code civil, articles 1641 et suivants) : résolution de la vente ou réduction du prix " + termes('action en garantie des vices cachés', 'article 1641 du Code civil', 'action rédhibitoire', 'action estimatoire') + ".</li>";
        content += "</ul>";
        
        if (hasProfessional) {
            content += "<h4>B. Actions spécifiques contre un vendeur professionnel</h4><ul>";
            content += "<li><strong>Signalement à la DGCCRF</strong> : en cas de pratiques commerciales trompeuses " + termes('signalement DGCCRF', 'pratique commerciale trompeuse', 'article L.121-2 du Code de la consommation') + " ;</li>";
            content += "<li><strong>Action en réparation pour manquement à l'obligation d'information</strong> " + termes('manquement à l\'obligation d\'information', 'responsabilité précontractuelle') + " ;</li>";
            content += "<li><strong>Action pour clause abusive</strong> : en cas de clauses d'exonération illégales " + termes('clause abusive', 'déséquilibre significatif', 'article L.212-1 du Code de la consommation') + ".</li>";
            content += "</ul>";
        }
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>C. Actions spécifiques liées aux rappels identifiés</h4><ul>";
            content += "<li><strong>Action contre le constructeur</strong> : en cas de défaut de conception, action pour responsabilité du fait des produits défectueux " + termes('responsabilité du fait des produits défectueux', 'article 1245 et suivants du Code civil', 'responsabilité du fabricant') + " ;</li>";
            content += "<li><strong>Rejoindre une action collective</strong> : si une action collective est en cours pour le défaut identifié " + termes('action collective', 'action de groupe', 'article L.623-1 du Code de la consommation') + " ;</li>";
            content += "<li><strong>Signalement à l'ANSM</strong> : en cas de problème de sécurité " + termes('signalement ANSM', 'autorité de sécurité', 'sécurité des produits') + ".</li>";
            content += "</ul>";
        }
        
        content += "<h4>D. Démarches préalables recommandées</h4><ul>";
        content += "<li><strong>Mise en demeure formelle</strong> : adresser une lettre recommandée avec accusé de réception au vendeur, précisant les griefs et les demandes " + termes('mise en demeure', 'lettre recommandée avec AR', 'interpellation formelle') + " ;</li>";
        content += "<li><strong>Tentative de conciliation</strong> : saisir un conciliateur de justice (gratuit) " + termes('conciliation', 'conciliateur de justice', 'mode alternatif de résolution des différends', 'MARD') + " ;</li>";
        content += "<li><strong>Médiation</strong> : saisir un médiateur de la consommation " + termes('médiation', 'médiateur de la consommation', 'article L.612-1 du Code de la consommation') + " ;</li>";
        content += "<li><strong>Expertise amiable</strong> : faire réaliser une expertise contradictoire avant toute action contentieuse " + termes('expertise amiable', 'expertise contradictoire amiable') + ".</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>️ Important :</strong> Avant d'engager toute action, il convient de " + termes('préalables à l\'action') + " :";
        content += "<ul>";
        content += "<li>Vérifier les délais de prescription applicables " + termes('délais de prescription', 'forclusion') + " ;</li>";
        content += "<li>Évaluer le rapport coût/bénéfice de l'action envisagée " + termes('analyse coût/bénéfice', 'intérêt à agir') + " ;</li>";
        content += "<li>Consulter un professionnel du droit pour apprécier l'opportunité de l'action " + termes('conseil juridique', 'avocat', 'intérêt à agir') + " ;</li>";
        content += "<li>Réunir l'ensemble des preuves disponibles " + termes('constitution du dossier', 'réunion des preuves', 'faisceau d\'indices') + ".</li>";
        content += "</ul>";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION XI - CONCLUSION
    // ============================================================
    
    function generateConclusion(objective, rappelsData) {
        let content = "<p><strong>Objet :</strong> Synthèse de l'analyse et recommandations " + termes('synthèse', 'recommandations') + ".</p>";
        
        content += "<h4>A. Synthèse</h4>";
        content += "<p>La présente analyse a été réalisée sur la base des éléments fournis par l'utilisateur. Elle met en évidence " + termes('analyse factuelle', 'éléments fournis') + " :</p>";
        content += "<ul>";
        content += "<li>Les éléments factuels décrits, qui n'ont pas été vérifiés " + termes('faits non vérifiés', 'défaut de preuve') + " ;</li>";
        content += "<li>Les qualifications juridiques potentiellement applicables, sous réserve de vérification " + termes('qualification juridique potentielle', 'sous réserve de vérification') + " ;</li>";
        content += "<li>Les régimes de garantie potentiellement invocables " + termes('régimes de garantie', 'invocabilité') + " ;</li>";
        content += "<li>Les campagnes de rappel et problèmes récurrents documentés, le cas échéant " + termes('rappels documentés', 'problèmes récurrents') + " ;</li>";
        content += "<li>Les éléments nécessitant une vérification complémentaire " + termes('vérification complémentaire', 'complétude') + ".</li>";
        content += "</ul>";
        
        content += "<h4>B. Limites de l'analyse</h4>";
        content += "<p>Il importe de souligner les limites de la présente analyse " + termes('limites de l\'analyse', 'caractère indicatif') + " :</p>";
        content += "<ul>";
        content += "<li>Les éléments factuels n'ont pas été vérifiés par une expertise contradictoire " + termes('défaut d\'expertise contradictoire') + " ;</li>";
        content += "<li>La qualification juridique définitive dépend de circonstances non entièrement établies " + termes('circonstances non établies', 'qualification provisoire') + " ;</li>";
        content += "<li>La jurisprudence évolue constamment et doit être actualisée " + termes('évolution jurisprudentielle', 'actualité du droit') + " ;</li>";
        content += "<li>Les délais de prescription doivent être vérifiés au cas par cas " + termes('délais de prescription', 'vérification au cas par cas') + " ;</li>";
        content += "<li>L'analyse ne se substitue pas à l'avis d'un professionnel du droit " + termes('non-substitution au conseil juridique') + ".</li>";
        content += "</ul>";
        
        content += "<h4>C. Recommandations</h4>";
        content += "<p>Selon les éléments fournis et l'objectif recherché" + (objective ? " (" + objective + ")" : "") + ", il est recommandé de " + termes('recommandations stratégiques') + " :</p>";
        content += "<ul>";
        content += "<li><strong>Constituer un dossier complet</strong> réunissant tous les documents disponibles " + termes('constitution du dossier', 'réunion des preuves') + " ;</li>";
        content += "<li><strong>Faire réaliser une expertise technique contradictoire</strong> par un expert agréé " + termes('expertise technique contradictoire', 'expert agréé') + " ;</li>";
        content += "<li><strong>Vérifier les campagnes de rappel</strong> sur le site de la Sécurité Routière avec le numéro VIN " + termes('vérification des rappels', 'VIN') + " ;</li>";
        content += "<li><strong>Adresser une mise en demeure formelle</strong> au vendeur par lettre recommandée avec accusé de réception " + termes('mise en demeure', 'lettre recommandée avec AR') + " ;</li>";
        content += "<li><strong>Envisager une conciliation ou médiation</strong> avant toute action contentieuse " + termes('conciliation', 'médiation', 'MARD') + " ;</li>";
        content += "<li><strong>Conserver précieusement toutes les pièces originales</strong> " + termes('conservation des pièces', 'intégrité des preuves') + " ;</li>";
        content += "<li><strong>Consulter un avocat spécialisé</strong> en droit de la consommation ou droit automobile " + termes('avocat spécialisé', 'droit de la consommation', 'droit automobile') + " ;</li>";
        content += "<li><strong>Vérifier les délais de prescription</strong> avant d'engager toute action " + termes('délais de prescription', 'forclusion') + ".</li>";
        content += "</ul>";
        
        if (rappelsData.rappelsTrouves.length > 0 || rappelsData.problemesTransversaux.length > 0) {
            content += "<h4>D. Recommandations spécifiques liées aux rappels</h4><ul>";
            content += "<li>Vérifier par VIN si le véhicule est concerné par les rappels identifiés " + termes('vérification VIN') + " ;</li>";
            content += "<li>Demander au vendeur la preuve de réalisation des rappels " + termes('preuve de réalisation') + " ;</li>";
            content += "<li>Se renseigner sur l'existence d'actions collectives en cours " + termes('action collective', 'action de groupe') + " ;</li>";
            content += "<li>Envisager de rejoindre une action collective si elle existe " + termes('rejoindre une action collective') + ".</li>";
            content += "</ul>";
        }
        
        content += "<h4>E. Conclusion</h4>";
        content += "<p>La présente analyse constitue une aide à la rédaction et à la réflexion " + termes('aide à la rédaction', 'outil de réflexion') + ". Elle ne constitue pas un conseil juridique et ne se substitue pas à l'avis d'un professionnel du droit " + termes('non-conseil juridique', 'non-substitution') + ". Les conclusions présentées sont formulées de manière prudente et doivent être vérifiées au regard des circonstances spécifiques de l'affaire " + termes('prudence', 'vérification au cas par cas', 'circonstances spécifiques') + ".</p>";
        content += "<p>Il est recommandé d'engager rapidement les démarches préconisées, dans le respect des délais de prescription, afin de préserver les droits de l'intéressé " + termes('délais de prescription', 'préservation des droits', 'intérêt à agir') + ".</p>";
        
        content += "<div class='certainty-low'>";
        content += "<strong>⚠️ Avertissement final :</strong> Cette analyse est générée automatiquement à partir des éléments fournis par l'utilisateur. Elle ne constitue pas un avis juridique et ne garantit pas le succès d'une action en justice " + termes('caractère automatique', 'non-garantie de succès') + ". Seul un professionnel du droit, après examen approfondi du dossier, peut fournir un conseil juridique adapté à la situation spécifique " + termes('conseil juridique adapté', 'examen approfondi', 'professionnel du droit') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION XII - LEXIQUE JURIDIQUE
    // ============================================================
    
    function generateLexique() {
        const lexique = {
            'vente': 'Contrat par lequel un vendeur transfère la propriété d\'un bien à un acquéreur moyennant un prix (article 1582 du Code civil).',
            'bien meuble corporel': 'Bien matériel pouvant être déplacé, par opposition aux immeubles.',
            'contrat de vente': 'Accord de volontés entre un vendeur et un acquéreur portant sur un bien et un prix.',
            'droit commun des obligations': 'Règles générales régissant les obligations contractuelles et extra-contractuelles.',
            'droit de la consommation': 'Branche du droit protégeant le consommateur non-professionnel face aux professionnels.',
            'ordre public de protection': 'Règles impératives protégeant une partie faible, auxquelles on ne peut déroger.',
            'vendeur professionnel': 'Personne morale ou physique agissant dans le cadre de son activité commerciale.',
            'relation B2C': 'Relation commerciale entre un professionnel (Business) et un consommateur (Consumer).',
            'qualité de professionnel': 'Caractéristique d\'une personne agissant dans le cadre de son activité professionnelle.',
            'renversement de la charge de la preuve': 'Mécanisme par lequel c\'est au défendeur (professionnel) de prouver qu\'il n\'a pas fauté.',
            'présomption de connaissance': 'Présomption selon laquelle le professionnel connaît les défauts de ses produits.',
            'clause abusive': 'Clause créant un déséquilibre significatif entre les droits et obligations des parties (article L.212-1 du Code de la consommation).',
            'déséquilibre significatif': 'Déséquilibre important entre les droits et obligations des parties au contrat.',
            'obligation d\'information renforcée': 'Obligation particulière du professionnel de révéler toutes les informations essentielles.',
            'obligation précontractuelle': 'Obligation pesant sur les parties avant la conclusion du contrat.',
            'vente entre particuliers': 'Vente conclue entre deux personnes non-professionnelles.',
            'relation C2C': 'Relation entre deux consommateurs (Consumer to Consumer).',
            'garantie des vices cachés': 'Garantie légale protégeant l\'acquéreur contre les défauts cachés rendant le bien impropre à son usage (articles 1641 et suivants du Code civil).',
            'article 1641 du Code civil': 'Article définissant le vice caché : défaut rendant le bien impropre à l\'usage ou diminuant tellement cet usage.',
            'qualification juridique': 'Opération consistant à rattacher des faits à une catégorie juridique.',
            'nature du contrat': 'Caractérisation juridique du type de contrat conclu.',
            'qualification des parties': 'Détermination de la qualité juridique des parties (professionnel, consommateur, etc.).',
            'qualité du vendeur': 'Caractéristique juridique du vendeur (professionnel ou particulier).',
            'régime juridique applicable': 'Ensemble des règles de droit applicables à une situation donnée.',
            'qualification des désordres': 'Caractérisation juridique des problèmes constatés.',
            'défaut de conformité': 'Non-conformité du bien par rapport à ce qui était attendu ou convenu.',
            'non-conformité': 'État d\'un bien ne correspondant pas aux attentes légitimes de l\'acquéreur.',
            'obligation de délivrance': 'Obligation du vendeur de remettre le bien à l\'acquéreur.',
            'délivrance conforme': 'Délivrance d\'un bien exempt de défauts au moment de la remise.',
            'manquement à l\'obligation d\'information': 'Défaut de révélation d\'informations essentielles par une partie.',
            'réticence dolosive': 'Dissimulation intentionnelle d\'une information déterminante par l\'une des parties.',
            'preuve': 'Élément permettant d\'établir la réalité d\'un fait.',
            'expertise contradictoire': 'Expertise réalisée en présence des deux parties.',
            'critères cumulatifs': 'Conditions qui doivent toutes être réunies simultanément.',
            'réunion cumulative': 'Nécessité que toutes les conditions soient satisfaites ensemble.',
            'antériorité du défaut': 'Existence du défaut avant la conclusion de la vente.',
            'fait générateur antérieur': 'Événement à l\'origine du dommage survenu avant le contrat.',
            'date d\'apparition du défaut': 'Moment où le défaut a commencé à exister.',
            'lien de causalité': 'Relation de cause à effet entre le fait générateur et le dommage.',
            'expertise technique': 'Examen technique réalisé par un expert pour établir des faits.',
            'rapport d\'expertise': 'Document rédigé par l\'expert contenant ses constatations et conclusions.',
            'preuve documentaire': 'Preuve constituée par des documents écrits.',
            'état des lieux': 'Description de l\'état d\'un bien à un moment donné.',
            'défaut de fabrication': 'Défaut provenant du processus de fabrication du bien.',
            'usure anormale': 'Usure excessive par rapport à l\'usage normal du bien.',
            'cause étrangère': 'Événement extérieur exonérant le débiteur de sa responsabilité (force majeure, fait d\'un tiers, faute de la victime).',
            'historique d\'entretien': 'Traçabilité des opérations d\'entretien réalisées sur un bien.',
            'traçabilité': 'Possibilité de retracer l\'historique complet d\'un bien.',
            'principe du contradictoire': 'Principe selon lequel chaque partie doit pouvoir discuter les prétentions et preuves de l\'autre.',
            'défaut de preuve': 'Absence d\'éléments permettant d\'établir un fait.',
            'caractère caché': 'Caractère non apparent d\'un défaut.',
            'défaut non apparent': 'Défaut qui ne peut être décelé par un examen attentif.',
            'inapparence': 'Caractère de ce qui ne peut être vu ou décelé facilement.',
            'appréciation in concreto': 'Appréciation tenant compte des circonstances spécifiques du cas.',
            'compétences de l\'acquéreur': 'Niveau de connaissance et d\'expertise de l\'acheteur.',
            'documents contractuels': 'Documents formant le contrat ou s\'y rattachant.',
            'transparence contractuelle': 'Obligation de clarté et de sincérité dans les documents contractuels.',
            'examen attentif': 'Examen soigneux et minutieux.',
            'diligence de l\'acquéreur': 'Niveau de soin et d\'attention attendu de l\'acheteur.',
            'contrôle technique': 'Examen technique obligatoire pour les véhicules.',
            'rapport de contrôle': 'Document résultant du contrôle technique.',
            'tests spécifiques': 'Examens techniques particuliers nécessaires pour détecter certains défauts.',
            'expertise spécialisée': 'Expertise nécessitant des compétences techniques pointues.',
            'circonstances de la vente': 'Éléments contextuels entourant la conclusion de la vente.',
            'qualité de l\'acquéreur': 'Caractéristique juridique de l\'acheteur (professionnel, consommateur, etc.).',
            'défaut de preuve sur l\'inapparence': 'Impossibilité d\'établir que le défaut était non apparent.',
            'gravité du défaut': 'Importance du défaut au regard de ses conséquences.',
            'impropriété à l\'usage': 'Incapacité du bien à servir à l\'usage pour lequel il est destiné.',
            'diminution d\'usage': 'Réduction significative de l\'utilité du bien.',
            'appréciation in concreto de la gravité': 'Évaluation de la gravité tenant compte du cas spécifique.',
            'sécurité': 'Absence de danger pour les personnes et les biens.',
            'défaut de sécurité': 'Défaut rendant le bien dangereux.',
            'coût des réparations': 'Montant des dépenses nécessaires pour remettre le bien en état.',
            'valeur vénale': 'Valeur marchande d\'un bien.',
            'proportionnalité': 'Rapport équilibré entre deux éléments (ici coût/valeur).',
            'usage normal': 'Utilisation conforme à la destination du bien.',
            'destination du bien': 'Usage auquel le bien est normalement destiné.',
            'dépréciation': 'Perte de valeur d\'un bien.',
            'moins-value': 'Différence négative entre la valeur réelle et la valeur attendue.',
            'préjudice économique': 'Dommage financier subi.',
            'évaluation du préjudice': 'Estimation du dommage subi.',
            'défaut de preuve sur la gravité': 'Impossibilité d\'établir la gravité du défaut.',
            'caractérisation de la responsabilité': 'Établissement des éléments constitutifs de la responsabilité.',
            'responsabilité du vendeur': 'Obligation pour le vendeur de répondre des défauts du bien vendu.',
            'faute': 'Manquement à une obligation légale ou contractuelle.',
            'régime de garantie applicable': 'Ensemble des règles de garantie applicables à une situation.',
            'garantie légale de conformité': 'Garantie imposant au vendeur de délivrer un bien conforme (article L.217-4 du Code de la consommation).',
            'obligation de conformité': 'Obligation de délivrer un bien correspondant aux attentes légitimes.',
            'article L.217-4 du Code de la consommation': 'Article fondant la garantie légale de conformité.',
            'conformité aux qualités présentées': 'Correspondance du bien aux caractéristiques annoncées.',
            'usage habituellement attendu': 'Utilisation normale que l\'on peut attendre d\'un bien similaire.',
            'attentes légitimes de l\'acquéreur': 'Attentes raisonnables de l\'acheteur.',
            'délai de deux ans': 'Durée de la garantie légale de conformité.',
            'délai de garantie': 'Période pendant laquelle la garantie peut être invoquée.',
            'délai de prescription': 'Délai au-delà duquel une action en justice n\'est plus possible.',
            'présomption d\'antériorité': 'Présomption selon laquelle le défaut existait au moment de la vente s\'il se manifeste dans les 6 mois.',
            'délai de six mois': 'Délai pendant lequel le défaut est présumé exister à la vente.',
            'réparation': 'Remise en état du bien défectueux.',
            'remplacement': 'Échange du bien défectueux contre un bien conforme.',
            'réduction du prix': 'Diminution du prix payé en proportion du défaut.',
            'résolution de la vente': 'Annulation rétroactive du contrat avec restitution.',
            'caractère d\'ordre public de la garantie': 'Impossibilité d\'écarter la garantie par contrat.',
            'garantie légale de délivrance': 'Garantie imposant la délivrance d\'un bien exempt de défauts (article 1604 du Code civil).',
            'délivrance conforme': 'Remise d\'un bien conforme aux attentes.',
            'article 1604 du Code civil': 'Article définissant l\'obligation de délivrance.',
            'charge de la preuve': 'Obligation de prouver les faits que l\'on avance.',
            'onus probandi': 'Expression latine signifiant "charge de la preuve".',
            'obligation de résultat': 'Obligation d\'atteindre un résultat précis.',
            'obligation contractuelle': 'Obligation née du contrat.',
            'responsabilité de plein droit': 'Responsabilité engagée automatiquement sans faute à prouver.',
            'responsabilité contractuelle': 'Responsabilité née de l\'inexécution d\'une obligation contractuelle.',
            'force majeure': 'Événement imprévisible, irrésistible et extérieur.',
            'fait d\'un tiers': 'Comportement d\'une personne étrangère au contrat.',
            'faute de la victime': 'Comportement fautif de la personne subissant le dommage.',
            'clause réputée non écrite': 'Clause considérée comme n\'ayant jamais existé.',
            'nullité de la clause': 'Sanction faisant disparaître la clause.',
            'obligation de résultat du vendeur professionnel': 'Obligation d\'atteindre le résultat de conformité.',
            'obligation de conseil': 'Obligation de conseiller l\'acquéreur sur ses choix.',
            'défaut connu': 'Défaut dont le vendeur avait connaissance.',
            'défaut décelable': 'Défaut que le vendeur aurait pu découvrir.',
            'devoir de révélation': 'Obligation de révéler les informations importantes.',
            'obligation d\'information du vendeur automobile': 'Obligation spécifique du vendeur de véhicules.',
            'garantie commerciale': 'Garantie supplémentaire offerte par le vendeur ou le fabricant.',
            'garantie contractuelle': 'Garantie prévue par le contrat.',
            'conditions générales de vente': 'Conditions standardisées applicables aux ventes.',
            'CGV': 'Abréviation de Conditions Générales de Vente.',
            'cumul des garanties': 'Possibilité d\'invoquer plusieurs garanties simultanément.',
            'non-substitution': 'Principe selon lequel une garantie ne remplace pas l\'autre.',
            'qualification du vendeur': 'Détermination de la qualité juridique du vendeur.',
            'circonstances de la vente': 'Contexte dans lequel la vente a été conclue.',
            'conseil juridique': 'Avis d\'un professionnel du droit.',
            'avocat spécialisé': 'Avocat ayant une expertise dans un domaine particulier.',
            'facture': 'Document comptable et contractuel attestant de la vente.',
            'document contractuel': 'Document formant ou se rattachant au contrat.',
            'preuve de la vente': 'Élément établissant la réalité de la vente.',
            'obligations contractuelles': 'Obligations nées du contrat.',
            'description du bien': 'Caractéristiques du bien telles que décrites.',
            'identification du bien': 'Détermination précise du bien vendu.',
            'clause d\'exonération': 'Clause visant à exclure ou limiter la responsabilité.',
            'réputée non écrite': 'Considérée comme n\'ayant jamais existé.',
            'silence sur les défauts': 'Absence de mention des défauts dans les documents.',
            'réticence': 'Dissimulation d\'une information importante.',
            'date de vente': 'Date à laquelle la vente a été conclue.',
            'point de départ des délais': 'Moment à partir duquel les délais commencent à courir.',
            'dies a quo': 'Expression latine signifiant "le jour à partir duquel".',
            'ordre de réparation': 'Document autorisant et décrivant les réparations.',
            'document technique': 'Document à caractère technique.',
            'historique des interventions': 'Traçabilité des opérations réalisées.',
            'chronologie': 'Ordre temporel des événements.',
            'chronologie des faits': 'Séquence temporelle des événements.',
            'nature des réparations': 'Type de réparations effectuées.',
            'récurrence': 'Répétition d\'un même phénomène.',
            'défaut persistant': 'Défaut qui subsiste malgré les interventions.',
            'document officiel': 'Document émis par une autorité compétente.',
            'date du contrôle': 'Date à laquelle le contrôle a été réalisé.',
            'défauts constatés': 'Défauts relevés lors du contrôle.',
            'gravité': 'Importance d\'un défaut.',
            'insuffisance du diagnostic': 'Diagnostic incomplet ou imprécis.',
            'défaut de contrôle': 'Absence ou insuffisance de contrôle.',
            'défaut de preuve documentaire': 'Absence de documents probants.',
            'faisceau d\'indices': 'Ensemble d\'éléments convergents permettant d\'établir un fait.',
            'bon de commande': 'Document formalisant la commande.',
            'engagement contractuel': 'Obligation née du contrat.',
            'état initial': 'État du bien au moment de la prise en charge.',
            'état de sortie': 'État du bien après intervention.',
            'conformité des réparations': 'Correspondance des réparations aux attentes.',
            'carnet d\'entretien': 'Document retraçant l\'entretien du véhicule.',
            'diagnostic technique': 'Examen technique visant à identifier les défauts.',
            'expertise préalable': 'Expertise réalisée avant une action.',
            'fiche d\'entretien': 'Document de suivi de l\'entretien.',
            'suivi d\'entretien': 'Traçabilité des opérations d\'entretien.',
            'certificat de rappel': 'Document attestant de la réalisation d\'un rappel.',
            'réalisation des rappels': 'Exécution effective des opérations de rappel.',
            'correspondances': 'Échanges écrits entre parties.',
            'preuve écrite': 'Preuve constituée par un écrit.',
            'reconnaissance de dette implicite': 'Reconnaissance indirecte d\'une obligation.',
            'devis': 'Document estimatif du coût des travaux.',
            'conséquences probatoires': 'Effets sur la preuve.',
            'manquement à l\'obligation de traçabilité': 'Défaut de conservation des traces.',
            'présomption de faute': 'Présomption selon laquelle une faute a été commise.',
            'difficulté probatoire': 'Difficulté à apporter la preuve.',
            'constitution du dossier': 'Réunion des éléments du dossier.',
            'réunion des preuves': 'Collecte des éléments de preuve.',
            'analyse croisée': 'Comparaison de plusieurs sources d\'information.',
            'corrélation': 'Lien entre plusieurs éléments.',
            'vérification nécessaire': 'Nécessité de contrôler les informations.',
            'caractère indicatif': 'Caractère non définitif, donné à titre d\'information.',
            'identification du véhicule': 'Détermination précise du véhicule.',
            'correspondance modèle/année': 'Adéquation entre le modèle et l\'année.',
            'périmètre du rappel': 'Étendue du rappel (modèles, années concernés).',
            'défaut technique documenté': 'Défaut technique attesté par des documents.',
            'référence du rappel': 'Numéro ou identification officielle du rappel.',
            'source officielle': 'Source émanant d\'une autorité compétente.',
            'responsabilité du constructeur': 'Responsabilité du fabricant.',
            'problème transversal': 'Problème touchant plusieurs constructeurs.',
            'défaut systémique': 'Défaut affectant un système entier.',
            'action collective': 'Action en justice regroupant plusieurs plaignants.',
            'défaut de conception': 'Défaut provenant de la conception.',
            'périmètre du problème': 'Étendue du problème.',
            'référence juridique': 'Source juridique de référence.',
            'interprétation juridique': 'Analyse juridique des faits.',
            'qualification potentielle': 'Qualification juridique envisageable.',
            'connaissance du défaut': 'Savoir que le défaut existe.',
            'scienter': 'Terme latin signifiant "en connaissance de cause".',
            'faute intentionnelle': 'Faute commise délibérément.',
            'faute du vendeur': 'Manquement du vendeur à ses obligations.',
            'renforcement du caractère caché': 'Éléments confortant l\'inapparence du défaut.',
            'défaut non décelable': 'Défaut impossible à détecter.',
            'responsabilité du fait des produits défectueux': 'Responsabilité du fabricant du fait des défauts de ses produits (articles 1245 et suivants du Code civil).',
            'article 1245 et suivants du Code civil': 'Articles régissant la responsabilité du fait des produits défectueux.',
            'manquement à l\'obligation de vérification': 'Défaut de contrôle préalable.',
            'obligation de diligence': 'Obligation d\'agir avec soin et prudence.',
            'non-automaticité de la responsabilité': 'La responsabilité n\'est pas automatique, elle doit être démontrée.',
            'nécessité de vérification au cas par cas': 'Obligation d\'examiner chaque situation individuellement.',
            'vérification par VIN': 'Contrôle via le numéro d\'identification du véhicule.',
            'correspondance véhicule/rappel': 'Adéquation entre le véhicule et le rappel.',
            'réalisation du rappel': 'Exécution effective du rappel.',
            'exécution de l\'obligation': 'Accomplissement de l\'obligation.',
            'connaissance du vendeur': 'Savoir du vendeur concernant les défauts.',
            'correspondance des défauts': 'Adéquation entre le défaut constaté et le défaut objet du rappel.',
            'jurisprudence de référence': 'Décisions judiciaires servant de référence.',
            'précédents judiciaires': 'Décisions antérieures pouvant servir de référence.',
            'applicabilité au cas d\'espèce': 'Possibilité d\'appliquer une règle à un cas concret.',
            'autorité relative de la chose jugée': 'Principe selon lequel un jugement ne s\'impose qu\'aux parties.',
            'arrêt de principe': 'Arrêt fixant une règle juridique importante.',
            'Cour de cassation': 'Plus haute juridiction de l\'ordre judiciaire français.',
            'caractère impératif': 'Caractère obligatoire, ne pouvant être écarté.',
            'nullité de la clause contraire': 'Sanction frappant une clause contraire à l\'ordre public.',
            'résolution de la vente': 'Annulation rétroactive du contrat.',
            'alternative de l\'acquéreur': 'Choix offert à l\'acquéreur entre plusieurs options.',
            'obligation de vérification des rappels': 'Obligation de contrôler les rappels en cours.',
            'obligation d\'information sur les rappels': 'Obligation d\'informer sur les rappels.',
            'évolution jurisprudentielle': 'Évolution des décisions de justice.',
            'actualité du droit': 'État actuel du droit.',
            'vérification de l\'actualité jurisprudentielle': 'Contrôle de la pertinence actuelle des arrêts.',
            'vérification complémentaire': 'Vérification additionnelle nécessaire.',
            'complétude de l\'analyse': 'Exhaustivité de l\'analyse.',
            'établissement des faits': 'Détermination certaine des faits.',
            'preuve certaine': 'Preuve ne laissant place à aucun doute.',
            'base de données officielle': 'Base de données tenue par une autorité publique.',
            'état actuel': 'État présent du bien.',
            'valise de diagnostic': 'Outil électronique de diagnostic automobile.',
            'examen des clauses': 'Analyse des clauses contractuelles.',
            'fichier constructeur': 'Base de données du constructeur.',
            'garanties applicables': 'Garanties pouvant être invoquées.',
            'recherche jurisprudentielle': 'Recherche de décisions de justice.',
            'actualité jurisprudentielle': 'État actuel de la jurisprudence.',
            'forclusion': 'Perte d\'un droit par l\'écoulement d\'un délai.',
            'prescription extinctive': 'Extinction d\'un droit par l\'écoulement du temps.',
            'compétence juridictionnelle': 'Aptitude d\'une juridiction à connaître d\'une affaire.',
            'tribunal judiciaire': 'Juridiction de droit commun.',
            'règle de compétence': 'Règle déterminant la juridiction compétente.',
            'limite de l\'analyse': 'Borne de la portée de l\'analyse.',
            'non-substitution au conseil juridique': 'L\'analyse ne remplace pas un avis juridique professionnel.',
            'prudence': 'Attitude de réserve et de précaution.',
            'vérification nécessaire': 'Contrôle indispensable.',
            'voies d\'action': 'Options juridiques disponibles.',
            'options procédurales': 'Choix de procédures disponibles.',
            'opportunité de l\'action': 'Caractère pertinent de l\'action.',
            'faisabilité': 'Possibilité de réalisation.',
            'action en garantie légale de conformité': 'Action fondée sur la garantie légale de conformité.',
            'options de l\'acquéreur': 'Choix offerts à l\'acquéreur.',
            'action en résolution': 'Action visant à annuler le contrat.',
            'restitution': 'Remise en l\'état antérieur.',
            'remboursement intégral': 'Remboursement total.',
            'action en réduction du prix': 'Action visant à obtenir une diminution du prix.',
            'réduction proportionnelle': 'Diminution proportionnelle au défaut.',
            'action en dommages et intérêts': 'Action visant à obtenir réparation.',
            'réparation du préjudice': 'Indemnisation du dommage.',
            'préjudice moral': 'Dommage non matériel (souffrance, trouble).',
            'action en nullité pour dol': 'Action visant à annuler le contrat pour tromperie.',
            'manœuvres dolosives': 'Comportements trompeurs.',
            'article 1137 du Code civil': 'Article définissant le dol.',
            'action rédhibitoire': 'Action en résolution pour vice caché.',
            'action estimatoire': 'Action en réduction du prix pour vice caché.',
            'signalement DGCCRF': 'Signalement à la Direction Générale de la Concurrence, de la Consommation et de la Répression des Fraudes.',
            'pratique commerciale trompeuse': 'Pratique induisant le consommateur en erreur (article L.121-2 du Code de la consommation).',
            'article L.121-2 du Code de la consommation': 'Article réprimant les pratiques commerciales trompeuses.',
            'responsabilité précontractuelle': 'Responsabilité née avant la conclusion du contrat.',
            'article L.212-1 du Code de la consommation': 'Article définissant les clauses abusives.',
            'responsabilité du fabricant': 'Responsabilité du fabricant du produit.',
            'action de groupe': 'Action collective regroupant plusieurs consommateurs (article L.623-1 du Code de la consommation).',
            'article L.623-1 du Code de la consommation': 'Article régissant l\'action de groupe.',
            'signalement ANSM': 'Signalement à l\'Agence Nationale de Sécurité du Médicament.',
            'autorité de sécurité': 'Autorité chargée de la sécurité.',
            'sécurité des produits': 'Sécurité des biens mis sur le marché.',
            'mise en demeure': 'Acte formel sommant une partie d\'exécuter une obligation.',
            'lettre recommandée avec AR': 'Lettre envoyée avec accusé de réception.',
            'interpellation formelle': 'Demande officielle adressée à une partie.',
            'conciliation': 'Mode alternatif de résolution des différends par un conciliateur.',
            'conciliateur de justice': 'Personne chargée de faciliter la résolution amiable des litiges.',
            'mode alternatif de résolution des différends': 'Modes de résolution autres que le procès (MARD).',
            'MARD': 'Abréviation de Modes Alternatifs de Résolution des Différends.',
            'médiation': 'Processus de résolution amiable avec un médiateur.',
            'médiateur de la consommation': 'Personne chargée de faciliter la résolution des litiges de consommation.',
            'article L.612-1 du Code de la consommation': 'Article régissant la médiation de la consommation.',
            'expertise amiable': 'Expertise réalisée à l\'amiable.',
            'expertise contradictoire amiable': 'Expertise amiable en présence des deux parties.',
            'préalables à l\'action': 'Démarches à effectuer avant d\'agir en justice.',
            'analyse coût/bénéfice': 'Évaluation du rapport entre le coût et le bénéfice attendu.',
            'intérêt à agir': 'Nécessité d\'avoir un intérêt légitime à agir en justice.',
            'avocat': 'Professionnel du droit représentant les parties.',
            'synthèse': 'Résumé des éléments essentiels.',
            'recommandations': 'Conseils pour la suite de la procédure.',
            'analyse factuelle': 'Analyse basée sur les faits.',
            'éléments fournis': 'Informations communiquées par l\'utilisateur.',
            'faits non vérifiés': 'Faits non confirmés par une expertise.',
            'qualification juridique potentielle': 'Qualification juridique envisageable.',
            'sous réserve de vérification': 'Sous condition de contrôle.',
            'régimes de garantie': 'Ensembles de règles de garantie.',
            'invocabilité': 'Possibilité d\'invoquer un droit.',
            'rappels documentés': 'Rappels attestés par des documents.',
            'problèmes récurrents': 'Problèmes se répétant fréquemment.',
            'complétude': 'Exhaustivité.',
            'limites de l\'analyse': 'Bornes de la portée de l\'analyse.',
            'défaut d\'expertise contradictoire': 'Absence d\'expertise réalisée contradictoirement.',
            'circonstances non établies': 'Circonstances non confirmées.',
            'qualification provisoire': 'Qualification temporaire en attente de vérification.',
            'vérification au cas par cas': 'Examen individuel de chaque situation.',
            'recommandations stratégiques': 'Conseils orientant la stratégie.',
            'expert agréé': 'Expert reconnu par une autorité compétente.',
            'VIN': 'Vehicle Identification Number - Numéro d\'identification du véhicule.',
            'vérification des rappels': 'Contrôle des rappels en cours.',
            'conservation des pièces': 'Préservation des documents.',
            'intégrité des preuves': 'Préservation de l\'état original des preuves.',
            'droit automobile': 'Branche du droit relative aux véhicules.',
            'préservation des droits': 'Maintien des droits.',
            'caractère automatique': 'Caractère généré automatiquement.',
            'non-garantie de succès': 'Absence de garantie de résultat.',
            'conseil juridique adapté': 'Avis juridique personnalisé.',
            'examen approfondi': 'Analyse détaillée.',
            'professionnel du droit': 'Personne exerçant une profession juridique.',
            'risques encourus': 'Conséquences négatives potentielles pour une partie.',
            'responsabilités': 'Obligations légales ou contractuelles d\'une partie.',
            'régime de responsabilité': 'Ensemble des règles déterminant les conditions de mise en œuvre de la responsabilité.',
            'détermination des responsabilités': 'Processus d\'identification des parties responsables.',
            'nature des défauts': 'Caractéristiques des dysfonctionnements constatés.',
            'garantie des vices cachés': 'Régime de garantie du Code civil (articles 1641 et suivants).',
            'articles 1641 et suivants du Code civil': 'Articles régissant la garantie des vices cachés.',
            'action rédhibitoire': 'Action en résolution de la vente pour vice caché.',
            'article 1644 du Code civil': 'Article offrant le choix entre résolution et réduction du prix.',
            'dommages et intérêts': 'Somme d\'argent allouée en réparation d\'un préjudice.',
            'mauvaise foi': 'Connaissance du vice par le vendeur au moment de la vente.',
            'article 1645 du Code civil': 'Article présumant la mauvaise foi du vendeur professionnel.',
            'article 1646 du Code civil': 'Article relatif aux frais de l\'expertise.',
            'tromperie': 'Infraction consistant à tromper sur la nature, la substance ou les qualités d\'un produit (article L.213-1 du Code de la consommation).',
            'article L.213-1 du Code de la consommation': 'Article réprimant la tromperie.',
            'sanctions pénales': 'Peines prononcées par une juridiction pénale.',
            'faux': 'Altération de la vérité dans un document.',
            'usage de faux': 'Utilisation d\'un document falsifié.',
            'articles 441-1 et suivants du Code pénal': 'Articles réprimant le faux et l\'usage de faux.',
            'escroquerie': 'Infraction consistant à obtenir quelque chose par des manœuvres frauduleuses (article 313-1 du Code pénal).',
            'article 313-1 du Code pénal': 'Article définissant l\'escroquerie.',
            'manœuvres frauduleuses': 'Comportements trompeurs destinés à induire en erreur.',
            'mise en danger d\'autrui': 'Infraction consistant à exposer autrui à un risque immédiat (article 223-1 du Code pénal).',
            'article 223-1 du Code pénal': 'Article réprimant la mise en danger d\'autrui.',
            'non-disclosure': 'Omission de révéler une information importante.',
            'rappel non effectué': 'Campagne de rappel non réalisée sur le véhicule.',
            'tromperie aggravée': 'Tromperie commise dans des circonstances aggravantes.',
            'responsabilité du fait des choses': 'Responsabilité du gardien d\'une chose (article 1242 du Code civil).',
            'article 1242 du Code civil': 'Article relatif à la responsabilité du fait des choses.',
            'limites de protection': 'Bornes de la protection juridique offerte.',
            'recours limités': 'Options juridiques restreintes.',
            'inapplicabilité de la garantie légale de conformité': 'Non-application du régime de la garantie légale de conformité aux ventes entre particuliers.',
            'charge de la preuve sur l\'acheteur': 'Obligation pour l\'acheteur de prouver les faits qu\'il avance.',
            'délai de prescription de 2 ans': 'Délai de 2 ans pour agir en garantie des vices cachés.',
            'article 1648 du Code civil': 'Article fixant le délai de l\'action en garantie des vices cachés.',
            'délai bref': 'Délai de prescription court.',
            'défaut apparent': 'Défaut qui pouvait être décelé par un examen attentif.',
            'opposabilité de la clause': 'Possibilité d\'invoquer une clause à l\'encontre d\'une partie.',
            'preuve de la mauvaise foi': 'Démonstration que le vendeur connaissait le vice.',
            'connaissance du vice': 'Savoir du vendeur concernant le défaut.',
            'régime de responsabilité étendu': 'Régime de responsabilité plus large que le droit commun.',
            'cumul des fondements': 'Possibilité d\'invoquer plusieurs fondements juridiques simultanément.',
            'responsabilité sans faute': 'Responsabilité engagée sans qu\'une faute soit nécessaire.',
            'présomption de connaissance du professionnel': 'Présomption selon laquelle le professionnel connaît les défauts.',
            'action en résolution pour inexécution': 'Action visant à annuler le contrat pour inexécution des obligations.',
            'article 1224 du Code civil': 'Article relatif à la résolution pour inexécution.',
            'inexécution contractuelle': 'Non-exécution des obligations contractuelles.',
            'article 1112-1 du Code civil': 'Article relatif à l\'obligation d\'information précontractuelle.',
            'obligation d\'information précontractuelle': 'Obligation d\'informer avant la conclusion du contrat.',
            'dommages et intérêts étendus': 'Dommages et intérêts couvrant l\'intégralité du préjudice.',
            'réparation intégrale': 'Principe selon lequel la réparation doit couvrir l\'intégralité du préjudice.',
            'amende proportionnelle au CA': 'Amende calculée en pourcentage du chiffre d\'affaires.',
            'pratique commerciale agressive': 'Pratique altérant la liberté de choix du consommateur (article L.121-6 du Code de la consommation).',
            'article L.121-6 du Code de la consommation': 'Article réprimant les pratiques commerciales agressives.',
            'défaut d\'information': 'Absence d\'information sur les caractéristiques essentielles.',
            'article L.111-1 du Code de la consommation': 'Article relatif à l\'information du consommateur.',
            'sanctions administratives': 'Sanctions prononcées par une autorité administrative.',
            'DGCCRF': 'Direction Générale de la Concurrence, de la Consommation et de la Répression des Fraudes.',
            'interdiction d\'exercer': 'Interdiction temporaire ou définitive d\'exercer une activité.',
            'homicide involontaire': 'Décès causé par imprudence, négligence ou manquement à une obligation (article 221-6 du Code pénal).',
            'blessures involontaires': 'Lésions corporelles causées par imprudence (article 222-19 du Code pénal).',
            'articles 221-6 et 222-19 du Code pénal': 'Articles réprimant l\'homicide et les blessures involontaires.',
            'amendes administratives': 'Amendes prononcées par une autorité administrative.',
            'publication de la décision': 'Obligation de publier la décision de sanction.',
            'retrait de produits': 'Obligation de retirer des produits dangereux du marché.',
            'rappel de produits': 'Obligation de rappeler des produits dangereux auprès des consommateurs.',
            'obligation de sécurité': 'Obligation de ne pas mettre sur le marché des produits dangereux.',
            'suspension d\'agrément': 'Suspension temporaire de l\'autorisation d\'exercer.',
            'retrait d\'agrément': 'Retrait définitif de l\'autorisation d\'exercer.',
            'professions réglementées': 'Professions soumises à une réglementation spécifique.',
            'injonction de cesser': 'Ordre de cesser une pratique illicite.',
            'astreinte': 'Somme d\'argent payable par jour de retard.',
            'signalement au parquet': 'Transmission d\'un dossier au procureur de la République.',
            'poursuites pénales': 'Actions engagées par le ministère public.',
            'obligations renforcées': 'Obligations plus strictes que le droit commun.',
            'vendeur automobile': 'Professionnel vendant des véhicules.',
            'obligation de délivrance conforme': 'Obligation de délivrer un bien conforme.',
            'défaut connu ou décelable': 'Défaut que le vendeur connaissait ou aurait dû connaître.',
            'Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485': 'Arrêt relatif à l\'obligation de vérification des rappels.',
            'adéquation aux besoins': 'Correspondance du bien aux besoins de l\'acquéreur.',
            'sécurité du véhicule': 'Absence de danger lié au véhicule.',
            'conservation des documents': 'Obligation de conserver les documents.',
            'obligation de transparence': 'Obligation de fournir des informations complètes et exactes.',
            'historique vérifié': 'Historique dont l\'exactitude a été contrôlée.',
            'présomption de faute': 'Présomption selon laquelle le professionnel a fauté.',
            'délai de 2 ans': 'Délai de la garantie légale de conformité.',
            'présomption d\'antériorité de 6 mois': 'Présomption d\'antériorité pendant les 6 premiers mois.',
            'nullité des clauses d\'exonération': 'Invalidité des clauses limitant la responsabilité.',
            'clauses réputées non écrites': 'Clauses considérées comme n\'ayant jamais existé.',
            'médiation de la consommation': 'Médiation spécifique aux litiges de consommation.',
            'protection étendue de l\'acheteur': 'Protection juridique importante offerte à l\'acheteur.',
            'risques significatifs pour le professionnel': 'Risques importants encourus par le vendeur professionnel.',
            'cumul des sanctions': 'Possibilité de cumuler plusieurs types de sanctions.',
            'vendeur occasionnel': 'Personne vendant occasionnellement sans être professionnel.',
            'requalification en vendeur professionnel': 'Reconnaissance judiciaire du statut de professionnel.',
            'activité dissimulée': 'Activité professionnelle exercée sans le statut correspondant.',
            'critères de requalification': 'Éléments permettant de requalifier une activité.',
            'activité habituelle': 'Activité exercée de manière régulière.',
            'recherche de profit': 'Intention de réaliser des bénéfices.',
            'application du régime professionnel': 'Application des règles applicables aux professionnels.',
            'exercice illégal': 'Exercice d\'une activité sans l\'autorisation requise.',
            'article L.221-1 du Code de la consommation': 'Article relatif à l\'exercice illégal d\'une profession.',
            'mandataire': 'Personne agissant pour le compte d\'une autre.',
            'intermédiaire': 'Personne facilitant une transaction entre deux parties.',
            'vente par mandataire': 'Vente conclue par l\'intermédiaire d\'un mandataire.',
            'responsabilité du mandataire professionnel': 'Responsabilité du mandataire ayant le statut de professionnel.',
            'responsabilité du mandant': 'Responsabilité du propriétaire du bien vendu.',
            'responsabilité solidaire': 'Responsabilité partagée entre plusieurs parties.',
            'solidarité passive': 'Obligation solidaire de plusieurs débiteurs.',
            'importateur parallèle': 'Personne important des produits hors du réseau officiel.',
            'vente hors réseau': 'Vente réalisée en dehors du réseau de distribution officiel.',
            'difficultés de vérification': 'Difficultés à contrôler l\'historique du véhicule.',
            'rappels non applicables': 'Rappels constructeur non valables dans le pays d\'importation.',
            'garantie constructeur limitée': 'Garantie du constructeur restreinte.',
            'importation parallèle': 'Importation de produits hors du réseau officiel.',
            'vente aux enchères': 'Vente réalisée par adjudication.',
            'enchères judiciaires': 'Ventes aux enchères ordonnées par une juridiction.',
            'article 1649 du Code civil': 'Article excluant la garantie pour les ventes judiciaires.',
            'pas de garantie pour ventes judiciaires': 'Exclusion de la garantie pour les ventes aux enchères judiciaires.',
            'exception pour dol': 'Exception permettant d\'engager la responsabilité en cas de dol.',
            'vice caché non divulgué': 'Vice caché non révélé par le vendeur.',
            'caveat emptor': 'Principe latin "que l\'acheteur prenne garde".',
            'risques accrus pour l\'acheteur': 'Risques plus importants pour l\'acheteur.',
            'sanctions civiles vendeur particulier': 'Sanctions civiles applicables au vendeur particulier.',
            'sanctions civiles vendeur professionnel': 'Sanctions civiles applicables au vendeur professionnel.',
            'présomption de mauvaise foi': 'Présomption selon laquelle le vendeur professionnel connaissait le vice.',
            'montant des dommages et intérêts': 'Somme allouée en réparation du préjudice.',
            'frais de justice': 'Frais liés à la procédure judiciaire.',
            'prescription contraventionnelle': 'Délai de prescription pour les contraventions (1 an).',
            '1 an': 'Délai de prescription des contraventions.',
            'prescription délictuelle': 'Délai de prescription pour les délits (6 ans).',
            '6 ans': 'Délai de prescription des délits.',
            'article 8 du Code de procédure pénale': 'Article fixant les délais de prescription de l\'action publique.',
            'prescription criminelle': 'Délai de prescription pour les crimes (20 ans).',
            '20 ans': 'Délai de prescription des crimes.',
            'délai de 3 ans': 'Délai de prescription de 3 ans.',
            'article L.233-7 du Code de la consommation': 'Article relatif aux sanctions administratives de la DGCCRF.',
            'interruption de la prescription': 'Acte faisant recommencer le délai de prescription.',
            'suspension de la prescription': 'Acte suspendant temporairement le délai de prescription.',
            'reconnaissance de dette': 'Acte par lequel un débiteur reconnaît sa dette.',
            'stratégie pour l\'acheteur': 'Plan d\'action recommandé pour l\'acheteur.',
            'action en garantie des vices cachés': 'Action fondée sur la garantie des vices cachés.',
            'risque limité pour le vendeur particulier': 'Risques limités pour le vendeur non-professionnel.',
            'conciliation préalable': 'Tentative de résolution amiable avant l\'action en justice.',
            'cumul des actions': 'Possibilité d\'exercer plusieurs actions simultanément.',
            'risques cumulatifs pour le professionnel': 'Risques de plusieurs natures pour le vendeur professionnel.',
            'prévention': 'Mesures visant à éviter les litiges.',
            'conformité': 'Respect des obligations légales et réglementaires.',
            'signalement aux autorités': 'Transmission d\'informations aux autorités compétentes.',
            'vérification du statut': 'Contrôle de la qualité juridique d\'une partie.',
            'registre du commerce': 'Registre officiel des commerçants.',
            'immatriculation': 'Inscription au registre du commerce.',
            'critères d\'appréciation du statut professionnel': 'Éléments permettant de déterminer le statut professionnel.',
            'actions alternatives': 'Actions exercées à titre principal et subsidiaire.',
            'subsidiarité': 'Principe selon lequel une action est exercée à défaut d\'une autre.',
            'conseil d\'avocat': 'Avis d\'un avocat.',
            'stratégie optimale': 'Meilleure stratégie juridique.',
            'limite de l\'analyse': 'Borne de la portée de l\'analyse.',
            'non-conseil juridique personnalisé': 'L\'analyse ne constitue pas un conseil adapté au cas spécifique.',
            'appréciation au cas par cas': 'Examen individuel de chaque situation.',
            'lexique': 'Liste de termes avec leur définition.',
            'définitions': 'Explications des termes.',
            'terminologie juridique': 'Ensemble des termes utilisés en droit.',
            'référence aux textes officiels': 'Renvoi aux textes de loi.',
            'responsabilité délictuelle': 'Responsabilité née d\'un fait dommageable hors contrat.',
            'délai de 5 ans': 'Délai de prescription de droit commun (5 ans).',
            'article 2224 du Code civil': 'Article fixant le délai de prescription de droit commun.',
            'délai de 10 ans': 'Durée maximale de la responsabilité du fait des produits défectueux.',
            'article 1245-16 du Code civil': 'Article fixant la durée de la responsabilité du fait des produits défectueux.',
            'découverte du dol': 'Moment où le dol est connu de la victime.',
            'article 1304 du Code civil': 'Article relatif au délai de l\'action en nullité.'
        };

        let content = "<p><strong>Objet :</strong> Lexique des termes juridiques mobilisés dans la présente analyse, avec leur définition.</p>";
        content += "<p>Les termes ci-dessous ont été identifiés comme ayant servi à formuler les conclusions de l'analyse. Ils sont présentés par ordre alphabétique avec une brève définition " + termes('lexique', 'définitions', 'terminologie juridique') + ".</p>";
        
        content += "<div class='lexique-section'>";
        
        const termesTries = Array.from(termesMobilises).sort();
        
        if (termesTries.length === 0) {
            content += "<p>Aucun terme juridique spécifique n'a été mobilisé dans cette analyse.</p>";
        } else {
            content += "<p><strong>Nombre de termes juridiques mobilisés :</strong> " + termesTries.length + "</p>";
            content += "<p><em>Cliquez sur un terme pour voir sa définition :</em></p>";
            
            termesTries.forEach(terme => {
                const definition = lexique[terme] || 'Terme juridique utilisé dans l\'analyse.';
                content += "<div class='lexique-item'>";
                content += "<div class='lexique-terme'>" + terme + "</div>";
                content += "<div class='lexique-definition'>" + definition + "</div>";
                content += "</div>";
            });
        }
        
        content += "</div>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>️ Note :</strong> Ce lexique est généré automatiquement à partir des termes effectivement utilisés dans l'analyse. Les définitions sont données à titre indicatif et ne se substituent pas aux définitions légales ou doctrinales. Pour une compréhension approfondie, il convient de se référer aux textes officiels ou à un professionnel du droit " + termes('référence aux textes officiels', 'conseil juridique') + ".";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // AFFICHAGE
    // ============================================================
    
    function displayAnalysis() {
        let html = '';

        analysisData.sections.forEach(section => {
            html += '<h3>' + section.title + '</h3>';
            html += section.content;
        });

        if (analysisResult) {
            analysisResult.innerHTML = html;
        }

        if (analysisSection) {
            analysisSection.classList.remove('hidden');
            analysisSection.scrollIntoView({ behavior: 'smooth' });
        }

        console.log('✅ Analyse affichée - ' + termesMobilises.size + ' termes juridiques mobilisés');
    }

    // ============================================================
    // GÉNÉRATION PDF
    // ============================================================
    
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', function() {
            if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
                alert('⚠️ La bibliothèque PDF n\'est pas chargée.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 20;
            const maxWidth = pageWidth - 2 * margin;
            let yPosition = margin;

            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('RAPPORT D\'ANALYSE TECHNIQUE ET JURIDIQUE', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 10;

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text('Aide Rédactionnelle - Analyse factuelle', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 12;

            doc.setFontSize(9);
            doc.text('Date : ' + analysisData.date, margin, yPosition);
            yPosition += 6;
            
            if (vehicleData.marque) {
                doc.text('Véhicule : ' + vehicleData.marque + ' ' + (vehicleData.modele || '') + ' (' + (vehicleData.annee || '') + ')', margin, yPosition);
                yPosition += 6;
            }

            yPosition += 4;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Avertissement : Ce rapport est généré automatiquement à partir des éléments fournis.', margin, yPosition);
            yPosition += 4;
            doc.text('Il ne constitue pas un conseil juridique.', margin, yPosition);
            yPosition += 8;
            doc.setTextColor(0);

            analysisData.sections.forEach(section => {
                if (yPosition > 260) {
                    doc.addPage();
                    yPosition = margin;
                }

                doc.setFont(undefined, 'bold');
                doc.setFontSize(10);
                const titleLines = doc.splitTextToSize(section.title, maxWidth);
                doc.text(titleLines, margin, yPosition);
                yPosition += titleLines.length * 5 + 4;

                doc.setFont(undefined, 'normal');
                doc.setFontSize(8);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = section.content;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                const contentLines = doc.splitTextToSize(plainText, maxWidth);

                contentLines.forEach(line => {
                    if (yPosition > 275) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin, yPosition);
                    yPosition += 4;
                });

                yPosition += 4;
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text('Page ' + i + ' / ' + pageCount + ' - Aide Rédactionnelle', pageWidth / 2, 290, { align: 'center' });
            }

            doc.save('analyse-' + analysisData.date.replace(/\//g, '-') + '.pdf');
            alert('✅ Rapport PDF généré avec succès !');
        });
    }

    // ============================================================
    // PARTAGE
    // ============================================================
    
    if (shareBtn) {
        shareBtn.addEventListener('click', async function() {
            const shareText = 'Analyse Technique et Juridique - ' + analysisData.date + '\n\n' +
                analysisData.sections.map(s => s.title + '\n' + s.content.replace(/<[^>]*>/g, '') + '\n').join('\n');

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Analyse Technique et Juridique',
                        text: shareText
                    });
                } catch (err) {
                    console.log('Erreur de partage:', err);
                }
            } else {
                navigator.clipboard.writeText(shareText).then(() => {
                    alert('✅ Analyse copiée dans le presse-papier');
                }).catch(() => {
                    alert('️ Impossible de copier.');
                });
            }
        });
    }

    // ============================================================
    // SERVICE WORKER
    // ============================================================
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✅ Service Worker enregistré'))
            .catch(err => console.log('⚠️ Service Worker:', err));
    }
});
