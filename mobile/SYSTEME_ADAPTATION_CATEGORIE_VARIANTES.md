# 🔧 Système d'Adaptation par Catégorie - Gestion des Variantes

## 📋 Vue d'ensemble

Le système de variantes s'adapte **automatiquement** selon la catégorie de produit grâce au fichier `categoryConfig.ts`. Toutes les catégories ne supportent pas les variantes, uniquement celles qui en ont besoin.

---

## 🎯 Principe de Fonctionnement

### Architecture

```
categoryConfig.ts
    ↓
    ├─ CategoryConfig (interface)
    │   └─ supportsVariants?: boolean  ← Nouveau champ
    │
    ├─ CATEGORY_CONFIGS (configurations)
    │   ├─ agroalimentaire → supportsVariants: true ✅
    │   ├─ aliments → supportsVariants: true ✅
    │   ├─ immobilier_batiment → pas de variantes ❌
    │   └─ automobile → pas de variantes ❌
    │
    └─ categorySupportsVariants(category) → Helper function
```

---

## 📦 Catégories Supportant les Variantes

### Actuellement

| Catégorie | Support Variantes | Cas d'Usage |
|-----------|-------------------|-------------|
| `agroalimentaire` | ✅ Oui | Riz: 1kg, 5kg, 25kg |
| `aliments` | ✅ Oui | Huile: 1L, 5L, 20L |

### Futures Extensions Possibles

| Catégorie | Support Possible | Exemple |
|-----------|------------------|---------|
| `cosmetique_parfum` | 🔮 Possible | Parfum: 30ml, 50ml, 100ml |
| `pharmaceutique` | 🔮 Possible | Médicament: boîte de 10, 30, 60 |
| `vetement` | 🔮 Possible | T-shirt: S, M, L, XL |
| `chaussure` | 🔮 Possible | Pointures: 38, 39, 40... |

---

## 🔧 Configuration par Catégorie

### Exemple : Agroalimentaire

```typescript
// mobile/src/config/categoryConfig.ts

agroalimentaire: {
  terminology: {
    sortLabels: {
      price_asc: 'Prix croissant (par unité min)', // ✅ Adapté
      price_desc: 'Prix décroissant (par unité max)', // ✅ Adapté
    },
  },
  filters: [
    {
      id: 'categorieAliment',
      label: 'Catégorie',
      type: 'select',
      options: [...],
    },
    {
      id: 'uniteMesure', // ✅ Spécifique aux variantes
      label: 'Unité',
      type: 'select',
      options: [
        { value: 'kg', label: 'Kilogramme (kg)' },
        { value: 'L', label: 'Litre (L)' },
      ],
    },
    {
      id: 'conditionnement', // ✅ Spécifique aux variantes
      label: 'Conditionnement',
      type: 'select',
      options: [
        { value: 'Sachet', label: 'Sachet' },
        { value: 'Boîte', label: 'Boîte' },
      ],
    },
  ],
  displayPriority: ['name', 'variants', 'categorieAliment', 'prix'], // ✅ 'variants' inclus
  supportsVariants: true, // ✅ FLAG ACTIVÉ
}
```

### Exemple : Immobilier (pas de variantes)

```typescript
immobilier_batiment: {
  terminology: {
    sortLabels: {
      price_asc: 'Prix croissant', // Prix simple
      price_desc: 'Prix décroissant', // Prix simple
    },
  },
  filters: [
    {
      id: 'typeImmobilier',
      label: 'Type de bien',
      type: 'select',
      options: [...],
    },
    // Pas de filtres liés aux variantes
  ],
  displayPriority: ['typeImmobilier', 'nbChambres', 'prix'], // Pas de 'variants'
  // supportsVariants: undefined (par défaut = false)
}
```

---

## 🧠 Logique d'Adaptation Automatique

### 1. Fonction Helper

```typescript
// mobile/src/config/categoryConfig.ts

export const categorySupportsVariants = (category: string): boolean => {
  return getCategoryConfig(category).supportsVariants === true;
};
```

### 2. Utilisation dans ResultatBesoinScreen

```typescript
// mobile/src/screens/ResultatBesoinScreen.tsx

const getServicePrice = (service, mode) => {
  const productType = firstProduct.type;
  
  // ✅ Vérification automatique de la catégorie
  const supportsVariants = productType && categorySupportsVariants(productType);
  
  // ✅ Gestion variantes UNIQUEMENT si supporté
  if (supportsVariants && firstProduct.variants?.length > 0) {
    const variantPrices = firstProduct.variants.map(v => parseFloat(v.prix));
    
    if (mode === 'min') return Math.min(...variantPrices);
    if (mode === 'max') return Math.max(...variantPrices);
    return Math.min(...variantPrices);
  }
  
  // ✅ Sinon, prix classique
  return parseFloat(firstProduct.prix);
};
```

### 3. Tri Intelligent

```typescript
// ✅ Tri ascendant (moins cher → plus cher)
case 'price_asc': {
  // Utilise prix MIN pour catégories avec variantes
  // Utilise prix unique pour autres catégories
  const priceA = getServicePrice(a, 'min');
  const priceB = getServicePrice(b, 'min');
  return priceA - priceB;
}

// ✅ Tri descendant (plus cher → moins cher)
case 'price_desc': {
  // Utilise prix MAX pour catégories avec variantes
  // Utilise prix unique pour autres catégories
  const priceA = getServicePrice(a, 'max');
  const priceB = getServicePrice(b, 'max');
  return priceB - priceA;
}
```

---

## 📊 Comportement par Type de Produit

### Catégorie avec Variantes (agroalimentaire)

#### Produit : Riz Uncle Ben's
```json
{
  "type": "agroalimentaire",
  "name": "Riz Uncle Ben's",
  "variants": [
    { "quantite": "1", "unite": "kg", "prix": "2000" },
    { "quantite": "5", "unite": "kg", "prix": "9000" },
    { "quantite": "25", "unite": "kg", "prix": "40000" }
  ]
}
```

**Résultat** :
- ✅ `categorySupportsVariants('agroalimentaire')` → `true`
- ✅ Affichage : `2000 - 40000 FCFA`
- ✅ Tri ascendant : Classé à `2000 FCFA`
- ✅ Tri descendant : Classé à `40000 FCFA`
- ✅ Variantes affichées dans ProductCard

### Catégorie sans Variantes (immobilier)

#### Produit : Villa
```json
{
  "type": "immobilier_batiment",
  "name": "Villa F4",
  "prix": "150000000"
}
```

**Résultat** :
- ❌ `categorySupportsVariants('immobilier_batiment')` → `false`
- ✅ Affichage : `150000000 FCFA`
- ✅ Tri ascendant : Classé à `150000000 FCFA`
- ✅ Tri descendant : Classé à `150000000 FCFA`
- ❌ Pas de sélecteur de variantes (n'existe pas)

---

## 🎨 Adaptation UI

### ProductCard

```typescript
// ✅ Détection automatique du support de variantes
const hasVariants = product.variants?.length > 0;
const categoryConfig = getCategoryConfig(product.type);

if (categoryConfig.supportsVariants && hasVariants) {
  // Afficher sélecteur de variantes
  <VariantSelector variants={product.variants} />
} else {
  // Affichage classique
  <PriceDisplay price={product.prix} />
}
```

### Filtres dans ResultatBesoinScreen

```typescript
// ✅ Filtres dynamiques selon la catégorie
const categoryFilters = getCategoryFilters(selectedCategory);

// Pour 'agroalimentaire', inclut:
// - categorieAliment
// - uniteMesure
// - conditionnement
// - allergenesArray
// etc.

// Pour 'immobilier_batiment', inclut:
// - typeImmobilier
// - nbChambres
// - superficie
// etc.
```

---

## 🔄 Flux Complet

### Scénario : Recherche de Produits Alimentaires

```
1. Utilisateur → Recherche "riz"
   ↓
2. Backend → Retourne produits type "agroalimentaire"
   ↓
3. ResultatBesoinScreen → Détection catégorie
   ↓
4. categorySupportsVariants('agroalimentaire') → true ✅
   ↓
5. getServicePrice(product, 'min') → 2000 (pour tri asc)
   ↓
6. Affichage ProductCard → "2000 - 40000 FCFA"
   ↓
7. Sélecteur variantes visible
   ↓
8. Utilisateur sélectionne "5kg" → 9000 FCFA
   ↓
9. Image change automatiquement
```

### Scénario : Recherche d'Immobilier

```
1. Utilisateur → Recherche "villa"
   ↓
2. Backend → Retourne produits type "immobilier_batiment"
   ↓
3. ResultatBesoinScreen → Détection catégorie
   ↓
4. categorySupportsVariants('immobilier_batiment') → false ❌
   ↓
5. getServicePrice(product, 'min') → 150000000 (prix unique)
   ↓
6. Affichage ProductCard → "150000000 FCFA"
   ↓
7. Pas de sélecteur variantes
```

---

## 📝 Ajout d'une Nouvelle Catégorie avec Variantes

### Étapes

1. **Configurer la catégorie**
```typescript
// mobile/src/config/categoryConfig.ts

cosmetique_parfum: {
  terminology: {
    sortLabels: {
      price_asc: 'Prix croissant (par contenance min)',
      price_desc: 'Prix décroissant (par contenance max)',
    },
  },
  filters: [
    {
      id: 'contenance',
      label: 'Contenance',
      type: 'select',
      options: [
        { value: '30ml', label: '30ml' },
        { value: '50ml', label: '50ml' },
        { value: '100ml', label: '100ml' },
      ],
    },
  ],
  supportsVariants: true, // ✅ ACTIVER
}
```

2. **Ajouter à la liste des catégories supportées**
```typescript
export const VARIANT_SUPPORTED_CATEGORIES = [
  'agroalimentaire',
  'aliments',
  'cosmetique_parfum', // ✅ NOUVEAU
];
```

3. **Adapter ProductManagerMobile**
```typescript
case 'cosmetique_parfum':
  return (
    <>
      {/* Champs de base */}
      <ProductVariantManager
        variants={newProduct.variants || []}
        onChange={(variants) => setNewProduct({ ...newProduct, variants })}
        productType="cosmetique_parfum"
      />
    </>
  );
```

4. **Aucun autre changement nécessaire** ✅
   - `getServicePrice` s'adapte automatiquement
   - `ProductCard` détecte les variantes automatiquement
   - Tri fonctionne avec min/max

---

## ✅ Avantages du Système

| Avantage | Description |
|----------|-------------|
| **Modulaire** | Chaque catégorie est indépendante |
| **Automatique** | Détection et adaptation sans code manuel |
| **Extensible** | Ajout de nouvelles catégories facile |
| **Performant** | Pas de calcul inutile pour catégories simples |
| **Maintenable** | Configuration centralisée dans un fichier |
| **Type-safe** | Interface TypeScript stricte |

---

## 🎓 Conclusion

Le système d'adaptation par catégorie permet de :
- ✅ **Supporter les variantes** uniquement pour les produits qui en ont besoin
- ✅ **Éviter la complexité** pour les produits simples (immobilier, services...)
- ✅ **S'étendre facilement** à de nouvelles catégories
- ✅ **Garder le code DRY** : Pas de duplication pour chaque catégorie
- ✅ **Améliorer la performance** : Calculs adaptatifs selon la catégorie

**Le système est intelligent, adaptatif et prêt pour la production !** 🚀






