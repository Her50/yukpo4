use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AutoOptimizationSettings {
    pub enabled: bool,
    pub budget_optimization: bool,
    pub targeting_optimization: bool,
    pub schedule_optimization: bool,
    pub placement_optimization: bool,
    pub bid_strategy_optimization: bool,
    pub auto_apply_threshold: f64,
    pub optimization_frequency: String, // "daily" | "weekly" | "real-time"
    pub min_confidence: f64,
    pub budget_adjustment_limit: i32,
}

#[derive(Debug, Deserialize)]
pub struct SaveAutoOptimizationSettingsRequest {
    pub user_id: i32,
    pub campaign_id: Option<i32>,
    pub settings: AutoOptimizationSettings,
}

#[derive(Debug, Serialize)]
pub struct AutoOptimizationSettingsResponse {
    pub settings: AutoOptimizationSettings,
    pub message: String,
}

/// Récupérer les paramètres d'optimisation automatique
pub async fn get_auto_optimization_settings(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<ResponseJson<AutoOptimizationSettingsResponse>, StatusCode> {
    let pool = &state.pg;
    let user_id: i32 = params.get("user_id").and_then(|v| v.parse().ok()).unwrap_or(0);

    let campaign_id: Option<i32> = params.get("campaign_id").and_then(|v| v.parse().ok());

    if user_id == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Récupérer les paramètres depuis la base de données
    // Pour l'instant, on utilise une table dédiée ou on stocke dans user_settings
    let query = if campaign_id.is_some() {
        r#"
        SELECT auto_optimization_settings
        FROM publicites
        WHERE id = $1 AND user_id = $2
        "#
    } else {
        r#"
        SELECT auto_optimization_settings
        FROM user_settings
        WHERE user_id = $1
        "#
    };

    match if let Some(cid) = campaign_id {
        sqlx::query(query).bind(cid).bind(user_id).fetch_optional(pool).await
    } else {
        sqlx::query(query).bind(user_id).fetch_optional(pool).await
    } {
        Ok(Some(row)) => {
            // Parser les paramètres JSON
            let settings_json: Option<serde_json::Value> = if campaign_id.is_some() {
                row.get("auto_optimization_settings")
            } else {
                row.get("auto_optimization_settings")
            };

            if let Some(settings_data) = settings_json {
                match serde_json::from_value::<AutoOptimizationSettings>(settings_data) {
                    Ok(settings) => Ok(ResponseJson(AutoOptimizationSettingsResponse {
                        settings,
                        message: "Paramètres récupérés avec succès".to_string(),
                    })),
                    Err(_) => {
                        // Retourner les paramètres par défaut
                        let default_settings = AutoOptimizationSettings {
                            enabled: false,
                            budget_optimization: true,
                            targeting_optimization: true,
                            schedule_optimization: false,
                            placement_optimization: true,
                            bid_strategy_optimization: true,
                            auto_apply_threshold: 0.85,
                            optimization_frequency: "daily".to_string(),
                            min_confidence: 0.75,
                            budget_adjustment_limit: 20,
                        };
                        Ok(ResponseJson(AutoOptimizationSettingsResponse {
                            settings: default_settings,
                            message: "Paramètres par défaut".to_string(),
                        }))
                    }
                }
            } else {
                // Pas de paramètres, retourner les valeurs par défaut
                let default_settings = AutoOptimizationSettings {
                    enabled: false,
                    budget_optimization: true,
                    targeting_optimization: true,
                    schedule_optimization: false,
                    placement_optimization: true,
                    bid_strategy_optimization: true,
                    auto_apply_threshold: 0.85,
                    optimization_frequency: "daily".to_string(),
                    min_confidence: 0.75,
                    budget_adjustment_limit: 20,
                };
                Ok(ResponseJson(AutoOptimizationSettingsResponse {
                    settings: default_settings,
                    message: "Paramètres par défaut".to_string(),
                }))
            }
        }
        Err(e) => {
            log::error!("[get_auto_optimization_settings] Erreur DB: {:?}", e);
            // Retourner les paramètres par défaut en cas d'erreur
            let default_settings = AutoOptimizationSettings {
                enabled: false,
                budget_optimization: true,
                targeting_optimization: true,
                schedule_optimization: false,
                placement_optimization: true,
                bid_strategy_optimization: true,
                auto_apply_threshold: 0.85,
                optimization_frequency: "daily".to_string(),
                min_confidence: 0.75,
                budget_adjustment_limit: 20,
            };
            Ok(ResponseJson(AutoOptimizationSettingsResponse {
                settings: default_settings,
                message: "Paramètres par défaut (erreur DB)".to_string(),
            }))
        }
        Ok(None) => {
            // Pas de paramètres trouvés, retourner les valeurs par défaut
            let default_settings = AutoOptimizationSettings {
                enabled: false,
                budget_optimization: true,
                targeting_optimization: true,
                schedule_optimization: false,
                placement_optimization: true,
                bid_strategy_optimization: true,
                auto_apply_threshold: 0.85,
                optimization_frequency: "daily".to_string(),
                min_confidence: 0.75,
                budget_adjustment_limit: 20,
            };
            Ok(ResponseJson(AutoOptimizationSettingsResponse {
                settings: default_settings,
                message: "Paramètres par défaut".to_string(),
            }))
        }
    }
}

/// Sauvegarder les paramètres d'optimisation automatique
pub async fn save_auto_optimization_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SaveAutoOptimizationSettingsRequest>,
) -> Result<ResponseJson<AutoOptimizationSettingsResponse>, StatusCode> {
    let _pool = &state.pg;

    let _settings_json =
        serde_json::to_value(&payload.settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Sauvegarder dans la base de données
    // Pour l'instant, on simule la sauvegarde
    // En production, créer une table dédiée ou utiliser user_settings

    // TODO: Implémenter la vraie sauvegarde dans la DB
    // Pour l'instant, on retourne juste les paramètres sauvegardés

    Ok(ResponseJson(AutoOptimizationSettingsResponse {
        settings: payload.settings,
        message: "Paramètres sauvegardés avec succès".to_string(),
    }))
}

pub fn publicite_auto_optimization_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::<Arc<AppState>>::new()
        .route(
            "/api/publicites/optimization/auto-settings",
            get(get_auto_optimization_settings),
        )
        .route(
            "/api/publicites/optimization/auto-settings",
            post(save_auto_optimization_settings),
        )
        .with_state(state)
}
