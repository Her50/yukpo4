# 🔍 Identification des Zones Nécessitant des URLs Pré-signées

## Date : 2025-01-XX

## 📋 Analyse Complète de l'Application

### ✅ Zones Identifiées Nécessitant des URLs Pré-signées

---

## 🎯 ZONE 1 : Preuves de Livraison (DELIVERY_PROOF_MEDIA)

### **Localisation** :
- **Backend** : `backend/src/routes/delivery_routes.rs`
- **Table DB** : `delivery_proof_media`
- **Mobile** : `mobile/src/components/delivery/ProofMediaUpload.tsx`

### **Contexte** :
```
Coursier upload vidéo/photo de preuve
    ↓
Client doit voir la preuve
    ↓
Mais pas accessible publiquement
```

### **Caractéristiques** :
- ✅ **Contenu privé** : Coursier → Client uniquement
- ✅ **Sécurité importante** : Preuve de livraison sensible
- ✅ **Accès contrôlé** : Seuls coursier et client concernés
- ✅ **Temporaire** : Valide pendant la livraison

### **Code Actuel** :
```rust
// backend/src/routes/delivery_routes.rs
.route("/api/delivery/{id}/proof-media", get(list_proof_media).post(upload_proof_media))
.route("/api/delivery/{id}/proof-media/{media_id}", delete(delete_proof_media))

// Table delivery_proof_media
// - delivery_id
// - proof_type ('pickup' | 'delivery')
// - media_url
// - uploaded_by
```

### **Recommandation** : ✅ **URLS PRÉ-SIGNÉES REQUISES**

**Raison** :
- Contenu privé entre coursier et client
- Sécurité critique (preuve de livraison)
- Pas besoin de cache CDN (accès ponctuel)
- Expiration souhaitée (après livraison)

**Durée recommandée** : 24-48 heures

---

## 🎯 ZONE 2 : Médias de Chat Privé (CHAT_MEDIA)

### **Localisation** :
- **Backend** : `backend/src/routes/chat_media_routes.rs`
- **Mobile** : `mobile/src/components/ChatModalMobile.tsx`

### **Contexte** :
```
Utilisateur A envoie image/vidéo à B dans chat privé
    ↓
B doit voir le média
    ↓
Mais pas accessible publiquement
```

### **Caractéristiques** :
- ✅ **Contenu privé** : Entre utilisateurs spécifiques
- ✅ **Sécurité importante** : Messages privés
- ✅ **Accès contrôlé** : Participants du chat uniquement
- ✅ **Temporaire** : Valide pendant la conversation

### **Code Actuel** :
```rust
// backend/src/routes/chat_media_routes.rs
.route("/api/chat/media/upload", post(upload_chat_media))

// Upload vers S3/Wasabi
// Stockage : uploads/chat/{chat_id}/{file_id}
```

### **Recommandation** : ✅ **URLS PRÉ-SIGNÉES REQUISES**

**Raison** :
- Contenu privé entre utilisateurs
- Sécurité importante (messages privés)
- Pas besoin de cache CDN (accès ponctuel)
- Expiration souhaitée (après conversation)

**Durée recommandée** : 7-30 jours

---

## 🎯 ZONE 3 : Partage de Fichiers Temporaires (SHARED_FILES)

### **Localisation** :
- **Backend** : `backend/src/services/file_sharing.rs`
- **Table DB** : `shared_files`

### **Contexte** :
```
Utilisateur partage fichier avec expiration
    ↓
Fichier accessible temporairement
    ↓
Avec limitation de téléchargements
```

### **Caractéristiques** :
- ✅ **Contenu privé** : Partage entre utilisateurs
- ✅ **Expiration** : `expires_at` dans DB
- ✅ **Limitation** : `max_downloads` dans DB
- ✅ **Traçabilité** : Table `file_downloads`

### **Code Actuel** :
```rust
// backend/src/services/file_sharing.rs
pub struct SharedFile {
    pub id: String,
    pub user_id: i32,
    pub chat_id: String,
    pub is_public: bool,
    pub max_downloads: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
}

// Table shared_files
// - expires_at
// - max_downloads
// - download_count
```

### **Recommandation** : ✅ **URLS PRÉ-SIGNÉES REQUISES**

**Raison** :
- Expiration déjà gérée dans DB
- Limitation de téléchargements
- Contenu privé/temporaire
- Traçabilité nécessaire

**Durée recommandée** : Selon `expires_at` dans DB

---

## 🎯 ZONE 4 : Documents Utilisateur Sensibles

### **Localisation** :
- **Backend** : `backend/src/controllers/user_controller.rs`
- **Routes** : `/api/user/me`, `/api/users/export-data`

### **Contexte** :
```
Utilisateur exporte ses données
    ↓
Fichier généré avec données sensibles
    ↓
Accès temporaire uniquement
```

### **Caractéristiques** :
- ✅ **Contenu sensible** : Données utilisateur
- ✅ **Temporaire** : Export ponctuel
- ✅ **Sécurité critique** : Données personnelles

### **Code Actuel** :
```rust
// backend/src/controllers/user_controller.rs
// export_user_data() - Génère export utilisateur
```

### **Recommandation** : ✅ **URLS PRÉ-SIGNÉES REQUISES**

**Raison** :
- Données personnelles sensibles
- Export ponctuel
- Sécurité critique
- Expiration souhaitée

**Durée recommandée** : 1-7 jours

---

## ❌ Zones NE Nécessitant PAS d'URLs Pré-signées

### **1. Images/Vidéos Produits** ❌

**Localisation** :
- `backend/src/services/creer_service.rs`
- `mobile/src/components/ProductCard.tsx`

**Raison** :
- Contenu public
- Performance critique (CDN cache)
- URLs stables nécessaires

**Recommandation** : ✅ **URLS PUBLIQUES (CDN)**

---

### **2. Médias de Services** ❌

**Localisation** :
- `backend/src/services/creer_service.rs`
- `mobile/src/components/ServiceMediaGallery.tsx`

**Raison** :
- Contenu public
- Performance critique (CDN cache)
- URLs stables nécessaires

**Recommandation** : ✅ **URLS PUBLIQUES (CDN)**

---

### **3. Feed Vidéo** ❌

**Localisation** :
- `mobile/src/screens/VideoFeedScreen.tsx`

**Raison** :
- Contenu public
- Performance critique (CDN cache)
- URLs stables nécessaires

**Recommandation** : ✅ **URLS PUBLIQUES (CDN)**

---

### **4. Avatars Utilisateurs** ❌

**Localisation** :
- `mobile/src/components/ChatModalMobile.tsx`
- `mobile/src/components/delivery/CourierSelectionModal.tsx`

**Raison** :
- Contenu public (avatars)
- Performance critique (CDN cache)
- URLs stables nécessaires

**Recommandation** : ✅ **URLS PUBLIQUES (CDN)**

---

## 📊 Tableau Récapitulatif

| Zone | Type | Sécurité | Performance | Recommandation |
|------|------|----------|-------------|---------------|
| **Preuves Livraison** | Privé | ⭐⭐⭐ | ⭐⭐ | ✅ **URLs Pré-signées** |
| **Médias Chat** | Privé | ⭐⭐⭐ | ⭐⭐ | ✅ **URLs Pré-signées** |
| **Fichiers Partagés** | Privé | ⭐⭐⭐ | ⭐⭐ | ✅ **URLs Pré-signées** |
| **Exports Utilisateur** | Sensible | ⭐⭐⭐ | ⭐ | ✅ **URLs Pré-signées** |
| **Images Produits** | Public | ⭐ | ⭐⭐⭐ | ❌ **URLs Publiques (CDN)** |
| **Vidéos Produits** | Public | ⭐ | ⭐⭐⭐ | ❌ **URLs Publiques (CDN)** |
| **Feed Vidéo** | Public | ⭐ | ⭐⭐⭐ | ❌ **URLs Publiques (CDN)** |
| **Avatars** | Public | ⭐ | ⭐⭐⭐ | ❌ **URLs Publiques (CDN)** |

---

## 🎯 Plan d'Implémentation par Zone

### **Phase 1 : Preuves de Livraison** (Priorité Haute)

**Fichiers à modifier** :
1. `backend/src/services/media_storage_service.rs` - Ajouter `generate_presigned_url()`
2. `backend/src/routes/delivery_routes.rs` - Modifier `list_proof_media()` pour retourner URLs pré-signées
3. `mobile/src/components/delivery/ProofMediaUpload.tsx` - Utiliser URLs pré-signées

**Durée pré-signée** : 48 heures

**Logique** :
```rust
// Backend génère URL pré-signée pour chaque preuve
GET /api/delivery/{id}/proof-media
    ↓
Pour chaque média :
    - Vérifier permissions (coursier ou client)
    - Générer URL pré-signée (48h)
    - Retourner URL pré-signée
```

---

### **Phase 2 : Médias de Chat** (Priorité Haute)

**Fichiers à modifier** :
1. `backend/src/routes/chat_media_routes.rs` - Modifier pour retourner URLs pré-signées
2. `mobile/src/components/ChatModalMobile.tsx` - Utiliser URLs pré-signées

**Durée pré-signée** : 7 jours

**Logique** :
```rust
// Backend génère URL pré-signée pour chaque média chat
GET /api/chat/{chat_id}/media
    ↓
Pour chaque média :
    - Vérifier permissions (participants du chat)
    - Générer URL pré-signée (7 jours)
    - Retourner URL pré-signée
```

---

### **Phase 3 : Fichiers Partagés** (Priorité Moyenne)

**Fichiers à modifier** :
1. `backend/src/services/file_sharing.rs` - Modifier `download_file()` pour générer URL pré-signée
2. Frontend/Mobile - Utiliser URLs pré-signées

**Durée pré-signée** : Selon `expires_at` dans DB

**Logique** :
```rust
// Backend génère URL pré-signée selon expiration DB
GET /api/files/{file_id}/download
    ↓
- Vérifier expiration (expires_at)
- Vérifier max_downloads
- Générer URL pré-signée (selon expires_at)
- Retourner URL pré-signée
```

---

### **Phase 4 : Exports Utilisateur** (Priorité Basse)

**Fichiers à modifier** :
1. `backend/src/controllers/user_controller.rs` - Modifier `export_user_data()`
2. Frontend/Mobile - Utiliser URLs pré-signées

**Durée pré-signée** : 7 jours

**Logique** :
```rust
// Backend génère export + URL pré-signée
POST /api/user/export-data
    ↓
- Générer fichier export
- Upload vers Wasabi
- Générer URL pré-signée (7 jours)
- Retourner URL pré-signée
```

---

## 🔧 Implémentation Technique

### **1. Ajouter Méthode Presigned URL**

```rust
// backend/src/services/media_storage_service.rs

use aws_sdk_s3::presigning::PresigningConfig;
use std::time::Duration;

impl MediaStorageService {
    /// Génère une URL pré-signée pour un objet Wasabi
    pub async fn generate_presigned_url(
        &self,
        storage_path: &str,
        expires_in_seconds: u64,
    ) -> AppResult<String> {
        let client = self.client.as_ref().ok_or_else(|| {
            AppError::Internal("Client S3 non configuré".to_string())
        })?;

        let bucket = self.bucket.as_ref().ok_or_else(|| {
            AppError::Internal("Bucket S3 non configuré".to_string())
        })?;

        let presigning_config = PresigningConfig::expires_in(
            Duration::from_secs(expires_in_seconds)
        ).map_err(|e| AppError::Internal(format!("Erreur config présignature: {}", e)))?;

        let presigned_request = client
            .get_object()
            .bucket(bucket)
            .key(storage_path)
            .presigned(presigning_config)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur génération URL pré-signée: {}", e)))?;

        Ok(presigned_request.uri().to_string())
    }
}
```

### **2. Modifier Routes Delivery**

```rust
// backend/src/routes/delivery_routes.rs

async fn list_proof_media(
    Path(delivery_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    // 1. Récupérer médias depuis DB
    let media = sqlx::query_as::<_, DeliveryProofMedia>(
        "SELECT * FROM delivery_proof_media WHERE delivery_id = $1"
    )
    .bind(delivery_id)
    .fetch_all(&state.pg)
    .await?;

    // 2. Vérifier permissions (coursier ou client de la livraison)
    // ... vérification permissions ...

    // 3. Générer URLs pré-signées
    let media_with_presigned: Vec<_> = media
        .into_iter()
        .map(|m| {
            let presigned_url = state.media_storage
                .generate_presigned_url(&m.media_url, 48 * 3600) // 48 heures
                .await?;
            
            Ok(serde_json::json!({
                "id": m.id,
                "media_type": m.media_type,
                "media_url": presigned_url, // URL pré-signée
                "proof_type": m.proof_type,
                "uploaded_at": m.uploaded_at,
            }))
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(json!({
        "media": media_with_presigned
    })))
}
```

### **3. Modifier Routes Chat Media**

```rust
// backend/src/routes/chat_media_routes.rs

async fn get_chat_media(
    Path(chat_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    // 1. Vérifier permissions (participant du chat)
    // ... vérification permissions ...

    // 2. Récupérer médias depuis DB
    let media = sqlx::query_as::<_, ChatMedia>(
        "SELECT * FROM chat_media WHERE chat_id = $1"
    )
    .bind(chat_id)
    .fetch_all(&state.pg)
    .await?;

    // 3. Générer URLs pré-signées
    let media_with_presigned: Vec<_> = media
        .into_iter()
        .map(|m| {
            let presigned_url = state.media_storage
                .generate_presigned_url(&m.media_url, 7 * 24 * 3600) // 7 jours
                .await?;
            
            Ok(serde_json::json!({
                "id": m.id,
                "media_type": m.media_type,
                "media_url": presigned_url, // URL pré-signée
                "uploaded_at": m.uploaded_at,
            }))
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(json!({
        "media": media_with_presigned
    })))
}
```

---

## 📈 Impact et Bénéfices

### **Sécurité** 🔒
- ✅ Contenu privé protégé
- ✅ Accès contrôlé par utilisateur
- ✅ Expiration automatique
- ✅ Traçabilité

### **Performance** ⚡
- ⚠️ Latence supplémentaire (génération backend)
- ⚠️ Cache CDN moins efficace
- ✅ Acceptable pour contenu privé (accès ponctuel)

### **Scalabilité** 📈
- ✅ Réduction charge Wasabi (pas d'accès public)
- ✅ Contrôle d'accès granulaire
- ✅ Gestion expiration automatique

---

## ✅ Conclusion

### **Zones Nécessitant URLs Pré-signées** :

1. ✅ **Preuves de Livraison** (Priorité Haute)
2. ✅ **Médias de Chat Privé** (Priorité Haute)
3. ✅ **Fichiers Partagés Temporaires** (Priorité Moyenne)
4. ✅ **Exports Utilisateur** (Priorité Basse)

### **Zones Gardant URLs Publiques (CDN)** :

1. ✅ **Images/Vidéos Produits**
2. ✅ **Médias de Services**
3. ✅ **Feed Vidéo**
4. ✅ **Avatars Utilisateurs**

### **Architecture Finale** :

```
Contenu Public → CDN → Wasabi Direct → Backend
Contenu Privé → Backend génère URL pré-signée → Wasabi
```

---

**Status** : ✅ **Identification complète - Prêt pour implémentation par phases**

