# Vérification : Gestion S3/CDN pour les médias produits

## ✅ Confirmation : Table `media` utilisée

### Structure de la table `media`
```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    product_index INTEGER,  -- ✅ Index du produit (0-based)
    type TEXT NOT NULL,      -- Type de base
    media_type TEXT,         -- Type détaillé ('image', 'video', 'audio')
    path TEXT NOT NULL,      -- ✅ Chemin ou URL S3/CDN
    ...
)
```

### Requête SQL utilisée pour récupérer les médias produits
```sql
SELECT id, path, type, ai_description, product_index, media_type
FROM media
WHERE service_id = $1
AND product_index = $2  -- ✅ Exact match pour le produit spécifique
AND (media_type IN ('image', 'video') OR (media_type IS NULL AND type IN ('image', 'video')))
ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
LIMIT 16
```

**✅ Confirmation** : La table `media` est bien utilisée avec le bon `product_index`.

## ✅ Confirmation : Gestion S3/CDN

### 1. Sauvegarde des médias avec S3/CDN

Quand un média est sauvegardé via `persist_base64_media` :
```rust
// Si S3/CDN activé
if media_storage.is_remote() {
    match media_storage.store_bytes(&decoded, &storage_key, content_type).await {
        Ok(location) => {
            location.storage_path  // ✅ URL CDN S3 (ex: "https://cdn.example.com/uploads/...")
        }
    }
}
```

**Le `path` dans la table `media` est l'URL CDN S3 complète** (ex: `https://cdn.yukpo.com/uploads/services/123/images/image.jpg`)

### 2. Récupération des médias depuis la DB

La requête SQL récupère le `path` qui peut être :
- ✅ **URL S3/CDN complète** : `https://cdn.yukpo.com/uploads/...`
- ✅ **Chemin local relatif** : `uploads/services/123/images/image.jpg`
- ✅ **Chemin local absolu** : `/var/www/uploads/services/123/images/image.jpg`

### 3. Détection et traitement dans `row_to_media_source`

```rust
fn row_to_media_source(id: i32, path: &str, ai_description: Option<String>) -> Option<MediaSource> {
    // ✅ CORRIGÉ: Détecter les URLs S3/CDN dès le départ
    if path.starts_with("http://") || path.starts_with("https://") {
        // URL S3/CDN détectée → créer MediaSource directement avec l'URL
        return Some(MediaSource {
            id: Some(id),
            path: PathBuf::from(path), // Garder l'URL originale
            ai_description,
        });
    }
    
    // Sinon, traiter comme chemin local...
}
```

**✅ Les URLs S3/CDN sont détectées et conservées telles quelles.**

### 4. Conversion en URL pour les scènes dans `media_source_to_url`

```rust
fn media_source_to_url(media_source: &MediaSource) -> Option<String> {
    let path_str = media_source.path.to_string_lossy();
    
    // ✅ CAS 1: URL S3/CDN déjà complète → retourner telle quelle
    if path_str.starts_with("http://") || path_str.starts_with("https://") {
        return Some(path_str.to_string());  // ✅ URL S3/CDN directement utilisable
    }
    
    // ✅ CAS 2: Chemin local → convertir en URL API
    // {API_BASE_URL}/api/media/files/{path_relatif}
}
```

**✅ Les URLs S3/CDN sont retournées directement, sans conversion supplémentaire.**

## 🔍 Flux complet pour médias S3/CDN

### Étape 1 : Sauvegarde du média
```
Base64 → MediaStorageService.store_bytes() 
     → Upload S3 
     → location.storage_path = "https://cdn.yukpo.com/uploads/services/123/images/image.jpg"
     → INSERT INTO media (path = "https://cdn.yukpo.com/uploads/...")
```

### Étape 2 : Récupération depuis la DB
```sql
SELECT path FROM media WHERE service_id = 123 AND product_index = 0
-- Retourne: "https://cdn.yukpo.com/uploads/services/123/images/image.jpg"
```

### Étape 3 : Création du MediaSource
```rust
row_to_media_source(id, "https://cdn.yukpo.com/uploads/...", ...)
// Détecte URL S3/CDN → crée MediaSource avec PathBuf contenant l'URL
```

### Étape 4 : Conversion en URL pour scènes
```rust
media_source_to_url(media_source)
// Détecte URL S3/CDN → retourne "https://cdn.yukpo.com/uploads/..." directement
```

### Étape 5 : Assignation aux scènes
```rust
scene.assets.product_image_url = Some("https://cdn.yukpo.com/uploads/...")
// ✅ URL S3/CDN directement utilisable par le renderer
```

## ✅ Vérifications effectuées

### 1. Table `media` utilisée
- ✅ Requête SQL utilise `FROM media`
- ✅ Filtre sur `service_id` et `product_index` correct
- ✅ Colonnes `product_index` et `media_type` récupérées pour logging

### 2. Gestion S3/CDN
- ✅ `row_to_media_source` détecte les URLs S3/CDN (`http://`, `https://`)
- ✅ `media_source_to_url` retourne les URLs S3/CDN telles quelles
- ✅ Les URLs S3/CDN sont directement assignées aux scènes
- ✅ Pas de conversion inutile pour les URLs déjà complètes

### 3. Fallback pour chemins locaux
- ✅ Si le `path` est un chemin local, conversion en URL API
- ✅ Format : `{API_BASE_URL}/api/media/files/{path_relatif}`
- ✅ Gestion des chemins relatifs et absolus

## 📊 Logs de diagnostic

Les logs suivants permettent de vérifier le traitement S3/CDN :

1. **Détection URL S3/CDN dans `row_to_media_source`** :
   ```
   [VideoGeneration] ✅ Média S3/CDN détecté: media_id=X, url=https://cdn.yukpo.com/...
   ```

2. **Conversion URL dans `media_source_to_url`** :
   ```
   [media_source_to_url] ✅ Média S3/CDN (URL complète): media_id=X, url=https://cdn.yukpo.com/...
   ```

3. **Assignation aux scènes** :
   ```
   [ImmersiveOrchestrator] ✅ Média image assigné à scène X: media_id=Y, url=https://cdn.yukpo.com/...
   ```

## ✅ Résultat final

**Les médias produits sont :**
1. ✅ **Récupérés depuis la table `media`** avec le bon `product_index`
2. ✅ **Détectés comme URLs S3/CDN** si le `path` commence par `http://` ou `https://`
3. ✅ **Utilisés directement** sans conversion supplémentaire
4. ✅ **Assignés aux scènes** avec leur URL S3/CDN complète

**Le système gère correctement :**
- ✅ Médias stockés sur S3/CDN (URLs complètes dans la DB)
- ✅ Médias stockés localement (chemins convertis en URLs API)
- ✅ Mélange des deux types de stockage

## 🎯 Vérification en production

Pour vérifier que les médias S3/CDN sont bien récupérés :

1. **Vérifier en base de données** :
   ```sql
   SELECT id, path, product_index, media_type 
   FROM media 
   WHERE service_id = X AND product_index = Y;
   ```
   - Si `path` commence par `http://` ou `https://` → S3/CDN ✅
   - Si `path` est un chemin relatif → Stockage local

2. **Vérifier les logs du backend** :
   - Chercher `[VideoGeneration] ✅ Média S3/CDN détecté`
   - Chercher `[media_source_to_url] ✅ Média S3/CDN (URL complète)`
   - Vérifier que les URLs sont bien assignées aux scènes

3. **Vérifier les scènes générées** :
   - Les `assets.video_url`, `assets.background_url`, `assets.product_image_url` doivent contenir des URLs complètes
   - Si ce sont des URLs S3/CDN, elles doivent commencer par `http://` ou `https://`

