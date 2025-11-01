# 📖 Exemple d'Utilisation: Bases de Données Externes

## 🎯 Objectif

Ce guide montre comment utiliser le système d'import et synchronisation des bases de données externes pour enrichir l'autocomplétion de produits.

---

## 🚀 Démarrage Rapide

### 1. Synchroniser depuis Open Food Facts

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';

// Synchroniser des produits alimentaires pour le Cameroun
const result = await externalProductDatabaseService.syncFromOpenFoodFacts('riz', {
    country: 'CM',
    maxProducts: 20,
    validateBeforeImport: true,
    skipDuplicates: true
});

console.log(`✅ ${result.productsAdded} produits ajoutés`);
console.log(`⚠️ ${result.productsSkipped} produits ignorés`);
console.log(`❌ ${result.errors.length} erreurs`);
```

### 2. Importer des Produits Locaux

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';
import { CAMEROON_LOCAL_PRODUCTS } from '../data/externalDatabases/cameroonProducts';

// Importer tous les produits locaux camerounais
const result = await externalProductDatabaseService.importFromLocalDatabase(
    'cameroon-local',
    CAMEROON_LOCAL_PRODUCTS,
    {
        country: 'CM',
        categories: ['agriculture', 'agroalimentaire'],
        validateBeforeImport: true,
        skipDuplicates: true
    }
);

console.log(`✅ Import terminé: ${result.productsAdded} produits`);
```

### 3. Synchroniser Toutes les Sources

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';

// Synchroniser toutes les sources activées pour le Cameroun
const results = await externalProductDatabaseService.syncAllSources('CM');

results.forEach(result => {
    console.log(`📦 ${result.source}: ${result.productsAdded} produits ajoutés`);
});
```

---

## 🔍 Recherche dans les Bases Locales

### Rechercher un Produit

```typescript
import { searchAllLocalProducts } from '../data/externalDatabases';

// Rechercher "riz" dans tous les pays
const products = searchAllLocalProducts('riz');

// Rechercher uniquement au Cameroun
const cameroonProducts = searchAllLocalProducts('riz', 'CM');

products.forEach(product => {
    console.log(`- ${product.nom} (${product.characteristics?.categorie})`);
});
```

### Obtenir les Produits par Catégorie

```typescript
import { getCameroonProductsByCategory } from '../data/externalDatabases/cameroonProducts';

// Obtenir tous les produits agricoles
const agricultureProducts = getCameroonProductsByCategory('agriculture');

// Obtenir tous les produits agroalimentaires
const agroProducts = getCameroonProductsByCategory('agroalimentaire');
```

---

## 🎨 Intégration avec l'Autocomplétion

### Utiliser dans un Hook

```typescript
import { useProductAutoComplete } from '../hooks/useProductAutoComplete';
import { searchAllLocalProducts } from '../data/externalDatabases';

function ProductForm({ countryCode }: { countryCode: string }) {
    const [productName, setProductName] = useState('');
    
    // Autocomplétion standard
    const { suggestions, selectProduct, autoFilledFields } = useProductAutoComplete(
        'agriculture',
        productName
    );
    
    // Enrichir avec produits locaux
    useEffect(() => {
        if (productName.length >= 2) {
            const localProducts = searchAllLocalProducts(productName, countryCode);
            
            // Fusionner avec les suggestions existantes
            // (logique de fusion à implémenter)
        }
    }, [productName, countryCode]);
    
    return (
        // Votre formulaire
    );
}
```

---

## 📊 Statistiques et Monitoring

### Obtenir les Statistiques

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';
import { getProductCountByCountry, getCategoriesByCountry } from '../data/externalDatabases';

// Nombre de produits par pays
const cameroonCount = getProductCountByCountry('CM');
console.log(`🇨🇲 Cameroun: ${cameroonCount} produits`);

// Catégories disponibles
const categories = getCategoriesByCountry('CM');
console.log('Catégories:', categories);

// Sources disponibles
const sources = externalProductDatabaseService.getAvailableSources();
sources.forEach(source => {
    console.log(`- ${source.name}: ${source.enabled ? '✅' : '❌'}`);
});
```

---

## 🔄 Synchronisation Automatique

### Mettre en Place une Synchronisation Périodique

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';

// Synchroniser toutes les heures
setInterval(async () => {
    const results = await externalProductDatabaseService.syncAllSources('CM');
    
    const totalAdded = results.reduce((sum, r) => sum + r.productsAdded, 0);
    console.log(`🔄 Synchronisation automatique: ${totalAdded} produits ajoutés`);
}, 60 * 60 * 1000); // 1 heure
```

---

## 🛠️ Personnalisation

### Ajouter une Nouvelle Source

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';

// Définir une nouvelle source
const newSource = {
    id: 'my-custom-source',
    name: 'Ma Source Personnalisée',
    type: 'api' as const,
    url: 'https://api.example.com/products',
    enabled: true,
    country: 'CM',
    categories: ['agriculture']
};

// (À implémenter: méthode pour ajouter une source)
```

### Créer une Base Locale pour un Nouveau Pays

```typescript
// mobile/src/data/externalDatabases/nigeriaProducts.ts

import { EnrichedProduct } from '../enrichedProductDatabase';

export const NIGERIA_LOCAL_PRODUCTS: Partial<EnrichedProduct>[] = [
    {
        id: 'ng_yam',
        nom: 'Yam',
        characteristics: {
            categorie: 'Agriculture',
            type: 'Tubercule',
            origine: 'Nigeria',
            unite: 'kg'
        },
        availableIn: ['NG']
    }
    // ... autres produits
];
```

---

## ⚠️ Meilleures Pratiques

1. **Validation**: Toujours valider les données avant import
2. **Doublons**: Utiliser `skipDuplicates: true` pour éviter les doublons
3. **Rate Limiting**: Respecter les limites des APIs externes
4. **Géolocalisation**: Filtrer par pays pour des résultats pertinents
5. **Cache**: Mettre en cache les résultats pour améliorer les performances
6. **Monitoring**: Surveiller les erreurs de synchronisation

---

## 🐛 Dépannage

### Erreurs de Synchronisation

```typescript
const result = await externalProductDatabaseService.syncFromOpenFoodFacts('riz');

if (!result.success) {
    console.error('Erreurs:', result.errors);
    
    // Vérifier la connexion
    // Vérifier les permissions API
    // Vérifier le format des données
}
```

### Produits Non Trouvés

```typescript
// Vérifier les sources activées
const sources = externalProductDatabaseService.getSourcesForCountry('CM');
console.log('Sources activées:', sources);

// Vérifier les produits locaux
const localProducts = searchAllLocalProducts('riz', 'CM');
console.log('Produits locaux trouvés:', localProducts.length);
```

---

## 📚 Ressources

- [Guide Complet](./GUIDE_BASES_DONNEES_PRODUITS_AFRICAINS.md)
- [Service d'Import](../src/services/externalProductDatabaseService.ts)
- [Produits Camerounais](../src/data/externalDatabases/cameroonProducts.ts)

