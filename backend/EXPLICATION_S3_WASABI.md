# 📚 Explication Complète : S3/Wasabi dans Yukpomnang

## 🎯 Qu'est-ce que S3/Wasabi ?

### **S3 (Amazon Simple Storage Service)**
- Service de stockage d'objets cloud d'Amazon Web Services (AWS)
- Permet de stocker et récupérer des données (fichiers) depuis n'importe où
- URLs publiques accessibles via HTTP/HTTPS
- Scalable à l'infini

### **Wasabi**
- Alternative compatible S3, moins chère qu'AWS
- Même API que S3 (compatible 100%)
- Performance similaire, coûts réduits
- Idéal pour stockage de médias (images, vidéos)

## 🔧 Rôle dans l'Application Yukpomnang

### **1. Service Centralisé : `MediaStorageService`**

Tous les médias de l'application passent par ce service unique :

```rust
// backend/src/services/media_storage_service.rs
pub struct MediaStorageService {
    config: MediaStorageConfig,
    client: Option<Client>,  // Client S3/Wasabi
    bucket: Option<String>,  // Nom du bucket
}
```

### **2. Fonctionnement**

Le service fonctionne en **2 modes** :

#### **Mode Cloud (S3/Wasabi)** ✅ Recommandé
- Fichiers uploadés vers le cloud
- URLs publiques générées automatiquement
- Pas de stockage local (ou optionnel)

#### **Mode Local** (Fallback)
- Si S3/Wasabi non configuré
- Stockage dans `UPLOAD_STORAGE_PATH`
- Pour développement/test

## 📦 Utilisation Concrète dans l'Application

### **1. Création de Services avec Médias**

Quand un utilisateur crée un service avec des images/vidéos :

```typescript
// Frontend : CreationService.tsx
const handleValidate = async () => {
  // 1. Créer le service
  const res = await axios.post("/api/prestataire/valider-service", form);
  const service_id = res.data.id;

  // 2. Uploader les médias
  const formData = new FormData();
  imageFiles.forEach(file => formData.append("media", file));
  
  // ✅ ICI : Upload vers S3/Wasabi
  await axios.post(`/api/prestataire/upload/${service_id}`, formData);
};
```

**Backend** : Route `/api/prestataire/upload/{service_id}`

```rust
// backend/src/routes/media_upload_routes.rs
pub async fn upload_proof_media_file(...) {
    // ✅ Utilise MediaStorageService
    match state.media_storage.store_bytes(data, storage_key, content_type).await {
        Ok(location) => {
            // location.public_url = "https://s3.amazonaws.com/bucket/uploads/..."
            // ✅ URL publique S3/Wasabi générée automatiquement
        }
    }
}
```

### **2. Création de Produits avec Images**

Quand un utilisateur ajoute des images à un produit :

```typescript
// Frontend : ProductManager.tsx
// Les images sont uploadées via le même système
// Stockage dans : uploads/products/{product_id}/{image_name}
```

**Backend** : Même service `MediaStorageService`

### **3. Commentaires avec Médias**

Quand un utilisateur ajoute une image/vidéo à un commentaire :

```rust
// backend/src/routes/comment_media_routes.rs
pub async fn upload_comment_media(...) {
    // ✅ Utilise MediaStorageService (S3/Wasabi)
    match state.media_storage.store_bytes(&data, &storage_key, Some(&content_type)).await {
        Ok(location) => {
            // location.public_url = URL S3/Wasabi
            // Stockage dans : uploads/comments/{comment_id}/{file_name}
        }
    }
}
```

### **4. Génération de Vidéos IA**

Quand le système génère une vidéo automatiquement :

```rust
// backend/src/services/video_generation_service.rs
// ✅ Vidéo générée → Upload vers S3/Wasabi
state.media_storage
    .store_file(&source_master_path, &storage_key, Some("video/mp4"))
    .await?;
```

### **5. Images Générées par IA**

Quand l'IA génère une image :

```rust
// backend/src/services/ai_image_generation_service.rs
// ✅ Image générée → Upload vers S3/Wasabi
storage_service
    .store_bytes(image_bytes, &storage_key, Some("image/jpeg"))
    .await?;
```

## 🗂️ Structure de Stockage

Tous les médias suivent cette structure dans S3/Wasabi :

```
bucket-name/
└── uploads/
    ├── services/
    │   └── {service_id}/
    │       ├── images/
    │       ├── videos/
    │       └── audio/
    ├── products/
    │   └── {product_id}/
    │       └── {image_name}
    ├── comments/
    │   └── {comment_id}/
    │       └── {media_name}
    ├── videos/
    │   └── {video_id}.mp4
    └── audio/
        └── {audio_id}.wav
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# S3/Wasabi Configuration
S3_BUCKET=mon-bucket-yukpo
S3_REGION=us-east-1                    # ou eu-central-1 pour Wasabi
S3_ENDPOINT=https://s3.wasabisys.com   # Pour Wasabi (optionnel pour AWS)
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret...

# Options
S3_FORCE_PATH_STYLE=true              # Pour Wasabi
S3_KEEP_LOCAL_COPY=false              # Ne pas garder copie locale
S3_REMOVE_SOURCE_AFTER_UPLOAD=true    # Supprimer après upload

# URLs Publiques
PUBLIC_BASE_URL=https://cdn.yukpo.com  # CDN optionnel
UPLOAD_BASE_URL=https://s3.amazonaws.com/mon-bucket
```

### Détection Automatique

Le service détecte automatiquement si S3/Wasabi est configuré :

```rust
// Si S3 configuré → Mode Cloud
if client.is_some() {
    info!("[MediaStorage] Stockage distant activé (S3/Wasabi)");
} else {
    info!("[MediaStorage] Stockage local utilisé");
}
```

## ✅ Avantages du Système S3/Wasabi

### **1. Scalabilité Infinie** 🚀
- **Problème** : Stockage local limité par la taille du disque serveur
- **Solution** : S3/Wasabi peut stocker des **millions de fichiers** sans limite
- **Résultat** : Application prête pour croissance massive

### **2. Performance Globale** ⚡
- **CDN Intégré** : Les fichiers sont servis depuis des serveurs proches des utilisateurs
- **Latence Réduite** : Images/vidéos chargent plus vite
- **Bandwidth Illimité** : Pas de limite de bande passante

### **3. Fiabilité** 🛡️
- **Redondance** : Fichiers répliqués automatiquement (99.999999999% de durabilité)
- **Disponibilité** : 99.99% de uptime garanti
- **Backup Automatique** : Pas besoin de sauvegardes manuelles

### **4. Coûts Optimisés** 💰
- **Wasabi** : ~80% moins cher qu'AWS S3
- **Pas de frais de sortie** : Wasabi ne facture pas les transferts sortants
- **Stockage à la demande** : Payez seulement ce que vous utilisez

### **5. Séparation des Responsabilités** 🏗️
- **Serveur Backend** : Se concentre sur la logique métier
- **Stockage** : Géré par un service spécialisé
- **Maintenance** : Pas de gestion de disques/serveurs de fichiers

### **6. URLs Publiques Directes** 🔗
- **Pas de proxy** : Les fichiers sont servis directement depuis S3/Wasabi
- **Moins de charge serveur** : Le backend ne sert pas les fichiers
- **CDN Ready** : Facile d'ajouter CloudFront/Cloudflare

### **7. Sécurité** 🔒
- **Contrôle d'accès** : IAM policies pour limiter l'accès
- **HTTPS** : Tous les transferts sont chiffrés
- **Versioning** : Possibilité de versionner les fichiers

## 📊 Comparaison : Local vs S3/Wasabi

| Critère | Stockage Local | S3/Wasabi |
|---------|---------------|-----------|
| **Scalabilité** | ❌ Limitée par disque | ✅ Infinie |
| **Performance** | ⚠️ Dépend du serveur | ✅ CDN global |
| **Fiabilité** | ⚠️ Dépend du serveur | ✅ 99.99% uptime |
| **Coût** | ✅ Gratuit (disque) | ⚠️ Payant mais faible |
| **Maintenance** | ❌ Gestion manuelle | ✅ Géré par le provider |
| **Backup** | ❌ Manuel | ✅ Automatique |
| **URLs Publiques** | ⚠️ Nécessite proxy | ✅ Directes |

## 🎯 Cas d'Usage Concrets

### **Exemple 1 : Upload Image Produit**

1. **Utilisateur** : Upload image via formulaire
2. **Frontend** : Envoie à `/api/prestataire/upload/{service_id}`
3. **Backend** : `MediaStorageService.store_bytes()`
4. **S3/Wasabi** : Fichier stocké dans `uploads/products/123/image.jpg`
5. **URL Générée** : `https://s3.amazonaws.com/bucket/uploads/products/123/image.jpg`
6. **Base de Données** : URL sauvegardée dans `products.data.images[]`
7. **Frontend** : Affiche l'image depuis l'URL S3/Wasabi

### **Exemple 2 : Génération Vidéo IA**

1. **IA** : Génère vidéo → Fichier local temporaire
2. **Backend** : `MediaStorageService.store_file()`
3. **S3/Wasabi** : Upload vidéo → `uploads/videos/456/video.mp4`
4. **URL Générée** : URL publique S3/Wasabi
5. **Base de Données** : URL sauvegardée
6. **Utilisateur** : Peut voir la vidéo depuis n'importe où

## 🔍 Vérification dans le Code

### **Tous les Uploads Utilisent MediaStorageService**

```rust
// ✅ Commentaires
state.media_storage.store_bytes(...)

// ✅ Services
state.media_storage.store_bytes(...)

// ✅ Produits
state.media_storage.store_bytes(...)

// ✅ Vidéos générées
state.media_storage.store_file(...)

// ✅ Images IA
state.media_storage.store_bytes(...)

// ✅ Audio mastering
state.media_storage.store_file(...)
```

## 🎉 Conclusion

**S3/Wasabi est le système de stockage centralisé de tous les médias dans Yukpomnang.**

- ✅ **Tous les uploads** passent par `MediaStorageService`
- ✅ **Tous les médias** (images, vidéos, audio) sont sur S3/Wasabi
- ✅ **URLs publiques** générées automatiquement
- ✅ **Scalable** à l'infini
- ✅ **Performant** avec CDN
- ✅ **Fiable** avec redondance automatique

**L'application est prête pour des millions d'utilisateurs et des millions de médias !** 🚀

