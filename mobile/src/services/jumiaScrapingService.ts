/**
 * 🛒 SERVICE DE SCRAPING ÉTHIQUE JUMIA
 * 
 * IMPORTANT: 
 * - Respecter robots.txt
 * - Rate limiting (1 requête/seconde minimum)
 * - Usage raisonnable uniquement
 * - Ne pas surcharger les serveurs
 * 
 * ⚠️ LIMITATION: React Native ne supporte pas directement le parsing HTML.
 * Pour une meilleure solution, utiliser un service backend.
 */

import { EnrichedProduct } from '../data/enrichedProductDatabase';

export interface JumiaScrapingConfig {
    countryCode: string;        // Code ISO pays (NG, CM, CI, etc.)
    maxProducts?: number;       // Nombre max de produits à scraper
    rateLimitMs?: number;      // Délai entre requêtes (ms)
    respectRobotsTxt?: boolean; // Respecter robots.txt
}

export interface JumiaProduct {
    id: string;
    name: string;
    price: number;
    currency: string;
    brand?: string;
    category: string;
    imageUrl?: string;
    rating?: number;
    reviewCount?: number;
    availability: boolean;
    url: string;
    country: string;
}

export interface ScrapingResult {
    success: boolean;
    products: JumiaProduct[];
    errors: string[];
    duration: number; // ms
    productsFound: number;
}

class JumiaScrapingService {
    private cache = new Map<string, { products: JumiaProduct[]; timestamp: number }>();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures
    private readonly DEFAULT_RATE_LIMIT = 2000; // 2 secondes entre requêtes
    private lastRequestTime = 0;

    /**
     * Obtenir l'URL de base selon le pays
     */
    private getBaseUrl(countryCode: string): string {
        const urls: Record<string, string> = {
            'NG': 'https://www.jumia.com.ng',
            'CM': 'https://www.jumia.cm',
            'CI': 'https://www.jumia.ci',
            'SN': 'https://www.jumia.sn',
            'KE': 'https://www.jumia.co.ke',
            'GH': 'https://www.jumia.com.gh',
            'EG': 'https://www.jumia.com.eg',
            'ZA': 'https://www.jumia.co.za',
            'UG': 'https://www.jumia.ug',
            'TZ': 'https://www.jumia.co.tz'
        };

        return urls[countryCode] || urls['NG']; // Fallback Nigeria
    }

    /**
     * Vérifier robots.txt avant scraping
     */
    private async checkRobotsTxt(countryCode: string): Promise<boolean> {
        try {
            const baseUrl = this.getBaseUrl(countryCode);
            const robotsUrl = `${baseUrl}/robots.txt`;

            const response = await fetch(robotsUrl);
            const robotsTxt = await response.text();

            // Vérifier si /catalog/ est autorisé
            const isAllowed = !robotsTxt.includes('Disallow: /catalog/') &&
                !robotsTxt.includes('Disallow: /products/');

            if (!isAllowed) {
                console.warn('[JumiaScraping] ⚠️ Scraping non autorisé selon robots.txt');
            }

            return isAllowed;
        } catch (error) {
            console.error('[JumiaScraping] Erreur vérification robots.txt:', error);
            return true; // Continuer si erreur de vérification
        }
    }

    /**
     * Rate limiting - Respecter le délai entre requêtes
     */
    private async waitForRateLimit(customRateLimit?: number): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const rateLimit = customRateLimit || this.DEFAULT_RATE_LIMIT;

        if (timeSinceLastRequest < rateLimit) {
            const waitTime = rateLimit - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Scraper une page de résultats Jumia
     * 
     * ⚠️ LIMITATION: React Native ne supporte pas DOMParser.
     * Cette méthode utilise une approche simplifiée avec regex.
     * Pour une meilleure solution, utiliser un service backend.
     */
    private async scrapeSearchPage(
        countryCode: string,
        query: string,
        page: number = 1
    ): Promise<JumiaProduct[]> {
        await this.waitForRateLimit();

        try {
            const baseUrl = this.getBaseUrl(countryCode);
            const searchUrl = `${baseUrl}/catalog/?q=${encodeURIComponent(query)}&page=${page}`;

            console.log(`[JumiaScraping] 📡 Scraping: ${searchUrl}`);

            // Headers pour simuler un navigateur
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            };

            const response = await fetch(searchUrl, { headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();

            // Parser le HTML pour extraire les produits
            const products = this.parseJumiaHTML(html, countryCode, baseUrl);

            console.log(`[JumiaScraping] ✅ ${products.length} produits trouvés (page ${page})`);

            return products;

        } catch (error: any) {
            console.error(`[JumiaScraping] ❌ Erreur scraping page ${page}:`, error.message);
            return [];
        }
    }

    /**
     * Parser le HTML de Jumia pour extraire les produits
     * 
     * ⚠️ NOTE: Cette méthode utilise regex car React Native n'a pas de DOMParser.
     * La structure HTML de Jumia peut changer - adapter si nécessaire.
     */
    private parseJumiaHTML(html: string, countryCode: string, baseUrl: string): JumiaProduct[] {
        const products: JumiaProduct[] = [];

        try {
            // Méthode 1: Chercher les données JSON-LD (si disponibles)
            const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs;
            const jsonLdMatches = html.match(jsonLdPattern);

            if (jsonLdMatches) {
                jsonLdMatches.forEach(script => {
                    try {
                        const jsonContent = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                        const data = JSON.parse(jsonContent);

                        // Gérer différents formats JSON-LD
                        const items = Array.isArray(data) ? data : (data['@graph'] || [data]);

                        items.forEach((item: any) => {
                            if (item['@type'] === 'Product' || item.name) {
                                const offers = item.offers || (Array.isArray(item.offers) ? item.offers[0] : {});

                                if (item.name && offers) {
                                    products.push({
                                        id: item.sku || item.gtin || item['@id'] || `jumia_${Date.now()}_${Math.random()}`,
                                        name: item.name,
                                        price: parseFloat(offers.price || offers.lowPrice || '0'),
                                        currency: offers.priceCurrency || this.getCurrency(countryCode),
                                        brand: item.brand?.name || item.brand || item.manufacturer?.name,
                                        category: item.category || this.extractCategoryFromUrl(item.url || ''),
                                        imageUrl: Array.isArray(item.image) ? item.image[0] : item.image,
                                        rating: item.aggregateRating?.ratingValue,
                                        reviewCount: item.aggregateRating?.reviewCount,
                                        availability: offers.availability !== 'https://schema.org/OutOfStock',
                                        url: item.url || item['@id'] || '',
                                        country: countryCode
                                    });
                                }
                            }
                        });
                    } catch (e) {
                        // Ignorer les erreurs de parsing JSON individuels
                    }
                });
            }

            // Méthode 2: Parser les balises HTML avec regex (fallback)
            if (products.length === 0) {
                // Pattern pour trouver les conteneurs de produits
                // ⚠️ Cette regex doit être adaptée selon la structure réelle de Jumia
                const productContainerPattern = /<article[^>]*class=["'][^"']*prd[^"']*["'][^>]*>(.*?)<\/article>/gs;
                const containerMatches = html.match(productContainerPattern);

                if (containerMatches) {
                    containerMatches.forEach((container, index) => {
                        // Extraire nom
                        const nameMatch = container.match(/<h3[^>]*class=["'][^"']*name["'][^>]*>(.*?)<\/h3>/is);
                        const name = nameMatch ? this.cleanHTML(nameMatch[1]) : '';

                        // Extraire prix
                        const priceMatch = container.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>(.*?)<\/span>/is);
                        const priceText = priceMatch ? this.cleanHTML(priceMatch[1]) : '';
                        const price = this.extractPrice(priceText);

                        // Extraire URL
                        const urlMatch = container.match(/href=["']([^"']+)["']/i);
                        const relativeUrl = urlMatch ? urlMatch[1] : '';
                        const url = relativeUrl.startsWith('http') ? relativeUrl : `${baseUrl}${relativeUrl}`;

                        // Extraire image
                        const imgMatch = container.match(/<img[^>]*src=["']([^"']+)["']/i) ||
                            container.match(/<img[^>]*data-src=["']([^"']+)["']/i);
                        const imageUrl = imgMatch ? imgMatch[1] : '';

                        // Extraire marque (si disponible)
                        const brandMatch = container.match(/<span[^>]*class=["'][^"']*brand["'][^>]*>(.*?)<\/span>/is);
                        const brand = brandMatch ? this.cleanHTML(brandMatch[1]) : undefined;

                        if (name && price > 0) {
                            products.push({
                                id: `jumia_${countryCode}_${index}_${Date.now()}`,
                                name,
                                price,
                                currency: this.getCurrency(countryCode),
                                brand,
                                category: this.extractCategoryFromUrl(url),
                                imageUrl,
                                availability: true,
                                url,
                                country: countryCode
                            });
                        }
                    });
                }
            }

        } catch (error) {
            console.error('[JumiaScraping] Erreur parsing HTML:', error);
        }

        return products;
    }

    /**
     * Nettoyer le HTML pour extraire le texte
     */
    private cleanHTML(html: string): string {
        return html
            .replace(/<[^>]+>/g, '') // Supprimer balises HTML
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extraire le prix depuis une chaîne de texte
     */
    private extractPrice(priceText: string): number {
        // Extraire les chiffres (gérer différents formats)
        const priceMatch = priceText.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
            return parseFloat(priceMatch[0].replace(/,/g, ''));
        }
        return 0;
    }

    /**
     * Extraire la catégorie depuis l'URL
     */
    private extractCategoryFromUrl(url: string): string {
        const categoryMap: Record<string, string> = {
            'telephones-tablets': 'telephone',
            'electronics': 'electronique',
            'computing': 'ordinateur',
            'home-office': 'mobilier',
            'health-beauty': 'cosmetique_parfum',
            'baby-products': 'jouets_enfants',
            'sporting-goods': 'sport',
            'fashion': 'vetement',
            'food-beverage': 'agroalimentaire',
            'supermarket': 'agroalimentaire',
            'automotive': 'automobile',
            'books-media': 'livres_scolaire',
            'appliances': 'electromenager'
        };

        for (const [pattern, category] of Object.entries(categoryMap)) {
            if (url.includes(pattern)) {
                return category;
            }
        }

        return 'autre';
    }

    /**
     * Obtenir la devise selon le pays
     */
    private getCurrency(countryCode: string): string {
        const currencies: Record<string, string> = {
            'NG': 'NGN', // Naira nigérian
            'CM': 'XAF', // Franc CFA (Cameroun)
            'CI': 'XOF', // Franc CFA Ouest (Côte d'Ivoire)
            'SN': 'XOF', // Franc CFA Ouest (Sénégal)
            'KE': 'KES', // Shilling kenyan
            'GH': 'GHS', // Cedi ghanéen
            'EG': 'EGP', // Livre égyptienne
            'ZA': 'ZAR', // Rand sud-africain
            'UG': 'UGX', // Shilling ougandais
            'TZ': 'TZS'  // Shilling tanzanien
        };

        return currencies[countryCode] || 'USD';
    }

    /**
     * Scraper plusieurs pages de résultats
     */
    async scrapeProducts(
        query: string,
        config: JumiaScrapingConfig
    ): Promise<ScrapingResult> {
        const startTime = Date.now();
        const result: ScrapingResult = {
            success: false,
            products: [],
            errors: [],
            duration: 0,
            productsFound: 0
        };

        try {
            // Vérifier robots.txt si demandé
            if (config.respectRobotsTxt !== false) {
                const isAllowed = await this.checkRobotsTxt(config.countryCode);
                if (!isAllowed) {
                    result.errors.push('Scraping non autorisé selon robots.txt');
                    result.duration = Date.now() - startTime;
                    return result;
                }
            }

            console.log(`[JumiaScraping] 🔍 Recherche: "${query}" (${config.countryCode})`);

            // Vérifier le cache
            const cacheKey = `${config.countryCode}_${query}`;
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
                console.log('[JumiaScraping] ✅ Utilisation cache');
                result.products = cached.products;
                result.productsFound = cached.products.length;
                result.success = true;
                result.duration = Date.now() - startTime;
                return result;
            }

            const maxProducts = config.maxProducts || 50;
            const maxPages = Math.ceil(maxProducts / 20); // ~20 produits par page
            let allProducts: JumiaProduct[] = [];

            // Scraper plusieurs pages
            for (let page = 1; page <= maxPages && allProducts.length < maxProducts; page++) {
                const pageProducts = await this.scrapeSearchPage(
                    config.countryCode,
                    query,
                    page
                );

                if (pageProducts.length === 0) {
                    // Plus de produits disponibles
                    break;
                }

                allProducts.push(...pageProducts);

                // Limiter au nombre demandé
                if (allProducts.length >= maxProducts) {
                    allProducts = allProducts.slice(0, maxProducts);
                    break;
                }

                // Attendre entre les pages (rate limiting)
                if (page < maxPages) {
                    const rateLimit = config.rateLimitMs || this.DEFAULT_RATE_LIMIT;
                    await this.waitForRateLimit(rateLimit);
                }
            }

            // Dédupliquer par ID ou URL
            const uniqueProducts = Array.from(
                new Map(allProducts.map(p => [p.id, p])).values()
            );

            // Mettre en cache
            this.cache.set(cacheKey, {
                products: uniqueProducts,
                timestamp: Date.now()
            });

            result.products = uniqueProducts;
            result.productsFound = uniqueProducts.length;
            result.success = true;
            result.duration = Date.now() - startTime;

            console.log(`[JumiaScraping] ✅ ${uniqueProducts.length} produits uniques trouvés en ${result.duration}ms`);

        } catch (error: any) {
            result.errors.push(error.message);
            result.duration = Date.now() - startTime;
            console.error('[JumiaScraping] ❌ Erreur scraping:', error);
        }

        return result;
    }

    /**
     * Scraper une catégorie spécifique
     */
    async scrapeCategory(
        category: string,
        config: JumiaScrapingConfig
    ): Promise<ScrapingResult> {
        // Utiliser la catégorie comme query dans l'URL
        return this.scrapeProducts(category, config);
    }

    /**
     * Transformer produits Jumia en format Yukpo
     */
    transformToYukpo(jumiaProduct: JumiaProduct): EnrichedProduct {
        return {
            id: `jumia_${jumiaProduct.id}`,
            nom: jumiaProduct.name,
            aliases: [jumiaProduct.name, jumiaProduct.brand].filter(Boolean) as string[],

            characteristics: {
                categorie: this.mapCategory(jumiaProduct.category),
                marque: jumiaProduct.brand,
                unite: 'unité',

                caracteristiques_fixes: {
                    prix_reference: jumiaProduct.price,
                    devise: jumiaProduct.currency,
                    pays: jumiaProduct.country,
                    disponibilite: jumiaProduct.availability,
                    note_consommateurs: jumiaProduct.rating,
                    nombre_avis: jumiaProduct.reviewCount,
                    source: 'jumia',
                    url_jumia: jumiaProduct.url,
                    image_url: jumiaProduct.imageUrl
                },

                caracteristiques_variables: [
                    {
                        field: 'prix',
                        label: 'Prix',
                        type: 'number',
                        required: true
                    },
                    {
                        field: 'quantite',
                        label: 'Quantité',
                        type: 'number',
                        required: true
                    }
                ]
            },

            availableIn: [jumiaProduct.country]
        };
    }

    /**
     * Mapper catégorie Jumia → Catégorie Yukpo
     */
    private mapCategory(jumiaCategory: string): string {
        const categoryMap: Record<string, string> = {
            'telephone': 'Téléphone',
            'electronique': 'Électronique',
            'ordinateur': 'Ordinateur',
            'mobilier': 'Mobilier',
            'cosmetique_parfum': 'Cosmétique',
            'jouets_enfants': 'Jouets',
            'sport': 'Sport',
            'vetement': 'Vêtement',
            'agroalimentaire': 'Agroalimentaire',
            'automobile': 'Automobile',
            'livres_scolaire': 'Livres',
            'electromenager': 'Électroménager'
        };

        return categoryMap[jumiaCategory] || 'Autre';
    }

    /**
     * Vider le cache
     */
    clearCache(): void {
        this.cache.clear();
    }
}

// Instance singleton
export const jumiaScrapingService = new JumiaScrapingService();

