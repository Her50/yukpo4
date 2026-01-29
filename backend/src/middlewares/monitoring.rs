// src/middlewares/monitoring.rs
use axum::body::Body;
use axum::{http::Request, middleware::Next, response::Response};
use log::{info, warn};
use std::time::Instant;

/// Seuil pour requêtes lentes (en millisecondes)
/// ✅ AUGMENTÉ: 2 secondes au lieu de 1 seconde pour réduire les warnings non critiques
const SLOW_REQUEST_THRESHOLD_MS: u64 = 2000;
/// Seuil pour requêtes très lentes (en millisecondes) - seulement celles-ci génèrent un warning
/// ✅ AUGMENTÉ: 10 secondes au lieu de 5 secondes pour les endpoints avec images (upload + traitement IA)
const VERY_SLOW_REQUEST_THRESHOLD_MS: u64 = 10000;

pub async fn monitoring(req: Request<Body>, next: Next) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();
    let start = Instant::now();

    let response = next.run(req).await;
    let elapsed = start.elapsed();
    let elapsed_ms = elapsed.as_millis();
    let status = response.status();

    // Log normal pour toutes les requêtes (seulement si > 500ms pour réduire le bruit)
    if elapsed_ms >= 500 {
        info!(
            "[Monitoring] {} {} -> {} ({} ms)",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log info pour requêtes modérément lentes (1s-2s) - pas de warning
    if elapsed_ms >= 1000 && elapsed_ms < SLOW_REQUEST_THRESHOLD_MS as u128 {
        info!(
            "⏱️ [ModerateRequest] {} {} -> {} ({} ms) - Requête modérément lente",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log warning seulement pour requêtes vraiment lentes (2s-5s)
    if elapsed_ms >= SLOW_REQUEST_THRESHOLD_MS as u128
        && elapsed_ms < VERY_SLOW_REQUEST_THRESHOLD_MS as u128
    {
        warn!(
            "🐌 [SlowRequest] {} {} -> {} ({} ms) - Requête lente détectée",
            method,
            path,
            status.as_u16(),
            elapsed_ms
        );
    }

    // Log error pour requêtes très lentes (>10s)
    // ✅ AUGMENTÉ: Seuil augmenté à 10s pour les endpoints avec images (upload + traitement IA)
    if elapsed_ms >= VERY_SLOW_REQUEST_THRESHOLD_MS as u128 {
        // Vérifier si c'est un endpoint avec images pour ajuster le message
        let is_image_endpoint = path.contains("/ia/creation-service")
            || path.contains("/services/create")
            || path.contains("/products");

        // ✅ CORRIGÉ 2025-12-28: Recherche directe peut prendre jusqu'à 15s (requêtes SQL complexes)
        let is_search_endpoint = path.contains("/search/direct") || path.contains("/search/");

        if is_image_endpoint && elapsed_ms < 15000 {
            // Pour les endpoints avec images, 7-15s est acceptable (traitement IA + upload)
            log::warn!(
                "⏱️ [SlowImageRequest] {} {} -> {} ({} ms) - Requête avec images (acceptable pour traitement IA)",
                method,
                path,
                status.as_u16(),
                elapsed_ms
            );
        } else if is_search_endpoint && elapsed_ms < 15000 {
            // Pour les endpoints de recherche, 10-15s est acceptable (requêtes SQL complexes avec GPS, cache, etc.)
            log::warn!(
                "⏱️ [SlowSearchRequest] {} {} -> {} ({} ms) - Requête de recherche (acceptable pour recherches complexes avec GPS)",
                method,
                path,
                status.as_u16(),
                elapsed_ms
            );
        } else {
            log::error!(
                "🚨 [VerySlowRequest] {} {} -> {} ({} ms) - Requête très lente, investigation nécessaire",
                method,
                path,
                status.as_u16(),
                elapsed_ms
            );
        }
    }

    response
}
