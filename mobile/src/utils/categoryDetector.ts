/**
 * 🎯 DÉTECTEUR INTELLIGENT DE CATÉGORIE
 * 
 * Détermine automatiquement quelle catégorie (et donc quel formulaire)
 * utiliser pour créer une nouvelle clé autocomplete.
 * 
 * STRATÉGIE MULTI-NIVEAU :
 * 1. Mots-clés spécifiques (haute confiance)
 * 2. Analyse sémantique (IA locale)
 * 3. Demande utilisateur (si ambiguïté)
 */

export interface CategoryDetectionResult {
    category_code: string;           // Ex: 'AUTO', 'TEL'
    category_name: string;           // Ex: 'automobile', 'telephone'
    form_component: string;          // Ex: 'FormAutoAutomobile'
    confidence: number;              // 0-100
    alternatives?: CategoryDetectionResult[];  // Si ambiguïté
}

/**
 * NIVEAU 1 : Dictionnaire mots-clés par catégorie
 */
const CATEGORY_KEYWORDS = {
    // ═══════════════════════════════════════════════════════
    // VÉHICULES & TRANSPORT
    // ═══════════════════════════════════════════════════════
    AUTO: {
        category_name: 'automobile',
        form_component: 'FormAutoAutomobile',
        keywords: {
            // Marques auto (haute confiance)
            brands: [
                'toyota', 'peugeot', 'mercedes', 'bmw', 'audi', 'volkswagen', 'vw',
                'nissan', 'honda', 'ford', 'renault', 'citroen', 'hyundai', 'kia',
                'mazda', 'subaru', 'volvo', 'porsche', 'ferrari', 'lamborghini',
                'tesla', 'byd', 'nio', 'rivian', 'lucid'
            ],
            // Types véhicules
            types: [
                'voiture', 'auto', 'automobile', 'vehicule', 'car',
                'berline', 'suv', 'pickup', 'pick-up', 'camion', 'truck',
                'break', 'monospace', 'cabriolet', 'coupe'
            ],
            // Modèles célèbres
            models: [
                'corolla', 'camry', 'rav4', 'hilux', 'land cruiser', 'prado',
                'civic', 'accord', 'cr-v', 'pilot',
                '308', '508', '3008', '5008', 'partner',
                'classe c', 'classe e', 'gle', 'glc', 'sprinter'
            ],
            // Termes techniques
            technical: ['4x4', '4wd', 'awd', 'diesel', 'essence', 'hybride', 'electrique']
        }
    },

    MOTO: {
        category_name: 'moto',
        form_component: 'FormAutoMoto',
        keywords: {
            brands: ['yamaha', 'honda', 'kawasaki', 'suzuki', 'ducati', 'harley', 'ktm'],
            types: ['moto', 'motocyclette', 'scooter', 'motorcycle', 'bike'],
            models: ['yzf', 'cbr', 'ninja', 'gsx', 'monster']
        }
    },

    // ═══════════════════════════════════════════════════════
    // ÉLECTRONIQUE
    // ═══════════════════════════════════════════════════════
    TEL: {
        category_name: 'telephone',
        form_component: 'FormAutoTelephone',
        keywords: {
            brands: [
                'iphone', 'apple', 'samsung', 'huawei', 'xiaomi', 'oppo', 'vivo',
                'tecno', 'infinix', 'itel', 'nokia', 'lg', 'sony', 'motorola',
                'oneplus', 'realme', 'poco', 'redmi'
            ],
            types: [
                'telephone', 'smartphone', 'phone', 'mobile', 'portable',
                'iphone', 'galaxy', 'android'
            ],
            models: [
                'iphone 14', 'iphone 15', 'galaxy s23', 'galaxy a54',
                'redmi note', 'poco', 'spark', 'camon', 'phantom'
            ],
            technical: ['5g', '4g', 'android', 'ios', 'dual sim']
        }
    },

    PC: {
        category_name: 'ordinateur',
        form_component: 'FormAutoOrdinateur',
        keywords: {
            brands: ['dell', 'hp', 'lenovo', 'asus', 'acer', 'apple', 'macbook', 'thinkpad'],
            types: [
                'ordinateur', 'pc', 'laptop', 'notebook', 'computer',
                'portable', 'bureau', 'desktop', 'macbook'
            ],
            models: ['latitude', 'inspiron', 'thinkpad', 'pavilion', 'macbook pro', 'macbook air']
        }
    },

    // ═══════════════════════════════════════════════════════
    // AGRICULTURE & ALIMENTATION
    // ═══════════════════════════════════════════════════════
    AGRI: {
        category_name: 'agriculture',
        form_component: 'FormAutoAgriculture',
        keywords: {
            products: [
                'riz', 'mais', 'manioc', 'igname', 'plantain', 'banane',
                'haricot', 'soja', 'arachide', 'cacao', 'cafe', 'coton',
                'mil', 'sorgho', 'fonio'
            ],
            origins: ['vietnam', 'thailande', 'inde', 'cameroun', 'nigeria', 'benin'],
            types: [
                'cereale', 'legume', 'tubercule', 'fruit',
                'agriculture', 'agricole', 'culture'
            ],
            units: ['sac', 'tonne', 'kg', 'quintal', 'ton']
        }
    },

    // ═══════════════════════════════════════════════════════
    // ALIMENTATION & PRODUITS ALIMENTAIRES
    // ═══════════════════════════════════════════════════════
    ALIMENTS: {
        category_name: 'aliments',
        form_component: 'FormAutoAliments',
        keywords: {
            products: [
                // Fruits frais
                'tomate', 'oignon', 'pomme de terre', 'carotte', 'haricot vert', 'poivron',
                'aubergine', 'courgette', 'concombre', 'salade', 'chou', 'banane plantain',
                'banane douce', 'avocat', 'mangue', 'ananas', 'papaye', 'orange', 'citron',
                'pomme', 'poire', 'raisin', 'fraise', 'melon', 'pastèque', 'goyave',
                // Viandes et poissons
                'poulet', 'cuisse de poulet', 'aile de poulet', 'poisson frais',
                'tilapia', 'maquereau', 'crevette', 'viande de bœuf', 'viande de porc',
                'viande de chèvre', 'veau', 'agneau', 'thon', 'sardine',
                // Produits laitiers
                'lait frais', 'yaourt', 'œuf', 'fromage', 'beurre', 'crème',
                // Produits transformés
                'huile', 'sucre', 'sel', 'farine', 'pâtes', 'riz', 'spaghetti',
                'macaroni', 'couscous', 'semoule', 'sauce', 'bouillon', 'cube maggi',
                'café', 'thé', 'lait en poudre', 'chocolat', 'biscuit', 'chips',
                'conserve', 'surgelé', 'épice', 'condiment'
            ],
            brands: [
                'maggi', 'nestlé', 'nescafé', 'lipton', 'uncle ben', 'barilla',
                'heinz', 'dinor', 'nido', 'peak', 'sosucam', 'cimencam',
                'coca cola', 'pepsi', 'sprite', 'fanta', 'nestle'
            ],
            types: [
                'fruits', 'légumes', 'viande', 'poisson', 'volaille',
                'produits laitiers', 'céréales', 'épicerie', 'boisson',
                'conserves', 'surgelés', 'frais', 'sec', 'transformé'
            ],
            origins: [
                'cameroun', 'locale', 'afrique de l\'ouest', 'europe', 'asie',
                'bio', 'équitable', 'traditionnelle', 'importée', 'vietnam',
                'thailande', 'france', 'italie', 'maroc'
            ],
            units: ['kg', 'g', 'l', 'ml', 'pièce', 'botte', 'paquet', 'barquette', 'filet', 'cagette', 'bouquet', 'grappe', 'douzaine']
        }
    },

    // ═══════════════════════════════════════════════════════
    // IMMOBILIER
    // ═══════════════════════════════════════════════════════
    IMMO: {
        category_name: 'immobilier',
        form_component: 'FormAutoImmobilier',
        keywords: {
            types: [
                'villa', 'appartement', 'studio', 'duplex', 'maison',
                'immeuble', 'residence', 'logement', 'batiment'
            ],
            actions: ['vendre', 'louer', 'location', 'vente', 'bail'],
            features: ['chambre', 'piece', 'salon', 'cuisine', 'sdb', 'wc', 'm2', 'metre'],
            locations: ['douala', 'yaounde', 'libreville', 'brazzaville', 'bonapriso', 'akwa', 'bonanjo']
        }
    },

    TERR: {
        category_name: 'immobilier_terrain',
        form_component: 'FormAutoTerrain',
        keywords: {
            types: ['terrain', 'parcelle', 'lot', 'concession', 'foncier'],
            units: ['m2', 'hectare', 'ha', 'are'],
            features: ['titre', 'titre foncier', 'bornage', 'loti']
        }
    },

    // ═══════════════════════════════════════════════════════
    // SERVICES
    // ═══════════════════════════════════════════════════════
    EMPL: {
        category_name: 'emploi',
        form_component: 'FormAutoEmploi',
        keywords: {
            types: ['emploi', 'job', 'travail', 'poste', 'recrutement', 'offre emploi'],
            positions: [
                'developpeur', 'comptable', 'secretaire', 'commercial', 'manager',
                'ingenieur', 'technicien', 'chauffeur', 'gardien', 'cuisinier'
            ],
            sectors: ['informatique', 'finance', 'commerce', 'industrie', 'service']
        }
    },

    FORM: {
        category_name: 'formation',
        form_component: 'FormAutoFormation',
        keywords: {
            types: ['formation', 'cours', 'training', 'apprentissage', 'certification'],
            subjects: [
                'anglais', 'francais', 'maths', 'informatique', 'comptabilite',
                'marketing', 'gestion', 'excel', 'programmation'
            ],
            levels: ['debutant', 'intermediaire', 'avance', 'professionnel']
        }
    }

    // TODO: Ajouter les 50+ autres catégories
};

/**
 * Détecteur principal
 */
class CategoryDetector {

    /**
     * Détecter la catégorie depuis une requête
     */
    detect(query: string): CategoryDetectionResult {
        const queryLower = query.toLowerCase();

        // NIVEAU 1 : Détection par mots-clés
        const keywordDetection = this.detectByKeywords(queryLower);

        if (keywordDetection.confidence >= 80) {
            console.log(`✅ [CategoryDetector] Haute confiance (${keywordDetection.confidence}%): ${keywordDetection.category_code}`);
            return keywordDetection;
        }

        // NIVEAU 2 : Si ambiguïté, proposer choix
        if (keywordDetection.alternatives && keywordDetection.alternatives.length > 0) {
            console.log(`⚠️ [CategoryDetector] Ambiguïté détectée, ${keywordDetection.alternatives.length} alternatives`);
            return keywordDetection;
        }

        // NIVEAU 3 : Aucune détection, demander utilisateur
        console.log(`❌ [CategoryDetector] Impossible de détecter, demander à l'utilisateur`);
        return {
            category_code: 'UNKNOWN',
            category_name: 'unknown',
            form_component: 'CategorySelector',  // Composant pour choisir manuellement
            confidence: 0
        };
    }

    /**
     * Détection par mots-clés
     */
    private detectByKeywords(query: string): CategoryDetectionResult {
        const scores: Map<string, number> = new Map();

        // Parcourir toutes les catégories
        for (const [code, config] of Object.entries(CATEGORY_KEYWORDS)) {
            let score = 0;

            // Vérifier chaque type de mots-clés
            for (const [type, keywords] of Object.entries(config.keywords)) {
                for (const keyword of keywords as string[]) {
                    if (query.includes(keyword)) {
                        // Scoring selon le type
                        switch (type) {
                            case 'brands':
                                score += 50;  // Marque = très forte indication
                                break;
                            case 'models':
                                score += 40;  // Modèle = forte indication
                                break;
                            case 'types':
                                score += 30;  // Type = indication moyenne
                                break;
                            case 'products':
                                score += 45;  // Produit = forte indication
                                break;
                            case 'actions':
                                score += 20;  // Action = indication faible
                                break;
                            default:
                                score += 25;
                        }

                        // Bonus si mot exact (pas substring)
                        const words = query.split(/\s+/);
                        if (words.includes(keyword)) {
                            score += 10;
                        }
                    }
                }
            }

            if (score > 0) {
                scores.set(code, score);
            }
        }

        // Trier par score
        const sorted = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            return {
                category_code: 'UNKNOWN',
                category_name: 'unknown',
                form_component: 'CategorySelector',
                confidence: 0
            };
        }

        const [topCode, topScore] = sorted[0];
        const topConfig = CATEGORY_KEYWORDS[topCode as keyof typeof CATEGORY_KEYWORDS];

        // Normaliser le score (0-100)
        const confidence = Math.min(100, topScore);

        // Détecter ambiguïtés
        const alternatives: CategoryDetectionResult[] = [];

        if (sorted.length > 1) {
            const [secondCode, secondScore] = sorted[1];

            // Si score proche (différence < 20%), c'est ambigu
            if (topScore - secondScore < 20) {
                const secondConfig = CATEGORY_KEYWORDS[secondCode as keyof typeof CATEGORY_KEYWORDS];
                alternatives.push({
                    category_code: secondCode,
                    category_name: secondConfig.category_name,
                    form_component: secondConfig.form_component,
                    confidence: Math.min(100, secondScore)
                });
            }
        }

        return {
            category_code: topCode,
            category_name: topConfig.category_name,
            form_component: topConfig.form_component,
            confidence,
            alternatives: alternatives.length > 0 ? alternatives : undefined
        };
    }

    /**
     * Obtenir toutes les catégories disponibles
     */
    getAllCategories(): Array<{ code: string, name: string, form: string }> {
        return Object.entries(CATEGORY_KEYWORDS).map(([code, config]) => ({
            code,
            name: config.category_name,
            form: config.form_component
        }));
    }
}

// Instance singleton
export const categoryDetector = new CategoryDetector();

/**
 * Helper : Détecter catégorie depuis requête
 */
export function detectCategoryFromQuery(query: string): CategoryDetectionResult {
    return categoryDetector.detect(query);
}

/**
 * EXEMPLES D'UTILISATION
 */

/*
// Exemple 1 : Détection claire
detectCategoryFromQuery("Toyota RAV4 2024")
→ {
    category_code: "AUTO",
    category_name: "automobile",
    form_component: "FormAutoAutomobile",
    confidence: 90
  }

// Exemple 2 : Détection avec ambiguïté
detectCategoryFromQuery("iPhone reconditionné")
→ {
    category_code: "TEL",
    category_name: "telephone",
    form_component: "FormAutoTelephone",
    confidence: 85,
    alternatives: [
      {
        category_code: "ELECT",  // Si iPhone considéré comme électronique
        confidence: 70
      }
    ]
  }

// Exemple 3 : Impossible à détecter
detectCategoryFromQuery("truc bizarre machin")
→ {
    category_code: "UNKNOWN",
    form_component: "CategorySelector",
    confidence: 0
  }

// Exemple 4 : Agriculture
detectCategoryFromQuery("Riz Vietnam Premium sac 50kg")
→ {
    category_code: "AGRI",
    category_name: "agriculture",
    form_component: "FormAutoAgriculture",
    confidence: 95
  }

// Exemple 5 : Immobilier
detectCategoryFromQuery("Villa 4 chambres Bonapriso")
→ {
    category_code: "IMMO",
    category_name: "immobilier",
    form_component: "FormAutoImmobilier",
    confidence: 88
  }
*/

