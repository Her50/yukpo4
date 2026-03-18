/**
 * \uD83E\uDDE0 BASE DE CONNAISSANCES PRODUITS
 * 
 * Parse votre base locale de 1000+ produits pour créer des mappings :
 * NOM_PRODUIT → [CARACTÉRISTIQUES MULTIPLES]
 * 
 * Objectif : Remplissage automatique massif en tapant juste le nom
 */

import { searchAllLocalProducts } from '../data/externalDatabases';
import { getAllCategories, getFieldOptions, getModalitiesByProductType } from '../data/productModalities';

/**
 * Structure d'un produit connu avec toutes ses caractéristiques
 */
export interface ProductKnowledge {
    name: string;                           // Nom du produit de base
    category: string;                       // Catégorie
    keywords: string[];                     // Mots-clés pour recherche

    // Caractéristiques FIXES (toujours identiques)
    fixed_characteristics?: Record<string, any>;

    // Caractéristiques VARIABLES (choisies par l'utilisateur)
    variable_characteristics?: {
        field: string;                      // Nom du champ (ex: 'couleur', 'stockage')
        label: string;                      // Label affiché
        options: string[];                  // Options disponibles
        required: boolean;                  // Obligatoire ?
    }[];

    // Variantes prédéfinies (si connues)
    variants?: ProductVariant[];

    confidence: number;                      // Niveau de confiance (0-100)
    characteristics?: Record<string, any>;  // Caractéristiques simplifiées (alternative)
}

/**
 * Une variante spécifique d'un produit
 */
export interface ProductVariant {
    dimensions: Record<string, string>;      // Ex: { couleur: 'Noir', stockage: '128GB' }
    price?: number;                          // Prix spécifique à cette variante
    stock?: number;                          // Stock disponible
    characteristics?: Record<string, any>;   // Caractéristiques additionnelles
}

/**
 * Base de connaissances générée automatiquement
 */
class ProductKnowledgeBase {
    private knowledgeMap: Map<string, ProductKnowledge[]> = new Map();
    private initialized = false;

    /**
     * Initialiser la base en parsant productModalities
     */
    async initialize() {
        if (this.initialized) return;

        console.log('\uD83E\uDDE0 [ProductKnowledgeBase] Initialisation...');

        const categories = getAllCategories();
        let totalProducts = 0;

        for (const category of categories) {
            const products = this.extractProductsFromCategory(category);
            totalProducts += products.length;

            // Indexer chaque produit
            for (const product of products) {
                this.indexProduct(product);
            }
        }

        this.initialized = true;
        console.log(`✅ [ProductKnowledgeBase] ${totalProducts} produits indexés dans ${categories.length} catégories`);
    }

    /**
     * Extraire les produits connus d'une catégorie
     */
    private extractProductsFromCategory(category: string): ProductKnowledge[] {
        const products: ProductKnowledge[] = [];
        const modalities = getModalitiesByProductType(category);

        // ═══════════════════════════════════════════════════════
        // TÉLÉPHONE : marque + modèle = produit complet
        // ═══════════════════════════════════════════════════════
        if (category === 'telephone') {
            const marques = getFieldOptions(category, 'marques');

            for (const marque of marques) {
                if (marque.includes('\uD83C\uDD95')) continue;

                // Récupérer les modèles de cette marque
                const modeles = this.getModelesForMarque(marque, 'telephone');

                for (const modele of modeles) {
                    const productName = `${marque} ${modele}`;

                    // Séparer caractéristiques FIXES et VARIABLES
                    const { fixed, variables, variants } = this.inferPhoneCharacteristics(marque, modele);

                    products.push({
                        name: productName,
                        category: 'telephone',
                        keywords: [marque.toLowerCase(), modele.toLowerCase(), 'smartphone', 'téléphone'],
                        fixed_characteristics: fixed,
                        variable_characteristics: variables,
                        variants: variants,
                        confidence: 85
                    });
                }
            }
        }

        // ═══════════════════════════════════════════════════════
        // AUTOMOBILE : marque + modèle = véhicule complet
        // ═══════════════════════════════════════════════════════
        else if (category === 'automobile') {
            const marques = getFieldOptions(category, 'marques');

            for (const marque of marques) {
                if (marque.includes('\uD83C\uDD95')) continue;

                const modeles = this.getModelesForMarque(marque, 'automobile');

                for (const modele of modeles) {
                    const productName = `${marque} ${modele}`;

                    const characteristics = this.inferCarCharacteristics(marque, modele);

                    products.push({
                        name: productName,
                        category: 'automobile',
                        keywords: [marque.toLowerCase(), modele.toLowerCase(), 'voiture', 'auto'],
                        characteristics,
                        confidence: 80
                    });
                }
            }
        }

        // ═══════════════════════════════════════════════════════
        // AGRICULTURE : type + origine = produit agricole
        // ═══════════════════════════════════════════════════════
        else if (category === 'agriculture') {
            const types = getFieldOptions(category, 'types_produits') || [];
            const origines = getFieldOptions(category, 'origines') || [];

            for (const type of types) {
                if (type.includes('\uD83C\uDD95')) continue;

                for (const origine of origines) {
                    if (origine.includes('\uD83C\uDD95')) continue;

                    const productName = `${type} ${origine}`;

                    products.push({
                        name: productName,
                        category: 'agriculture',
                        keywords: [type.toLowerCase(), origine.toLowerCase()],
                        characteristics: {
                            typeProduit: type,
                            origine: origine,
                            unite: 'sac (50kg)',
                            categorie: 'Produit agricole'
                        },
                        confidence: 90
                    });
                }
            }
        }

        // ═══════════════════════════════════════════════════════
        // VÊTEMENT : type + genre = vêtement
        // ═══════════════════════════════════════════════════════
        else if (category === 'vetement') {
            const types = getFieldOptions(category, 'types') || [];
            const genres = getFieldOptions(category, 'genres') || [];

            for (const type of types) {
                if (type.includes('\uD83C\uDD95')) continue;

                for (const genre of genres) {
                    if (genre.includes('\uD83C\uDD95')) continue;

                    const productName = `${type} ${genre}`;

                    products.push({
                        name: productName,
                        category: 'vetement',
                        keywords: [type.toLowerCase(), genre.toLowerCase()],
                        characteristics: {
                            typeVetement: type,
                            genre: genre,
                            unite: 'unité',
                            categorie: 'Vêtement'
                        },
                        confidence: 85
                    });
                }
            }
        }

        // TODO: Ajouter les 56+ autres catégories avec même logique

        return products;
    }

    /**
     * Récupérer les modèles d'une marque (téléphone/auto)
     */
    private getModelesForMarque(marque: string, category: string): string[] {
        try {
            const { getModelesByMarque } = require('./parseExistingModalities');
            return getModelesByMarque(marque, category);
        } catch (error) {
            return [];
        }
    }

    /**
     * Inférer les caractéristiques d'un téléphone
     */
    private inferPhoneCharacteristics(marque: string, modele: string): Record<string, any> {
        const characteristics: Record<string, any> = {
            marqueTelephone: marque,
            modeleTelephone: modele,
            categorie: 'Téléphone',
            unite: 'unité',
            type: 'Smartphone'
        };

        // Inférence basée sur le modèle
        const modeleLower = modele.toLowerCase();

        // iPhone → iOS, Premium
        if (marque === 'Apple') {
            characteristics.systemeExploitation = 'iOS';

            if (modeleLower.includes('14') || modeleLower.includes('15')) {
                characteristics.tailleEcran = '6.1"';
                characteristics.etatTelephone = 'Neuf';
            }
        }

        // Samsung Galaxy → Android
        if (marque === 'Samsung' && modeleLower.includes('galaxy')) {
            characteristics.systemeExploitation = 'Android';

            if (modeleLower.includes('s23') || modeleLower.includes('s24')) {
                characteristics.typeEcran = 'AMOLED';
            }

            if (modeleLower.includes('a54')) {
                characteristics.stockage = '128GB';
                characteristics.ram = '6GB';
            }
        }

        // Tecno, Infinix, Itel → Entrée de gamme
        if (['Tecno', 'Infinix', 'Itel'].includes(marque)) {
            characteristics.systemeExploitation = 'Android';
            characteristics.etatTelephone = 'Neuf';
        }

        return characteristics;
    }

    /**
     * Inférer les caractéristiques d'une voiture
     */
    private inferCarCharacteristics(marque: string, modele: string): Record<string, any> {
        const characteristics: Record<string, any> = {
            marqueAutomobile: marque,
            modeleAutomobile: modele,
            categorie: 'Automobile',
            unite: 'unité'
        };

        const modeleLower = modele.toLowerCase();

        // Toyota Corolla
        if (marque === 'Toyota' && modeleLower.includes('corolla')) {
            characteristics.typeVehicule = 'Voiture';
            characteristics.typeCarrosserie = 'Berline';
            characteristics.nbPortes = '4 portes';
            characteristics.nbPlaces = '5 places';
            characteristics.transmission = 'Automatique';
        }

        // Peugeot 308
        if (marque === 'Peugeot' && modeleLower.includes('308')) {
            characteristics.typeVehicule = 'Voiture';
            characteristics.typeCarrosserie = 'Berline';
            characteristics.typeCarburant = 'Diesel';
        }

        // SUV keywords
        if (modeleLower.includes('suv') || modeleLower.includes('rav4') || modeleLower.includes('cr-v')) {
            characteristics.typeVehicule = 'SUV';
            characteristics.typeCarrosserie = 'SUV';
            characteristics.nbPlaces = '5 places';
        }

        return characteristics;
    }

    /**
     * Indexer un produit pour recherche rapide
     */
    private indexProduct(product: ProductKnowledge) {
        // Indexer par nom complet
        const nameLower = product.name.toLowerCase();
        if (!this.knowledgeMap.has(nameLower)) {
            this.knowledgeMap.set(nameLower, []);
        }
        this.knowledgeMap.get(nameLower)!.push(product);

        // Indexer par mots-clés
        for (const keyword of product.keywords) {
            if (!this.knowledgeMap.has(keyword)) {
                this.knowledgeMap.set(keyword, []);
            }
            this.knowledgeMap.get(keyword)!.push(product);
        }
    }

    /**
     * Recherche locale dans la base de connaissances indexée
     */
    private searchLocal(query: string, category?: string): ProductKnowledge[] {
        const queryLower = query.toLowerCase();
        const results: ProductKnowledge[] = [];
        for (const [key, products] of this.knowledgeMap.entries()) {
            if (key.includes(queryLower) || queryLower.includes(key)) {
                for (const p of products) {
                    if (!category || p.category === category) {
                        results.push(p);
                    }
                }
            }
        }
        return results;
    }

    /**
     * Transformer un produit externe en ProductKnowledge
     */
    private transformExternalToKnowledge(external: any): ProductKnowledge {
        return {
            name: external.name || external.nom || '',
            category: external.category || external.categorie || 'general',
            keywords: external.keywords || external.mots_cles || [external.name?.toLowerCase()].filter(Boolean),
            fixed_characteristics: external.characteristics || external.fixed_characteristics || {},
            variable_characteristics: external.variable_characteristics || [],
            characteristics: external.characteristics || {},
            confidence: external.confidence || 70,
        };
    }

    /**
     * Rechercher un produit par nom (fuzzy matching)
     * ✅ ENRICHIE avec les bases de données externes
     */
    async search(query: string, category?: string, countryCode?: string): Promise<ProductKnowledge[]> {
        if (!query || query.length < 2) return [];

        const queryLower = query.toLowerCase();
        const results: Map<string, ProductKnowledge> = new Map();

        // 1️⃣ Recherche dans la base locale (existante)
        const localResults = this.searchLocal(query, category);
        localResults.forEach(product => {
            results.set(product.name, product);
        });

        // 2️⃣ Recherche dans les bases externes (produits locaux africains)
        try {
            const externalProducts = searchAllLocalProducts(query, countryCode);

            for (const externalProduct of externalProducts) {
                // Transformer EnrichedProduct → ProductKnowledge
                const knowledge = this.transformExternalToKnowledge(externalProduct);

                // Filtrer par catégorie si spécifiée
                if (!category || knowledge.category === category) {
                    results.set(knowledge.name, knowledge);
                }
            }
        } catch (error) {
            console.error('[ProductKnowledgeBase] Erreur recherche bases externes:', error);
        }

        // Trier par pertinence
        return Array.from(results.values())
            .sort((a, b) => {
                const scoreA = this.calculateRelevance(query, a);
                const scoreB = this.calculateRelevance(query, b);
                return scoreB - scoreA;
            })
            .slice(0, 20);  // Top 20 résultats
    }

    /**
     * Calculer la pertinence d'un résultat
     */
    private calculateRelevance(query: string, product: ProductKnowledge): number {
        const queryLower = query.toLowerCase();
        const nameLower = product.name.toLowerCase();

        let score = product.confidence;

        // Match exact
        if (nameLower === queryLower) score += 50;

        // Commence par la requête
        else if (nameLower.startsWith(queryLower)) score += 30;

        // Contient la requête
        else if (nameLower.includes(queryLower)) score += 20;

        // Mots correspondants
        const queryWords = queryLower.split(' ');
        const nameWords = nameLower.split(' ');
        const matchingWords = queryWords.filter(qw => nameWords.some(nw => nw.includes(qw)));
        score += matchingWords.length * 5;

        return score;
    }

    /**
     * Obtenir les caractéristiques pour un produit
     * ✅ ENRICHIE avec les bases de données externes
     */
    async getCharacteristics(productName: string, category: string, countryCode?: string): Promise<Record<string, any> | null> {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = await this.search(productName, category, countryCode);

        if (results.length > 0) {
            // Combiner caractéristiques fixes et variables
            const product = results[0];
            return {
                ...product.fixed_characteristics,
                category: product.category
            };
        }

        return null;
    }

    /**
     * Obtenir des suggestions de produits
     * ✅ ENRICHIE avec les bases de données externes
     */
    async getSuggestions(query: string, category: string, limit: number = 10, countryCode?: string): Promise<ProductKnowledge[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        const results = await this.search(query, category, countryCode);
        return results.slice(0, limit);
    }
}

// Instance singleton
export const productKnowledgeBase = new ProductKnowledgeBase();

/**
 * Hook pour initialiser la base au démarrage de l'app
 */
export async function initializeProductKnowledge() {
    await productKnowledgeBase.initialize();
}

