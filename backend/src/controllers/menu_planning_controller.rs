//! ✅ Contrôleur pour service Planification Menus
//!
//! Endpoints pour :
//! - Génération menus hebdomadaires (IA)
//! - Gestion profils famille
//! - Listes de courses
//! - Recettes et favoris

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::geocoding_service::GeocodingService;
use crate::services::menu_planning_ai_service::{
    FamilyProfile, MealItemForShopping, MenuPlanningAIService, WeeklyMenu,
};
use crate::state::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Datelike, NaiveDate, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

/// Génère un menu hebdomadaire avec IA
#[derive(Debug, Deserialize)]
pub struct GenerateMenuRequest {
    pub week_start: Option<String>, // Date format YYYY-MM-DD
    pub profile_override: Option<FamilyProfile>,
    /// ✅ NOUVEAU: GPS actuel de l'utilisateur (format: "lat,lng" ou "lng,lat")
    /// Si fourni, sera utilisé à la place du GPS stocké en base
    pub current_gps: Option<String>,
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

    // ✅ NOUVEAU: Récupérer contexte localité utilisateur (pays, ville)
    // Priorité: GPS fourni dans la requête > GPS stocké en base
    let (user_country, user_city) = if let Some(current_gps) = &req.current_gps {
        // Utiliser le GPS fourni dynamiquement par l'application mobile
        get_location_context_from_gps(&state, current_gps)
            .await
            .unwrap_or((None, None))
    } else {
        // Utiliser le GPS stocké en base (fallback)
        get_user_location_context(&state, user_id)
            .await
            .unwrap_or((None, None))
    };

    info!(
        "[generate_weekly_menu] Contexte géographique: pays={:?}, ville={:?}",
        user_country, user_city
    );

    // ✅ NOUVEAU: Récupérer menus précédents pour variation
    let previous_menus = get_previous_menus(&state, user_id, 3).await?;

    // Générer menu avec IA (version intelligente avec contextes)
    let ai_service = MenuPlanningAIService::new(state.ia.clone());
    let menu = ai_service
        .generate_weekly_menu_intelligent(
            &profile,
            &week_start.format("%Y-%m-%d").to_string(),
            user_country.as_deref(),
            user_city.as_deref(),
            &previous_menus,
        )
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

    // ✅ Vérification qu'au moins un champ est fourni pour la mise à jour
    let has_updates = req.total_members.is_some()
        || req.children_count.is_some()
        || req.adults_count.is_some()
        || req.preferences.is_some()
        || req.allergies.is_some()
        || req.dietary_restrictions.is_some()
        || req.budget_monthly.is_some()
        || req.cuisine_styles.is_some()
        || req.cooking_level.is_some()
        || req.time_available_hours.is_some();

    if !has_updates {
        return Err(AppError::BadRequest(
            "Aucun champ à mettre à jour".to_string(),
        ));
    }

    // Log pour le budget si fourni
    if let Some(budget_monthly) = req.budget_monthly {
        info!(
            "[update_family_profile] Budget mensuel mis à jour: {} FCFA",
            budget_monthly
        );
    }

    // ✅ IMPLÉMENTÉ: Utiliser UPSERT pour créer ou mettre à jour le profil
    // Récupérer le profil existant pour préserver les valeurs non modifiées
    let existing_profile = get_or_create_family_profile(&state, user_id).await?;

    // Utiliser les nouvelles valeurs si fournies, sinon garder les existantes
    let total_members = req.total_members.unwrap_or(existing_profile.total_members);
    let children_count = req
        .children_count
        .unwrap_or(existing_profile.children_count);
    let adults_count = req.adults_count.unwrap_or(existing_profile.adults_count);
    let preferences = req.preferences.unwrap_or(existing_profile.preferences);
    let allergies = req.allergies.unwrap_or(existing_profile.allergies);
    let dietary_restrictions = req
        .dietary_restrictions
        .unwrap_or(existing_profile.dietary_restrictions);
    let budget_monthly = req.budget_monthly.or(existing_profile.budget_monthly);
    let cuisine_styles = req
        .cuisine_styles
        .unwrap_or(existing_profile.cuisine_styles);
    let cooking_level = req.cooking_level.or(existing_profile.cooking_level);
    let time_available_hours = req
        .time_available_hours
        .or(existing_profile.time_available_hours);

    sqlx::query(
        r#"
        INSERT INTO family_profiles (
            user_id,
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
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_members = EXCLUDED.total_members,
            children_count = EXCLUDED.children_count,
            adults_count = EXCLUDED.adults_count,
            preferences = EXCLUDED.preferences,
            allergies = EXCLUDED.allergies,
            dietary_restrictions = EXCLUDED.dietary_restrictions,
            budget_monthly = EXCLUDED.budget_monthly,
            cuisine_styles = EXCLUDED.cuisine_styles,
            cooking_level = EXCLUDED.cooking_level,
            time_available_hours = EXCLUDED.time_available_hours,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(total_members)
    .bind(children_count)
    .bind(adults_count)
    .bind(serde_json::to_value(&preferences).unwrap_or(serde_json::json!([])))
    .bind(&allergies)
    .bind(&dietary_restrictions)
    .bind(budget_monthly.map(|b| rust_decimal::Decimal::from_f64_retain(b).unwrap_or_default()))
    .bind(&cuisine_styles)
    .bind(cooking_level.as_deref())
    .bind(
        time_available_hours.map(|t| rust_decimal::Decimal::from_f64_retain(t).unwrap_or_default()),
    )
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_family_profile] Erreur: {}", e);
        AppError::Internal(format!("Erreur mise à jour profil: {}", e))
    })?;

    info!(
        "[update_family_profile] ✅ Profil famille mis à jour avec succès pour user_id={}",
        user_id
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Profil mis à jour avec succès"
        })),
    ))
}

/// ✅ NOUVEAU: Récupère le contexte de localité de l'utilisateur (pays, ville) depuis la base
async fn get_user_location_context(
    state: &AppState,
    user_id: i32,
) -> AppResult<(Option<String>, Option<String>)> {
    // Récupérer GPS utilisateur
    let user_gps: Option<String> =
        sqlx::query_scalar("SELECT gps FROM users WHERE id = $1 AND gps IS NOT NULL AND gps != ''")
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[get_user_location_context] Erreur récupération GPS: {}", e);
                AppError::Internal(format!("Erreur récupération GPS: {}", e))
            })?;

    if let Some(gps_str) = user_gps {
        return get_location_context_from_gps(state, &gps_str).await;
    }

    Ok((None, None))
}

/// ✅ NOUVEAU: Récupère le contexte de localité (pays, ville) depuis une chaîne GPS
/// Fonction utilitaire réutilisable pour parser GPS et faire géocodage inverse
async fn get_location_context_from_gps(
    _state: &AppState,
    gps_str: &str,
) -> AppResult<(Option<String>, Option<String>)> {
    // Parser coordonnées GPS (format: "lat,lng" ou "lng,lat")
    // Le format stocké en base est généralement "lng,lat" (longitude, latitude)
    if let Some((coord1_str, coord2_str)) = gps_str.split_once(',') {
        if let (Ok(coord1), Ok(coord2)) = (
            coord1_str.trim().parse::<f64>(),
            coord2_str.trim().parse::<f64>(),
        ) {
            // Déterminer si c'est "lat,lng" ou "lng,lat" selon les valeurs
            // Longitude: -180 à 180, Latitude: -90 à 90
            let (lat, lng) = if coord1.abs() <= 90.0 && coord2.abs() <= 180.0 {
                // Format "lat,lng"
                (coord1, coord2)
            } else if coord1.abs() <= 180.0 && coord2.abs() <= 90.0 {
                // Format "lng,lat" (format stocké en base)
                (coord2, coord1)
            } else {
                // Format ambigu, essayer "lng,lat" par défaut (format backend)
                (coord2, coord1)
            };

            // Utiliser le service de géocodage inverse
            let geocoding_service = GeocodingService::new();
            match geocoding_service.reverse_geocode(lat, lng).await {
                Ok(result) => {
                    info!(
                        "[get_location_context_from_gps] Géocodage réussi: pays={:?}, ville={:?}",
                        result.country, result.city
                    );
                    return Ok((result.country, result.city));
                }
                Err(e) => {
                    warn!(
                        "[get_location_context_from_gps] Erreur géocodage inverse: {}",
                        e
                    );
                }
            }
        }
    }

    Ok((None, None))
}

/// ✅ NOUVEAU: Génère une recette complète pour un plat spécifique
#[derive(Debug, Deserialize)]
pub struct GenerateRecipeRequest {
    pub recipe_name: String,
    pub servings: Option<i32>,
}

/// Endpoint : Générer recette avec IA
pub async fn generate_recipe(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<GenerateRecipeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generate_recipe] Génération recette '{}' pour user_id={}",
        req.recipe_name, user_id
    );

    // Récupérer profil famille (optionnel)
    let profile = get_or_create_family_profile(&state, user_id).await.ok();

    // Récupérer contexte localité utilisateur
    let (user_country, user_city) = get_user_location_context(&state, user_id)
        .await
        .unwrap_or((None, None));

    // Générer recette avec IA
    let ai_service = MenuPlanningAIService::new(state.ia.clone());
    let recipe = ai_service
        .generate_recipe(
            &req.recipe_name,
            profile.as_ref(),
            user_country.as_deref(),
            user_city.as_deref(),
            req.servings,
        )
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "recipe": recipe,
        })),
    ))
}

/// ✅ NOUVEAU: Génère une liste de courses intelligente via IA
#[derive(Debug, Deserialize)]
pub struct GenerateShoppingListRequest {
    pub meal_items: Vec<MealItemForShopping>,
    pub family_members: i32,
    /// ✅ NOUVEAU: Nombre d'adultes dans la famille
    pub adults_count: Option<i32>,
    /// ✅ NOUVEAU: Nombre d'enfants dans la famille
    pub children_count: Option<i32>,
    /// ✅ NOUVEAU 2026-01-13: GPS actuel de l'utilisateur (format: "lat,lng" ou "lng,lat")
    /// Si fourni, sera utilisé à la place du GPS stocké en base pour déterminer la zone géographique
    pub current_gps: Option<String>,
    /// ✅ NOUVEAU 2026-01-13: Nombre de jours pour la période (7 pour hebdomadaire, 30 pour mensuel, etc.)
    /// Si non fourni, utilise 7 jours par défaut (menu hebdomadaire)
    pub period_days: Option<i32>,
}

/// Endpoint : Générer liste de courses intelligente avec IA
pub async fn generate_intelligent_shopping_list(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(req): Json<GenerateShoppingListRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[generate_intelligent_shopping_list] Génération liste de courses pour user_id={}, {} repas",
        user_id, req.meal_items.len()
    );

    if req.meal_items.is_empty() {
        return Err(AppError::BadRequest(
            "Aucun repas fourni pour générer la liste de courses".to_string(),
        ));
    }

    // ✅ NOUVEAU 2026-01-13: Récupérer nombre de personnes (priorité: requête > profil famille en base)
    let profile = get_or_create_family_profile(&state, user_id).await?;
    let family_members = if req.family_members > 0 {
        req.family_members
    } else {
        profile.total_members
    };

    // ✅ CORRIGÉ: Utiliser adults_count et children_count de la requête ou du profil
    // profile.adults_count et profile.children_count sont des i32, pas Option<i32>
    let adults_count = req.adults_count.unwrap_or(profile.adults_count);
    let children_count = req.children_count.unwrap_or(profile.children_count);

    info!(
        "[generate_intelligent_shopping_list] Nombre de personnes: {} (adultes: {}, enfants: {})",
        family_members, adults_count, children_count
    );

    // ✅ NOUVEAU 2026-01-13: Récupérer contexte localité utilisateur (pays, ville) pour utiliser des unités locales
    let (user_country, user_city) = if let Some(current_gps) = &req.current_gps {
        // Utiliser le GPS fourni dynamiquement par l'application mobile
        get_location_context_from_gps(&state, current_gps)
            .await
            .unwrap_or((None, None))
    } else {
        // Utiliser le GPS stocké en base (fallback)
        get_user_location_context(&state, user_id)
            .await
            .unwrap_or((None, None))
    };

    info!(
        "[generate_intelligent_shopping_list] Contexte géographique: pays={:?}, ville={:?}",
        user_country, user_city
    );

    // ✅ NOUVEAU 2026-01-13: Récupérer le budget mensuel depuis le profil famille pour proratisation
    let profile = get_or_create_family_profile(&state, user_id).await?;
    let budget_monthly = profile.budget_monthly;

    // ✅ NOUVEAU 2026-01-13: Calculer la période en jours (par défaut 7 jours pour menu hebdomadaire)
    // La période peut être déterminée par la plage de dates des repas ou par défaut 7 jours
    let period_days = if let Some(period) = req.period_days {
        Some(period)
    } else {
        // Calculer la période à partir des dates des repas si disponibles
        // Sinon, utiliser 7 jours par défaut (menu hebdomadaire)
        Some(7)
    };

    if let Some(budget) = budget_monthly {
        if let Some(days) = period_days {
            let budget_prorated = (budget / 30.0) * (days as f64);
            info!(
                "[generate_intelligent_shopping_list] Budget: mensuel={:.2} FCFA, proratisé ({} jours)={:.2} FCFA",
                budget, days, budget_prorated
            );
        }
    } else {
        info!("[generate_intelligent_shopping_list] Budget non spécifié dans le profil famille");
    }

    info!(
        "[generate_intelligent_shopping_list] Repas à traiter: {} repas avec quantités (times, servings)",
        req.meal_items.len()
    );

    // Générer liste de courses avec IA (avec zone géographique pour unités locales, budget proratisé et profil famille détaillé)
    let ai_service = MenuPlanningAIService::new(state.ia.clone());
    let shopping_list = ai_service
        .generate_intelligent_shopping_list(
            &req.meal_items,
            family_members,
            user_country.as_deref(),
            user_city.as_deref(),
            budget_monthly,
            period_days,
            Some(adults_count),
            Some(children_count),
        )
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "shopping_list": serde_json::to_value(&shopping_list).unwrap_or(json!({}))
        })),
    ))
}

/// ✅ NOUVEAU: Récupère les menus précédents pour éviter la répétition
async fn get_previous_menus(
    state: &AppState,
    user_id: i32,
    limit: i32,
) -> AppResult<Vec<WeeklyMenu>> {
    // Récupérer les menus précédents depuis la base
    let menu_rows = sqlx::query(
        r#"
        SELECT 
            id,
            week_start,
            week_end,
            total_budget
        FROM menu_plans
        WHERE user_id = $1
            AND week_start < CURRENT_DATE
            AND status = 'active'
        ORDER BY week_start DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_previous_menus] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération menus précédents: {}", e))
    })?;

    // Pour l'instant, on retourne des menus vides (structure)
    // TODO: Charger les repas détaillés depuis planned_meals si la table existe
    let previous_menus: Vec<WeeklyMenu> = menu_rows
        .into_iter()
        .map(|row| {
            WeeklyMenu {
                week_start: row
                    .get::<chrono::NaiveDate, _>("week_start")
                    .format("%Y-%m-%d")
                    .to_string(),
                meals: vec![], // TODO: Charger depuis planned_meals
                total_estimated_cost: row
                    .try_get::<Option<rust_decimal::Decimal>, _>("total_budget")
                    .ok()
                    .flatten()
                    .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
                total_calories_per_day: None,
                recommendations: vec![],
            }
        })
        .collect();

    Ok(previous_menus)
}

/// ✅ NOUVEAU: Récupère l'historique des menus et listes d'achats générés
#[derive(Debug, Deserialize)]
pub struct GetHistoryQuery {
    pub limit: Option<i32>,
}

/// Réponse historique
#[derive(Debug, Serialize)]
pub struct MenuHistoryItem {
    pub id: i32,
    pub week_start: String,
    pub week_end: String,
    pub status: String,
    pub total_budget: Option<f64>,
    pub actual_cost: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ShoppingListHistoryItem {
    pub id: i32,
    pub week_start: String,
    pub status: String,
    pub total_estimated_cost: Option<f64>,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct HistoryResponse {
    pub success: bool,
    pub menus: Vec<MenuHistoryItem>,
    pub shopping_lists: Vec<ShoppingListHistoryItem>,
}

/// Endpoint : Récupérer l'historique des menus et listes d'achats
pub async fn get_menu_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<GetHistoryQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_menu_history] Récupération historique pour user_id={}",
        user_id
    );

    let limit = query.limit.unwrap_or(10);

    // Récupérer les menus
    let menu_rows = sqlx::query(
        r#"
        SELECT 
            id,
            week_start,
            week_end,
            status,
            total_budget,
            actual_cost,
            created_at
        FROM menu_plans
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_menu_history] Erreur récupération menus: {}", e);
        AppError::Internal(format!("Erreur récupération historique menus: {}", e))
    })?;

    let menus: Vec<MenuHistoryItem> = menu_rows
        .into_iter()
        .map(|row| MenuHistoryItem {
            id: row.get("id"),
            week_start: row
                .get::<chrono::NaiveDate, _>("week_start")
                .format("%Y-%m-%d")
                .to_string(),
            week_end: row
                .get::<chrono::NaiveDate, _>("week_end")
                .format("%Y-%m-%d")
                .to_string(),
            status: row.get("status"),
            total_budget: row
                .try_get::<Option<rust_decimal::Decimal>, _>("total_budget")
                .ok()
                .flatten()
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
            actual_cost: row
                .try_get::<Option<rust_decimal::Decimal>, _>("actual_cost")
                .ok()
                .flatten()
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
            created_at: row
                .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .to_rfc3339(),
        })
        .collect();

    // Récupérer les listes d'achats
    let shopping_list_rows = sqlx::query(
        r#"
        SELECT 
            sl.id,
            sl.week_start,
            sl.status,
            sl.total_estimated_cost,
            sl.created_at,
            COUNT(sli.id) as items_count
        FROM shopping_lists sl
        LEFT JOIN shopping_list_items sli ON sli.shopping_list_id = sl.id
        WHERE sl.user_id = $1
        GROUP BY sl.id, sl.week_start, sl.status, sl.total_estimated_cost, sl.created_at
        ORDER BY sl.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_menu_history] Erreur récupération listes: {}", e);
        AppError::Internal(format!("Erreur récupération historique listes: {}", e))
    })?;

    let shopping_lists: Vec<ShoppingListHistoryItem> = shopping_list_rows
        .into_iter()
        .map(|row| ShoppingListHistoryItem {
            id: row.get("id"),
            week_start: row
                .get::<chrono::NaiveDate, _>("week_start")
                .format("%Y-%m-%d")
                .to_string(),
            status: row.get("status"),
            total_estimated_cost: row
                .try_get::<Option<rust_decimal::Decimal>, _>("total_estimated_cost")
                .ok()
                .flatten()
                .map(|d| d.to_string().parse::<f64>().unwrap_or(0.0)),
            items_count: row.get("items_count"),
            created_at: row
                .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .to_rfc3339(),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "menus": menus,
            "shopping_lists": shopping_lists,
        })),
    ))
}
