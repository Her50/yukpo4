// Contrôleur Social AI Engine
// Endpoints: génération contenu, chatbot config, ads, inbox, scheduler, webhooks Meta

use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json, State,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    middlewares::jwt::AuthenticatedUser,
    services::{
        ai_content_service::{self, ContentPreferences, ProductContext, StoreContext},
        meta_ads_service::{self, CampaignObjective, CampaignRequest, TargetingSpec},
        social_chatbot_service, social_inbox_service, social_scheduler_service,
    },
    state::AppState,
    utils::app_error::AppResult,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT AI — Génération de contenu
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct GeneratePostRequest {
    pub service_id: i32,
    pub product_id: i32,
    pub platform: String,
    pub tone: Option<String>,
    pub schedule_at: Option<String>, // ISO8601
}

/// POST /api/social-ai/content/generate
/// Génère un post IA pour un produit
pub async fn generate_post(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<GeneratePostRequest>,
) -> AppResult<Json<serde_json::Value>> {
    // Charger le produit
    let product = sqlx::query!(
        r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
           FROM service_products WHERE id = $1 AND service_id = $2"#,
        payload.product_id,
        payload.service_id,
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?
    .ok_or(crate::utils::app_error::AppError::NotFound(
        "Produit introuvable".to_string(),
    ))?;

    // Charger les infos du service
    let service = sqlx::query!(
        r#"SELECT s.name, s.city, s.phone, COALESCE(st.name, 'commerce') as sector
           FROM services s
           LEFT JOIN service_types st ON st.id = s.service_type_id
           WHERE s.id = $1"#,
        payload.service_id,
    )
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let product_ctx = ProductContext {
        id: product.id,
        name: product.name,
        price: product.price.unwrap_or(0.0),
        sale_price: product.sale_price,
        category: product.category.unwrap_or_else(|| "autres".to_string()),
        description: product.description,
        image_url: product.image_url,
        in_stock: product.is_active,
        brand: product.brand,
    };

    let store_ctx = StoreContext {
        name: service
            .as_ref()
            .map(|s| s.name.clone())
            .unwrap_or_else(|| "Boutique".to_string()),
        sector: service
            .as_ref()
            .and_then(|s| s.sector.clone())
            .unwrap_or_else(|| "commerce".to_string()),
        city: service.as_ref().and_then(|s| s.city.clone()).unwrap_or_default(),
        phone: service.as_ref().and_then(|s| s.phone.clone()),
        yukpo_url: format!(
            "https://yukpomnang.com/boutique/{}?utm_source=ai_post&utm_medium=social",
            payload.service_id
        ),
    };

    let mut prefs =
        ai_content_service::load_preferences(&state.pg, user.id, payload.service_id).await;
    if let Some(tone) = payload.tone {
        prefs.tone = tone;
    }

    let content = ai_content_service::generate_product_post(&product_ctx, &store_ctx, &prefs)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    // Sauvegarder si demandé
    let scheduled_at = payload
        .schedule_at
        .as_ref()
        .and_then(|s| s.parse::<chrono::DateTime<chrono::Utc>>().ok());
    let post_id = ai_content_service::save_generated_post(
        &state.pg,
        user.id,
        payload.service_id,
        Some(payload.product_id),
        &payload.platform,
        &content,
        scheduled_at,
        None,
    )
    .await
    .ok();

    Ok(Json(serde_json::json!({
        "success": true,
        "post_id": post_id,
        "caption_a": content.caption_a,
        "caption_b": content.caption_b,
        "hashtags": content.hashtags,
        "story_text": content.story_text,
        "platform_variants": {
            "facebook": content.platform_variants.facebook,
            "instagram": content.platform_variants.instagram,
            "whatsapp": content.platform_variants.whatsapp,
        },
        "tone_used": content.tone_used,
    })))
}

/// GET /api/social-ai/content/calendar/:service_id?days=7
pub async fn get_content_calendar(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let days: i32 = params.get("days").and_then(|d| d.parse().ok()).unwrap_or(7);
    let calendar =
        social_scheduler_service::get_content_calendar(&state.pg, user.id, service_id, days)
            .await
            .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "calendar": calendar,
        "count": calendar.len(),
    })))
}

/// GET /api/social-ai/content/posts/:service_id
pub async fn list_posts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let status = params.get("status").map(|s| s.as_str()).unwrap_or("all");
    let limit: i64 = params.get("limit").and_then(|d| d.parse().ok()).unwrap_or(20);

    let posts = sqlx::query!(
        r#"SELECT p.id, p.platform, p.caption, p.status, p.tone,
                  p.scheduled_at, p.published_at, p.engagement_a, p.ab_winner,
                  sp.name as product_name
           FROM social_ai_posts p
           LEFT JOIN service_products sp ON sp.id = p.product_id
           WHERE p.user_id = $1 AND p.service_id = $2
             AND ($3 = 'all' OR p.status = $3)
           ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
           LIMIT $4"#,
        user.id,
        service_id,
        status,
        limit,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "posts": posts.iter().map(|p| serde_json::json!({
            "id": p.id,
            "platform": p.platform,
            "caption_preview": p.caption.chars().take(100).collect::<String>(),
            "status": p.status,
            "tone": p.tone,
            "scheduled_at": p.scheduled_at,
            "published_at": p.published_at,
            "product_name": p.product_name,
            "ab_winner": p.ab_winner,
        })).collect::<Vec<_>>(),
    })))
}

/// PUT /api/social-ai/content/preferences/:service_id
#[derive(Deserialize)]
pub struct PreferencesRequest {
    pub default_tone: Option<String>,
    pub default_language: Option<String>,
    pub brand_voice: Option<String>,
    pub forbidden_words: Option<Vec<String>>,
    pub always_include: Option<Vec<String>>,
    pub default_hashtags: Option<Vec<String>>,
    pub max_posts_per_day: Option<i32>,
    pub sector: Option<String>,
}

pub async fn update_content_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(payload): Json<PreferencesRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let tone = payload.default_tone.unwrap_or_else(|| "professional".to_string());
    let lang = payload.default_language.unwrap_or_else(|| "fr".to_string());
    let max_posts = payload.max_posts_per_day.unwrap_or(5);
    let forbidden = payload.forbidden_words.unwrap_or_default();
    let always_include = payload.always_include.unwrap_or_default();
    let hashtags = payload.default_hashtags.unwrap_or_default();

    sqlx::query!(
        r#"INSERT INTO social_ai_preferences
           (user_id, service_id, default_tone, default_language, brand_voice,
            forbidden_words, always_include, default_hashtags, max_posts_per_day, sector)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id, service_id) DO UPDATE SET
             default_tone = EXCLUDED.default_tone,
             default_language = EXCLUDED.default_language,
             brand_voice = EXCLUDED.brand_voice,
             forbidden_words = EXCLUDED.forbidden_words,
             always_include = EXCLUDED.always_include,
             default_hashtags = EXCLUDED.default_hashtags,
             max_posts_per_day = EXCLUDED.max_posts_per_day,
             sector = EXCLUDED.sector,
             updated_at = NOW()"#,
        user.id,
        service_id,
        tone,
        lang,
        payload.brand_voice,
        &forbidden,
        &always_include,
        &hashtags,
        max_posts,
        payload.sector,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?;

    Ok(Json(
        serde_json::json!({"success": true, "message": "Préférences sauvegardées"}),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHATBOT — Webhooks Meta + Configuration
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/webhook/verify (vérification webhook Meta)
pub async fn verify_webhook(
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let mode = params.get("hub.mode").map(|s| s.as_str()).unwrap_or("");
    let token = params.get("hub.verify_token").map(|s| s.as_str()).unwrap_or("");
    let challenge = params.get("hub.challenge").map(|s| s.as_str()).unwrap_or("");

    let expected_token = std::env::var("META_WEBHOOK_VERIFY_TOKEN")
        .unwrap_or_else(|_| "yukpo_webhook_2026".to_string());

    if mode == "subscribe" && token == expected_token {
        (StatusCode::OK, challenge.to_string())
    } else {
        (StatusCode::FORBIDDEN, "Forbidden".to_string())
    }
}

/// POST /api/social-ai/webhook/messenger (messages Facebook Messenger entrants)
pub async fn messenger_webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    process_meta_webhook(state, payload, "messenger").await;
    (StatusCode::OK, "EVENT_RECEIVED")
}

/// POST /api/social-ai/webhook/instagram (messages Instagram DM entrants)
pub async fn instagram_dm_webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    process_meta_webhook(state, payload, "instagram_dm").await;
    (StatusCode::OK, "EVENT_RECEIVED")
}

/// POST /api/social-ai/webhook/whatsapp (messages WhatsApp entrants)
pub async fn whatsapp_webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    process_whatsapp_webhook(state, payload).await;
    (StatusCode::OK, "EVENT_RECEIVED")
}

async fn process_meta_webhook(
    state: Arc<AppState>,
    payload: serde_json::Value,
    platform: &'static str,
) {
    let entries = match payload["entry"].as_array() {
        Some(e) => e.clone(),
        None => return,
    };

    for entry in entries {
        let page_id = entry["id"].as_str().unwrap_or("").to_string();
        let messagings = entry["messaging"].as_array().cloned().unwrap_or_default();

        for messaging in messagings {
            let sender_id = messaging["sender"]["id"].as_str().unwrap_or("");
            let text = messaging["message"]["text"].as_str().unwrap_or("");

            if sender_id.is_empty() || text.is_empty() {
                continue;
            }

            // Trouver le partenaire Yukpo propriétaire de cette page
            let partner = sqlx::query!(
                r#"SELECT sa.user_id,
                          COALESCE(
                            (SELECT service_id FROM distribution_rules WHERE user_id = sa.user_id LIMIT 1),
                            0
                          ) as service_id
                   FROM social_accounts sa
                   WHERE sa.platform = 'facebook'
                     AND (sa.metadata->>'page_id' = $1
                          OR EXISTS (
                            SELECT 1 FROM jsonb_array_elements(sa.metadata->'pages') p
                            WHERE p->>'id' = $1
                          ))"#,
                page_id,
            )
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

            if let Some(p) = partner {
                if p.service_id.unwrap_or(0) > 0 {
                    let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                        &state.pg,
                        p.user_id,
                        p.service_id.unwrap_or(0),
                        platform,
                        sender_id,
                        messaging["sender"]["name"].as_str(),
                        text,
                        Some(&page_id),
                        &messaging,
                    )
                    .await;
                }
            }
        }
    }
}

async fn process_whatsapp_webhook(state: Arc<AppState>, payload: serde_json::Value) {
    let entries = match payload["entry"].as_array() {
        Some(e) => e.clone(),
        None => return,
    };

    for entry in entries {
        let changes = entry["changes"].as_array().cloned().unwrap_or_default();
        for change in changes {
            if change["field"].as_str() != Some("messages") {
                continue;
            }
            let value = &change["value"];
            let messages = value["messages"].as_array().cloned().unwrap_or_default();
            let phone_number_id = value["metadata"]["phone_number_id"].as_str().unwrap_or("");

            for msg in messages {
                let from = msg["from"].as_str().unwrap_or("");
                let text = msg["text"]["body"].as_str().unwrap_or("");
                let sender_name = value["contacts"][0]["profile"]["name"].as_str();

                if from.is_empty() || text.is_empty() {
                    continue;
                }

                // Trouver le partenaire par le phone_number_id
                let partner = sqlx::query!(
                    r#"SELECT user_id,
                              COALESCE((SELECT service_id FROM distribution_rules WHERE user_id = sa2.user_id LIMIT 1), 0) as service_id
                       FROM social_accounts sa2
                       WHERE platform = 'whatsapp'
                         AND metadata->>'phone_number_id' = $1"#,
                    phone_number_id,
                )
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten();

                if let Some(p) = partner {
                    if p.service_id.unwrap_or(0) > 0 {
                        let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                            &state.pg,
                            p.user_id,
                            p.service_id.unwrap_or(0),
                            "whatsapp",
                            from,
                            sender_name,
                            text,
                            Some(phone_number_id),
                            &msg,
                        )
                        .await;
                    }
                }
            }
        }
    }
}

/// PUT /api/social-ai/chatbot/config/:service_id
#[derive(Deserialize)]
pub struct ChatbotConfigRequest {
    pub is_active: Option<bool>,
    pub bot_name: Option<String>,
    pub welcome_message: Option<String>,
    pub away_message: Option<String>,
    pub escalation_trigger_words: Option<Vec<String>>,
    pub business_hours: Option<serde_json::Value>,
    pub max_ai_tokens_per_response: Option<i32>,
    pub language: Option<String>,
    pub reply_delay_ms: Option<i32>,
    pub auto_suggest_products: Option<bool>,
}

pub async fn update_chatbot_config(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Json(payload): Json<ChatbotConfigRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let is_active = payload.is_active.unwrap_or(true);
    let bot_name = payload.bot_name.unwrap_or_else(|| "Assistant".to_string());
    let max_tokens = payload.max_ai_tokens_per_response.unwrap_or(400);
    let lang = payload.language.unwrap_or_else(|| "fr".to_string());
    let delay = payload.reply_delay_ms.unwrap_or(1500);
    let trigger_words = payload.escalation_trigger_words.unwrap_or_else(|| {
        vec![
            "plainte".to_string(),
            "arnaque".to_string(),
            "remboursement".to_string(),
        ]
    });
    let business_hours = payload.business_hours.unwrap_or_else(|| {
        serde_json::json!({
            "mon": {"open": "08:00", "close": "20:00"},
            "tue": {"open": "08:00", "close": "20:00"},
            "wed": {"open": "08:00", "close": "20:00"},
            "thu": {"open": "08:00", "close": "20:00"},
            "fri": {"open": "08:00", "close": "20:00"},
            "sat": {"open": "08:00", "close": "18:00"}
        })
    });

    sqlx::query!(
        r#"INSERT INTO social_chatbot_config
           (user_id, service_id, is_active, bot_name, welcome_message, away_message,
            escalation_trigger_words, business_hours, max_ai_tokens_per_response, language, reply_delay_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (user_id, service_id) DO UPDATE SET
             is_active = EXCLUDED.is_active,
             bot_name = EXCLUDED.bot_name,
             welcome_message = EXCLUDED.welcome_message,
             away_message = EXCLUDED.away_message,
             escalation_trigger_words = EXCLUDED.escalation_trigger_words,
             business_hours = EXCLUDED.business_hours,
             max_ai_tokens_per_response = EXCLUDED.max_ai_tokens_per_response,
             language = EXCLUDED.language,
             reply_delay_ms = EXCLUDED.reply_delay_ms,
             updated_at = NOW()"#,
        user.id, service_id, is_active, bot_name,
        payload.welcome_message, payload.away_message,
        &trigger_words, business_hours, max_tokens, lang, delay,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?;

    Ok(Json(
        serde_json::json!({"success": true, "message": "Configuration chatbot sauvegardée"}),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// INBOX — Conversations
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/inbox/:service_id
pub async fn list_inbox(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let filter = params.get("filter").map(|s| s.as_str()).unwrap_or("all");
    let platform = params.get("platform").map(|s| s.as_str());
    let page: i32 = params.get("page").and_then(|d| d.parse().ok()).unwrap_or(1);

    let threads = social_inbox_service::list_inbox_threads(
        &state.pg, user.id, service_id, filter, platform, page, 20,
    )
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    let stats = social_inbox_service::get_inbox_stats(&state.pg, user.id, service_id)
        .await
        .unwrap_or(social_inbox_service::InboxStats {
            total_conversations: 0,
            unread_conversations: 0,
            escalated: 0,
            bot_handled_today: 0,
            avg_response_time_ms: None,
            by_platform: vec![],
        });

    Ok(Json(serde_json::json!({
        "success": true,
        "threads": threads,
        "stats": stats,
        "page": page,
    })))
}

/// GET /api/social-ai/inbox/thread/:thread_id
pub async fn get_thread(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(thread_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let detail = social_inbox_service::get_conversation_detail(&state.pg, user.id, thread_id)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    Ok(Json(
        serde_json::json!({"success": true, "conversation": detail}),
    ))
}

/// POST /api/social-ai/inbox/thread/:thread_id/escalate
#[derive(Deserialize)]
pub struct EscalateRequest {
    pub reason: String,
}

pub async fn escalate_thread(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(thread_id): Path<i32>,
    Json(payload): Json<EscalateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    social_inbox_service::escalate_thread(&state.pg, user.id, thread_id, &payload.reason)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// POST /api/social-ai/inbox/thread/:thread_id/resolve
pub async fn resolve_thread(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(thread_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    social_inbox_service::resolve_escalation(&state.pg, user.id, thread_id, user.id)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;
    Ok(Json(serde_json::json!({"success": true})))
}

/// POST /api/social-ai/inbox/thread/:thread_id/note
#[derive(Deserialize)]
pub struct NoteRequest {
    pub note: String,
}

pub async fn add_thread_note(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(thread_id): Path<i32>,
    Json(payload): Json<NoteRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let note_id = social_inbox_service::add_note(&state.pg, thread_id, user.id, &payload.note)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;
    Ok(Json(
        serde_json::json!({"success": true, "note_id": note_id}),
    ))
}

/// GET /api/social-ai/inbox/:service_id/search?q=...
pub async fn search_inbox(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    let q = params.get("q").map(|s| s.as_str()).unwrap_or("");
    let results = social_inbox_service::search_conversations(&state.pg, user.id, service_id, q)
        .await
        .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;
    Ok(Json(
        serde_json::json!({"success": true, "results": results}),
    ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// META ADS — Publicités
// ═══════════════════════════════════════════════════════════════════════════════

/// POST /api/social-ai/ads/account
#[derive(Deserialize)]
pub struct AdAccountRequest {
    pub service_id: i32,
    pub ad_account_id: String,
    pub access_token: String,
    pub currency: Option<String>,
    pub monthly_budget_fcfa: Option<i64>,
    pub pixel_id: Option<String>,
}

pub async fn save_ad_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AdAccountRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let currency = payload.currency.unwrap_or_else(|| "XAF".to_string());
    let budget = payload.monthly_budget_fcfa.unwrap_or(0);

    sqlx::query!(
        r#"INSERT INTO meta_ad_accounts
           (user_id, service_id, ad_account_id, access_token, currency, monthly_budget_fcfa, pixel_id, account_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
           ON CONFLICT (user_id, ad_account_id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             currency = EXCLUDED.currency,
             monthly_budget_fcfa = EXCLUDED.monthly_budget_fcfa,
             pixel_id = EXCLUDED.pixel_id,
             updated_at = NOW()"#,
        user.id, payload.service_id, payload.ad_account_id,
        payload.access_token, currency, budget, payload.pixel_id,
    )
    .execute(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?;

    Ok(Json(
        serde_json::json!({"success": true, "message": "Compte publicitaire enregistré"}),
    ))
}

/// POST /api/social-ai/ads/campaign/promo
#[derive(Deserialize)]
pub struct PromoCampaignRequest {
    pub service_id: i32,
    pub product_id: i32,
    pub budget_daily_fcfa: i64,
    pub countries: Option<Vec<String>>,
    pub age_min: Option<u32>,
    pub age_max: Option<u32>,
}

pub async fn create_promo_campaign(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<PromoCampaignRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let account = meta_ads_service::load_ad_account(&state.pg, user.id, payload.service_id)
        .await
        .ok_or(crate::utils::app_error::AppError::NotFound(
            "Compte publicitaire non configuré. Ajoutez votre Ad Account ID d'abord.".to_string(),
        ))?;

    let product = sqlx::query!(
        "SELECT id, name, price, sale_price, image_url FROM service_products WHERE id = $1 AND service_id = $2",
        payload.product_id, payload.service_id,
    )
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?
    .ok_or(crate::utils::app_error::AppError::NotFound("Produit introuvable".to_string()))?;

    let service_info = sqlx::query!(
        "SELECT name FROM services WHERE id = $1",
        payload.service_id
    )
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();
    let store_name = service_info.as_ref().map(|s| s.name.as_str()).unwrap_or("Boutique");

    let targeting = TargetingSpec {
        countries: payload.countries.unwrap_or_else(|| vec!["CM".to_string()]),
        age_min: payload.age_min.unwrap_or(18),
        age_max: payload.age_max.unwrap_or(55),
        ..Default::default()
    };

    let yukpo_url = format!(
        "https://yukpomnang.com/produit/{}?utm_source=meta_ads&utm_medium=promo",
        product.id
    );

    let result = meta_ads_service::create_promo_campaign(
        &account,
        &product.name,
        product.image_url.as_deref(),
        product.price.unwrap_or(0.0),
        product.sale_price.unwrap_or(product.price.unwrap_or(0.0)),
        &yukpo_url,
        payload.budget_daily_fcfa,
        &targeting,
        store_name,
    )
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    // Enregistrer en BDD
    let ad_account_db = sqlx::query_scalar!(
        "SELECT id FROM meta_ad_accounts WHERE user_id = $1 AND ad_account_id = $2",
        user.id,
        account.ad_account_id,
    )
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let _ = sqlx::query!(
        r#"INSERT INTO meta_ad_campaigns
           (user_id, service_id, ad_account_id, external_campaign_id, name,
            objective, campaign_type, status, budget_daily_fcfa, target_product_ids)
           VALUES ($1, $2, $3, $4, $5, 'OUTCOME_SALES', 'manual', 'active', $6, $7)"#,
        user.id,
        payload.service_id,
        ad_account_db,
        result.external_campaign_id,
        format!("Promo: {}", product.name),
        payload.budget_daily_fcfa,
        &[product.id],
    )
    .execute(&state.pg)
    .await;

    Ok(Json(serde_json::json!({
        "success": true,
        "campaign_id": result.external_campaign_id,
        "adset_id": result.adset_id,
        "ad_id": result.ad_id,
        "message": format!("Campagne créée pour '{}'", product.name),
    })))
}

/// GET /api/social-ai/ads/campaigns/:service_id
pub async fn list_campaigns(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let campaigns = sqlx::query!(
        r#"SELECT id, name, campaign_type, status, budget_daily_fcfa,
                  impressions, clicks, spent_fcfa, roas, conversions, created_at
           FROM meta_ad_campaigns
           WHERE user_id = $1 AND service_id = $2
           ORDER BY created_at DESC
           LIMIT 20"#,
        user.id,
        service_id,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e.to_string()))?;

    let total_spent: i64 = campaigns.iter().map(|c| c.spent_fcfa).sum();
    let total_conversions: i32 = campaigns.iter().map(|c| c.conversions).sum();

    Ok(Json(serde_json::json!({
        "success": true,
        "campaigns": campaigns.iter().map(|c| serde_json::json!({
            "id": c.id,
            "name": c.name,
            "type": c.campaign_type,
            "status": c.status,
            "budget_daily_fcfa": c.budget_daily_fcfa,
            "impressions": c.impressions,
            "clicks": c.clicks,
            "spent_fcfa": c.spent_fcfa,
            "roas": c.roas,
            "conversions": c.conversions,
            "created_at": c.created_at,
        })).collect::<Vec<_>>(),
        "totals": {
            "spent_fcfa": total_spent,
            "conversions": total_conversions,
        }
    })))
}

/// POST /api/social-ai/ads/dpa (Dynamic Product Ads)
#[derive(Deserialize)]
pub struct DpaRequest {
    pub service_id: i32,
    pub catalog_id: String,
    pub budget_daily_fcfa: i64,
    pub countries: Option<Vec<String>>,
}

pub async fn create_dpa_campaign(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<DpaRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let account = meta_ads_service::load_ad_account(&state.pg, user.id, payload.service_id)
        .await
        .ok_or(crate::utils::app_error::AppError::NotFound(
            "Compte publicitaire non configuré".to_string(),
        ))?;

    let service_info = sqlx::query!(
        "SELECT name FROM services WHERE id = $1",
        payload.service_id
    )
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();
    let store_name = service_info.as_ref().map(|s| s.name.as_str()).unwrap_or("Boutique");

    let targeting = TargetingSpec {
        countries: payload.countries.unwrap_or_else(|| vec!["CM".to_string()]),
        ..Default::default()
    };

    let result = meta_ads_service::create_dynamic_product_ads(
        &account,
        &payload.catalog_id,
        store_name,
        payload.budget_daily_fcfa,
        &targeting,
    )
    .await
    .map_err(|e| crate::utils::app_error::AppError::Internal(e))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "campaign_id": result.external_campaign_id,
        "message": "Dynamic Product Ads créées. Le retargeting est actif.",
    })))
}
