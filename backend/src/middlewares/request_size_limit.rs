// src/middlewares/request_size_limit.rs
use axum::{body::Body, http::Request, middleware::Next, response::Response};
use http::{HeaderValue, StatusCode};
use serde_json::json;

// ✅ CORRECTION: Limite augmentée à 200 MB pour permettre les payloads complexes avec médias base64
// Note: Cette limite est en plus de la limite Axum DefaultBodyLimit qui doit être configurée sur la route
const DEFAULT_MAX_SIZE: usize = 200_000_000; // 200 MB (cohérent avec frontend et nginx)

pub async fn request_size_limit(req: Request<Body>, next: Next) -> Result<Response, Response> {
    // Vérifier la taille du body si disponible
    if let Some(len) = req.headers().get("content-length") {
        if let Ok(len_str) = len.to_str() {
            if let Ok(len) = len_str.parse::<usize>() {
                if len > DEFAULT_MAX_SIZE {
                    let size_mb = len as f64 / 1_000_000.0;
                    let max_mb = DEFAULT_MAX_SIZE as f64 / 1_000_000.0;
                    log::warn!(
                        "[request_size_limit] ❌ Taille de requête dépassée: {} bytes ({:.2} MB) > {} bytes ({:.2} MB)",
                        len, size_mb, DEFAULT_MAX_SIZE, max_mb
                    );
                    log::warn!(
                        "[request_size_limit] 💡 Vérifiez que DefaultBodyLimit est configuré sur la route (min: {} MB)",
                        size_mb.ceil() as usize
                    );
                    
                    // ✅ Retourner une réponse JSON au lieu d'un simple StatusCode
                    let error_response = json!({
                        "error": "Payload Too Large",
                        "message": format!(
                            "La taille de la requête ({:.2} MB) dépasse la limite autorisée ({} MB). Veuillez réduire la taille des fichiers ou compresser les images.",
                            size_mb, max_mb
                        ),
                        "size_mb": size_mb,
                        "max_size_mb": max_mb,
                        "status": 413
                    });
                    
                    let response = Response::builder()
                        .status(StatusCode::PAYLOAD_TOO_LARGE)
                        .header("content-type", HeaderValue::from_static("application/json"))
                        .body(Body::from(serde_json::to_string(&error_response).unwrap_or_default()))
                        .unwrap();
                    
                    return Err(response);
                }
                log::debug!(
                    "[request_size_limit] ✅ Taille requête acceptée: {} bytes ({:.2} MB)",
                    len,
                    len as f64 / 1_000_000.0
                );
            }
        }
    } else {
        // Si pas de Content-Length, on laisse passer mais on log un debug (pas un warning)
        // C'est normal pour les requêtes GET et certaines requêtes POST avec chunked encoding
        let method = req.method();
        if method == http::Method::GET {
            // Pas de log pour les GET (normal qu'ils n'aient pas Content-Length)
        } else {
            // Pour les autres méthodes, log en debug seulement
            log::debug!(
                "[request_size_limit] Pas de header Content-Length pour {} - impossible de vérifier la taille avant traitement",
                method
            );
        }
    }
    Ok(next.run(req).await)
}
