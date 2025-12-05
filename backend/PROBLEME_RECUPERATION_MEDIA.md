# ⚠️ PROBLÈME IDENTIFIÉ : Récupération Médias ne Transforme pas `path` en URL S3/Wasabi

## 🚨 Problème Principal

**Les fonctions de récupération de médias retournent le `path` relatif depuis la table `media` SANS le transformer en URL publique S3/Wasabi.**

### **1. `get_service_media` (ProductCard, Recherche)**

**Fichier** : `backend/src/controllers/media_controller.rs`

**Code Actuel** :
```rust
pub async fn get_service_media(...) -> AppResult<Json<Vec<MediaItem>>> {
    let rows = sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, media.type, path, uploaded_at FROM media WHERE service_id = $1"#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(Json(rows)) // ❌ Retourne directement le path relatif
}
```

**Problème** :
- Retourne `path = "uploads/services/123/file.jpg"` (relatif)
- **NON** transformé en URL S3/Wasabi : `"https://s3.amazonaws.com/bucket/uploads/services/123/file.jpg"`
- Frontend reçoit un chemin relatif, pas une URL complète

### **2. `get_product_media` (ProductCard, Montage Vidéo)**

**Fichier** : `backend/src/controllers/media_product_controller.rs`

**Code Actuel** :
```rust
let full_url = if path.starts_with("http://") || path.starts_with("https://") {
    path
} else {
    // ❌ Construit URL via serveur local, pas S3/Wasabi direct
    format!("{}/api/media/files/{}", api_base_url, clean_path)
};
```

**Problème** :
- Construit URL via `/api/media/files/` (proxy serveur local)
- **NON** URL S3/Wasabi directe
- Passe par le serveur au lieu d'utiliser le CDN S3/Wasabi

### **3. `serve_media_file` (Route `/api/media/files/{*file_path}`)**

**Fichier** : `backend/src/controllers/media_controller.rs`

**Code Actuel** :
```rust
pub async fn serve_media_file(...) {
    let absolute_path = absolute_media_path(&file_path); // ❌ Chemin local
    let mut file = File::open(&full_path).await?; // ❌ Lit depuis disque local
    // ...
}
```

**Problème** :
- Lit depuis le disque local (`UPLOAD_STORAGE_PATH`)
- **NON** depuis S3/Wasabi
- Si fichier stocké dans S3/Wasabi, cette route ne peut pas le servir

### **4. Recherche Produits (Video ML, Hashtags)**

**Fichier** : `backend/src/controllers/video_ml_controller.rs`

**Code Actuel** :
```rust
(SELECT path FROM media m2 WHERE m2.service_id = m.service_id AND m2.type = 'image' LIMIT 1) as thumbnail
```

**Problème** :
- Retourne directement le `path` relatif
- **NON** transformé en URL S3/Wasabi

## ✅ Solution : Transformer `path` en URL S3/Wasabi

### **Correction 1 : `get_service_media`**

```rust
pub async fn get_service_media(...) -> AppResult<Json<Vec<MediaItem>>> {
    let rows = sqlx::query_as::<_, MediaItem>(
        r#"SELECT id, service_id, media.type, path, uploaded_at FROM media WHERE service_id = $1"#
    )
    .fetch_all(pool)
    .await?;
    
    // ✅ CORRIGÉ: Transformer path en URL publique S3/Wasabi
    let media_items: Vec<MediaItem> = rows
        .into_iter()
        .map(|mut item| {
            // Si path n'est pas déjà une URL complète, construire URL S3/Wasabi
            if !item.path.starts_with("http://") && !item.path.starts_with("https://") {
                item.path = state.media_storage.build_public_url(&item.path);
            }
            item
        })
        .collect();
    
    Ok(Json(media_items))
}
```

### **Correction 2 : `get_product_media`**

```rust
let full_url = if path.starts_with("http://") || path.starts_with("https://") {
    path
} else {
    // ✅ CORRIGÉ: Utiliser MediaStorageService pour construire URL S3/Wasabi
    state.media_storage.build_public_url(&path)
};
```

### **Correction 3 : `serve_media_file`**

```rust
pub async fn serve_media_file(...) {
    // ✅ CORRIGÉ: Vérifier si fichier est dans S3/Wasabi
    if state.media_storage.is_remote() {
        // Rediriger vers URL S3/Wasabi directe
        let public_url = state.media_storage.build_public_url(&file_path);
        return Ok(Redirect::permanent(&public_url));
    }
    
    // Fallback vers stockage local si S3 non configuré
    let absolute_path = absolute_media_path(&file_path);
    // ...
}
```

### **Correction 4 : Recherche Produits**

```rust
// ✅ CORRIGÉ: Transformer path en URL S3/Wasabi dans les requêtes
let thumbnail_path: Option<String> = row.get("thumbnail");
let thumbnail_url = thumbnail_path
    .map(|p| {
        if p.starts_with("http://") || p.starts_with("https://") {
            p
        } else {
            state.media_storage.build_public_url(&p)
        }
    });
```

## 📊 Impact

### **Contextes Affectés**

1. ✅ **ProductCard** : `get_service_media` → Path relatif au lieu d'URL S3/Wasabi
2. ✅ **Recherche Produits** : Thumbnails → Path relatif
3. ✅ **Montage Vidéo** : `get_product_media` → URL proxy au lieu de S3/Wasabi direct
4. ✅ **Chats** : Dépend de l'implémentation (à vérifier)
5. ✅ **Commentaires** : ✅ OK (utilise `location.public_url` directement)

### **Conséquences**

- ❌ **Performance** : Pas d'utilisation du CDN S3/Wasabi
- ❌ **Scalabilité** : Charge sur serveur au lieu de S3/Wasabi
- ❌ **Coûts** : Bandwidth serveur au lieu de S3/Wasabi
- ❌ **Fiabilité** : Dépend du serveur au lieu de S3/Wasabi

## ✅ Actions Requises

1. ✅ Modifier `get_service_media` pour transformer `path` en URL S3/Wasabi
2. ✅ Modifier `get_product_media` pour utiliser `build_public_url`
3. ✅ Modifier `serve_media_file` pour rediriger vers S3/Wasabi ou servir depuis S3
4. ✅ Modifier recherches produits pour transformer thumbnails en URLs
5. ✅ Vérifier chats et autres contextes

