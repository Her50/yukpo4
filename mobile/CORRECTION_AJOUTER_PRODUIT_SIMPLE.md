# 🔧 Correction - Affichage d'AjouterProduitSimpleScreen pour produits existants

## 🐛 Problème identifié

Le formulaire `AjouterProduitSimpleScreen` ne s'affichait pas correctement ou manquait de données lors de l'édition/duplication d'un produit existant.

## 🔍 Analyse

### Problèmes identifiés

1. **Paramètres manquants dans FormulaireYukpoIntelligentScreen** :
   - `mediaData` et `gpsData` n'étaient pas toujours passés lors de la redirection
   - `suggestionIA` n'avait pas la structure complète avec `session_id`

2. **Paramètres manquants dans MesProduitsScreen** :
   - `suggestionIA` n'était pas passé lors de l'édition/duplication
   - Les données du service n'étaient pas chargées pour permettre le chargement des combinaisons autocomplete

3. **Structure de suggestionIA incorrecte** :
   - `suggestionIA.data` devait contenir les données du service
   - `suggestionIA.session_id` était nécessaire pour charger les combinaisons IA

## ✅ Corrections appliquées

### 1. FormulaireYukpoIntelligentScreen.tsx

**Correction pour l'édition de produit** :
```typescript
// Avant
(navigation as any).replace('AjouterProduitSimple', {
    mode: 'edit',
    serviceId: serviceId,
    productId: focusProductId,
    productIndex: productIndex,
    prefill: editProductData,
    suggestionIA: {
        data: suggestion || {}
    }
});

// Après
(navigation as any).replace('AjouterProduitSimple', {
    mode: 'edit',
    serviceId: serviceId,
    productId: focusProductId,
    productIndex: productIndex,
    prefill: editProductData,
    suggestionIA: {
        data: suggestion?.data || suggestion || {},
        session_id: suggestion?.session_id, // ✅ Ajouté
    },
    mediaData: mediaData || {}, // ✅ Ajouté
    gpsData: gpsData || {}, // ✅ Ajouté
});
```

**Correction pour l'ajout de produit** :
```typescript
// Avant
(navigation as any).replace('AjouterProduitSimple', {
    serviceId: serviceId,
    suggestionIA: {
        data: suggestion || {}
    },
    mediaData: mediaData,
    gpsData: gpsData,
    mode: duplicateProduct ? 'duplicate' : 'create',
    prefill: duplicateProduct || editProductData || {}
});

// Après
(navigation as any).replace('AjouterProduitSimple', {
    serviceId: serviceId,
    suggestionIA: {
        data: suggestion?.data || suggestion || {},
        session_id: suggestion?.session_id, // ✅ Ajouté
    },
    mediaData: mediaData || {}, // ✅ Sécurisé avec fallback
    gpsData: gpsData || {}, // ✅ Sécurisé avec fallback
    mode: duplicateProduct ? 'duplicate' : 'create',
    prefill: duplicateProduct || editProductData || {}
});
```

### 2. MesProduitsScreen.tsx

**Correction pour l'édition de produit** :
```typescript
// Avant
navigation.navigate('AjouterProduitSimple' as never, {
    mode: 'edit',
    serviceId: product.serviceId,
    productId: productIdForUpdate,
    productIndex: product.product_index ?? 0,
    prefill,
    mediaData,
} as never);

// Après
// ✅ CORRIGÉ: Charger les données du service pour suggestionIA
let serviceDataForSuggestion: any = null;
try {
    const serviceResponse = await apiGet(`/api/services/${product.serviceId}`);
    if (serviceResponse?.success && serviceResponse?.data) {
        serviceDataForSuggestion = serviceResponse.data.data || serviceResponse.data;
    }
} catch (error) {
    console.warn('[MesProduitsScreen] ⚠️ Impossible de charger les données du service:', error);
}

navigation.navigate('AjouterProduitSimple' as never, {
    mode: 'edit',
    serviceId: product.serviceId,
    productId: productIdForUpdate,
    productIndex: product.product_index ?? 0,
    prefill,
    mediaData,
    suggestionIA: serviceDataForSuggestion ? { // ✅ Ajouté
        data: serviceDataForSuggestion
    } : undefined,
} as never);
```

**Correction pour la duplication de produit** :
```typescript
// Même correction que pour l'édition
// ✅ Chargement des données du service pour suggestionIA
// ✅ Passage de suggestionIA dans la navigation
```

## 📊 Structure des paramètres attendus

### Paramètres requis pour AjouterProduitSimpleScreen

```typescript
{
    mode: 'edit' | 'duplicate' | 'create',
    serviceId: number,
    productId?: number, // Pour mode='edit'
    productIndex?: number, // Pour mode='edit'
    prefill: {
        nom_produit?: string,
        categorie_produit?: string,
        description_produit?: string,
        prix_produit?: number,
        devise_produit?: string,
        produits?: string[],
        sous_caracteristiques?: Record<string, string[]>,
        images?: string[],
        videos?: string[],
        audios?: string[],
        documents?: string[],
        // ... autres champs
    },
    mediaData?: {
        base64_image?: string[],
        video_base64?: string[],
        audio_base64?: string[],
        doc_base64?: string[],
    },
    suggestionIA?: {
        data: any, // Données du service
        session_id?: string, // Pour charger les combinaisons IA
    },
    gpsData?: {
        gps_fixe?: string,
        gps_mobile?: string,
        // ... autres données GPS
    }
}
```

## 🧪 Tests à effectuer

1. **Test d'édition de produit** :
   - Depuis MesProduitsScreen, cliquer sur "Modifier" un produit
   - Vérifier que `AjouterProduitSimpleScreen` s'affiche
   - Vérifier que tous les champs sont pré-remplis
   - Vérifier que les médias sont chargés
   - Vérifier que les combinaisons autocomplete sont disponibles

2. **Test de duplication de produit** :
   - Depuis MesProduitsScreen, cliquer sur "Dupliquer" un produit
   - Vérifier que `AjouterProduitSimpleScreen` s'affiche en mode 'duplicate'
   - Vérifier que tous les champs sont pré-remplis
   - Vérifier que les médias sont chargés

3. **Test depuis FormulaireYukpoIntelligentScreen** :
   - Créer un service avec produits
   - Essayer d'éditer un produit depuis le formulaire
   - Vérifier la redirection vers `AjouterProduitSimpleScreen`

## 🔍 Points de vérification

### Dans AjouterProduitSimpleScreen.tsx
- ✅ Ligne 40 : `const { serviceId, suggestionIA } = params;`
- ✅ Ligne 42 : `const mode = params.mode || 'create';`
- ✅ Ligne 43 : `const isEditing = mode === 'edit';`
- ✅ Ligne 51 : `const prefill = params.prefill || {};`
- ✅ Ligne 100 : `const suggestionData = suggestionIA?.data || suggestionIA || {};`
- ✅ Ligne 424-457 : Logs de débogage pour vérifier le prefill

### Logs à vérifier
- `[AjouterProduitSimple] 📝 Mode:` - Doit afficher 'edit' ou 'duplicate'
- `[AjouterProduitSimple] 📦 Prefill reçu:` - Doit contenir les données du produit
- `[MesProduitsScreen] ✅ Données service chargées pour suggestionIA` - Confirme le chargement

## 📝 Notes importantes

1. **Chargement des données du service** : Nécessaire pour permettre le chargement des combinaisons autocomplete depuis `session_id`

2. **Fallbacks sécurisés** : Tous les paramètres ont des fallbacks (`|| {}`, `|| undefined`) pour éviter les erreurs

3. **Structure suggestionIA** : Doit contenir `data` (données du service) et optionnellement `session_id` (pour combinaisons IA)

4. **Médias** : Les médias sont chargés depuis l'API dans MesProduitsScreen et passés via `mediaData`

## 🚀 Prochaines étapes

Si le problème persiste, vérifier :
1. Les logs de navigation dans la console
2. La structure exacte des données du service retournées par l'API
3. Les erreurs éventuelles dans AjouterProduitSimpleScreen lors du chargement
4. La présence de `session_id` dans les données du service pour charger les combinaisons

