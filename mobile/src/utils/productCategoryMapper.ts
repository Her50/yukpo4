/**
 * Utilitaire pour mapper les catégories de service vers les types de produits
 * Permet une détection automatique intelligente du type de produit approprié
 */

type ProductType =
    // Immobilier
    | 'immobilier_batiment'
    | 'immobilier_terrain'
    // Hébergement
    | 'hotellerie'
    // Transport
    | 'automobile'
    | 'ticket_voyage'
    | 'covoiturage'
    // Mode et Textile
    | 'vetement'
    | 'chaussure'
    // Électronique
    | 'electromenager'
    | 'image_son'
    | 'telephone'
    | 'ordinateur'
    // Maison
    | 'mobilier'
    | 'decoration'
    | 'ustensiles_cuisine'
    // Matériaux et Pièces
    | 'pieces_auto'
    | 'pieces_industrielles'
    | 'quincaillerie'
    | 'carrelage'
    // Enfants
    | 'jouets_enfants'
    // Alimentation
    | 'aliments'
    // Éducation
    | 'livres_scolaire'
    // Services
    | 'prestation_service'
    // Santé
    | 'pharmacie'
    | 'hopital_clinique'
    | 'laboratoire'
    // Transport logistique
    | 'demenagement'
    // Beauté
    | 'cosmetique_parfum'
    | 'bijoux'
    | 'coiffure_beaute'
    // Prestations spécialisées - Bâtiment
    | 'macon'
    | 'plombier'
    | 'electricien'
    | 'electricien_auto'
    | 'peintre'
    | 'peinture'
    | 'staffeur'
    | 'menuiserie'
    | 'carreleur'
    // Réparations
    | 'reparateur_frigo'
    | 'reparateur_climatiseur'
    | 'reparateur_electronique'
    // Artisanat
    | 'couturier'
    // Autre
    | 'autre';

/**
 * Mapping des catégories de service vers les types de produits
 * Permet de suggérer automatiquement le bon formulaire de produit
 * ⚠️ ORDRE IMPORTANT : Les mappings les plus spécifiques DOIVENT être en premier
 */
const CATEGORY_TO_PRODUCT_TYPE: Record<string, ProductType> = {
    // ========== PRESTATIONS DE SERVICE SPÉCIFIQUES (en premier pour éviter confusion) ==========
    // Bâtiment et Construction
    'macon': 'macon',
    'maçon': 'macon',
    'maconnerie': 'macon',
    'maçonnerie': 'macon',
    'plombier': 'plombier',
    'plomberie': 'plombier',
    'electricien': 'electricien',
    'électricien': 'electricien',
    'electricite': 'electricien',
    'électricité': 'electricien',
    'electricien auto': 'electricien_auto',
    'électricien auto': 'electricien_auto',
    'electricite auto': 'electricien_auto',
    'electricite automobile': 'electricien_auto',
    'peintre': 'peintre',
    'peinture': 'peinture',
    'peinture batiment': 'peintre',
    'staffeur': 'staffeur',
    'platrier': 'staffeur',
    'plâtrier': 'staffeur',
    'platre': 'staffeur',
    'plâtre': 'staffeur',
    'menuisier': 'menuiserie',
    'menuiserie': 'menuiserie',
    'ebeniste': 'menuiserie',
    'ébéniste': 'menuiserie',
    'ebenisterie': 'menuiserie',
    'ébénisterie': 'menuiserie',
    'carreleur': 'carreleur',
    'carrelage service': 'carreleur',
    'pose carrelage': 'carreleur',

    // Réparations spécialisées
    'frigoriste': 'reparateur_frigo',
    'reparateur frigo': 'reparateur_frigo',
    'réparateur frigo': 'reparateur_frigo',
    'reparation frigo': 'reparateur_frigo',
    'reparateur climatiseur': 'reparateur_climatiseur',
    'réparateur climatiseur': 'reparateur_climatiseur',
    'climatisation service': 'reparateur_climatiseur',
    'reparateur electronique': 'reparateur_electronique',
    'réparateur électronique': 'reparateur_electronique',
    'reparation tv': 'reparateur_electronique',
    'réparation tv': 'reparateur_electronique',

    // Artisanat et Textile
    'couturier': 'couturier',
    'tailleur': 'couturier',
    'couture': 'couturier',
    'couture sur mesure': 'couturier',
    'coiffure': 'coiffure_beaute',
    'coiffeur': 'coiffure_beaute',
    'salon coiffure': 'coiffure_beaute',
    'meche': 'coiffure_beaute',
    'mèche': 'coiffure_beaute',
    'meches': 'coiffure_beaute',
    'mèches': 'coiffure_beaute',
    'perruque': 'coiffure_beaute',
    'extensions': 'coiffure_beaute',

    // ========== VENTE DE PRODUITS ==========
    // Immobilier
    'immobilier': 'immobilier_batiment',
    'vente immobilier': 'immobilier_batiment',
    'location immobilier': 'immobilier_batiment',
    'terrain': 'immobilier_terrain',
    'terrains': 'immobilier_terrain',

    // Hébergement
    'hotel': 'hotellerie',
    'hôtel': 'hotellerie',
    'hotellerie': 'hotellerie',
    'hebergement': 'hotellerie',
    'hébergement': 'hotellerie',
    'auberge': 'hotellerie',
    'chambre hote': 'hotellerie',

    // Transport et Automobile
    'automobile': 'automobile',
    'vente automobile': 'automobile',
    'vehicule': 'automobile',
    'véhicule': 'automobile',
    'voiture': 'automobile',
    'vente voiture': 'automobile',
    'garage': 'automobile',
    'billet': 'ticket_voyage',
    'ticket': 'ticket_voyage',
    'ticket voyage': 'ticket_voyage',
    'transport': 'ticket_voyage',
    'voyage': 'ticket_voyage',
    'agence voyage': 'ticket_voyage',
    'covoiturage': 'covoiturage',

    // Mode et Textile
    'vetement': 'vetement',
    'vêtement': 'vetement',
    'mode': 'vetement',
    'habillement': 'vetement',
    'pret porter': 'vetement',
    'prêt à porter': 'vetement',
    'chaussure': 'chaussure',
    'chaussures': 'chaussure',

    // Électronique
    'electromenager': 'electromenager',
    'électroménager': 'electromenager',
    'vente electromenager': 'electromenager',
    'image son': 'image_son',
    'audio video': 'image_son',
    'multimedia': 'image_son',
    'tv': 'image_son',
    'television': 'image_son',
    'telephone': 'telephone',
    'téléphone': 'telephone',
    'mobile': 'telephone',
    'smartphone': 'telephone',
    'vente telephone': 'telephone',
    'ordinateur': 'ordinateur',
    'informatique': 'ordinateur',
    'pc': 'ordinateur',

    // Maison et Décoration
    'mobilier': 'mobilier',
    'meuble': 'mobilier',
    'meubles': 'mobilier',
    'ameublement': 'mobilier',
    'decoration': 'decoration',
    'décoration': 'decoration',
    'deco': 'decoration',
    'ustensiles cuisine': 'ustensiles_cuisine',

    // Pièces et Matériaux
    'pieces auto': 'pieces_auto',
    'pièces auto': 'pieces_auto',
    'pieces detachees': 'pieces_auto',
    'pieces industrielles': 'pieces_industrielles',
    'pièces industrielles': 'pieces_industrielles',
    'quincaillerie': 'quincaillerie',
    'bricolage': 'quincaillerie',
    'outillage': 'quincaillerie',
    'materiaux construction': 'quincaillerie',
    'carrelage': 'carrelage',
    'carrelage vente': 'carrelage',
    'vente carrelage': 'carrelage',

    // Enfants
    'jouets': 'jouets_enfants',
    'jouet': 'jouets_enfants',
    'articles enfants': 'jouets_enfants',
    'jeux enfants': 'jouets_enfants',

    // Alimentation
    'aliments': 'aliments',
    'alimentation': 'aliments',
    'alimentaire': 'aliments',
    'agroalimentaire': 'aliments',
    'fruits': 'aliments',
    'legumes': 'aliments',
    'légumes': 'aliments',
    'viande': 'aliments',
    'poisson': 'aliments',

    // Éducation
    'livres': 'livres_scolaire',
    'livre': 'livres_scolaire',
    'scolaire': 'livres_scolaire',
    'fourniture': 'livres_scolaire',
    'fournitures scolaires': 'livres_scolaire',

    // Santé
    'pharmacie': 'pharmacie',
    'hopital': 'hopital_clinique',
    'hôpital': 'hopital_clinique',
    'clinique': 'hopital_clinique',
    'centre medical': 'hopital_clinique',
    'centre de sante': 'hopital_clinique',
    'etablissement sante': 'hopital_clinique',
    'laboratoire': 'laboratoire',
    'labo': 'laboratoire',
    'laboratoire analyse': 'laboratoire',
    'imagerie medicale': 'laboratoire',

    // Transport et Logistique
    'demenagement': 'demenagement',
    'déménagement': 'demenagement',
    'demenageur': 'demenagement',
    'transport demenagement': 'demenagement',

    // Beauté et Bien-être
    'cosmetique': 'cosmetique_parfum',
    'cosmétique': 'cosmetique_parfum',
    'parfum': 'cosmetique_parfum',
    'beaute': 'cosmetique_parfum',
    'beauté': 'cosmetique_parfum',
    'produits beaute': 'cosmetique_parfum',
    'bijoux': 'bijoux',
    'bijou': 'bijoux',
    'joaillerie': 'bijoux',
    'bijouterie': 'bijoux',

    // ⚠️ NOTE: "service" et "services" sont RETIRÉS pour éviter les faux positifs
    // Les catégories génériques sont gérées par le fallback intelligent
};

/**
 * Détecte intelligemment le type de produit depuis la catégorie du service
 * Utilise un système de scoring pour trouver la meilleure correspondance
 * @param serviceCategory - Catégorie du service (ex: "Vente automobile", "Immobilier", etc.)
 * @returns Type de produit approprié ou 'autre' si aucune correspondance
 */
export function detectProductTypeFromCategory(serviceCategory: string | undefined | null): ProductType {
    if (!serviceCategory) return 'autre';

    // Normaliser la catégorie (minuscules, sans accents)
    const normalized = serviceCategory
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    console.log(`[productCategoryMapper] 🔍 Détection pour: "${serviceCategory}" (normalisé: "${normalized}")`);

    // Recherche exacte d'abord (score parfait)
    if (CATEGORY_TO_PRODUCT_TYPE[normalized]) {
        console.log(`[productCategoryMapper] ✅ Match exact: ${CATEGORY_TO_PRODUCT_TYPE[normalized]}`);
        return CATEGORY_TO_PRODUCT_TYPE[normalized];
    }

    // ✅ NOUVEAU: Système de scoring pour trouver la meilleure correspondance
    interface Match {
        type: ProductType;
        score: number;
        matchedKey: string;
    }

    const matches: Match[] = [];

    // Calculer le score pour chaque clé du mapping
    for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
        let score = 0;

        // Score 100 : Match exact complet
        if (normalized === key) {
            score = 100;
        }
        // Score 80 : La catégorie commence par la clé (ex: "plombier professionnel" commence par "plombier")
        else if (normalized.startsWith(key)) {
            score = 80;
        }
        // Score 70 : La catégorie se termine par la clé (ex: "service de plombier" se termine par "plombier")
        else if (normalized.endsWith(key)) {
            score = 70;
        }
        // Score 60 : La catégorie contient la clé comme mot entier
        else if (normalized.includes(` ${key} `) || normalized.startsWith(` ${key}`) || normalized.endsWith(`${key} `)) {
            score = 60;
        }
        // Score 40 : La catégorie contient la clé (mais pas comme mot entier)
        else if (normalized.includes(key)) {
            score = 40;
        }
        // Score 30 : La clé contient la catégorie (catégorie très courte)
        else if (key.includes(normalized) && normalized.length >= 4) {
            score = 30;
        }

        // Ajouter un bonus pour les mots-clés les plus longs (plus spécifiques)
        if (score > 0) {
            score += key.length * 0.5;
            matches.push({ type, score, matchedKey: key });
        }
    }

    // Trier les matches par score décroissant
    matches.sort((a, b) => b.score - a.score);

    // Si on a au moins un bon match (score >= 40)
    if (matches.length > 0 && matches[0].score >= 40) {
        console.log(`[productCategoryMapper] ✅ Meilleur match: ${matches[0].type} (score: ${matches[0].score}, clé: "${matches[0].matchedKey}")`);
        if (matches.length > 1) {
            console.log(`[productCategoryMapper] 📊 Autres matches:`, matches.slice(1, 3).map(m => `${m.type} (${m.score})`));
        }
        return matches[0].type;
    }

    // ✅ AMÉLIORATION: Fallback intelligent basé sur les mots-clés génériques
    // Si la catégorie contient "vente" ou "magasin", probablement un produit générique
    if (normalized.includes('vente') || normalized.includes('magasin') || normalized.includes('boutique')) {
        console.log(`[productCategoryMapper] 💡 Détecté comme vente générique, fallback vers 'autre'`);
        return 'autre';
    }

    // ⚠️ CORRECTION MAJEURE: Ne plus fallback automatiquement vers 'prestation_service'
    // Retourner 'autre' pour forcer l'utilisateur à choisir manuellement
    console.log(`[productCategoryMapper] ⚠️ Aucune correspondance fiable pour "${serviceCategory}", retour 'autre' (choix manuel requis)`);
    return 'autre';
}

/**
 * Vérifie si une catégorie de service nécessite un gestionnaire de produits
 * @param serviceCategory - Catégorie du service
 * @returns true si la catégorie nécessite un ProductManagerMobile
 */
export function shouldShowProductManager(serviceCategory: string | undefined | null): boolean {
    if (!serviceCategory) return false;

    // Catégories qui NE nécessitent PAS de produits (services purs)
    const pureServiceCategories = [
        'prestation',
        'service',
        'conseil',
        'formation',
        'education',
        'éducation'
    ];

    const normalized = serviceCategory.toLowerCase().trim();

    // Si c'est une catégorie de service pur, pas besoin de produits
    for (const pureCategory of pureServiceCategories) {
        if (normalized.includes(pureCategory)) {
            return false;
        }
    }

    // Par défaut, proposer le gestionnaire de produits
    return true;
}

/**
 * Détecte le type de produit depuis un produit existant
 * Analyse les champs présents pour deviner le type
 */
export function detectProductTypeFromProduct(product: any): ProductType {
    if (!product || typeof product !== 'object') return 'autre';

    // Si le produit a déjà un type explicite
    if (product.type) {
        console.log(`[productCategoryMapper] Type explicite trouvé: ${product.type}`);
        return product.type as ProductType;
    }

    // Détecter selon les champs présents (ordre par spécificité)

    // Immobilier
    if (product.superficie || product.nbChambres || product.typeBien) return 'immobilier_batiment';
    if (product.surfaceTerrain || product.typeTerrain) return 'immobilier_terrain';

    // Hébergement
    if (product.nbLits || product.nbPersonnes || product.typeHebergement) return 'hotellerie';

    // Transport
    if (product.marqueVehicule && (product.modeleVehicule || product.annee)) return 'automobile';
    if (product.depart && product.destination && product.compagnieTransport) return 'ticket_voyage';
    if (product.villeDepart && product.villeArrivee) return 'covoiturage';
    if (product.typeDemenagement) return 'demenagement';

    // Mode et Textile
    if (product.pointure) return 'chaussure';
    if (product.taille || product.typeVetement) return 'vetement';
    if (product.typeCoiffure || product.longueurMeche) return 'coiffure_beaute';

    // Électronique
    if (product.puissance || product.consommation || product.typeElectromenager) return 'electromenager';
    if (product.marqueImageSon || product.typeImageSon) return 'image_son';
    if (product.systemeExploitation || product.stockage || product.marqueTelephone) return 'telephone';
    if (product.processeur || product.ram || product.typeOrdinateur) return 'ordinateur';

    // Maison
    if (product.materiauMobilier || product.typeMobilier) return 'mobilier';
    if (product.typeDecoration || product.styleDecoration) return 'decoration';
    if (product.materiauUstensile || product.typeUstensile) return 'ustensiles_cuisine';

    // Matériaux et Pièces
    if (product.categorieQuincaillerie || product.typeQuincaillerie) return 'quincaillerie';
    if (product.typeCarrelage || product.formatCarrelage) return 'carrelage';
    if (product.marqueAuto || product.modelAuto || product.typepiece) return 'pieces_auto';
    if (product.typePieceIndustrielle) return 'pieces_industrielles';

    // Alimentation
    if (product.categorieAliment || product.typeProduitAlimentaire) return 'aliments';

    // Éducation
    if (product.niveauScolaire || product.typeLivre || product.typeFourniture) return 'livres_scolaire';

    // Enfants
    if (product.ageMin || product.typeJouet) return 'jouets_enfants';

    // Santé
    if (product.typePharmacie || product.typeMedicament) return 'pharmacie';
    if (product.typeEtablissement || product.specialiteMedical) return 'hopital_clinique';
    if (product.typeLaboratoire || product.typeExamen) return 'laboratoire';

    // Beauté
    if (product.typeCosmetique || product.marqueParfum) return 'cosmetique_parfum';
    if (product.typeBijou || product.materiau) return 'bijoux';

    // Prestations Spécifiques (Bâtiment)
    if (product.typeMaconnerie || product.surfaceMaconnerie) return 'macon';
    if (product.typePlomberie || product.materielPlomberie) return 'plombier';
    if (product.typeElectricite || product.puissanceElectrique) return 'electricien';
    if (product.typePeinture || product.surfacePeinture) return 'peintre';
    if (product.typeStaffage || product.surfaceStaffage) return 'staffeur';
    if (product.typeMenuiserie || product.essenceBois) return 'menuiserie';
    if (product.typeCouture || product.tissu) return 'couturier';

    // Réparations
    if (product.typeReparationFrigo || product.marqueElectromenager) return 'reparateur_frigo';
    if (product.typeReparationClimatiseur || product.marqueClimatiseur) return 'reparateur_climatiseur';
    if (product.typeReparationElectronique) return 'reparateur_electronique';

    // ⚠️ CORRECTION: Ne plus retourner 'prestation_service' par défaut
    console.log(`[productCategoryMapper] ⚠️ Impossible de détecter le type depuis le produit, retour 'autre'`);
    return 'autre';
}

/**
 * ✨ NOUVEAU: Suggère les catégories de produits les plus pertinentes
 * basées sur les données générées par l'IA du service
 * @param serviceData - Données du service (suggestion.data de FormulaireYukpoIntelligentScreen)
 * @param maxSuggestions - Nombre maximum de suggestions (par défaut 3)
 * @returns Array des types de produits suggérés, triés par pertinence
 */
export function suggestProductCategoriesFromServiceData(
    serviceData: any,
    maxSuggestions: number = 3
): { type: ProductType; score: number; reason: string }[] {
    if (!serviceData || typeof serviceData !== 'object') {
        console.log('[productCategoryMapper] ⚠️ Données service invalides pour suggestion');
        return [];
    }

    console.log('[productCategoryMapper] 🧠 Analyse des données service pour suggestions intelligentes');

    interface CategoryMatch {
        type: ProductType;
        score: number;
        reason: string;
    }

    const categoryScores: Map<ProductType, CategoryMatch> = new Map();

    // Fonction pour ajouter/incrémenter le score d'une catégorie
    const addScore = (type: ProductType, points: number, reason: string) => {
        const existing = categoryScores.get(type);
        if (existing) {
            existing.score += points;
            existing.reason += `, ${reason}`;
        } else {
            categoryScores.set(type, { type, score: points, reason });
        }
    };

    // Normaliser un texte pour la comparaison
    const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // ========== ANALYSE DES CHAMPS DU SERVICE ==========

    // 1. Analyser le titre du service
    if (serviceData.titre?.valeur || serviceData.titre) {
        const titre = normalize((serviceData.titre?.valeur || serviceData.titre).toString());
        console.log('[productCategoryMapper] 📝 Analyse du titre:', titre);

        // Matcher le titre contre toutes les clés du mapping
        for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
            if (titre.includes(key)) {
                const bonus = titre.startsWith(key) ? 20 : titre.endsWith(key) ? 15 : 10;
                addScore(type, bonus, `titre contient "${key}"`);
            }
        }
    }

    // 2. Analyser la description
    if (serviceData.description?.valeur || serviceData.description) {
        const description = normalize((serviceData.description?.valeur || serviceData.description).toString());
        console.log('[productCategoryMapper] 📄 Analyse de la description');

        // Extraire les mots-clés de la description
        for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
            if (description.includes(key)) {
                addScore(type, 5, `description contient "${key}"`);
            }
        }
    }

    // 3. Analyser la catégorie du service
    if (serviceData.categorie?.valeur || serviceData.categorie) {
        const categorie = normalize((serviceData.categorie?.valeur || serviceData.categorie).toString());
        console.log('[productCategoryMapper] 🏷️ Analyse de la catégorie:', categorie);

        for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
            if (categorie === key) {
                addScore(type, 50, `catégorie exacte "${key}"`);
            } else if (categorie.includes(key)) {
                addScore(type, 30, `catégorie contient "${key}"`);
            }
        }
    }

    // 4. Analyser les mots-clés/tags
    const tags = serviceData.tags?.valeur || serviceData.tags || [];
    if (Array.isArray(tags) && tags.length > 0) {
        console.log('[productCategoryMapper] 🏷️ Analyse des tags:', tags);

        tags.forEach((tag: string) => {
            const normalizedTag = normalize(tag);
            for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
                if (normalizedTag === key) {
                    addScore(type, 25, `tag exact "${tag}"`);
                } else if (normalizedTag.includes(key) || key.includes(normalizedTag)) {
                    addScore(type, 15, `tag similaire "${tag}"`);
                }
            }
        });
    }

    // 5. Analyser les services proposés
    const services = serviceData.services?.valeur || serviceData.services || [];
    if (Array.isArray(services) && services.length > 0) {
        console.log('[productCategoryMapper] 📋 Analyse des services proposés');

        services.forEach((service: string) => {
            const normalizedService = normalize(service);
            for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
                if (normalizedService.includes(key)) {
                    addScore(type, 12, `service proposé "${service}"`);
                }
            }
        });
    }

    // 6. Analyser le type d'activité
    if (serviceData.typeActivite?.valeur || serviceData.typeActivite) {
        const activite = normalize((serviceData.typeActivite?.valeur || serviceData.typeActivite).toString());
        console.log('[productCategoryMapper] 🏢 Analyse du type d\'activité:', activite);

        for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
            if (activite.includes(key)) {
                addScore(type, 18, `activité "${key}"`);
            }
        }
    }

    // 7. Analyser les spécialités
    const specialites = serviceData.specialites?.valeur || serviceData.specialites || [];
    if (Array.isArray(specialites) && specialites.length > 0) {
        console.log('[productCategoryMapper] 🎯 Analyse des spécialités');

        specialites.forEach((spec: string) => {
            const normalizedSpec = normalize(spec);
            for (const [key, type] of Object.entries(CATEGORY_TO_PRODUCT_TYPE)) {
                if (normalizedSpec.includes(key)) {
                    addScore(type, 20, `spécialité "${spec}"`);
                }
            }
        });
    }

    // ========== TRI ET FILTRAGE DES RÉSULTATS ==========

    // Convertir en array et trier par score décroissant
    const sortedMatches = Array.from(categoryScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions);

    console.log(`[productCategoryMapper] ✅ Top ${maxSuggestions} suggestions:`);
    sortedMatches.forEach((match, index) => {
        console.log(`  ${index + 1}. ${match.type} (score: ${match.score}) - ${match.reason}`);
    });

    return sortedMatches;
}

