# ✅ Vérification Logo/Bannière et Vidéos

## 🎯 Questions de l'utilisateur

1. **Logo et bannière sont-ils facilement identifiables pour ProductCard et autres pages ?**
2. **Les vidéos sont-elles bien sauvegardées dans le formulaire d'ajout de produit ?**

---

## ✅ 1. Logo et Bannière - Identification facile

### Structure dans `service.data`

Après sauvegarde, le logo et la bannière sont **facilement identifiables** dans `service.data` :

```json
{
  "logo": {
    "type_donnee": "image",
    "valeur": "uploads/services/123/images/image_uuid.png",
    "origine_champs": "formulaire"
  },
  "banner": {
    "type_donnee": "image",
    "valeur": "uploads/services/123/images/image_uuid.jpg",
    "origine_champs": "formulaire"
  },
  "banniere": {  // ✅ Alias pour compatibilité
    "type_donnee": "image",
    "valeur": "uploads/services/123/images/image_uuid.jpg",
    "origine_champs": "formulaire"
  }
}
```

### Utilisation dans les composants frontend

**ProductCard, ServiceCard, ServiceMediaGallery, etc.** peuvent accéder au logo/bannière via :

```typescript
// Logo
const logoUrl = service.data?.logo?.valeur || service.data?.logo;

// Bannière
const bannerUrl = service.data?.banner?.valeur || service.data?.banniere?.valeur || service.data?.banner;
```

### Table `media` - Identification par `service_media_type`

Les médias sont aussi dans la table `media` avec `service_media_type` pour requêtes SQL :

```sql
-- Récupérer le logo
SELECT path FROM media 
WHERE service_id = $1 
  AND service_media_type = 'logo' 
LIMIT 1;

-- Récupérer la bannière
SELECT path FROM media 
WHERE service_id = $1 
  AND service_media_type = 'banniere' 
LIMIT 1;
```

### ✅ Avantages

1. **Double accès** : Via `service.data` (JSON) ET table `media` (SQL)
2. **Structure standardisée** : Format `{ type_donnee, valeur, origine_champs }`
3. **Alias supporté** : `banner` et `banniere` pour compatibilité
4. **Facilement identifiable** : Clés `logo` et `banner`/`banniere` dans `service.data`

---

## ✅ 2. Vidéos dans formulaire d'ajout de produit

### Clés supportées

Le formulaire d'ajout de produit (`AjouterProduitSimpleScreen`) sauvegarde les vidéos depuis :

1. ✅ `videos` (array)
2. ✅ `video_base64` (array) - **AJOUTÉ dans cette correction**

### Code de sauvegarde

**Fichier** : `backend/src/controllers/product_addition_controller.rs`  
**Lignes** : ~639-705

```rust
// Extraire et sauvegarder les vidéos
let mut videos_to_process: Vec<String> = Vec::new();

// Chercher dans videos (array)
if let Some(videos) = product_data.get("videos").and_then(|v| v.as_array()) {
    for video in videos {
        if let Some(video_str) = video.as_str() {
            if !video_str.is_empty() {
                videos_to_process.push(video_str.to_string());
            }
        }
    }
}

// ✅ NOUVEAU : Chercher dans video_base64 (utilisé par le frontend)
if let Some(video_base64) = product_data.get("video_base64") {
    if let Some(video_array) = video_base64.as_array() {
        for video in video_array {
            if let Some(video_str) = video.as_str() {
                if !video_str.is_empty() {
                    videos_to_process.push(video_str.to_string());
                }
            }
        }
    } else if let Some(video_str) = video_base64.as_str() {
        if !video_str.is_empty() {
            videos_to_process.push(video_str.to_string());
        }
    }
}

// Sauvegarder chaque vidéo
for (video_index, video_data) in videos_to_process.iter().enumerate() {
    // Détecter format (URL ou base64)
    let file_path = if is_url(video_data) {
        video_data.to_string()
    } else if is_probable_base64(video_data) {
        // Sauvegarder sur disque
        persist_base64_media(..., "mp4").await
    };
    
    // Insérer dans table media
    INSERT INTO media (
        service_id, product_id, product_index, type, path,
        is_main_image, display_order, uploaded_at
    )
    VALUES (service_id, product_id, product_index, 'video', file_path, ...)
}
```

### Structure dans la table `media`

| Colonne | Valeur |
|---------|--------|
| `service_id` | ID du service |
| `product_id` | `"prod_{index}"` |
| `product_index` | Index du produit (0-based) |
| `type` | `'video'` |
| `path` | Chemin fichier ou URL |
| `is_main_image` | `true` si première vidéo |
| `display_order` | Index de la vidéo |

### ✅ Résultat

Les vidéos sont **correctement sauvegardées** :
- ✅ Extraites depuis `videos` et `video_base64`
- ✅ Sauvegardées sur disque (si base64) ou URL conservée
- ✅ Insérées dans table `media` avec `product_index`
- ✅ Accessibles via `/api/media/product/{service_id}/{product_index}/videos`

---

## 📊 Récapitulatif complet

### Logo et Bannière

| Aspect | Statut |
|--------|--------|
| Sauvegarde sur disque | ✅ |
| Insertion table `media` | ✅ Avec `service_media_type = 'logo'` / `'banniere'` |
| Ajout dans `service.data` | ✅ Format `{ type_donnee: "image", valeur: "path" }` |
| Identification facile | ✅ Via `service.data.logo.valeur` et `service.data.banner.valeur` |
| Compatibilité frontend | ✅ ProductCard, ServiceCard, etc. peuvent les utiliser |

### Vidéos produits

| Aspect | Statut |
|--------|--------|
| Clés supportées | ✅ `videos` et `video_base64` |
| Sauvegarde sur disque | ✅ Si base64 |
| Insertion table `media` | ✅ Avec `product_index` |
| Identification | ✅ Via `product_index` et `product_id` |

---

## 🔍 Requêtes SQL utiles

### Récupérer logo et bannière d'un service
```sql
SELECT 
    service_id,
    MAX(CASE WHEN service_media_type = 'logo' THEN path END) as logo_path,
    MAX(CASE WHEN service_media_type = 'banniere' THEN path END) as banner_path
FROM media
WHERE service_id = $1
  AND service_media_type IN ('logo', 'banniere')
GROUP BY service_id;
```

### Récupérer toutes les vidéos d'un produit
```sql
SELECT path, display_order, is_main_image
FROM media
WHERE service_id = $1
  AND product_index = $2
  AND type = 'video'
ORDER BY display_order;
```

---

## 🎯 Conclusion

**Tous les médias sont maintenant correctement sauvegardés et facilement identifiables** :

1. ✅ **Logo/Bannière** : Accessibles via `service.data.logo.valeur` et `service.data.banner.valeur`
2. ✅ **Vidéos produits** : Sauvegardées avec `product_index` dans table `media`
3. ✅ **Identification** : Structure standardisée et requêtes SQL simples
4. ✅ **Compatibilité** : Les composants frontend existants fonctionnent sans modification

**Aucune action supplémentaire requise.**

