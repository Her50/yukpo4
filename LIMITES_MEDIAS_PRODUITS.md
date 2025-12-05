# Limites des Médias pour les Produits

## 📋 Résumé des Limites

### Images
- **Nombre maximum** : **10 images** par produit
- **Taille maximale par image** : **10 MB**
- **Format supporté** : JPEG, PNG, GIF, WebP
- **Compression automatique** : Oui (si la version compressée est plus petite)

### Vidéos
- **Nombre maximum** : **3 vidéos** par produit
- **Taille maximale par vidéo** : **100 MB** (backend validation)
- **Taille maximale par vidéo** : **50 MB** (route upload direct)
- **Format supporté** : MP4

### Limites Globales de Requête
- **Taille maximale de la requête HTTP** : **200 MB** (body limit)
- **Taille maximale d'entrée totale** : **500 MB** (security service)
- **Nombre maximum de fichiers par requête** : **10 fichiers** (security service)

## 📍 Où sont définies ces limites ?

### Backend (`backend/src/services/product_validation_service.rs`)
```rust
pub const MAX_IMAGE_SIZE_MB: usize = 10;
pub const MAX_VIDEO_SIZE_MB: usize = 100;
pub const MAX_IMAGES_COUNT: usize = 10;
pub const MAX_VIDEOS_COUNT: usize = 3;
```

### Frontend (`frontend/src/components/ui/ProductManager.tsx`)
```typescript
// Validation des images
if (product.images && product.images.length > 10) {
    errors.push("Maximum 10 images par produit");
}

// Validation des vidéos
if (product.videos && product.videos.length > 3) {
    errors.push("Maximum 3 vidéos par produit");
}
```

### Routes HTTP (`backend/src/routers/router_yukpo.rs`)
```rust
.layer(axum::extract::DefaultBodyLimit::max(200_000_000)) // 200 MB
```

### Security Service (`backend/src/services/security_service.rs`)
```rust
max_input_size: 500 * 1024 * 1024, // 500MB
max_files_per_request: 10,
```

## ⚠️ Contraintes Techniques

### 1. Taille des Fichiers
- **Images** : Maximum 10 MB par fichier
  - Compression automatique activée si disponible
  - Streaming pour fichiers > 5 MB (économie mémoire)
  - Signature d'image générée seulement si < 10 MB (économie CPU)

- **Vidéos** : Maximum 100 MB par fichier (backend) ou 50 MB (upload direct)
  - Traitement asynchrone recommandé pour grandes vidéos
  - Support du streaming pour fichiers volumineux

### 2. Nombre de Fichiers
- **10 images maximum** : Limite appliquée côté frontend et backend
- **3 vidéos maximum** : Limite appliquée côté frontend et backend
- **10 fichiers maximum par requête** : Limite globale du security service

### 3. Taille Totale de la Requête
- **200 MB** : Limite du body HTTP (pour permettre images/vidéos base64)
- **500 MB** : Limite globale du security service
- **Note** : Les fichiers base64 prennent ~33% plus d'espace que les binaires

## 💡 Recommandations

### Pour les Images
1. **Utiliser la compression automatique** : Le système compresse automatiquement les images si possible
2. **Privilégier JPEG/WebP** : Meilleure compression que PNG
3. **Résolution recommandée** : 1920x1080 max pour un bon équilibre qualité/taille
4. **Éviter les images > 5 MB** : Utilisation du streaming (plus lent)

### Pour les Vidéos
1. **Utiliser l'upload asynchrone** : Pour les vidéos > 50 MB, utiliser `/api/async-upload/start`
2. **Compression avant upload** : Compresser les vidéos avant l'envoi
3. **Format recommandé** : MP4 H.264 pour meilleure compatibilité
4. **Durée recommandée** : < 2 minutes pour un bon équilibre

### Pour les Produits avec Beaucoup de Médias
1. **Répartir les médias** : Utiliser plusieurs produits si nécessaire
2. **Prioriser les images principales** : Mettre les meilleures images en premier
3. **Utiliser des URLs externes** : Pour les très gros fichiers, héberger ailleurs et utiliser des URLs

## 🔧 Optimisations Actuelles

### Compression Automatique
- ✅ Compression automatique des images lors de la sauvegarde
- ✅ Sauvegarde de la version compressée si plus petite
- ✅ Conservation de l'original si compression échoue

### Streaming
- ✅ Streaming pour fichiers > 5 MB (économie mémoire)
- ✅ Décodage base64 par chunks (évite chargement complet en mémoire)
- ✅ Écriture directe sur disque sans accumulation

### Traitement Parallèle
- ✅ Traitement parallèle des images d'un produit
- ✅ Génération de signatures en parallèle
- ✅ Sauvegarde optimisée avec transactions

## 📊 Calcul de la Taille Maximale Théorique

### Scénario Maximum (Images)
- 10 images × 10 MB = **100 MB** (images)
- Taille base64 = 100 MB × 1.33 = **~133 MB**
- **Total : ~133 MB** (sous la limite de 200 MB)

### Scénario Maximum (Vidéos)
- 3 vidéos × 100 MB = **300 MB** (vidéos)
- Taille base64 = 300 MB × 1.33 = **~400 MB**
- **Total : ~400 MB** (sous la limite de 500 MB)

### Scénario Mixte Maximum
- 10 images × 10 MB = 100 MB
- 3 vidéos × 100 MB = 300 MB
- **Total binaire : 400 MB**
- **Total base64 : ~530 MB** (dépasse la limite de 500 MB du security service)

⚠️ **Attention** : Un produit avec le maximum d'images ET de vidéos peut dépasser la limite de 500 MB du security service. Dans ce cas, utiliser l'upload asynchrone ou réduire la taille des fichiers.

## 🚀 Améliorations Possibles

### Augmenter les Limites
Pour augmenter les limites, modifier :
1. `backend/src/services/product_validation_service.rs` : Constantes MAX_*
2. `frontend/src/components/ui/ProductManager.tsx` : Validation frontend
3. `backend/src/routers/router_yukpo.rs` : DefaultBodyLimit
4. `backend/src/services/security_service.rs` : max_input_size

### Upload Asynchrone
Pour les très gros fichiers, utiliser :
- `POST /api/async-upload/start` : Démarrer un upload asynchrone
- `GET /api/async-upload/status/:upload_id` : Vérifier le statut
- `WS /ws/upload-status/:upload_id` : Suivi en temps réel

## 📝 Notes Importantes

1. **Validation stricte** : Les limites sont appliquées côté frontend ET backend
2. **Messages d'erreur clairs** : L'utilisateur est informé des limites dépassées
3. **Rollback automatique** : En cas d'erreur, la transaction est annulée
4. **Métriques Prometheus** : Suivi des créations de produits et durées

