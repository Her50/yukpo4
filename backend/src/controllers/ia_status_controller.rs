// ?? src/controllers/ia_status_controller.rs

use axum::{
    extract::State,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::core::types::{AppResult};
use crate::state::AppState;

/// ?? Analyse comportementale d?un utilisateur
#[derive(Deserialize)]
pub struct BehaviorInput {
    pub ip: String,
    pub path: String,
    pub freq: u32,
}

#[derive(Serialize)]
pub struct BehaviorOutput {
    pub score: u32,
    pub suspicious: bool,
}

/// ?? Pr?diction IA (avec moteur IA inject? via AppState)
#[derive(Deserialize)]
pub struct IAPrompt {
    pub texte: String,
}

pub async fn predict_ia(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IAPrompt>,
) -> AppResult<Json<String>> {
    info!("[predict_ia] Called for texte length={}", payload.texte.len());
    match state.ia.predict(&payload.texte).await {
        Ok((_, result, _tokens)) => {
            info!("[predict_ia] Success");
            Ok(Json(result))
        }
        Err(e) => {
            error!("[predict_ia] Error: {e:?}");
            return Err(e.into());
        }
    }
}

// Tout ce qui utilise Multipart ou enrichir_input_context est comment? temporairement
// /// ?? Enrichissement dynamique du contexte IA (via Multipart)
// pub async fn enrichir_contexte_ia(
//     multipart: Multipart,
// ) -> AppResult<Json<serde_json::Value>> {
//     info!("[enrichir_contexte_ia] Called");
//     if let Err(e) = enrichir_input_context(multipart).await {
//         return Err(AppError::BadRequest(format!("Erreur enrichissement contexte: {}", e)));
//     }
//     Ok(Json(json!({ "success": true })))
// }

/// ?? Statistiques d?usage des moteurs IA (GET /admin/ia/status)
pub async fn get_ia_status(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<IAStats>> {
    info!("[get_ia_status] Called");
    let stats = state.ia_stats.lock().await.clone();
    Ok(Json(stats))
}

/// ?? Structure partag?e pour statistiques IA
#[derive(Default, Serialize, Clone, Deserialize, Debug)]
pub struct IAStats {
    pub openai_hits: u32,
    pub mistral_hits: u32,
    pub local_hits: u32,
    pub cache_hits: u32,
}

// pub async fn analyze_behavior(
//     Json(payload): Json<BehaviorInput>,
// ) -> AppResult<Json<BehaviorOutput>> {
//     let score = compute_behavior_score(&payload.ip, &payload.path, payload.freq);
//     let suspicious = is_suspicious(score, &payload.ip, &payload.path);
//     Ok(Json(BehaviorOutput { score, suspicious }))
// }
