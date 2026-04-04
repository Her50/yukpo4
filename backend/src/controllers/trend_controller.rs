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
        trend_aggregator_service::{compute_trend_forecast, get_trend_pulse, supported_regions},
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

#[derive(Debug, Deserialize)]
pub struct TrendSearchParams {
    pub region: Option<String>,
    pub period: Option<String>,
    pub category: Option<String>,
    pub source: Option<String>, // google | twitter | tiktok | reddit | youtube
    pub min_score: Option<f32>, // score minimum (0-100)
    pub min_opportunity: Option<f32>, // opportunity_score minimum
    pub direction: Option<String>, // rising | declining | peak | stable (depuis forecasts)
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct TrendAlertConfig {
    pub region: Option<String>,
    pub min_opportunity_score: Option<f32>,
    pub categories: Option<Vec<String>>,
    pub webhook_url: Option<String>, // URL à notifier (partenaires avancés)
}

#[derive(Debug, Deserialize)]
pub struct ForecastParams {
    pub region: Option<String>,
    pub topic: String,
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

/// GET /api/trends/search
/// Recherche avancée de tendances avec filtres multiples
pub async fn search_trends(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TrendSearchParams>,
) -> Result<Json<Value>, AppError> {
    let region = params.region.as_deref().unwrap_or("CM").to_uppercase();
    let period = params.period.as_deref().unwrap_or("24h");
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let result = get_trend_pulse(&state, &region, period, None).await;
    let mut trends = result.trends;

    // Filtres
    if let Some(cat) = &params.category {
        let cat_lower = cat.to_lowercase();
        trends.retain(|t| t.categories.iter().any(|c| c.to_lowercase().contains(&cat_lower)));
    }
    if let Some(source) = &params.source {
        let source_lower = source.to_lowercase();
        trends.retain(|t| t.sources.iter().any(|s| s.to_lowercase().contains(&source_lower)));
    }
    if let Some(min_score) = params.min_score {
        trends.retain(|t| t.social_score >= min_score);
    }
    if let Some(min_opp) = params.min_opportunity {
        trends.retain(|t| t.opportunity_score >= min_opp);
    }

    let total = trends.len();
    let paginated: Vec<_> = trends.into_iter().skip(offset).take(limit).collect();

    Ok(Json(json!({
        "region": region,
        "period": period,
        "total": total,
        "offset": offset,
        "limit": limit,
        "trends": paginated,
    })))
}

/// GET /api/trends/regions
/// Liste de toutes les régions supportées (Afrique + monde)
pub async fn list_regions() -> Result<Json<Value>, AppError> {
    let regions: Vec<Value> = supported_regions()
        .iter()
        .map(|(code, name)| json!({ "code": code, "name": name }))
        .collect();
    Ok(Json(json!({ "regions": regions })))
}

/// GET /api/trends/forecast
/// Prévision 7 jours pour un topic/région donné
pub async fn get_forecast(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ForecastParams>,
) -> Result<Json<Value>, AppError> {
    let region = params.region.as_deref().unwrap_or("CM").to_uppercase();

    // D'abord tenter de récupérer un forecast récent en DB
    use sqlx::Row;
    let cached = sqlx::query(
        r#"SELECT forecast_day1, forecast_day3, forecast_day7, forecast_day14,
                  confidence, trend_direction, data_points, last_score, computed_at
           FROM trend_forecasts
           WHERE region = $1 AND LOWER(topic) = LOWER($2)
             AND computed_at >= NOW() - INTERVAL '4 hours'
           ORDER BY computed_at DESC LIMIT 1"#,
    )
    .bind(&region)
    .bind(&params.topic)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let forecast = if let Some(row) = cached {
        json!({
            "topic": params.topic,
            "region": region,
            "forecast_day1": row.try_get::<f64, _>("forecast_day1").unwrap_or(0.0),
            "forecast_day3": row.try_get::<f64, _>("forecast_day3").unwrap_or(0.0),
            "forecast_day7": row.try_get::<f64, _>("forecast_day7").unwrap_or(0.0),
            "forecast_day14": row.try_get::<f64, _>("forecast_day14").unwrap_or(0.0),
            "confidence": row.try_get::<f64, _>("confidence").unwrap_or(0.0),
            "trend_direction": row.try_get::<String, _>("trend_direction").unwrap_or_default(),
            "data_points": row.try_get::<i32, _>("data_points").unwrap_or(0),
            "cached": true,
        })
    } else {
        // Calculer le forecast en temps réel
        match compute_trend_forecast(&state.pg, &region, &params.topic).await {
            Some(f) => json!({
                "topic": f.topic,
                "region": f.region,
                "forecast_day1": f.forecast_day1,
                "forecast_day3": f.forecast_day3,
                "forecast_day7": f.forecast_day7,
                "forecast_day14": f.forecast_day14,
                "confidence": f.confidence,
                "trend_direction": f.trend_direction,
                "data_points": f.data_points,
                "cached": false,
            }),
            None => json!({
                "error": "Pas assez de données historiques pour ce topic",
                "topic": params.topic,
                "region": region,
            }),
        }
    };

    Ok(Json(json!({ "forecast": forecast })))
}

/// POST /api/trends/webhook/subscribe
/// Permet à un partenaire avancé de s'abonner aux alertes tendances via webhook
pub async fn subscribe_trend_webhook(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<TrendAlertConfig>,
) -> Result<Json<Value>, AppError> {
    let region = body.region.as_deref().unwrap_or("CM").to_uppercase();
    let min_score = body.min_opportunity_score.unwrap_or(70.0);
    let categories = body.categories.unwrap_or_default();
    let webhook_url = body.webhook_url.as_deref().unwrap_or("");

    let _ = sqlx::query(
        r#"INSERT INTO trend_webhook_subscriptions
           (user_id, region, min_opportunity_score, categories, webhook_url)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, region)
           DO UPDATE SET
             min_opportunity_score = EXCLUDED.min_opportunity_score,
             categories = EXCLUDED.categories,
             webhook_url = EXCLUDED.webhook_url,
             updated_at = NOW()"#,
    )
    .bind(user.id)
    .bind(&region)
    .bind(min_score)
    .bind(&categories[..])
    .bind(webhook_url)
    .execute(&state.pg)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Abonné aux alertes tendances pour la région {}", region),
        "config": {
            "region": region,
            "min_opportunity_score": min_score,
            "categories": categories,
            "has_webhook": !webhook_url.is_empty(),
        }
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
