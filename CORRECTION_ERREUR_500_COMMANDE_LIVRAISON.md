# ✅ Correction : Erreur 500 lors du lancement d'une commande de livraison

*Date: 2025-11-26*

## 🐛 Problème identifié

**Symptôme** : Erreur 500 lors de l'appel à `POST /api/delivery/client-order`

**Logs** :
```
[POST]500yukpomnang.onrender.com/api/delivery/client-order
```

**Cause** : Le code cherchait les produits sous la clé `"products"` (anglais) alors que dans la base de données, les produits sont stockés sous `"produits"` (français) et peuvent être dans `produits.valeur` (objet avec propriété `valeur` contenant un tableau).

---

## ✅ Corrections apportées

### 1. Correction de la recherche de produits dans `create_client_order`

**Fichier** : `backend/src/routes/delivery_routes.rs` (ligne ~1074)

**Avant** :
```rust
if let Some(products) = service_data.get("products").and_then(|v| v.as_array()) {
```

**Après** :
```rust
// ✅ CORRECTION: Chercher produits dans produits.valeur (format standard) ou produits directement
let products_array = service_data
    .get("produits")
    .and_then(|p| {
        // Si produits est un objet avec valeur
        if let Some(valeur) = p.get("valeur").and_then(|v| v.as_array()) {
            Some(valeur)
        } else if let Some(arr) = p.as_array() {
            // Si produits est directement un tableau
            Some(arr)
        } else {
            None
        }
    })
    .or_else(|| {
        // Fallback: chercher "products" (format anglais)
        service_data.get("products").and_then(|v| v.as_array())
    });
```

### 2. Correction de la requête SQL

**Avant** :
```rust
let product_data = sqlx::query(
    "SELECT data FROM services WHERE id = $1"
)
.bind(payload.service_id)
.fetch_optional(&state.pg)
.await?;

let service_data: serde_json::Value = service_row.try_get("data")?;
```

**Après** :
```rust
let product_data: Option<ServiceDataRow> = sqlx::query_as(
    "SELECT data FROM services WHERE id = $1"
)
.bind(payload.service_id)
.fetch_optional(&state.pg)
.await?;

let service_data: serde_json::Value = service_row.data;
```

### 3. Amélioration de la recherche du prix

**Avant** :
```rust
product.get("price").and_then(|v| v.as_f64()).map(|p| (p * 100.0) as i64).unwrap_or(0)
```

**Après** :
```rust
product.get("price")
    .or_else(|| product.get("prix"))
    .or_else(|| product.get("prix_produit"))
    .and_then(|v| v.as_f64())
    .map(|p| (p * 100.0) as i64)
    .unwrap_or(0)
```

### 4. Correction similaire dans `estimate_delivery_costs`

La même correction a été appliquée à la fonction `estimate_delivery_costs` (ligne ~1618) pour éviter le même problème lors de l'estimation des coûts.

---

## 🎯 Résultat

✅ **Recherche de produits corrigée** : Le code cherche maintenant dans `produits.valeur` (format standard), puis `produits` directement, puis `products` (fallback anglais)

✅ **Requête SQL corrigée** : Utilisation de `query_as` au lieu de `query` pour un typage correct

✅ **Recherche de prix améliorée** : Support de `price`, `prix`, et `prix_produit`

✅ **Compatibilité** : Le code fonctionne avec les deux formats (français et anglais)

---

## 📝 Fichier modifié

- `backend/src/routes/delivery_routes.rs` - Fonctions `create_client_order` et `estimate_delivery_costs`

---

*Correction effectuée le 2025-11-26*

