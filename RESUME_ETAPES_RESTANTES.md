# ✅ Résumé : Étapes restantes

## 🎯 Backend complété

1. ✅ Table `delivery_proximity_suggestions` créée
2. ✅ Table `negotiated_prices` créée
3. ✅ Service `negotiated_price_service.rs` créé
4. ✅ Routes `negotiated_price_routes.rs` créées
5. ✅ `product_price_service.rs` modifié pour prix négociés
6. ✅ Routes ajoutées dans `lib.rs`

## ⏳ Modifications restantes dans delivery_routes.rs

### 1. Ajouter `conversation_id` et `client_user_id` dans les structs

```rust
#[derive(Deserialize)]
struct EstimateCostsPayload {
    service_id: i32,
    product_index: Option<i32>,
    dropoff: Option<LocationInput>,
    conversation_id: Option<i32>,  // ✅ À AJOUTER
    client_user_id: Option<i32>,   // ✅ À AJOUTER
}

#[derive(Deserialize)]
struct ClientOrderPayload {
    service_id: i32,
    product_index: Option<i32>,
    dropoff: Option<LocationPayload>,
    notes: Option<String>,
    metadata: Option<Value>,
    conversation_id: Option<i32>,  // ✅ À AJOUTER
}
```

### 2. Modifier les appels à `ProductPriceService::get_real_product_price_cents()`

Dans `estimate_delivery_costs` et `create_client_order`, passer les nouveaux paramètres :

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

### 3. Modifier `delivery_service.rs` pour stocker les suggestions

Dans `check_proximity_and_suggest_status_update()`, après l'envoi de `ProximitySuggestion`, ajouter :

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
        suggested_status.to_string(),
        location_type,
        distance_meters,
        auto_confirm_after_seconds,
        courier_id
    )
    .execute(&self.repository.pool())
    .await;
}
```

## ⏳ Frontend/Mobile

### 1. ChatModal - Interface prix négociés
- Bouton "Proposer un prix" pour prestataire
- Modal pour saisir le prix négocié
- Affichage de l'offre en attente pour client
- Boutons "Accepter" / "Rejeter"

### 2. OrderDeliveryModal
- Récupérer l'offre en attente au chargement
- Afficher le prix négocié si disponible
- Passer `conversation_id` et `client_user_id` dans les appels API

