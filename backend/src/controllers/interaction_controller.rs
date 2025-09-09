// Contr?leur pour les interactions (messages, audio, appels, avis, notes)
// Squelette de routes ? compl?ter
use axum::{Json, extract::{Path, State}};
use crate::state::AppState;
use crate::core::types::{AppError, AppResult};
use crate::models::interaction_model::{Interaction, Review};
// use crate::services::interaction_service::{save_interaction, get_interactions, save_review, get_reviews};
// use crate::services::scoring_service::{compute_score, get_score, ServiceScore};
// use crate::services::alert_service::create_alert;
// use crate::services::sharing_service::generate_share_link;
use serde::Deserialize;
use std::sync::Arc;
use serde_json::Value;

#[derive(Deserialize)]
pub struct MessagePayload {
    pub user_id: i32,
    pub content: String,
}

#[derive(Deserialize)]
pub struct ReviewPayload {
    pub user_id: i32,
    pub rating: i32,
    pub comment: Option<String>,
}

#[derive(Deserialize)]
pub struct AudioPayload {
    pub user_id: i32,
    pub audio_url: String,
}

#[derive(Deserialize)]
pub struct CallPayload {
    pub user_id: i32,
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
    Json(payload): Json<MessagePayload>,
) -> Json<Value> {
    let interaction = save_interaction(
        state.mongo_history.clone(),
        payload.user_id, 
        service_id, 
        "message", 
        Some(&payload.content)
    ).await.expect("save_interaction");
    
    // Cr?e une alerte pour le prestataire
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
        .fetch_one(&state.pg).await.expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, payload.user_id, "message").await;
    Json(interaction)
}

/// POST /services/:id/review ? poste un avis/note
pub async fn post_review(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ReviewPayload>,
) -> Json<Value> {
    let review = save_review(
        state.mongo_history.clone(),
        payload.user_id, 
        service_id, 
        payload.rating, 
        payload.comment.as_deref()
    ).await.expect("save_review");
    
    // Recalcule le score du service
    let _ = compute_score(state.mongo_history.clone(), service_id).await;
    Json(review)
}

/// POST /services/:id/audio ? envoie un message audio
pub async fn post_audio(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AudioPayload>,
) -> Json<Value> {
    let interaction = save_interaction(
        state.mongo_history.clone(),
        payload.user_id, 
        service_id, 
        "audio", 
        Some(&payload.audio_url)
    ).await.expect("save_interaction");
    
    // Cr?e une alerte pour le prestataire
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
        .fetch_one(&state.pg).await.expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, payload.user_id, "audio").await;
    Json(interaction)
}

/// POST /services/:id/call ? log d'un appel
pub async fn post_call(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CallPayload>,
) -> Json<Value> {
    let interaction = save_interaction(
        state.mongo_history.clone(),
        payload.user_id, 
        service_id, 
        "call", 
        Some(&payload.call_info)
    ).await.expect("save_interaction");
    
    // Cr?e une alerte pour le prestataire
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
        .fetch_one(&state.pg).await.expect("service");
    let _ = create_alert(&state.pg, service.user_id, service_id, payload.user_id, "call").await;
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
    let interactions = get_interactions(
        state.mongo_history.clone(),
        service_id,
        None,
        None
    ).await.expect("get_interactions");
    Json(interactions)
}

/// GET /services/:id/reviews ? liste des avis
pub async fn get_service_reviews(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<Vec<Value>> {
    let reviews = get_reviews(
        state.mongo_history.clone(),
        service_id,
        None
    ).await.expect("get_reviews");
    Json(reviews)
}

/// GET /services/:id/score ? score intelligent
pub async fn get_service_score(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
) -> Json<ServiceScore> {
    let _ = compute_score(state.mongo_history.clone(), service_id).await;
    let score = get_score(state.mongo_history.clone(), service_id).await.expect("get_score");
    Json(score)
}

// ? compl?ter avec la logique m?tier
