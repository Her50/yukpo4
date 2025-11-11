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
use sqlx::Row;
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
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
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
            .and_then(|row| row.try_get::<String, _>("display_name").ok())
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
            .and_then(|row| row.try_get::<String, _>("titre").ok())
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
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
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
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
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
pub async fn get_service_stats(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    log::info!(
        "[InteractionController] 📊 Récupération stats pour service {}",
        service_id
    );

    // Récupérer toutes les interactions du service
    let interactions = get_interactions(state.mongo_history.clone(), service_id, None, None)
        .await
        .unwrap_or_default();

    // Récupérer tous les avis du service
    let reviews = get_reviews(state.mongo_history.clone(), service_id, None)
        .await
        .unwrap_or_default();

    // Calculer les statistiques
    let views = interactions
        .iter()
        .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("view"))
        .count();
    let contacts = interactions
        .iter()
        .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("contact"))
        .count();
    let messages = interactions
        .iter()
        .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("message"))
        .count();
    let shares = interactions
        .iter()
        .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("share"))
        .count();
    let likes = interactions
        .iter()
        .filter(|i| i.get("type").and_then(|v| v.as_str()) == Some("like"))
        .count();

    // Calculer la note moyenne
    let total_reviews = reviews.len();
    let total_rating: i32 = reviews
        .iter()
        .filter_map(|r| r.get("rating").and_then(|v| v.as_i64()).map(|v| v as i32))
        .sum();
    let average_rating = if total_reviews > 0 {
        total_rating as f64 / total_reviews as f64
    } else {
        0.0
    };

    Json(json!({
        "views": views,
        "contacts": contacts,
        "messages": messages,
        "shares": shares,
        "likes": likes,
        "average_rating": average_rating,
        "total_ratings": total_reviews
    }))
}

// ? compl?ter avec la logique m?tier
