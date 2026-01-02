# 📹 Traitement des Vidéos AR Immersives

**Date**: 2 Janvier 2026  
**Fonctionnalité**: Capture et traitement des vidéos AR (Augmented Reality)

---

## 🔄 Flux de Traitement des Vidéos AR

### 1. **Capture AR** (Mobile)

**Fichier**: `mobile/src/components/ARVideoEditor.tsx`

L'utilisateur capture une vidéo AR immersive via l'éditeur AR :
- Utilisation de la caméra avec overlay AR
- Capture vidéo dans un format compatible (mp4)
- URI locale temporaire : `file://...`

---

### 2. **Upload vers le Cloud** (Mobile)

**Fichier**: `mobile/src/components/ProductVideoCreationModal.tsx` → `handleARVideoCaptured()`

**Fonction**: `uploadToCloud()` dans `mobile/src/services/cloudUpload.ts`

**Processus**:
1. **Réception**: La vidéo capturée arrive avec `videoUri` (URI locale)
2. **Upload Cloud**: 
   - Pour les gros fichiers vidéo (> 10MB) : Upload direct via FormData
   - Pour petits fichiers : Conversion base64 puis upload
   - **Endpoint**: `/api/upload`
   - **Type**: `video`
   - **Nom fichier**: `ar_video_{timestamp}.mp4`
3. **Stockage Cloud**: 
   - Cloudinary (via backend)
   - URL publique retournée : `https://res.cloudinary.com/...`

**Code clé**:
```typescript
const uploadResult = await uploadToCloud(
    videoUri,
    'video',
    `ar_video_${Date.now()}.mp4`
);
```

---

### 3. **Stockage Backend** (Backend)

**Fichier**: `backend/src/controllers/media_controller.rs` → `upload_media()`

**Processus**:
1. **Réception**: Upload via `/api/upload` (multipart/form-data)
2. **Validation**: 
   - Vérification propriétaire du service
   - Validation du type de fichier (video)
3. **Stockage**:
   - **Local**: `uploads/services/{service_id}/videos/{filename}`
   - **Cloud (S3/Wasabi)**: `services/{service_id}/videos/{filename}`
   - Utilise `MediaStorageService` pour upload vers CDN
4. **Base de données**:
   - URL stockée dans `services.data.products[].videos[]`
   - Chemin relatif ou URL CDN selon configuration

**Code clé**:
```rust
// backend/src/services/creer_service.rs → persist_base64_media()
// Upload S3/Wasabi via MediaStorageService
let final_path = if media_storage.is_remote() {
    media_storage.store_file(&disk_path, &storage_key, content_type).await?
} else {
    relative_path_str // Fallback local
};
```

---

### 4. **Ajout à la Médiathèque Produit** (Mobile)

**Fichier**: `mobile/src/components/ProductVideoCreationModal.tsx`

**Processus**:
1. **Création item média temporaire**:
   ```typescript
   const newMediaItem: MediaLibraryItem = {
       id: Date.now(), // ID temporaire
       path: uploadResult.url, // URL cloud
       type: 'video',
       media_type: 'video',
       product_index: productIndex,
       ai_description: 'Vidéo AR immersive',
   };
   ```

2. **Ajout immédiat**:
   - Ajouté à `productMedia` state
   - Sélectionné automatiquement dans `selectedMediaIds`
   - Affiché dans la médiathèque produit

3. **Rafraîchissement**:
   - Appel `refreshMedia()` pour obtenir l'ID réel depuis le serveur
   - Synchronisation avec la base de données

---

### 5. **Utilisation dans la Timeline Vidéo**

**Fichier**: `mobile/src/components/ProductVideoCreationModal.tsx` → `handleGenerateTimeline()`

**Processus**:
1. **Disponibilité**: La vidéo AR est maintenant dans `available_media`
2. **Génération Timeline**: 
   - L'IA peut utiliser la vidéo AR dans les scènes
   - `media_url` pointant vers l'URL cloud
   - `media_id` pour référence dans la timeline
3. **Prévisualisation**:
   - Utilisable dans `QuickPreview`
   - Utilisable dans la timeline immersive
   - Rendu final via Remotion

---

## 📊 Structure de Données

### Vidéo AR dans la Base de Données

```json
{
  "services": {
    "data": {
      "produits": [
        {
          "videos": [
            "https://res.cloudinary.com/.../ar_video_1234567890.mp4",
            "uploads/services/123/videos/ar_video_1234567890.mp4"
          ]
        }
      ]
    }
  }
}
```

### MediaLibraryItem (Mobile)

```typescript
interface MediaLibraryItem {
  id: number;
  path: string; // URL cloud ou chemin local
  type: 'video' | 'image';
  media_type: 'video' | 'image';
  product_index: number;
  ai_description?: string;
}
```

---

## 🔗 Endpoints API

### Upload Vidéo AR
- **Endpoint**: `POST /api/upload`
- **Format**: `multipart/form-data`
- **Body**:
  - `file`: Fichier vidéo
  - `type`: `"video"`
- **Response**:
  ```json
  {
    "success": true,
    "url": "https://res.cloudinary.com/...",
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "fileName": "ar_video_1234567890.mp4"
  }
  ```

---

## ✅ Points Clés

1. **Upload Optimisé**: 
   - Utilise FormData direct pour gros fichiers vidéo (> 10MB)
   - Évite OutOfMemoryError avec base64

2. **Stockage Hybride**:
   - Cloud (S3/Wasabi) pour production
   - Local pour développement

3. **Disponibilité Immédiate**:
   - Ajouté à la médiathèque immédiatement après upload
   - Utilisable dans la timeline sans rafraîchissement complet

4. **Traçabilité**:
   - Description "Vidéo AR immersive" pour identification
   - Timestamp dans le nom de fichier

---

## 🚨 Gestion d'Erreurs

- **Upload échoué**: Message d'erreur détaillé, modal fermé, utilisateur peut réessayer
- **Stockage échoué**: Fallback vers stockage local
- **Rafraîchissement échoué**: Non bloquant, utilisateur peut continuer

---

## 📝 Notes Techniques

- Les vidéos AR sont traitées comme des vidéos normales après upload
- Pas de traitement spécial AR après capture (effets AR gérés par ARVideoEditor)
- Compatible avec tous les pipelines de génération vidéo (timeline, preview, rendu)


