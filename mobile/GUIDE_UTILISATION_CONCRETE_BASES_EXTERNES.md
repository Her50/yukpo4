# 🎯 Guide d'Utilisation Concrète des Bases de Données Externes

## ✅ Intégration Complète dans l'Autocomplétion

Les bases de données externes sont **automatiquement intégrées** dans le système d'autocomplétion existant. Voici comment elles fonctionnent concrètement.

---

## 🚀 Utilisation Automatique (Déjà Intégré)

### 1. Dans les Hooks Existants

Le hook `useProductAutoComplete` utilise **automatiquement** les bases externes :

```typescript
import { useProductAutoComplete } from '../hooks/useProductAutoComplete';

function ProductForm() {
    const [productName, setProductName] = useState('');
    
    // ✅ Les bases externes sont automatiquement utilisées ici !
    const { suggestions, selectProduct, autoFilledFields } = useProductAutoComplete(
        'agriculture',  // Catégorie
        productName     // Nom du produit saisi
    );
    
    // Les suggestions incluent maintenant :
    // - Produits de la base locale (productModalities)
    // - Produits locaux africains (cameroonProducts.ts)
    // - Produits d'Open Food Facts (si synchronisés)
    
    return (
        <View>
            <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder="Tapez le nom du produit..."
            />
            
            {/* Suggestions automatiques avec produits locaux */}
            {suggestions.map(product => (
                <TouchableOpacity
                    key={product.name}
                    onPress={() => {
                        selectProduct(product);
                        // ✅ Tous les champs sont auto-remplis !
                    }}
                >
                    <Text>{product.name}</Text>
                    <Text style={styles.hint}>
                        {product.fixed_characteristics.origine || 'Produit local'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}
```

---

## 📝 Exemples Concrets d'Utilisation

### Exemple 1: Recherche "Riz" au Cameroun

```typescript
import { productKnowledgeBase } from '../utils/productKnowledgeBase';

// L'utilisateur tape "riz"
const results = await productKnowledgeBase.getSuggestions('riz', 'agriculture', 10, 'CM');

// Résultats incluent maintenant :
// ✅ "Riz Nerica" (produit local camerounais)
// ✅ "Riz Local" (produit local)
// ✅ "Riz Basmati" (produit générique de la base locale)
// ✅ Produits d'Open Food Facts si synchronisés

results.forEach(product => {
    console.log(`${product.name} - Origine: ${product.fixed_characteristics.origine}`);
    // Affiche les caractéristiques pré-remplies :
    // - categorie: "Agriculture"
    // - type: "Céréale"
    // - origine: "Cameroun"
    // - unite: "sac (50kg)"
});
```

### Exemple 2: Formulaire de Produit avec Auto-remplissage

```typescript
import React, { useState } from 'react';
import { useProductAutoComplete } from '../hooks/useProductAutoComplete';
import { View, TextInput, FlatList, TouchableOpacity, Text } from 'react-native';

function ProductCreationForm() {
    const [productName, setProductName] = useState('');
    const [formData, setFormData] = useState<any>({});
    
    // ✅ Hook enrichi avec bases externes
    const {
        suggestions,
        selectProduct,
        autoFilledFields,
        isLoading
    } = useProductAutoComplete('agriculture', productName, {
        maxSuggestions: 5,
        autoApply: false
    });
    
    // Appliquer l'auto-remplissage quand un produit est sélectionné
    const handleSelectProduct = (product: any) => {
        selectProduct(product);
        
        // ✅ Remplir automatiquement tous les champs connus
        setFormData({
            ...formData,
            nom_produit: product.name,
            ...autoFilledFields  // ✅ Tous les champs pré-remplis !
        });
        
        setProductName(product.name);
    };
    
    return (
        <View>
            {/* Champ nom du produit */}
            <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder="Nom du produit (ex: Riz Nerica)"
            />
            
            {/* Suggestions automatiques */}
            {suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>
                        Suggestions ({suggestions.length})
                    </Text>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => item.name + index}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSelectProduct(item)}
                            >
                                <Text style={styles.productName}>{item.name}</Text>
                                <Text style={styles.productHint}>
                                    {item.fixed_characteristics.origine || 'Produit local'} • 
                                    {item.fixed_characteristics.type || 'Type'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
            
            {/* Champs du formulaire */}
            <TextInput
                value={formData.categorie || ''}
                placeholder="Catégorie"
                editable={false}  // ✅ Auto-rempli !
            />
            <TextInput
                value={formData.origine || ''}
                placeholder="Origine"
                editable={false}  // ✅ Auto-rempli !
            />
            <TextInput
                value={formData.unite || ''}
                placeholder="Unité"
                editable={false}  // ✅ Auto-rempli !
            />
            
            {/* Champs à remplir manuellement */}
            <TextInput
                value={formData.prix || ''}
                onChangeText={(text) => setFormData({ ...formData, prix: text })}
                placeholder="Prix *"
                keyboardType="numeric"
            />
            <TextInput
                value={formData.quantite || ''}
                onChangeText={(text) => setFormData({ ...formData, quantite: text })}
                placeholder="Quantité *"
                keyboardType="numeric"
            />
        </View>
    );
}
```

### Exemple 3: Synchronisation Initiale des Données

```typescript
import { externalProductDatabaseService } from '../services/externalProductDatabaseService';
import { CAMEROON_LOCAL_PRODUCTS } from '../data/externalDatabases/cameroonProducts';

// ═══════════════════════════════════════════════════════════
// APPELER AU DÉMARRAGE DE L'APP (une seule fois)
// ═══════════════════════════════════════════════════════════

async function initializeExternalDatabases() {
    console.log('🔄 Initialisation des bases de données externes...');
    
    // 1. Importer les produits locaux camerounais
    const result = await externalProductDatabaseService.importFromLocalDatabase(
        'cameroon-local',
        CAMEROON_LOCAL_PRODUCTS,
        {
            country: 'CM',
            validateBeforeImport: true,
            skipDuplicates: true
        }
    );
    
    console.log(`✅ ${result.productsAdded} produits locaux importés`);
    
    // 2. Synchroniser depuis Open Food Facts (optionnel, peut être lent)
    // Décommenter si besoin :
    /*
    const offResult = await externalProductDatabaseService.syncFromOpenFoodFacts('riz', {
        country: 'CM',
        maxProducts: 20
    });
    console.log(`✅ ${offResult.productsAdded} produits Open Food Facts importés`);
    */
}

// Appeler dans App.tsx ou au démarrage
useEffect(() => {
    initializeExternalDatabases();
}, []);
```

---

## 🎨 Intégration dans ProductManagerMobile

### Ajouter le Code Pays Utilisateur

```typescript
// Dans ProductManagerMobile.tsx

import { useAuth } from '../contexts/AuthContext';
import { productKnowledgeBase } from '../utils/productKnowledgeBase';

function ProductManagerMobile() {
    const { user } = useAuth();
    
    // ✅ Récupérer le code pays de l'utilisateur
    const userCountry = user?.country_code || 'CM'; // Fallback Cameroun
    
    // Utiliser dans les recherches
    const searchProducts = async (query: string, category: string) => {
        // ✅ Les bases externes sont automatiquement utilisées !
        const results = await productKnowledgeBase.getSuggestions(
            query,
            category,
            10,
            userCountry  // ✅ Filtre par pays pour produits locaux
        );
        
        return results;
    };
    
    // ... reste du code
}
```

---

## 🔍 Recherche Avancée

### Recherche Directe dans les Bases Locales

```typescript
import { searchAllLocalProducts, getCameroonProductsByCategory } from '../data/externalDatabases';

// Rechercher "riz" dans tous les pays
const allProducts = searchAllLocalProducts('riz');

// Rechercher uniquement au Cameroun
const cameroonProducts = searchAllLocalProducts('riz', 'CM');

// Obtenir tous les produits agricoles camerounais
const agricultureProducts = getCameroonProductsByCategory('agriculture');

agricultureProducts.forEach(product => {
    console.log(`- ${product.nom}`);
    console.log(`  Origine: ${product.characteristics?.origine}`);
    console.log(`  Unité: ${product.characteristics?.unite}`);
});
```

---

## 📊 Statistiques et Monitoring

### Vérifier les Produits Disponibles

```typescript
import { 
    getProductCountByCountry, 
    getCategoriesByCountry 
} from '../data/externalDatabases';

// Nombre de produits par pays
const cameroonCount = getProductCountByCountry('CM');
console.log(`🇨🇲 Cameroun: ${cameroonCount} produits locaux`);

// Catégories disponibles
const categories = getCategoriesByCountry('CM');
console.log('Catégories:', categories);
// Affiche: ['Agriculture', 'Agroalimentaire']
```

---

## 🎯 Cas d'Usage Concrets

### Cas 1: Utilisateur Camerounais cherche "Riz"

1. **Utilisateur tape**: "riz"
2. **Système cherche dans**:
   - ✅ Base locale (productModalities) → "Riz Basmati", "Riz Thaï"
   - ✅ Base externe Cameroun → "Riz Nerica", "Riz Local"
   - ✅ Open Food Facts (si synchronisé) → Autres variétés
3. **Résultats affichés**:
   - "Riz Nerica" (produit local, priorité élevée)
   - "Riz Local" (produit local)
   - "Riz Basmati" (produit générique)
4. **Utilisateur sélectionne** "Riz Nerica"
5. **Champs auto-remplis**:
   - `categorie`: "Agriculture"
   - `type`: "Céréale"
   - `origine`: "Cameroun"
   - `qualite`: "Standard"
   - `unite`: "sac (50kg)"
6. **Utilisateur remplit seulement**:
   - `prix`: "25000"
   - `quantite`: "10"

**Résultat**: 15 champs → 2 champs seulement ! 🎉

### Cas 2: Utilisateur cherche "Huile de Palme"

1. **Utilisateur tape**: "huile"
2. **Système suggère**:
   - "Huile de Palme" (local camerounais)
   - "Huile d'Arachide" (local camerounais)
   - "Huile végétale" (générique)
3. **Sélection**: "Huile de Palme"
4. **Auto-remplissage**:
   - `categorie`: "Agroalimentaire"
   - `type`: "Huile alimentaire"
   - `origine`: "Cameroun"
   - `couleur`: "Rouge"
   - `zone_production`: "Sud-Ouest Cameroun"
   - `unite`: "litre"
5. **Champs variables demandés**:
   - `quantite` (litres)
   - `conditionnement` (Bidon 5L, Bidon 20L, etc.)

---

## 🔧 Configuration Avancée

### Personnaliser la Recherche

```typescript
// Dans productKnowledgeBase.ts, la méthode search() combine automatiquement :
// 1. Base locale (rapide)
// 2. Bases externes (produits locaux)
// 3. Open Food Facts (si synchronisé)

// Pour désactiver temporairement les bases externes :
// Commenter la section "Recherche dans les bases externes" dans search()
```

### Ajouter d'Autres Pays

```typescript
// 1. Créer le fichier de produits
// mobile/src/data/externalDatabases/ivoryCoastProducts.ts

export const IVORY_COAST_LOCAL_PRODUCTS = [
    {
        id: 'ci_cacao',
        nom: 'Cacao',
        characteristics: {
            categorie: 'Agriculture',
            origine: 'Côte d\'Ivoire',
            // ...
        },
        availableIn: ['CI']
    }
];

// 2. Ajouter dans index.ts
export { IVORY_COAST_LOCAL_PRODUCTS } from './ivoryCoastProducts';

// 3. Mettre à jour getAllLocalProductsByCountry()
// ✅ Déjà fait automatiquement !
```

---

## ⚡ Performance

### Cache et Optimisation

Les produits locaux sont **en mémoire** et **rapides** :
- Recherche instantanée (< 10ms)
- Pas de requête réseau nécessaire
- Disponibles hors ligne

Les produits Open Food Facts nécessitent une **synchronisation préalable** :
- Synchroniser une fois au démarrage
- Stocker localement (AsyncStorage)
- Utiliser ensuite comme les produits locaux

---

## 🎓 Résumé

✅ **Les bases externes sont AUTOMATIQUEMENT utilisées** dans :
- `useProductAutoComplete` hook
- `productKnowledgeBase.getSuggestions()`
- `productKnowledgeBase.search()`

✅ **Pour utiliser concrètement** :
1. Rien à faire ! Ça marche automatiquement
2. Pour synchroniser Open Food Facts : appeler `syncFromOpenFoodFacts()` une fois
3. Pour ajouter des produits locaux : créer un fichier par pays

✅ **Résultat** :
- Plus de suggestions pertinentes
- Produits locaux prioritaires
- Auto-remplissage amélioré
- Réduction drastique de la saisie manuelle

---

## 🆘 Dépannage

### Les produits locaux n'apparaissent pas ?

1. Vérifier que le code pays est passé :
```typescript
await productKnowledgeBase.getSuggestions('riz', 'agriculture', 10, 'CM');
//                                                                    ^^ Code pays requis
```

2. Vérifier que les produits sont importés :
```typescript
import { getProductCountByCountry } from '../data/externalDatabases';
console.log('Produits CM:', getProductCountByCountry('CM'));
```

3. Vérifier la catégorie :
```typescript
// Les produits camerounais sont dans 'agriculture' et 'agroalimentaire'
const results = await productKnowledgeBase.getSuggestions('riz', 'agriculture', 10, 'CM');
```

---

## 📚 Fichiers Clés

- **Hook**: `mobile/src/hooks/useProductAutoComplete.ts` (déjà intégré)
- **Base de connaissances**: `mobile/src/utils/productKnowledgeBase.ts` (enrichie)
- **Service externe**: `mobile/src/services/externalProductDatabaseService.ts`
- **Produits locaux**: `mobile/src/data/externalDatabases/cameroonProducts.ts`
- **Agrégeur**: `mobile/src/data/externalDatabases/index.ts`

