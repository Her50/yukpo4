use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use std::sync::Arc;

use crate::state::AppState;

pub fn exchange_rate_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/rates", get(get_exchange_rates))
        .route("/convert", get(convert_currency))
}

/// GET /api/exchange-rates/rates
/// Returns all exchange rates (base: XAF) for mobile display
async fn get_exchange_rates(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let service = crate::services::exchange_rate_service::ExchangeRateService::new();

    // Try to load from DB cache first (warm start)
    service.load_from_db(&state.pg).await;

    let rates = service.get_all_rates().await;

    // Persist fresh rates to DB in background
    service.persist_to_db(&state.pg).await;

    Json(serde_json::json!({
        "success": true,
        "base": rates.base,
        "rates": rates.rates,
        "updated_at": rates.updated_at.to_rfc3339(),
        "source": rates.source,
    }))
}

/// GET /api/exchange-rates/convert?amount=5000&from=KES&to=XAF
async fn convert_currency(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let amount: f64 = params.get("amount").and_then(|a| a.parse().ok()).unwrap_or(0.0);
    let from = params.get("from").cloned().unwrap_or_else(|| "XAF".to_string());
    let to = params.get("to").cloned().unwrap_or_else(|| "XAF".to_string());

    if amount <= 0.0 {
        return Json(serde_json::json!({
            "success": false,
            "error": "amount must be > 0"
        }));
    }

    let service = crate::services::exchange_rate_service::ExchangeRateService::new();
    service.load_from_db(&state.pg).await;

    let from_upper = from.to_uppercase();
    let to_upper = to.to_uppercase();

    // Convert: from -> XAF -> to
    let xaf_amount = service.convert_to_xaf(amount, &from_upper).await;

    let result = if to_upper == "XAF" {
        xaf_amount as f64
    } else {
        let to_rate = service.rate_to_xaf(&to_upper).await;
        if to_rate > 0.0 {
            xaf_amount as f64 / to_rate
        } else {
            return Json(serde_json::json!({
                "success": false,
                "error": format!("Unknown target currency: {}", to_upper)
            }));
        }
    };

    Json(serde_json::json!({
        "success": true,
        "from": from_upper,
        "to": to_upper,
        "amount": amount,
        "converted": result,
        "xaf_equivalent": xaf_amount,
    }))
}
