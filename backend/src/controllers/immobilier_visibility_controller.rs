// ✅ NOUVEAU 2026-01-26: Contrôleur pour système de visibilité payante immobilier
// Calcul coût, déduction tokens, activation, réactivation, expiration

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::core::types::{AppError, AppResult, AppState};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::middlewares::jwt::Extension;
use crate::services::payment_service::PaymentService;
use rust_decimal::Decimal;

// ============================================
// 1. CALCUL COÛT VISIBILITÉ
// ============================================

#[derive(Debug, Deserialize)]
pub struct CalculateVisibilityCostRequest {
    pub property_id: Option<i32>, // NULL si nouveau bien
    pub prix_vente: Option<f64>,
    pub prix_location_mensuel: Option<f64>,
    pub type_bien: String,
    pub jours_visibilite: i32, // 7, 15, 30, 60, 90
}

/// POST /api/immobilier/visibility/calculate-cost
pub async fn calculate_visibility_cost(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CalculateVisibilityCostRequest>,
) -> AppResult<impl IntoResponse> {
    // Récupérer le prix du bien (vente ou location)
    let prix_bien = if let Some(prix_vente) = request.prix_vente {
        prix_vente
    } else if let Some(prix_location) = request.prix_location_mensuel {
        prix_location
    } else if let Some(property_id) = request.property_id {
        // Récupérer depuis la base
        let prix: Option<Decimal> = sqlx::query_scalar(
            r#"
            SELECT COALESCE(prix_vente, prix_location_mensuel)
            FROM real_estate_properties
            WHERE id = $1
            "#
        )
        .bind(property_id)
        .fetch_optional(&state.pg)
        .await?
        .and_then(|d: Option<Decimal>| d)
        .and_then(|d| d.to_string().parse::<f64>().ok());
        
        prix.unwrap_or(0.0)
    } else {
        return Err(AppError::BadRequest("Prix du bien requis".to_string()));
    };

    if prix_bien <= 0.0 {
        return Err(AppError::BadRequest("Prix du bien doit être supérieur à 0".to_string()));
    }

    // Taux de commission selon type de bien (configurable)
    let taux_base = match request.type_bien.as_str() {
        "maison" | "appartement" => 0.005, // 0.5%
        "terrain" => 0.003, // 0.3%
        "bureau" | "local_commercial" => 0.004, // 0.4%
        _ => 0.005, // Par défaut 0.5%
    };

    // Ajustement selon durée (réduction pour durées longues)
    let multiplicateur_duree = match request.jours_visibilite {
        7 => 1.0,
        15 => 0.95, // -5%
        30 => 0.90, // -10%
        60 => 0.85, // -15%
        90 => 0.80, // -20%
        _ => 1.0,
    };

    // Calcul coût
    let cout_total_fcfa = prix_bien * taux_base * multiplicateur_duree;
    let tokens_necessaires = cout_total_fcfa as i64; // 1 FCFA = 1 token

    // Vérifier solde utilisateur
    let solde_tokens: i64 = sqlx::query_scalar(
        "SELECT tokens_balance FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[calculate_visibility_cost] Erreur récupération solde: {}", e);
        AppError::Internal("Erreur récupération solde".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "prix_bien": prix_bien,
            "type_bien": request.type_bien,
            "jours_visibilite": request.jours_visibilite,
            "taux_commission": taux_base,
            "multiplicateur_duree": multiplicateur_duree,
            "cout_total_fcfa": cout_total_fcfa,
            "tokens_necessaires": tokens_necessaires,
            "solde_actuel": solde_tokens,
            "solde_suffisant": solde_tokens >= tokens_necessaires,
            "tokens_manquants": if solde_tokens < tokens_necessaires {
                tokens_necessaires - solde_tokens
            } else {
                0
            }
        }
    })))
}

// ============================================
// 2. ACTIVATION VISIBILITÉ
// ============================================

#[derive(Debug, Deserialize)]
pub struct ActivateVisibilityRequest {
    pub property_id: i32,
    pub jours_visibilite: i32,
    pub auto_recharge: Option<bool>, // Si true, recharge automatique si solde insuffisant
}

/// POST /api/immobilier/visibility/activate
pub async fn activate_property_visibility(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ActivateVisibilityRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifier que le bien appartient à l'utilisateur
    #[derive(sqlx::FromRow)]
    struct PropertyInfo {
        service_id: i32,
        type_bien: String,
        prix_vente: Option<Decimal>,
        prix_location_mensuel: Option<Decimal>,
    }

    let property_info: Option<PropertyInfo> = sqlx::query_as(
        r#"
        SELECT s.id as service_id, p.type_bien, p.prix_vente, p.prix_location_mensuel
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1 AND s.user_id = $2
        "#
    )
    .bind(request.property_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await?;

    let PropertyInfo { service_id, type_bien, prix_vente, prix_location_mensuel } = match property_info {
        Some(info) => info,
        None => return Err(AppError::NotFound("Bien non trouvé ou non autorisé".to_string())),
    };

    // ✅ NOUVEAU 2026-01-26: Vérifier si première publication (visibilité gratuite 1 mois)
    let has_used_free_trial: bool = sqlx::query_scalar(
        "SELECT COALESCE(has_used_free_trial, FALSE) FROM real_estate_properties WHERE id = $1"
    )
    .bind(request.property_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(false);

    // ✅ NOUVEAU 2026-01-26: Détecter si première publication ET non-hôtel/meublé
    let is_first_publication = !has_used_free_trial 
        && type_bien != "hôtel" 
        && type_bien != "meublé"
        && request.jours_visibilite == 30; // Uniquement pour 30 jours (1 mois)

    // Calculer coût
    let prix_bien = prix_vente
        .or(prix_location_mensuel)
        .and_then(|d| d.to_string().parse::<f64>().ok())
        .unwrap_or(0.0);

    if prix_bien <= 0.0 {
        return Err(AppError::BadRequest("Prix du bien doit être supérieur à 0".to_string()));
    }

    let taux_base = match type_bien.as_str() {
        "maison" | "appartement" => 0.005,
        "terrain" => 0.003,
        "bureau" | "local_commercial" => 0.004,
        _ => 0.005,
    };

    let multiplicateur_duree = match request.jours_visibilite {
        7 => 1.0,
        15 => 0.95,
        30 => 0.90,
        60 => 0.85,
        90 => 0.80,
        _ => 1.0,
    };

    let cout_total_fcfa = prix_bien * taux_base * multiplicateur_duree;
    let tokens_necessaires = if is_first_publication {
        0 // ✅ Gratuit pour première publication
    } else {
        cout_total_fcfa as i64
    };

    // Vérifier solde (sauf si première publication gratuite)
    if !is_first_publication {
        let solde_tokens: i64 = sqlx::query_scalar(
            "SELECT tokens_balance FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(&state.pg)
        .await?;

        if solde_tokens < tokens_necessaires {
            if request.auto_recharge.unwrap_or(false) {
                // TODO: Implémenter recharge automatique
                return Err(AppError::BadRequest(format!(
                    "Solde insuffisant. {} tokens nécessaires, {} disponibles. Rechargez votre compte.",
                    tokens_necessaires, solde_tokens
                )));
            } else {
                return Err(AppError::BadRequest(format!(
                    "Solde insuffisant. {} tokens nécessaires, {} disponibles.",
                    tokens_necessaires, solde_tokens
                )));
            }
        }

        // Déduire tokens (sauf si première publication gratuite)
        let payment_service = PaymentService::new(state.pg.clone());
        payment_service.deduct_tokens_from_user(user_id, tokens_necessaires).await
            .map_err(|e| {
                log::error!("[activate_property_visibility] Erreur déduction tokens: {}", e);
                AppError::Internal("Erreur déduction tokens".to_string())
            })?;
    }

    // Calculer dates
    let date_debut = chrono::Utc::now();
    let date_fin = date_debut + chrono::TimeDelta::try_days(request.jours_visibilite as i64)
        .unwrap_or_default();

    // Créer abonnement visibilité
    let subscription_id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO immobilier_visibility_subscriptions (
            property_id, user_id, service_id,
            jours_visibilite, date_debut, date_fin,
            prix_bien, type_bien, taux_commission, cout_total, tokens_deduits,
            status, is_active, is_first_publication
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', TRUE, $12)
        RETURNING id
        "#
    )
    .bind(request.property_id)
    .bind(user_id)
    .bind(service_id)
    .bind(request.jours_visibilite)
    .bind(date_debut)
    .bind(date_fin)
    .bind(Decimal::from_f64_retain(prix_bien).unwrap_or_default())
    .bind(&type_bien)
    .bind(Decimal::from_f64_retain(taux_base).unwrap_or_default())
    .bind(Decimal::from_f64_retain(cout_total_fcfa).unwrap_or_default())
    .bind(tokens_necessaires)
    .bind(is_first_publication) // ✅ NOUVEAU 2026-01-26: Marquer première publication
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[activate_property_visibility] Erreur création abonnement: {}", e);
        AppError::Internal("Erreur création abonnement".to_string())
    })?;

    // Activer visibilité du bien
    sqlx::query(
        r#"
        UPDATE real_estate_properties
        SET 
            is_visible_in_search = TRUE,
            visibility_expires_at = $1,
            visibility_cost_tokens = $2,
            last_visibility_activation = NOW()
        WHERE id = $3
        "#
    )
    .bind(date_fin)
    .bind(tokens_necessaires)
    .bind(request.property_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[activate_property_visibility] Erreur activation visibilité: {}", e);
        AppError::Internal("Erreur activation visibilité".to_string())
    })?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "subscription_id": subscription_id,
            "property_id": request.property_id,
            "jours_visibilite": request.jours_visibilite,
            "date_debut": date_debut.to_rfc3339(),
            "date_fin": date_fin.to_rfc3339(),
            "tokens_deduits": tokens_necessaires,
            "solde_restant": solde_tokens - tokens_necessaires
        }
    })))
}

// ============================================
// 3. RÉACTIVATION APRÈS EXPIRATION
// ============================================

/// POST /api/immobilier/visibility/{property_id}/reactivate
pub async fn reactivate_property_visibility(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(request): Json<ActivateVisibilityRequest>,
) -> AppResult<impl IntoResponse> {
    // Même logique que activation, mais pour réactivation
    activate_property_visibility(State(state), Extension(AuthenticatedUser { id: user_id, role: "user".to_string() }), Json(ActivateVisibilityRequest {
        property_id,
        jours_visibilite: request.jours_visibilite,
        auto_recharge: request.auto_recharge,
    })).await
}

// ============================================
// 4. STATUT VISIBILITÉ
// ============================================

/// GET /api/immobilier/visibility/{property_id}/status
pub async fn get_property_visibility_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let status: Option<Value> = sqlx::query_scalar(
        r#"
        SELECT json_build_object(
            'property_id', p.id,
            'is_visible', p.is_visible_in_search,
            'visibility_expires_at', p.visibility_expires_at,
            'days_remaining', CASE 
                WHEN p.visibility_expires_at > NOW() 
                THEN EXTRACT(DAY FROM (p.visibility_expires_at - NOW()))
                ELSE 0
            END,
            'last_activation', p.last_visibility_activation,
            'active_subscription', (
                SELECT json_build_object(
                    'id', ivs.id,
                    'jours_visibilite', ivs.jours_visibilite,
                    'date_debut', ivs.date_debut,
                    'date_fin', ivs.date_fin,
                    'status', ivs.status,
                    'tokens_deduits', ivs.tokens_deduits
                )
                FROM immobilier_visibility_subscriptions ivs
                WHERE ivs.property_id = p.id 
                AND ivs.status = 'active' 
                AND ivs.is_active = TRUE
                ORDER BY ivs.created_at DESC
                LIMIT 1
            )
        )
        FROM real_estate_properties p
        INNER JOIN services s ON s.id = p.service_id
        WHERE p.id = $1 AND s.user_id = $2
        "#
    )
    .bind(property_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[get_property_visibility_status] Erreur: {}", e);
        AppError::Internal("Erreur récupération statut".to_string())
    })?;

    match status {
        Some(s) => Ok(Json(json!({
            "success": true,
            "data": s
        }))),
        None => Err(AppError::NotFound("Bien non trouvé".to_string())),
    }
}

