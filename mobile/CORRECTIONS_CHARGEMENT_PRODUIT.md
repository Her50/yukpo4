# Corrections - Chargement des valeurs lors de duplication/modification de produit

## Date: 2025-12-13

## Problème identifié

Lors de la duplication ou modification d'un produit dans `MesProduitsScreen`, les valeurs existantes ne se chargeaient pas correctement dans les différents champs du formulaire, y compris les médias.

## Cause racine

Le problème venait du fait que :
1. Les données utilisées pour construire le `prefill` provenaient uniquement du produit normalisé dans `MesProduitsScreen`
2. Ces données normalisées ne contenaient pas toutes les informations nécessaires (certains champs peuvent être dans un format structuré `{ type_donnee: '...', valeur: ... }`)
3. Les données complètes du produit n'étaient pas chargées depuis l'API du service avant de construire le prefill

## Solutions implémentées

### 1. ✅ Chargement des données complètes depuis l'API

**Dans `handleEditProduct` et `handleDuplicateProduct`** :
- Ajout du chargement des données complètes du produit depuis l'API du service (`/api/services/${serviceId}`)
- Extraction du produit spécifique depuis le tableau `produits` du service
- Fusion des données de l'API avec les données du produit normalisé pour garantir que toutes les valeurs sont disponibles

**Code ajouté** :
```typescript
// ✅ CORRECTION CRITIQUE: Charger les données COMPLÈTES du produit depuis l'API du service
let productDataFromAPI: any = null;
if (product.serviceId) {
    try {
        console.log('[MesProduitsScreen] 📥 Chargement des données complètes du service...');
        const serviceResponse = await apiGet(`/api/services/${product.serviceId}`);
        if (serviceResponse?.success && serviceResponse?.data) {
            const serviceData = serviceResponse.data.data || serviceResponse.data;
            // Extraire le produit spécifique depuis les produits du service
            if (serviceData.produits && Array.isArray(serviceData.produits)) {
                const productIndex = product.product_index ?? 0;
                if (serviceData.produits[productIndex]) {
                    productDataFromAPI = serviceData.produits[productIndex];
                }
            }
        }
    } catch (apiError) {
        console.warn('[MesProduitsScreen] ⚠️ Erreur chargement données service depuis API:', apiError);
    }
}

// ✅ CORRECTION CRITIQUE: Utiliser les données de l'API si disponibles
const productToUse = productDataFromAPI ? { ...product, ...productDataFromAPI } : product;

// ✅ CORRECTION CRITIQUE: Construire le prefill avec les données complètes de l'API
const prefill = buildProductPrefill(productToUse);
```

### 2. ✅ Amélioration de `buildProductPrefill`

**Améliorations** :
- Meilleure extraction des valeurs depuis les objets structurés
- Vérification des valeurs déjà présentes dans le prefill avant de les écraser
- Gestion améliorée des valeurs vides (ne pas écraser avec des valeurs vides si une valeur existe déjà)

**Code amélioré** :
```typescript
// ✅ CORRECTION: Toujours extraire et définir les valeurs, même si elles sont vides
// Mais ne pas écraser si une valeur existe déjà dans le prefill
const nomRaw = product.nom || product.nom_produit || prefill.nom_produit;
const nomValue = extractValue(nomRaw);
if (nomValue !== undefined && nomValue !== null && String(nomValue).trim().length > 0) {
    prefill.nom_produit = typeof nomValue === 'string' ? nomValue.trim() : String(nomValue).trim();
} else if (typeof nomRaw === 'string' && nomRaw.trim().length > 0) {
    prefill.nom_produit = nomRaw.trim();
} else if (prefill.nom_produit === undefined || prefill.nom_produit === null) {
    prefill.nom_produit = '';
}
```

### 3. ✅ Chargement des médias (déjà présent, maintenu)

Le chargement des médias depuis l'API était déjà implémenté et fonctionne correctement :
- Images, vidéos, audios et documents sont chargés via `mediaApi.getProductMedia()`
- Les URLs complètes sont construites via `buildMediaUrl()`
- Les médias chargés depuis l'API sont utilisés en priorité

## Fichiers modifiés

- `mobile/src/screens/MesProduitsScreen.tsx`
  - Fonction `handleEditProduct` : Ajout du chargement des données complètes depuis l'API
  - Fonction `handleDuplicateProduct` : Ajout du chargement des données complètes depuis l'API
  - Fonction `buildProductPrefill` : Amélioration de l'extraction des valeurs

## Comportement attendu

1. **Lors de la modification d'un produit** :
   - Les données complètes du produit sont chargées depuis l'API du service
   - Tous les champs sont pré-remplis avec les valeurs existantes
   - Les médias (images, vidéos, audios, documents) sont chargés et affichés

2. **Lors de la duplication d'un produit** :
   - Les données complètes du produit sont chargées depuis l'API du service
   - Tous les champs sont pré-remplis avec les valeurs existantes (nom modifié avec " (Copie)")
   - Les médias (images, vidéos, audios, documents) sont chargés et affichés

3. **Gestion des valeurs structurées** :
   - Les valeurs dans le format `{ type_donnee: '...', valeur: ... }` sont correctement extraites
   - Les valeurs directes sont préservées telles quelles
   - Les valeurs vides ne sont pas écrasées si une valeur existe déjà

## Tests à effectuer

1. ✅ Modifier un produit existant et vérifier que tous les champs sont pré-remplis
2. ✅ Dupliquer un produit existant et vérifier que tous les champs sont pré-remplis (nom avec " (Copie)")
3. ✅ Vérifier que les médias (images, vidéos, audios, documents) sont chargés et affichés
4. ✅ Vérifier que les valeurs structurées sont correctement extraites
5. ✅ Vérifier que les valeurs vides ne sont pas écrasées si une valeur existe déjà

## Notes techniques

- Le chargement des données depuis l'API se fait de manière asynchrone avant la navigation
- En cas d'erreur lors du chargement de l'API, on utilise les données du produit normalisé (fallback)
- Les médias sont toujours chargés depuis l'API séparément pour garantir leur disponibilité
- La fonction `buildProductPrefill` préserve tous les champs du produit, y compris les champs spécialisés






