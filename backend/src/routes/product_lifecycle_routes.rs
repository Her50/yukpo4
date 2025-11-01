use std::sync::Arc;
use axum::Router;
use crate::state::AppState;

pub fn product_lifecycle_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // ❌ TODO: Implémenter ces routes dans le futur
        // .route("/products/inactive", get(product_lifecycle_controller::get_inactive_products))
        // .route("/products/{service_id}/status", get(product_lifecycle_controller::get_products_status))
        // .route("/products/reactivate-multiple", post(product_lifecycle_controller::reactivate_multiple))
        // .route("/products/reactivation-cost", get(product_lifecycle_controller::get_reactivation_cost))
        
        // ✅ Routes actuellement implémentées
        // Note: deactivate_product et reactivate_product sont utilisés via router_yukpo.rs
        
        .with_state(state)
}

