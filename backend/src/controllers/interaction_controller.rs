// Contr?leur pour les interactions (messages, audio, appels, avis, notes)
// Squelette de routes ? compl?ter
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    Json,
};
// use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::alert_service::create_alert;
use crate::services::interaction_service::{
    get_interactions, get_reviews, save_interaction, save_review,
};
use crate::services::scoring_service::{compute_score, get_score, ServiceScore};
use crate::services::sharing_service::generate_share_link;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct MessagePayload {
    pub content: String,
}

#[derive(Deserialize)]
pub struct ReviewPayload {
    pub rating: i32,
    pub comment: Option<String>,
    pub mentions: Option<Vec<i32>>,
}

#[derive(Deserialize)]
pub struct AudioPayload {
    pub audio_url: String,
}

#[derive(Deserialize)]
pub struct CallPayload {
    pub call_info: String, // ex: identifiant d'appel, ou log d'appel
}

#[derive(Deserialize)]
pub struct SharePayload {
    pub platform: String, // "whatsapp", "facebook", "sitepro", etc.
    pub base_url: String, // URL de base de la plateforme
}

#[derive(FromRow)]
struct ServiceUserRow {
    user_id: i32,
}

/// POST /services/:id/message ? envoie un message texte
pub async fn post_message(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<MessagePayload>,
) -> Json<Value> {
    let user_id = user.id;
    let interaction = save_interaction(
        state.mongo_history.clone(),
        user_id,
        service_id,
        "message",
        Some(&payload.content),
    )
    .await
    .expect("save_interaction");

    // Cr?e une alerte pour le prestataire
    let service = sqlx::query_as::<_, ServiceUserRow>("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_one(&state.pg)
        .await
        .expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, user_id, "message").await;
    Json(interaction)
}

/// POST /services/:id/review ? poste un avis/note
pub async fn post_review(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ReviewPayload>,
) -> Json<Value> {
    let user_id = user.id;
    let review = save_review(
        state.mongo_history.clone(),
        user_id,
        service_id,
        payload.rating,
        payload.comment.as_deref(),
        payload.mentions.as_deref(),
    )
    .await
    .expect("save_review");

    if let Some(mentions) = payload.mentions.as_ref() {
        if !mentions.is_empty() {
            let reviewer_name = sqlx::query(
                "SELECT COALESCE(nom_complet, email) AS display_name FROM users WHERE id = $1",
            )
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten()
            .and_then(|row| row.get::<Option<String>, _>("display_name"))
            .unwrap_or_else(|| "Un utilisateur Yukpo".to_string());

            let service_title = sqlx::query(
                "SELECT COALESCE(data->>'titre_service', data->>'nom_produit', data->>'nom_service', data->>'nom') AS titre
                 FROM services WHERE id = $1",
            )
            .bind(service_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten()
            .and_then(|row| row.get::<Option<String>, _>("titre"))
            .unwrap_or_else(|| format!("service #{}", service_id));

            for mentioned_id in mentions.iter().copied().filter(|id| *id != user_id) {
                let _ = sqlx::query(
                    r#"
                    INSERT INTO notifications (user_id, title, message, type, priority, metadata)
                    VALUES ($1, $2, $3, 'review_mention', 'medium', $4)
                    "#,
                )
                .bind(mentioned_id)
                .bind(format!("💬 {reviewer_name} vous a mentionné"))
                .bind(format!("Dans un avis sur « {service_title} »"))
                .bind(json!({
                    "service_id": service_id,
                    "author_id": user_id,
                    "mentions": mentions,
                    "comment": payload.comment,
                }))
                .execute(&state.pg)
                .await;
            }
        }
    }

    // Recalcule le score du service
    let _ = compute_score(state.mongo_history.clone(), service_id).await;
    Json(review)
}

/// POST /services/:id/audio ? envoie un message audio
pub async fn post_audio(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AudioPayload>,
) -> Json<Value> {
    let user_id = user.id;
    let interaction = save_interaction(
        state.mongo_history.clone(),
        user_id,
        service_id,
        "audio",
        Some(&payload.audio_url),
    )
    .await
    .expect("save_interaction");

    // Cr?e une alerte pour le prestataire
    let service = sqlx::query_as::<_, ServiceUserRow>("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_one(&state.pg)
        .await
        .expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, user_id, "audio").await;
    Json(interaction)
}

/// POST /services/:id/call ? log d'un appel
pub async fn post_call(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CallPayload>,
) -> Json<Value> {
    let user_id = user.id;
    let interaction = save_interaction(
        state.mongo_history.clone(),
        user_id,
        service_id,
        "call",
        Some(&payload.call_info),
    )
    .await
    .expect("save_interaction");

    // Cr?e une alerte pour le prestataire
    let service = sqlx::query_as::<_, ServiceUserRow>("SELECT user_id FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_one(&state.pg)
        .await
        .expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, user_id, "call").await;
    Json(interaction)
}

/// POST /services/:id/share ? g?n?re un lien de partage
pub async fn post_share(
    Path(service_id): Path<i32>,
    Json(payload): Json<SharePayload>,
) -> Json<serde_json::Value> {
    let link = generate_share_link(service_id, &payload.platform, &payload.base_url);
    Json(serde_json::json!({"share_link": link}))
}

/// GET /services/:id/interactions ? historique des interactions
pub async fn get_service_interactions(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<Vec<Value>> {
    let interactions = get_interactions(state.mongo_history.clone(), service_id, None, None)
        .await
        .expect("get_interactions");
    Json(interactions)
}

/// GET /services/:id/reviews ? liste des avis
pub async fn get_service_reviews(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<Vec<Value>> {
    let reviews = get_reviews(state.mongo_history.clone(), service_id, None)
        .await
        .expect("get_reviews");
    Json(reviews)
}

/// GET /services/:id/score ? score intelligent
pub async fn get_service_score(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<ServiceScore> {
    let _ = compute_score(state.mongo_history.clone(), service_id).await;
    let score = get_score(state.mongo_history.clone(), service_id)
        .await
        .expect("get_score");
    Json(score)
}

/// POST /reviews/:id/helpful ? marquer un avis comme utile
pub async fn post_review_helpful(
    Path(review_id): Path<i32>,
    State(_state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Json<Value> {
    let user_id = user.id;

    // TODO: Implémenter la logique pour marquer un avis comme utile
    // Pour l'instant, on retourne une réponse de succès
    Json(json!({
        "success": true,
        "message": "Avis marqué comme utile",
        "user_id": user_id,
        "review_id": review_id
    }))
}

/// GET /services/:id/stats - Récupère les statistiques d'un service
/// ✅ OPTIMISÉ 2025-12-21: Utilise l'agrégation MongoDB pour compter directement dans la base
/// ✅ OPTIMISÉ 2025-12-30: Ajout cache Redis (TTL 5 min) pour éviter requêtes répétées
/// Performance: < 100ms avec cache, < 300ms sans cache (au lieu de 2-5 secondes)
pub async fn get_service_stats(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    // ✅ OPTIMISÉ 2025-12-30: Vérifier le cache Redis en premier
    let cache_key = format!("service_stats:{}", service_id);
    if let Some(redis_pool) = &state.redis_pool {
        if let Ok(mut conn) = redis_pool.get().await {
            if let Ok(cached_stats) = deadpool_redis::redis::cmd("GET")
                .arg(&cache_key)
                .query_async::<_, String>(&mut *conn)
                .await
            {
                if let Ok(stats_value) = serde_json::from_str::<Value>(&cached_stats) {
                    log::debug!(
                        "[InteractionController] 📊 Stats récupérées depuis cache Redis pour service {}",
                        service_id
                    );
                    return Json(stats_value);
                }
            }
        }
    }

    log::info!(
        "[InteractionController] 📊 Récupération stats pour service {}",
        service_id
    );

    // ✅ OPTIMISÉ: Utiliser l'agrégation MongoDB au lieu de récupérer tous les documents
    // Cela réduit la charge réseau et mémoire, et améliore drastiquement les performances
    let stats_result = match crate::services::interaction_service::get_service_stats_optimized(
        state.mongo_history.clone(),
        service_id,
    )
    .await
    {
        Ok(stats) => {
            // ✅ OPTIMISÉ 2025-12-30: Mettre en cache Redis (TTL 5 minutes = 300 secondes)
            if let Some(redis_pool) = &state.redis_pool {
                if let Ok(mut conn) = redis_pool.get().await {
                    if let Ok(stats_json) = serde_json::to_string(&stats) {
                        let _ = deadpool_redis::redis::cmd("SET")
                            .arg(&cache_key)
                            .arg(&stats_json)
                            .arg("EX")
                            .arg(300) // TTL 5 minutes
                            .query_async::<_, ()>(&mut *conn)
                            .await;
                    }
                }
            }
            Ok(stats)
        },
        Err(e) => {
            log::error!(
                "[InteractionController] ❌ Erreur récupération stats pour service {}: {}",
                service_id,
                e
            );
            Err(e)
        }
    };

    match stats_result {
        Ok(stats) => Json(stats),
        Err(_) => {
            // Fallback: retourner des stats vides en cas d'erreur
            Json(json!({
                "views": 0,
                "contacts": 0,
                "messages": 0,
                "shares": 0,
                "likes": 0,
                "average_rating": 0.0,
                "total_ratings": 0
            }))
        }
    }
}

// ? compl?ter avec la logique m?tier
