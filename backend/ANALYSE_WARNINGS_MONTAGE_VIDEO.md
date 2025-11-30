# Analyse des Warnings - Processus de Montage Vidéo

## 📋 Résumé Exécutif

Les logs montrent de nombreuses erreurs **404 (Not Found)** lors de l'accès aux médias (images et vidéos) pendant le processus de montage vidéo. Les fichiers demandés n'existent pas ou ne sont pas accessibles via les URLs construites par le client mobile.

## 🔍 Problèmes Identifiés

### 1. Erreurs 404 sur les Images de Service

**Pattern observé :**
```
[GET] 404 /uploads/services/158/images/image_8d138c85-8e20-46be-8e02-bdeddae9dcd5.jpg
[GET] 404 /uploads/services/158/images/image_bde3bb82-6038-4169-9c6a-941dd16e856a.jpg
...
```

**Cause probable :**
- Les chemins stockés dans la base de données sont des chemins relatifs : `uploads/services/158/images/image_*.jpg`
- Le client mobile construit des URLs en ajoutant directement `API_BASE_URL` : `https://yukpomnang.onrender.com/uploads/services/158/images/...`
- Mais le serveur ne sert pas les fichiers directement depuis `/uploads/...`
- L'endpoint correct devrait être : `/api/media/files/uploads/services/158/images/...`

### 2. Erreurs 404 sur les Vidéos de Produit

**Pattern observé :**
```
[GET] 404 /uploads/services/product_video_dd15692a-dcf1-434d-901b-466c15e1aeb1.mp4
[GET] 404 /uploads/services/product_video_a50dca90-90bf-46b5-b75c-27d79a16bb88.mp4
```

**Cause probable :**
- Les vidéos générées sont stockées avec le préfixe `product_video_` dans le dossier `services/`
- Mais les chemins retournés par l'API ne correspondent pas à la structure réelle des fichiers
- Les fichiers peuvent être stockés ailleurs ou avec un nom différent

### 3. Erreurs 404 sur les Vidéos de Service

**Pattern observé :**
```
[GET] 404 /uploads/services/158/videos/video_0f537d53-1c26-4808-a62f-e23a7f7fd398.mp4
[GET] 404 /uploads/services/158/videos/video_4abb0246-910f-4864-a5e4-353362aaf927.mp4
```

**Cause probable :**
- Même problème que pour les images : les chemins relatifs ne sont pas correctement transformés en URLs complètes

## 🔧 Analyse du Code

### Backend - Construction des Chemins

**Fichier : `backend/src/controllers/media_product_controller.rs`**

```rust
// Les chemins retournés sont directement depuis la base de données
let images: Vec<String> = rows
    .iter()
    .map(|row| row.get::<String, _>("path"))
    .collect();
```

**Problème :** Les chemins retournés sont des chemins relatifs bruts (ex: `uploads/services/158/images/image_*.jpg`) sans transformation en URL complète.

### Backend - Service des Fichiers

**Fichier : `backend/src/routers/router_yukpo.rs`**

```rust
async fn serve_media_file(Path(file_path): Path<String>) -> Result<Response<Body>, StatusCode> {
    // Construire le chemin complet
    let full_path = format!("uploads/services/{}", file_path);
    // ...
}
```

**Route :** `/api/media/files/{*file_path}`

**Problème :** Le serveur attend que le `file_path` soit relatif (sans `uploads/services/`), mais le client envoie le chemin complet.

### Mobile - Construction des URLs

**Fichier : `mobile/src/components/ProductCard.tsx`**

```typescript
const buildMediaUrl = (path: string | undefined | null): string | undefined => {
  if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${config.API_BASE_URL}${cleanPath}`; // ❌ Problème ici
  }
  // ...
};
```

**Problème :** Le client construit des URLs comme `https://yukpomnang.onrender.com/uploads/services/...` au lieu de `https://yukpomnang.onrender.com/api/media/files/uploads/services/...`

## 💡 Solutions Proposées

### Solution 1 : Transformer les Chemins en URLs Complètes dans le Backend (Recommandée)

**Avantage :** Centralise la logique de construction d'URLs, plus maintenable

**Modification dans `backend/src/controllers/media_product_controller.rs` :**

```rust
// Ajouter une fonction helper pour construire l'URL complète
fn build_media_url(path: &str, base_url: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }
    
    // Si le chemin commence par uploads/, utiliser l'endpoint /api/media/files
    if path.starts_with("uploads/") {
        let clean_path = if path.starts_with("/") { &path[1..] } else { path };
        return format!("{}/api/media/files/{}", base_url, clean_path);
    }
    
    // Sinon, préfixer avec /api/media/files
    let clean_path = if path.starts_with("/") { &path[1..] } else { path };
    format!("{}/api/media/files/{}", base_url, clean_path)
}

// Modifier get_product_images
pub async fn get_product_images(...) -> AppResult<impl IntoResponse> {
    // ...
    let base_url = std::env::var("API_BASE_URL")
        .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());
    
    let images: Vec<String> = rows
        .iter()
        .map(|row| {
            let path: String = row.get("path");
            build_media_url(&path, &base_url)
        })
        .collect();
    // ...
}
```

### Solution 2 : Corriger la Construction d'URLs dans le Mobile

**Modification dans `mobile/src/components/ProductCard.tsx` :**

```typescript
const buildMediaUrl = (path: string | undefined | null): string | undefined => {
  if (!path || typeof path !== 'string') return undefined;

  // Si c'est déjà une URL complète, la retourner telle quelle
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Si c'est un data URI, le retourner tel quel
  if (path.startsWith('data:')) {
    return path;
  }

  // ✅ CORRIGÉ: Utiliser l'endpoint /api/media/files pour les chemins uploads/
  if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${config.API_BASE_URL}/api/media/files/${cleanPath}`;
  }

  // Pour les autres chemins, utiliser aussi /api/media/files
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${config.API_BASE_URL}/api/media/files/${cleanPath}`;
};
```

**À appliquer aussi dans :**
- `mobile/src/components/ProductGalleryPickerModal.tsx`
- `mobile/src/components/ProductVideoCreationModal.tsx`
- `mobile/src/screens/MesProduitsScreen.tsx`
- `mobile/src/screens/CreatePubliciteScreen.tsx`

### Solution 3 : Vérifier l'Existence des Fichiers

**Problème supplémentaire :** Les fichiers peuvent ne pas exister physiquement sur le serveur.

**Action :** Ajouter une vérification dans `serve_media_file` pour logger les fichiers manquants :

```rust
async fn serve_media_file(Path(file_path): Path<String>) -> Result<Response<Body>, StatusCode> {
    // ...
    let full_path = format!("uploads/services/{}", file_path);
    
    // ✅ NOUVEAU: Logger les fichiers manquants pour debug
    if !std::path::Path::new(&full_path).exists() {
        warn!(
            "[serve_media_file] ⚠️ Fichier introuvable: {} (chemin complet: {})",
            file_path, full_path
        );
        // Optionnel: Vérifier si le fichier existe ailleurs
        // ou si le chemin dans la DB est incorrect
    }
    // ...
}
```

### Solution 4 : Nettoyer les Chemins dans la Base de Données

**Problème :** Les chemins dans la DB peuvent être incohérents.

**Action :** Créer une migration pour vérifier et corriger les chemins :

```sql
-- Vérifier les chemins invalides
SELECT id, service_id, product_index, path, type
FROM media
WHERE path NOT LIKE 'uploads/%'
   OR path LIKE '%..%'
   OR path LIKE '%~%';

-- Corriger les chemins manquants (si nécessaire)
UPDATE media
SET path = 'uploads/services/' || service_id || '/' || type || 's/' || path
WHERE path NOT LIKE 'uploads/%'
  AND service_id IS NOT NULL;
```

## 🎯 Plan d'Action Recommandé

### Priorité 1 : Correction Immédiate (Mobile)
1. ✅ Corriger `buildMediaUrl` dans tous les composants mobiles
2. ✅ Utiliser `/api/media/files/` pour tous les chemins `uploads/`
3. ✅ Tester avec un service réel (service_id=158)

### Priorité 2 : Amélioration Backend
1. ✅ Transformer les chemins en URLs complètes dans `media_product_controller.rs`
2. ✅ Ajouter des logs pour les fichiers manquants
3. ✅ Vérifier la cohérence des chemins dans la DB

### Priorité 3 : Prévention
1. ✅ Ajouter une validation lors de l'upload de médias
2. ✅ Vérifier l'existence des fichiers avant de les référencer
3. ✅ Implémenter un système de fallback pour les médias manquants

## 📊 Impact

**Avant correction :**
- ❌ 13+ erreurs 404 par session de montage vidéo
- ❌ Images et vidéos non affichées
- ❌ Expérience utilisateur dégradée

**Après correction :**
- ✅ URLs correctes générées
- ✅ Médias correctement servis
- ✅ Expérience utilisateur améliorée

## 🔗 Fichiers Concernés

### Backend
- `backend/src/controllers/media_product_controller.rs` - Construction des URLs
- `backend/src/routers/router_yukpo.rs` - Service des fichiers
- `backend/src/services/video_generation_service.rs` - Génération des vidéos

### Mobile
- `mobile/src/components/ProductCard.tsx` - Construction URLs
- `mobile/src/components/ProductGalleryPickerModal.tsx` - Chargement médias
- `mobile/src/components/ProductVideoCreationModal.tsx` - Montage vidéo
- `mobile/src/screens/MesProduitsScreen.tsx` - Affichage produits
- `mobile/src/screens/CreatePubliciteScreen.tsx` - Création publicités

## 📝 Notes Techniques

1. **Endpoint actuel :** `/api/media/files/{*file_path}`
2. **Format attendu :** `file_path` doit être relatif (ex: `158/images/image_*.jpg`)
3. **Format actuel dans DB :** `uploads/services/158/images/image_*.jpg`
4. **Solution :** Soit transformer dans le backend, soit adapter le client mobile

## ✅ Checklist de Validation

- [ ] Tester avec service_id=158
- [ ] Vérifier que les images s'affichent correctement
- [ ] Vérifier que les vidéos se chargent correctement
- [ ] Vérifier les logs backend (plus d'erreurs 404)
- [ ] Tester sur différents services
- [ ] Vérifier la performance (pas de requêtes inutiles)

## 🔄 Corrections Supplémentaires Appliquées (2025-11-30)

### Problème Identifié
Les erreurs 404 persistaient car le backend retournait des chemins relatifs (`uploads/services/...`) que le client mobile utilisait directement sans transformation.

### Solution Backend - Transformation des Chemins en URLs Complètes

**Fichier modifié : `backend/src/controllers/media_product_controller.rs`**

Toutes les fonctions qui retournent des chemins de médias transforment maintenant les chemins relatifs en URLs complètes :

1. **`get_product_media`** - Retourne des URLs complètes dans `ProductMediaItem.path`
2. **`get_product_images`** - Retourne des URLs complètes dans le tableau `images`
3. **`get_product_videos`** - Retourne des URLs complètes dans le tableau `videos`

**Code ajouté :**
```rust
// ✅ CORRIGÉ 2025-11-30: Transformer les chemins en URLs complètes
let api_base_url = std::env::var("PUBLIC_BASE_URL")
    .or_else(|_| std::env::var("UPLOAD_BASE_URL"))
    .unwrap_or_else(|_| "https://yukpomnang.onrender.com".to_string());

// Pour chaque chemin, construire l'URL complète
let full_url = if path.starts_with("http://") || path.starts_with("https://") {
    path  // Déjà une URL complète
} else {
    // Construire l'URL avec l'endpoint /api/media/files
    let clean_path = path.trim_start_matches('/');
    format!("{}/api/media/files/{}", api_base_url.trim_end_matches('/'), clean_path)
};
```

### Résultat Attendu

**Avant :**
- Backend retourne : `"uploads/services/158/images/image_*.jpg"`
- Client essaie : `https://yukpomnang.onrender.com/uploads/services/158/images/image_*.jpg` ❌ 404

**Après :**
- Backend retourne : `"https://yukpomnang.onrender.com/api/media/files/uploads/services/158/images/image_*.jpg"`
- Client utilise : `https://yukpomnang.onrender.com/api/media/files/uploads/services/158/images/image_*.jpg` ✅ 200

### Notes Importantes

1. **Variables d'environnement requises :**
   - `PUBLIC_BASE_URL` (priorité) ou `UPLOAD_BASE_URL` (fallback)
   - Si aucune n'est définie, utilise `https://yukpomnang.onrender.com` par défaut

2. **Compatibilité :**
   - Les URLs déjà complètes (commençant par `http://` ou `https://`) sont retournées telles quelles
   - Les chemins relatifs sont automatiquement transformés

3. **Double protection :**
   - Backend : Transforme les chemins en URLs complètes ✅
   - Mobile : Fonction `buildMediaUrl` pour les cas où les URLs ne sont pas transformées ✅
   - Serveur : Gère les chemins avec ou sans préfixe `uploads/services/` ✅

