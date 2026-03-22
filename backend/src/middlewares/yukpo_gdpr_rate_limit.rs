//! Rate limiting dédié aux actions sensibles RGPD (export JSON, suppression données).
//! Limites plus strictes que `ia_rate_limit` : limite l’abus et le scraping.

use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use log::warn;
use redis::AsyncCommands;
use std::sync::Arc;

const PATH_EXPORT: &str = "/ai/sessions/gdpr/export-my-data";
const PATH_DELETE: &str = "/ai/sessions/gdpr/delete-my-data";

/// Export : 5 / heure, 2 / minute par utilisateur.
const EXPORT_PER_MINUTE: i32 = 2;
const EXPORT_PER_HOUR: i32 = 5;

/// Suppression : 10 / jour, 2 / heure (évite boucles / erreurs répétées).
const DELETE_PER_HOUR: i32 = 2;
const DELETE_PER_DAY: i32 = 10;

/// À placer **après** `jwt_auth` et **avant** `ia_rate_limit` (ordre des `.layer`).

pub async fn yukpo_gdpr_sensitive_rate_limit(
    State(state): State<Arc<AppState>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = req.uri().path();
    if path != PATH_EXPORT && path != PATH_DELETE {
        return Ok(next.run(req).await);
    }

    let user_id = match req.extensions().get::<AuthenticatedUser>() {
        Some(u) => u.id,
        None => {
            return Ok(next.run(req).await);
        }
    };

    match state.redis_client.get_multiplexed_async_connection().await {
        Ok(mut conn) => {
            if path == PATH_EXPORT {
                let min_k = format!("yukpo_gdpr:export:{user_id}:minute");
                let hour_k = format!("yukpo_gdpr:export:{user_id}:hour");
                let minute_count: i32 =
                    conn.get::<_, Option<i32>>(&min_k).await.unwrap_or(None).unwrap_or(0);
                if minute_count >= EXPORT_PER_MINUTE {
                    warn!(
                        "[Yukpo GDPR rate] export minute dépassée user={} {}/{}",
                        user_id, minute_count, EXPORT_PER_MINUTE
                    );
                    return Err(StatusCode::TOO_MANY_REQUESTS);
                }
                let hour_count: i32 =
                    conn.get::<_, Option<i32>>(&hour_k).await.unwrap_or(None).unwrap_or(0);
                if hour_count >= EXPORT_PER_HOUR {
                    warn!(
                        "[Yukpo GDPR rate] export heure dépassée user={} {}/{}",
                        user_id, hour_count, EXPORT_PER_HOUR
                    );
                    return Err(StatusCode::TOO_MANY_REQUESTS);
                }
                if let Err(e) = conn.incr::<_, _, i32>(&min_k, 1).await {
                    warn!("[Yukpo GDPR rate] incr minute: {}", e);
                } else {
                    let _: Result<(), _> = conn.expire(&min_k, 60).await;
                }
                if let Err(e) = conn.incr::<_, _, i32>(&hour_k, 1).await {
                    warn!("[Yukpo GDPR rate] incr hour export: {}", e);
                } else {
                    let _: Result<(), _> = conn.expire(&hour_k, 3600).await;
                }
            } else {
                let hour_k = format!("yukpo_gdpr:delete:{user_id}:hour");
                let day_k = format!("yukpo_gdpr:delete:{user_id}:day");
                let hour_count: i32 =
                    conn.get::<_, Option<i32>>(&hour_k).await.unwrap_or(None).unwrap_or(0);
                if hour_count >= DELETE_PER_HOUR {
                    warn!(
                        "[Yukpo GDPR rate] delete heure dépassée user={} {}/{}",
                        user_id, hour_count, DELETE_PER_HOUR
                    );
                    return Err(StatusCode::TOO_MANY_REQUESTS);
                }
                let day_count: i32 =
                    conn.get::<_, Option<i32>>(&day_k).await.unwrap_or(None).unwrap_or(0);
                if day_count >= DELETE_PER_DAY {
                    warn!(
                        "[Yukpo GDPR rate] delete jour dépassée user={} {}/{}",
                        user_id, day_count, DELETE_PER_DAY
                    );
                    return Err(StatusCode::TOO_MANY_REQUESTS);
                }
                if let Err(e) = conn.incr::<_, _, i32>(&hour_k, 1).await {
                    warn!("[Yukpo GDPR rate] incr hour delete: {}", e);
                } else {
                    let _: Result<(), _> = conn.expire(&hour_k, 3600).await;
                }
                if let Err(e) = conn.incr::<_, _, i32>(&day_k, 1).await {
                    warn!("[Yukpo GDPR rate] incr day delete: {}", e);
                } else {
                    let _: Result<(), _> = conn.expire(&day_k, 86_400).await;
                }
            }
        }
        Err(e) => {
            warn!(
                "[Yukpo GDPR rate] Redis indisponible — on laisse passer : {}",
                e
            );
        }
    }

    Ok(next.run(req).await)
}
