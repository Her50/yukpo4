// TrendPulse Controller — Yukpo
// GET /api/trends/pulse       → trends globales par région/période
// GET /api/trends/for-me      → trends personnalisées selon profil utilisateur
// GET /api/user/context       → profil commercial complet de l'utilisateur connecté

use axum::{
    extract::{Query, State},
    response::Json,
    Extension,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    core::types::AppError,
    middlewares::jwt::AuthenticatedUser,
    services::{
        trend_aggregator_service::get_trend_pulse,
        user_context_service::load_user_commercial_context,
    },
    state::AppState,
};

// ─── Paramètres de requête ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TrendQueryParams {
    /// Code région : CM, SN, CI, NG, ALL (défaut: CM)
    pub region: Option<String>,
    /// Période : 24h, 7d, 30d (défaut: 24h)
    pub period: Option<String>,
    /// Filtre catégorie (optionnel)
    pub category: Option<String>,
    /// Limite de résultats (défaut: 20)
    pub limit: Option<usize>,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// GET /api/trends/pulse
/// Tendances globales pour une région donnée — accessible sans compte
/// Utilisé par le TrendPulseDashboardScreen
pub async fn get_pulse(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TrendQueryParams>,
) -> Result<Json<Value>, AppError> {
    let region = params.region.as_deref().unwrap_or("CM").to_uppercase();
    let period = params.period.as_deref().unwrap_or("24h");
    let limit = params.limit.unwrap_or(20).min(50);

    let result = get_trend_pulse(&state, &region, period, None).await;

    let mut trends = result.trends;
    if let Some(cat) = &params.category {
        let cat_lower = cat.to_lowercase();
        trends.retain(|t| t.categories.iter().any(|c| c.to_lowercase().contains(&cat_lower)));
    }
    trends.truncate(limit);

    Ok(Json(json!({
        "region": result.region,
        "period": result.period,
        "generated_at": result.generated_at,
        "trends": trends,
        "top_personalities": result.top_personalities,
        "top_sectors": result.top_sectors,
    })))
}

/// GET /api/trends/for-me
/// Tendances personnalisées selon le profil commercial de l'utilisateur connecté
/// Inclut : matching produits, recommandations d'action, scores personnalisés
pub async fn get_trends_for_me(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<TrendQueryParams>,
) -> Result<Json<Value>, AppError> {
    let region = params.region.as_deref().unwrap_or("CM").to_uppercase();
    let period = params.period.as_deref().unwrap_or("24h");
    let limit = params.limit.unwrap_or(10).min(20);

    // Charger le profil commercial réel de l'utilisateur
    let user_ctx = load_user_commercial_context(&state.pg, user.id)
        .await
        .map_err(AppError::Internal)?;

    // Calculer les trends personnalisées
    let result = get_trend_pulse(&state, &region, period, Some(&user_ctx)).await;

    let mut personalized = result.personalized_trends;
    let high_opportunity_count =
        personalized.iter().filter(|t| t.opportunity_score >= 70.0).count();
    personalized.truncate(limit);

    Ok(Json(json!({
        "region": result.region,
        "period": result.period,
        "generated_at": result.generated_at,
        "user_profile": {
            "is_provider": user_ctx.is_provider,
            "sectors": user_ctx.sectors,
            "cities": user_ctx.cities,
            "total_products": user_ctx.total_products,
            "total_promos": user_ctx.total_promos,
            "has_social_accounts": user_ctx.has_social_accounts,
            "has_meta_ads": user_ctx.has_meta_ads,
        },
        "personalized_trends": personalized,
        "top_sectors": result.top_sectors,
        "high_opportunity_count": high_opportunity_count,
    })))
}

/// GET /api/user/context
/// Profil commercial complet de l'utilisateur connecté.
/// Utilisé par intelligentChatService pour enrichir le contexte YukpoIA.
pub async fn get_user_context(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Result<Json<Value>, AppError> {
    let ctx = load_user_commercial_context(&state.pg, user.id)
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(json!({
        "user_id": ctx.user_id,
        "is_provider": ctx.is_provider,
        "sectors": ctx.sectors,
        "cities": ctx.cities,
        "product_categories": ctx.product_categories,
        "total_products": ctx.total_products,
        "total_promos": ctx.total_promos,
        "has_social_accounts": ctx.has_social_accounts,
        "has_meta_ads": ctx.has_meta_ads,
        "services": ctx.services.iter().map(|s| json!({
            "id": s.id,
            "name": s.name,
            "sector": s.sector,
            "city": s.city,
            "specialized_type": s.specialized_type,
            "product_count": s.product_count,
            "promo_count": s.promo_count,
            // Top 6 produits pour le chat context (evite payload trop lourd)
            "products_preview": s.products.iter().take(6).map(|p| json!({
                "id": p.id,
                "name": p.name,
                "price": p.price,
                "sale_price": p.sale_price,
                "category": p.category,
                "is_promo": p.is_promo,
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "ad_signals": ctx.ad_signals.iter().map(|a| json!({
            "campaign_id": a.campaign_id,
            "name": a.name,
            "status": a.status,
            "roas": a.roas,
            "impressions": a.impressions,
            "clicks": a.clicks,
        })).collect::<Vec<_>>(),
        "chatbot_signals": ctx.chatbot_signals.iter().map(|c| json!({
            "service_id": c.service_id,
            "questions_this_week": c.questions_this_week,
            "escalations_this_week": c.escalations_this_week,
            "top_keywords": c.top_keywords,
        })).collect::<Vec<_>>(),
    })))
}
