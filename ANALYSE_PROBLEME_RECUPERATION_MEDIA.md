# 🔍 Analyse approfondie : Problème de récupération des médias

## 📋 Contexte

Le système a migré d'un stockage JSONB vers une table dédiée `service_products`. Les médias doivent maintenant référencer correctement les produits via `product_id` (qui doit correspondre à `service_products.id`) et `product_index`.

## 🔴 Problèmes identifiés

### 1. **Incohérence dans la création des médias lors de la création de produits**

**Fichier** : `backend/src/services/creer_service.rs` (lignes ~2807, ~3024)

**Problème** :
```rust
// ❌ PROBLÈME: product_id est créé comme un format temporaire
let product_id = format!("temp_{}_{}", service_id, product_index);

// Plus tard, insertion dans media avec ce product_id temporaire
INSERT INTO media (
    service_id, product_id, product_index, type, path, ...
)
VALUES ($1, $2, $3, ...)
.bind(&product_id)  // ❌ product_id = "temp_191_5" au lieu de l'id réel
```

**Impact** :
- Les médias sont créés avec un `product_id` temporaire (`"temp_191_5"`)
- Ce `product_id` ne correspond jamais à un `id` réel dans `service_products`
- La migration `20260103_phase2_correct_media_product_references.sql` tente de corriger cela, mais seulement après coup

**Solution nécessaire** :
1. Créer le produit dans `service_products` **AVANT** de créer les médias
2. Récupérer l'`id` réel du produit créé
3. Utiliser cet `id` pour les médias

### 2. **Récupération des médias uniquement par product_index**

**Fichier** : `backend/src/services/video_generation_service.rs` (lignes ~2703-2719)

**Code actuel** :
```rust
// ✅ CORRECT: Récupération par product_index
let rows: Vec<MediaRow> = sqlx::query_as(
    "SELECT id, path, type, ai_description, product_index, media_type
     FROM media
     WHERE service_id = $1
     AND product_index = $2
     AND (media_type IN ('image', 'video') OR ...)
     ORDER BY ..."
)
.bind(service_id)
.bind(product_index)
```

**Analyse** :
- ✅ La récupération par `product_index` fonctionne correctement
- ⚠️ Mais si `product_id` est invalide, il y a une incohérence dans la base
- ⚠️ La migration corrige après coup, mais les nouveaux médias créés ont toujours le problème

### 3. **AR Immersion - Référencement produit non vérifié**

**Fichier** : `backend/src/controllers/ar_preview_controller.rs`

**Problème** :
- Le contrôleur AR appelle `ARPreviewService::generate_ar_preview()`
- Il faut vérifier si ce service crée des médias et comment il référence les produits
- Si des médias AR sont créés, ils doivent aussi utiliser le bon `product_id`

### 4. **Migration de correction nécessaire mais pas appliquée systématiquement**

**Fichier** : `backend/migrations/20260103_phase2_correct_media_product_references.sql`

**Problème** :
- Cette migration corrige les `product_id` existants
- Mais elle ne prévient pas le problème pour les nouveaux médias
- Les nouveaux médias créés continuent d'avoir des `product_id` invalides

## ✅ Solutions proposées

### Solution 1 : Corriger la création des médias dans `creer_service.rs`

**Fichier** : `backend/src/services/creer_service.rs`

**Changements nécessaires** :

1. **Créer le produit dans `service_products` AVANT de créer les médias** :
```rust
// ✅ NOUVEAU: Créer le produit dans service_products d'abord
let product_record = state.products_service
    .create_product(service_id, product_index, product_data.clone())
    .await?;

let real_product_id = product_record.id.to_string(); // ✅ Vrai id de service_products

// Maintenant utiliser real_product_id pour les médias
INSERT INTO media (
    service_id, product_id, product_index, type, path, ...
)
VALUES ($1, $2, $3, ...)
.bind(service_id)
.bind(&real_product_id)  // ✅ Utiliser l'id réel
.bind(product_index)
```

2. **Vérifier que `ProductsService::create_product` retourne l'id** :
   - Vérifier dans `backend/src/services/products_service.rs`
   - S'assurer que la méthode retourne le produit créé avec son `id`

### Solution 2 : Vérifier AR Immersion

**Fichier** : `backend/src/services/ar_preview_service.rs` (à vérifier)

**Actions** :
1. Trouver où les médias AR sont créés
2. Vérifier qu'ils utilisent le bon `product_id` depuis `service_products`
3. Corriger si nécessaire

### Solution 3 : Ajouter une validation lors de la création de médias

**Fichier** : Créer une fonction utilitaire

**Code proposé** :
```rust
/// Valide et corrige product_id pour un média
async fn ensure_valid_product_id(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
    product_id: Option<&str>,
) -> AppResult<String> {
    // Si product_id fourni, vérifier qu'il existe dans service_products
    if let Some(pid) = product_id {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM service_products WHERE id::TEXT = $1)"
        )
        .bind(pid)
        .fetch_one(pool)
        .await?;
        
        if exists {
            return Ok(pid.to_string());
        }
    }
    
    // Sinon, chercher par service_id + product_index
    let real_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM service_products 
         WHERE service_id = $1 AND product_index = $2"
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await?;
    
    match real_id {
        Some(id) => Ok(id.to_string()),
        None => Err(AppError::NotFound(format!(
            "Produit non trouvé: service_id={}, product_index={}",
            service_id, product_index
        )))
    }
}
```

## 📊 État actuel de la base de données

### Structure de la table `media` :
```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    product_id TEXT,           -- ⚠️ Doit référencer service_products.id (INTEGER converti en TEXT)
    product_index INTEGER,       -- ✅ Utilisé pour la récupération
    type TEXT NOT NULL,
    path TEXT NOT NULL,
    ...
);
```

### Structure de la table `service_products` :
```sql
CREATE TABLE service_products (
    id SERIAL PRIMARY KEY,      -- ✅ INTEGER (pas TEXT)
    service_id INTEGER NOT NULL,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    ...
);
```

### Relation attendue :
- `media.product_id` (TEXT) = `service_products.id::TEXT` (INTEGER converti en TEXT)
- `media.product_index` = `service_products.product_index`
- `media.service_id` = `service_products.service_id`

## 🔍 Points de vérification

### 1. Vérifier les médias existants
```sql
-- Médias avec product_id invalide
SELECT m.id, m.service_id, m.product_id, m.product_index, sp.id as real_id
FROM media m
LEFT JOIN service_products sp ON sp.id::TEXT = m.product_id
WHERE m.product_id IS NOT NULL
AND sp.id IS NULL
AND m.service_id IN (SELECT DISTINCT service_id FROM service_products);
```

### 2. Vérifier les médias sans product_id mais avec product_index
```sql
-- Médias qui devraient avoir un product_id
SELECT m.id, m.service_id, m.product_index, sp.id as should_be_product_id
FROM media m
INNER JOIN service_products sp 
    ON sp.service_id = m.service_id 
    AND sp.product_index = m.product_index
WHERE m.product_id IS NULL
OR m.product_id != sp.id::TEXT;
```

### 3. Vérifier la récupération pour un produit spécifique
```sql
-- Test de récupération (comme dans gather_media_sources)
SELECT id, path, type, product_index, product_id
FROM media
WHERE service_id = 191
AND product_index = 5
AND (media_type IN ('image', 'video') OR type IN ('image', 'video'));
```

## 🎯 Plan d'action

### Phase 1 : Correction immédiate (priorité haute)
1. ✅ Corriger `creer_service.rs` pour utiliser le vrai `product_id` après création dans `service_products`
2. ✅ Vérifier `ar_preview_service.rs` et corriger si nécessaire
3. ✅ Tester la création d'un produit avec médias et vérifier la cohérence

### Phase 2 : Validation et tests
1. ✅ Créer des tests unitaires pour vérifier la cohérence `product_id`
2. ✅ Exécuter la migration de correction sur les données existantes
3. ✅ Vérifier que tous les nouveaux médias ont des `product_id` valides

### Phase 3 : Amélioration continue
1. ✅ Ajouter une fonction utilitaire `ensure_valid_product_id()`
2. ✅ Ajouter des contraintes de clé étrangère si possible (avec conversion TEXT -> INTEGER)
3. ✅ Documenter le processus de création de médias

## 📝 Notes importantes

1. **Compatibilité** : `product_id` est TEXT dans `media` mais INTEGER dans `service_products`. La conversion se fait via `::TEXT` ou `.to_string()`.

2. **Fallback** : La récupération par `product_index` fonctionne même si `product_id` est invalide, mais c'est une incohérence qu'il faut corriger.

3. **Migration** : La migration `20260103_phase2_correct_media_product_references.sql` doit être exécutée pour corriger les données existantes, mais elle ne prévient pas le problème pour les nouveaux médias.

4. **AR Immersion** : Nécessite une vérification spécifique car le code n'a pas été trouvé dans cette analyse.

