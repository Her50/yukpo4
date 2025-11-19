use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::{
    core::types::AppResult,
    services::{
        delivery_service::get_delivery_metrics_snapshot,
        pipeline_health_service::compute_pipeline_health,
        preview_monitoring::PreviewMonitoring,
        video_generation_service::get_video_latency_snapshot,
    },
    state::AppState,
};

pub async fn pipeline_metrics(State(state): State<Arc<AppState>>) -> AppResult<Response> {
    let health = compute_pipeline_health(state).await?;
    let latency = get_video_latency_snapshot();

    let status_value = match health.status.as_str() {
        "ok" => 0,
        "degraded" => 1,
        "critical" => 2,
        _ => 3,
    };

    let mut metrics = String::new();
    metrics
        .push_str("# HELP pipeline_status Status du pipeline vidéo (0=ok,1=degraded,2=critical)\n");
    metrics.push_str("# TYPE pipeline_status gauge\n");
    metrics.push_str(&format!("pipeline_status {}\n", status_value));

    metrics.push_str("# HELP video_jobs_queued Jobs en file d'attente\n");
    metrics.push_str("# TYPE video_jobs_queued gauge\n");
    metrics.push_str(&format!("video_jobs_queued {}\n", health.job_queue.queued));

    metrics.push_str("# HELP video_jobs_running Jobs en cours\n");
    metrics.push_str("# TYPE video_jobs_running gauge\n");
    metrics.push_str(&format!(
        "video_jobs_running {}\n",
        health.job_queue.running
    ));

    metrics.push_str("# HELP video_jobs_completed_last_24h Jobs complétés sur 24h\n");
    metrics.push_str("# TYPE video_jobs_completed_last_24h gauge\n");
    metrics.push_str(&format!(
        "video_jobs_completed_last_24h {}\n",
        health.job_queue.completed_last_24h
    ));

    metrics.push_str("# HELP video_jobs_failed_last_24h Jobs échoués sur 24h\n");
    metrics.push_str("# TYPE video_jobs_failed_last_24h gauge\n");
    metrics.push_str(&format!(
        "video_jobs_failed_last_24h {}\n",
        health.job_queue.failed_last_24h
    ));

    metrics.push_str("# HELP video_jobs_stale_total Jobs en attente >30 minutes\n");
    metrics.push_str("# TYPE video_jobs_stale_total gauge\n");
    metrics.push_str(&format!(
        "video_jobs_stale_total {}\n",
        health.job_queue.stale_jobs.len()
    ));

    metrics.push_str("# HELP pipeline_component_ready Disponibilité des composants critiques\n");
    metrics.push_str("# TYPE pipeline_component_ready gauge\n");
    metrics.push_str(&format!(
        "pipeline_component_ready{{component=\"remotion_renderer\"}} {}\n",
        if health.components.remotion_renderer_ready {
            1
        } else {
            0
        }
    ));
    metrics.push_str(&format!(
        "pipeline_component_ready{{component=\"audio_mastering\"}} {}\n",
        if health.components.audio_mastering_ready {
            1
        } else {
            0
        }
    ));

    if let Some(overview) = health.analytics_overview {
        metrics.push_str("# HELP video_generated_last_days Vidéos générées sur l'horizon\n");
        metrics.push_str("# TYPE video_generated_last_days gauge\n");
        metrics.push_str(&format!(
            "video_generated_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.videos_generated
        ));

        metrics.push_str("# HELP video_total_views_last_days Vues totales sur l'horizon\n");
        metrics.push_str("# TYPE video_total_views_last_days gauge\n");
        metrics.push_str(&format!(
            "video_total_views_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.total_views
        ));

        metrics.push_str("# HELP video_total_shares_last_days Partages totaux sur l'horizon\n");
        metrics.push_str("# TYPE video_total_shares_last_days gauge\n");
        metrics.push_str(&format!(
            "video_total_shares_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.total_shares
        ));

        metrics.push_str("# HELP video_average_quality_score Score qualité moyen\n");
        metrics.push_str("# TYPE video_average_quality_score gauge\n");
        metrics.push_str(&format!(
            "video_average_quality_score{{days=\"{}\"}} {:.2}\n",
            overview.horizon_days, overview.average_quality_score
        ));
    }

    // Latence globale de génération vidéo (moyenne approximative).
    if latency.count > 0 {
        let avg_ms = latency.total_ms as f64 / latency.count as f64;
        metrics.push_str("# HELP video_generation_duration_ms_avg Durée moyenne de génération vidéo (approximation, toutes étapes confondues)\n");
        metrics.push_str("# TYPE video_generation_duration_ms_avg gauge\n");
        metrics.push_str(&format!(
            "video_generation_duration_ms_avg {:.2}\n",
            avg_ms
        ));
    }

    Ok((
        StatusCode::OK,
        [("Content-Type", "text/plain; version=0.0.4")],
        metrics,
    )
        .into_response())
}

pub async fn preview_metrics() -> AppResult<Response> {
    let body = PreviewMonitoring::render_prometheus();
    Ok((
        StatusCode::OK,
        [("Content-Type", "text/plain; version=0.0.4")],
        body,
    )
        .into_response())
}

/// Endpoint agrégé `/metrics` pour Prometheus qui expose:
/// - les métriques de pipeline vidéo
/// - les métriques de preview studio
/// - un sous-ensemble des métriques delivery (compteurs wallet + dropoff)
pub async fn global_metrics(State(state): State<Arc<AppState>>) -> AppResult<Response> {
    let health = compute_pipeline_health(state).await?;
    let preview_body = PreviewMonitoring::render_prometheus();
    let delivery_snapshot = get_delivery_metrics_snapshot();
    let latency = get_video_latency_snapshot();

    let status_value = match health.status.as_str() {
        "ok" => 0,
        "degraded" => 1,
        "critical" => 2,
        _ => 3,
    };

    let mut metrics = String::new();

    // 🔹 Bloc pipeline vidéo (identique à /internal/metrics/pipeline)
    metrics.push_str(
        "# HELP pipeline_status Status du pipeline vidéo (0=ok,1=degraded,2=critical)\n",
    );
    metrics.push_str("# TYPE pipeline_status gauge\n");
    metrics.push_str(&format!("pipeline_status {}\n", status_value));

    metrics.push_str("# HELP video_jobs_queued Jobs en file d'attente\n");
    metrics.push_str("# TYPE video_jobs_queued gauge\n");
    metrics.push_str(&format!(
        "video_jobs_queued {}\n",
        health.job_queue.queued
    ));

    metrics.push_str("# HELP video_jobs_running Jobs en cours\n");
    metrics.push_str("# TYPE video_jobs_running gauge\n");
    metrics.push_str(&format!(
        "video_jobs_running {}\n",
        health.job_queue.running
    ));

    metrics.push_str("# HELP video_jobs_completed_last_24h Jobs complétés sur 24h\n");
    metrics.push_str("# TYPE video_jobs_completed_last_24h gauge\n");
    metrics.push_str(&format!(
        "video_jobs_completed_last_24h {}\n",
        health.job_queue.completed_last_24h
    ));

    metrics.push_str("# HELP video_jobs_failed_last_24h Jobs échoués sur 24h\n");
    metrics.push_str("# TYPE video_jobs_failed_last_24h gauge\n");
    metrics.push_str(&format!(
        "video_jobs_failed_last_24h {}\n",
        health.job_queue.failed_last_24h
    ));

    metrics.push_str("# HELP video_jobs_stale_total Jobs en attente >30 minutes\n");
    metrics.push_str("# TYPE video_jobs_stale_total gauge\n");
    metrics.push_str(&format!(
        "video_jobs_stale_total {}\n",
        health.job_queue.stale_jobs.len()
    ));

    metrics.push_str("# HELP pipeline_component_ready Disponibilité des composants critiques\n");
    metrics.push_str("# TYPE pipeline_component_ready gauge\n");
    metrics.push_str(&format!(
        "pipeline_component_ready{{component=\"remotion_renderer\"}} {}\n",
        if health.components.remotion_renderer_ready {
            1
        } else {
            0
        }
    ));
    metrics.push_str(&format!(
        "pipeline_component_ready{{component=\"audio_mastering\"}} {}\n",
        if health.components.audio_mastering_ready {
            1
        } else {
            0
        }
    ));

    if let Some(overview) = health.analytics_overview {
        metrics.push_str("# HELP video_generated_last_days Vidéos générées sur l'horizon\n");
        metrics.push_str("# TYPE video_generated_last_days gauge\n");
        metrics.push_str(&format!(
            "video_generated_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.videos_generated
        ));

        metrics.push_str("# HELP video_total_views_last_days Vues totales sur l'horizon\n");
        metrics.push_str("# TYPE video_total_views_last_days gauge\n");
        metrics.push_str(&format!(
            "video_total_views_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.total_views
        ));

        metrics.push_str("# HELP video_total_shares_last_days Partages totaux sur l'horizon\n");
        metrics.push_str("# TYPE video_total_shares_last_days gauge\n");
        metrics.push_str(&format!(
            "video_total_shares_last_days{{days=\"{}\"}} {}\n",
            overview.horizon_days, overview.total_shares
        ));

        metrics.push_str("# HELP video_average_quality_score Score qualité moyen\n");
        metrics.push_str("# TYPE video_average_quality_score gauge\n");
        metrics.push_str(&format!(
            "video_average_quality_score{{days=\"{}\"}} {:.2}\n",
            overview.horizon_days, overview.average_quality_score
        ));
    }

    // 🔹 Bloc preview studio (replay direct de PreviewMonitoring)
    metrics.push_str("\n# === Preview Studio Metrics ===\n");
    metrics.push_str(&preview_body);
    metrics.push('\n');

    // 🔹 Sous-ensemble des métriques delivery (compteurs globaux)
    metrics.push_str(
        "# HELP delivery_recipient_dropoff_events_total Total des mises à jour de dropoff destinataire.\n",
    );
    metrics.push_str("# TYPE delivery_recipient_dropoff_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_recipient_dropoff_events_total {}\n",
        delivery_snapshot.recipient_dropoff_events
    ));

    metrics.push_str(
        "# HELP delivery_wallet_debit_events_total Total des débits de portefeuille liés aux livraisons.\n",
    );
    metrics.push_str("# TYPE delivery_wallet_debit_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_debit_events_total {}\n",
        delivery_snapshot.wallet_debit_events
    ));

    metrics.push_str(
        "# HELP delivery_wallet_refund_events_total Total des remboursements de portefeuille liés aux livraisons.\n",
    );
    metrics.push_str("# TYPE delivery_wallet_refund_events_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_refund_events_total {}\n",
        delivery_snapshot.wallet_refund_events
    ));

    metrics.push_str(
        "# HELP delivery_wallet_debit_amount_cents_total Montant cumulé des débits de portefeuille en centimes.\n",
    );
    metrics.push_str("# TYPE delivery_wallet_debit_amount_cents_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_debit_amount_cents_total {}\n",
        delivery_snapshot.total_wallet_debit_cents
    ));

    metrics.push_str(
        "# HELP delivery_wallet_refund_amount_cents_total Montant cumulé des remboursements de portefeuille en centimes.\n",
    );
    metrics.push_str("# TYPE delivery_wallet_refund_amount_cents_total counter\n");
    metrics.push_str(&format!(
        "delivery_wallet_refund_amount_cents_total {}\n",
        delivery_snapshot.total_wallet_refund_cents
    ));

    // 🔹 Latence moyenne de génération vidéo (toutes étapes confondues)
    if latency.count > 0 {
        let avg_ms = latency.total_ms as f64 / latency.count as f64;
        metrics.push_str("# HELP video_generation_duration_ms_avg Durée moyenne de génération vidéo (approximation, toutes étapes confondues)\n");
        metrics.push_str("# TYPE video_generation_duration_ms_avg gauge\n");
        metrics.push_str(&format!(
            "video_generation_duration_ms_avg {:.2}\n",
            avg_ms
        ));
    }

    // 🔹 Métriques additionnelles (Promotions, Carrousels, Chat, Navigation)
    metrics.push_str("\n# === Additional Metrics ===\n");
    metrics.push_str(&crate::metrics::format_all_additional_metrics());

    Ok((
        StatusCode::OK,
        [("Content-Type", "text/plain; version=0.0.4")],
        metrics,
    )
        .into_response())
}
