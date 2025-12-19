# Vérification du système CDN-S3 de sauvegarde des médias

## 🔍 Problèmes identifiés

### ❌ 1. Images de produits non uploadées vers S3 lors de la création de service

**Fichier:** `backend/src/services/creer_service.rs`

**Fonction:** `persist_base64_media()` (lignes 324-417)

**Problème:** Cette fonction sauvegarde uniquement sur le disque local, mais n'utilise **PAS** `MediaStorageService` pour uploader vers S3/Wasabi.

```rust
// ❌ ACTUEL: Sauvegarde uniquement locale
fs::write(&disk_path, &decoded).await?;
let relative_path = Path::new("uploads").join(...);
// Pas d'appel à media_storage.store_bytes() ou store_file()
```

**Impact:** Les images de produits créées via `/api/services/create` ne sont jamais uploadées vers S3/Wasabi.

---

### ❌ 2. OptimizedMediaProcessor n'upload pas vers S3

**Fichier:** `backend/src/services/optimized_media_processor.rs`

**Fonction:** `save_media_to_disk()` (lignes 393-453)

**Problème:** Cette fonction sauvegarde uniquement sur le disque local, sans utiliser `MediaStorageService`.

```rust
// ❌ ACTUEL: Sauvegarde uniquement locale
tokio::fs::write(&disk_path, decoded).await?;
let relative_path = Path::new("uploads").join(...);
// Pas d'appel à media_storage.store_bytes() ou store_file()
```

**Impact:** Les images traitées en batch via `OptimizedMediaProcessor` ne sont jamais uploadées vers S3/Wasabi.

---

### ✅ 3. Upload média standard fonctionne (correct)

**Fichier:** `backend/src/controllers/media_controller.rs`

**Fonction:** `upload_media()` (lignes 83-223)

**Statut:** ✅ **CORRECT** - Utilise bien `MediaStorageService.store_bytes()` pour uploader vers S3/Wasabi.

```rust
// ✅ CORRECT: Utilise MediaStorageService
let storage_key = format!("services/{}/{}", service_id, unique_name);
let relative_path = match state
    .media_storage
    .store_bytes(&bytes, &storage_key, Some(content_type))
    .await
{
    Ok(location) => location.storage_path.clone(),
    // ...
}
```

---

### ✅ 4. Lecture des médias depuis CDN fonctionne (correct)

**Fichier:** `backend/src/controllers/media_controller.rs`

**Fonction:** `get_service_media()` (lignes 226-335)

**Statut:** ✅ **CORRECT** - Utilise bien `build_public_url()` pour générer les URLs CDN/S3.

```rust
// ✅ CORRECT: Génère URLs publiques S3/Wasabi
if state.media_storage.is_remote() {
    item.path = state.media_storage.build_public_url(&item.path);
}
```

**Note:** Cela fonctionne seulement si les fichiers sont déjà dans S3. Pour les fichiers sauvegardés uniquement localement (problèmes 1 et 2), les URLs générées pointent vers S3 mais les fichiers n'y sont pas.

---

### ❌ 5. creer_service n'a pas accès à MediaStorageService

**Fichier:** `backend/src/services/creer_service.rs`

**Fonction:** `creer_service()` (ligne 1538)

**Problème:** La signature de la fonction n'accepte pas `media_storage` comme paramètre.

```rust
// ❌ ACTUEL: Pas de media_storage
pub async fn creer_service(
    pool: &PgPool,
    user_id: i32,
    data: &serde_json::Value,
    _redis_client: &redis::Client,
    _scalability_service: Option<...>,
) -> Result<(serde_json::Value, u32), AppError>
```

**Impact:** Impossible d'utiliser `MediaStorageService` dans `persist_base64_media` et autres fonctions internes.

---

## 📋 Corrections nécessaires

### 1. Modifier la signature de `creer_service` pour accepter `media_storage`

```rust
pub async fn creer_service(
    pool: &PgPool,
    user_id: i32,
    data: &serde_json::Value,
    media_storage: Arc<MediaStorageService>, // ✅ AJOUTER
    _redis_client: &redis::Client,
    _scalability_service: Option<...>,
) -> Result<(serde_json::Value, u32), AppError>
```

### 2. Modifier `persist_base64_media` pour uploader vers S3

```rust
async fn persist_base64_media(
    storage_root: &Path,
    service_id: i32,
    subdir: &str,
    base64_data: &str,
    default_ext: &str,
    media_storage: Arc<MediaStorageService>, // ✅ AJOUTER
) -> AppResult<StoredMedia> {
    // ... décoder base64 ...
    
    // ✅ AJOUTER: Upload vers S3 via MediaStorageService
    let storage_key = format!("services/{}/{}", service_id, unique_name);
    match media_storage.store_bytes(&decoded, &storage_key, Some(content_type)).await {
        Ok(location) => {
            // ✅ Utiliser storage_path au lieu du chemin local
            Ok(StoredMedia {
                path: location.storage_path, // "uploads/services/123/image.jpg"
                bytes,
            })
        }
        Err(e) => {
            // ✅ Fallback vers stockage local si S3 échoue
            log::warn!("[persist_base64_media] Erreur upload S3: {}, fallback local", e);
            fs::write(&disk_path, &decoded).await?;
            Ok(StoredMedia {
                path: relative_path,
                bytes,
            })
        }
    }
}
```

### 3. Modifier `OptimizedMediaProcessor` pour accepter et utiliser `MediaStorageService`

```rust
pub struct OptimizedMediaProcessor {
    config: OptimizedMediaProcessorConfig,
    pool: Arc<PgPool>,
    storage_root: PathBuf,
    media_storage: Arc<MediaStorageService>, // ✅ AJOUTER
    // ...
}

impl OptimizedMediaProcessor {
    pub fn new(
        pool: impl Into<Arc<PgPool>>,
        storage_root: impl AsRef<Path>,
        media_storage: Arc<MediaStorageService>, // ✅ AJOUTER
        config: OptimizedMediaProcessorConfig,
    ) -> Self {
        // ...
    }
    
    async fn save_media_to_disk(
        &self,
        service_id: i32,
        media_type: &str,
        data: &str,
    ) -> AppResult<String> {
        // ... décoder data ...
        
        // ✅ AJOUTER: Upload vers S3
        let storage_key = format!("services/{}/{}/{}", service_id, subdir, file_name);
        match self.media_storage.store_bytes(&decoded, &storage_key, Some(content_type)).await {
            Ok(location) => Ok(location.storage_path),
            Err(e) => {
                // Fallback local
                tokio::fs::write(&disk_path, decoded).await?;
                Ok(relative_path)
            }
        }
    }
}
```

### 4. Mettre à jour les appels à `creer_service`

Dans `backend/src/controllers/service_controller.rs`:

```rust
match crate::services::creer_service::creer_service(
    &state.pg,
    payload.user_id,
    &payload.data,
    state.media_storage.clone(), // ✅ AJOUTER
    &state.redis_client,
    None,
)
.await
```

Dans `backend/src/routers/router_yukpo.rs`:

```rust
let response_result = crate::controllers::service_controller::creer_service(
    State(state.clone()), // state contient media_storage
    // ...
)
```

### 5. Mettre à jour les appels à `OptimizedMediaProcessor`

Dans `backend/src/services/creer_service.rs`:

```rust
let processor = OptimizedMediaProcessor::new(
    pool.clone(),
    storage_root.clone(),
    media_storage.clone(), // ✅ AJOUTER (doit être passé à creer_service)
    config,
);
```

---

## ✅ Points positifs (déjà corrects)

1. ✅ **`upload_media()` dans `media_controller.rs`** : Utilise correctement `MediaStorageService.store_bytes()`
2. ✅ **`get_service_media()` dans `media_controller.rs`** : Utilise correctement `build_public_url()` pour générer URLs CDN
3. ✅ **`MediaStorageService`** : Implémentation correcte avec support S3/Wasabi
4. ✅ **Mobile `mediaService.ts`** : Utilise correctement `cdnService` pour la lecture des médias

---

## 🎯 Résumé

- **Upload standard via `/api/prestataire/upload/{service_id}`** : ✅ Fonctionne avec S3
- **Création de service avec images de produits** : ❌ **Ne fonctionne PAS** avec S3 (sauvegarde locale uniquement)
- **Lecture des médias depuis CDN** : ✅ Fonctionne (si fichiers dans S3)
- **Recherche de produits avec images** : ❌ **Problématique** (images non dans S3, URLs incorrectes)

**Action requise:** Appliquer les corrections ci-dessus pour que tous les médias soient uploadés vers S3/Wasabi via `MediaStorageService`.

