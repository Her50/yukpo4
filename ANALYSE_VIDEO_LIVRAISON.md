# Analyse du comportement de la vidéo de livraison

## ✅ Phase 9 - Amélioration : Analyse du système de vidéo de preuve de livraison

### Objectif
Permettre au coursier d'ajouter des images et vidéos de l'état initial du produit lors de sa récupération, pour évaluer s'il y a eu dégradation lors du transport.

### Implémentation réalisée

#### 1. Backend

##### Table `delivery_proof_media`
- Stocke les médias (images/vidéos) de preuve de pickup et delivery
- Champs:
  - `id`: Identifiant unique
  - `delivery_id`: UUID de la livraison
  - `media_type`: 'image' ou 'video'
  - `media_url`: URL du média (S3/Wasabi ou local)
  - `proof_type`: 'pickup' ou 'delivery'
  - `uploaded_by`: ID de l'utilisateur qui a uploadé
  - `uploaded_at`: Date d'upload
  - `metadata`: JSONB pour métadonnées supplémentaires

##### Endpoints API
1. **POST /api/media/upload-proof**
   - Upload multipart/form-data
   - Champs: `file`, `delivery_id`, `proof_type`, `metadata` (optionnel)
   - Validation: seul le coursier assigné peut uploader
   - Validation du statut de livraison selon le `proof_type`
   - Upload vers S3/Wasabi (à intégrer avec le service existant)

2. **GET /api/delivery/{id}/proof-media**
   - Liste tous les médias de preuve pour une livraison
   - Accessible par le coursier, créateur et client

3. **DELETE /api/delivery/{id}/proof-media/{media_id}**
   - Supprime un média
   - Accessible par le coursier ou le créateur

4. **GET /api/media/proof/{filename}**
   - Sert les fichiers depuis le stockage local (fallback)
   - Redirige vers l'URL S3/Wasabi si c'est une URL publique

##### Intégration S3/Wasabi
- Fonction `upload_to_s3_wasabi()` créée dans `media_upload_routes.rs`
- **À FAIRE**: Intégrer le service S3/Wasabi existant utilisé pour les vidéos
- Le service devrait être dans `video_generation_service.rs` ou un service dédié
- Instructions détaillées dans les commentaires de la fonction

#### 2. Frontend

##### Composant `ProofMediaUpload`
- Upload d'images/vidéos via input file
- Affichage des médias par type (pickup/delivery)
- Comparaison côte à côte de l'état initial (pickup) vs final (delivery)
- Suppression pour le coursier
- Intégré dans `DeliveryTrackingPage`

##### Fonctionnalités
- Upload via `FormData` vers `/api/media/upload-proof`
- Affichage des médias avec preview
- Comparaison automatique pickup vs delivery
- Gestion des erreurs et feedback utilisateur

#### 3. Mobile

##### Composant `ProofMediaUpload` (React Native)
- Upload via caméra ou galerie (`expo-image-picker`)
- Affichage horizontal des médias
- Comparaison pickup vs delivery
- Suppression pour le coursier
- Intégré dans `DeliveryShoppingTrackingScreen`

##### Fonctionnalités
- Upload via `FormData` avec support des URIs locales
- Gestion des permissions caméra/galerie
- Preview des médias
- Comparaison visuelle

### Workflow

1. **Récupération (Pickup)**
   - Le coursier arrive au point de pickup
   - Statut: `en_route_pickup` ou `shopping_completed`
   - Le coursier peut uploader des images/vidéos de l'état initial du produit
   - `proof_type = 'pickup'`

2. **Livraison (Delivery)**
   - Le coursier arrive au point de livraison
   - Statut: `en_route_delivery` ou `delivered`
   - Le coursier peut uploader des images/vidéos de l'état final du produit
   - `proof_type = 'delivery'`

3. **Comparaison**
   - Le client/créateur peut voir les médias de pickup et delivery côte à côte
   - Permet d'évaluer s'il y a eu dégradation lors du transport
   - Affichage automatique de la comparaison si les deux types existent

### Sécurité

- ✅ Seul le coursier assigné peut uploader des médias
- ✅ Validation du statut de livraison selon le `proof_type`
- ✅ Validation des types de fichiers (images/vidéos uniquement)
- ✅ Limite de taille: 10MB pour images, 50MB pour vidéos
- ✅ Sécurisation des noms de fichiers (pas de path traversal)
- ✅ Vérification des permissions pour la suppression

### Prochaines étapes

1. **Intégrer le service S3/Wasabi existant**
   - Trouver la fonction d'upload dans `video_generation_service.rs` ou service dédié
   - Adapter `upload_to_s3_wasabi()` pour utiliser ce service
   - Tester l'upload vers S3/Wasabi

2. **Améliorations possibles**
   - Compression automatique des images avant upload
   - Génération de thumbnails pour les vidéos
   - Métadonnées EXIF pour les images (GPS, timestamp)
   - Notifications au client quand des médias sont ajoutés
   - Système de signalement de dégradation

3. **Analytics**
   - Tracker le nombre de médias uploadés par livraison
   - Statistiques sur les dégradations détectées
   - Temps moyen entre pickup et delivery

### Variables d'environnement nécessaires

```env
# S3/Wasabi (si utilisé)
WASABI_BUCKET=your-bucket-name
WASABI_REGION=us-east-1
WASABI_ACCESS_KEY=your-access-key
WASABI_SECRET_KEY=your-secret-key
WASABI_ENDPOINT=https://s3.wasabisys.com  # Optionnel

# Ou stockage local (fallback)
MEDIA_UPLOAD_DIR=./uploads/proof_media
```

### Notes techniques

- Les URLs S3/Wasabi sont stockées directement dans `media_url`
- Si l'upload S3 échoue, fallback vers stockage local
- Les fichiers locaux sont servis via `/api/media/proof/{filename}`
- Les URLs S3/Wasabi sont servies directement (redirection ou proxy selon besoin)

