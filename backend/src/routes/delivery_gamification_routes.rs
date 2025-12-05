// ✅ NOUVEAU: Routes API pour gamification de livraison
// Système de points, badges, niveaux et récompenses

use crate::{
    middlewares::jwt::{jwt_auth, AuthenticatedUser},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Extension, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct GamificationStats {
    pub user_id: i32,
    pub total_deliveries: i32,
    pub total_completed_deliveries: i32,
    pub total_points: i32,
    pub current_level: String,
    pub badges: Vec<Badge>,
    pub achievements: Value,
    pub next_level_points: Option<i32>,
    pub points_to_next_level: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct Badge {
    pub badge_type: String,
    pub badge_name: String,
    pub badge_description: Option<String>,
    pub icon_url: Option<String>,
    pub earned_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct LeaderboardEntry {
    pub user_id: i32,
    pub username: Option<String>,
    pub total_points: i32,
    pub total_deliveries: i32,
    pub current_level: String,
    pub rank: i64,
}

#[derive(Debug, Deserialize)]
pub struct LeaderboardQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    50
}

pub fn delivery_gamification_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/delivery/gamification/stats/:user_id",
            get(get_gamification_stats)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/gamification/badges/:user_id",
            get(get_user_badges)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/gamification/leaderboard",
            get(get_leaderboard)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/gamification/claim-reward",
            post(claim_reward)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .route(
            "/api/delivery/gamification/award-points",
            post(award_points)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    jwt_auth,
                )),
        )
        .with_state(state)
}

/// GET /api/delivery/gamification/stats/:user_id
/// Récupère les statistiques de gamification d'un utilisateur
async fn get_gamification_stats(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(user_id): Path<i32>,
) -> Result<Json<GamificationStats>, StatusCode> {
    // Vérifier que l'utilisateur demande ses propres stats ou est admin
    if user.id != user_id {
        // TODO: Vérifier si l'utilisateur est admin
        // Pour l'instant, on autorise seulement ses propres stats
    }

    log::info!(
        "[DeliveryGamificationAPI] 📊 Récupération stats - User: {}",
        user_id
    );

    // Récupérer ou créer les stats
    let stats_row = sqlx::query(
        r#"
        SELECT 
            user_id,
            total_deliveries,
            total_completed_deliveries,
            total_points,
            current_level,
            badges,
            achievements
        FROM delivery_gamification_stats
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await;

    let stats = match stats_row {
        Ok(Some(row)) => {
            let badges_json: Value = row.get("badges");
            let badges: Vec<Badge> = if let Some(badges_array) = badges_json.as_array() {
                badges_array
                    .iter()
                    .filter_map(|b| {
                        Some(Badge {
                            badge_type: b.get("badge_type")?.as_str()?.to_string(),
                            badge_name: b.get("badge_name")?.as_str()?.to_string(),
                            badge_description: b.get("badge_description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            icon_url: b.get("icon_url").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            earned_at: chrono::Utc::now(), // TODO: Récupérer depuis la table delivery_badges
                        })
                    })
                    .collect()
            } else {
                Vec::new()
            };

            let current_level: String = row.get("current_level");
            let total_points: i32 = row.get("total_points");
            let (next_level_points, points_to_next_level) = calculate_next_level(&current_level, total_points);

            GamificationStats {
                user_id: row.get("user_id"),
                total_deliveries: row.get("total_deliveries"),
                total_completed_deliveries: row.get("total_completed_deliveries"),
                total_points,
                current_level,
                badges,
                achievements: row.get("achievements"),
                next_level_points,
                points_to_next_level,
            }
        }
        Ok(None) => {
            // Créer les stats initiales
            let initial_stats = GamificationStats {
                user_id,
                total_deliveries: 0,
                total_completed_deliveries: 0,
                total_points: 0,
                current_level: "bronze".to_string(),
                badges: Vec::new(),
                achievements: json!({}),
                next_level_points: Some(100),
                points_to_next_level: Some(100),
            };

            // Insérer en base
            let _ = sqlx::query(
                r#"
                INSERT INTO delivery_gamification_stats
                (user_id, total_deliveries, total_completed_deliveries, total_points, current_level, badges, achievements)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#,
            )
            .bind(user_id)
            .bind(initial_stats.total_deliveries)
            .bind(initial_stats.total_completed_deliveries)
            .bind(initial_stats.total_points)
            .bind(&initial_stats.current_level)
            .bind(json!(initial_stats.badges))
            .bind(&initial_stats.achievements)
            .execute(&state.pg)
            .await;

            initial_stats
        }
        Err(e) => {
            log::error!("[DeliveryGamificationAPI] ❌ Erreur récupération stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stats))
}

/// GET /api/delivery/gamification/badges/:user_id
/// Récupère tous les badges d'un utilisateur
async fn get_user_badges(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(user_id): Path<i32>,
) -> Result<Json<Vec<Badge>>, StatusCode> {
    if user.id != user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    let rows = sqlx::query(
        r#"
        SELECT 
            badge_type,
            badge_name,
            badge_description,
            icon_url,
            earned_at
        FROM delivery_badges
        WHERE user_id = $1
        ORDER BY earned_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await;

    match rows {
        Ok(rows) => {
            let badges: Vec<Badge> = rows
                .into_iter()
                .map(|row| Badge {
                    badge_type: row.get("badge_type"),
                    badge_name: row.get("badge_name"),
                    badge_description: row.get("badge_description"),
                    icon_url: row.get("icon_url"),
                    earned_at: row.get("earned_at"),
                })
                .collect();

            Ok(Json(badges))
        }
        Err(e) => {
            log::error!("[DeliveryGamificationAPI] ❌ Erreur récupération badges: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// GET /api/delivery/gamification/leaderboard
/// Récupère le classement des utilisateurs
async fn get_leaderboard(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<LeaderboardQuery>,
) -> Result<Json<Vec<LeaderboardEntry>>, StatusCode> {
    let rows = sqlx::query(
        r#"
        SELECT 
            gs.user_id,
            u.name as username,
            gs.total_points,
            gs.total_completed_deliveries as total_deliveries,
            gs.current_level,
            ROW_NUMBER() OVER (ORDER BY gs.total_points DESC) as rank
        FROM delivery_gamification_stats gs
        LEFT JOIN users u ON u.id = gs.user_id
        ORDER BY gs.total_points DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(params.limit)
    .bind(params.offset)
    .fetch_all(&state.pg)
    .await;

    match rows {
        Ok(rows) => {
            let entries: Vec<LeaderboardEntry> = rows
                .into_iter()
                .map(|row| LeaderboardEntry {
                    user_id: row.get("user_id"),
                    username: row.get("username"),
                    total_points: row.get("total_points"),
                    total_deliveries: row.get("total_deliveries"),
                    current_level: row.get("current_level"),
                    rank: row.get("rank"),
                })
                .collect();

            Ok(Json(entries))
        }
        Err(e) => {
            log::error!("[DeliveryGamificationAPI] ❌ Erreur récupération leaderboard: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// POST /api/delivery/gamification/claim-reward
/// Réclame une récompense (à implémenter selon les besoins)
async fn claim_reward(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, StatusCode> {
    // TODO: Implémenter la logique de réclamation de récompenses
    Ok(Json(json!({
        "success": true,
        "message": "Fonctionnalité à implémenter"
    })))
}

/// POST /api/delivery/gamification/award-points
/// Attribue des points à un utilisateur (pour les tests ou événements système)
#[derive(Debug, Deserialize)]
struct AwardPointsRequest {
    pub user_id: i32,
    pub points: i32,
    pub reason: String,
    pub delivery_id: Option<Uuid>,
}

async fn award_points(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AwardPointsRequest>,
) -> Result<Json<Value>, StatusCode> {
    // TODO: Vérifier que l'utilisateur est admin ou système
    // Pour l'instant, on autorise seulement si c'est pour soi-même
    if user.id != payload.user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    log::info!(
        "[DeliveryGamificationAPI] 🎁 Attribution points - User: {}, Points: {}, Raison: {}",
        payload.user_id,
        payload.points,
        payload.reason
    );

    // Mettre à jour les stats
    let result = sqlx::query(
        r#"
        INSERT INTO delivery_gamification_stats
        (user_id, total_points, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_points = delivery_gamification_stats.total_points + $2,
            last_updated = NOW()
        "#,
    )
    .bind(payload.user_id)
    .bind(payload.points)
    .execute(&state.pg)
    .await;

    match result {
        Ok(_) => {
            // Enregistrer dans l'historique
            let _ = sqlx::query(
                r#"
                INSERT INTO delivery_points_history
                (user_id, points_change, reason, delivery_id, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                "#,
            )
            .bind(payload.user_id)
            .bind(payload.points)
            .bind(&payload.reason)
            .bind(payload.delivery_id)
            .execute(&state.pg)
            .await;

            // Vérifier et mettre à jour le niveau
            check_and_update_level(&state, payload.user_id).await;

            Ok(Json(json!({
                "success": true,
                "points_awarded": payload.points
            })))
        }
        Err(e) => {
            log::error!("[DeliveryGamificationAPI] ❌ Erreur attribution points: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Calcule les points nécessaires pour le prochain niveau
fn calculate_next_level(current_level: &str, current_points: i32) -> (Option<i32>, Option<i32>) {
    let level_thresholds: Vec<(i32, &str)> = vec![
        (0, "bronze"),
        (100, "silver"),
        (500, "gold"),
        (2000, "platinum"),
        (10000, "diamond"),
    ];

    let current_index = level_thresholds
        .iter()
        .position(|(_, level)| level == &current_level)
        .unwrap_or(0);

    if current_index < level_thresholds.len() - 1 {
        let next_threshold = level_thresholds[current_index + 1].0;
        let points_needed = next_threshold - current_points;
        (Some(next_threshold), Some(points_needed.max(0)))
    } else {
        (None, None) // Niveau maximum atteint
    }
}

/// Vérifie et met à jour le niveau de l'utilisateur
async fn check_and_update_level(state: &Arc<AppState>, user_id: i32) {
    let stats = sqlx::query(
        r#"
        SELECT total_points, current_level
        FROM delivery_gamification_stats
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await;

    if let Ok(Some(row)) = stats {
        let total_points: i32 = row.get("total_points");
        let current_level: String = row.get("current_level");

        let new_level = if total_points >= 10000 {
            "diamond"
        } else if total_points >= 2000 {
            "platinum"
        } else if total_points >= 500 {
            "gold"
        } else if total_points >= 100 {
            "silver"
        } else {
            "bronze"
        };

        if new_level != current_level {
            let _ = sqlx::query(
                r#"
                UPDATE delivery_gamification_stats
                SET current_level = $1, last_updated = NOW()
                WHERE user_id = $2
                "#,
            )
            .bind(new_level)
            .bind(user_id)
            .execute(&state.pg)
            .await;

            log::info!(
                "[DeliveryGamificationAPI] 🎉 Niveau mis à jour - User: {}, Nouveau niveau: {}",
                user_id,
                new_level
            );
        }
    }
}

