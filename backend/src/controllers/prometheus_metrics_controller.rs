//! ✅ Phase 3 - Endpoint Prometheus centralisé
//! Agrège toutes les métriques au format Prometheus standard

use axum::{
    extract::State,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
};
use std::sync::Arc;

use crate::{
    middlewares::rate_limit::get_rate_limit_metrics,
    services::{
        delivery_service::{get_cache_matching_metrics, get_delivery_metrics_snapshot},
        prometheus_metrics::render_metrics,
    },
    state::AppState,
    websocket::delivery_tracking::get_delivery_ws_metrics_snapshot,
};

/// ✅ Phase 3: Endpoint Prometheus centralisé
/// Retourne toutes les métriques au format Prometheus standard
pub async fn prometheus_metrics_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Response, StatusCode> {
    let mut metrics = String::new();

    // 1. Métriques Prometheus enregistrées (vidéo, etc.)
    metrics.push_str(&render_metrics());
    metrics.push_str("\n");

    // 2. Métriques Delivery existantes (format Prometheus)
    let delivery_snapshot = get_delivery_metrics_snapshot();
    let ws_metrics = get_delivery_ws_metrics_snapshot();

    // Profondeur de la file de matching
    let queue_depth: i64 = match sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COUNT(*)::bigint
        FROM delivery_matching_queue
        WHERE status IN ('queued', 'searching')
        "#,
    )
    .fetch_one(&state.pg)
    .await
    {
        Ok(Some(count)) => count,
        Ok(None) => 0,
        Err(_) => 0,
    };

    metrics.push_str("# HELP delivery_recipient_dropoff_events_total Total des mises à jour de dropoff destinataire.\n");
    metrics.push_str("# TYPE delivery_recipient_dropoff_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_recipient_dropoff_events_total {}\n",
        delivery_snapshot.recipient_dropoff_events
    ));

    metrics.push_str("# HELP delivery_wallet_debit_events_total Total des débits de portefeuille liés aux livraisons.\n");
    metrics.push_str("# TYPE delivery_wallet_debit_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_debit_events_total {}\n",
        delivery_snapshot.wallet_debit_events
    ));

    metrics.push_str("# HELP delivery_wallet_refund_events_total Total des remboursements de portefeuille liés aux livraisons.\n");
    metrics.push_str("# TYPE delivery_wallet_refund_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_refund_events_total {}\n",
        delivery_snapshot.wallet_refund_events
    ));

    metrics.push_str(
        "# HELP delivery_matching_started_total Nombre total de tentatives de matching auto.\n",
    );
    metrics.push_str("# TYPE delivery_matching_started_total counter\n");
    metrics.push_str(&format!(
        "delivery_matching_started_total {}\n",
        delivery_snapshot.matching_started_total
    ));

    metrics.push_str("# HELP delivery_matching_success_total Nombre total de matchings réussis.\n");
    metrics.push_str("# TYPE delivery_matching_success_total counter\n");
    metrics.push_str(&format!(
        "delivery_matching_success_total {}\n",
        delivery_snapshot.matching_success_total
    ));

    metrics.push_str("# HELP delivery_matching_failed_total Nombre total de matchings échoués.\n");
    metrics.push_str("# TYPE delivery_matching_failed_total counter\n");
    metrics.push_str(&format!(
        "delivery_matching_failed_total {}\n",
        delivery_snapshot.matching_failed_total
    ));

    metrics.push_str(
        "# HELP delivery_matching_queue_depth Profondeur actuelle de la file de matching.\n",
    );
    metrics.push_str("# TYPE delivery_matching_queue_depth gauge\n");
    metrics.push_str(&format!("delivery_matching_queue_depth {}\n", queue_depth));

    metrics.push_str(
        "# HELP delivery_ws_connections_current Nombre de connexions WebSocket delivery actives.\n",
    );
    metrics.push_str("# TYPE delivery_ws_connections_current gauge\n");
    metrics.push_str(&format!(
        "delivery_ws_connections_current {}\n",
        ws_metrics.connections_current
    ));

    metrics.push_str("# HELP delivery_ws_messages_sent_total Nombre total de messages WebSocket delivery envoyés.\n");
    metrics.push_str("# TYPE delivery_ws_messages_sent_total counter\n");
    metrics.push_str(&format!(
        "delivery_ws_messages_sent_total {}\n",
        ws_metrics.messages_sent_total
    ));

    metrics
        .push_str("# HELP delivery_ws_errors_total Nombre total d'erreurs WebSocket delivery.\n");
    metrics.push_str("# TYPE delivery_ws_errors_total counter\n");
    metrics.push_str(&format!(
        "delivery_ws_errors_total {}\n",
        ws_metrics.errors_total
    ));

    // 3. ✅ Phase 3: Métriques Pool DB
    let pool_size = state.pg.size();
    let pool_idle = state.pg.num_idle();
    let pool_active = pool_size.saturating_sub(pool_idle as u32);

    metrics.push_str("\n# ✅ Phase 1: Pool DB Metrics\n");
    metrics.push_str("# HELP delivery_db_pool_size Total size of database connection pool\n");
    metrics.push_str("# TYPE delivery_db_pool_size gauge\n");
    metrics.push_str(&format!("delivery_db_pool_size {}\n", pool_size));

    metrics.push_str("# HELP delivery_db_pool_idle Number of idle connections in database pool\n");
    metrics.push_str("# TYPE delivery_db_pool_idle gauge\n");
    metrics.push_str(&format!("delivery_db_pool_idle {}\n", pool_idle));

    metrics
        .push_str("# HELP delivery_db_pool_active Number of active connections in database pool\n");
    metrics.push_str("# TYPE delivery_db_pool_active gauge\n");
    metrics.push_str(&format!("delivery_db_pool_active {}\n", pool_active));

    // 4. ✅ Phase 3: Métriques Partitionnement
    let partition_count: i64 = match sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COUNT(*)::bigint
        FROM pg_tables
        WHERE tablename LIKE 'deliveries_%' AND tablename != 'deliveries_archive'
        "#,
    )
    .fetch_one(&state.pg)
    .await
    {
        Ok(Some(count)) => count,
        Ok(None) => 0,
        Err(_) => 0,
    };

    let archive_size: i64 = match sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT COUNT(*)::bigint FROM deliveries_archive
        "#,
    )
    .fetch_one(&state.pg)
    .await
    {
        Ok(Some(count)) => count,
        Ok(None) => 0,
        Err(_) => 0,
    };

    metrics.push_str("\n# ✅ Phase 2: Partitionnement Metrics\n");
    metrics
        .push_str("# HELP delivery_partitions_count Number of partitions for deliveries table\n");
    metrics.push_str("# TYPE delivery_partitions_count gauge\n");
    metrics.push_str(&format!("delivery_partitions_count {}\n", partition_count));

    metrics.push_str("# HELP delivery_archive_size Number of deliveries in archive table\n");
    metrics.push_str("# TYPE delivery_archive_size gauge\n");
    metrics.push_str(&format!("delivery_archive_size {}\n", archive_size));

    // 5. ✅ Phase 3: Métriques Rate Limiting
    let (rate_limit_blocked, rate_limit_blocked_ip, rate_limit_blocked_user) =
        get_rate_limit_metrics();
    metrics.push_str("\n# ✅ Phase 2: Rate Limiting Metrics\n");
    metrics.push_str(
        "# HELP delivery_rate_limit_blocked_total Total requests blocked by rate limiting\n",
    );
    metrics.push_str("# TYPE delivery_rate_limit_blocked_total counter\n");
    metrics.push_str(&format!(
        "delivery_rate_limit_blocked_total {}\n",
        rate_limit_blocked
    ));

    metrics.push_str("# HELP delivery_rate_limit_blocked_by_ip_total Total requests blocked by IP rate limiting\n");
    metrics.push_str("# TYPE delivery_rate_limit_blocked_by_ip_total counter\n");
    metrics.push_str(&format!(
        "delivery_rate_limit_blocked_by_ip_total {}\n",
        rate_limit_blocked_ip
    ));

    metrics.push_str("# HELP delivery_rate_limit_blocked_by_user_total Total requests blocked by user rate limiting\n");
    metrics.push_str("# TYPE delivery_rate_limit_blocked_by_user_total counter\n");
    metrics.push_str(&format!(
        "delivery_rate_limit_blocked_by_user_total {}\n",
        rate_limit_blocked_user
    ));

    // 6. ✅ Phase 3: Métriques Cache
    let (cache_hits, cache_misses) = get_cache_matching_metrics();
    let cache_hit_rate = if cache_hits + cache_misses > 0 {
        cache_hits as f64 / (cache_hits + cache_misses) as f64
    } else {
        0.0
    };

    metrics.push_str("\n# ✅ Phase 1: Cache Metrics\n");
    metrics.push_str(
        "# HELP delivery_cache_matching_hits_total Total cache hits for matching algorithm\n",
    );
    metrics.push_str("# TYPE delivery_cache_matching_hits_total counter\n");
    metrics.push_str(&format!(
        "delivery_cache_matching_hits_total {}\n",
        cache_hits
    ));

    metrics.push_str(
        "# HELP delivery_cache_matching_misses_total Total cache misses for matching algorithm\n",
    );
    metrics.push_str("# TYPE delivery_cache_matching_misses_total counter\n");
    metrics.push_str(&format!(
        "delivery_cache_matching_misses_total {}\n",
        cache_misses
    ));

    metrics.push_str(
        "# HELP delivery_cache_matching_hit_rate Cache hit rate for matching algorithm (0-1)\n",
    );
    metrics.push_str("# TYPE delivery_cache_matching_hit_rate gauge\n");
    metrics.push_str(&format!(
        "delivery_cache_matching_hit_rate {:.4}\n",
        cache_hit_rate
    ));

    Response::builder()
        .status(StatusCode::OK)
        .header(
            CONTENT_TYPE,
            HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
        )
        .body(metrics.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
