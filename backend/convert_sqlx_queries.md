# Script de conversion sqlx::query! vers sqlx::query

## Fichiers à convertir

1. `backend/src/routes/delivery_routes.rs` - 2 requêtes product_orders
2. `backend/src/services/delivery_service.rs` - 2 requêtes product_orders  
3. `backend/src/services/order_preparation_service.rs` - ~10 requêtes product_orders/order_cancellations
4. `backend/src/services/product_availability_service.rs` - 2 requêtes preparation_time_minutes/is_immediately_available
5. `backend/src/services/product_enrichment_service.rs` - 1 requête is_immediately_available
6. `backend/src/services/product_stock_service.rs` - ~15 requêtes product_stock_locations/stock_reservations
7. `backend/src/services/courier_verification_service.rs` - ~8 requêtes courier_verification_codes
8. `backend/src/services/dynamic_preparation_time_service.rs` - ~3 requêtes category_preparation_stats/product_orders
9. `backend/src/services/provider_analytics_service.rs` - ~6 requêtes product_orders/order_cancellations/product_cancellation_stats
10. `backend/src/services/similar_products_service.rs` - 2 requêtes is_immediately_available + 1 erreur SQL
11. `backend/src/tasks/order_timeout_monitor.rs` - 3 requêtes product_orders/order_cancellations
12. `backend/src/tasks/stats_recalculation.rs` - ~4 requêtes product_orders/order_cancellations/product_cancellation_stats

## Pattern de conversion

### Avant (sqlx::query!)
```rust
let result = sqlx::query!(
    "SELECT field1, field2 FROM table WHERE id = $1",
    id
)
.fetch_one(&pool)
.await?;
```

### Après (sqlx::query)
```rust
use sqlx::Row;

let result = sqlx::query(
    "SELECT field1, field2 FROM table WHERE id = $1"
)
.bind(id)
.map(|row: sqlx::postgres::PgRow| {
    // Extraire les valeurs manuellement
    (row.get::<Type1, _>("field1"), row.get::<Type2, _>("field2"))
})
.fetch_one(&pool)
.await?;
```


