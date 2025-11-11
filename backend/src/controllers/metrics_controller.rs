use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::{
    core::types::AppResult, services::pipeline_health_service::compute_pipeline_health,
    state::AppState,
};

pub async fn pipeline_metrics(State(state): State<Arc<AppState>>) -> AppResult<Response> {
    let health = compute_pipeline_health(state).await?;

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

    Ok((
        StatusCode::OK,
        [("Content-Type", "text/plain; version=0.0.4")],
        metrics,
    )
        .into_response())
}
