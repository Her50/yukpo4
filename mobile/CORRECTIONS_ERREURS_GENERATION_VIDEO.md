# 🔧 CORRECTIONS - Erreurs lors de la génération effective de vidéo

**Date**: 23 Décembre 2025  
**Problème**: Erreurs 500 lors de la génération effective de la vidéo dans `ProductVideoCreationModal`

---

## 🚨 **ERREURS IDENTIFIÉES**

### ⚠️ **1. Génération vidéo - Erreur 500**

**Endpoint** : `/api/media/product/191/5/generate-video`  
**Erreur backend** : Erreur 500 (détails non spécifiés dans les logs)

**Cause** :
- ❌ Pas de validation de `serviceId` et `product_index` avant l'appel API
- ❌ Pas de vérification que le payload contient les données minimales
- ❌ Pas de vérification qu'il y a des médias disponibles
- ❌ Pas de vérification qu'il y a un script/storyboard/timeline
- ❌ Message d'erreur générique "Erreur 500" sans détails

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`  
**Fonction** : `proceedWithVideoGeneration`

---

### ⚠️ **2. Estimation coût - Erreur 500**

**Endpoint** : `/api/media/product/191/5/estimate-video`  
**Erreur backend** : Erreur 500 (détails non spécifiés dans les logs)

**Cause** :
- ❌ Pas de validation de `serviceId` et `product_index` avant l'appel API
- ❌ Pas de vérification que le payload contient les données minimales
- ❌ Pas de validation de la réponse du serveur
- ❌ Message d'erreur générique sans détails

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`  
**Fonction** : `handleSubmit` (appel à `iaApi.estimateVideoCost`)

---

## ✅ **CORRECTIONS APPLIQUÉES**

### **1. Validations ajoutées dans `proceedWithVideoGeneration`**

**Avant** :
```typescript
const proceedWithVideoGeneration = async (payload: VideoGenerationPayload) => {
    if (!selectedProduct) {
        return;
    }
    setIsSubmitting(true);
    try {
        const response = await mediaApi.generateProductVideo(...);
        // ...
    } catch (error: any) {
        Alert.alert('Génération impossible', errorMessage);
    }
};
```

**Après** :
```typescript
const proceedWithVideoGeneration = async (payload: VideoGenerationPayload) => {
    // ✅ CORRIGÉ: Validations complètes avant l'appel API
    
    // 1. Validation produit
    if (!selectedProduct) {
        Alert.alert('Produit requis', 'Aucun produit sélectionné...');
        return;
    }

    // 2. Validation serviceId
    if (!serviceId || serviceId === null || serviceId === undefined) {
        Alert.alert('Service invalide', 'Le service ID est manquant...');
        return;
    }

    // 3. Validation product_index
    if (productIndex === null || productIndex === undefined || isNaN(Number(productIndex))) {
        Alert.alert('Index produit invalide', 'L\'index du produit est manquant...');
        return;
    }

    // 4. Validation payload
    if (!payload) {
        Alert.alert('Données manquantes', 'Les données de génération sont manquantes...');
        return;
    }

    // 5. Validation durée
    if (!durationSeconds || durationSeconds < 10 || durationSeconds > 90) {
        Alert.alert('Durée invalide', 'La durée doit être entre 10 et 90 secondes...');
        return;
    }

    // 6. Validation script/storyboard/timeline
    if (!hasScript && !hasStoryboard && !hasTimeline) {
        Alert.alert('Script requis', 'Aucun script, storyboard ou timeline disponible...');
        return;
    }

    // 7. Validation médias
    if (!hasSelectedMedia && !useProductGallery && !useServiceMediatech && !hasTimelineMedia) {
        Alert.alert('Médias requis', 'Aucun média disponible...');
        return;
    }

    // Appel API avec gestion d'erreur améliorée
    // ...
};
```

**Validations ajoutées** :
- ✅ Validation du produit sélectionné
- ✅ Validation de `serviceId` (non null, non undefined)
- ✅ Validation de `product_index` (non null, non undefined, nombre valide)
- ✅ Validation du payload (non null)
- ✅ Validation de la durée (10-90 secondes)
- ✅ Validation script/storyboard/timeline (au moins un requis)
- ✅ Validation des médias (au moins une source de médias)

---

### **2. Validations ajoutées dans l'estimation de coût**

**Avant** :
```typescript
const response = await iaApi.estimateVideoCost(serviceId, selectedProduct.product_index, payloadForEstimation);
const estimation = response.data as VideoCostEstimation | undefined;
if (!estimation) {
    Alert.alert('Estimation impossible', 'Impossible d\'estimer le coût...');
    return;
}
```

**Après** :
```typescript
// ✅ CORRIGÉ: Validations avant l'appel d'estimation
if (!serviceId || serviceId === null || serviceId === undefined) {
    setCostLoading(false);
    Alert.alert('Service invalide', 'Le service ID est manquant...');
    return;
}

if (selectedProduct.product_index === null || selectedProduct.product_index === undefined || isNaN(Number(selectedProduct.product_index))) {
    setCostLoading(false);
    Alert.alert('Index produit invalide', 'L\'index du produit est manquant...');
    return;
}

if (!payloadForEstimation || !payloadForEstimation.duration_seconds) {
    setCostLoading(false);
    Alert.alert('Données incomplètes', 'Les données d\'estimation sont incomplètes...');
    return;
}

const response = await iaApi.estimateVideoCost(serviceId, selectedProduct.product_index, payloadForEstimation);

// ✅ CORRIGÉ: Validation de la réponse
if (!response || !response.success) {
    setCostLoading(false);
    const errorMsg = response?.error || 'Impossible d\'estimer le coût pour le moment.';
    Alert.alert('Erreur d\'estimation', errorMsg + '...');
    return;
}
```

**Validations ajoutées** :
- ✅ Validation de `serviceId` avant l'appel
- ✅ Validation de `product_index` avant l'appel
- ✅ Validation du payload (non null, durée présente)
- ✅ Validation de la réponse du serveur (`response.success`)

---

### **3. Messages d'erreur améliorés**

**Avant** :
```typescript
if (msg.includes('500') || msg.includes('internal')) {
    errorMessage = 'Erreur serveur temporaire...';
}
```

**Après** :
```typescript
if (msg.includes('500') || msg.includes('internal') || msg.includes('erreur 500')) {
    errorMessage = 'Erreur serveur temporaire.\n\n' +
        'Le serveur a rencontré une erreur lors de la génération.\n\n' +
        'Veuillez réessayer dans quelques instants. Si le problème persiste, contactez le support.';
} else if (msg.includes('aucune image') || msg.includes('no media')) {
    errorMessage = 'Aucun média disponible pour générer la vidéo.\n\n' +
        'Solutions :\n' +
        '• Ajoutez des images dans la médiathèque du service\n' +
        '• Ajoutez des images au produit\n' +
        '• Activez "Utiliser galerie produit" ou "Utiliser médiathèque service"\n' +
        '• La génération automatique d\'images IA sera activée lors de la prochaine tentative';
} else if (msg.includes('solde') || msg.includes('balance') || msg.includes('tokens')) {
    errorMessage = 'Solde insuffisant.\n\n' +
        'Veuillez recharger vos tokens avant de générer la vidéo.';
}
```

**Messages d'erreur spécifiques** :
- ✅ Erreur 500 → Message détaillé avec solutions
- ✅ Aucun média → Solutions pour ajouter des médias
- ✅ Solde insuffisant → Message clair avec action
- ✅ Demande invalide → Liste des champs requis
- ✅ Timeout → Message avec suggestion de vérification

---

## 📊 **VALIDATIONS AJOUTÉES**

### **Génération vidéo (`proceedWithVideoGeneration`)**

1. ✅ **Produit sélectionné** : Vérifie que `selectedProduct` existe
2. ✅ **Service ID** : Vérifie que `serviceId` est valide (non null, non undefined)
3. ✅ **Product Index** : Vérifie que `product_index` est valide (non null, non undefined, nombre)
4. ✅ **Payload** : Vérifie que le payload existe
5. ✅ **Durée** : Vérifie que la durée est entre 10 et 90 secondes
6. ✅ **Script/Storyboard/Timeline** : Vérifie qu'au moins un est présent
7. ✅ **Médias** : Vérifie qu'au moins une source de médias est disponible
8. ✅ **Réponse serveur** : Valide que `response.success` et `response.data` existent
9. ✅ **URL vidéo** : Valide que `result.video_url` existe dans la réponse

### **Estimation coût (`handleSubmit`)**

1. ✅ **Service ID** : Vérifie que `serviceId` est valide avant l'appel
2. ✅ **Product Index** : Vérifie que `product_index` est valide avant l'appel
3. ✅ **Payload** : Vérifie que le payload contient `duration_seconds`
4. ✅ **Réponse serveur** : Valide que `response.success` existe
5. ✅ **Estimation** : Valide que `estimation` existe après parsing

---

## 🎯 **RÉSULTAT ATTENDU**

Après les corrections :
- ✅ Les erreurs 500 sont évitées en validant les données avant l'envoi
- ✅ Les utilisateurs voient des messages d'erreur clairs indiquant ce qui manque
- ✅ Les validations empêchent les appels API avec des données incomplètes
- ✅ Meilleure expérience utilisateur avec des messages informatifs
- ✅ Réduction des erreurs serveur grâce aux validations côté client

---

## 🔍 **DIAGNOSTIC SI LE PROBLÈME PERSISTE**

### **1. Vérifier les données avant l'appel**
```typescript
console.log('[ProductVideoCreationModal] Service ID:', serviceId);
console.log('[ProductVideoCreationModal] Product Index:', productIndex);
console.log('[ProductVideoCreationModal] Payload:', JSON.stringify(payload, null, 2));
```

### **2. Vérifier les médias disponibles**
```typescript
console.log('[ProductVideoCreationModal] Selected Media IDs:', Array.from(selectedMediaIds));
console.log('[ProductVideoCreationModal] Product Media:', productMedia.length);
console.log('[ProductVideoCreationModal] Service Media:', serviceMedia.length);
console.log('[ProductVideoCreationModal] Timeline:', generatedTimeline);
```

### **3. Vérifier les réponses du serveur**
```typescript
console.log('[ProductVideoCreationModal] Response:', response);
console.log('[ProductVideoCreationModal] Response Success:', response.success);
console.log('[ProductVideoCreationModal] Response Error:', response.error);
console.log('[ProductVideoCreationModal] Response Data:', response.data);
```

### **4. Vérifier les erreurs backend**
- Vérifier les logs backend pour voir les erreurs exactes
- Vérifier que les médias sont bien uploadés et accessibles
- Vérifier que les IDs de service et produit sont valides
- Vérifier que le payload est correctement formaté

---

## 📝 **NOTES TECHNIQUES**

### **Pourquoi valider avant l'appel API ?**
- Évite les erreurs 500 côté serveur
- Réduit la charge sur le serveur
- Améliore l'expérience utilisateur avec des messages clairs
- Identifie les problèmes avant l'envoi

### **Pourquoi valider la réponse ?**
- Évite les crashes si la réponse est invalide
- Permet de gérer les erreurs gracieusement
- Affiche des messages d'erreur clairs à l'utilisateur

### **Pourquoi vérifier les médias ?**
- Le backend nécessite au moins un média pour générer la vidéo
- Évite les erreurs "Aucun média trouvé"
- Guide l'utilisateur pour ajouter des médias

---

## ✅ **STATUT**

- ✅ Validations ajoutées dans `proceedWithVideoGeneration`
- ✅ Validations ajoutées dans l'estimation de coût
- ✅ Messages d'erreur améliorés
- ✅ Validation des réponses serveur
- ✅ Aucune erreur de linting

**Prochaines étapes** :
1. Tester la génération de vidéo avec des données valides
2. Tester avec des données invalides pour vérifier les messages d'erreur
3. Vérifier que les erreurs 500 sont évitées
4. Améliorer l'upload des médias si nécessaire

