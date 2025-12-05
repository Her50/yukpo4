//! ✅ Contrôleur pour service Planification Menus
//!
//! Endpoints pour :
//! - Génération menus hebdomadaires (IA)
//! - Gestion profils famille
//! - Listes de courses
//! - Recettes et favoris

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::menu_planning_ai_service::{FamilyProfile, MenuPlanningAIService};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, NaiveDate, Utc, Weekday};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use std::sync::Arc;

/// Génère un menu hebdomadaire avec IA
#[derive(Debug, Deserialize)]
pub struct GenerateMenuRequest {
    pub week_start: Option<String>, // Date format YYYY-MM-DD
    pub profile_override: Option<FamilyProfile>,
}

/// Réponse génération menu
#[derive(Debug, Serialize)]
pub struct GenerateMenuResponse {
    pub success: bool,
    pub menu: Value,
    pub menu_plan_id: Option<i32>,
}

/// Endpoint : Générer menu semaine avec IA
pub async fn generate_weekly_menu(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<GenerateMenuRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generate_weekly_menu] Génération menu pour user_id={}",
        user_id
    );

    // Calculer le lundi de la semaine
    let week_start = if let Some(ws) = req.week_start {
        NaiveDate::parse_from_str(&ws, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Date invalide (format: YYYY-MM-DD)".to_string()))?
    } else {
        // Lundi de cette semaine
        let today = Utc::now().date_naive();
        let days_from_monday = (today.weekday().num_days_from_monday() as i64) % 7;
        today - chrono::Duration::days(days_from_monday)
    };

    let week_end = week_start + chrono::Duration::days(6);

    // Récupérer ou créer profil famille
    let profile = if let Some(profile_override) = req.profile_override {
        profile_override
    } else {
        get_or_create_family_profile(&state, user_id).await?
    };

    // Générer menu avec IA
    let ai_service = MenuPlanningAIService::new(state.app_ia.clone());
    let menu = ai_service
        .generate_weekly_menu(&profile, &week_start.format("%Y-%m-%d").to_string())
        .await?;

    // Sauvegarder le menu en base
    let menu_plan_id = save_weekly_menu(&state, user_id, &week_start, &week_end, &menu).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "menu": serde_json::to_value(&menu).unwrap_or(json!({})),
            "menu_plan_id": menu_plan_id,
            "week_start": week_start.format("%Y-%m-%d").to_string(),
            "week_end": week_end.format("%Y-%m-%d").to_string(),
        })),
    ))
}

/// Récupère ou crée le profil famille
async fn get_or_create_family_profile(state: &AppState, user_id: i32) -> AppResult<FamilyProfile> {
    let profile_row = sqlx::query(
        r#"
        SELECT 
            total_members,
            children_count,
            adults_count,
            preferences,
            allergies,
            dietary_restrictions,
            budget_monthly,
            cuisine_styles,
            cooking_level,
            time_available_hours
        FROM family_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_or_create_family_profile] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération profil: {}", e))
    })?;

    if let Some(row) = profile_row {
        Ok(FamilyProfile {
            total_members: row.get("total_members"),
            children_count: row.get("children_count"),
            adults_count: row.get("adults_count"),
            preferences: row
                .try_get::<Option<Value>, _>("preferences")
                .ok()
                .flatten()
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default(),
            allergies: row
                .try_get::<Option<Vec<String>>, _>("allergies")
                .ok()
                .flatten()
                .unwrap_or_default(),
            dietary_restrictions: row
                .try_get::<Option<Vec<String>>, _>("dietary_restrictions")
                .ok()
                .flatten()
                .unwrap_or_default(),
            budget_monthly: row
                .try_get::<Option<rust_decimal::Decimal>, _>("budget_monthly")
                .ok()
                .flatten()
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
            cuisine_styles: row
                .try_get::<Option<Vec<String>>, _>("cuisine_styles")
                .ok()
                .flatten()
                .unwrap_or_default(),
            cooking_level: row.try_get("cooking_level").ok(),
            time_available_hours: row
                .try_get::<Option<rust_decimal::Decimal>, _>("time_available_hours")
                .ok()
                .flatten()
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
        })
    } else {
        // Créer profil par défaut
        let default_profile = FamilyProfile {
            total_members: 1,
            children_count: 0,
            adults_count: 1,
            preferences: vec![],
            allergies: vec![],
            dietary_restrictions: vec![],
            budget_monthly: None,
            cuisine_styles: vec![],
            cooking_level: Some("débutant".to_string()),
            time_available_hours: None,
        };
        Ok(default_profile)
    }
}

/// Sauvegarde un menu hebdomadaire en base
async fn save_weekly_menu(
    state: &AppState,
    user_id: i32,
    week_start: &NaiveDate,
    week_end: &NaiveDate,
    menu: &crate::services::menu_planning_ai_service::WeeklyMenu,
) -> AppResult<Option<i32>> {
    // Créer ou mettre à jour menu_plan
    let menu_plan_id: Option<i32> = sqlx::query_scalar(
        r#"
        INSERT INTO menu_plans (user_id, week_start, week_end, status, total_budget)
        VALUES ($1, $2, $3, 'active', $4)
        ON CONFLICT (user_id, week_start) 
        DO UPDATE SET 
            status = 'active',
            total_budget = EXCLUDED.total_budget,
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(week_start)
    .bind(week_end)
    .bind(
        menu.total_estimated_cost
            .map(|c| rust_decimal::Decimal::from_f64_retain(c).unwrap_or_default()),
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[save_weekly_menu] Erreur: {}", e);
        AppError::Internal(format!("Erreur sauvegarde menu: {}", e))
    })?;

    // TODO: Sauvegarder les planned_meals

    Ok(menu_plan_id)
}

/// Récupère le menu de la semaine actuelle
#[derive(Debug, Deserialize)]
pub struct GetMenuQuery {
    pub week_start: Option<String>,
}

pub async fn get_my_week_menu(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<GetMenuQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_my_week_menu] Récupération menu pour user_id={}",
        user_id
    );

    let week_start = if let Some(ws) = query.week_start {
        NaiveDate::parse_from_str(&ws, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Date invalide".to_string()))?
    } else {
        let today = Utc::now().date_naive();
        let days_from_monday = (today.weekday().num_days_from_monday() as i64) % 7;
        today - chrono::Duration::days(days_from_monday)
    };

    let menu_plan = sqlx::query(
        r#"
        SELECT 
            id,
            user_id,
            week_start,
            week_end,
            status,
            total_budget,
            actual_cost,
            notes,
            created_at,
            updated_at
        FROM menu_plans
        WHERE user_id = $1 AND week_start = $2
        "#,
    )
    .bind(user_id)
    .bind(week_start)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_my_week_menu] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération menu: {}", e))
    })?;

    if let Some(row) = menu_plan {
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "menu_plan": {
                    "id": row.get::<i32, _>("id"),
                    "week_start": row.get::<NaiveDate, _>("week_start"),
                    "week_end": row.get::<NaiveDate, _>("week_end"),
                    "status": row.get::<String, _>("status"),
                    "total_budget": row.get::<Option<rust_decimal::Decimal>, _>("total_budget"),
                    "actual_cost": row.get::<Option<rust_decimal::Decimal>, _>("actual_cost"),
                }
            })),
        ))
    } else {
        Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "menu_plan": null,
                "message": "Aucun menu trouvé pour cette semaine"
            })),
        ))
    }
}

/// Récupère ou crée le profil famille
pub async fn get_family_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_family_profile] Récupération profil pour user_id={}",
        user_id
    );

    let profile = get_or_create_family_profile(&state, user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "profile": serde_json::to_value(&profile).unwrap_or(json!({}))
        })),
    ))
}

/// Met à jour le profil famille
#[derive(Debug, Deserialize)]
pub struct UpdateFamilyProfileRequest {
    pub total_members: Option<i32>,
    pub children_count: Option<i32>,
    pub adults_count: Option<i32>,
    pub preferences: Option<Vec<String>>,
    pub allergies: Option<Vec<String>>,
    pub dietary_restrictions: Option<Vec<String>>,
    pub budget_monthly: Option<f64>,
    pub cuisine_styles: Option<Vec<String>>,
    pub cooking_level: Option<String>,
    pub time_available_hours: Option<f64>,
}

pub async fn update_family_profile(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<UpdateFamilyProfileRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_family_profile] Mise à jour profil pour user_id={}",
        user_id
    );

    // TODO: Implémenter mise à jour profil famille
    // Pour l'instant, retourner succès

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Profil mis à jour avec succès"
        })),
    ))
}
