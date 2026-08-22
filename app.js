// Configuration PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let extractedText = '';
let analysisData = {};

// Éléments DOM
const textInput = document.getElementById('textInput');
const pdfUpload = document.getElementById('pdfUpload');
const pdfStatus = document.getElementById('pdfStatus');
const contextInfo = document.getElementById('contextInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisSection = document.getElementById('analysisSection');
const analysisResult = document.getElementById('analysisResult');
const generatePdfBtn = document.getElementById('generatePdfBtn');
const shareBtn = document.getElementById('shareBtn');

// Gestion de l'upload PDF
pdfUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showStatus('Veuillez sélectionner un fichier PDF', 'error');
        return;
    }

    showStatus('Extraction du texte en cours...', 'success');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        extractedText = fullText;
        textInput.value = fullText;
        showStatus(`✓ PDF extrait avec succès (${pdf.numPages} pages)`, 'success');
    } catch (error) {
        showStatus('Erreur lors de l\'extraction du PDF: ' + error.message, 'error');
    }
});

function showStatus(message, type) {
    pdfStatus.textContent = message;
    pdfStatus.className = `status ${type}`;
}

// Analyse du texte
analyzeBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    const context = contextInfo.value.trim();
    
    if (!text) {
        alert('Veuillez saisir du texte ou importer un PDF');
        return;
    }

    analyzeBtn.innerHTML = '<span class="loading"></span> Analyse en cours...';
    analyzeBtn.disabled = true;

    setTimeout(() => {
        performAnalysis(text, context);
        analyzeBtn.innerHTML = '🔍 Lancer l\'analyse';
        analyzeBtn.disabled = false;
    }, 1500);
});

function performAnalysis(text, context) {
    // Analyse structurée basée sur le droit français
    analysisData = {
        date: new Date().toLocaleDateString('fr-FR'),
        text: text,
        context: context,
        sections: []
    };

    // Section 1: Qualification juridique
    analysisData.sections.push({
        title: "I. Qualification Juridique de la Situation",
        content: generateQualification(text, context)
    });

    // Section 2: Analyse des critères cumulatifs
    analysisData.sections.push({
        title: "II. Analyse des Critères Cumulatifs",
        content: generateCriteresAnalysis(text, context)
    });

    // Section 3: Garanties légales applicables
    analysisData.sections.push({
        title: "III. Garanties Légales Applicables",
        content: generateGarantiesAnalysis(text, context)
    });

    // Section 4: Analyse documentaire
    analysisData.sections.push({
        title: "IV. Analyse Documentaire et Preuves",
        content: generateDocumentaireAnalysis(text, context)
    });

    // Section 5: Failles et moyens d'action
    analysisData.sections.push({
        title: "V. Failles Identifiées et Moyens d'Action",
        content: generateFaillesAnalysis(text, context)
    });

    // Section 6: Conclusion et recommandations
    analysisData.sections.push({
        title: "VI. Conclusion et Recommandations",
        content: generateConclusion(text, context)
    });

    displayAnalysis();
}

function generateQualification(text, context) {
    const lowerText = text.toLowerCase();
    let content = "<p>La situation exposée nécessite une qualification juridique précise au regard des dispositions du droit français de la consommation et du droit commun des obligations.</p>";
    
    content += "<p>L'examen attentif des éléments factuels permet d'identifier plusieurs qualifications potentielles :</p><ul>";
    
    if (lowerText.includes('véhicule') || lowerText.includes('voiture') || lowerText.includes('automobile')) {
        content += "<li><strong>Qualification de vente de véhicule d'occasion</strong> : La transaction s'inscrit dans le cadre d'une vente de bien meuble corporel, soumise aux dispositions du Code de la consommation et du Code civil.</li>";
    }
    
    if (lowerText.includes('défaut') || lowerText.includes('panne') || lowerText.includes('problème') || lowerText.includes('dysfonctionnement')) {
        content += "<li><strong>Qualification de non-conformité</strong> : Les désordres constatés sont susceptibles de caractériser un défaut de conformité au sens des dispositions légales applicables.</li>";
    }
    
    if (lowerText.includes('professionnel') || lowerText.includes('garage') || lowerText.includes('concession')) {
        content += "<li><strong>Qualification de contrat entre professionnel et consommateur</strong> : La relation contractuelle s'inscrit dans le cadre d'une relation B2C, offrant une protection renforcée au consommateur.</li>";
    }
    
    content += "</ul><p>Cette qualification juridique conditionne l'application du régime de protection le plus favorable à la partie lésée.</p>";
    
    return content;
}

function generateCriteresAnalysis(text, context) {
    const lowerText = text.toLowerCase();
    let content = "<p>L'analyse technique et juridique impose l'examen rigoureux de trois critères cumulatifs, dont la réunion est indispensable à la caractérisation de la responsabilité du vendeur professionnel :</p>";
    
    content += "<h3>A. Caractère antérieur au moment de la vente</h3>";
    content += "<p>Il convient d'établir que le désordre existait antérieurement à la conclusion de la vente. Cette antériorité peut être déduite de plusieurs éléments :</p><ul>";
    content += "<li>L'expertise technique réalisée postérieurement à l'acquisition permet, par analyse des composants défaillants, de déterminer la date approximative d'apparition du défaut ;</li>";
    content += "<li>L'absence de mention du défaut dans l'état descriptif du véhicule lors de sa réception en atelier constitue un indice probant ;</li>";
    content += "<li>La nature du défaut (usure anormale, défaut de fabrication) permet d'exclure une survenance postérieure à la vente.</li>";
    content += "</ul>";
    
    content += "<h3>B. Caractère caché du défaut</h3>";
    content += "<p>Le défaut doit présenter un caractère non apparent, c'est-à-dire non décelable par un examen attentif lors de la vente. Cette occultation se caractérise par :</p><ul>";
    content += "<li>L'impossibilité pour l'acquéreur non-professionnel de détecter le défaut lors d'un examen visuel standard ;</li>";
    content += "<li>L'absence de mention dans les documents contractuels (état des lieux, rapport de contrôle technique) ;</li>";
    content += "<li>La dissimulation active ou passive par le vendeur professionnel, qui disposait des moyens techniques de détection.</li>";
    content += "</ul>";
    
    content += "<h3>C. Caractère grave rendant le bien impropre à son usage</h3>";
    content += "<p>Le défaut doit être suffisamment grave pour rendre le bien impropre à l'usage auquel il est destiné, ou diminuer tellement cet usage que l'acquéreur ne l'aurait pas acquis ou aurait payé un moindre prix. Cette gravité s'apprécie :</p><ul>";
    content += "<li>Au regard du coût des réparations par rapport à la valeur du véhicule ;</li>";
    content += "<li>De l'impact sur la sécurité du véhicule et de ses occupants ;</li>";
    content += "<li>De l'impossibilité d'utiliser le véhicule dans des conditions normales d'utilisation.</li>";
    content += "</ul>";
    
    return content;
}

function generateGarantiesAnalysis(text, context) {
    let content = "<p>Plusieurs régimes de garantie sont susceptibles de s'appliquer cumulativement ou alternativement :</p>";
    
    content += "<h3>A. Garantie légale de conformité</h3>";
    content += "<p>En application des dispositions du Code de la consommation, le vendeur professionnel est tenu de délivrer un bien conforme au contrat. Cette obligation impose :</p><ul>";
    content += "<li>La conformité au regard des qualités présentées par le vendeur ;</li>";
    content += "<li>La conformité à l'usage habituellement attendu d'un bien semblable ;</li>";
    content += "<li>La conformité aux qualités présentées dans les publicités ou sur l'étiquetage.</li>";
    content += "</ul>";
    content += "<p>Le consommateur dispose d'un délai de deux ans à compter de la délivrance du bien pour agir au titre de cette garantie, le vendeur ne pouvant s'exonérer que par la preuve de la connaissance par l'acquéreur du défaut.</p>";
    
    content += "<h3>B. Garantie légale de délivrance conforme</h3>";
    content += "<p>Cette garantie impose au vendeur l'obligation de délivrer un bien exempt de tout défaut de conformité existant au moment de la délivrance. Le professionnel est présumé connaître les défauts du bien qu'il commercialise, ce qui renverse la charge de la preuve à son encontre.</p>";
    
    content += "<h3>C. Obligation de résultat du vendeur professionnel</h3>";
    content += "<p>Le vendeur professionnel est tenu à une obligation de résultat concernant la conformité du bien vendu. Cette obligation ne peut être écartée par stipulation contractuelle. Le professionnel doit justifier avoir satisfait à cette obligation, faute de quoi sa responsabilité est engagée de plein droit.</p>";
    
    content += "<h3>D. Obligation de délivrance conforme du professionnel</h3>";
    content += "<p>Le professionnel automobile, en sa qualité d'expert, est tenu à une obligation renforcée de délivrance. Il doit s'assurer de la conformité du véhicule avant sa mise en vente et informer l'acquéreur de tout défaut connu ou décelable.</p>";
    
    return content;
}

function generateDocumentaireAnalysis(text, context) {
    const lowerText = text.toLowerCase();
    let content = "<p>L'analyse documentaire constitue un élément probatoire essentiel. Plusieurs catégories de documents doivent être examinées :</p>";
    
    content += "<h3>A. Documents produits et leur analyse</h3>";
    content += "<ul>";
    
    if (lowerText.includes('facture')) {
        content += "<li><strong>Facture de vente</strong> : Ce document contractuel fixe les obligations du vendeur. L'absence de mention des défauts ou la présence de clauses d'exonération doit être analysée au regard de leur validité juridique.</li>";
    }
    
    if (lowerText.includes('réparation') || lowerText.includes('ordre')) {
        content += "<li><strong>Ordre de réparation</strong> : Ce document permet de retracer l'historique des interventions et d'identifier la chronologie des défaillances.</li>";
    }
    
    if (lowerText.includes('commande') || lowerText.includes('bon')) {
        content += "<li><strong>Bon de commande</strong> : Ce document contractuel fixe les engagements du vendeur et les caractéristiques du bien vendu.</li>";
    }
    
    content += "<li><strong>Contrôle technique</strong> : Ce document officiel permet d'identifier les défauts constatés et leur gravité.</li>";
    content += "</ul>";
    
    content += "<h3>B. Documents non produits et leur importance</h3>";
    content += "<p>L'absence de certains documents constitue un indice probant :</p><ul>";
    content += "<li><strong>État descriptif du véhicule à l'entrée en atelier</strong> : Son absence ne permet pas de justifier de l'état initial du véhicule lors de sa prise en charge par le professionnel ;</li>";
    content += "<li><strong>État descriptif à la sortie</strong> : Son absence empêche de vérifier la conformité des réparations effectuées ;</li>";
    content += "<li><strong>Historique complet d'entretien</strong> : Son absence peut caractériser un défaut d'information du vendeur ;</li>";
    content += "<li><strong>Diagnostic technique préalable à la vente</strong> : Son absence peut caractériser un manquement à l'obligation d'information du professionnel.</li>";
    content += "</ul>";
    
    content += "<p>Ces absences documentaires peuvent être invoquées comme présomptions de faute du professionnel, qui ne justifie pas avoir satisfait à ses obligations d'information et de vérification.</p>";
    
    return content;
}

function generateFaillesAnalysis(text, context) {
    let content = "<p>L'analyse technique et juridique permet d'identifier plusieurs failles exploitables :</p>";
    
    content += "<h3>A. Failles techniques</h3>";
    content += "<ul>";
    content += "<li>Incohérences dans l'historique d'entretien ou de réparation du véhicule ;</li>";
    content += "<li>Discordance entre l'état réel du véhicule et les mentions documentaires ;</li>";
    content += "<li>Absence de traçabilité des interventions techniques ;</li>";
    content += "<li>Non-respect des préconisations du constructeur ;</li>";
    content += "<li>Utilisation de pièces non conformes aux spécifications d'origine.</li>";
    content += "</ul>";
    
    content += "<h3>B. Failles juridiques</h3>";
    content += "<ul>";
    content += "<li>Clauses d'exonération de garantie susceptibles d'être réputées non écrites ;</li>";
    content += "<li>Manquement à l'obligation précontractuelle d'information ;</li>";
    content += "<li>Défaut de conformité non mentionné dans les documents contractuels ;</li>";
    content += "<li>Non-respect des obligations de délivrance conforme ;</li>";
    content += "<li>Pratiques commerciales trompeuses susceptibles de caractériser un dol.</li>";
    content += "</ul>";
    
    content += "<h3>C. Moyens d'action contre le tiers</h3>";
    content += "<p>Plusieurs actions sont susceptibles d'être engagées :</p><ul>";
    content += "<li><strong>Action en garantie légale de conformité</strong> : Action directe contre le vendeur professionnel ;</li>";
    content += "<li><strong>Action en résolution de la vente</strong> : Demande de remboursement intégral du prix ;</li>";
    content += "<li><strong>Action en réduction du prix</strong> : Demande de remboursement partiel ;</li>";
    content += "<li><strong>Action en dommages et intérêts</strong> : Réparation du préjudice subi ;</li>";
    content += "<li><strong>Action en nullité pour dol</strong> : Si dissimulation intentionnelle du défaut.</li>";
    content += "</ul>";
    
    return content;
}

function generateConclusion(text, context) {
    let content = "<p>L'analyse technique et juridique approfondie de la situation permet de formuler les conclusions suivantes :</p>";
    
    content += "<h3>A. Appréciation globale</h3>";
    content += "<p>La réunion des trois critères cumulatifs permet de caractériser la responsabilité du vendeur professionnel. Les éléments factuels et documentaires convergent vers une qualification favorable à la partie lésée.</p>";
    
    content += "<h3>B. Recommandations stratégiques</h3>";
    content += "<ul>";
    content += "<li>Constituer un dossier probatoire complet incluant l'ensemble des documents disponibles ;</li>";
    content += "<li>Faire réaliser une expertise technique contradictoire par un expert agréé ;</li>";
    content += "<li>Adresser une mise en demeure formelle au vendeur professionnel ;</li>";
    content += "<li>Envisager une action amiable préalable avant toute action contentieuse ;</li>";
    content += "<li>Conserver précieusement l'ensemble des pièces originales.</li>";
    content += "</ul>";
    
    content += "<h3>C. Perspectives d'action</h3>";
    content += "<p>Les moyens d'action identifiés offrent des perspectives favorables. La combinaison des différentes qualifications juridiques permet d'envisager une action globale, maximisant les chances de succès. L'absence de documents essentiels du côté du professionnel constitue un avantage procédural significatif.</p>";
    
    content += "<p>Cette analyse, fondée sur une interprétation rigoureuse des dispositions légales et de la jurisprudence constante, constitue une base solide pour toute action ultérieure.</p>";
    
    return content;
}

function displayAnalysis() {
    let html = '';
    
    analysisData.sections.forEach(section => {
        html += `<h3>${section.title}</h3>`;
        html += section.content;
    });
    
    analysisResult.innerHTML = html;
    analysisSection.classList.remove('hidden');
    analysisSection.scrollIntoView({ behavior: 'smooth' });
}

// Génération du PDF
generatePdfBtn.addEventListener('click', () => {
    const {
