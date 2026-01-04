# 🔧 Corrections pour la récupération des médias

## 🎯 Problème principal identifié

Les médias sont créés avec un `product_id` temporaire (`"temp_191_5"`) au lieu d'utiliser le vrai `id` de `service_products`. Cela cause une incohérence dans la base de données.

## ✅ Solution : Corriger l'ordre de création dans `creer_service.rs`

### Problème actuel

**Ordre actuel** (INCORRECT) :
1. Créer `product_id = format!("temp_{}_{}", service_id, product_index)` (ligne ~2807)
2. Créer les médias avec ce `product_id` temporaire (ligne ~3024)
3. Créer le produit dans `service_products` (ligne ~4849)

**Résultat** : Les médias ont un `product_id` qui ne correspond jamais à un `id` réel dans `service_products`.

### Solution proposée

**Nouvel ordre** (CORRECT) :
1. Créer le produit dans `service_products` **EN PREMIER**
2. Récupérer l'`id` réel du produit créé
3. Créer les médias avec ce vrai `product_id`

### Code à modifier

**Fichier** : `backend/src/services/creer_service.rs`

**Section à modifier** : Autour de la ligne 2800-3100 (création des produits et médias)

**Changement nécessaire** :

```rust
// ❌ AVANT (ligne ~2807)
let product_id = format!("temp_{}_{}", service_id, product_index);

// ... création des médias avec product_id temporaire (ligne ~3024)
sqlx::query(
    r#"
    INSERT INTO media (
        service_id, product_id, product_index, type, path, ...
    )
    VALUES ($1, $2, $3, ...)
    "#,
)
.bind(service_id)
.bind(&product_id)  // ❌ product_id temporaire
.bind(product_index)
...

// ... plus tard (ligne ~4849), création dans service_products
products_service.create_product(...)
```

**✅ APRÈS (nouvel ordre)** :

```rust
// ✅ ÉTAPE 1: Créer le produit dans service_products EN PREMIER
let product_record = match state.products_service
    .create_product(
        service_id,
        product_index as i32,
        &produit_cleaned,  // produit nettoyé sans médias base64
    )
    .await
{
    Ok(product) => {
        log::info!(
            "[creer_service] ✅ Produit {} créé dans service_products (id: {})",
            product_index,
            product.id
        );
        product
    }
    Err(e) => {
        log::error!(
            "[creer_service] ❌ Erreur création produit {}: {}",
            product_index, e
        );
        return Err(e);
    }
};

// ✅ ÉTAPE 2: Utiliser le vrai product_id pour les médias
let real_product_id = product_record.id.to_string();

// ✅ ÉTAPE 3: Créer les médias avec le vrai product_id
for (image_index, media) in processed.iter().enumerate() {
    let is_main = image_index == 0;

    sqlx::query(
        r#"
        INSERT INTO media (
            service_id, product_id, product_index, type, path,
            is_main_image, display_order, uploaded_at,
            image_signature, image_hash, image_metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(service_id)
    .bind(&real_product_id)  // ✅ Utiliser l'id réel de service_products
    .bind(product_index as i32)
    .bind("image")
    .bind(&media.file_path)
    .bind(is_main)
    .bind(image_index as i32)
    .bind(Utc::now().naive_utc())
    .bind(&media.image_signature)
    .bind(&media.image_hash)
    .bind(&media.image_metadata)
    .execute(&mut *tx)
    .await?;
}
```

## 🔍 Vérification AR Immersion

**Fichier** : `backend/src/services/ar_preview_service.rs`

**Action** : Vérifier si ce service crée des médias et comment il référence les produits.

**Si des médias AR sont créés** :
- S'assurer qu'ils utilisent le bon `product_id` depuis `service_products`
- Utiliser la même logique : créer/récupérer le produit d'abord, puis créer les médias

## 📋 Checklist de correction

### Phase 1 : Correction `creer_service.rs`
- [ ] Identifier où les produits sont créés dans `service_products` (ligne ~4849)
- [ ] Déplacer cette création **AVANT** la création des médias (ligne ~3024)
- [ ] Récupérer l'`id` réel du produit créé
- [ ] Utiliser cet `id` pour tous les médias du produit
- [ ] Supprimer l'utilisation de `format!("temp_{}_{}", ...)`
- [ ] Tester la création d'un produit avec médias

### Phase 2 : Vérification AR Immersion
- [ ] Lire `ar_preview_service.rs` complètement
- [ ] Identifier si des médias sont créés
- [ ] Vérifier le référencement produit
- [ ] Corriger si nécessaire

### Phase 3 : Tests et validation
- [ ] Créer un produit avec médias via l'API
- [ ] Vérifier dans la base que `media.product_id` correspond à `service_products.id`
- [ ] Vérifier que la récupération des médias fonctionne correctement
- [ ] Tester la génération vidéo avec ces médias

## 🧪 Requêtes SQL de vérification

### Vérifier les médias avec product_id invalide
```sql
SELECT 
    m.id as media_id,
    m.service_id,
    m.product_id,
    m.product_index,
    sp.id as real_product_id,
    CASE 
        WHEN m.product_id = sp.id::TEXT THEN '✅ OK'
        ELSE '❌ INVALIDE'
    END as status
FROM media m
LEFT JOIN service_products sp 
    ON sp.service_id = m.service_id 
    AND sp.product_index = m.product_index
WHERE m.service_id = 191
AND m.product_index = 5;
```

### Vérifier la récupération des médias (comme dans gather_media_sources)
```sql
SELECT 
    id, 
    path, 
    type, 
    product_index, 
    product_id,
    CASE 
        WHEN product_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM service_products sp 
            WHERE sp.id::TEXT = media.product_id
        ) THEN '✅ Valide'
        WHEN product_id IS NULL THEN '⚠️ NULL'
        ELSE '❌ Invalide'
    END as product_id_status
FROM media
WHERE service_id = 191
AND product_index = 5
AND (media_type IN ('image', 'video') OR type IN ('image', 'video'))
ORDER BY COALESCE(is_main_image, FALSE) DESC, 
         COALESCE(display_order, 0) ASC;
```

## 📝 Notes importantes

1. **Transaction** : S'assurer que la création du produit et des médias est dans la même transaction pour garantir la cohérence.

2. **Gestion d'erreur** : Si la création du produit échoue, ne pas créer les médias.

3. **Compatibilité** : `product_id` dans `media` est TEXT, mais `id` dans `service_products` est INTEGER. Utiliser `.to_string()` pour la conversion.

4. **Migration existante** : La migration `20260103_phase2_correct_media_product_references.sql` corrige les données existantes, mais ne prévient pas le problème pour les nouveaux médias. Cette correction est donc essentielle.

## 🚀 Impact attendu

Après cette correction :
- ✅ Tous les nouveaux médias auront un `product_id` valide
- ✅ La cohérence entre `media` et `service_products` sera garantie
- ✅ La récupération des médias fonctionnera correctement
- ✅ Plus besoin de migration de correction pour les nouveaux médias

