# 🔍 Analyse du problème : médias toujours envoyés en base64

## Date : 2025-12-31

## Problème identifié

**Erreur** : `413 Payload Too Large` (2633.01 KB)  
**Cause** : Les médias sont toujours envoyés en base64 dans le payload JSON au lieu d'utiliser les URLs uploadées via MediaStorage/CDN.

## Analyse du code

### 1. Le code essaie bien d'uploader les médias

Le code dans `FormulaireYukpoIntelligentScreen.tsx` :
- ✅ Upload préalable des médias (lignes 3936-4119)
- ✅ Utilise `uploadFiles` de `uploadApi.ts`
- ✅ Obtient des URLs depuis le serveur

### 2. Mais le fallback base64 est toujours utilisé

**Problème dans `attachMediaField` (lignes 4121-4173)** :

```typescript
const attachMediaField = (fieldName: string, values: any[] | string | undefined, options: { typeDonnee?: string; takeFirst?: boolean } = {}) => {
  // Si on a des URLs uploadées, les utiliser en priorité
  if (uploadedMediaUrls) {  // ⚠️ PROBLÈME : {} est truthy mais vide !
    let urlValue: string | string[] | undefined;

    switch (fieldName) {
      case 'base64_image':
        urlValue = uploadedMediaUrls.images;  // Peut être undefined
        break;
      // ...
    }

    // Si on a une URL, l'utiliser
    if (urlValue !== undefined) {  // ⚠️ PROBLÈME : undefined check mais pas de vérification de longueur !
      if (typeof urlValue === 'string' && urlValue.length > 0) {
        // ✅ Utiliser URL
        return;
      } else if (Array.isArray(urlValue) && urlValue.length > 0) {
        // ✅ Utiliser URLs
        return;
      }
    }
  }

  // ❌ FALLBACK : Utiliser base64 si pas d'URL (TOUJOURS EXÉCUTÉ si upload échoue ou vide)
  if (!values || (Array.isArray(values) && values.length === 0)) {
    return;
  }
  // ... utilise base64
};
```

### 3. Causes possibles

1. **Upload échoue silencieusement** : L'erreur est catchée (ligne 4115) mais `uploadedMediaUrls` reste `{}`
2. **URLs vides** : `uploadedMediaUrls.images` peut être `[]` (tableau vide) au lieu de `undefined`
3. **Vérification insuffisante** : La condition `if (urlValue !== undefined)` ne vérifie pas si c'est un tableau vide

## Solution

### Correction 1 : Vérifier que les URLs ne sont pas vides

```typescript
const attachMediaField = (fieldName: string, values: any[] | string | undefined, options: { typeDonnee?: string; takeFirst?: boolean } = {}) => {
  // ✅ CORRIGÉ : Vérifier que uploadedMediaUrls existe ET contient des données
  if (uploadedMediaUrls && Object.keys(uploadedMediaUrls).length > 0) {
    let urlValue: string | string[] | undefined;

    switch (fieldName) {
      case 'base64_image':
        urlValue = uploadedMediaUrls.images;
        break;
      // ...
    }

    // ✅ CORRIGÉ : Vérifier que urlValue existe ET n'est pas vide
    if (urlValue !== undefined) {
      if (typeof urlValue === 'string' && urlValue.length > 0) {
        finalServiceData[fieldName] = {
          type_donnee: options.typeDonnee || 'string',
          valeur: urlValue,
          origine_champs: 'formulaire'
        };
        console.log(`[attachMediaField] ✅ Utilisation URL pour ${fieldName}:`, urlValue);
        return; // ✅ IMPORTANT : Sortir pour éviter le fallback base64
      } else if (Array.isArray(urlValue) && urlValue.length > 0) {
        const { takeFirst = false } = options;
        const valeur = takeFirst ? urlValue[0] : urlValue;
        finalServiceData[fieldName] = {
          type_donnee: options.typeDonnee || 'array',
          valeur,
          origine_champs: 'formulaire'
        };
        console.log(`[attachMediaField] ✅ Utilisation URLs pour ${fieldName}:`, urlValue.length, 'URL(s)');
        return; // ✅ IMPORTANT : Sortir pour éviter le fallback base64
      }
    }
  }

  // ✅ CORRIGÉ : Fallback base64 SEULEMENT si pas d'URLs ET valeurs existent
  if (!values || (Array.isArray(values) && values.length === 0)) {
    console.log(`[attachMediaField] ⚠️ Pas de valeurs pour ${fieldName}, champ ignoré`);
    return;
  }

  // ⚠️ FALLBACK : Utiliser base64 compressé (seulement si upload a échoué)
  console.warn(`[attachMediaField] ⚠️ Fallback base64 pour ${fieldName} (upload échoué ou URLs vides)`);
  // ... reste du code base64
};
```

### Correction 2 : Améliorer la gestion d'erreur d'upload

```typescript
} catch (uploadError: any) {
  console.error('[FormulaireYukpoIntelligentScreen] ❌ Erreur upload préalable:', uploadError);
  // ✅ CORRIGÉ : Ne pas continuer avec base64 si upload échoue
  // Demander à l'utilisateur de réessayer
  Alert.alert(
    'Erreur upload',
    'Impossible d\'uploader les médias. Veuillez réessayer ou réduire le nombre d\'images.',
    [
      { text: 'Annuler', onPress: () => { setIsSubmitting(false); setLoading(false); } },
      { text: 'Réessayer', onPress: () => soumettreFormulaire() }
    ]
  );
  return; // ✅ Sortir pour éviter d'envoyer en base64
}
```

### Correction 3 : Vérifier que MediaStorage est bien utilisé côté backend

Le backend utilise bien `MediaStorageService` pour uploader vers S3/Wasabi :
- ✅ `persist_base64_media` utilise `media_storage.store_file` (ligne 429)
- ✅ `upload_media` utilise `media_storage.store_bytes` (ligne 155)
- ✅ Les URLs CDN sont retournées dans la réponse

## Actions à prendre

1. ✅ Corriger `attachMediaField` pour vérifier que les URLs ne sont pas vides
2. ✅ Améliorer la gestion d'erreur d'upload (ne pas fallback base64 automatiquement)
3. ✅ Ajouter des logs pour déboguer pourquoi l'upload échoue
4. ✅ Vérifier que `uploadFiles` retourne bien les URLs CDN

## Vérifications

- [ ] MediaStorage est bien configuré (variables d'environnement S3/Wasabi)
- [ ] La route `/api/upload` fonctionne correctement
- [ ] Les URLs retournées sont bien des URLs CDN (pas des chemins locaux)
- [ ] Le payload final ne contient pas de base64 si les URLs sont disponibles

