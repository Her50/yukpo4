# 🔍 DIAGNOSTIC COMPLET - Médias Produits CDN dans ProductCard

## 🎯 Problème identifié

Les images et vidéos des produits ne s'affichent pas dans `ProductCard` sur `ResultatBesoinScreen`, alors que le système CDN est utilisé.

## 📊 Flux de données complet

### 1. Backend - Enrichissement des médias

#### ✅ CORRIGÉ: Endpoint `/api/services/{service_id}/products`
**Fichier**: `backend/src/controllers/products_controller.rs`

**Avant** : L'endpoint retournait directement les produits depuis `service_products` SANS enrichir `product_data` avec les médias depuis la table `media`.

**Après** : L'endpoint :
1. Charge tous les médias depuis la table `media` pour le service
2. Groupe les médias par `product_index` (None = médias globaux du service)
3. Transforme les chemins en URLs CDN avec `build_public_url()`
4. Enrichit `product_data.images` et `product_data.videos` avec les URLs CDN

**Code clé** :
```rust
// Charger les médias depuis la table media
let media_rows = sqlx::query(
    "SELECT product_index, type, path FROM media WHERE service_id = $1 AND type IN ('image', 'video')"
)
.fetch_all(&state.pg)
.await?;

// Transformer en URLs CDN
let media_url = if !path.starts_with("http://") && !path.starts_with("https://") {
    storage.build_public_url(&path)
} else {
    path
};

// Enrichir product_data
obj.insert("images".to_string(), json!(merged_images));
obj.insert("videos".to_string(), json!(merged_videos));
```

#### ✅ Déjà corrigé: Recherche directe (`rechercher_besoin.rs`)
**Fichier**: `backend/src/services/rechercher_besoin.rs`

La recherche directe enrichit déjà les produits avec les médias depuis la table `media` (lignes 1263-1347).

### 2. Mobile - Extraction des médias

#### ResultatBesoinScreen
**Fichier**: `mobile/src/screens/ResultatBesoinScreen.tsx`

**Lignes 732-778** : `transformedProduct` extrait les images/vidéos depuis `productData.images/videos` :
```typescript
const transformedProduct = {
    ...productData,
    product_data: productData, // Structure complète avec médias enrichis
    images: productData.images || [], // ✅ Extraits depuis product_data enrichi
    videos: productData.videos || [], // ✅ Extraits depuis product_data enrichi
    // ...
};
```

**Lignes 889-906** : Extraction avec priorité :
```typescript
const productImages = Array.isArray(product.images) && product.images.length > 0 ? product.images 
    : Array.isArray(productDataFromProduct?.images) && productDataFromProduct.images.length > 0 ? productDataFromProduct.images
    : // ... fallbacks
    : [];
```

**Lignes 960-961** : Passage au niveau racine du produit :
```typescript
extractedProducts.push({
    ...product,
    images: productImages, // ✅ Passé au niveau racine
    videos: productVideos, // ✅ Passé au niveau racine
    // ...
});
```

#### ProductCard
**Fichier**: `mobile/src/components/ProductCard.tsx`

**Lignes 676-686** : Priorité d'extraction (PRIORITÉ ABSOLUE à `product.images/videos`) :
```typescript
const rawImages = 
    (Array.isArray(product.images) && product.images.length > 0) ? product.images // ✅ PRIORITÉ 1
    : (Array.isArray(product.product_data?.images) && product.product_data.images.length > 0) ? product.product_data.images // ✅ PRIORITÉ 2
    : // ... fallbacks
    : [];
```

**Lignes 688-691** : Normalisation des URLs :
```typescript
const images = rawImages
    .map((img: any) => normalizeMediaUrl(img, 'image'))
    .filter((img): img is string => img !== null && img !== '');
```

**Fonction `normalizeMediaUrl`** (lignes 106-165) :
- Détecte les URLs CDN (commencent par `http://` ou `https://`)
- Retourne tel quel si déjà URL complète
- Convertit base64 si nécessaire
- Construit URL complète pour chemins relatifs

## 🔍 Points de vérification

### 1. Backend - Vérifier l'enrichissement
**Logs à vérifier** :
```
[get_products_by_service] X médias trouvés pour service Y
[get_products_by_service] X produits enrichis avec médias pour service Y
```

**Vérifier dans la réponse API** :
```json
{
  "product_data": {
    "images": ["https://cdn.example.com/path/to/image.jpg", ...],
    "videos": ["https://cdn.example.com/path/to/video.mp4", ...]
  }
}
```

### 2. Mobile - Vérifier l'extraction
**Logs à vérifier dans ResultatBesoinScreen** :
```
[ResultatBesoinScreen] Images/vidéos extraites pour produit X: {
  productImagesCount: X,
  productVideosCount: X,
  productDataHasImages: true/false,
  firstImageUrl: "https://..."
}
```

**Logs à vérifier dans ProductCard** :
```
[ProductCard] 📸 Médias extraits pour service X, produit Y: {
  rawImagesCount: X,
  imagesCount: X,
  productImages: X,
  productDataImages: X,
  firstImageUrl: "https://...",
  isFirstImageCDN: true/false
}
```

### 3. Structure des données attendue

**Dans ResultatBesoinScreen** :
```typescript
product = {
    images: ["https://cdn...", ...], // ✅ PRIORITÉ ABSOLUE pour ProductCard
    videos: ["https://cdn...", ...], // ✅ PRIORITÉ ABSOLUE pour ProductCard
    product_data: {
        images: ["https://cdn...", ...], // ✅ Fallback pour ProductCard
        videos: ["https://cdn...", ...], // ✅ Fallback pour ProductCard
        // ... autres champs
    }
}
```

## ✅ Corrections apportées

1. **Backend** : `get_products_by_service` enrichit maintenant `product_data` avec les médias depuis la table `media` avec URLs CDN
2. **Logs** : Ajout de logs détaillés pour diagnostiquer les problèmes

## 🧪 Tests à effectuer

1. **Vérifier l'API** :
   ```bash
   GET /api/services/{service_id}/products
   ```
   Vérifier que `product_data.images` et `product_data.videos` contiennent des URLs CDN

2. **Vérifier ResultatBesoinScreen** :
   - Ouvrir les logs React Native
   - Chercher un produit avec médias
   - Vérifier les logs `[ResultatBesoinScreen] Images/vidéos extraites`

3. **Vérifier ProductCard** :
   - Ouvrir les logs React Native
   - Vérifier les logs `[ProductCard] 📸 Médias extraits`
   - Vérifier que `imagesCount > 0` ou `videosCount > 0`

## 🐛 Problèmes potentiels restants

1. **CDN non configuré** : Si `media_storage` n'est pas configuré, les chemins ne sont pas transformés en URLs CDN
2. **Médias non liés** : Si les médias dans la table `media` n'ont pas de `product_index` correspondant
3. **URLs CDN invalides** : Si `build_public_url()` génère des URLs invalides
4. **Normalisation** : Si `normalizeMediaUrl()` ne reconnaît pas les URLs CDN

## 📝 Prochaines étapes

1. Tester avec un produit ayant des médias dans la table `media`
2. Vérifier les logs à chaque étape du flux
3. Si problème persiste, vérifier la configuration CDN (`media_storage`)

