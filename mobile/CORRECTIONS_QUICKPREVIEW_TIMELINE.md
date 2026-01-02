# 🔧 CORRECTIONS - Erreurs QuickPreview "Aucun média trouvé"

**Date**: 23 Décembre 2025  
**Problème**: Erreur 500 "Aucun média trouvé dans la timeline pour générer le preview"

---

## 🚨 **ERREUR IDENTIFIÉE**

### ⚠️ **QuickPreview - Erreur 500**

**Endpoint** : `/api/ia/video/quick-preview`  
**Erreur backend** : `Internal("Aucun média trouvé dans la timeline pour générer le preview")`

**Cause** :
- ❌ La timeline générée par l'IA n'a pas de médias valides (media_url ou media_id manquants)
- ❌ Validation insuffisante côté client avant l'appel API
- ❌ Pas de vérification que les URLs sont valides (non vides, non null)
- ❌ Pas de désactivation du bouton si la timeline n'est pas valide

**Fichier** : `mobile/src/components/QuickPreview.tsx`

---

## ✅ **CORRECTIONS APPLIQUÉES**

### **1. Validation stricte de la timeline**

**Avant** :
```typescript
const scenesWithMedia = timeline.scenes.filter((scene: any) => {
    return scene.media_url || scene.media_id || scene.assets?.video_url || scene.assets?.image_url;
});
```

**Après** :
```typescript
const scenesWithMedia = timeline.scenes.filter((scene: any) => {
    // Vérifier media_url (non vide, non null, non undefined)
    if (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) {
        // Vérifier que l'URL est valide (http, https, ou file)
        if (scene.media_url.startsWith('http://') || scene.media_url.startsWith('https://') || scene.media_url.startsWith('file://')) {
            return true;
        }
    }
    
    // Vérifier media_id (non null, non undefined, nombre valide)
    if (scene.media_id !== null && scene.media_id !== undefined) {
        const mediaId = typeof scene.media_id === 'string' ? parseInt(scene.media_id, 10) : scene.media_id;
        if (!isNaN(mediaId) && mediaId > 0) {
            return true;
        }
    }
    
    // Vérifier assets.video_url ou assets.image_url
    if (scene.assets) {
        if (scene.assets.video_url && typeof scene.assets.video_url === 'string' && scene.assets.video_url.trim().length > 0) {
            return true;
        }
        if (scene.assets.image_url && typeof scene.assets.image_url === 'string' && scene.assets.image_url.trim().length > 0) {
            return true;
        }
    }
    
    return false;
});
```

**Validations ajoutées** :
- ✅ Vérification que `media_url` est une string non vide
- ✅ Vérification que `media_url` commence par `http://`, `https://` ou `file://`
- ✅ Vérification que `media_id` est un nombre valide > 0
- ✅ Vérification que `assets.video_url` ou `assets.image_url` sont des strings non vides

---

### **2. Fonction de validation réutilisable**

**Ajouté** :
```typescript
const isTimelineValid = (): boolean => {
    if (!timeline || !timeline.scenes || !Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
        return false;
    }

    // Vérifier qu'au moins une scène a un média valide
    const hasValidMedia = timeline.scenes.some((scene: any) => {
        // Vérifier media_url
        if (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) {
            if (scene.media_url.startsWith('http://') || scene.media_url.startsWith('https://') || scene.media_url.startsWith('file://')) {
                return true;
            }
        }
        
        // Vérifier media_id
        if (scene.media_id !== null && scene.media_id !== undefined) {
            const mediaId = typeof scene.media_id === 'string' ? parseInt(scene.media_id, 10) : scene.media_id;
            if (!isNaN(mediaId) && mediaId > 0) {
                return true;
            }
        }
        
        return false;
    });

    return hasValidMedia;
};
```

**Utilisation** :
- ✅ Désactivation du bouton si la timeline n'est pas valide
- ✅ Affichage d'un message d'avertissement si la timeline n'a pas de médias

---

### **3. Désactivation du bouton si timeline invalide**

**Avant** :
```typescript
<TouchableOpacity
    style={styles.generateButton}
    onPress={handleGeneratePreview}
    disabled={loading}
>
```

**Après** :
```typescript
<TouchableOpacity
    style={[
        styles.generateButton,
        (!timelineIsValid || loading) && styles.generateButtonDisabled
    ]}
    onPress={handleGeneratePreview}
    disabled={!timelineIsValid || loading}
>
    {loading ? (
        <ActivityIndicator color="#FFF" size="small" />
    ) : (
        <>
            <SafeIcon name="play" size={16} color="#FFF" />
            <Text style={styles.generateButtonText}>
                {timelineIsValid ? 'Générer' : 'Médias requis'}
            </Text>
        </>
    )}
</TouchableOpacity>
```

**Améliorations** :
- ✅ Bouton désactivé si la timeline n'est pas valide
- ✅ Texte du bouton change selon l'état ("Générer" ou "Médias requis")
- ✅ Style visuel différent quand désactivé

---

### **4. Message d'avertissement**

**Ajouté** :
```typescript
{!timelineIsValid && !loading && !preview && (
    <View style={styles.warningContainer}>
        <SafeIcon name="alert-circle" size={20} color={modernColors.warning || '#F59E0B'} />
        <Text style={styles.warningText}>
            Ajoutez des médias à la timeline pour générer le preview
        </Text>
    </View>
)}
```

**Améliorations** :
- ✅ Message clair indiquant ce qui manque
- ✅ Affiché uniquement si la timeline n'est pas valide et qu'il n'y a pas de preview

---

### **5. Logs de diagnostic**

**Ajouté** :
```typescript
// ✅ CORRIGÉ: Log détaillé pour diagnostic
console.error('[QuickPreview] Timeline invalide - Détails:', {
    totalScenes: timeline.scenes.length,
    scenes: timeline.scenes.map((s: any, idx: number) => ({
        index: idx,
        media_url: s.media_url,
        media_id: s.media_id,
        assets: s.assets,
    })),
});

// ✅ CORRIGÉ: Log pour diagnostic
console.log('[QuickPreview] Validation OK:', {
    totalScenes: timeline.scenes.length,
    scenesWithMedia: scenesWithMedia.length,
    firstScene: scenesWithMedia[0],
});
```

**Améliorations** :
- ✅ Logs détaillés pour diagnostiquer les problèmes
- ✅ Logs en cas de succès pour vérifier la validation

---

### **6. Validation lors de la génération de timeline**

**Ajouté dans `ProductVideoCreationModal.tsx`** :
```typescript
if (responseData.timeline) {
    // ✅ CORRIGÉ: Vérifier que la timeline contient des médias valides
    const hasValidMedia = responseData.timeline.scenes.some((scene: any) => {
        return (scene.media_url && typeof scene.media_url === 'string' && scene.media_url.trim().length > 0) ||
               (scene.media_id !== null && scene.media_id !== undefined);
    });

    if (!hasValidMedia) {
        console.warn('[ProductVideoCreationModal] ⚠️ Timeline générée sans médias valides:', responseData.timeline);
        // Ne pas définir la timeline si elle n'a pas de médias
        // L'utilisateur devra utiliser le storyboard texte à la place
    } else {
        console.log('[ProductVideoCreationModal] ✅ Timeline générée avec médias:', responseData.timeline);
        setGeneratedTimeline(responseData.timeline);
        // ...
    }
}
```

**Améliorations** :
- ✅ Validation de la timeline dès sa génération
- ✅ Ne pas définir la timeline si elle n'a pas de médias valides
- ✅ Logs pour diagnostiquer les problèmes

---

## 📊 **VALIDATIONS AJOUTÉES**

### **QuickPreview**

1. ✅ **Timeline existe** : Vérifie que `timeline` existe
2. ✅ **Scènes existent** : Vérifie que `timeline.scenes` est un array non vide
3. ✅ **Media URL valide** : Vérifie que `media_url` est une string non vide et commence par `http://`, `https://` ou `file://`
4. ✅ **Media ID valide** : Vérifie que `media_id` est un nombre valide > 0
5. ✅ **Assets valides** : Vérifie que `assets.video_url` ou `assets.image_url` sont des strings non vides
6. ✅ **Au moins un média** : Vérifie qu'au moins une scène a un média valide

### **ProductVideoCreationModal**

1. ✅ **Validation lors de la génération** : Vérifie que la timeline générée contient des médias valides
2. ✅ **Ne pas définir si invalide** : Ne définit pas la timeline si elle n'a pas de médias valides

---

## 🎯 **RÉSULTAT ATTENDU**

Après les corrections :
- ✅ Les erreurs 500 sont évitées en validant la timeline avant l'envoi
- ✅ Le bouton est désactivé si la timeline n'est pas valide
- ✅ Un message d'avertissement clair indique ce qui manque
- ✅ Les logs permettent de diagnostiquer les problèmes
- ✅ La timeline n'est pas définie si elle n'a pas de médias valides

---

## 🔍 **DIAGNOSTIC SI LE PROBLÈME PERSISTE**

### **1. Vérifier la timeline générée**
```typescript
console.log('[ProductVideoCreationModal] Timeline générée:', generatedTimeline);
console.log('[ProductVideoCreationModal] Scènes:', generatedTimeline?.scenes);
console.log('[ProductVideoCreationModal] Médias:', generatedTimeline?.scenes.map(s => ({
    media_url: s.media_url,
    media_id: s.media_id,
})));
```

### **2. Vérifier les médias disponibles**
```typescript
console.log('[ProductVideoCreationModal] Product Media:', productMedia);
console.log('[ProductVideoCreationModal] Service Media:', serviceMedia);
console.log('[ProductVideoCreationModal] Available Media:', availableMedia);
```

### **3. Vérifier la réponse du backend**
- Vérifier que le backend génère bien des médias dans la timeline
- Vérifier que les URLs des médias sont valides
- Vérifier que les médias sont accessibles

---

## 📝 **NOTES TECHNIQUES**

### **Pourquoi valider avant l'appel API ?**
- Évite les erreurs 500 côté serveur
- Réduit la charge sur le serveur
- Améliore l'expérience utilisateur avec des messages clairs
- Identifie les problèmes avant l'envoi

### **Pourquoi vérifier les URLs ?**
- Le backend nécessite des URLs valides pour accéder aux médias
- Évite les erreurs "Aucun média trouvé"
- Guide l'utilisateur pour ajouter des médias valides

### **Pourquoi ne pas définir la timeline si invalide ?**
- Évite d'afficher une timeline invalide à l'utilisateur
- Force l'utilisation du storyboard texte si la timeline n'est pas valide
- Permet de régénérer la timeline avec des médias valides

---

## ✅ **STATUT**

- ✅ Validations strictes ajoutées dans `QuickPreview`
- ✅ Fonction de validation réutilisable
- ✅ Désactivation du bouton si timeline invalide
- ✅ Message d'avertissement clair
- ✅ Logs de diagnostic
- ✅ Validation lors de la génération de timeline
- ✅ Aucune erreur de linting

**Prochaines étapes** :
1. Tester avec une timeline valide (avec médias)
2. Tester avec une timeline invalide (sans médias)
3. Vérifier que les erreurs 500 sont évitées
4. Améliorer la génération de timeline pour s'assurer qu'elle assigne toujours des médias




