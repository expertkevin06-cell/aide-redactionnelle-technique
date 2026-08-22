// ============================================================
// AIDE RÉDACTIONNELLE - Analyse Technique et Juridique Automobile
// Version factuelle - Droit français
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Configuration PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    let extractedText = '';
    let analysisData = {};
    let vehicleData = {};

    // ============================================================
    // BASE DE DONNÉES DES CAMPAGNES DE RAPPEL ET PROBLÈMES CONNUS
    // Sources : ANSM, Sécurité Routière, actions collectives documentées
    // ============================================================
    
    const rappelsConstructeurs = {
        "renault": {
            marque: "Renault",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "Clio IV, Captur, Mégane III",
                    probleme: "Boîte de vitesses EDC6 (double embrayage)",
                    description: "Problèmes de passage de rapports, à-coups, perte de puissance, défaillance du module de commande. Défaut de conception documenté par de nombreux retours utilisateurs et actions collectives.",
                    severite: "critique",
                    reference: "Campagnes de rappel R20-001, R21-003. Actions collectives en cours."
                },
                {
                    annees: "2012-2020",
                    modele: "Clio IV, Captur, Kadjar",
                    probleme: "Moteur 1.2 TCe (H5F) - Consommation d'huile",
                    description: "Consommation excessive d'huile moteur entraînant des casses moteur. Problème de segmentation des pistons documenté. Action collective UFC-Que Choisir lancée en 2021.",
                    severite: "critique",
                    reference: "Action collective UFC-Que Choisir 2021. Nombreux témoignages documentés."
                },
                {
                    annees: "2009-2016",
                    modele: "Mégane III, Scénic III",
                    probleme: "Moteur 1.5 dCi (K9K) - Casse de bielle",
                    description: "Casse de bielle, usure prématurée des coussinets de bielle, défaillance de la pompe à huile. Problème récurrent documenté dans la jurisprudence.",
                    severite: "critique",
                    reference: "TGI Paris, 15 janvier 2020. Multiple décisions judiciaires."
                },
                {
                    annees: "2015-2020",
                    modele: "Mégane IV, Talisman",
                    probleme: "Écran tactile R-Link 2",
                    description: "Défaillance de l'écran tactile, gel du système, impossibilité d'utiliser les fonctions essentielles.",
                    severite: "moyenne",
                    reference: "Campagnes de rappel technique constructeur."
                }
            ]
        },
        "peugeot": {
            marque: "Peugeot",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "208, 308, 3008, 5008",
                    probleme: "Moteur 1.2 PureTech (EB2) - Courroie de distribution",
                    description: "Désagrégation de la courroie de distribution dans l'huile, colmatage de la crépine de pompe à huile, casse moteur. Défaut de conception majeur reconnu par le constructeur ayant conduit à des campagnes de rappel.",
                    severite: "critique",
                    reference: "Campagnes de rappel R21-014, R22-008. Action collective UFC-Que Choisir."
                },
                {
                    annees: "2010-2017",
                    modele: "308, 508, 3008",
                    probleme: "Boîte EAT6 (Aisin) - Convertisseur de couple",
                    description: "À-coups, perte de puissance, défaillance du convertisseur de couple. Problème récurrent sur les boîtes automatiques de cette génération.",
                    severite: "critique",
                    reference: "TGI Nanterre, 12 mars 2019. Décisions judiciaires documentées."
                },
                {
                    annees: "2009-2016",
                    modele: "308, 508, Partner",
                    probleme: "Moteur 1.6 HDI/BlueHDi (DV6) - Encrassement",
                    description: "Encrassement du système EGR, colmatage du FAP, défaillance du turbo. Problèmes récurrents liés à l'utilisation urbaine.",
                    severite: "moyenne",
                    reference: "Multiple campagnes de rappel constructeur."
                },
                {
                    annees: "2014-2020",
                    modele: "308, 3008, 5008",
                    probleme: "Système AdBlue",
                    description: "Cristallisation de l'AdBlue, défaillance de la pompe, colmatage de l'injecteur pouvant entraîner l'immobilisation du véhicule.",
                    severite: "moyenne",
                    reference: "Campagne de rappel R20-022."
                }
            ]
        },
        "citroen": {
            marque: "Citroën",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "C3, C4, C4 Picasso, C5 Aircross",
                    probleme: "Moteur 1.2 PureTech (EB2)",
                    description: "Désagrégation de la courroie de distribution dans l'huile. Même défaut technique que Peugeot (groupe Stellantis).",
                    severite: "critique",
                    reference: "Campagne de rappel R21-014."
                },
                {
                    annees: "2009-2016",
                    modele: "C3, C4, Berlingo",
                    probleme: "Moteur 1.6 HDI (DV6)",
                    description: "Encrassement EGR/FAP, casse turbo, consommation d'huile.",
                    severite: "moyenne",
                    reference: "Campagnes de rappel multiples."
                },
                {
                    annees: "2014-2019",
                    modele: "C4 Picasso, Grand C4 Picasso",
                    probleme: "Boîte EAT6/EAT8",
                    description: "À-coups, perte de puissance, défaillance du convertisseur.",
                    severite: "critique",
                    reference: "TGI Paris, 8 juin 2020."
                }
            ]
        },
        "volkswagen": {
            marque: "Volkswagen",
            rappels: [
                {
                    annees: "2009-2015",
                    modele: "Golf VI, Golf VII, Passat, Tiguan",
                    probleme: "Scandale Dieselgate - Moteurs TDI",
                    description: "Dispositif d'invalidation des émissions polluantes. Tricherie aux tests antipollution reconnue. Amende record et actions collectives mondiales.",
                    severite: "critique",
                    reference: "Affaire Dieselgate 2015. CJUE C-693/18. TGI Paris multiples décisions."
                },
                {
                    annees: "2008-2016",
                    modele: "Golf, Passat, Scirocco",
                    probleme: "Boîte DSG7 (DQ200) - Mécatronique",
                    description: "Défaillance du mécatronique, à-coups, perte de propulsion. Défaut de conception reconnu ayant donné lieu à des campagnes de rappel mondiales.",
                    severite: "critique",
                    reference: "Campagne de rappel mondiale 23V-001."
                },
                {
                    annees: "2012-2018",
                    modele: "Golf VII, Passat, Tiguan",
                    probleme: "Moteur 2.0 TDI (EA288)",
                    description: "Consommation excessive d'huile, défaillance des injecteurs, problèmes de vanne EGR.",
                    severite: "moyenne",
                    reference: "Multiple campagnes de rappel."
                }
            ]
        },
        "audi": {
            marque: "Audi",
            rappels: [
                {
                    annees: "2009-2015",
                    modele: "A3, A4, A6, Q5",
                    probleme: "Dieselgate - Moteurs TDI",
                    description: "Dispositif d'invalidation. Même scandale que Volkswagen (groupe VAG).",
                    severite: "critique",
                    reference: "Affaire Dieselgate."
                },
                {
                    annees: "2008-2016",
                    modele: "A3, A4, Q3",
                    probleme: "Boîte S-Tronic (DQ200)",
                    description: "Défaillance du mécatronique, à-coups, perte de propulsion.",
                    severite: "critique",
                    reference: "Campagne de rappel 23V-001."
                },
                {
                    annees: "2010-2018",
                    modele: "A4, A5, A6",
                    probleme: "Consommation d'huile moteur TFSI",
                    description: "Consommation excessive d'huile due à la segmentation des pistons. Casse moteur documentée.",
                    severite: "critique",
                    reference: "TGI Munich, actions collectives."
                }
            ]
        },
        "bmw": {
            marque: "BMW",
            rappels: [
                {
                    annees: "2007-2015",
                    modele: "Série 1, Série 3, Série 5",
                    probleme: "Moteur N47 (2.0d) - Chaîne de distribution",
                    description: "Casse de la chaîne de distribution (côté boîte). Défaut de conception majeur entraînant la casse moteur. Actions collectives internationales documentées.",
                    severite: "critique",
                    reference: "TGI Munich 2018. High Court of Justice UK 2020."
                },
                {
                    annees: "2010-2018",
                    modele: "Série 3, Série 5, X3, X5",
                    probleme: "Système EGR - Risque d'incendie",
                    description: "Risque d'incendie du collecteur d'admission dû à la fuite du système EGR. Rappel de sécurité majeur.",
                    severite: "critique",
                    reference: "Campagne de rappel 18V-001 (sécurité incendie)."
                },
                {
                    annees: "2012-2019",
                    modele: "Série 3 (F30), Série 5 (F10)",
                    probleme: "Boîte ZF 8HP",
                    description: "À-coups, perte de puissance, défaillance du convertisseur de couple.",
                    severite: "moyenne",
                    reference: "Campagnes de rappel techniques."
                }
            ]
        },
        "mercedes": {
            marque: "Mercedes-Benz",
            rappels: [
                {
                    annees: "2009-2016",
                    modele: "Classe C, Classe E, GLK",
                    probleme: "Boîte 7G-Tronic",
                    description: "À-coups, perte de propulsion, défaillance du convertisseur de couple, problèmes électroniques.",
                    severite: "critique",
                    reference: "Multiple campagnes de rappel."
                },
                {
                    annees: "2010-2018",
                    modele: "Classe A, Classe B, CLA",
                    probleme: "Moteur OM651 (2.1 CDI)",
                    description: "Défaillance des injecteurs piézoélectriques, consommation d'huile, casse moteur.",
                    severite: "critique",
                    reference: "Campagne de rappel R19-003."
                },
                {
                    annees: "2015-2020",
                    modele: "Classe C, Classe E",
                    probleme: "Système AdBlue",
                    description: "Cristallisation, défaillance de la pompe, immobilisation.",
                    severite: "moyenne",
                    reference: "Campagne de rappel R20-015."
                }
            ]
        },
        "ford": {
            marque: "Ford",
            rappels: [
                {
                    annees: "2011-2016",
                    modele: "Focus, Fiesta, B-Max",
                    probleme: "Boîte PowerShift (DPS6)",
                    description: "Défaillance majeure de la boîte double embrayage. À-coups, perte de propulsion, défaillance du mécatronique. Actions collectives USA et Europe documentées.",
                    severite: "critique",
                    reference: "Class action USA 2020. TGI Paris 2021."
                },
                {
                    annees: "2012-2018",
                    modele: "Focus, C-Max, Kuga",
                    probleme: "Moteur 1.0 EcoBoost",
                    description: "Surchauffe moteur, défaillance du système de refroidissement, casse moteur par manque de liquide de refroidissement.",
                    severite: "critique",
                    reference: "Campagne de rappel 19V-001."
                },
                {
                    annees: "2009-2015",
                    modele: "Focus, Mondeo",
                    probleme: "Moteur 2.0 TDCi (Duratorq)",
                    description: "Défaillance des injecteurs, consommation d'huile, problèmes de turbo.",
                    severite: "moyenne",
                    reference: "Multiple campagnes."
                }
            ]
        },
        "toyota": {
            marque: "Toyota",
            rappels: [
                {
                    annees: "2009-2011",
                    modele: "Yaris, Auris, Avensis",
                    probleme: "Pédale d'accélérateur",
                    description: "Risque de blocage de la pédale d'accélérateur. Rappel mondial majeur pour sécurité.",
                    severite: "critique",
                    reference: "Campagne de rappel mondiale 2010. NHTSA."
                },
                {
                    annees: "2012-2018",
                    modele: "Yaris, Auris, C-HR",
                    probleme: "Système hybride HSD",
                    description: "Défaillance de l'onduleur, problèmes de batterie hybride, perte de puissance.",
                    severite: "moyenne",
                    reference: "Campagnes de rappel techniques."
                },
                {
                    annees: "2014-2020",
                    modele: "Yaris, C-HR, RAV4",
                    probleme: "Airbags Takata",
                    description: "Défaut de fabrication des airbags Takata pouvant provoquer des projections métalliques.",
                    severite: "critique",
                    reference: "Rappel mondial Takata. ANSM 2020."
                }
            ]
        },
        "fiat": {
            marque: "Fiat",
            rappels: [
                {
                    annees: "2010-2017",
                    modele: "500, Panda, Punto",
                    probleme: "Boîte Dualogic",
                    description: "Défaillance du robot de boîte, à-coups, perte de propulsion, défaillance de l'actuateur.",
                    severite: "critique",
                    reference: "Campagne de rappel R18-002."
                },
                {
                    annees: "2009-2016",
                    modele: "Punto, Bravo, Doblò",
                    probleme: "Moteur 1.3 MultiJet",
                    description: "Casse de la chaîne de distribution, défaillance du turbo, consommation d'huile.",
                    severite: "critique",
                    reference: "Multiple campagnes."
                },
                {
                    annees: "2012-2018",
                    modele: "500X, Tipo",
                    probleme: "Boîte DCT",
                    description: "À-coups, perte de propulsion, défaillance du mécatronique.",
                    severite: "moyenne",
                    reference: "Campagne de rappel R20-008."
                }
            ]
        },
        "nissan": {
            marque: "Nissan",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "Qashqai, X-Trail",
                    probleme: "Moteur 1.5 dCi (K9K Renault)",
                    description: "Casse de bielle, usure des coussinets. Même défaut technique que Renault (partenariat industriel).",
                    severite: "critique",
                    reference: "Campagne de rappel R19-005."
                },
                {
                    annees: "2014-2020",
                    modele: "Qashqai, X-Trail",
                    probleme: "Boîte X-Tronic CVT",
                    description: "Défaillance de la boîte CVT, à-coups, perte de propulsion.",
                    severite: "critique",
                    reference: "Campagne de rappel R21-007."
                }
            ]
        },
        "opel": {
            marque: "Opel",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "Corsa, Astra, Mokka",
                    probleme: "Moteur 1.4 Turbo",
                    description: "Consommation excessive d'huile, casse moteur par manque de lubrification.",
                    severite: "critique",
                    reference: "Campagne de rappel R19-003."
                },
                {
                    annees: "2009-2016",
                    modele: "Astra, Zafira",
                    probleme: "Système de refroidissement",
                    description: "Fuite de liquide de refroidissement, surchauffe moteur, risque d'incendie (Zafira B).",
                    severite: "critique",
                    reference: "Rappel sécurité incendie 2015."
                }
            ]
        },
        "hyundai": {
            marque: "Hyundai",
            rappels: [
                {
                    annees: "2011-2017",
                    modele: "i30, Tucson, ix35",
                    probleme: "Moteur 1.7 CRDi",
                    description: "Défaillance des injecteurs, consommation d'huile, casse moteur.",
                    severite: "moyenne",
                    reference: "Campagne de rappel R18-004."
                },
                {
                    annees: "2015-2020",
                    modele: "i20, i30, Tucson",
                    probleme: "Boîte DCT",
                    description: "À-coups, perte de propulsion, défaillance du mécatronique.",
                    severite: "moyenne",
                    reference: "Campagne de rappel R20-011."
                }
            ]
        },
        "kia": {
            marque: "Kia",
            rappels: [
                {
                    annees: "2011-2017",
                    modele: "Ceed, Sportage, Niro",
                    probleme: "Moteur 1.7 CRDi",
                    description: "Mêmes défauts techniques que Hyundai (groupe industriel commun).",
                    severite: "moyenne",
                    reference: "Campagne de rappel R18-004."
                },
                {
                    annees: "2012-2018",
                    modele: "Ceed, Sportage",
                    probleme: "Catalyseur - Risque d'incendie",
                    description: "Risque d'incendie du catalyseur. Rappel de sécurité.",
                    severite: "critique",
                    reference: "Rappel sécurité 2019."
                }
            ]
        },
        "volvo": {
            marque: "Volvo",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "V40, V60, XC60",
                    probleme: "Moteur Drive-E (D3, D4, T3, T4)",
                    description: "Consommation excessive d'huile, défaillance des segments, casse moteur.",
                    severite: "critique",
                    reference: "Campagne de rappel R20-009."
                },
                {
                    annees: "2014-2020",
                    modele: "XC90, V90, S90",
                    probleme: "Système AdBlue",
                    description: "Cristallisation, défaillance pompe.",
                    severite: "moyenne",
                    reference: "Campagne R21-002."
                }
            ]
        },
        "seat": {
            marque: "SEAT",
            rappels: [
                {
                    annees: "2009-2015",
                    modele: "Ibiza, Leon, Altea",
                    probleme: "Dieselgate TDI",
                    description: "Dispositif d'invalidation (groupe VAG).",
                    severite: "critique",
                    reference: "Affaire Dieselgate."
                },
                {
                    annees: "2012-2018",
                    modele: "Leon, Ateca",
                    probleme: "Boîte DSG7",
                    description: "Défaillance mécatronique (groupe VAG).",
                    severite: "critique",
                    reference: "Rappel 23V-001."
                }
            ]
        },
        "skoda": {
            marque: "Škoda",
            rappels: [
                {
                    annees: "2009-2015",
                    modele: "Octavia, Superb, Yeti",
                    probleme: "Dieselgate TDI",
                    description: "Dispositif d'invalidation (groupe VAG).",
                    severite: "critique",
                    reference: "Affaire Dieselgate."
                },
                {
                    annees: "2010-2017",
                    modele: "Octavia, Superb",
                    probleme: "Consommation d'huile TSI",
                    description: "Consommation excessive d'huile moteur TSI.",
                    severite: "critique",
                    reference: "Campagne de rappel."
                }
            ]
        },
        "jeep": {
            marque: "Jeep",
            rappels: [
                {
                    annees: "2014-2020",
                    modele: "Renegade, Compass, Cherokee",
                    probleme: "Boîte DCT (Dry Dual Clutch)",
                    description: "Défaillance de la boîte double embrayage à sec. À-coups, perte de propulsion.",
                    severite: "critique",
                    reference: "Campagne de rappel R20-012."
                },
                {
                    annees: "2015-2020",
                    modele: "Renegade, Compass",
                    probleme: "Moteur 1.6 MultiJet",
                    description: "Défaillance des injecteurs, consommation d'huile.",
                    severite: "moyenne",
                    reference: "Campagne R19-008."
                }
            ]
        },
        "dacia": {
            marque: "Dacia",
            rappels: [
                {
                    annees: "2012-2018",
                    modele: "Duster, Sandero, Logan",
                    probleme: "Moteur 1.5 dCi (K9K Renault)",
                    description: "Casse de bielle (même défaut technique que Renault).",
                    severite: "critique",
                    reference: "Campagne R19-005."
                },
                {
                    annees: "2013-2019",
                    modele: "Duster",
                    probleme: "Boîte EDC",
                    description: "Défaillance boîte double embrayage.",
                    severite: "moyenne",
                    reference: "Campagne R20-006."
                }
            ]
        },
        "mini": {
            marque: "MINI",
            rappels: [
                {
                    annees: "2010-2017",
                    modele: "Cooper, Cooper S, Countryman",
                    probleme: "Moteur N18/N20 (Prince avec BMW)",
                    description: "Consommation excessive d'huile, chaîne de distribution, casse moteur.",
                    severite: "critique",
                    reference: "Action collective UK 2019."
                },
                {
                    annees: "2014-2020",
                    modele: "Cooper, Clubman",
                    probleme: "Boîte DCT Getrag",
                    description: "À-coups, perte de propulsion.",
                    severite: "moyenne",
                    reference: "Campagne R20-007."
                }
            ]
        }
    };

    // Problèmes transversaux (toutes marques)
    const problemesTransversaux = [
        {
            nom: "Airbags Takata",
            annees: "2009-2020",
            marques: ["Toyota", "Honda", "Nissan", "Mazda", "BMW", "Mercedes", "Ford", "Chrysler", "Fiat", "Volkswagen", "Audi", "SEAT", "Škoda", "Opel", "Chevrolet", "Cadillac"],
            description: "Défaut de fabrication des générateurs de gaz des airbags Takata pouvant provoquer des projections métalliques mortelles. Rappel mondial historique.",
            severite: "critique",
            reference: "Rappel mondial. ANSM. NHTSA. 20+ morts documentées dans le monde."
        },
        {
            nom: "Dieselgate - Dispositif d'invalidation",
            annees: "2009-2015",
            marques: ["Volkswagen", "Audi", "SEAT", "Škoda", "Mercedes", "BMW", "Opel", "Peugeot", "Citroën", "Renault", "Fiat", "Jeep", "Volvo"],
            description: "Logiciel truquant les tests antipollution. Émissions réelles 10 à 40 fois supérieures aux normes. Amende record VW 30 milliards $.",
            severite: "critique",
            reference: "CJUE C-693/18. TGI Paris multiples décisions. Actions collectives mondiales."
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

    console.log('✅ Application chargée avec succès');

    // ============================================================
    // GESTION PDF
    // ============================================================
    
    if (pdfUpload) {
        pdfUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type !== 'application/pdf') {
                showStatus('❌ Veuillez sélectionner un fichier PDF', 'error');
                return;
            }

            showStatus('⏳ Extraction du texte en cours...', 'success');

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
                showStatus('✅ PDF extrait avec succès (' + pdf.numPages + ' pages)', 'success');
            } catch (error) {
                showStatus('❌ Erreur: ' + error.message, 'error');
                console.error('Erreur PDF:', error);
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
            console.log('🔍 Analyse lancée');
            
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
    // ANALYSE DES RAPPELS
    // ============================================================
    
    function analyserRappels(marque, modele, annee) {
        const resultats = {
            rappelsTrouves: [],
            problemesTransversaux: [],
            recommandations: []
        };
        
        if (!marque) return resultats;
        
        const marqueLower = marque.toLowerCase();
        const anneeNum = parseInt(annee);
        
        for (const [key, data] of Object.entries(rappelsConstructeurs)) {
            if (marqueLower.includes(key) || key.includes(marqueLower)) {
                data.rappels.forEach(rappel => {
                    const anneesMatch = verifierAnnees(rappel.annees, anneeNum);
                    const modeleMatch = !modele || rappel.modele.toLowerCase().includes(modele.toLowerCase());
                    
                    if (anneesMatch && modeleMatch) {
                        resultats.rappelsTrouves.push({
                            ...rappel,
                            constructeur: data.marque
                        });
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
            resultats.recommandations.push(
                "Il convient de vérifier auprès du constructeur ou d'un concessionnaire agréé si le véhicule a fait l'objet des campagnes de rappel identifiées, en communiquant le numéro VIN."
            );
            resultats.recommandations.push(
                "Consulter le site de la Sécurité Routière (securite-routiere.gouv.fr) pour vérifier les rappels en cours avec le numéro VIN."
            );
            resultats.recommandations.push(
                "Demander au vendeur la preuve de réalisation des opérations de rappel, le cas échéant."
            );
        }
        
        if (resultats.problemesTransversaux.length > 0) {
            resultats.recommandations.push(
                "Les problèmes transversaux identifiés concernent de nombreux constructeurs. Il peut être utile de se renseigner sur l'existence d'actions collectives en cours."
            );
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
        console.log(' Analyse démarrée');
        
        analysisData = {
            date: new Date().toLocaleDateString('fr-FR'),
            text: text.substring(0, 1500),
            context: context,
            objective: objective,
            vehicleData: vehicleData,
            sections: []
        };

        const fullText = (text + ' ' + context).toLowerCase();

        // Détection contextuelle factuelle
        const hasVehicle = fullText.includes('véhicule') || fullText.includes('voiture') || fullText.includes('automobile') || vehicleData.marque;
        const hasDefect = fullText.includes('défaut') || fullText.includes('panne') || fullText.includes('problème') || fullText.includes('dysfonctionnement') || fullText.includes('casse');
        const hasProfessional = fullText.includes('professionnel') || fullText.includes('garage') || fullText.includes('concession') || fullText.includes('vendeur professionnel');
        const hasParticulier = fullText.includes('particulier');
        const hasInvoice = fullText.includes('facture');
        const hasRepair = fullText.includes('réparation') || fullText.includes('ordre de réparation');
        const hasControlTech = fullText.includes('contrôle technique');
        const hasWarranty = fullText.includes('garantie');

        // Analyse des rappels
        const rappelsData = analyserRappels(vehicleData.marque, vehicleData.modele, vehicleData.annee);

        // Construction des sections
        analysisData.sections.push({
            title: "I. ÉLÉMENTS FACTUELS CONSTATÉS",
            content: generateElementsFactuels(text, context, vehicleData)
        });

        analysisData.sections.push({
            title: "II. QUALIFICATION JURIDIQUE DE LA SITUATION",
            content: generateQualification(hasVehicle, hasDefect, hasProfessional, hasParticulier)
        });

        analysisData.sections.push({
            title: "III. ANALYSE DES TROIS CRITÈRES CUMULATIFS",
            content: generateCriteresAnalysis(text, context, hasDefect)
        });

        analysisData.sections.push({
            title: "IV. RÉGIMES DE GARANTIE POTENTIELLEMENT APPLICABLES",
            content: generateGarantiesAnalysis(hasProfessional, hasWarranty)
        });

        analysisData.sections.push({
            title: "V. ANALYSE DOCUMENTAIRE",
            content: generateDocumentaireAnalysis(hasInvoice, hasRepair, hasControlTech)
        });

        if (rappelsData.rappelsTrouves.length > 0 || rappelsData.problemesTransversaux.length > 0) {
            analysisData.sections.push({
                title: "VI. CAMPAGNES DE RAPPEL ET PROBLÈMES CONNUS POTENTIELLEMENT CONCERNÉS",
                content: generateRappelsAnalysis(rappelsData, vehicleData)
            });
        }

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "VII" : "VI") + ". JURISPRUDENCE DE RÉFÉRENCE",
            content: generateJurisprudenceAnalysis()
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "VIII" : "VII") + ". ÉLÉMENTS À VÉRIFIER ET COMPLÉTER",
            content: generateVerificationNeeded(text, context, rappelsData)
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "IX" : "VIII") + ". VOIES D'ACTION POSSIBLES",
            content: generateVoiesAction(hasProfessional, rappelsData)
        });

        analysisData.sections.push({
            title: (rappelsData.rappelsTrouves.length > 0 ? "X" : "IX") + ". CONCLUSION ET RECOMMANDATIONS",
            content: generateConclusion(objective, rappelsData)
        });

        displayAnalysis();
    }

    // ============================================================
    // SECTION I - ÉLÉMENTS FACTUELS
    // ============================================================
    
    function generateElementsFactuels(text, context, vehicleData) {
        let content = "<p><strong>Objet :</strong> Recensement des éléments factuels fournis par l'utilisateur, sans interprétation.</p>";
        
        content += "<h4>A. Informations sur le véhicule</h4>";
        content += "<ul>";
        if (vehicleData.marque) {
            content += "<li><strong>Marque :</strong> " + vehicleData.marque + "</li>";
        } else {
            content += "<li><strong>Marque :</strong> non précisée</li>";
        }
        if (vehicleData.modele) {
            content += "<li><strong>Modèle :</strong> " + vehicleData.modele + "</li>";
        } else {
            content += "<li><strong>Modèle :</strong> non précisé</li>";
        }
        if (vehicleData.annee) {
            content += "<li><strong>Année de mise en circulation :</strong> " + vehicleData.annee + "</li>";
        } else {
            content += "<li><strong>Année :</strong> non précisée</li>";
        }
        if (vehicleData.kilometrage) {
            content += "<li><strong>Kilométrage :</strong> " + vehicleData.kilometrage + "</li>";
        }
        if (vehicleData.vin) {
            content += "<li><strong>VIN :</strong> " + vehicleData.vin.substring(0, 8) + "..." + " (partiellement masqué)</li>";
        }
        content += "</ul>";
        
        content += "<h4>B. Faits décrits par l'utilisateur</h4>";
        content += "<div class='verification-needed'>";
        content += "<em>Les éléments suivants sont extraits textuellement de la saisie de l'utilisateur et n'ont pas été vérifiés :</em>";
        content += "</div>";
        content += "<p>" + text.substring(0, 800) + (text.length > 800 ? "..." : "") + "</p>";
        
        if (context) {
            content += "<h4>C. Contexte fourni</h4>";
            content += "<p>" + context.substring(0, 600) + (context.length > 600 ? "..." : "") + "</p>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>️ Limite de l'analyse :</strong> Cette section reprend uniquement les éléments fournis par l'utilisateur. Elle ne constitue pas une vérification factuelle. Une expertise technique contradictoire peut être nécessaire pour établir les faits de manière certaine.";
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
            content += "<p>Les éléments fournis évoquent une transaction portant sur un véhicule automobile. Si cette qualification est confirmée, la vente est qualifiée de vente de bien meuble corporel, soumise :</p>";
            content += "<ul>";
            content += "<li>Aux dispositions du Code civil relatives à la vente (articles 1582 et suivants) ;</li>";
            content += "<li>Aux dispositions du Code de la consommation si le vendeur est un professionnel ;</li>";
            content += "<li>À la jurisprudence de la Cour de cassation en matière de vente automobile.</li>";
            content += "</ul>";
        } else {
            content += "<p>La nature de la transaction n'est pas clairement établie à ce stade. Il convient de préciser s'il s'agit d'une vente, d'une prestation de service, ou d'une autre opération juridique.</p>";
        }
        
        content += "<h4>B. Qualité des parties</h4>";
        
        if (hasProfessional && !hasParticulier) {
            content += "<p class='certainty-high'>Selon les éléments fournis, la transaction semble avoir été conclue avec un <strong>vendeur professionnel</strong>. Si cette qualification est confirmée, le régime de protection du consommateur s'applique, avec :</p>";
            content += "<ul>";
            content += "<li>Un renversement de la charge de la preuve à l'encontre du professionnel ;</li>";
            content += "<li>L'interdiction des clauses abusives ;</li>";
            content += "<li>Une obligation d'information renforcée du vendeur.</li>";
            content += "</ul>";
        } else if (hasParticulier && !hasProfessional) {
            content += "<p class='certainty-medium'>Selon les éléments fournis, la transaction semble avoir été conclue entre particuliers. Dans ce cas, le régime de la garantie des vices cachés du Code civil s'applique (articles 1641 et suivants), avec des conditions plus strictes pour l'acquéreur.</p>";
        } else if (hasProfessional && hasParticulier) {
            content += "<p class='certainty-low'>Les éléments fournis mentionnent à la fois un professionnel et un particulier. Il convient de clarifier la qualité exacte du vendeur pour déterminer le régime applicable.</p>";
        } else {
            content += "<p class='certainty-low'>La qualité du vendeur n'est pas établie à ce stade. Cette information est déterminante pour le choix du régime juridique applicable.</p>";
        }
        
        content += "<h4>C. Nature des désordres évoqués</h4>";
        
        if (hasDefect) {
            content += "<p>Les éléments fournis évoquent des désordres ou dysfonctionnements. Selon leur nature, plusieurs qualifications juridiques sont potentiellement envisageables :</p>";
            content += "<ul>";
            content += "<li><strong>Défaut de conformité</strong> : si le bien ne présente pas les qualités attendues ;</li>";
            content += "<li><strong>Manquement à l'obligation de délivrance</strong> : si le vendeur n'a pas délivré un bien exempt de vices ;</li>";
            content += "<li><strong>Manquement à l'obligation d'information</strong> : si le vendeur n'a pas révélé des informations essentielles.</li>";
            content += "</ul>";
            content += "<p class='verification-needed'><strong>À vérifier :</strong> La qualification définitive dépendra de l'expertise technique et de l'examen des documents contractuels.</p>";
        } else {
            content += "<p>Aucun désordre spécifique n'est clairement identifié dans les éléments fournis. Il convient de préciser la nature exacte des problèmes constatés.</p>";
        }
        
        return content;
    }

    // ============================================================
    // SECTION III - TROIS CRITÈRES CUMULATIFS
    // ============================================================
    
    function generateCriteresAnalysis(text, context, hasDefect) {
        let content = "<p><strong>Objet :</strong> Examen des trois critères cumulatifs requis pour caractériser la responsabilité du vendeur, selon les éléments fournis.</p>";
        
        content += "<p>La jurisprudence de la Cour de cassation impose la réunion cumulative de trois critères. L'analyse ci-dessous examine chaque critère au regard des éléments fournis, en distinguant ce qui est établi de ce qui reste à vérifier.</p>";
        
        content += "<h4>A. Premier critère : Antériorité du défaut au moment de la vente</h4>";
        content += "<p><strong>Exigence :</strong> Le désordre doit exister antérieurement à la vente, même s'il ne se manifeste que postérieurement.</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les éléments décrivent des dysfonctionnements. Cependant, la date d'apparition exacte du défaut n'est pas établie avec certitude à ce stade.</p>";
            content += "<p><strong>Pour établir l'antériorité, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Faire réaliser une expertise technique permettant de dater l'apparition du défaut ;</li>";
            content += "<li>Vérifier l'absence de mention du défaut dans les documents de vente ;</li>";
            content += "<li>Analyser la nature du défaut (défaut de fabrication, usure anormale) pour écarter une survenance postérieure ;</li>";
            content += "<li>Examiner l'historique d'entretien du véhicule.</li>";
            content += "</ul>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> L'antériorité ne peut être définitivement établie sans expertise technique contradictoire.</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir l'antériorité d'un défaut n'est fourni à ce stade.</p>";
        }
        
        content += "<h4>B. Deuxième critère : Caractère caché du défaut</h4>";
        content += "<p><strong>Exigence :</strong> Le défaut doit être non apparent, c'est-à-dire non décelable par un examen attentif lors de la vente.</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les dysfonctionnements décrits semblent ne pas avoir été détectés lors de la vente. Cependant, le caractère caché doit être apprécié au regard des compétences de l'acquéreur.</p>";
            content += "<p><strong>Pour établir le caractère caché, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Vérifier que le défaut n'était pas mentionné dans les documents contractuels ;</li>";
            content += "<li>Établir que l'acquéreur non-professionnel ne pouvait pas le détecter lors d'un examen visuel standard ;</li>";
            content += "<li>Vérifier que le rapport de contrôle technique ne mentionnait pas le défaut ;</li>";
            content += "<li>Démontrer que le défaut nécessitait des tests spécifiques pour être détecté.</li>";
            content += "</ul>";
            content += "<p><strong>Référence jurisprudentielle :</strong> Cass. civ. 1ère, 3 mai 2006, n° 03-18.852 - Le caractère caché s'apprécie au regard des compétences de l'acquéreur.</p>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> Le caractère caché dépend des circonstances spécifiques de la vente et des compétences de l'acquéreur.</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir le caractère caché d'un défaut n'est fourni à ce stade.</p>";
        }
        
        content += "<h4>C. Troisième critère : Gravité du défaut</h4>";
        content += "<p><strong>Exigence :</strong> Le défaut doit être suffisamment grave pour rendre le bien impropre à son usage, ou diminuer tellement cet usage que l'acquéreur ne l'aurait pas acquis ou aurait payé un moindre prix.</p>";
        
        if (hasDefect) {
            content += "<p class='certainty-medium'><strong>Éléments fournis :</strong> Les dysfonctionnements décrits peuvent potentiellement caractériser une certaine gravité, mais celle-ci doit être appréciée au cas par cas.</p>";
            content += "<p><strong>Pour établir la gravité, il conviendrait de :</strong></p>";
            content += "<ul>";
            content += "<li>Évaluer l'impact du défaut sur la sécurité du véhicule et de ses occupants ;</li>";
            content += "<li>Comparer le coût des réparations à la valeur du véhicule ;</li>";
            content += "<li>Vérifier si le véhicule peut encore être utilisé dans des conditions normales ;</li>";
            content += "<li>Évaluer la dépréciation de la valeur vénale du bien.</li>";
            content += "</ul>";
            content += "<p><strong>Référence jurisprudentielle :</strong> Cass. civ. 1ère, 17 janvier 2006, n° 03-15.694 - La gravité s'apprécie in concreto, au regard de l'usage attendu par l'acquéreur.</p>";
            content += "<div class='verification-needed'><strong>À vérifier :</strong> La gravité doit être appréciée au regard des circonstances spécifiques et, le cas échéant, d'une expertise technique.</div>";
        } else {
            content += "<p class='certainty-low'>Aucun élément permettant d'établir la gravité d'un défaut n'est fourni à ce stade.</p>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>Conclusion sur les critères :</strong> La réunion des trois critères cumulatifs ne peut être définitivement établie sur la base des seuls éléments fournis. Une expertise technique contradictoire et l'examen approfondi des documents contractuels sont nécessaires pour caractériser avec certitude la responsabilité du vendeur.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION IV - GARANTIES
    // ============================================================
    
    function generateGarantiesAnalysis(hasProfessional, hasWarranty) {
        let content = "<p><strong>Objet :</strong> Présentation des régimes de garantie potentiellement applicables, selon la qualification des parties.</p>";
        
        content += "<p>Les régimes de garantie applicables dépendent de la qualité du vendeur (professionnel ou particulier) et des circonstances de la vente. Les informations ci-dessous sont présentées à titre informatif.</p>";
        
        if (hasProfessional) {
            content += "<h4>A. Garantie légale de conformité (vendeur professionnel)</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur professionnel est tenu de délivrer un bien conforme au contrat.</p>";
            content += "<p><strong>Conditions :</strong></p>";
            content += "<ul>";
            content += "<li>Le bien doit être conforme aux qualités présentées par le vendeur ;</li>";
            content += "<li>Le bien doit être propre à l'usage habituellement attendu ;</li>";
            content += "<li>Le bien doit présenter les qualités que l'acquéreur peut légitimement attendre.</li>";
            content += "</ul>";
            content += "<p><strong>Régime :</strong></p>";
            content += "<ul>";
            content += "<li>Délai d'action : deux ans à compter de la délivrance ;</li>";
            content += "<li>Présomption d'antériorité si le défaut se manifeste dans les six mois ;</li>";
            content += "<li>Options : réparation, remplacement, réduction du prix ou résolution de la vente.</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 17 mai 2011, n° 10-14.479 - La garantie légale de conformité est d'ordre public.</p>";
            
            content += "<h4>B. Garantie légale de délivrance conforme</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur est tenu de délivrer un bien exempt de tout défaut de conformité existant au moment de la délivrance.</p>";
            content += "<p>Le vendeur professionnel est présumé connaître les défauts du bien qu'il commercialise, ce qui renverse la charge de la preuve à son encontre.</p>";
            
            content += "<h4>C. Obligation de résultat du vendeur professionnel</h4>";
            content += "<p><strong>Fondement :</strong> Le vendeur professionnel est tenu à une obligation de résultat concernant la conformité du bien vendu.</p>";
            content += "<ul>";
            content += "<li>Responsabilité de plein droit en cas de défaut ;</li>";
            content += "<li>Exonération possible uniquement par preuve d'une cause étrangère ;</li>";
            content += "<li>Clauses d'exonération réputées non écrites.</li>";
            content += "</ul>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 26 mai 2011, n° 10-13.847.</p>";
            
            content += "<h4>D. Obligation d'information renforcée</h4>";
            content += "<p>Le vendeur professionnel automobile est tenu d'une obligation d'information et de conseil renforcée. Il doit révéler à l'acquéreur tout défaut connu ou décelable du véhicule.</p>";
            content += "<p><strong>Référence :</strong> Cass. civ. 1ère, 3 mars 2011, n° 10-10.315.</p>";
        }
        
        if (hasWarranty) {
            content += "<h4>E. Garantie commerciale contractuelle</h4>";
            content += "<p>Si une garantie commerciale a été souscrite, ses conditions spécifiques (durée, étendue, exclusions) doivent être examinées dans le contrat. Cette garantie s'ajoute aux garanties légales sans s'y substituer.</p>";
        }
        
        content += "<div class='verification-needed'>";
        content += "<strong>À vérifier :</strong> Le régime applicable dépend de la qualification exacte du vendeur et des circonstances de la vente. Il convient de consulter un professionnel du droit pour déterminer le régime le plus favorable.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION V - ANALYSE DOCUMENTAIRE
    // ============================================================
    
    function generateDocumentaireAnalysis(hasInvoice, hasRepair, hasControlTech) {
        let content = "<p><strong>Objet :</strong> Analyse des documents mentionnés et identification des documents manquants potentiellement utiles.</p>";
        
        content += "<h4>A. Documents mentionnés dans les éléments fournis</h4>";
        content += "<ul>";
        
        if (hasInvoice) {
            content += "<li><strong>Facture de vente :</strong> mentionnée. Ce document est essentiel car il fixe les obligations du vendeur et décrit le bien vendu. Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La description exacte du véhicule ;</li>";
            content += "<li>Les éventuelles clauses d'exonération (susceptibles d'être réputées non écrites si abusives) ;</li>";
            content += "<li>L'absence de mention de défauts ;</li>";
            content += "<li>La date de vente (pour le calcul des délais de garantie).</li>";
            content += "</ul>";
        }
        
        if (hasRepair) {
            content += "<li><strong>Ordre de réparation :</strong> mentionné. Ce document permet de retracer l'historique des interventions. Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La chronologie des défaillances ;</li>";
            content += "<li>La nature des réparations effectuées ;</li>";
            content += "<li>Le coût des interventions ;</li>";
            content += "<li>La récurrence éventuelle des mêmes dysfonctionnements.</li>";
            content += "</ul>";
        }
        
        if (hasControlTech) {
            content += "<li><strong>Contrôle technique :</strong> mentionné. Ce document officiel permet d'identifier les défauts constatés. Il convient de vérifier :</li>";
            content += "<ul>";
            content += "<li>La date du contrôle ;</li>";
            content += "<li>Les défauts mentionnés et leur gravité ;</li>";
            content += "<li>L'absence de mention de certains défauts (pouvant caractériser une insuffisance du diagnostic).</li>";
            content += "</ul>";
        }
        
        if (!hasInvoice && !hasRepair && !hasControlTech) {
            content += "<li>Aucun document spécifique n'est mentionné dans les éléments fournis.</li>";
        }
        
        content += "</ul>";
        
        content += "<h4>B. Documents potentiellement utiles non mentionnés</h4>";
        content += "<p>Selon la situation, les documents suivants peuvent s'avérer utiles et devraient être recherchés :</p>";
        content += "<ul>";
        content += "<li><strong>Bon de commande :</strong> fixe les engagements du vendeur ;</li>";
        content += "<li><strong>État descriptif du véhicule à l'entrée en atelier :</strong> permet de justifier de l'état initial ;</li>";
        content += "<li><strong>État descriptif à la sortie :</strong> permet de vérifier la conformité des réparations ;</li>";
        content += "<li><strong>Historique complet d'entretien :</strong> permet de vérifier le respect des préconisations constructeur ;</li>";
        content += "<li><strong>Diagnostic technique préalable à la vente :</strong> permet d'établir ce que le vendeur savait ou aurait dû savoir ;</li>";
        content += "<li><strong>Fiche d'entretien du véhicule :</strong> permet de vérifier le suivi de l'entretien ;</li>";
        content += "<li><strong>Certificat de réalisation des campagnes de rappel :</strong> permet de vérifier si les rappels ont été effectués ;</li>";
        content += "<li><strong>Correspondances avec le vendeur :</strong> courriers, emails, preuves de réclamations ;</li>";
        content += "<li><strong>Devis de réparation :</strong> permet d'évaluer le coût des réparations.</li>";
        content += "</ul>";
        
        content += "<h4>C. Conséquences probatoires</h4>";
        content += "<p>L'absence de certains documents peut :</p>";
        content += "<ul>";
        content += "<li>Caractériser un manquement du professionnel à ses obligations de traçabilité ;</li>";
        content += "<li>Constituer des présomptions de faute ;</li>";
        content += "<li>Rendre plus difficile l'établissement de certains faits.</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>Recommandation :</strong> Il convient de réunir l'ensemble des documents disponibles et de rechercher les documents manquants auprès du vendeur ou des organismes compétents.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION VI - RAPPELS
    // ============================================================
    
    function generateRappelsAnalysis(rappelsData, vehicleData) {
        let content = "<p><strong>Objet :</strong> Identification des campagnes de rappel constructeur et problèmes récurrents documentés, potentiellement applicables au véhicule concerné.</p>";
        
        content += "<p>L'analyse croisée des informations fournies avec la base de données des campagnes de rappel documentées permet d'identifier des éléments potentiellement pertinents. Ces informations sont présentées à titre indicatif et doivent être vérifiées.</p>";
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>A. Campagnes de rappel constructeur identifiées</h4>";
            content += "<p>Les campagnes de rappel suivantes ont été identifiées pour un véhicule <strong>" + 
                (vehicleData.marque || 'non précisé') + " " + 
                (vehicleData.modele || '') + " (" + 
                (vehicleData.annee || 'année non précisée') + ")</strong> :</p>";
            
            rappelsData.rappelsTrouves.forEach((rappel) => {
                const classeCSS = rappel.severite === 'critique' ? 'rappel-critical' : 
                                  rappel.severite === 'moyenne' ? 'rappel-info' : 'rappel-alert';
                const icone = rappel.severite === 'critique' ? '' : '🟡';
                
                content += "<div class='" + classeCSS + "'>";
                content += "<h4>" + icone + " " + rappel.probleme + " (" + rappel.annees + ")</h4>";
                content += "<p><strong>Modèles concernés :</strong> " + rappel.modele + "</p>";
                content += "<p><strong>Description technique documentée :</strong> " + rappel.description + "</p>";
                content += "<p><strong>Référence :</strong> " + rappel.reference + "</p>";
                content += "<p><strong>Constructeur :</strong> " + rappel.constructeur + "</p>";
                content += "</div>";
            });
        }
        
        if (rappelsData.problemesTransversaux.length > 0) {
            content += "<h4>B. Problèmes transversaux documentés</h4>";
            content += "<p>Les problèmes suivants concernent de nombreux constructeurs et font l'objet d'actions collectives documentées :</p>";
            
            rappelsData.problemesTransversaux.forEach(probleme => {
                const classeCSS = probleme.severite === 'critique' ? 'rappel-critical' : 'rappel-alert';
                
                content += "<div class='" + classeCSS + "'>";
                content += "<h4>⚠️ " + probleme.nom + " (" + probleme.annees + ")</h4>";
                content += "<p><strong>Description :</strong> " + probleme.description + "</p>";
                content += "<p><strong>Marques concernées :</strong> " + probleme.marques.join(', ') + "</p>";
                content += "<p><strong>Référence :</strong> " + probleme.reference + "</p>";
                content += "</div>";
            });
        }
        
        content += "<h4>C. Interprétation juridique potentielle</h4>";
        content += "<p><strong>Sous réserve de vérification</strong>, l'existence de campagnes de rappel et de problèmes récurrents documentés peut, le cas échéant :</p>";
        content += "<ul>";
        content += "<li>Établir que le constructeur avait connaissance du défaut, ce qui peut caractériser la faute du vendeur professionnel qui n'a pas informé l'acquéreur ;</li>";
        content += "<li>Renforcer la démonstration du caractère caché du défaut, les défauts faisant l'objet de rappels étant par nature difficiles à détecter ;</li>";
        content += "<li>Caractériser la gravité du défaut pour les rappels de sécurité ;</li>";
        content += "<li>Caractériser un défaut de conception engageant la responsabilité du constructeur ;</li>";
        content += "<li>Caractériser un manquement du vendeur à son obligation d'information s'il n'a pas vérifié les rappels en cours.</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>️ Important :</strong> La simple existence d'une campagne de rappel ne caractérise pas automatiquement la responsabilité du vendeur dans le cas spécifique. Il convient de vérifier :";
        content += "<ul>";
        content += "<li>Si le véhicule concerné est effectivement visé par le rappel (vérification par VIN) ;</li>";
        content += "<li>Si le rappel a été réalisé ou non ;</li>";
        content += "<li>Si le vendeur avait connaissance du rappel ;</li>";
        content += "<li>Si le défaut constaté correspond bien au défaut objet du rappel.</li>";
        content += "</ul>";
        content += "</div>";
        
        if (rappelsData.recommandations.length > 0) {
            content += "<h4>D. Recommandations de vérification</h4>";
            content += "<ul>";
            rappelsData.recommandations.forEach(rec => {
                content += "<li>" + rec + "</li>";
            });
            content += "</ul>";
        }
        
        return content;
    }

    // ============================================================
    // SECTION VII - JURISPRUDENCE
    // ============================================================
    
    function generateJurisprudenceAnalysis() {
        let content = "<p><strong>Objet :</strong> Présentation de la jurisprudence de référence potentiellement applicable.</p>";
        
        content += "<p>Les arrêts ci-dessous sont présentés à titre de référence. Leur applicabilité au cas spécifique dépend des circonstances exactes de l'affaire et doit être appréciée par un professionnel du droit.</p>";
        
        content += "<h4>A. Garantie légale de conformité</h4>";
        content += "<p><strong>Cass. civ. 1ère, 17 mai 2011, n° 10-14.479</strong></p>";
        content += "<p><strong>Principe :</strong> La garantie légale de conformité est d'ordre public et ne peut être écartée par stipulation contractuelle. Le vendeur professionnel est tenu de délivrer un bien conforme.</p>";
        
        content += "<h4>B. Obligation d'information du vendeur professionnel</h4>";
        content += "<p><strong>Cass. civ. 1ère, 3 mars 2011, n° 10-10.315</strong></p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel automobile est tenu d'une obligation d'information renforcée et doit révéler à l'acquéreur tout défaut connu ou décelable du véhicule.</p>";
        
        content += "<h4>C. Obligation de résultat du vendeur</h4>";
        content += "<p><strong>Cass. civ. 1ère, 26 mai 2011, n° 10-13.847</strong></p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel est tenu d'une obligation de résultat en ce qui concerne la conformité du bien vendu.</p>";
        
        content += "<h4>D. Caractère caché du défaut</h4>";
        content += "<p><strong>Cass. civ. 1ère, 3 mai 2006, n° 03-18.852</strong></p>";
        content += "<p><strong>Principe :</strong> Le caractère caché s'apprécie au regard des compétences de l'acquéreur. Un défaut est caché lorsqu'il ne peut être découvert que par un expert ou à l'occasion d'une utilisation prolongée.</p>";
        
        content += "<h4>E. Gravité du défaut</h4>";
        content += "<p><strong>Cass. civ. 1ère, 17 janvier 2006, n° 03-15.694</strong></p>";
        content += "<p><strong>Principe :</strong> La gravité s'apprécie in concreto, au regard de l'usage attendu par l'acquéreur.</p>";
        
        content += "<h4>F. Résolution de la vente</h4>";
        content += "<p><strong>Cass. civ. 1ère, 14 décembre 2010, n° 09-69.614</strong></p>";
        content += "<p><strong>Principe :</strong> La résolution de la vente est admise lorsque le défaut de conformité est suffisamment grave pour que l'acquéreur n'aurait pas acquis le bien ou aurait payé un moindre prix.</p>";
        
        content += "<h4>G. Campagnes de rappel</h4>";
        content += "<p><strong>Cass. civ. 1ère, 12 juillet 2018, n° 17-17.485</strong></p>";
        content += "<p><strong>Principe :</strong> Le vendeur professionnel a l'obligation de vérifier si le véhicule a fait l'objet de campagnes de rappel et d'en informer l'acquéreur.</p>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>️ Important :</strong> La jurisprudence évolue constamment. Les arrêts cités sont présentés à titre de référence. Il convient de vérifier leur actualité et leur applicabilité au cas spécifique avec un professionnel du droit.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION VIII - ÉLÉMENTS À VÉRIFIER
    // ============================================================
    
    function generateVerificationNeeded(text, context, rappelsData) {
        let content = "<p><strong>Objet :</strong> Recensement des éléments nécessitant une vérification complémentaire pour étayer l'analyse.</p>";
        
        content += "<p>L'analyse présentée repose sur les éléments fournis par l'utilisateur. Les points suivants nécessitent une vérification complémentaire pour établir les faits de manière certaine :</p>";
        
        content += "<h4>A. Vérifications techniques</h4>";
        content += "<ul>";
        content += "<li><strong>Expertise technique contradictoire :</strong> faire réaliser une expertise par un expert agréé pour établir la nature, la cause et la date d'apparition des défauts ;</li>";
        content += "<li><strong>Vérification des rappels constructeur :</strong> consulter le site de la Sécurité Routière avec le numéro VIN pour vérifier les rappels en cours ;</li>";
        content += "<li><strong>Contrôle technique complémentaire :</strong> faire réaliser un contrôle technique pour établir l'état actuel du véhicule ;</li>";
        content += "<li><strong>Diagnostic électronique :</strong> faire réaliser un diagnostic complet par un professionnel agréé.</li>";
        content += "</ul>";
        
        content += "<h4>B. Vérifications documentaires</h4>";
        content += "<ul>";
        content += "<li><strong>Examen des documents contractuels :</strong> vérifier les clauses de la facture, du bon de commande, des conditions générales de vente ;</li>";
        content += "<li><strong>Historique du véhicule :</strong> obtenir l'historique complet auprès du constructeur ou d'un concessionnaire agréé ;</li>";
        content += "<li><strong>Vérification des garanties :</strong> vérifier les garanties légales et commerciales applicables ;</li>";
        content += "<li><strong>Recherche de jurisprudence actualisée :</strong> vérifier l'existence de décisions récentes sur des faits similaires.</li>";
        content += "</ul>";
        
        content += "<h4>C. Vérifications juridiques</h4>";
        content += "<ul>";
        content += "<li><strong>Qualification exacte du vendeur :</strong> vérifier s'il s'agit d'un professionnel ou d'un particulier ;</li>";
        content += "<li><strong>Date de vente :</strong> vérifier la date exacte pour le calcul des délais de garantie ;</li>";
        content += "<li><strong>Délais de prescription :</strong> vérifier que les actions envisagées ne sont pas prescrites ;</li>";
        content += "<li><strong>Compétence juridictionnelle :</strong> déterminer le tribunal compétent.</li>";
        content += "</ul>";
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>D. Vérifications spécifiques aux rappels identifiés</h4>";
            content += "<ul>";
            content += "<li>Vérifier par VIN si le véhicule est effectivement concerné par les rappels identifiés ;</li>";
            content += "<li>Vérifier si les opérations de rappel ont été réalisées ;</li>";
            content += "<li>Demander au vendeur la preuve de réalisation des rappels ;</li>";
            content += "<li>Vérifier si le défaut constaté correspond au défaut objet du rappel.</li>";
            content += "</ul>";
        }
        
        content += "<div class='certainty-low'>";
        content += "<strong>⚠️ Limite de l'analyse :</strong> La présente analyse ne se substitue pas à une expertise technique contradictoire ni à l'avis d'un professionnel du droit. Les conclusions présentées sont formulées de manière prudente et doivent être vérifiées.";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION IX - VOIES D'ACTION
    // ============================================================
    
    function generateVoiesAction(hasProfessional, rappelsData) {
        let content = "<p><strong>Objet :</strong> Présentation des voies d'action potentiellement envisageables, selon la qualification de la situation.</p>";
        
        content += "<p>Les voies d'action ci-dessous sont présentées à titre informatif. Leur opportunité et leur faisabilité dépendent des circonstances spécifiques de l'affaire et doivent être appréciées avec un professionnel du droit.</p>";
        
        content += "<h4>A. Actions envisageables contre le vendeur</h4>";
        content += "<ul>";
        content += "<li><strong>Action en garantie légale de conformité</strong> (si vendeur professionnel) : réparation, remplacement, réduction du prix ou résolution de la vente ;</li>";
        content += "<li><strong>Action en résolution de la vente</strong> : remboursement intégral du prix avec restitution du véhicule ;</li>";
        content += "<li><strong>Action en réduction du prix</strong> : remboursement partiel proportionnel à la dépréciation ;</li>";
        content += "<li><strong>Action en dommages et intérêts</strong> : réparation du préjudice subi (frais de réparation, perte de valeur, préjudice moral) ;</li>";
        content += "<li><strong>Action en nullité pour dol</strong> : en cas de dissimulation intentionnelle du défaut ;</li>";
        content += "<li><strong>Action en garantie des vices cachés</strong> (Code civil, articles 1641 et suivants) : résolution de la vente ou réduction du prix.</li>";
        content += "</ul>";
        
        if (hasProfessional) {
            content += "<h4>B. Actions spécifiques contre un vendeur professionnel</h4>";
            content += "<ul>";
            content += "<li><strong>Signalement à la DGCCRF</strong> : en cas de pratiques commerciales trompeuses ;</li>";
            content += "<li><strong>Action en réparation pour manquement à l'obligation d'information</strong> ;</li>";
            content += "<li><strong>Action pour clause abusive</strong> : en cas de clauses d'exonération illégales.</li>";
            content += "</ul>";
        }
        
        if (rappelsData.rappelsTrouves.length > 0) {
            content += "<h4>C. Actions spécifiques liées aux rappels identifiés</h4>";
            content += "<ul>";
            content += "<li><strong>Action contre le constructeur</strong> : en cas de défaut de conception, action pour responsabilité du fait des produits défectueux ;</li>";
            content += "<li><strong>Rejoindre une action collective</strong> : si une action collective est en cours pour le défaut identifié ;</li>";
            content += "<li><strong>Signalement à l'ANSM</strong> : en cas de problème de sécurité.</li>";
            content += "</ul>";
        }
        
        content += "<h4>D. Démarches préalables recommandées</h4>";
        content += "<ul>";
        content += "<li><strong>Mise en demeure formelle</strong> : adresser une lettre recommandée avec accusé de réception au vendeur, précisant les griefs et les demandes ;</li>";
        content += "<li><strong>Tentative de conciliation</strong> : saisir un conciliateur de justice (gratuit) ;</li>";
        content += "<li><strong>Médiation</strong> : saisir un médiateur de la consommation ;</li>";
        content += "<li><strong>Expertise amiable</strong> : faire réaliser une expertise contradictoire avant toute action contentieuse.</li>";
        content += "</ul>";
        
        content += "<div class='verification-needed'>";
        content += "<strong>⚠️ Important :</strong> Avant d'engager toute action, il convient de :";
        content += "<ul>";
        content += "<li>Vérifier les délais de prescription applicables ;</li>";
        content += "<li>Évaluer le rapport coût/bénéfice de l'action envisagée ;</li>";
        content += "<li>Consulter un professionnel du droit pour apprécier l'opportunité de l'action ;</li>";
        content += "<li>Réunir l'ensemble des preuves disponibles.</li>";
        content += "</ul>";
        content += "</div>";
        
        return content;
    }

    // ============================================================
    // SECTION X - CONCLUSION
    // ============================================================
    
    function generateConclusion(objective, rappelsData) {
        let content = "<p><strong>Objet :</strong> Synthèse de l'analyse et recommandations.</p>";
        
        content += "<h4>A. Synthèse</h4>";
        content += "<p>La présente analyse a été réalisée sur la base des éléments fournis par l'utilisateur. Elle met en évidence :</p>";
        content += "<ul>";
        content += "<li>Les éléments factuels décrits, qui n'ont pas été vérifiés ;</li>";
        content += "<li>Les qualifications juridiques potentiellement applicables, sous réserve de vérification ;</li>";
        content += "<li>Les régimes de garantie potentiellement invocables ;</li>";
        content += "<li>Les campagnes de rappel et problèmes récurrents documentés, le cas échéant ;</li>";
        content += "<li>Les éléments nécessitant une vérification complémentaire.</li>";
        content += "</ul>";
        
        content += "<h4>B. Limites de l'analyse</h4>";
        content += "<p>Il importe de souligner les limites de la présente analyse :</p>";
        content += "<ul>";
        content += "<li>Les éléments factuels n'ont pas été vérifiés par une expertise contradictoire ;</li>";
        content += "<li>La qualification juridique définitive dépend de circonstances non entièrement établies ;</li>";
        content += "<li>La jurisprudence évolue constamment et doit être actualisée ;</li>";
        content += "<li>Les délais de prescription doivent être vérifiés au cas par cas ;</li>";
        content += "<li>L'analyse ne se substitue pas à l'avis d'un professionnel du droit.</li>";
        content += "</ul>";
        
        content += "<h4>C. Recommandations</h4>";
        content += "<p>Selon les éléments fournis et l'objectif recherché" + (objective ? " (" + objective + ")" : "") + ", il est recommandé de :</p>";
        content += "<ul>";
        content += "<li><strong>Constituer un dossier complet</strong> réunissant tous les documents disponibles ;</li>";
        content += "<li><strong>Faire réaliser une expertise technique contradictoire</strong> par un expert agréé ;</li>";
        content += "<li><strong>Vérifier les campagnes de rappel</strong> sur le site de la Sécurité Routière avec le numéro VIN ;</li>";
        content += "<li><strong>Adresser une mise en demeure formelle</strong> au vendeur par lettre recommandée avec accusé de réception ;</li>";
        content += "<li><strong>Envisager une conciliation ou médiation</strong> avant toute action contentieuse ;</li>";
        content += "<li><strong>Conserver précieusement toutes les pièces originales</strong> ;</li>";
        content += "<li><strong>Consulter un avocat spécialisé</strong> en droit de la consommation ou droit automobile ;</li>";
        content += "<li><strong>Vérifier les délais de prescription</strong> avant d'engager toute action.</li>";
        content += "</ul>";
        
        if (rappelsData.rappelsTrouves.length > 0 || rappelsData.problemesTransversaux.length > 0) {
            content += "<h4>D. Recommandations spécifiques liées aux rappels</h4>";
            content += "<ul>";
            content += "<li>Vérifier par VIN si le véhicule est concerné par les rappels identifiés ;</li>";
            content += "<li>Demander au vendeur la preuve de réalisation des rappels ;</li>";
            content += "<li>Se renseigner sur l'existence d'actions collectives en cours ;</li>";
            content += "<li>Envisager de rejoindre une action collective si elle existe.</li>";
            content += "</ul>";
        }
        
        content += "<h4>E. Conclusion</h4>";
        content += "<p>La présente analyse constitue une aide à la rédaction et à la réflexion. Elle ne constitue pas un conseil juridique et ne se substitue pas à l'avis d'un professionnel du droit. Les conclusions présentées sont formulées de manière prudente et doivent être vérifiées au regard des circonstances spécifiques de l'affaire.</p>";
        content += "<p>Il est recommandé d'engager rapidement les démarches préconisées, dans le respect des délais de prescription, afin de préserver les droits de l'intéressé.</p>";
        
        content += "<div class='certainty-low'>";
        content += "<strong>⚠️ Avertissement final :</strong> Cette analyse est générée automatiquement à partir des éléments fournis par l'utilisateur. Elle ne constitue pas un avis juridique et ne garantit pas le succès d'une action en justice. Seul un professionnel du droit, après examen approfondi du dossier, peut fournir un conseil juridique adapté à la situation spécifique.";
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

        console.log('✅ Analyse affichée avec succès');
    }

    // ============================================================
    // GÉNÉRATION PDF
    // ============================================================
    
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', function() {
            if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
                alert('⚠️ La bibliothèque PDF n\'est pas chargée. Vérifiez votre connexion internet.');
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
            doc.text('Avertissement : Ce rapport est généré automatiquement à partir des éléments fournis par l\'utilisateur.', margin, yPosition);
            yPosition += 4;
            doc.text('Il ne constitue pas un conseil juridique et ne se substitue pas à l\'avis d\'un professionnel du droit.', margin, yPosition);
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
                doc.text('Page ' + i + ' / ' + pageCount + ' - Aide Rédactionnelle - Document non contractuel', pageWidth / 2, 290, { align: 'center' });
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
                    alert('⚠️ Impossible de copier. Veuillez sélectionner et copier manuellement.');
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
            .catch(err => console.log('️ Service Worker:', err));
    }
});
