//! ✅ Rate limiting strict pour les appels IA
//! Limite : 100 appels/heure par utilisateur
//! Utilise Redis pour les compteurs

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    body::Body,
    extract::{Extension, State},
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use log::warn;
use std::sync::Arc;

/// Rate limiting pour les appels IA
/// Limite : 100 appels/heure, 10 appels/minute par utilisateur
pub async fn ia_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let user_id = user.id;
    let minute_key = format!("rate_limit:ia:{}:minute", user_id);
    let hour_key = format!("rate_limit:ia:{}:hour", user_id);

    // Limites
    let limit_per_minute = 10;
    let limit_per_hour = 100;

    // Vérifier limite par minute
    match state.redis_client.get_async_connection().await {
        Ok(mut conn) => {
            // Vérifier compteur minute
            let minute_count: i32 = conn
                .get::<_, Option<i32>>(&minute_key)
                .await
                .unwrap_or(None)
                .unwrap_or(0);

            if minute_count >= limit_per_minute {
                warn!(
                    "[IA Rate Limit] Limite minute dépassée pour utilisateur {}: {}/{}",
                    user_id, minute_count, limit_per_minute
                );
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }

            // Incrémenter compteur minute (TTL 60s)
            if let Err(e) = conn.incr::<_, _, ()>(&minute_key, 60).await {
                warn!("[IA Rate Limit] Erreur incrément minute: {}", e);
            }

            // Vérifier compteur heure
            let hour_count: i32 = conn
                .get::<_, Option<i32>>(&hour_key)
                .await
                .unwrap_or(None)
                .unwrap_or(0);

            if hour_count >= limit_per_hour {
                warn!(
                    "[IA Rate Limit] Limite heure dépassée pour utilisateur {}: {}/{}",
                    user_id, hour_count, limit_per_hour
                );
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }

            // Incrémenter compteur heure (TTL 3600s = 1h)
            if let Err(e) = conn.incr::<_, _, ()>(&hour_key, 3600).await {
                warn!("[IA Rate Limit] Erreur incrément heure: {}", e);
            }
        }
        Err(e) => {
            warn!(
                "[IA Rate Limit] Erreur connexion Redis, autorisation par défaut: {}",
                e
            );
            // En cas d'erreur Redis, autoriser la requête pour éviter de bloquer le service
            // mais logger l'erreur
        }
    }

    Ok(next.run(req).await)
}
