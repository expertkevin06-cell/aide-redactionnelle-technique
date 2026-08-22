// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    
    // Configuration PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

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

    console.log('✅ Application chargée avec succès');

    // Gestion de l'upload PDF
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

    // Gestion du bouton Analyse
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', function() {
            console.log(' Bouton analyse cliqué');
            
            const text = textInput ? textInput.value.trim() : '';
            const context = contextInfo ? contextInfo.value.trim() : '';

            if (!text) {
                alert('⚠️ Veuillez saisir du texte ou importer un PDF');
                return;
            }

            analyzeBtn.innerHTML = '⏳ Analyse en cours...';
            analyzeBtn.disabled = true;

            setTimeout(() => {
                performAnalysis(text, context);
                analyzeBtn.innerHTML = ' Lancer l\'analyse';
                analyzeBtn.disabled = false;
            }, 1000);
        });
    }

    function performAnalysis(text, context) {
        console.log(' Analyse démarrée');
        
        analysisData = {
            date: new Date().toLocaleDateString('fr-FR'),
            text: text.substring(0, 500),
            context: context,
            sections: []
        };

        analysisData.sections.push({
            title: "I. Qualification Juridique de la Situation",
            content: generateQualification(text, context)
        });

        analysisData.sections.push({
            title: "II. Analyse des Critères Cumulatifs",
            content: generateCriteresAnalysis(text, context)
        });

        analysisData.sections.push({
            title: "III. Garanties Légales Applicables",
            content: generateGarantiesAnalysis(text, context)
        });

        analysisData.sections.push({
            title: "IV. Analyse Documentaire et Preuves",
            content: generateDocumentaireAnalysis(text, context)
        });

        analysisData.sections.push({
            title: "V. Failles Identifiées et Moyens d'Action",
            content: generateFaillesAnalysis(text, context)
        });

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

        if (lowerText.includes('défaut') || lowerText.includes('panne') || lowerText.includes('problème')) {
            content += "<li><strong>Qualification de non-conformité</strong> : Les désordres constatés sont susceptibles de caractériser un défaut de conformité.</li>";
        }

        if (lowerText.includes('professionnel') || lowerText.includes('garage') || lowerText.includes('concession')) {
            content += "<li><strong>Qualification de contrat entre professionnel et consommateur</strong> : Relation B2C offrant une protection renforcée.</li>";
        }

        content += "</ul><p>Cette qualification juridique conditionne l'application du régime de protection le plus favorable à la partie lésée.</p>";

        return content;
    }

    function generateCriteresAnalysis(text, context) {
        let content = "<p>L'analyse technique et juridique impose l'examen rigoureux de trois critères cumulatifs :</p>";

        content += "<h3>A. Caractère antérieur au moment de la vente</h3>";
        content += "<p>Il convient d'établir que le désordre existait antérieurement à la conclusion de la vente :</p><ul>";
        content += "<li>L'expertise technique permet de déterminer la date approximative d'apparition du défaut ;</li>";
        content += "<li>L'absence de mention du défaut dans l'état descriptif constitue un indice probant ;</li>";
        content += "<li>La nature du défaut permet d'exclure une survenance postérieure à la vente.</li>";
        content += "</ul>";

        content += "<h3>B. Caractère caché du défaut</h3>";
        content += "<p>Le défaut doit présenter un caractère non apparent :</p><ul>";
        content += "<li>Impossibilité pour l'acquéreur non-professionnel de détecter le défaut ;</li>";
        content += "<li>Absence de mention dans les documents contractuels ;</li>";
        content += "<li>Dissimulation active ou passive par le vendeur professionnel.</li>";
        content += "</ul>";

        content += "<h3>C. Caractère grave rendant le bien impropre à son usage</h3>";
        content += "<p>Le défaut doit être suffisamment grave :</p><ul>";
        content += "<li>Coût des réparations par rapport à la valeur du véhicule ;</li>";
        content += "<li>Impact sur la sécurité du véhicule ;</li>";
        content += "<li>Impossibilité d'utiliser le véhicule normalement.</li>";
        content += "</ul>";

        return content;
    }

    function generateGarantiesAnalysis(text, context) {
        let content = "<p>Plusieurs régimes de garantie sont susceptibles de s'appliquer :</p>";

        content += "<h3>A. Garantie légale de conformité</h3>";
        content += "<p>Le vendeur professionnel est tenu de délivrer un bien conforme au contrat :</p><ul>";
        content += "<li>Conformité aux qualités présentées par le vendeur ;</li>";
        content += "<li>Conformité à l'usage habituellement attendu ;</li>";
        content += "<li>Délai de deux ans à compter de la délivrance.</li>";
        content += "</ul>";

        content += "<h3>B. Garantie légale de délivrance conforme</h3>";
        content += "<p>Cette garantie impose au vendeur l'obligation de délivrer un bien exempt de tout défaut de conformité existant au moment de la délivrance. Le professionnel est présumé connaître les défauts du bien.</p>";

        content += "<h3>C. Obligation de résultat du vendeur professionnel</h3>";
        content += "<p>Le vendeur professionnel est tenu à une obligation de résultat concernant la conformité du bien vendu. Cette obligation ne peut être écartée par stipulation contractuelle.</p>";

        content += "<h3>D. Obligation de délivrance conforme du professionnel</h3>";
        content += "<p>Le professionnel automobile est tenu à une obligation renforcée de délivrance. Il doit s'assurer de la conformité du véhicule avant sa mise en vente.</p>";

        return content;
    }

    function generateDocumentaireAnalysis(text, context) {
        const lowerText = text.toLowerCase();
        let content = "<p>L'analyse documentaire constitue un élément probatoire essentiel :</p>";

        content += "<h3>A. Documents produits et leur analyse</h3><ul>";

        if (lowerText.includes('facture')) {
            content += "<li><strong>Facture de vente</strong> : Document contractuel fixant les obligations du vendeur.</li>";
        }

        if (lowerText.includes('réparation') || lowerText.includes('ordre')) {
            content += "<li><strong>Ordre de réparation</strong> : Permet de retracer l'historique des interventions.</li>";
        }

        if (lowerText.includes('commande') || lowerText.includes('bon')) {
            content += "<li><strong>Bon de commande</strong> : Fixe les engagements du vendeur.</li>";
        }

        content += "<li><strong>Contrôle technique</strong> : Document officiel identifiant les défauts constatés.</li>";
        content += "</ul>";

        content += "<h3>B. Documents non produits et leur importance</h3>";
        content += "<p>L'absence de certains documents constitue un indice probant :</p><ul>";
        content += "<li><strong>État descriptif à l'entrée en atelier</strong> : Son absence ne permet pas de justifier de l'état initial ;</li>";
        content += "<li><strong>État descriptif à la sortie</strong> : Son absence empêche de vérifier la conformité des réparations ;</li>";
        content += "<li><strong>Historique complet d'entretien</strong> : Son absence caractérise un défaut d'information ;</li>";
        content += "<li><strong>Diagnostic technique préalable</strong> : Son absence caractérise un manquement à l'obligation d'information.</li>";
        content += "</ul>";

        content += "<p>Ces absences documentaires peuvent être invoquées comme présomptions de faute du professionnel.</p>";

        return content;
    }

    function generateFaillesAnalysis(text, context) {
        let content = "<p>L'analyse technique et juridique permet d'identifier plusieurs failles exploitables :</p>";

        content += "<h3>A. Failles techniques</h3><ul>";
        content += "<li>Incohérences dans l'historique d'entretien ;</li>";
        content += "<li>Discordance entre l'état réel et les mentions documentaires ;</li>";
        content += "<li>Absence de traçabilité des interventions techniques ;</li>";
        content += "<li>Non-respect des préconisations du constructeur ;</li>";
        content += "<li>Utilisation de pièces non conformes.</li>";
        content += "</ul>";

        content += "<h3>B. Failles juridiques</h3><ul>";
        content += "<li>Clauses d'exonération susceptibles d'être réputées non écrites ;</li>";
        content += "<li>Manquement à l'obligation précontractuelle d'information ;</li>";
        content += "<li>Défaut de conformité non mentionné ;</li>";
        content += "<li>Non-respect des obligations de délivrance conforme ;</li>";
        content += "<li>Pratiques commerciales trompeuses.</li>";
        content += "</ul>";

        content += "<h3>C. Moyens d'action contre le tiers</h3><ul>";
        content += "<li><strong>Action en garantie légale de conformité</strong> ;</li>";
        content += "<li><strong>Action en résolution de la vente</strong> : Remboursement intégral ;</li>";
        content += "<li><strong>Action en réduction du prix</strong> : Remboursement partiel ;</li>";
        content += "<li><strong>Action en dommages et intérêts</strong> ;</li>";
        content += "<li><strong>Action en nullité pour dol</strong> : Si dissimulation intentionnelle.</li>";
        content += "</ul>";

        return content;
    }

    function generateConclusion(text, context) {
        let content = "<p>L'analyse technique et juridique approfondie permet de formuler les conclusions suivantes :</p>";

        content += "<h3>A. Appréciation globale</h3>";
        content += "<p>La réunion des trois critères cumulatifs permet de caractériser la responsabilité du vendeur professionnel. Les éléments factuels et documentaires convergent vers une qualification favorable à la partie lésée.</p>";

        content += "<h3>B. Recommandations stratégiques</h3><ul>";
        content += "<li>Constituer un dossier probatoire complet ;</li>";
        content += "<li>Faire réaliser une expertise technique contradictoire ;</li>";
        content += "<li>Adresser une mise en demeure formelle au vendeur ;</li>";
        content += "<li>Envisager une action amiable préalable ;</li>";
        content += "<li>Conserver précieusement les pièces originales.</li>";
        content += "</ul>";

        content += "<h3>C. Perspectives d'action</h3>";
        content += "<p>Les moyens d'action identifiés offrent des perspectives favorables. La combinaison des différentes qualifications juridiques permet d'envisager une action globale, maximisant les chances de succès.</p>";

        content += "<p>Cette analyse, fondée sur une interprétation rigoureuse des dispositions légales et de la jurisprudence constante, constitue une base solide pour toute action ultérieure.</p>";

        return content;
    }

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

    // Bouton Génération PDF
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

            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('RAPPORT D\'ANALYSE TECHNIQUE ET JURIDIQUE', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 15;

            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text('Aide Rédactionnelle - Analyse automobile', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 15;

            doc.setFontSize(10);
            doc.text('Date : ' + analysisData.date, margin, yPosition);
            yPosition += 15;

            analysisData.sections.forEach(section => {
                if (yPosition > 270) {
                    doc.addPage();
                    yPosition = margin;
                }

                doc.setFont(undefined, 'bold');
                doc.setFontSize(12);
                const titleLines = doc.splitTextToSize(section.title, maxWidth);
                doc.text(titleLines, margin, yPosition);
                yPosition += titleLines.length * 6 + 5;

                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = section.content;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                const contentLines = doc.splitTextToSize(plainText, maxWidth);

                contentLines.forEach(line => {
                    if (yPosition > 280) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin, yPosition);
                    yPosition += 5;
                });

                yPosition += 5;
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text('Page ' + i + ' / ' + pageCount + ' - Aide Rédactionnelle', pageWidth / 2, 290, { align: 'center' });
            }

            doc.save('analyse-juridique-' + analysisData.date.replace(/\//g, '-') + '.pdf');
            alert('✅ Rapport PDF généré avec succès !');
        });
    }

    // Bouton Partage
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
                });
            }
        });
    }

    // Enregistrement du Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✅ Service Worker enregistré'))
            .catch(err => console.log('⚠️ Service Worker:', err));
    }
});
