# 🎯 Exemples Concrets: Scraping Jumia

## 🚀 Utilisation Pratique

### Exemple 1: Scraper des Téléphones au Cameroun

```typescript
import { jumiaScrapingService } from '../services/jumiaScrapingService';

async function scrapeTelephonesCameroun() {
    // Scraper téléphones Samsung au Cameroun
    const result = await jumiaScrapingService.scrapeProducts('Samsung Galaxy', {
        countryCode: 'CM',
        maxProducts: 20,
        rateLimitMs: 2000, // 2 secondes entre requêtes
        respectRobotsTxt: true
    });

    if (result.success) {
        console.log(`✅ ${result.productsFound} produits trouvés`);
        console.log(`⏱️ Durée: ${result.duration}ms`);
        
        // Afficher les produits
        result.products.forEach(product => {
            console.log(`- ${product.name}: ${product.price} ${product.currency}`);
            console.log(`  Marque: ${product.brand || 'N/A'}`);
            console.log(`  URL: ${product.url}`);
        });
        
        // Transformer en format Yukpomnang
        const yukpomnangProducts = result.products.map(p => 
            jumiaScrapingService.transformToYukpomnang(p)
        );
        
        return yukpomnangProducts;
    } else {
        console.error('Erreurs:', result.errors);
        return [];
    }
}
```

### Exemple 2: Scraper une Catégorie Complète

```typescript
async function scrapeElectroniqueCameroun() {
    // Scraper tous les produits électroniques
    const result = await jumiaScrapingService.scrapeCategory('electronics', {
        countryCode: 'CM',
        maxProducts: 50,
        respectRobotsTxt: true
    });
    
    return result.products;
}
```

### Exemple 3: Scraper Plusieurs Pays

```typescript
async function scrapeMultiPays(query: string) {
    const countries = ['CM', 'CI', 'SN'];
    const allProducts: any[] = [];
    
    for (const country of countries) {
        console.log(`Scraping ${country}...`);
        
        const result = await jumiaScrapingService.scrapeProducts(query, {
            countryCode: country,
            maxProducts: 20,
            respectRobotsTxt: true
        });
        
        if (result.success) {
            allProducts.push(...result.products);
        }
        
        // Attendre 5 secondes entre pays (être très respectueux)
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return allProducts;
}
```

---

## 🔗 Intégration avec l'Autocomplétion

### Enrichir productKnowledgeBase avec Jumia

```typescript
// mobile/src/utils/productKnowledgeBase.ts (modification)

import { jumiaScrapingService } from '../services/jumiaScrapingService';

// Dans la méthode search() :
async search(query: string, category?: string, countryCode?: string): Promise<ProductKnowledge[]> {
    // ... recherche locale existante ...
    // ... recherche bases externes ...
    
    // 4️⃣ Recherche dans Jumia (si pays supporté)
    if (countryCode && ['CM', 'CI', 'SN', 'NG', 'KE', 'GH'].includes(countryCode)) {
        try {
            // Scraper Jumia (avec cache et rate limiting)
            const jumiaResult = await jumiaScrapingService.scrapeProducts(query, {
                countryCode,
                maxProducts: 10, // Limiter pour ne pas surcharger
                respectRobotsTxt: true
            });
            
            if (jumiaResult.success) {
                jumiaResult.products.forEach(product => {
                    const enriched = jumiaScrapingService.transformToYukpomnang(product);
                    const knowledge = this.transformExternalToKnowledge(enriched);
                    
                    if (!category || knowledge.category === category) {
                        results.set(knowledge.name, knowledge);
                    }
                });
            }
        } catch (error) {
            console.error('[ProductKnowledgeBase] Erreur Jumia:', error);
        }
    }
    
    // ... tri et retour ...
}
```

---

## 📊 Synchronisation Périodique

### Scraper et Sauvegarder une Fois par Jour

```typescript
// mobile/src/services/jumiaSyncService.ts

import { jumiaScrapingService } from './jumiaScrapingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncConfig {
    categories: string[];
    countries: string[];
    maxProductsPerCategory: number;
}

class JumiaSyncService {
    /**
     * Synchroniser les produits Jumia une fois par jour
     */
    async syncDaily(config: SyncConfig) {
        console.log('[JumiaSync] 🔄 Démarrage synchronisation quotidienne');
        
        const allProducts: any[] = [];
        
        for (const country of config.countries) {
            for (const category of config.categories) {
                try {
                    console.log(`[JumiaSync] Scraping ${category} (${country})...`);
                    
                    const result = await jumiaScrapingService.scrapeCategory(category, {
                        countryCode: country,
                        maxProducts: config.maxProductsPerCategory,
                        respectRobotsTxt: true
                    });
                    
                    if (result.success) {
                        const transformed = result.products.map(p => 
                            jumiaScrapingService.transformToYukpomnang(p)
                        );
                        
                        allProducts.push(...transformed);
                        
                        console.log(`[JumiaSync] ✅ ${result.productsFound} produits ${category} (${country})`);
                    }
                    
                    // Attendre 30 secondes entre catégories (très respectueux)
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    
                } catch (error: any) {
                    console.error(`[JumiaSync] ❌ Erreur ${category} (${country}):`, error.message);
                }
            }
            
            // Attendre 5 minutes entre pays
            if (country !== config.countries[config.countries.length - 1]) {
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
            }
        }
        
        // Sauvegarder dans AsyncStorage
        await this.saveProducts(allProducts);
        
        console.log(`[JumiaSync] ✅ Synchronisation terminée: ${allProducts.length} produits`);
        
        return allProducts;
    }
    
    /**
     * Sauvegarder les produits scrapés
     */
    private async saveProducts(products: any[]): Promise<void> {
        try {
            const key = '@yukpomnang_jumia_products';
            await AsyncStorage.setItem(key, JSON.stringify({
                products,
                lastSync: new Date().toISOString()
            }));
            console.log(`[JumiaSync] ✅ ${products.length} produits sauvegardés`);
        } catch (error) {
            console.error('[JumiaSync] ❌ Erreur sauvegarde:', error);
        }
    }
    
    /**
     * Charger les produits depuis le cache
     */
    async loadCachedProducts(): Promise<any[]> {
        try {
            const key = '@yukpomnang_jumia_products';
            const cached = await AsyncStorage.getItem(key);
            
            if (cached) {
                const data = JSON.parse(cached);
                const lastSync = new Date(data.lastSync);
                const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
                
                // Utiliser cache si moins de 24h
                if (hoursSinceSync < 24) {
                    console.log(`[JumiaSync] ✅ Utilisation cache (${hoursSinceSync.toFixed(1)}h)`);
                    return data.products;
                }
            }
        } catch (error) {
            console.error('[JumiaSync] ❌ Erreur chargement cache:', error);
        }
        
        return [];
    }
}

export const jumiaSyncService = new JumiaSyncService();
```

### Utiliser dans App.tsx

```typescript
// App.tsx

import { useEffect } from 'react';
import { jumiaSyncService } from './src/services/jumiaSyncService';

function App() {
    useEffect(() => {
        // Synchroniser Jumia une fois par jour
        const syncJumia = async () => {
            // Vérifier si déjà synchronisé aujourd'hui
            const cached = await jumiaSyncService.loadCachedProducts();
            
            if (cached.length === 0) {
                // Synchroniser
                await jumiaSyncService.syncDaily({
                    categories: ['telephones-tablets', 'electronics', 'computing'],
                    countries: ['CM', 'CI', 'SN'],
                    maxProductsPerCategory: 30
                });
            }
        };
        
        // Attendre 10 secondes après démarrage pour ne pas bloquer
        setTimeout(syncJumia, 10000);
        
        // Puis synchroniser toutes les 24h
        const interval = setInterval(syncJumia, 24 * 60 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, []);
    
    // ... reste du code App
}
```

---

## ⚠️ Limitations et Solutions

### Problème: React Native ne supporte pas DOMParser

**Solution 1**: Utiliser un service backend (Recommandé)

```typescript
// Appeler votre backend Rust qui fait le scraping
const response = await apiGet(`/api/scrape/jumia?country=CM&query=Samsung&limit=20`);
```

**Solution 2**: Utiliser une bibliothèque React Native

```bash
npm install cheerio-react-native
```

```typescript
import * as cheerio from 'cheerio-react-native';

// Parser HTML avec cheerio
const $ = cheerio.load(html);
const products = $('article.prd').map((i, el) => {
    return {
        name: $(el).find('.name').text(),
        price: $(el).find('.price').text(),
        // ...
    };
}).get();
```

---

## 📝 Checklist d'Implémentation

### ✅ Avant de Commencer

- [ ] Lire robots.txt de Jumia
- [ ] Lire les CGU de Jumia
- [ ] Vérifier si scraping autorisé
- [ ] Configurer rate limiting strict

### ✅ Implémentation

- [ ] Créer service de scraping
- [ ] Implémenter vérification robots.txt
- [ ] Implémenter rate limiting
- [ ] Implémenter cache
- [ ] Gérer les erreurs

### ✅ Tests

- [ ] Tester avec 1-2 produits
- [ ] Vérifier rate limiting
- [ ] Vérifier cache
- [ ] Tester plusieurs pays

### ✅ Déploiement

- [ ] Limiter volume de scraping
- [ ] Logger les activités
- [ ] Monitorer les erreurs
- [ ] Respecter les limites

---

## 🎯 Résumé Pratique

### Ce Qui Fonctionne

✅ **Scraping possible** :
- Catalogue produits
- Prix et disponibilité
- Images
- Catégories

### Ce Qui Ne Fonctionne Pas

❌ **React Native direct** :
- Pas de DOMParser natif
- Parsing HTML limité avec regex
- Nécessite bibliothèque ou backend

### Recommandation

**Utiliser un service backend** pour le scraping :
- ✅ Meilleur parsing HTML
- ✅ Rate limiting centralisé
- ✅ Cache partagé
- ✅ Plus respectueux

---

## 📚 Code Complet Disponible

Le service complet est disponible dans :
- `mobile/src/services/jumiaScrapingService.ts`
- Guide détaillé: `GUIDE_SCRAPING_ETHIQUE_JUMIA.md`

