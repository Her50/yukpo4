# Rapport de vérification : Prise en compte des promotions dans le système de livraison

## 🔍 Résultats de l'analyse

### ✅ Système de promotions existant

Le système dispose d'un service `global_promo_service` qui gère les promotions globales avec :

1. **Tables de base de données** :
   - `global_promo_events` : Événements promotionnels (dates, thème, statut)
   - `global_promo_entries` : Entrées de promotion par service/produit
   - `global_promo_products` : Snapshots de produits en promotion

2. **Champs de promotion** :
   - `promo_price_cfa` : Prix promotionnel fixe (Option<f64>)
   - `discount_percentage` : Pourcentage de réduction (Option<f64>)
   - Dates de validité via `event.starts_at` et `event.ends_at`
   - Statut : `draft`, `pending_review`, `approved`, `published`, `ended`

3. **Fonctionnalités existantes** :
   - `list_active_catalog()` : Liste les produits en promotion actifs
   - `upsert_entry()` : Crée/met à jour une entrée de promotion
   - Gestion des événements promotionnels avec dates

### ❌ Problème identifié

**Le système de livraison N'UTILISE PAS le service de promotions** :

1. **Backend** (`delivery_routes.rs`) :
   - `estimate_delivery_costs` : Utilise directement `product.price`
   - `create_client_order` : Utilise directement `product.price`
   - Aucune requête vers `global_promo_entries` ou `global_promo_events`

2. **Frontend/Mobile** (`OrderDeliveryModal.tsx`) :
   - `loadAvailableProducts` : Utilise directement `product.price`
   - `loadCosts` : Calcule avec `product.price`
   - Aucune vérification des promotions actives

### 📋 Solution nécessaire

Il faut créer une fonction qui :
1. Vérifie si un produit/service a une promotion active
2. Calcule le prix réel en tenant compte de :
   - `promo_price_cfa` (si défini)
   - `discount_percentage` (si défini, appliqué au prix de base)
   - Dates de validité de l'événement promotionnel
   - Statut de l'entrée (`approved` ou `published`)

## 🎯 Plan d'implémentation

### 1. Créer une fonction utilitaire dans `global_promo_service.rs`

```rust
impl GlobalPromoService {
    /// Récupère le prix réel d'un produit en tenant compte des promotions actives
    pub async fn get_real_product_price(
        pool: &PgPool,
        service_id: i32,
        product_index: Option<i32>,
        base_price: f64,
    ) -> AppResult<f64> {
        let now = Utc::now();
        
        // Chercher une promotion active pour ce service
        let promo_entry = sqlx::query_as::<_, GlobalPromoEntry>(
            r#"
            SELECT e.*
            FROM global_promo_entries e
            JOIN global_promo_events ev ON ev.id = e.event_id
            WHERE e.service_id = $1
                AND e.status IN ('approved', 'published')
                AND ev.status IN ('scheduled', 'live')
                AND ev.starts_at <= $2
                AND ev.ends_at >= $2
            ORDER BY ev.starts_at DESC
            LIMIT 1
            "#,
        )
        .bind(service_id)
        .bind(now)
        .fetch_optional(pool)
        .await?;

        if let Some(entry) = promo_entry {
            // Priorité 1 : Prix promotionnel fixe
            if let Some(promo_price) = entry.promo_price_cfa {
                return Ok(promo_price);
            }
            
            // Priorité 2 : Pourcentage de réduction
            if let Some(discount_pct) = entry.discount_percentage {
                let discounted = base_price * (1.0 - discount_pct / 100.0);
                return Ok(discounted);
            }
        }

        // Pas de promotion active : retourner le prix de base
        Ok(base_price)
    }

    /// Récupère le prix réel en centimes
    pub async fn get_real_product_price_cents(
        pool: &PgPool,
        service_id: i32,
        product_index: Option<i32>,
        base_price_cents: i64,
    ) -> AppResult<i64> {
        let base_price = (base_price_cents as f64) / 100.0;
        let real_price = Self::get_real_product_price(pool, service_id, product_index, base_price).await?;
        Ok((real_price * 100.0) as i64)
    }
}
```

### 2. Modifier `delivery_routes.rs`

```rust
use crate::services::global_promo_service::GlobalPromoService;

// Dans estimate_delivery_costs
let base_product_price_cents = if let Some(product_index) = payload.product_index {
    // Récupérer le prix de base
    let base_price = product.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let base_price_cents = (base_price * 100.0) as i64;
    
    // ✅ Récupérer le prix réel avec promotions
    GlobalPromoService::get_real_product_price_cents(
        &state.pg,
        payload.service_id,
        Some(product_index),
        base_price_cents,
    )
    .await
    .unwrap_or(base_price_cents) // Fallback si erreur
} else {
    0
};

// Dans create_client_order (même logique)
```

### 3. Modifier le frontend/mobile

Créer un endpoint API pour récupérer les prix avec promotions, ou modifier `loadCosts` pour utiliser les données de promotion si disponibles dans la réponse du service.

## 📝 Fichiers à modifier

1. ✅ `backend/src/services/global_promo_service.rs` : Ajouter `get_real_product_price()`
2. ✅ `backend/src/routes/delivery_routes.rs` : Utiliser `GlobalPromoService::get_real_product_price_cents()`
3. ✅ `frontend/src/components/delivery/OrderDeliveryModal.tsx` : Afficher les promotions
4. ✅ `mobile/src/components/delivery/OrderDeliveryModal.tsx` : Afficher les promotions

## ⚠️ Points d'attention

- Les promotions sont liées au `service_id`, pas au `product_index` individuel
- Il faut vérifier les dates de validité (`starts_at`, `ends_at`)
- Il faut vérifier le statut (`approved` ou `published`)
- Priorité : `promo_price_cfa` > `discount_percentage` > prix de base

