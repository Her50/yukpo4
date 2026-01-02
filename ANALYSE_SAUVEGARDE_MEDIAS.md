# 🔍 Analyse - Mécanisme de Sauvegarde des Médias

**Date**: 2025-12-30  
**Problème**: Échec de création de service/produit avec médias volumineux (timeout réseau)

## 📊 Analyse Comparative

### ✅ AjouterProduitSimpleScreen (FONCTIONNE)

**Mécanisme utilisé** : **Upload préalable des médias**

1. **Compression des médias** :
   ```typescript
   const compressedMedia = await compressAllMedia(mediaForCompression);
   ```

2. **Upload préalable vers le cloud** :
   ```typescript
   const { uploadFiles } = await import('../services/uploadApi');
   const uploadedFiles = await uploadFiles(filesToUpload);
   ```

3. **Remplacement base64 → URLs** :
   ```typescript
   // ✅ Remplacer base64 par URLs dans nouveauProduit
   nouveauProduit.imageUrls = imageUrls; // URLs au lieu de base64
   nouveauProduit.videoUrls = videoUrls; // URLs au lieu de base64
   ```

4. **Envoi du payload avec URLs** :
   ```typescript
   // Le payload contient des URLs, pas du base64
   response = await apiPost(`/api/services/${serviceId}/products`, {
       user_id: userId,
       product_data: nouveauProduit // Contient imageUrls/videoUrls
   });
   ```

**Résultat** : ✅ Payload léger (quelques KB au lieu de MB), pas de timeout

---

### ❌ FormulaireYukpoIntelligentScreen (PROBLÉMATIQUE)

**Mécanisme utilisé** : **Envoi direct en base64 dans le JSON**

1. **Compression des médias** :
   ```typescript
   const compressedMedia = await getCompressedMedia();
   // Compression faite, mais...
   ```

2. **❌ PAS d'upload préalable** - Les médias restent en base64

3. **Ajout des médias base64 dans le payload** :
   ```typescript
   attachMediaField('base64_image', compressedMedia.images, { typeDonnee: 'media' });
   attachMediaField('video_base64', compressedMedia.videos, { typeDonnee: 'media' });
   // ... etc
   ```

4. **Envoi du payload avec TOUT le base64** :
   ```typescript
   const servicePayload = {
       user_id: userId,
       data: finalServiceData // Contient TOUS les médias en base64 !
   };
   const response = await apiPost('/api/services/create', servicePayload);
   ```

**Problème** :
- ❌ Payload énorme (plusieurs MB même après compression)
- ❌ Timeout réseau lors de l'envoi
- ❌ Problèmes de mémoire côté backend lors du parsing JSON
- ❌ Erreurs "Network request failed" ou "Aborted"

---

## 🔍 Comparaison Détaillée

| Aspect | AjouterProduitSimple | FormulaireYukpoIntelligent |
|--------|---------------------|---------------------------|
| **Compression** | ✅ Oui | ✅ Oui |
| **Upload préalable** | ✅ **OUI** | ❌ **NON** |
| **Format d'envoi** | URLs (léger) | Base64 (lourd) |
| **Taille payload** | ~5-50 KB | ~5-100+ MB |
| **Risque timeout** | ❌ Faible | ✅ **ÉLEVÉ** |
| **Temps d'envoi** | < 1 seconde | 30-180+ secondes |
| **Fiabilité** | ✅ Haute | ❌ Faible |

---

## 🎯 Solution : Implémenter Upload Préalable dans FormulaireYukpoIntelligentScreen

### Changements Nécessaires

1. **Ajouter l'upload préalable des médias** (comme dans AjouterProduitSimple)
2. **Remplacer les base64 par des URLs** dans `finalServiceData`
3. **Envoyer le payload avec URLs** au lieu de base64

### Code à Ajouter

**Dans `FormulaireYukpoIntelligentScreen.tsx`, après la compression des médias** :

```typescript
// ✅ NOUVEAU: Upload préalable des médias (comme AjouterProduitSimple)
console.log('[FormulaireYukpoIntelligentScreen] 📤 Début upload préalable des médias...');
try {
    const { uploadFiles } = await import('../services/uploadApi');

    // Collecter tous les médias à uploader (après compression)
    const filesToUpload: Array<{ uri: string; type: string; name?: string }> = [];

    // Images service
    if (compressedMedia.images?.length > 0) {
        compressedMedia.images.forEach((img: string, idx: number) => {
            if (img && (img.startsWith('data:') || img.startsWith('file://'))) {
                const mimeType = img.startsWith('data:')
                    ? img.split(',')[0].split(':')[1].split(';')[0]
                    : 'image/jpeg';
                filesToUpload.push({
                    uri: img,
                    type: mimeType,
                    name: `service_image_${idx}.jpg`
                });
            }
        });
    }

    // Vidéos service
    if (compressedMedia.videos?.length > 0) {
        compressedMedia.videos.forEach((vid: string, idx: number) => {
            if (vid && (vid.startsWith('data:') || vid.startsWith('file://'))) {
                const mimeType = vid.startsWith('data:')
                    ? vid.split(',')[0].split(':')[1].split(';')[0]
                    : 'video/mp4';
                filesToUpload.push({
                    uri: vid,
                    type: mimeType,
                    name: `service_video_${idx}.mp4`
                });
            }
        });
    }

    // Audios, documents, excel, logo, banner (même logique)

    // Uploader tous les fichiers
    if (filesToUpload.length > 0) {
        console.log(`[FormulaireYukpoIntelligentScreen] 📤 Upload de ${filesToUpload.length} fichier(s)...`);
        const uploadedFiles = await uploadFiles(filesToUpload);
        console.log('[FormulaireYukpoIntelligentScreen] ✅ Upload réussi:', uploadedFiles.length, 'fichier(s)');

        // ✅ CRITIQUE: Remplacer base64 par URLs dans compressedMedia
        const uploadedImages = uploadedFiles.filter(f => f.media_type === 'image').map(f => f.url);
        const uploadedVideos = uploadedFiles.filter(f => f.media_type === 'video').map(f => f.url);
        const uploadedAudios = uploadedFiles.filter(f => f.media_type === 'audio').map(f => f.url);
        const uploadedDocs = uploadedFiles.filter(f => f.media_type === 'document').map(f => f.url);
        const uploadedExcel = uploadedFiles.filter(f => f.media_type === 'excel').map(f => f.url);
        const uploadedLogo = uploadedFiles.filter(f => f.media_type === 'logo').map(f => f.url)[0]; // Premier seulement
        const uploadedBanner = uploadedFiles.filter(f => f.media_type === 'banner').map(f => f.url)[0]; // Premier seulement

        // Remplacer dans compressedMedia pour utilisation ultérieure
        if (uploadedImages.length > 0) compressedMedia.images = uploadedImages;
        if (uploadedVideos.length > 0) compressedMedia.videos = uploadedVideos;
        if (uploadedAudios.length > 0) compressedMedia.audios = uploadedAudios;
        if (uploadedDocs.length > 0) compressedMedia.documents = uploadedDocs;
        if (uploadedExcel.length > 0) compressedMedia.excel = uploadedExcel;
        if (uploadedLogo) compressedMedia.logo = [uploadedLogo];
        if (uploadedBanner) compressedMedia.banner = [uploadedBanner];

        console.log('[FormulaireYukpoIntelligentScreen] ✅ Médias remplacés par URLs:', {
            images: uploadedImages.length,
            videos: uploadedVideos.length,
            audios: uploadedAudios.length,
            documents: uploadedDocs.length
        });
    } else {
        console.log('[FormulaireYukpoIntelligentScreen] ℹ️ Aucun média à uploader');
    }
} catch (uploadError: any) {
    console.warn('[FormulaireYukpoIntelligentScreen] ⚠️ Erreur upload préalable, fallback base64:', uploadError.message);
    // Fallback: continuer avec base64 si upload échoue (rétrocompatibilité)
}
```

**Modifier `attachMediaField` pour accepter URLs** :

```typescript
const attachMediaField = (fieldName: string, values: any[], options: { typeDonnee?: string; takeFirst?: boolean } = {}) => {
    if (!values || !Array.isArray(values)) {
        return;
    }

    const cleaned = values.filter(Boolean);
    if (cleaned.length === 0) {
        return;
    }

    const { typeDonnee = 'array', takeFirst = false } = options;
    const valeur = takeFirst ? cleaned[0] : cleaned;

    // ✅ NOUVEAU: Si ce sont des URLs (commencent par http:// ou https://), les stocker comme URLs
    // Sinon, supposer que c'est du base64 (comportement existant)
    const isUrls = cleaned.every(v => typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://')));
    
    finalServiceData[fieldName] = {
        type_donnee: isUrls ? (typeDonnee === 'image' ? 'url' : 'array_url') : typeDonnee,
        valeur,
        origine_champs: 'formulaire',
        ...(isUrls && { format: 'url' }) // Indicateur que ce sont des URLs
    };
};
```

---

## 📋 Checklist d'Implémentation

- [ ] Importer `uploadFiles` depuis `../services/uploadApi`
- [ ] Collecter tous les médias compressés à uploader
- [ ] Appeler `uploadFiles` pour uploader vers le cloud
- [ ] Remplacer les base64 par les URLs retournées
- [ ] Modifier `attachMediaField` pour accepter URLs
- [ ] Gérer les erreurs d'upload (fallback base64 si nécessaire)
- [ ] Tester avec des médias volumineux (plusieurs images/vidéos)
- [ ] Vérifier que le payload final est léger (< 100 KB au lieu de MB)

---

## 🎯 Bénéfices Attendus

1. **Payload réduit** : De plusieurs MB à quelques KB (URLs au lieu de base64)
2. **Pas de timeout** : Transfert rapide du payload JSON
3. **Meilleure fiabilité** : Moins de risques d'erreurs réseau
4. **Performance améliorée** : Backend n'a pas à parser/stockager base64
5. **Expérience utilisateur** : Upload plus rapide et fiable

---

## 🔗 Fichiers à Modifier

- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` : Ajouter upload préalable
- `mobile/src/services/uploadApi.ts` : Vérifier que la fonction existe et fonctionne

---

## ⚠️ Notes Importantes

1. **Rétrocompatibilité** : Garder un fallback vers base64 si l'upload échoue
2. **Gestion des erreurs** : Logger les erreurs d'upload mais ne pas bloquer la création
3. **Ordre des opérations** : Upload doit se faire AVANT la construction du payload final
4. **Types de médias** : Gérer tous les types (images, vidéos, audios, documents, excel, logo, banner)


