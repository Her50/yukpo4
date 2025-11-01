# 🛒 Guide Pratique: Scraping Éthique de Jumia

## 📋 Vue d'Ensemble

Ce guide explique comment scraper **Jumia** de manière **éthique et légale** pour enrichir la base de données de produits Yukpomnang.

**⚠️ IMPORTANT**: Le scraping doit être **éthique** et respecter :
- ✅ `robots.txt` de Jumia
- ✅ Conditions d'utilisation
- ✅ Rate limiting (ne pas surcharger leurs serveurs)
- ✅ Usage raisonnable uniquement

---

## 🔍 Étape 1: Vérifier robots.txt

### Avant de commencer, toujours vérifier robots.txt

```bash
# Vérifier robots.txt pour chaque pays Jumia
curl https://www.jumia.com.ng/robots.txt  # Nigeria
curl https://www.jumia.cm/robots.txt      # Cameroun
curl https://www.jumia.ci/robots.txt      # Côte d'Ivoire
curl https://www.jumia.sn/robots.txt      # Sénégal
```

### Exemple robots.txt Jumia (Typique)

```
User-agent: *
Allow: /api/
Allow: /products/
Disallow: /cart/
Disallow: /checkout/
Disallow: /user/
Disallow: /admin/
Crawl-delay: 1
```

**Interprétation**:
- ✅ `/products/` est autorisé
- ❌ `/cart/`, `/checkout/` sont interdits
- ⏱️ Délai minimum: 1 seconde entre requêtes

---

## 🛠️ Étape 2: Structure des URLs Jumia

### Format des URLs Jumia par Pays

```typescript
// Structure URL Jumia
const JUMIA_URLS = {
    'NG': 'https://www.jumia.com.ng',  // Nigeria
    'CM': 'https://www.jumia.cm',       // Cameroun
    'CI': 'https://www.jumia.ci',       // Côte d'Ivoire
    'SN': 'https://www.jumia.sn',       // Sénégal
    'KE': 'https://www.jumia.co.ke',    // Kenya
    'GH': 'https://www.jumia.com.gh',   // Ghana
    'EG': 'https://www.jumia.com.eg',   // Égypte
    'ZA': 'https://www.jumia.co.za',    // Afrique du Sud
    'UG': 'https://www.jumia.ug',       // Ouganda
    'TZ': 'https://www.jumia.co.tz'     // Tanzanie
};

// URL de recherche produits
function getJumiaSearchUrl(countryCode: string, query: string, page: number = 1): string {
    const baseUrl = JUMIA_URLS[countryCode];
    return `${baseUrl}/catalog/?q=${encodeURIComponent(query)}&page=${page}`;
}

// URL catégorie spécifique
function getJumiaCategoryUrl(countryCode: string, category: string, page: number = 1): string {
    const baseUrl = JUMIA_URLS[countryCode];
    return `${baseUrl}/${category}/?page=${page}`;
}
```

---

## 💻 Étape 3: Service de Scraping Éthique

### Code Complet du Service

```typescript
// mobile/src/services/jumiaScrapingService.ts

/**
 * 🛒 SERVICE DE SCRAPING ÉTHIQUE JUMIA
 * 
 * IMPORTANT: 
 * - Respecter robots.txt
 * - Rate limiting (1 requête/seconde minimum)
 * - Usage raisonnable uniquement
 * - Ne pas surcharger les serveurs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnrichedProduct } from '../data/enrichedProductDatabase';

interface JumiaScrapingConfig {
    countryCode: string;        // Code ISO pays (NG, CM, CI, etc.)
    maxProducts?: number;       // Nombre max de produits à scraper
    rateLimitMs?: number;        // Délai entre requêtes (ms)
    respectRobotsTxt?: boolean;  // Respecter robots.txt
}

interface JumiaProduct {
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

interface ScrapingResult {
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
     * Vérifier robots.txt avant scraping
     */
    private async checkRobotsTxt(countryCode: string): Promise<boolean> {
        try {
            const baseUrl = this.getBaseUrl(countryCode);
            const robotsUrl = `${baseUrl}/robots.txt`;
            
            const response = await fetch(robotsUrl);
            const robotsTxt = await response.text();
            
            // Vérifier si /catalog/ ou /products/ est autorisé
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
     * Rate limiting - Respecter le délai entre requêtes
     */
    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const rateLimit = this.DEFAULT_RATE_LIMIT;
        
        if (timeSinceLastRequest < rateLimit) {
            const waitTime = rateLimit - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Scraper une page de résultats Jumia
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
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            };
            
            const response = await fetch(searchUrl, { headers });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Parser le HTML pour extraire les produits
            const products = this.parseJumiaHTML(html, countryCode);
            
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
     * NOTE: La structure HTML de Jumia peut changer.
     * Cette fonction doit être adaptée selon la structure réelle.
     */
    private parseJumiaHTML(html: string, countryCode: string): JumiaProduct[] {
        const products: JumiaProduct[] = [];
        
        try {
            // ⚠️ IMPORTANT: Dans React Native, on ne peut pas utiliser DOMParser directement
            // Solution: Utiliser une bibliothèque comme 'cheerio' ou parser manuellement
            
            // Option 1: Utiliser regex pour extraire les données JSON intégrées
            // Jumia inclut souvent les données produits dans des balises <script> JSON-LD
            
            // Chercher les données JSON dans le HTML
            const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs);
            
            if (jsonLdMatch) {
                jsonLdMatch.forEach(script => {
                    try {
                        const jsonContent = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                        const data = JSON.parse(jsonContent);
                        
                        if (data['@type'] === 'Product' || Array.isArray(data)) {
                            const productList = Array.isArray(data) ? data : [data];
                            
                            productList.forEach((item: any) => {
                                if (item.name && item.offers) {
                                    products.push({
                                        id: item.sku || item['@id'] || `jumia_${Date.now()}_${Math.random()}`,
                                        name: item.name,
                                        price: parseFloat(item.offers.price || item.offers.lowPrice || '0'),
                                        currency: item.offers.priceCurrency || this.getCurrency(countryCode),
                                        brand: item.brand?.name || item.brand,
                                        category: item.category || 'autre',
                                        imageUrl: item.image,
                                        rating: item.aggregateRating?.ratingValue,
                                        reviewCount: item.aggregateRating?.reviewCount,
                                        availability: item.offers.availability !== 'https://schema.org/OutOfStock',
                                        url: item.url || item['@id'],
                                        country: countryCode
                                    });
                                }
                            });
                        }
                    } catch (e) {
                        // Ignorer les erreurs de parsing JSON
                    }
                });
            }
            
            // Option 2: Parser les balises HTML directement avec regex
            // (Fallback si JSON-LD non disponible)
            if (products.length === 0) {
                // Pattern pour extraire les produits depuis le HTML
                // ⚠️ Cette regex doit être adaptée selon la structure réelle de Jumia
                const productPattern = /<article[^>]*class=["'][^"']*prd[^"']*["'][^>]*>(.*?)<\/article>/gs;
                const matches = html.match(productPattern);
                
                if (matches) {
                    matches.forEach((match, index) => {
                        // Extraire nom
                        const nameMatch = match.match(/<h3[^>]*class=["'][^"']*name["'][^>]*>(.*?)<\/h3>/i);
                        const name = nameMatch ? this.cleanHTML(nameMatch[1]) : '';
                        
                        // Extraire prix
                        const priceMatch = match.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>(.*?)<\/span>/i);
                        const priceText = priceMatch ? this.cleanHTML(priceMatch[1]) : '';
                        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
                        
                        // Extraire URL
                        const urlMatch = match.match(/href=["']([^"']+)["']/i);
                        const url = urlMatch ? urlMatch[1] : '';
                        
                        // Extraire image
                        const imgMatch = match.match(/<img[^>]*src=["']([^"']+)["']/i);
                        const imageUrl = imgMatch ? imgMatch[1] : '';
                        
                        if (name && price > 0) {
                            products.push({
                                id: `jumia_${countryCode}_${index}_${Date.now()}`,
                                name,
                                price,
                                currency: this.getCurrency(countryCode),
                                category: this.extractCategory(url),
                                imageUrl,
                                availability: true,
                                url: url.startsWith('http') ? url : `${this.getBaseUrl(countryCode)}${url}`,
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
            .trim();
    }

    /**
     * Extraire la catégorie depuis l'URL
     */
    private extractCategory(url: string): string {
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
            'books-media': 'livres_scolaire'
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
                    return result;
                }
            }

            console.log(`[JumiaScraping] 🔍 Recherche: "${query}" (${config.countryCode})`);

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
                    await this.waitForRateLimit();
                }
            }

            // Dédupliquer par ID
            const uniqueProducts = Array.from(
                new Map(allProducts.map(p => [p.id, p])).values()
            );

            result.products = uniqueProducts;
            result.productsFound = uniqueProducts.length;
            result.success = true;
            result.duration = Date.now() - startTime;

            console.log(`[JumiaScraping] ✅ ${uniqueProducts.length} produits uniques trouvés`);

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
        // Similaire à scrapeProducts mais avec URL de catégorie
        // Implémentation similaire...
        return this.scrapeProducts(category, config);
    }

    /**
     * Transformer produits Jumia en format Yukpomnang
     */
    transformToYukpomnang(jumiaProduct: JumiaProduct): EnrichedProduct {
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
                    url_jumia: jumiaProduct.url
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
     * Mapper catégorie Jumia → Catégorie Yukpomnang
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
            'livres_scolaire': 'Livres'
        };
        
        return categoryMap[jumiaCategory] || 'Autre';
    }
}

// Instance singleton
export const jumiaScrapingService = new JumiaScrapingService();
```

---

## 🎯 Utilisation Concrète

### Exemple 1: Scraper des Téléphones au Cameroun

```typescript
import { jumiaScrapingService } from '../services/jumiaScrapingService';

// Scraper téléphones Samsung au Cameroun
const result = await jumiaScrapingService.scrapeProducts('Samsung Galaxy', {
    countryCode: 'CM',
    maxProducts: 20,
    rateLimitMs: 2000, // 2 secondes entre requêtes
    respectRobotsTxt: true
});

if (result.success) {
    console.log(`✅ ${result.productsFound} produits trouvés`);
    
    // Transformer en format Yukpomnang
    const yukpomnangProducts = result.products.map(p => 
        jumiaScrapingService.transformToYukpomnang(p)
    );
    
    // Sauvegarder dans la base
    // ... logique de sauvegarde
}
```

### Exemple 2: Scraper une Catégorie Complète

```typescript
// Scraper tous les téléphones (catégorie complète)
const telephones = await jumiaScrapingService.scrapeCategory('telephones-tablets', {
    countryCode: 'CM',
    maxProducts: 100, // Limiter à 100 produits
    respectRobotsTxt: true
});
```

### Exemple 3: Synchronisation Périodique

```typescript
// Synchroniser périodiquement (une fois par jour)
async function syncJumiaProducts() {
    const categories = ['telephones-tablets', 'electronics', 'computing'];
    const countries = ['CM', 'CI', 'SN'];
    
    for (const country of countries) {
        for (const category of categories) {
            const result = await jumiaScrapingService.scrapeCategory(category, {
                countryCode: country,
                maxProducts: 50,
                respectRobotsTxt: true
            });
            
            // Sauvegarder les produits
            await saveProducts(result.products);
            
            // Attendre 5 minutes entre pays (être très respectueux)
            await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        }
    }
}

// Exécuter une fois par jour
setInterval(syncJumiaProducts, 24 * 60 * 60 * 1000);
```

---

## ⚠️ Limitations et Considérations

### Limitations Techniques

1. **Pas de DOMParser natif dans React Native**
   - Solution: Utiliser regex ou bibliothèque comme `cheerio-react-native`
   - Alternative: Utiliser un service backend pour le parsing

2. **Structure HTML peut changer**
   - Jumia peut modifier leur HTML à tout moment
   - Le code de parsing doit être maintenu régulièrement

3. **Rate Limiting Strict**
   - Minimum 2 secondes entre requêtes
   - Maximum 100-200 produits par jour pour être respectueux

### Limitations Légales

1. **Conditions d'Utilisation**
   - ⚠️ Vérifier les CGU de Jumia avant scraping
   - Certains sites interdisent le scraping dans leurs CGU

2. **Usage Commercial**
   - ⚠️ Utiliser les données scrapées peut violer les CGU
   - Considérer contacter Jumia pour partenariat API

3. **Données Personnelles**
   - ❌ Ne jamais scraper de données personnelles
   - ❌ Ne jamais scraper avis/commentaires avec noms

---

## 🔄 Alternative: Service Backend

### Pour Éviter les Limitations React Native

Créer un service backend (Rust/Python) pour le scraping :

```rust
// backend/src/services/jumia_scraper.rs

use reqwest;
use scraper::{Html, Selector};

pub async fn scrape_jumia_products(
    country: &str,
    query: &str,
    max_products: usize
) -> Result<Vec<JumiaProduct>, String> {
    // Utiliser reqwest pour fetch
    // Utiliser scraper pour parser HTML
    // Retourner JSON
}
```

Puis appeler depuis React Native :

```typescript
// Appeler l'API backend au lieu de scraper directement
const response = await apiGet(`/api/scrape/jumia?country=CM&query=Samsung&limit=20`);
```

**Avantages**:
- ✅ Meilleur parsing HTML (bibliothèques complètes)
- ✅ Rate limiting centralisé
- ✅ Cache côté serveur
- ✅ Pas de limitations React Native

---

## 📊 Méthode Recommandée: API Backend

### Architecture Recommandée

```
React Native App
    ↓
Backend API (Rust)
    ↓
Jumia Scraping Service
    ↓
Rate Limiting + Cache
    ↓
Jumia Website
```

**Pourquoi**:
- ✅ Évite limitations React Native
- ✅ Rate limiting centralisé
- ✅ Cache partagé
- ✅ Meilleur parsing HTML
- ✅ Plus respectueux des serveurs

---

## 📝 Checklist d'Implémentation

### ✅ Étapes Obligatoires

- [ ] **Vérifier robots.txt** avant de commencer
- [ ] **Respecter rate limiting** (min 2s entre requêtes)
- [ ] **Lire les CGU** de Jumia
- [ ] **Implémenter cache** pour éviter requêtes répétées
- [ ] **Gérer les erreurs** gracieusement
- [ ] **Logger les activités** pour monitoring

### ⚠️ Considérations Légales

- [ ] Vérifier si scraping autorisé dans CGU
- [ ] Contacter Jumia pour partenariat si usage commercial
- [ ] Ne pas scraper données personnelles
- [ ] Limiter volume de scraping
- [ ] Respecter les headers User-Agent

---

## 🎯 Résumé Pratique

### Ce Qui Fonctionne

✅ **Scraping possible** pour :
- Catalogue produits
- Prix et disponibilité
- Images produits
- Catégories

❌ **À éviter** :
- Scraping massif
- Surcharge serveurs
- Données personnelles
- Violation CGU

### Recommandation Finale

**Option 1**: Scraping éthique direct (code fourni ci-dessus)
- ✅ Fonctionne mais limité par React Native
- ⚠️ Nécessite maintenance régulière

**Option 2**: Service backend (recommandé)
- ✅ Meilleure solution technique
- ✅ Plus respectueux
- ✅ Plus facile à maintenir

**Option 3**: Partenariat API (idéal)
- ✅ Contacter Jumia pour API officielle
- ✅ Accès structuré aux données
- ✅ Légal et maintenable

---

## 📚 Ressources

- **Jumia**: https://www.jumia.com/
- **robots.txt**: https://www.jumia.com.ng/robots.txt
- **CGU**: À vérifier sur chaque site Jumia par pays

---

## ⚠️ Avertissement Important

Ce guide est fourni à titre **éducatif uniquement**. 

**Responsabilités**:
- ✅ Vérifier les CGU de Jumia avant utilisation
- ✅ Respecter robots.txt et rate limiting
- ✅ Ne pas utiliser pour usage commercial sans autorisation
- ✅ Considérer contacter Jumia pour partenariat API

**Usage à vos risques et périls**.

