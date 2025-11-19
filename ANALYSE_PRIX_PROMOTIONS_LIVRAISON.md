# Analyse : Prise en compte des promotions et prix révisés dans le système de livraison

## 🔍 Problème identifié

Le système actuel de livraison **ne tient pas compte des promotions et prix révisés** des produits lors de :
1. L'estimation des coûts (`/api/delivery/estimate-costs`)
2. La création de commande (`/api/delivery/client-order`)
3. L'affichage des coûts dans `OrderDeliveryModal` (frontend et mobile)

## 📋 État actuel du code

### Backend : `backend/src/routes/delivery_routes.rs`

#### Endpoint `estimate_delivery_costs` (Phase 7)
```rust
// Récupération du prix du produit
let product_price_cents = if let Some(product_index) = payload.product_index {
    let product_data = sqlx::query!(
        "SELECT data FROM services WHERE id = $1",
        payload.service_id
    )
    .fetch_optional(&state.pg)
    .await?;

    if let Some(service_row) = product_data {
        if let Some(products) = service_row.data.get("products").and_then(|v| v.as_array()) {
            if let Some(product) = products.get(product_index as usize) {
                if let Some(price) = product.get("price").and_then(|v| v.as_f64()) {
                    (price * 100.0) as i64 // ❌ Utilise directement product.price
                }
            }
        }
    }
}
```

**Problème** : Le code utilise directement `product.price` sans vérifier :
- `product.promotion_price` (prix promotionnel)
- `product.discounted_price` (prix réduit)
- `product.final_price` (prix final après promotion)
- Les dates de validité des promotions

#### Endpoint `create_client_order` (Phase 5)
```rust
// Récupération du prix du produit pour la réservation de paiement
let (product_price_cents, delivery_cost_cents, billing_mode) = if let Some(product_index) = payload.product_index {
    // Même logique : utilise directement product.price
}
```

**Problème** : Même problème que ci-dessus.

### Frontend : `frontend/src/components/delivery/OrderDeliveryModal.tsx`

#### Fonction `loadAvailableProducts` (Phase 8)
```typescript
const productList = products
    .map((p: any, index: number) => ({
        index,
        name: p.nom || p.name || p.title || `Produit ${index + 1}`,
        price: p.price || 0, // ❌ Utilise directement p.price
    }))
    .filter((p: any) => p.name && p.price > 0);
```

**Problème** : Le frontend utilise directement `p.price` sans vérifier les promotions.

#### Fonction `loadCosts` (Phase 8)
```typescript
// Calculer le prix total de tous les produits sélectionnés
let totalProductPrice = 0;
selectedProducts.forEach((idx) => {
    const product = availableProducts.find(p => p.index === idx);
    if (product) {
        totalProductPrice += product.price; // ❌ Utilise le prix de base
    }
});
```

**Problème** : Le calcul du total utilise les prix de base, pas les prix promotionnels.

### Mobile : `mobile/src/components/delivery/OrderDeliveryModal.tsx`

Même problème que le frontend.

## ✅ Solution proposée

### 1. Créer une fonction utilitaire pour obtenir le prix réel

#### Backend : `backend/src/services/product_price_service.rs` (NOUVEAU)

```rust
use serde_json::Value;
use chrono::Utc;

pub struct ProductPriceService;

impl ProductPriceService {
    /// Récupère le prix réel d'un produit (en tenant compte des promotions)
    pub fn get_real_price(product: &Value) -> Option<f64> {
        // 1. Vérifier si une promotion est active
        if let Some(promotion) = product.get("promotion") {
            if let Some(promotion_price) = promotion.get("price").and_then(|v| v.as_f64()) {
                // Vérifier les dates de validité
                if Self::is_promotion_valid(promotion) {
                    return Some(promotion_price);
                }
            }
        }

        // 2. Vérifier le prix réduit
        if let Some(discounted_price) = product.get("discounted_price").and_then(|v| v.as_f64()) {
            return Some(discounted_price);
        }

        // 3. Vérifier le prix final
        if let Some(final_price) = product.get("final_price").and_then(|v| v.as_f64()) {
            return Some(final_price);
        }

        // 4. Fallback : prix de base
        product.get("price").and_then(|v| v.as_f64())
    }

    /// Vérifie si une promotion est valide (dates)
    fn is_promotion_valid(promotion: &Value) -> bool {
        let now = Utc::now();

        // Vérifier date de début
        if let Some(start_date) = promotion.get("start_date").and_then(|v| v.as_str()) {
            if let Ok(start) = chrono::DateTime::parse_from_rfc3339(start_date) {
                if now < start.with_timezone(&Utc) {
                    return false;
                }
            }
        }

        // Vérifier date de fin
        if let Some(end_date) = promotion.get("end_date").and_then(|v| v.as_str()) {
            if let Ok(end) = chrono::DateTime::parse_from_rfc3339(end_date) {
                if now > end.with_timezone(&Utc) {
                    return false;
                }
            }
        }

        true
    }

    /// Récupère le prix en centimes
    pub fn get_real_price_cents(product: &Value) -> Option<i64> {
        Self::get_real_price(product).map(|p| (p * 100.0) as i64)
    }
}
```

### 2. Modifier les endpoints backend

#### `backend/src/routes/delivery_routes.rs`

```rust
use crate::services::product_price_service::ProductPriceService;

// Dans estimate_delivery_costs
let product_price_cents = if let Some(product_index) = payload.product_index {
    // ... récupération du produit ...
    if let Some(product) = products.get(product_index as usize) {
        // ✅ Utiliser ProductPriceService
        ProductPriceService::get_real_price_cents(product)
            .unwrap_or(0)
    } else {
        0
    }
} else {
    0
};

// Dans create_client_order
let (product_price_cents, delivery_cost_cents, billing_mode) = if let Some(product_index) = payload.product_index {
    // ... récupération du produit ...
    if let Some(product) = products.get(product_index as usize) {
        let price = ProductPriceService::get_real_price_cents(product)
            .unwrap_or(0);
        // ...
    }
};
```

### 3. Modifier le frontend

#### `frontend/src/components/delivery/OrderDeliveryModal.tsx`

```typescript
// Fonction helper pour obtenir le prix réel
const getRealPrice = (product: any): number => {
    // 1. Vérifier promotion active
    if (product.promotion?.price) {
        const now = new Date();
        const startDate = product.promotion.start_date ? new Date(product.promotion.start_date) : null;
        const endDate = product.promotion.end_date ? new Date(product.promotion.end_date) : null;
        
        if ((!startDate || now >= startDate) && (!endDate || now <= endDate)) {
            return product.promotion.price;
        }
    }

    // 2. Vérifier prix réduit
    if (product.discounted_price) {
        return product.discounted_price;
    }

    // 3. Vérifier prix final
    if (product.final_price) {
        return product.final_price;
    }

    // 4. Fallback : prix de base
    return product.price || 0;
};

// Dans loadAvailableProducts
const productList = products
    .map((p: any, index: number) => ({
        index,
        name: p.nom || p.name || p.title || `Produit ${index + 1}`,
        price: getRealPrice(p), // ✅ Utiliser getRealPrice
        originalPrice: p.price, // Garder le prix original pour affichage
        hasPromotion: !!p.promotion || !!p.discounted_price,
    }))
    .filter((p: any) => p.name && p.price > 0);
```

### 4. Améliorer l'affichage des prix

```typescript
// Afficher le prix barré si promotion
{product.hasPromotion && product.originalPrice && (
    <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 line-through">
            {product.originalPrice.toLocaleString('fr-FR')} FCFA
        </span>
        <span className="text-sm font-semibold text-green-600">
            {product.price.toLocaleString('fr-FR')} FCFA
        </span>
        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">
            PROMO
        </span>
    </div>
)}
```

## 📝 Structure de données attendue

### Format produit avec promotion

```json
{
    "nom": "Produit exemple",
    "price": 10000,  // Prix de base
    "promotion": {
        "price": 7500,  // Prix promotionnel
        "start_date": "2025-01-01T00:00:00Z",
        "end_date": "2025-01-31T23:59:59Z",
        "label": "Promotion de janvier"
    },
    "discounted_price": null,  // Prix réduit (si pas de promotion structurée)
    "final_price": null  // Prix final calculé
}
```

## 🎯 Actions à effectuer

1. ✅ Créer `backend/src/services/product_price_service.rs`
2. ✅ Modifier `backend/src/routes/delivery_routes.rs` pour utiliser `ProductPriceService`
3. ✅ Modifier `frontend/src/components/delivery/OrderDeliveryModal.tsx` pour utiliser `getRealPrice`
4. ✅ Modifier `mobile/src/components/delivery/OrderDeliveryModal.tsx` pour utiliser `getRealPrice`
5. ✅ Améliorer l'affichage des prix avec badges de promotion
6. ✅ Tester avec des produits en promotion

## ⚠️ Points d'attention

- Les promotions doivent avoir des dates de validité
- Le système doit gérer les promotions expirées
- L'affichage doit montrer clairement le prix original et le prix promotionnel
- Le backend doit toujours utiliser le prix réel pour les calculs financiers

