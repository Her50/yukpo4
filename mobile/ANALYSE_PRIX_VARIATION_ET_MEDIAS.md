# 🔍 Analyse : Prix Variation et Médias dans ResultatBesoinScreen

## 📋 Problèmes Identifiés

### 1. ❌ Prix Variation (prix_variation) ne s'affichent plus

### 2. ❌ Médias (images/vidéos) ne s'affichent toujours pas malgré les corrections

---

## 🔍 Analyse Détaillée

### Problème 1 : Prix Variation

#### ✅ Sauvegarde lors de la création (Backend - `creer_service.rs`)

Le backend transforme correctement `variation_prix` en format `has_variant` et `variants` :

```rust
// Lignes 3584-3649 dans creer_service.rs
// ✅ Transformation variation_prix → has_variant + variants
if let Some(variation_prix) = variation_prix_clone {
    if let Some(variation_obj) = variation_prix.as_object() {
        if let Some(modalites) = variation_obj.get("modalites").and_then(|v| v.as_array()) {
            let variants: Vec<Value> = modalites.iter().map(|modalite| {
                // Création des variants avec valeur, prix, devise, stock, image
            }).collect();
            
            produit_obj.insert("has_variant", Value::Bool(true));
            produit_obj.insert("variants", Value::Array(variants));
            produit_obj.insert("variant_dimension", variable.clone());
        }
    }
}
```

**✅ CORRECT** : Le backend transforme bien `variation_prix` en `has_variant` + `variants` lors de la création.

#### ⚠️ Récupération dans ResultatBesoinScreen

**Lignes 750-754 dans ResultatBesoinScreen.tsx** :
```typescript
// ✅ NOUVEAU 2026-01-XX: Préserver les variations de prix (variants, has_variant, variation_prix)
has_variant: productData.has_variant || productFromAPI.has_variant || false,
variants: productData.variants || productFromAPI.variants || [],
variation_prix: productData.variation_prix || productData.variabilite_prix || productData.price_variant || productFromAPI.variation_prix,
variant_dimension: productData.variant_dimension || productFromAPI.variant_dimension,
```

**✅ CORRECT** : ResultatBesoinScreen préserve bien les champs `has_variant`, `variants`, `variation_prix`.

#### ⚠️ Problème Potentiel : Backend ne retourne pas les variants

**Le service `products_service.rs`** retourne simplement `product_data` depuis `service_products` **SANS enrichissement** :

```rust
// Ligne 121-152 dans products_service.rs
pub async fn get_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
    let products = sqlx::query_as::<_, Product>(
        r#"
        SELECT 
            id, service_id, product_index, product_data, product_name, ...
        FROM service_products
        WHERE service_id = $1
        ORDER BY product_index ASC
        "#,
    )
    .bind(service_id)
    .fetch_all(&*self.pool)
    .await?;
    
    Ok(products) // ⚠️ Retourne product_data tel quel, sans vérifier si has_variant/variants existent
}
```

**❌ PROBLÈME IDENTIFIÉ** : 
- Si `product_data` dans `service_products` ne contient **PAS** `has_variant` et `variants` (mais seulement `variation_prix`), alors ProductCard ne peut pas les afficher.
- Le backend transforme `variation_prix` → `has_variant` + `variants` lors de la **création**, mais si `product_data` est mis à jour sans cette transformation, les variants peuvent être perdus.

#### ✅ ProductCard cherche bien les variants

**Lignes 495-596 dans ProductCard.tsx** :
```typescript
// ✅ CORRIGÉ 2026-01-20: Transformer variation_prix en variants si nécessaire
let hasVariant = productData.has_variant || product.has_variant || false;
let variants = productData.variants || product.variants || [];

// Si pas de variants mais qu'on a variation_prix, le transformer
if (!hasVariant && variants.length === 0) {
    const variationPrix = productData.variation_prix || productData.variabilite_prix || productData.price_variant
      || product.variation_prix || product.variabilite_prix || product.price_variant;
    
    if (variationPrix) {
        // Transformation variation_prix → variants
    }
}
```

**✅ CORRECT** : ProductCard transforme bien `variation_prix` en `variants` si nécessaire.

---

### Problème 2 : Médias (Images/Vidéos)

#### ✅ Sauvegarde lors de la création (Backend - `creer_service.rs`)

Le backend sauvegarde les médias dans la table `media` et ajoute les URLs dans `product_data.images/videos` :

**Lignes 3234-3656 dans creer_service.rs** :
- Les images sont sauvegardées via `persist_base64_media` → table `media`
- Les URLs CDN sont ajoutées dans `product_data.images` avec `build_public_url()`

**✅ CORRECT** : Le backend sauvegarde bien les médias et ajoute les URLs CDN dans `product_data`.

#### ⚠️ Récupération dans ResultatBesoinScreen

**Lignes 748-749, 960-961 dans ResultatBesoinScreen.tsx** :
```typescript
// ✅ CORRIGÉ 2026-01-21: S'assurer que les images/vidéos sont bien incluses depuis product_data
images: productData.images || [],
videos: productData.videos || [],

// Plus tard...
images: productImages,
videos: productVideos,
```

**✅ CORRECT** : ResultatBesoinScreen extrait bien les images/vidéos depuis `product_data`.

#### ⚠️ Problème Potentiel : Backend ne enrichit pas product_data avec médias depuis table media

**Le service `products_service.rs`** retourne `product_data` depuis `service_products` **SANS enrichir avec les médias depuis la table `media`** :

```rust
// Ligne 121-152 dans products_service.rs
pub async fn get_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
    // ⚠️ Ne fait PAS de JOIN avec la table media pour enrichir product_data.images/videos
    let products = sqlx::query_as::<_, Product>(
        r#"
        SELECT ... product_data ...
        FROM service_products
        WHERE service_id = $1
        "#,
    )
    .fetch_all(&*self.pool)
    .await?;
    
    Ok(products) // ⚠️ product_data peut ne pas contenir les URLs CDN depuis la table media
}
```

**❌ PROBLÈME IDENTIFIÉ** : 
- Si les médias sont dans la table `media` mais **PAS** dans `product_data.images/videos`, alors ils ne seront pas retournés.
- Le backend devrait enrichir `product_data` avec les médias depuis la table `media` lors de la récupération.

#### ✅ ProductCard cherche bien les médias

**Lignes 662-712 dans ProductCard.tsx** :
```typescript
// ✅ PRIORITÉ 1: product.images/videos (passés directement par ResultatBesoinScreen) - PRIORITÉ ABSOLUE
const rawImages = 
    (Array.isArray(product.images) && product.images.length > 0) ? product.images
    : (Array.isArray(product.product_data?.images) && product.product_data.images.length > 0) ? product.product_data.images
    : ... // Fallbacks multiples

const images = rawImages
    .map((img: any) => normalizeMediaUrl(img, 'image'))
    .filter((img): img is string => img !== null && img !== '');
```

**✅ CORRECT** : ProductCard cherche bien les médias avec la bonne priorité.

---

## 🔧 Solutions Proposées

### Solution 1 : Enrichir product_data avec variants lors de la récupération

**Fichier** : `backend/src/services/products_service.rs`

**Modification** : Ajouter une fonction pour enrichir `product_data` avec `has_variant` et `variants` si `variation_prix` existe :

```rust
impl ProductsService {
    /// Enrichit product_data avec has_variant/variants si variation_prix existe
    fn enrich_product_data_with_variants(product_data: &mut Value) {
        if let Some(obj) = product_data.as_object_mut() {
            // Si has_variant/variants n'existent pas mais variation_prix existe
            if !obj.contains_key("has_variant") && !obj.contains_key("variants") {
                if let Some(variation_prix) = obj.get("variation_prix")
                    .or_else(|| obj.get("variabilite_prix"))
                    .or_else(|| obj.get("price_variant"))
                {
                    // Transformer variation_prix → has_variant + variants
                    // (même logique que dans creer_service.rs lignes 3584-3649)
                }
            }
        }
    }
    
    pub async fn get_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
        let mut products = sqlx::query_as::<_, Product>(...).fetch_all(&*self.pool).await?;
        
        // ✅ NOUVEAU: Enrichir chaque produit avec variants si nécessaire
        for product in &mut products {
            Self::enrich_product_data_with_variants(&mut product.product_data);
        }
        
        Ok(products)
    }
}
```

### Solution 2 : Enrichir product_data avec médias depuis table media

**Fichier** : `backend/src/services/products_service.rs`

**Modification** : Ajouter une fonction pour enrichir `product_data` avec les médias depuis la table `media` :

```rust
impl ProductsService {
    /// Enrichit product_data avec les médias depuis la table media
    async fn enrich_product_data_with_media(
        &self,
        service_id: i32,
        product_index: i32,
        product_data: &mut Value,
    ) -> AppResult<()> {
        // Récupérer les médias depuis la table media
        let media_rows = sqlx::query(
            r#"
            SELECT media_type, media_url, build_public_url(media_url) as public_url
            FROM media
            WHERE service_id = $1 AND product_index = $2 AND is_active = true
            ORDER BY created_at ASC
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_all(&*self.pool)
        .await?;
        
        if let Some(obj) = product_data.as_object_mut() {
            let mut images: Vec<Value> = Vec::new();
            let mut videos: Vec<Value> = Vec::new();
            
            for row in media_rows {
                let media_type: String = row.get("media_type");
                let public_url: Option<String> = row.get("public_url");
                
                if let Some(url) = public_url {
                    if media_type == "image" {
                        images.push(Value::String(url));
                    } else if media_type == "video" {
                        videos.push(Value::String(url));
                    }
                }
            }
            
            // ✅ Ajouter les médias dans product_data (remplacer ou fusionner)
            if !images.is_empty() {
                obj.insert("images".to_string(), Value::Array(images));
            }
            if !videos.is_empty() {
                obj.insert("videos".to_string(), Value::Array(videos));
            }
        }
        
        Ok(())
    }
    
    pub async fn get_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
        let mut products = sqlx::query_as::<_, Product>(...).fetch_all(&*self.pool).await?;
        
        // ✅ NOUVEAU: Enrichir chaque produit avec les médias depuis la table media
        for product in &mut products {
            if let Err(e) = self.enrich_product_data_with_media(
                product.service_id,
                product.product_index,
                &mut product.product_data,
            ).await {
                log::warn!("[ProductsService] Erreur enrichissement médias pour produit {}: {}", product.product_index, e);
            }
        }
        
        Ok(products)
    }
}
```

---

## 📝 Checklist de Vérification

### Pour Prix Variation :
- [ ] Vérifier que `product_data` dans `service_products` contient `has_variant` et `variants` (ou `variation_prix`)
- [ ] Vérifier que le backend enrichit `product_data` avec `has_variant`/`variants` si seulement `variation_prix` existe
- [ ] Vérifier que ResultatBesoinScreen préserve `has_variant`, `variants`, `variation_prix`
- [ ] Vérifier que ProductCard transforme `variation_prix` → `variants` si nécessaire

### Pour Médias :
- [ ] Vérifier que les médias sont bien sauvegardés dans la table `media` lors de la création
- [ ] Vérifier que le backend enrichit `product_data` avec les URLs CDN depuis la table `media` lors de la récupération
- [ ] Vérifier que ResultatBesoinScreen extrait `product.images/videos` depuis `product_data`
- [ ] Vérifier que ProductCard normalise correctement les URLs CDN avec `normalizeMediaUrl()`

---

## 🚀 Prochaines Étapes

1. **Implémenter l'enrichissement des variants** dans `products_service.rs`
2. **Implémenter l'enrichissement des médias** dans `products_service.rs`
3. **Tester** avec des produits ayant des variations de prix
4. **Tester** avec des produits ayant des médias depuis la table `media`
5. **Vérifier** que les corrections fonctionnent dans ResultatBesoinScreen et ProductCard



