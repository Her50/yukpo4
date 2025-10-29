// ✅ CONFIGURATION CONDITIONNELLE DES CHAMPS PRESTATION DE SERVICE
// Affiche seulement les champs pertinents selon la catégorie pour ne pas décourager le prestataire

export interface FieldConfig {
    // Catégorisation
    showCategorie: boolean;
    showType: boolean;

    // Zones
    showZoneIntervention: boolean;
    showModaliteDeplacement: boolean;
    showRayonDeplacement: boolean;
    showFraisDeplacementInclus: boolean;

    // Expérience
    showNiveauExperience: boolean;
    showCertification: boolean;
    showCertificationMultiple: boolean;

    // Disponibilités
    showDisponibilite: boolean;
    showHoraires: boolean;
    showUrgences: boolean;
    showService24h: boolean;
    showWeekend: boolean;
    showJoursFeries: boolean;

    // Tarification
    showModeTarification: boolean;
    showPrixHoraire: boolean;
    showPrixJournalier: boolean;
    showDevisGratuit: boolean;
    showPrixNegociable: boolean;
    showModesPaiement: boolean;

    // Équipements
    showEquipements: boolean;
    showFournitEquipement: boolean;

    // Garanties
    showGarantie: boolean;
    showAssurance: boolean;

    // Contact
    showContact: boolean;
    showLangues: boolean;

    // Offres
    showOffresService: boolean;

    // Spécifiques ÉDUCATION
    showMatieresEnseignees: boolean;
    showNiveauxScolaires: boolean;

    // Spécifiques PRÉPARATION CONCOURS
    showTypeConcours: boolean;
    showConcoursCibles: boolean;
    showMatieresPreparationConcours: boolean;
    showNiveauPreparationConcours: boolean;
    showTypeAccompagnementConcours: boolean;
    showSupportsPedagogiques: boolean;
    showTauxReussiteConcours: boolean;
    showConcoursBlancsProposes: boolean;

    // Spécifiques INGÉNIERIE & ARCHITECTURE
    showLogiciels: boolean;
    showDomaines: boolean;
    showLivrables: boolean;
    showTypesProjet: boolean;
    showCertificationsPro: boolean;
}

/**
 * Détermine quels champs afficher selon la catégorie de prestation
 */
export const getFieldsConfig = (categoriePrestation: string): FieldConfig => {
    // Configuration par défaut (tous les champs)
    const defaultConfig: FieldConfig = {
        showCategorie: true,
        showType: true,
        showZoneIntervention: true,
        showModaliteDeplacement: true,
        showRayonDeplacement: true,
        showFraisDeplacementInclus: true,
        showNiveauExperience: true,
        showCertification: true,
        showCertificationMultiple: false,
        showDisponibilite: true,
        showHoraires: true,
        showUrgences: false,
        showService24h: false,
        showWeekend: false,
        showJoursFeries: false,
        showModeTarification: true,
        showPrixHoraire: true,
        showPrixJournalier: true,
        showDevisGratuit: true,
        showPrixNegociable: true,
        showModesPaiement: true,
        showEquipements: false,
        showFournitEquipement: false,
        showGarantie: false,
        showAssurance: false,
        showContact: true,
        showLangues: false,
        showOffresService: true,
        showMatieresEnseignees: false, // ✅ NOUVEAU: Spécifique éducation
        showNiveauxScolaires: false, // ✅ NOUVEAU: Spécifique éducation
        showTypeConcours: false, // ✅ NOUVEAU: Spécifique concours
        showConcoursCibles: false,
        showMatieresPreparationConcours: false,
        showNiveauPreparationConcours: false,
        showTypeAccompagnementConcours: false,
        showSupportsPedagogiques: false,
        showTauxReussiteConcours: false,
        showConcoursBlancsProposes: false,
        // ✅ NOUVEAUX CHAMPS INGÉNIERIE & ARCHITECTURE
        showLogiciels: false,
        showDomaines: false,
        showLivrables: false,
        showTypesProjet: false,
        showCertificationsPro: false,
    };

    // Si pas de catégorie, retourner config minimale
    if (!categoriePrestation) {
        return {
            ...defaultConfig,
            showCertificationMultiple: false,
            showUrgences: false,
            showService24h: false,
            showWeekend: false,
            showJoursFeries: false,
            showEquipements: false,
            showGarantie: false,
            showAssurance: false,
            showLangues: false,
            // ✅ Champs spécifiques désactivés par défaut
            showLogiciels: false,
            showDomaines: false,
            showLivrables: false,
            showTypesProjet: false,
            showCertificationsPro: false,
        };
    }

    // ============================================================================
    // 📐 INGÉNIERIE & ARCHITECTURE (BTP) - Configuration ultra-spécialisée
    // ============================================================================
    if (
        categoriePrestation.includes('📐') ||
        categoriePrestation.includes('Ingénieur') ||
        categoriePrestation.includes('Architecte') ||
        categoriePrestation.includes('Bureau d\'études') ||
        categoriePrestation.includes('Géomètre') ||
        categoriePrestation.includes('BET') ||
        categoriePrestation.includes('Maîtrise d\'œuvre') ||
        categoriePrestation.includes('Conception') ||
        categoriePrestation.includes('Plans') ||
        categoriePrestation.includes('Permis de construire')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes très importants (Ordre des architectes, etc.)
            showUrgences: false, // Pas d'urgences pour conception
            showService24h: false,
            showWeekend: false, // Travail de bureau
            showJoursFeries: false,
            showPrixHoraire: true, // Tarif horaire courant
            showPrixJournalier: true, // Missions complètes
            showDevisGratuit: true, // Devis gratuit important
            showPrixNegociable: true, // Négociation possible
            showEquipements: true, // Logiciels professionnels (AutoCAD, Revit, etc.)
            showFournitEquipement: true, // Fourniture plans, maquettes
            showGarantie: true, // Garantie décennale obligatoire
            showAssurance: true, // Assurance RC Pro obligatoire
            showLangues: false, // Moins critique pour BTP
            // ✅ NOUVEAUX CHAMPS SPÉCIFIQUES INGÉNIERIE
            showLogiciels: true, // AutoCAD, Revit, ArchiCAD, etc.
            showDomaines: true, // Génie civil, Architecture, Géotechnique, etc.
            showLivrables: true, // Plans 2D/3D, Maquette numérique, etc.
            showTypesProjet: true, // Maison, Immeuble, Villa, Commercial, etc.
            showCertificationsPro: true, // Ordre des architectes, RGE, etc.
        };
    }

    // ============================================================================
    // 🏗️ BÂTIMENT & CONSTRUCTION (garanties + équipements importants)
    // ============================================================================
    if (
        categoriePrestation.includes('🏗️') ||
        categoriePrestation.includes('Maçonnerie') ||
        categoriePrestation.includes('Menuiserie') ||
        categoriePrestation.includes('Plomberie') ||
        categoriePrestation.includes('Électricité') ||
        categoriePrestation.includes('Peinture') ||
        categoriePrestation.includes('Carrelage') ||
        categoriePrestation.includes('Climatisation')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Habilitations importantes
            showUrgences: true, // Dépannages urgences
            showService24h: true,
            showEquipements: true, // Outils professionnels
            showFournitEquipement: true,
            showGarantie: true, // Garantie travaux importante
            showAssurance: true, // Assurance décennale
            showLangues: false, // Moins important
        };
    }

    // ============================================================================
    // 🔨 FORGERON / FERRONNERIE D'ART (sécurité + garanties + sur mesure)
    // ============================================================================
    // Métier artisanal très important en Afrique : grilles anti-vol, portails, balcons
    if (
        categoriePrestation.includes('🔨') ||
        categoriePrestation.includes('Forgeron') ||
        categoriePrestation.includes('Ferronnerie') ||
        categoriePrestation.includes('Ferronnier') ||
        categoriePrestation.includes('Métallerie') ||
        categoriePrestation.includes('Métallier') ||
        categoriePrestation.includes('Soudure') ||
        categoriePrestation.includes('Fer forgé') ||
        categoriePrestation.includes('Serrurerie')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Expérience et compétences importantes
            showUrgences: true, // Dépannages portails, grilles cassées
            showService24h: false, // Rarement 24h (sauf urgences)
            showWeekend: true, // Disponible weekend pour urgences
            showJoursFeries: false,
            showPrixHoraire: false, // Plutôt devis par projet
            showPrixJournalier: false, // Facturation au projet
            showDevisGratuit: true, // ⭐ ESSENTIEL : Devis gratuit très demandé
            showPrixNegociable: true, // Négociation courante sur gros projets
            showModesPaiement: true, // Paiement échelonné important
            showEquipements: true, // Outils de soudure, forge, etc.
            showFournitEquipement: true, // Fourniture matériaux (fer, acier, etc.)
            showGarantie: true, // ⭐ ESSENTIEL : Garantie anti-rouille, solidité
            showAssurance: true, // Assurance RC Pro importante
            showLangues: false, // Moins critique (métier technique)
            // Champs spécifiques désactivés pour forgeron
            showLogiciels: false,
            showDomaines: false,
            showLivrables: false,
            showTypesProjet: false,
            showCertificationsPro: false,
        };
    }

    // ============================================================================
    // 💇 BEAUTÉ & COIFFURE (horaires + langues + modes paiement)
    // ============================================================================
    if (
        categoriePrestation.includes('💇') ||
        categoriePrestation.includes('Coiffure') ||
        categoriePrestation.includes('Barbier') ||
        categoriePrestation.includes('Tresses') ||
        categoriePrestation.includes('Mèches') ||
        categoriePrestation.includes('Manucure') ||
        categoriePrestation.includes('Maquillage') ||
        categoriePrestation.includes('Massage') ||
        categoriePrestation.includes('Esthétique')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: false, // Moins critique
            showUrgences: false,
            showService24h: false,
            showWeekend: true, // Souvent ouvert le weekend
            showJoursFeries: true,
            showPrixHoraire: false, // Plutôt prix par prestation
            showEquipements: false,
            showGarantie: false,
            showAssurance: false,
            showLangues: true, // Communication importante
        };
    }

    // ============================================================================
    // 🔧 MÉCANIQUE & AUTOMOBILE (urgences + équipements + garantie)
    // ============================================================================
    if (
        categoriePrestation.includes('🔧') ||
        categoriePrestation.includes('Mécanique') ||
        categoriePrestation.includes('Carrosserie') ||
        categoriePrestation.includes('Vulcanisation') ||
        categoriePrestation.includes('Lavage Auto')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true,
            showUrgences: true, // Dépannages importants
            showService24h: true,
            showWeekend: true,
            showEquipements: true,
            showFournitEquipement: true,
            showGarantie: true, // Garantie pièces importante
            showAssurance: true,
            showLangues: false,
        };
    }

    // ============================================================================
    // 💻 INFORMATIQUE & TECHNOLOGIE (certifications + portfolio + tarif horaire)
    // ============================================================================
    if (
        categoriePrestation.includes('💻') ||
        categoriePrestation.includes('Réparation Téléphone') ||
        categoriePrestation.includes('Réparation Ordinateur') ||
        categoriePrestation.includes('Développement') ||
        categoriePrestation.includes('Graphisme') ||
        categoriePrestation.includes('Montage Vidéo')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Certifications tech importantes
            showUrgences: true,
            showService24h: false,
            showPrixHoraire: true, // Facturation à l'heure courante
            showPrixJournalier: true,
            showEquipements: true,
            showGarantie: true,
            showAssurance: false,
            showLangues: true, // Support multilingue
        };
    }

    // ============================================================================
    // 🏠 MÉNAGE & ENTRETIEN (horaires + fréquence + langues)
    // ============================================================================
    if (
        categoriePrestation.includes('🏠') ||
        categoriePrestation.includes('Ménage') ||
        categoriePrestation.includes('Repassage') ||
        categoriePrestation.includes('Jardinage') ||
        categoriePrestation.includes('Nettoyage')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: false,
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showPrixHoraire: true, // Tarif horaire courant
            showPrixJournalier: false,
            showEquipements: false,
            showGarantie: false,
            showAssurance: true, // Assurance RC importante
            showLangues: true, // Communication importante
        };
    }

    // ============================================================================
    // 👨‍🍳 CUISINE & RESTAURATION (disponibilités + langues)
    // ============================================================================
    if (
        categoriePrestation.includes('👨‍🍳') ||
        categoriePrestation.includes('Cuisinier') ||
        categoriePrestation.includes('Traiteur') ||
        categoriePrestation.includes('Pâtisserie') ||
        categoriePrestation.includes('Chef')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes culinaires
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: false,
            showPrixJournalier: true, // Forfait par événement
            showEquipements: true, // Matériel cuisine
            showGarantie: false,
            showAssurance: true, // Assurance importante
            showLangues: true,
        };
    }

    // ============================================================================
    // 🎓 PRÉPARATION CONCOURS GRANDES ÉCOLES (système ultra-spécialisé)
    // Détecté si : "Préparation", "Concours", "Grandes écoles", "🎓", etc.
    // ============================================================================
    if (
        // Emoji spécifique concours
        categoriePrestation.includes('🎓') ||
        // OU Préparation + mots-clés écoles
        (categoriePrestation.toLowerCase().includes('préparation') &&
            (categoriePrestation.toLowerCase().includes('concours') ||
                categoriePrestation.toLowerCase().includes('grandes écoles') ||
                categoriePrestation.toLowerCase().includes('polytechnique') ||
                categoriePrestation.toLowerCase().includes('ens') ||
                categoriePrestation.toLowerCase().includes('enam') ||
                categoriePrestation.toLowerCase().includes('ena') ||
                categoriePrestation.toLowerCase().includes('médecine') ||
                categoriePrestation.toLowerCase().includes('iut') ||
                categoriePrestation.toLowerCase().includes('iia') ||
                categoriePrestation.toLowerCase().includes('iai') ||
                categoriePrestation.toLowerCase().includes('issea') ||
                categoriePrestation.toLowerCase().includes('entp') ||
                categoriePrestation.toLowerCase().includes('enpt') ||
                categoriePrestation.toLowerCase().includes('eniet') ||
                categoriePrestation.toLowerCase().includes('enset') ||
                categoriePrestation.toLowerCase().includes('asecna') ||
                categoriePrestation.toLowerCase().includes('classes prépa') ||
                categoriePrestation.toLowerCase().includes('prépa')))
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes très importants
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showJoursFeries: false,
            showPrixHoraire: true, // Tarif horaire important
            showPrixJournalier: true, // Stages intensifs
            showEquipements: false,
            showGarantie: false,
            showAssurance: false,
            showLangues: false, // Moins critique
            showMatieresEnseignees: false, // Remplacé par matières concours
            showNiveauxScolaires: false, // Remplacé par niveau prépa
            // ✅ Champs SPÉCIFIQUES CONCOURS
            showTypeConcours: true,
            showConcoursCibles: true,
            showMatieresPreparationConcours: true,
            showNiveauPreparationConcours: true,
            showTypeAccompagnementConcours: true,
            showSupportsPedagogiques: true,
            showTauxReussiteConcours: true,
            showConcoursBlancsProposes: true,
        };
    }

    // ============================================================================
    // 📚 ÉDUCATION & FORMATION (certifications + matières + niveaux + langues)
    // Pour cours particuliers classiques, soutien scolaire (NON concours)
    // ============================================================================
    if (
        (categoriePrestation.includes('📚') ||
            categoriePrestation.includes('Cours') ||
            categoriePrestation.includes('Soutien') ||
            categoriePrestation.includes('Formation') ||
            categoriePrestation.includes('Coaching')) &&
        !categoriePrestation.toLowerCase().includes('concours') && // EXCLURE préparation concours
        !categoriePrestation.toLowerCase().includes('préparation')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes importants
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showPrixHoraire: true, // Tarif horaire courant
            showPrixJournalier: false,
            showEquipements: false,
            showGarantie: false,
            showAssurance: false,
            showLangues: true, // Très important
            showMatieresEnseignees: true, // ✅ NOUVEAU: Matières enseignées (multi-select)
            showNiveauxScolaires: true, // ✅ NOUVEAU: Niveaux scolaires (multi-select)
            // Concours désactivés
            showTypeConcours: false,
            showConcoursCibles: false,
            showMatieresPreparationConcours: false,
            showNiveauPreparationConcours: false,
            showTypeAccompagnementConcours: false,
            showSupportsPedagogiques: false,
            showTauxReussiteConcours: false,
            showConcoursBlancsProposes: false,
        };
    }

    // ============================================================================
    // 🩺 SANTÉ & BIEN-ÊTRE (certifications + urgences + assurance)
    // ============================================================================
    if (
        categoriePrestation.includes('🩺') ||
        categoriePrestation.includes('Soins') ||
        categoriePrestation.includes('Kinésithérapie') ||
        categoriePrestation.includes('Aide-Soignant') ||
        categoriePrestation.includes('Auxiliaire')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes obligatoires
            showUrgences: true,
            showService24h: true,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: true,
            showEquipements: true,
            showGarantie: false,
            showAssurance: true, // Assurance obligatoire
            showLangues: true,
        };
    }

    // ============================================================================
    // 👶 GARDE & ASSISTANCE (horaires + langues + assurance)
    // ============================================================================
    if (
        categoriePrestation.includes('👶') ||
        categoriePrestation.includes('Garde') ||
        categoriePrestation.includes('Baby-sitting') ||
        categoriePrestation.includes('Nounou')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Diplômes petite enfance
            showUrgences: true, // Garde urgente
            showService24h: false,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: true,
            showEquipements: false,
            showGarantie: false,
            showAssurance: true, // Assurance importante
            showLangues: true,
        };
    }

    // ============================================================================
    // 📸 ÉVÉNEMENTIEL & MULTIMÉDIA (portfolio + équipements)
    // ============================================================================
    if (
        categoriePrestation.includes('📸') ||
        categoriePrestation.includes('Photographie') ||
        categoriePrestation.includes('Vidéographie') ||
        categoriePrestation.includes('DJ') ||
        categoriePrestation.includes('Animation') ||
        categoriePrestation.includes('Décoration')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: false,
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: false,
            showPrixJournalier: true, // Prix par événement
            showEquipements: true, // Matériel professionnel
            showGarantie: false,
            showAssurance: true,
            showLangues: true,
        };
    }

    // ============================================================================
    // 🚚 TRANSPORT & LOGISTIQUE (disponibilités + équipements)
    // ============================================================================
    if (
        categoriePrestation.includes('🚚') ||
        categoriePrestation.includes('Déménagement') ||
        categoriePrestation.includes('Transport') ||
        categoriePrestation.includes('Coursier') ||
        categoriePrestation.includes('Chauffeur')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Permis
            showUrgences: true,
            showService24h: true,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: false,
            showPrixJournalier: true,
            showEquipements: true, // Véhicules
            showGarantie: false,
            showAssurance: true, // Assurance obligatoire
            showLangues: false,
        };
    }

    // ============================================================================
    // 🔐 SÉCURITÉ & SURVEILLANCE (horaires + certifications + assurance)
    // ============================================================================
    if (
        categoriePrestation.includes('🔐') ||
        categoriePrestation.includes('Sécurité') ||
        categoriePrestation.includes('Gardiennage') ||
        categoriePrestation.includes('Installation Caméras') ||
        categoriePrestation.includes('Alarmes')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true, // Agréments
            showUrgences: true,
            showService24h: true,
            showWeekend: true,
            showJoursFeries: true,
            showPrixHoraire: true,
            showEquipements: true,
            showGarantie: true,
            showAssurance: true, // Assurance obligatoire
            showLangues: false,
        };
    }

    // ============================================================================
    // 🪡 COUTURE & MODE (portfolio + horaires)
    // ============================================================================
    if (
        categoriePrestation.includes('🪡') ||
        categoriePrestation.includes('Couture') ||
        categoriePrestation.includes('Retouches') ||
        categoriePrestation.includes('Stylisme') ||
        categoriePrestation.includes('Broderie')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: false,
            showUrgences: false,
            showService24h: false,
            showWeekend: true,
            showPrixHoraire: false,
            showPrixJournalier: false,
            showEquipements: true,
            showGarantie: false,
            showAssurance: false,
            showLangues: true,
        };
    }

    // ============================================================================
    // ⚡ ÉLECTRONIQUE & RÉPARATION (certifications + équipements + garantie)
    // ============================================================================
    if (
        categoriePrestation.includes('⚡') ||
        categoriePrestation.includes('Réparation Électroménager') ||
        categoriePrestation.includes('Réparation TV') ||
        categoriePrestation.includes('Réparation Climatiseur') ||
        categoriePrestation.includes('Antenne Satellite') ||
        categoriePrestation.includes('Générateur')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true,
            showUrgences: true,
            showService24h: true,
            showWeekend: true,
            showEquipements: true,
            showFournitEquipement: true,
            showGarantie: true, // Garantie réparation importante
            showAssurance: true,
            showLangues: false,
        };
    }

    // ============================================================================
    // 📄 SERVICES ADMINISTRATIFS (certifications + langues)
    // ============================================================================
    if (
        categoriePrestation.includes('📄') ||
        categoriePrestation.includes('Saisie') ||
        categoriePrestation.includes('Traduction') ||
        categoriePrestation.includes('Rédaction') ||
        categoriePrestation.includes('Comptabilité') ||
        categoriePrestation.includes('Juridique')
    ) {
        return {
            ...defaultConfig,
            showCertificationMultiple: true,
            showUrgences: true, // Délais serrés
            showService24h: false,
            showWeekend: false,
            showPrixHoraire: true,
            showPrixJournalier: false,
            showEquipements: false,
            showGarantie: false,
            showAssurance: true, // RC Pro
            showLangues: true, // Très important
        };
    }

    // Par défaut, retourner la configuration par défaut
    return defaultConfig;
};

/**
 * Compte le nombre de champs affichés (pour feedback utilisateur)
 */
export const countVisibleFields = (config: FieldConfig): number => {
    return Object.values(config).filter(Boolean).length;
};

/**
 * Retourne un message encourageant selon le nombre de champs
 */
export const getEncouragementMessage = (config: FieldConfig): string => {
    const count = countVisibleFields(config);

    if (count <= 10) {
        return '✨ Formulaire court ! Seulement quelques champs essentiels à remplir.';
    } else if (count <= 15) {
        return '👍 Formulaire optimisé pour votre catégorie.';
    } else if (count <= 20) {
        return '📝 Remplissez un maximum de champs pour plus de visibilité !';
    } else {
        return '🌟 Profil complet = Plus de clients ! Prenez le temps de bien remplir.';
    }
};

