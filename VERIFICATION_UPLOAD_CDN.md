# ✅ Vérification route /api/upload et URLs CDN

## Date : 2025-12-31

## 1. Vérification de la route /api/upload

### ✅ Route configurée correctement

**Fichier** : `backend/src/routes/upload_routes.rs`
- Route : `/api/upload` (POST)
- Limite : 200 MB (`DefaultBodyLimit::max(200_000_000)`)
- Authentification : Requise (JWT)
- Contrôleur : `upload_controller::upload_files`

### ✅ Flux d'upload

1. **Réception** : `upload_controller::upload_files` reçoit `Multipart`
2. **Traitement** : `upload_service::handle_multipart_upload` traite chaque fichier
3. **Stockage** : `upload_service::store_uploaded_file` utilise `MediaStorageService.store_bytes()`
4. **Upload S3/Wasabi** : Si configuré, upload vers S3/Wasabi
5. **Retour** : Retourne `UploadedFileResponse` avec `url` (URL publique)

### ✅ Code vérifié

```rust
// backend/src/services/upload_service.rs ligne 81-90
let final_path = match media_storage.store_bytes(bytes, &storage_key, content_type).await {
    Ok(location) => {
        // ✅ Utilise l'URL publique S3/Wasabi
        location.public_url
    }
    Err(e) => {
        // ⚠️ Fallback local si S3 échoue
        format!("/api/media/temp/{}", ...)
    }
};
```

## 2. Vérification des URLs CDN

### ⚠️ PROBLÈME POTENTIEL : Configuration des URLs

**Fichier** : `backend/src/services/media_storage_service.rs` ligne 367-389

```rust
pub fn build_public_url(&self, storage_path: &str) -> String {
    let candidate_base = self
        .config
        .upload_base_url
        .as_deref()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            self.config
                .public_base_url
                .as_deref()
                .filter(|value| !value.is_empty())
        });

    if let Some(base) = candidate_base {
        format!(
            "{}/{}",
            base.trim_end_matches('/'),
            storage_path.trim_start_matches('/')
        )
    } else {
        // ⚠️ PROBLÈME : Si pas de base URL configurée, retourne juste le chemin relatif
        storage_path.to_string()
    }
}
```

### ✅ Variables d'environnement requises

**Fichier** : `backend/src/config/storage.rs`

Les URLs CDN sont construites à partir de :
- `UPLOAD_BASE_URL` (priorité 1)
- `PUBLIC_BASE_URL` (priorité 2)

**Format attendu** :
- Wasabi : `https://s3.wasabisys.com/bucket-name` ou `https://bucket-name.s3.wasabisys.com`
- S3 : `https://bucket-name.s3.region.amazonaws.com`
- CDN custom : `https://cdn.yukpomnang.com`

### ⚠️ Vérifications nécessaires

1. **Variables d'environnement** :
   ```bash
   # Vérifier que UPLOAD_BASE_URL ou PUBLIC_BASE_URL est configuré
   echo $UPLOAD_BASE_URL
   echo $PUBLIC_BASE_URL
   ```

2. **Format des URLs retournées** :
   - ✅ **URL CDN valide** : `https://s3.wasabisys.com/bucket-name/uploads/temp/123/file.jpg`
   - ❌ **Chemin local** : `uploads/temp/123/file.jpg` (si pas de base URL)
   - ❌ **Chemin API** : `/api/media/temp/123/file.jpg` (fallback local)

3. **Test de la route** :
   ```bash
   curl -X POST https://yukpomnang.onrender.com/api/upload \
     -H "Authorization: Bearer TOKEN" \
     -F "file=@test.jpg"
   ```

## 3. Corrections nécessaires

### ✅ Correction 1 : Vérifier que les URLs sont bien des URLs CDN

**Fichier** : `backend/src/services/media_storage_service.rs`

```rust
pub fn build_public_url(&self, storage_path: &str) -> String {
    let candidate_base = self
        .config
        .upload_base_url
        .as_deref()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            self.config
                .public_base_url
                .as_deref()
                .filter(|value| !value.is_empty())
        });

    if let Some(base) = candidate_base {
        let url = format!(
            "{}/{}",
            base.trim_end_matches('/'),
            storage_path.trim_start_matches('/')
        );
        // ✅ Vérifier que c'est bien une URL (commence par http/https)
        if url.starts_with("http://") || url.starts_with("https://") {
            return url;
        }
    }
    
    // ⚠️ Si pas de base URL ou URL invalide, utiliser le chemin API local
    format!("/api/media/temp/{}", storage_path.replace("uploads/temp/", ""))
}
```

### ✅ Correction 2 : Log pour déboguer

**Fichier** : `backend/src/services/upload_service.rs`

```rust
let final_path = match media_storage.store_bytes(bytes, &storage_key, content_type).await {
    Ok(location) => {
        info!(
            "[upload_service] ✅ Fichier uploadé vers S3: {} (URL: {})",
            location.storage_path,
            location.public_url
        );
        
        // ✅ Vérifier que l'URL est bien une URL CDN
        if !location.public_url.starts_with("http://") && !location.public_url.starts_with("https://") {
            warn!(
                "[upload_service] ⚠️ URL retournée n'est pas une URL CDN: {}",
                location.public_url
            );
        }
        
        location.public_url
    }
    // ...
};
```

## 4. Actions à prendre

- [ ] Vérifier que `UPLOAD_BASE_URL` ou `PUBLIC_BASE_URL` est configuré dans les variables d'environnement
- [ ] Tester la route `/api/upload` et vérifier le format des URLs retournées
- [ ] Vérifier que les URLs commencent par `http://` ou `https://` (pas des chemins relatifs)
- [ ] Ajouter des logs pour déboguer si les URLs ne sont pas des URLs CDN

## 5. Test recommandé

```bash
# 1. Tester l'upload
curl -X POST https://yukpomnang.onrender.com/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"

# 2. Vérifier la réponse
# La réponse devrait contenir :
# {
#   "success": true,
#   "files": [
#     {
#       "url": "https://s3.wasabisys.com/bucket-name/uploads/temp/123/file.jpg",  # ✅ URL CDN
#       "media_type": "image",
#       "size_bytes": 12345
#     }
#   ]
# }

# 3. Vérifier que l'URL est accessible
curl -I "https://s3.wasabisys.com/bucket-name/uploads/temp/123/file.jpg"
```

