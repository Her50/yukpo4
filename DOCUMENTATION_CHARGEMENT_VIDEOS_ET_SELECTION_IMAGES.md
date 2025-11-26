# 📹 Documentation - Chargement Vidéos et Sélection Images pour Montage

*Date: 2025-11-25*

## 🎯 Vue d'Ensemble

Ce document explique comment les vidéos sont chargées et comment les images locales sont sélectionnées pour le montage vidéo dans Yukpo.

---

## 📤 Chargement des Vidéos

### 1. Upload de Vidéos via API

**Endpoint** : `POST /api/prestataire/upload/{service_id}`

**Fichier** : `backend/src/controllers/media_controller.rs`

**Fonction** : `upload_media()`

```rust
pub async fn upload_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<UploadedMediaResponse>>>
```

**Fonctionnalités** :
- Accepte les fichiers multipart (images, vidéos, audio)
- Vérifie que l'utilisateur est propriétaire du service
- Sauvegarde dans `uploads/services/{service_id}/`
- Enregistre dans la table `media` avec :
  - `service_id`
  - `type` (image/video/audio)
  - `path` (chemin de stockage)
  - `product_index` (optionnel, pour produits spécifiques)
  - `media_type` (image/video/audio)
  - `uploaded_at`

**Types de médias supportés** :
- Images : `image/jpeg`, `image/png`, `image/webp`
- Vidéos : `video/mp4`, `video/webm`, `video/quicktime`
- Audio : `audio/mpeg`, `audio/wav`

### 2. Stockage

**Service** : `backend/src/services/media_storage_service.rs`

**Options de stockage** :
- **Local** : `UPLOAD_STORAGE_PATH` (par défaut: `uploads/`)
- **S3/Wasabi** : Configuration via variables d'environnement
  - `S3_BUCKET`
  - `S3_ACCESS_KEY`
  - `S3_SECRET_KEY`
  - `S3_ENDPOINT` (pour Wasabi)

**Structure de stockage** :
```
uploads/
  services/
    {service_id}/
      {filename}.jpg
      {filename}.mp4
      ...
```

### 3. Limites

**Frontend/Mobile** :
- **Images par produit** : Max 10 images
- **Vidéos par produit** : Max 3 vidéos
- **Taille max** : Dépend de la configuration serveur

**Fichiers concernés** :
- `frontend/src/components/ui/ProductManager.tsx` (ligne 461-462)
- `mobile/src/components/ProductManagerMobile.tsx`

---

## 🖼️ Sélection des Images Locales pour Montage

### 1. Fonction de Récupération

**Fichier** : `backend/src/services/video_generation_service.rs`

**Fonction** : `gather_media_sources()`

```rust
async fn gather_media_sources(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    selected_media_ids: Option<Vec<i32>>,
    use_product_gallery: bool,
    use_service_mediatech: bool,
    include_publicite_assets: bool,
) -> AppResult<Vec<MediaSource>>
```

### 2. Priorité de Sélection

La fonction `gather_media_sources()` sélectionne les images dans cet ordre :

#### **Priorité 1 : Médias Sélectionnés Explicitement**
```sql
SELECT id, path, type, ai_description
FROM media
WHERE service_id = $1
AND id = ANY($2)  -- IDs explicitement sélectionnés
```

**Utilisation** : Si `payload.selected_media_ids` est fourni, utilise ces IDs spécifiques.

#### **Priorité 2 : Images du Produit**
```sql
SELECT id, path, type, ai_description
FROM media
WHERE service_id = $1
AND (product_index = $2 OR (product_index IS NULL AND type = 'image'))
ORDER BY COALESCE(is_main_image, FALSE) DESC, 
         COALESCE(display_order, 0) ASC, 
         id ASC
LIMIT 16
```

**Utilisation** : Si `use_product_gallery = true`, récupère les images associées au produit spécifique.

**Ordre de priorité** :
1. Images avec `is_main_image = TRUE`
2. Images avec `display_order` le plus bas
3. Images les plus récentes (par `id`)

#### **Priorité 3 : Médiathèque du Service**
```sql
SELECT id, path, type, ai_description
FROM media
WHERE service_id = $1
AND (product_index IS NULL OR product_index != $2)
ORDER BY uploaded_at DESC
LIMIT 12
```

**Utilisation** : Si `use_service_mediatech = true`, récupère les images générales du service (non associées à un produit spécifique).

#### **Priorité 4 : Assets de Publicité**
```sql
SELECT id, path, type, ai_description
FROM media
WHERE service_id = $1
AND (
    media_type = 'banner'
    OR media_type = 'logo'
    OR path ILIKE '%publicite%'
    OR path ILIKE '%banner%'
)
ORDER BY uploaded_at DESC
LIMIT 6
```

**Utilisation** : Si `include_publicite_assets = true`, inclut les bannières et logos.

### 3. Limites et Filtrage

- **Maximum total** : 18 images (après toutes les sources)
- **Déduplication** : Les images déjà ajoutées sont ignorées (par `id`)
- **Type** : Seules les images (`type = 'image'`) sont utilisées pour la vidéo

### 4. Structure MediaSource

```rust
struct MediaSource {
    id: Option<i32>,
    path: String,
    ai_description: Option<String>,
    // ... autres champs
}
```

---

## 🎬 Intégration dans le Montage Vidéo

### 1. Flux de Génération Vidéo

```
1. Validation prérequis (images disponibles)
   ↓
2. gather_media_sources() - Récupération images locales
   ↓
3. Si pas d'images locales ET auto_generate_images = true
   → Génération images IA
   → Réessayer gather_media_sources()
   ↓
4. Création du storyboard avec les images
   ↓
5. Génération vidéo avec Remotion
```

### 2. Utilisation des Images

Les images récupérées sont utilisées pour :
- **Storyboard IA** : Génération automatique du scénario
- **Scènes vidéo** : Chaque image devient une scène
- **Transitions** : Entre les scènes
- **Effets** : Appliqués selon le style choisi

### 3. Paramètres de Sélection

**Dans `VideoGenerationPayload`** :
- `selected_media_ids` : IDs spécifiques à utiliser
- `use_product_gallery` : Utiliser images du produit (défaut: `true`)
- `use_service_mediatech` : Utiliser médiathèque service (défaut: `true`)
- `include_publicite_assets` : Inclure bannières/logos (défaut: `true`)
- `auto_generate_images` : **NOUVEAU** - Générer images IA si pas d'images locales

---

## 🔄 Nouvelle Fonctionnalité : Génération IA

### Priorité Mise à Jour

**Avant** :
1. Images locales uniquement
2. Erreur si pas d'images

**Après** :
1. ✅ **Images locales** (priorité absolue)
2. ✅ **Génération IA** si pas d'images locales et `auto_generate_images = true`
3. Erreur seulement si pas d'images et génération IA désactivée

### Flux avec Génération IA

```
1. gather_media_sources() - Chercher images locales
   ↓
2. Si media_sources.is_empty()
   ↓
3. Si auto_generate_images = true
   → generate_and_save_ai_images()
   → Sauvegarde dans table media
   → Réessayer gather_media_sources()
   ↓
4. Utiliser les images (locales ou générées)
```

---

## 📝 Exemples d'Utilisation

### Exemple 1 : Utiliser Images Locales Seulement

```json
{
  "use_product_gallery": true,
  "use_service_mediatech": true,
  "auto_generate_images": false
}
```

### Exemple 2 : Utiliser Images Spécifiques

```json
{
  "selected_media_ids": [123, 456, 789],
  "use_product_gallery": false,
  "use_service_mediatech": false,
  "auto_generate_images": false
}
```

### Exemple 3 : Génération IA si Pas d'Images

```json
{
  "use_product_gallery": true,
  "use_service_mediatech": true,
  "auto_generate_images": true  // ← Génère si pas d'images locales
}
```

---

## 🔗 Fichiers Clés

### Backend
- `backend/src/services/video_generation_service.rs` - Logique de sélection
- `backend/src/services/ai_image_generation_service.rs` - **NOUVEAU** - Génération IA
- `backend/src/controllers/media_controller.rs` - Upload médias
- `backend/src/services/media_storage_service.rs` - Stockage fichiers

### Frontend/Mobile
- `frontend/src/components/ui/ProductManager.tsx` - Gestion produits/images
- `mobile/src/components/ProductManagerMobile.tsx` - Gestion mobile
- `frontend/src/components/forms/VideoUploader.tsx` - Upload vidéos
- `mobile/src/screens/CreatePubliciteScreen.tsx` - Création publicité avec vidéos

---

## ✅ Résumé

1. **Chargement vidéos** : Via `POST /api/prestataire/upload/{service_id}`
2. **Sélection images** : Priorité locale → IA (si activé)
3. **Ordre de priorité** : Médias sélectionnés → Produit → Service → Publicité
4. **Nouvelle fonctionnalité** : Génération IA automatique si pas d'images locales

---

*Documentation créée le 2025-11-25*

