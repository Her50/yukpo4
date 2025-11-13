use axum::{
    extract::State,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::{services::delivery_service::get_delivery_metrics_snapshot, state::AppState};

pub fn delivery_metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/metrics/delivery", get(delivery_metrics_handler))
        .with_state(state)
}

async fn delivery_metrics_handler(State(_state): State<Arc<AppState>>) -> Response {
    let snapshot = get_delivery_metrics_snapshot();

    let body = format!(
        concat!(
            "# HELP delivery_recipient_dropoff_events_total Total des mises à jour de dropoff destinataire.\n",
            "# TYPE delivery_recipient_dropoff_events_total counter\n",
            "delivery_recipient_dropoff_events_total {}\n",
            "# HELP delivery_wallet_debit_events_total Total des débits de portefeuille liés aux livraisons.\n",
            "# TYPE delivery_wallet_debit_events_total counter\n",
            "delivery_wallet_debit_events_total {}\n",
            "# HELP delivery_wallet_refund_events_total Total des remboursements de portefeuille liés aux livraisons.\n",
            "# TYPE delivery_wallet_refund_events_total counter\n",
            "delivery_wallet_refund_events_total {}\n",
            "# HELP delivery_wallet_debit_amount_cents_total Montant cumulé des débits de portefeuille en centimes.\n",
            "# TYPE delivery_wallet_debit_amount_cents_total counter\n",
            "delivery_wallet_debit_amount_cents_total {}\n",
            "# HELP delivery_wallet_refund_amount_cents_total Montant cumulé des remboursements de portefeuille en centimes.\n",
            "# TYPE delivery_wallet_refund_amount_cents_total counter\n",
            "delivery_wallet_refund_amount_cents_total {}\n"
        ),
        snapshot.recipient_dropoff_events,
        snapshot.wallet_debit_events,
        snapshot.wallet_refund_events,
        snapshot.total_wallet_debit_cents,
        snapshot.total_wallet_refund_cents,
    );

    Response::builder()
        .status(StatusCode::OK)
        .header(
            CONTENT_TYPE,
            HeaderValue::from_static("text/plain; version=0.0.4"),
        )
        .body(body.into())
        .unwrap()
}

