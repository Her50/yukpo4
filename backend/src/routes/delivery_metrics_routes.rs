use axum::{
    extract::State,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::{
    services::delivery_service::get_delivery_metrics_snapshot,
    state::AppState,
    websocket::delivery_tracking::get_delivery_ws_metrics_snapshot,
};

pub fn delivery_metrics_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route("/metrics/delivery", get(delivery_metrics_handler))
        .with_state(state)
}

async fn delivery_metrics_handler(State(state): State<Arc<AppState>>) -> Response {
    let snapshot = get_delivery_metrics_snapshot();
    let ws_metrics = get_delivery_ws_metrics_snapshot();

    // Profondeur de la file de matching (queued + searching).
    let queue_depth: i64 = match sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::bigint
        FROM delivery_matching_queue
        WHERE status IN ('queued', 'searching')
        "#
    )
    .fetch_one(&state.pg)
    .await
    {
        Ok(count) => count,
        Err(err) => {
            log::warn!(
                "[DeliveryMetrics] Impossible de récupérer la profondeur de file: {err:?}"
            );
            0
        }
    };

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
            "delivery_wallet_refund_amount_cents_total {}\n",
            "# HELP delivery_matching_started_total Nombre total de tentatives de matching auto.\n",
            "# TYPE delivery_matching_started_total counter\n",
            "delivery_matching_started_total {}\n",
            "# HELP delivery_matching_success_total Nombre total de matchings réussis.\n",
            "# TYPE delivery_matching_success_total counter\n",
            "delivery_matching_success_total {}\n",
            "# HELP delivery_matching_failed_total Nombre total de matchings échoués.\n",
            "# TYPE delivery_matching_failed_total counter\n",
            "delivery_matching_failed_total {}\n",
            "# HELP delivery_matching_attempt_duration_ms_avg Durée moyenne d'une tentative de matching (ms).\n",
            "# TYPE delivery_matching_attempt_duration_ms_avg gauge\n",
            "delivery_matching_attempt_duration_ms_avg {:.2}\n",
            "# HELP delivery_matching_queue_depth Profondeur actuelle de la file de matching (queued + searching).\n",
            "# TYPE delivery_matching_queue_depth gauge\n",
            "delivery_matching_queue_depth {}\n",
            "# HELP delivery_ws_connections_current Nombre de connexions WebSocket delivery actives.\n",
            "# TYPE delivery_ws_connections_current gauge\n",
            "delivery_ws_connections_current {}\n",
            "# HELP delivery_ws_messages_sent_total Nombre total de messages WebSocket delivery envoyés.\n",
            "# TYPE delivery_ws_messages_sent_total counter\n",
            "delivery_ws_messages_sent_total {}\n",
            "# HELP delivery_ws_errors_total Nombre total d'erreurs WebSocket delivery.\n",
            "# TYPE delivery_ws_errors_total counter\n",
            "delivery_ws_errors_total {}\n",
        ),
        snapshot.recipient_dropoff_events,
        snapshot.wallet_debit_events,
        snapshot.wallet_refund_events,
        snapshot.total_wallet_debit_cents,
        snapshot.total_wallet_refund_cents,
        snapshot.matching_started_total,
        snapshot.matching_success_total,
        snapshot.matching_failed_total,
        if snapshot.matching_latency_count > 0 {
            snapshot.matching_latency_total_ms as f64 / snapshot.matching_latency_count as f64
        } else {
            0.0
        },
        queue_depth,
        ws_metrics.connections_current,
        ws_metrics.messages_sent_total,
        ws_metrics.errors_total,
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
