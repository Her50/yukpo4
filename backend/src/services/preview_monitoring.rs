use std::collections::HashMap;
use std::sync::Mutex;

use lazy_static::lazy_static;
use log::info;

const LATENCY_BUCKETS_MS: [u64; 6] = [500, 1_000, 2_000, 5_000, 10_000, 30_000];

#[derive(Default)]
struct TemplateStats {
    count: u64,
    total_latency_ms: u128,
}

#[derive(Default)]
struct PreviewMonitoringState {
    total_requests: u64,
    total_latency_ms: u128,
    max_latency_ms: u64,
    template_usage: HashMap<String, TemplateStats>,
    warning_counts: HashMap<String, u64>,
    latency_buckets: [u64; LATENCY_BUCKETS_MS.len() + 1],
}

lazy_static! {
    static ref PREVIEW_MONITORING_STATE: Mutex<PreviewMonitoringState> =
        Mutex::new(PreviewMonitoringState::default());
}

pub struct PreviewMonitoring;

impl PreviewMonitoring {
    pub fn record_request(template: Option<&str>, latency_ms: u64, warnings: &[String]) {
        let template_label = template.unwrap_or("unknown").to_string();
        let normalized_warnings = normalize_warnings(warnings);

        if let Ok(mut state) = PREVIEW_MONITORING_STATE.lock() {
            state.total_requests = state.total_requests.saturating_add(1);
            state.total_latency_ms = state.total_latency_ms.saturating_add(latency_ms as u128);
            state.max_latency_ms = state.max_latency_ms.max(latency_ms);

            let entry = state.template_usage.entry(template_label.clone()).or_default();
            entry.count = entry.count.saturating_add(1);
            entry.total_latency_ms = entry.total_latency_ms.saturating_add(latency_ms as u128);

            if normalized_warnings.is_empty() {
                *state.warning_counts.entry("none".into()).or_insert(0) += 1;
            } else {
                for warning in normalized_warnings {
                    *state.warning_counts.entry(warning).or_insert(0) += 1;
                }
            }

            let mut bucket_recorded = false;
            for (idx, upper) in LATENCY_BUCKETS_MS.iter().enumerate() {
                if latency_ms <= *upper {
                    state.latency_buckets[idx] += 1;
                    bucket_recorded = true;
                    break;
                }
            }
            if !bucket_recorded {
                // +Inf bucket
                if let Some(last) = state.latency_buckets.last_mut() {
                    *last += 1;
                }
            }
        }

        info!(
            "[PreviewMonitoring] template={} latency_ms={} warnings={:?}",
            template_label, latency_ms, warnings
        );
    }

    pub fn render_prometheus() -> String {
        let state = PREVIEW_MONITORING_STATE.lock().expect("preview monitoring lock poisoned");
        let mut metrics = String::new();

        metrics.push_str("# HELP studio_preview_requests_total Nombre total d'aperçus générés\n");
        metrics.push_str("# TYPE studio_preview_requests_total counter\n");
        metrics.push_str(&format!(
            "studio_preview_requests_total {}\n",
            state.total_requests
        ));

        metrics.push_str("# HELP studio_preview_latency_ms_sum Somme des latences d'aperçu (ms)\n");
        metrics.push_str("# TYPE studio_preview_latency_ms_sum counter\n");
        metrics.push_str(&format!(
            "studio_preview_latency_ms_sum {}\n",
            state.total_latency_ms
        ));

        metrics.push_str("# HELP studio_preview_latency_ms_max Latence maximale observée (ms)\n");
        metrics.push_str("# TYPE studio_preview_latency_ms_max gauge\n");
        metrics.push_str(&format!(
            "studio_preview_latency_ms_max {}\n",
            state.max_latency_ms
        ));

        metrics.push_str("# HELP studio_preview_latency_bucket Répartition des latences\n");
        metrics.push_str("# TYPE studio_preview_latency_bucket histogram\n");
        let mut cumulative = 0u64;
        for (idx, upper) in LATENCY_BUCKETS_MS.iter().enumerate() {
            cumulative += state.latency_buckets[idx];
            metrics.push_str(&format!(
                "studio_preview_latency_bucket{{le=\"{:.1}\"}} {}\n",
                (*upper as f64) / 1000.0,
                cumulative
            ));
        }
        if let Some(last) = state.latency_buckets.last() {
            cumulative += *last;
        }
        metrics.push_str(&format!(
            "studio_preview_latency_bucket{{le=\"+Inf\"}} {}\n",
            cumulative
        ));

        metrics.push_str(
            "# HELP studio_preview_template_requests_total Aperçus par template recommandé\n",
        );
        metrics.push_str("# TYPE studio_preview_template_requests_total counter\n");
        for (template, stats) in state.template_usage.iter() {
            metrics.push_str(&format!(
                "studio_preview_template_requests_total{{template=\"{}\"}} {}\n",
                sanitize_label(template),
                stats.count
            ));
            if stats.count > 0 {
                let average = (stats.total_latency_ms as f64) / (stats.count as f64);
                metrics.push_str(&format!(
                    "studio_preview_template_latency_average_ms{{template=\"{}\"}} {:.2}\n",
                    sanitize_label(template),
                    average
                ));
            }
        }

        metrics.push_str("# HELP studio_preview_warnings_total Nombre de warnings enregistrés\n");
        metrics.push_str("# TYPE studio_preview_warnings_total counter\n");
        for (warning, count) in state.warning_counts.iter() {
            metrics.push_str(&format!(
                "studio_preview_warnings_total{{warning=\"{}\"}} {}\n",
                warning, count
            ));
        }

        metrics
    }
}

fn normalize_warnings(warnings: &[String]) -> Vec<String> {
    warnings
        .iter()
        .map(|warning| {
            let trimmed = warning.trim();
            if trimmed.contains(':') {
                trimmed.split(':').next().unwrap_or(trimmed).trim().to_lowercase()
            } else {
                trimmed.to_lowercase()
            }
        })
        .map(|label| sanitize_label(&label))
        .collect()
}

fn sanitize_label(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else if ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}
