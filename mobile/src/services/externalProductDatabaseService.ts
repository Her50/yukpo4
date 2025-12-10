/**
 * 🌍 SERVICE D'IMPORT ET SYNCHRONISATION DES BASES DE DONNÉES EXTERNES
 * 
 * Ce service permet d'importer et synchroniser des produits depuis
 * plusieurs sources de données africaines pour enrichir l'autocomplétion.
 * 
 * Sources supportées:
 * - Open Food Facts (alimentaire)
 * - Bases e-commerce (Jumia, Konga, etc.)
 * - Bases locales par pays
 * - APIs gouvernementales
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import { EnrichedProduct } from '../data/enrichedProductDatabase';

export interface ExternalProductSource {
    id: string;
    name: string;
    type: 'api' | 'scraping' | 'csv' | 'json';
    url?: string;
    enabled: boolean;
    lastSync?: string;
    country?: string; // Code pays ISO (CM, CI, SN, etc.)
    categories?: string[]; // Catégories supportées
}

export interface SyncResult {
    source: string;
    success: boolean;
    productsAdded: number;
    productsUpdated: number;
    productsSkipped: number;
    errors: string[];
    duration: number; // ms
}

export interface ProductImportOptions {
    country?: string; // Filtrer par pays
    categories?: string[]; // Filtrer par catégories
    maxProducts?: number; // Limiter le nombre de produits
    skipDuplicates?: boolean; // Ignorer les doublons
    validateBeforeImport?: boolean; // Valider avant import
}

class ExternalProductDatabaseService {
    private sources: Map<string, ExternalProductSource> = new Map();
    private syncInProgress = false;
    private syncQueue: string[] = [];

    constructor() {
        this.initializeDefaultSources();
    }

    /**
     * Initialiser les sources par défaut
     */
    private initializeDefaultSources() {
        const defaultSources: ExternalProductSource[] = [
            {
                id: 'open-food-facts',
                name: 'Open Food Facts',
                type: 'api',
                url: 'https://world.openfoodfacts.org/cgi/search.pl',
                enabled: true,
                categories: ['agroalimentaire', 'aliments', 'agriculture'],
                country: undefined // Global
            },
            {
                id: 'cameroon-local',
                name: 'Produits Locaux Cameroun',
                type: 'json',
                enabled: true,
                country: 'CM',
                categories: ['agriculture', 'agroalimentaire']
            },
            {
                id: 'ivory-coast-local',
                name: 'Produits Locaux Côte d\'Ivoire',
                type: 'json',
                enabled: true,
                country: 'CI',
                categories: ['agriculture', 'agroalimentaire']
            },
            {
                id: 'senegal-local',
                name: 'Produits Locaux Sénégal',
                type: 'json',
                enabled: true,
                country: 'SN',
                categories: ['agriculture', 'agroalimentaire']
            }
        ];

        defaultSources.forEach(source => {
            this.sources.set(source.id, source);
        });
    }

    /**
     * Obtenir toutes les sources disponibles
     */
    getAvailableSources(): ExternalProductSource[] {
        return Array.from(this.sources.values());
    }

    /**
     * Obtenir les sources activées pour un pays
     */
    getSourcesForCountry(countryCode: string): ExternalProductSource[] {
        return Array.from(this.sources.values()).filter(
            source => source.enabled && (!source.country || source.country === countryCode)
        );
    }

    /**
     * Synchroniser depuis Open Food Facts
     */
    async syncFromOpenFoodFacts(
        query: string,
        options: ProductImportOptions = {}
    ): Promise<SyncResult> {
        const startTime = Date.now();
        const sourceId = 'open-food-facts';
        const result: SyncResult = {
            source: sourceId,
            success: false,
            productsAdded: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            errors: [],
            duration: 0
        };

        try {
            console.log(`[ExternalDB] 🌍 Synchronisation Open Food Facts: "${query}"`);

            // Construire l'URL de recherche
            const searchParams = new URLSearchParams({
                search_terms: query,
                json: '1',
                page_size: String(options.maxProducts || 20),
                action: 'process',
                tagtype_0: 'countries',
                tag_contains_0: 'contains',
                tag_0: options.country || 'world'
            });

            const url = `https://world.openfoodfacts.org/cgi/search.pl?${searchParams}`;
            console.log(`[ExternalDB] 📡 Requête: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const products = data.products || [];

            console.log(`[ExternalDB] ✅ ${products.length} produits trouvés`);

            // Transformer les produits Open Food Facts au format Yukpomnang
            for (const product of products) {
                try {
                    const transformed = this.transformOpenFoodFactsProduct(product, options.country);

                    if (options.validateBeforeImport && !this.validateProduct(transformed)) {
                        result.productsSkipped++;
                        continue;
                    }

                    // Vérifier les doublons
                    if (options.skipDuplicates) {
                        const existing = await this.findDuplicate(transformed);
                        if (existing) {
                            result.productsSkipped++;
                            continue;
                        }
                    }

                    // Sauvegarder le produit
                    await this.saveProduct(transformed);
                    result.productsAdded++;

                } catch (error: any) {
                    result.errors.push(`Erreur produit ${product.code}: ${error.message}`);
                    console.error(`[ExternalDB] ❌ Erreur import produit:`, error);
                }
            }

            result.success = true;
            result.duration = Date.now() - startTime;

            // Mettre à jour la date de synchronisation
            await this.updateSourceLastSync(sourceId);

            console.log(`[ExternalDB] ✅ Synchronisation terminée: ${result.productsAdded} produits ajoutés`);

        } catch (error: any) {
            result.errors.push(error.message);
            result.duration = Date.now() - startTime;
            console.error(`[ExternalDB] ❌ Erreur synchronisation Open Food Facts:`, error);
        }

        return result;
    }

    /**
     * Transformer un produit Open Food Facts au format Yukpomnang
     */
    private transformOpenFoodFactsProduct(product: any, country?: string): EnrichedProduct {
        const nom = product.product_name_fr || product.product_name || product.product_name_en || 'Produit inconnu';

        // Déterminer la catégorie
        let categorie = 'agroalimentaire';
        if (product.categories_tags) {
            if (product.categories_tags.includes('en:beverages')) categorie = 'boissons';
            else if (product.categories_tags.includes('en:fruits')) categorie = 'agriculture';
            else if (product.categories_tags.includes('en:vegetables')) categorie = 'agriculture';
        }

        // Extraire les caractéristiques
        const characteristics: any = {
            categorie: this.formatCategoryName(categorie),
            unite: 'unité',
            source: 'open_food_facts'
        };

        // Marque
        if (product.brands) {
            characteristics.marque = product.brands.split(',')[0].trim();
        }

        // Origine (pays)
        if (product.countries_tags && product.countries_tags.length > 0) {
            const countryTag = product.countries_tags.find((tag: string) => tag.startsWith('en:'));
            if (countryTag) {
                characteristics.origine = countryTag.replace('en:', '').replace(/-/g, ' ');
            }
        }

        // Poids/volume
        if (product.quantity) {
            characteristics.quantite = product.quantity;
        }

        // Allergènes
        if (product.allergens_tags && product.allergens_tags.length > 0) {
            characteristics.allergenes = product.allergens_tags
                .map((tag: string) => tag.replace('en:', '').replace(/-/g, ' '))
                .join(', ');
        }

        // Nutriscore
        if (product.nutriscore_grade) {
            characteristics.nutriscore = product.nutriscore_grade.toUpperCase();
        }

        // Disponibilité par pays
        const availableIn: string[] = [];
        if (product.countries_tags) {
            const countryMap: Record<string, string> = {
                'en:cameroun': 'CM',
                'en:ivory-coast': 'CI',
                'en:senegal': 'SN',
                'en:nigeria': 'NG',
                'en:ghana': 'GH',
                'en:kenya': 'KE',
                'en:south-africa': 'ZA'
            };

            product.countries_tags.forEach((tag: string) => {
                const code = countryMap[tag];
                if (code) availableIn.push(code);
            });
        }

        // Si marque africaine connue, ajouter pays
        if (country && !availableIn.includes(country)) {
            availableIn.push(country);
        }

        return {
            id: `off_${product.code}`,
            nom: nom.trim(),
            aliases: [
                product.product_name_en,
                product.product_name_fr,
                product.abbreviated_product_name
            ].filter(Boolean),
            characteristics,
            availableIn: availableIn.length > 0 ? availableIn : undefined
        };
    }

    /**
     * Importer depuis une base locale (JSON)
     */
    async importFromLocalDatabase(
        sourceId: string,
        products: Partial<EnrichedProduct>[],
        options: ProductImportOptions = {}
    ): Promise<SyncResult> {
        const startTime = Date.now();
        const result: SyncResult = {
            source: sourceId,
            success: false,
            productsAdded: 0,
            productsUpdated: 0,
            productsSkipped: 0,
            errors: [],
            duration: 0
        };

        try {
            console.log(`[ExternalDB] 📦 Import base locale: ${sourceId} (${products.length} produits)`);

            for (const product of products) {
                try {
                    // Filtrer par pays si spécifié
                    if (options.country && product.availableIn && !product.availableIn.includes(options.country)) {
                        result.productsSkipped++;
                        continue;
                    }

                    // Filtrer par catégories si spécifiées
                    if (options.categories && product.characteristics?.categorie) {
                        const productCategory = product.characteristics.categorie.toLowerCase();
                        if (!options.categories.some(cat => productCategory.includes(cat.toLowerCase()))) {
                            result.productsSkipped++;
                            continue;
                        }
                    }

                    // Valider
                    if (options.validateBeforeImport && !this.validateProduct(product as EnrichedProduct)) {
                        result.productsSkipped++;
                        continue;
                    }

                    // Vérifier doublons
                    if (options.skipDuplicates) {
                        const existing = await this.findDuplicate(product as EnrichedProduct);
                        if (existing) {
                            result.productsUpdated++;
                            await this.updateProduct(existing.id, product as EnrichedProduct);
                            continue;
                        }
                    }

                    // Sauvegarder
                    await this.saveProduct(product as EnrichedProduct);
                    result.productsAdded++;

                } catch (error: any) {
                    result.errors.push(`Erreur produit ${product.nom}: ${error.message}`);
                }
            }

            result.success = true;
            result.duration = Date.now() - startTime;

            await this.updateSourceLastSync(sourceId);

            console.log(`[ExternalDB] ✅ Import terminé: ${result.productsAdded} ajoutés, ${result.productsUpdated} mis à jour`);

        } catch (error: any) {
            result.errors.push(error.message);
            result.duration = Date.now() - startTime;
            console.error(`[ExternalDB] ❌ Erreur import base locale:`, error);
        }

        return result;
    }

    /**
     * Synchroniser toutes les sources activées
     */
    async syncAllSources(countryCode?: string): Promise<SyncResult[]> {
        if (this.syncInProgress) {
            console.warn('[ExternalDB] ⚠️ Synchronisation déjà en cours');
            return [];
        }

        this.syncInProgress = true;
        const results: SyncResult[] = [];

        try {
            const sources = countryCode
                ? this.getSourcesForCountry(countryCode)
                : Array.from(this.sources.values()).filter(s => s.enabled);

            console.log(`[ExternalDB] 🔄 Synchronisation de ${sources.length} sources...`);

            for (const source of sources) {
                try {
                    let result: SyncResult;

                    switch (source.type) {
                        case 'api':
                            if (source.id === 'open-food-facts') {
                                // Synchroniser catégories populaires
                                const queries = ['riz', 'huile', 'sucre', 'farine', 'tomate'];
                                for (const query of queries) {
                                    result = await this.syncFromOpenFoodFacts(query, {
                                        country: countryCode,
                                        maxProducts: 10
                                    });
                                    results.push(result);
                                }
                            }
                            break;

                        case 'json':
                            // Les bases locales doivent être importées manuellement
                            console.log(`[ExternalDB] ⏭️  Source ${source.id} nécessite import manuel`);
                            break;

                        default:
                            console.warn(`[ExternalDB] ⚠️ Type de source non supporté: ${source.type}`);
                    }

                } catch (error: any) {
                    console.error(`[ExternalDB] ❌ Erreur synchronisation ${source.id}:`, error);
                    results.push({
                        source: source.id,
                        success: false,
                        productsAdded: 0,
                        productsUpdated: 0,
                        productsSkipped: 0,
                        errors: [error.message],
                        duration: 0
                    });
                }
            }

        } finally {
            this.syncInProgress = false;
        }

        return results;
    }

    /**
     * Valider un produit avant import
     */
    private validateProduct(product: EnrichedProduct): boolean {
        if (!product.nom || product.nom.trim().length < 2) {
            return false;
        }

        if (!product.characteristics || !product.characteristics.categorie) {
            return false;
        }

        return true;
    }

    /**
     * Trouver un doublon
     */
    private async findDuplicate(product: EnrichedProduct): Promise<EnrichedProduct | null> {
        // TODO: Implémenter recherche dans la base enrichie
        // Pour l'instant, retourner null
        return null;
    }

    /**
     * Sauvegarder un produit
     */
    private async saveProduct(product: EnrichedProduct): Promise<void> {
        // TODO: Intégrer avec enrichedProductDatabase.ts
        // Pour l'instant, sauvegarder dans AsyncStorage
        const key = `@yukpomnang_external_product_${product.id}`;
        await SafeStorage.setItem(key, JSON.stringify(product));
    }

    /**
     * Mettre à jour un produit existant
     */
    private async updateProduct(id: string, updates: Partial<EnrichedProduct>): Promise<void> {
        const key = `@yukpomnang_external_product_${id}`;
        const existingJson = await SafeStorage.getItem(key);
        if (existingJson) {
            const existing = JSON.parse(existingJson);
            const updated = { ...existing, ...updates };
            await SafeStorage.setItem(key, JSON.stringify(updated));
        }
    }

    /**
     * Mettre à jour la date de synchronisation d'une source
     */
    private async updateSourceLastSync(sourceId: string): Promise<void> {
        const source = this.sources.get(sourceId);
        if (source) {
            source.lastSync = new Date().toISOString();
            await SafeStorage.setItem(
                `@yukpomnang_source_${sourceId}`,
                JSON.stringify(source)
            );
        }
    }

    /**
     * Formater le nom de catégorie
     */
    private formatCategoryName(category: string): string {
        return category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

// Instance singleton
export const externalProductDatabaseService = new ExternalProductDatabaseService();

