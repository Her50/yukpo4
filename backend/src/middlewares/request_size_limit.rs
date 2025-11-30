// src/middlewares/request_size_limit.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::StatusCode;

// ✅ CORRECTION: Limite augmentée à 200 MB pour permettre les payloads complexes avec médias base64
// Note: Cette limite est en plus de la limite Axum DefaultBodyLimit qui doit être configurée sur la route
const DEFAULT_MAX_SIZE: usize = 200_000_000; // 200 MB (cohérent avec frontend et nginx)

pub async fn request_size_limit(req: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    // Vérifier la taille du body si disponible
    if let Some(len) = req.headers().get("content-length") {
        if let Ok(len_str) = len.to_str() {
            if let Ok(len) = len_str.parse::<usize>() {
                if len > DEFAULT_MAX_SIZE {
                    log::warn!(
                        "[request_size_limit] ❌ Taille de requête dépassée: {} bytes ({:.2} MB) > {} bytes ({:.2} MB)",
                        len,
                        len as f64 / 1_000_000.0,
                        DEFAULT_MAX_SIZE,
                        DEFAULT_MAX_SIZE as f64 / 1_000_000.0
                    );
                    log::warn!(
                        "[request_size_limit] 💡 Vérifiez que DefaultBodyLimit est configuré sur la route (min: {} MB)",
                        (len as f64 / 1_000_000.0).ceil() as usize
                    );
                    return Err(StatusCode::PAYLOAD_TOO_LARGE);
                }
                log::debug!(
                    "[request_size_limit] ✅ Taille requête acceptée: {} bytes ({:.2} MB)",
                    len,
                    len as f64 / 1_000_000.0
                );
            }
        }
    } else {
        // Si pas de Content-Length, on laisse passer mais on log un avertissement
        log::debug!(
            "[request_size_limit] ⚠️ Pas de header Content-Length - impossible de vérifier la taille avant traitement"
        );
    }
    Ok(next.run(req).await)
}
