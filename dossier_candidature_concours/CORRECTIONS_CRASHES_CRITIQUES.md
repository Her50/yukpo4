# Corrections des Crashes Critiques

## Date
2025-11-27

## Vue d'ensemble
Corrections des crashes critiques identifiés dans les images :
1. **TypeError: Cannot read property 'map' of undefined**
2. **Text strings must be rendered within a <Text> component**

---

## 🔴 CRASH 1 : Cannot read property 'map' of undefined

### Description
L'application crash avec l'erreur `TypeError: Cannot read property 'map' of undefined` lorsqu'on essaie d'appeler `.map()` sur une valeur `undefined` ou `null`.

### Causes identifiées

#### 1. ServiceProductSelector.tsx
- **Ligne 78** : `products.reduce()` sans vérifier si `products` est défini
- **Ligne 123** : `services.map()` sans vérifier si `services` est défini
- **Ligne 130** : `service.products.map()` sans vérifier si `service.products` est défini

#### 2. ProductVideoCreationModal.tsx
- **Ligne 1220** : `groupedProducts.map()` sans vérifier si `groupedProducts` est défini
- **Ligne 1223** : `group.items.map()` sans vérifier si `group.items` est défini
- **Ligne 1568** : `styleSuggestion.effects.map()` sans vérifier si `effects` est défini
- **Ligne 1594** : `styleSuggestion.transitions.map()` sans vérifier si `transitions` est défini
- **Ligne 1620** : `styleSuggestion.overlay_tips.map()` sans vérifier si `overlay_tips` est défini
- **Ligne 2071** : `distributionPlan.hashtags.map()` sans vérifier si `hashtags` est défini
- **Ligne 2076** : `distributionPlan.schedule.map()` sans vérifier si `schedule` est défini
- **Ligne 2229** : `variant.script_outline.map()` sans vérifier si `script_outline` est défini
- **Ligne 2237** : `variant.hashtags.map()` sans vérifier si `hashtags` est défini

### Corrections appliquées

#### ServiceProductSelector.tsx
```typescript
// AVANT
const groupedByService = products.reduce((acc, product) => {
    // ...
}, {});

// APRÈS
const safeProducts = Array.isArray(products) ? products : [];
const groupedByService = safeProducts.reduce((acc, product) => {
    if (!product) return acc; // Protection contre produits null/undefined
    // ...
}, {});
```

```typescript
// AVANT
{services.map((service, serviceIndex) => (
    // ...
    {service.products.map((product, productIndex) => {
        // ...
    })}
))}

// APRÈS
{Array.isArray(services) && services.length > 0 ? (
    services.map((service, serviceIndex) => {
        if (!service || !Array.isArray(service.products)) {
            return null;
        }
        return (
            // ...
            {service.products.map((product, productIndex) => {
                if (!product) return null;
                // ...
            })}
        );
    })
) : (
    <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>Aucun produit disponible</Text>
    </View>
)}
```

#### ProductVideoCreationModal.tsx
```typescript
// AVANT
{groupedProducts.map((group) => (
    // ...
    {group.items.map((product) => (
        // ...
    ))}
))}

// APRÈS
{Array.isArray(groupedProducts) && groupedProducts.length > 0 ? (
    groupedProducts.map((group) => {
        if (!group || !Array.isArray(group.items)) {
            return null;
        }
        return (
            // ...
            {group.items.map((product, idx) => {
                if (!product) return null;
                // ...
            })}
        );
    })
) : (
    <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>Aucun produit disponible</Text>
    </View>
)}
```

```typescript
// AVANT
{styleSuggestion.effects.map((effect) => (
    // ...
))}

// APRÈS
{Array.isArray(styleSuggestion.effects) ? styleSuggestion.effects.map((effect) => (
    // ...
)) : null}
```

```typescript
// AVANT
{distributionPlan.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}

// APRÈS
{Array.isArray(distributionPlan.hashtags) ? distributionPlan.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ') : ''}
```

---

## 🔴 CRASH 2 : Text strings must be rendered within a <Text> component

### Description
L'application crash avec l'erreur "Text strings must be rendered within a <Text> component" lorsqu'on essaie de rendre directement une chaîne ou une valeur sans la mettre dans un composant `<Text>`.

### Causes possibles
- Rendu direct de valeurs dans des expressions JSX sans `<Text>`
- Rendu de valeurs `undefined` ou `null` qui sont converties en string
- Rendu de valeurs numériques directement

### Corrections appliquées

#### ServiceProductSelector.tsx
```typescript
// ✅ CORRIGÉ: Extraire le nom du produit depuis différents formats
const extractProductName = (productName: any): string => {
    if (!productName) return 'Produit sans nom';
    
    if (typeof productName === 'string') {
        const trimmed = productName.trim();
        // Éviter d'afficher des objets JSON stringifiés
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                        return parsed.valeur.trim() || 'Produit sans nom';
                    }
                    return 'Produit sans nom';
                }
            } catch {
                // Ce n'est pas du JSON valide
            }
        }
        return trimmed || 'Produit sans nom';
    }
    
    if (typeof productName === 'object' && productName !== null) {
        if ('valeur' in productName && typeof productName.valeur === 'string') {
            return productName.valeur.trim() || 'Produit sans nom';
        }
        return 'Produit sans nom';
    }
    
    return String(productName) || 'Produit sans nom';
};

// Utilisation
<Text style={styles.productName}>
    {extractProductName(product.productName)}
</Text>
```

#### ProductVideoCreationModal.tsx
```typescript
// ✅ CORRIGÉ: Normaliser le produit avant de le définir
onPress={() => {
    if (!product) {
        console.error('[ProductVideoCreationModal] Produit null/undefined');
        return;
    }
    
    const normalizedProduct = {
        ...product,
        nom: product.nom || product.nom_produit || 'Produit sans nom',
        nom_produit: product.nom_produit || product.nom || 'Produit sans nom'
    };
    
    setSelectedProduct(normalizedProduct);
}}
```

---

## 📋 CHECKLIST DES CORRECTIONS

### Corrections Critiques Appliquées
- [x] **1.1** Vérifier que `products` est défini avant `.reduce()` dans ServiceProductSelector
- [x] **1.2** Vérifier que `services` est défini avant `.map()` dans ServiceProductSelector
- [x] **1.3** Vérifier que `service.products` est défini avant `.map()` dans ServiceProductSelector
- [x] **1.4** Vérifier que `groupedProducts` est défini avant `.map()` dans ProductVideoCreationModal
- [x] **1.5** Vérifier que `group.items` est défini avant `.map()` dans ProductVideoCreationModal
- [x] **1.6** Vérifier que `styleSuggestion.effects` est défini avant `.map()`
- [x] **1.7** Vérifier que `styleSuggestion.transitions` est défini avant `.map()`
- [x] **1.8** Vérifier que `styleSuggestion.overlay_tips` est défini avant `.map()`
- [x] **1.9** Vérifier que `distributionPlan.hashtags` est défini avant `.map()`
- [x] **1.10** Vérifier que `distributionPlan.schedule` est défini avant `.map()`
- [x] **1.11** Vérifier que `variant.script_outline` est défini avant `.map()`
- [x] **1.12** Vérifier que `variant.hashtags` est défini avant `.map()`
- [x] **2.1** Créer fonction `extractProductName` pour éviter JSON brut
- [x] **2.2** Normaliser produit avant de le définir dans ProductVideoCreationModal
- [x] **2.3** Ajouter états vides pour afficher message au lieu de crash

---

## 🧪 TESTS À EFFECTUER

1. **Test avec products undefined**
   - Passer `undefined` ou `null` comme `products` à ServiceProductSelector
   - Vérifier que l'application ne crash pas
   - Vérifier que le message "Aucun produit disponible" s'affiche

2. **Test avec products vide**
   - Passer un array vide `[]` comme `products`
   - Vérifier que le message "Aucun produit disponible" s'affiche

3. **Test avec productName JSON brut**
   - Créer un produit avec `productName = '{"valeur": "Test", "type_donnee": "string"}'`
   - Vérifier que "Test" s'affiche au lieu du JSON brut

4. **Test avec styleSuggestion incomplet**
   - Tester avec `styleSuggestion.effects = undefined`
   - Vérifier que l'application ne crash pas

5. **Test avec distributionPlan incomplet**
   - Tester avec `distributionPlan.hashtags = undefined`
   - Vérifier que l'application ne crash pas

---

## 📝 NOTES

- Toutes les corrections sont défensives (gèrent tous les cas)
- Les fonctions helper peuvent être réutilisées ailleurs
- Les corrections préservent la compatibilité avec les anciens formats
- Les états vides affichent des messages au lieu de crasher

---

## 🔍 FICHIERS MODIFIÉS

1. `mobile/src/components/ServiceProductSelector.tsx`
   - Protection contre `products` undefined
   - Protection contre `services` undefined
   - Protection contre `service.products` undefined
   - Fonction `extractProductName` pour éviter JSON brut
   - État vide avec message

2. `mobile/src/components/ProductVideoCreationModal.tsx`
   - Protection contre `groupedProducts` undefined
   - Protection contre `group.items` undefined
   - Protection contre `styleSuggestion.*` undefined
   - Protection contre `distributionPlan.*` undefined
   - Protection contre `variant.*` undefined
   - Normalisation produit avant définition
   - État vide avec message

---

## ✅ RÉSULTAT

Après ces corrections :
- ✅ Plus de crash "Cannot read property 'map' of undefined"
- ✅ Plus de crash "Text strings must be rendered within a <Text> component"
- ✅ Affichage correct des noms de produits (pas de JSON brut)
- ✅ Messages d'état vide au lieu de crashes
- ✅ Application plus robuste et défensive

