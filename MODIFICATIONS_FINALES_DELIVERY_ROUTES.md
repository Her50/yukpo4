# Modifications finales dans delivery_routes.rs

## 1. Ajouter `conversation_id` et `client_user_id` dans `EstimateCostsPayload`

Trouver la struct `EstimateCostsPayload` (vers la ligne 900-1000) et ajouter :

```rust
#[derive(Deserialize)]
struct EstimateCostsPayload {
    service_id: i32,
    product_index: Option<i32>,
    dropoff: Option<LocationInput>,
    conversation_id: Option<i32>,  // ✅ À AJOUTER
    client_user_id: Option<i32>,   // ✅ À AJOUTER
}
```

## 2. Modifier les appels à `ProductPriceService::get_real_product_price_cents()`

### Dans `estimate_delivery_costs` (vers la ligne 1200-1300)

Trouver :
```rust
ProductPriceService::get_real_product_price_cents(
    &state.pg,
    payload.service_id,
    product,
    Some(product_index),
)
.await
```

Remplacer par :
```rust
ProductPriceService::get_real_product_price_cents(
    &state.pg,
    payload.service_id,
    product,
    Some(product_index),
    payload.conversation_id,  // ✅ À AJOUTER
    payload.client_user_id.or(Some(user.id)),  // ✅ À AJOUTER
)
.await
```

### Dans `create_client_order` (vers la ligne 790-800)

Trouver :
```rust
ProductPriceService::get_real_product_price_cents(
    &state.pg,
    payload.service_id,
    product,
    Some(product_index),
)
.await
```

Remplacer par :
```rust
ProductPriceService::get_real_product_price_cents(
    &state.pg,
    payload.service_id,
    product,
    Some(product_index),
    payload.conversation_id,  // ✅ À AJOUTER
    Some(user.id),  // ✅ À AJOUTER (client_user_id = user.id dans create_client_order)
)
.await
```

## 3. Modifier `delivery_service.rs` pour stocker les suggestions

Dans `check_proximity_and_suggest_status_update()`, après chaque envoi de `ProximitySuggestion`, ajouter :

```rust
// Stocker la suggestion dans la table
if let Some(courier_id) = summary.courier.as_ref().and_then(|c| c.user_id) {
    let _ = sqlx::query!(
        r#"
        INSERT INTO delivery_proximity_suggestions (
            delivery_id, suggested_status, location_type, distance_meters,
            auto_confirm_after_seconds, courier_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        input.delivery_id,
        suggested_status.to_string(),  // "arrival_pickup" ou "arrival_destination"
        location_type,  // "pickup" ou "dropoff"
        distance_meters,
        auto_confirm_after_seconds,  // Some(30)
        courier_id
    )
    .execute(&self.repository.pool())
    .await;
}
```

À ajouter après chaque `broadcast_event` avec `ProximitySuggestion` (2 endroits : pickup et dropoff).

