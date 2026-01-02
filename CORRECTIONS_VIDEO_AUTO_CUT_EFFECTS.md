# ✅ Corrections - Découpage Automatique et Aperçu des Effets

**Date**: 2 Janvier 2026

---

## 🎯 **Problèmes Identifiés**

### 1. **Découpage Automatique - "Aucune vidéo disponible"**

**Symptôme**: Le message "Aucune vidéo disponible pour le découpage automatique" s'affiche même lorsque des vidéos AR ont été capturées et uploadées.

**Cause**: 
- `AutoCutPanel` utilisait `generatedTimeline.scenes[0]?.media_url` pour obtenir l'URL de la vidéo
- Cette approche ne fonctionnait que si une timeline avait déjà été générée
- Les vidéos AR ajoutées directement dans `productMedia` n'étaient pas prises en compte
- Si la timeline n'avait pas de `media_url` mappé, l'URL était vide

**Solution**:
- ✅ Modifier `AutoCutPanel` pour utiliser les vidéos sélectionnées depuis `selectedMediaIds`
- ✅ Chercher dans `productMedia` et `serviceMedia` pour trouver la première vidéo sélectionnée
- ✅ Utiliser `buildMediaUrl` pour construire l'URL complète depuis le `path` du média
- ✅ Filtrer uniquement les médias de type `'video'` ou `media_type === 'video'`
- ✅ Ne plus dépendre de `generatedTimeline` pour obtenir l'URL de la vidéo

**Fichier modifié**: `mobile/src/components/ProductVideoCreationModal.tsx` (lignes ~3054-3084)

```typescript
// ✅ AVANT (incorrect)
{generatedTimeline && !isEditingTimeline && generatedTimeline.scenes.length > 0 && (
    <AutoCutPanel
        videoUrl={generatedTimeline.scenes[0]?.media_url || ''}
        ...
    />
)}

// ✅ APRÈS (corrigé)
{selectedMediaIds.size > 0 && (() => {
    const selectedVideoIds = Array.from(selectedMediaIds).filter(id => {
        const media = productMedia.find(m => m.id === id) || serviceMedia.find(m => m.id === id);
        return media && (media.type === 'video' || media.media_type === 'video');
    });
    
    if (selectedVideoIds.length === 0) return null;
    
    const firstVideo = productMedia.find(m => m.id === selectedVideoIds[0]) || 
                      serviceMedia.find(m => m.id === selectedVideoIds[0]);
    const videoUrl = firstVideo ? buildMediaUrl(firstVideo.path) : '';
    
    if (!videoUrl) return null;
    
    return <AutoCutPanel videoUrl={videoUrl} videoId={firstVideo.id} ... />;
})()}
```

---

### 2. **Aperçu des Effets (Étape 4) - Erreurs Affichées**

**Symptôme**: Des erreurs s'affichent lors de la génération des previews d'effets dans `EffectPreviewCarousel` (étape 4 du processus de création vidéo).

**Causes possibles**:
- `sampleMediaUrl` peut être vide ou invalide
- L'URL n'est pas validée avant l'appel API
- Les erreurs ne sont pas suffisamment loggées pour le diagnostic
- Les dépendances du `useEffect` peuvent causer des problèmes

**Solutions**:
- ✅ Ajouter une validation de `sampleMediaUrl` avant de générer les previews
- ✅ Vérifier que l'URL est valide (commence par `http://`, `https://` ou `data:`)
- ✅ Améliorer le logging des erreurs avec plus de détails
- ✅ Logger spécifiquement les erreurs 413 (Payload Too Large) et 500 (Serveur)
- ✅ Corriger les dépendances du `useEffect` pour éviter les boucles infinies

**Fichier modifié**: `mobile/src/components/EffectPreviewCarousel.tsx` (lignes ~33-95)

```typescript
// ✅ AJOUT: Validation de sampleMediaUrl
useEffect(() => {
    // ✅ Valider sampleMediaUrl avant de générer les previews
    if (!sampleMediaUrl || sampleMediaUrl.trim() === '') {
        console.warn('[EffectPreviewCarousel] ⚠️ sampleMediaUrl est vide');
        return;
    }

    // ✅ Vérifier que l'URL est valide
    if (!sampleMediaUrl.startsWith('http://') && 
        !sampleMediaUrl.startsWith('https://') && 
        !sampleMediaUrl.startsWith('data:')) {
        console.warn('[EffectPreviewCarousel] ⚠️ sampleMediaUrl invalide:', sampleMediaUrl);
        return;
    }

    // ... génération des previews avec meilleur logging d'erreurs
}, [effectNames, sampleMediaUrl]);
```

---

## 📊 **Résumé des Modifications**

| Fichier | Lignes | Type | Description |
|---------|--------|------|-------------|
| `ProductVideoCreationModal.tsx` | ~3054-3084 | Correction | AutoCutPanel utilise maintenant les vidéos sélectionnées depuis `selectedMediaIds` |
| `EffectPreviewCarousel.tsx` | ~33-95 | Amélioration | Validation de `sampleMediaUrl` et meilleur logging d'erreurs |

---

## ✅ **Résultat Attendu**

### Pour le Découpage Automatique:
- ✅ Les vidéos AR capturées et uploadées sont maintenant détectées
- ✅ Le découpage automatique fonctionne avec les vidéos sélectionnées
- ✅ Plus de message "Aucune vidéo disponible" quand des vidéos sont présentes
- ✅ Le panel AutoCut s'affiche uniquement si au moins une vidéo est sélectionnée

### Pour l'Aperçu des Effets:
- ✅ Les erreurs sont mieux loggées pour le diagnostic
- ✅ `sampleMediaUrl` est validé avant l'appel API
- ✅ Les erreurs 413 et 500 sont spécifiquement identifiées
- ✅ L'interface ne bloque pas si une erreur survient (affichage du bloc erreur dans l'UI)

---

## 🔍 **Points Clés à Retenir**

1. **Récupération des Vidéos**: 
   - Toujours utiliser `selectedMediaIds` → `productMedia` / `serviceMedia` → `buildMediaUrl(path)`
   - Ne pas dépendre de `generatedTimeline` pour obtenir les URLs de médias

2. **Validation des URLs**:
   - Toujours valider que l'URL n'est pas vide avant de l'utiliser
   - Vérifier le format de l'URL (http/https/data URI)

3. **Gestion d'Erreurs**:
   - Logger les erreurs avec suffisamment de contexte
   - Identifier les types d'erreurs spécifiques (413, 500, etc.)
   - Ne pas bloquer l'interface utilisateur en cas d'erreur

---

## 📝 **Notes Techniques**

- Les vidéos AR sont ajoutées à `productMedia` via `handleARVideoCaptured`
- `refreshMedia` est appelé après l'upload pour synchroniser avec le serveur
- `buildMediaUrl` convertit les chemins relatifs en URLs complètes via `/api/media/files/`
- Les médias peuvent être dans `productMedia` (spécifiques au produit) ou `serviceMedia` (médias du service)


