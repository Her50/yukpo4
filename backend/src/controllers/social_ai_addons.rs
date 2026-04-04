// social_ai_addons.rs
// CRM léger, Email marketing IA, Vision enrichissement catalogue,
// WhatsApp payment links, Marketplace cross-partenaires

use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    state::AppState,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRM LÉGER — Profils clients, historique, segmentation
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/crm/customers/:service_id
pub async fn list_crm_customers(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;
    let segment = params.get("segment").map(|s| s.as_str()).unwrap_or("all");
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(50);

    let segment_filter = match segment {
        "vip" => "AND cm.is_vip = TRUE",
        "high_value" => "AND cm.total_spent_fcfa > 10000",
        "active_7d" => "AND cm.last_seen_at >= NOW() - INTERVAL '7 days'",
        "active_30d" => "AND cm.last_seen_at >= NOW() - INTERVAL '30 days'",
        "follow_up" => "AND cm.follow_up_needed = TRUE",
        _ => "",
    };

    let sql = format!(
        r#"SELECT cm.id, cm.customer_external_id, cm.platform, cm.customer_name,
                  cm.total_orders, cm.total_spent_fcfa, cm.last_order_at,
                  cm.sentiment_overall, cm.is_vip, cm.last_seen_at, cm.first_seen_at,
                  cm.conversation_count, cm.preferred_category, cm.follow_up_needed,
                  cm.follow_up_note, cm.follow_up_at,
                  t.status AS thread_status, t.total_messages
           FROM customer_memory cm
           LEFT JOIN social_chatbot_threads t
             ON t.user_id = cm.user_id AND t.service_id = cm.service_id
             AND t.platform = cm.platform AND t.external_sender_id = cm.customer_external_id
           WHERE cm.user_id = $1 AND cm.service_id = $2
           {}
           ORDER BY cm.last_seen_at DESC
           LIMIT $3"#,
        segment_filter
    );

    let rows = sqlx::query(&sql)
        .bind(user.id)
        .bind(service_id)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

    let customers: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.try_get::<i64,_>("id").unwrap_or(0),
                "external_id": r.try_get::<String,_>("customer_external_id").unwrap_or_default(),
                "platform": r.try_get::<String,_>("platform").unwrap_or_default(),
                "name": r.try_get::<Option<String>,_>("customer_name").unwrap_or(None),
                "total_orders": r.try_get::<i32,_>("total_orders").unwrap_or(0),
                "total_spent_fcfa": r.try_get::<i64,_>("total_spent_fcfa").unwrap_or(0),
                "sentiment": r.try_get::<Option<String>,_>("sentiment_overall").unwrap_or(None),
                "is_vip": r.try_get::<bool,_>("is_vip").unwrap_or(false),
                "last_seen_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("last_seen_at").unwrap_or(None),
                "conversation_count": r.try_get::<i32,_>("conversation_count").unwrap_or(0),
                "preferred_category": r.try_get::<Option<String>,_>("preferred_category").unwrap_or(None),
                "follow_up_needed": r.try_get::<bool,_>("follow_up_needed").unwrap_or(false),
                "thread_status": r.try_get::<Option<String>,_>("thread_status").unwrap_or(None),
            })
        })
        .collect();

    let stats_row = sqlx::query(
        r#"SELECT COUNT(*) AS total,
                  SUM(CASE WHEN is_vip THEN 1 ELSE 0 END) AS vip_count,
                  SUM(CASE WHEN follow_up_needed THEN 1 ELSE 0 END) AS follow_up_count,
                  COALESCE(SUM(total_spent_fcfa), 0) AS total_revenue
           FROM customer_memory
           WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let stats = stats_row
        .map(|r| {
            serde_json::json!({
                "total_customers": r.try_get::<i64,_>("total").unwrap_or(0),
                "vip_count": r.try_get::<i64,_>("vip_count").unwrap_or(0),
                "follow_up_count": r.try_get::<i64,_>("follow_up_count").unwrap_or(0),
                "total_revenue_fcfa": r.try_get::<i64,_>("total_revenue").unwrap_or(0),
            })
        })
        .unwrap_or(serde_json::json!({}));

    Ok(Json(serde_json::json!({
        "service_id": service_id,
        "segment": segment,
        "customers": customers,
        "stats": stats,
    })))
}

/// GET /api/social-ai/crm/customer/:service_id/:external_id
pub async fn get_crm_customer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, external_id)): Path<(i32, String)>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let profile = sqlx::query(
        r#"SELECT cm.*, t.id AS thread_id, t.status AS thread_status,
                  t.total_messages, t.last_message_at, t.tags
           FROM customer_memory cm
           LEFT JOIN social_chatbot_threads t
             ON t.user_id = cm.user_id AND t.service_id = cm.service_id
             AND t.platform = cm.platform AND t.external_sender_id = cm.customer_external_id
           WHERE cm.user_id = $1 AND cm.service_id = $2 AND cm.customer_external_id = $3
           LIMIT 1"#,
    )
    .bind(user.id)
    .bind(service_id)
    .bind(&external_id)
    .fetch_optional(&state.pg)
    .await?;

    let (profile_json, messages) = if let Some(ref r) = profile {
        let thread_id: Option<i32> = r.try_get("thread_id").ok();
        let msgs = if let Some(tid) = thread_id {
            sqlx::query(
                r#"SELECT direction, sender_type, content, created_at
                   FROM social_chatbot_messages
                   WHERE thread_id = $1
                   ORDER BY created_at DESC LIMIT 20"#,
            )
            .bind(tid)
            .fetch_all(&state.pg)
            .await
            .unwrap_or_default()
            .iter()
            .map(|m| {
                serde_json::json!({
                    "direction": m.try_get::<String,_>("direction").unwrap_or_default(),
                    "sender_type": m.try_get::<String,_>("sender_type").unwrap_or_default(),
                    "content": m.try_get::<String,_>("content").unwrap_or_default(),
                    "created_at": m.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("created_at").unwrap_or(None),
                })
            })
            .collect::<Vec<_>>()
        } else {
            vec![]
        };

        let pj = serde_json::json!({
            "external_id": r.try_get::<String,_>("customer_external_id").unwrap_or_default(),
            "platform": r.try_get::<String,_>("platform").unwrap_or_default(),
            "name": r.try_get::<Option<String>,_>("customer_name").unwrap_or(None),
            "total_orders": r.try_get::<i32,_>("total_orders").unwrap_or(0),
            "total_spent_fcfa": r.try_get::<i64,_>("total_spent_fcfa").unwrap_or(0),
            "preferred_products": r.try_get::<Option<Vec<String>>,_>("preferred_products").unwrap_or(None),
            "preferred_category": r.try_get::<Option<String>,_>("preferred_category").unwrap_or(None),
            "sentiment": r.try_get::<Option<String>,_>("sentiment_overall").unwrap_or(None),
            "is_vip": r.try_get::<bool,_>("is_vip").unwrap_or(false),
            "vip_reason": r.try_get::<Option<String>,_>("vip_reason").unwrap_or(None),
            "last_seen_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("last_seen_at").unwrap_or(None),
            "first_seen_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("first_seen_at").unwrap_or(None),
            "conversation_count": r.try_get::<i32,_>("conversation_count").unwrap_or(0),
            "follow_up_needed": r.try_get::<bool,_>("follow_up_needed").unwrap_or(false),
            "follow_up_note": r.try_get::<Option<String>,_>("follow_up_note").unwrap_or(None),
            "last_intent": r.try_get::<Option<String>,_>("last_intent").unwrap_or(None),
            "thread_status": r.try_get::<Option<String>,_>("thread_status").unwrap_or(None),
            "total_messages": r.try_get::<Option<i32>,_>("total_messages").unwrap_or(None),
            "tags": r.try_get::<Option<Vec<String>>,_>("tags").unwrap_or(None),
        });
        (Some(pj), msgs)
    } else {
        (None, vec![])
    };

    Ok(Json(serde_json::json!({
        "profile": profile_json,
        "recent_messages": messages,
    })))
}

#[derive(Deserialize)]
pub struct CrmUpdateRequest {
    pub is_vip: Option<bool>,
    pub vip_reason: Option<String>,
    pub follow_up_needed: Option<bool>,
    pub follow_up_note: Option<String>,
}

/// PATCH /api/social-ai/crm/customer/:service_id/:external_id
pub async fn update_crm_customer(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, external_id)): Path<(i32, String)>,
    Json(payload): Json<CrmUpdateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query(
        r#"UPDATE customer_memory
           SET is_vip = COALESCE($4, is_vip),
               vip_reason = COALESCE($5, vip_reason),
               follow_up_needed = COALESCE($6, follow_up_needed),
               follow_up_note = COALESCE($7, follow_up_note)
           WHERE user_id = $1 AND service_id = $2 AND customer_external_id = $3"#,
    )
    .bind(user.id)
    .bind(service_id)
    .bind(&external_id)
    .bind(payload.is_vip)
    .bind(&payload.vip_reason)
    .bind(payload.follow_up_needed)
    .bind(&payload.follow_up_note)
    .execute(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({ "updated": true })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL MARKETING — Campagnes IA
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CreateEmailCampaignRequest {
    pub service_id: i32,
    pub name: String,
    pub subject: Option<String>,
    pub topic: String,
    pub target_segment: Option<String>,
}

/// POST /api/social-ai/email/campaigns
pub async fn create_email_campaign(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateEmailCampaignRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use crate::services::yukpo_openai_outbound::resolve_openai_api_key;
    use sqlx::Row;

    let api_key = resolve_openai_api_key()
        .ok_or_else(|| AppError::Internal("OPENAI_API_KEY manquante".to_string()))?;

    let prefs_row = sqlx::query(
        r#"SELECT brand_name, tone, language
           FROM social_ai_preferences
           WHERE user_id = $1 AND service_id = $2 LIMIT 1"#,
    )
    .bind(user.id)
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let brand = prefs_row
        .as_ref()
        .and_then(|r| r.try_get::<Option<String>, _>("brand_name").ok().flatten())
        .unwrap_or_else(|| "notre boutique".to_string());

    // Appel direct à l'API OpenAI (chat completions JSON)
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "model": "gpt-4o",
            "messages": [
                {"role": "system", "content": format!(
                    "Tu es expert en email marketing pour {}. \
                     Génère des emails engageants et orientés conversion. \
                     Réponds en JSON avec: subject, content_text (texte brut 200 mots max), \
                     content_html (HTML simple avec balises basiques).",
                    brand
                )},
                {"role": "user", "content": format!(
                    "Crée une campagne email sur: \"{}\". Cible: clients {}.",
                    payload.topic,
                    payload.target_segment.as_deref().unwrap_or("tous")
                )}
            ],
            "max_tokens": 1000,
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let resp_json: serde_json::Value =
        resp.json().await.map_err(|e| AppError::Internal(e.to_string()))?;
    let content_str = resp_json["choices"][0]["message"]["content"].as_str().unwrap_or("{}");
    let result: serde_json::Value =
        serde_json::from_str(content_str).unwrap_or(serde_json::json!({}));

    let subject = payload
        .subject
        .clone()
        .or_else(|| result["subject"].as_str().map(String::from))
        .unwrap_or_else(|| payload.topic.clone());
    let content_text = result["content_text"].as_str().unwrap_or("").to_string();
    let content_html = result["content_html"].as_str().map(String::from);
    let segment = payload.target_segment.as_deref().unwrap_or("all");

    let recipient_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM customer_memory WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(user.id)
    .bind(payload.service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let campaign_id: i32 = sqlx::query_scalar(
        r#"INSERT INTO email_campaigns
               (service_id, user_id, name, subject, content_text, content_html,
                status, target_segment, recipient_count)
           VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
           RETURNING id"#,
    )
    .bind(payload.service_id)
    .bind(user.id)
    .bind(&payload.name)
    .bind(&subject)
    .bind(&content_text)
    .bind(&content_html)
    .bind(segment)
    .bind(recipient_count)
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({
        "campaign_id": campaign_id,
        "subject": subject,
        "content_text": content_text,
        "content_html": content_html,
        "recipient_count": recipient_count,
        "segment": segment,
        "status": "draft",
    })))
}

/// GET /api/social-ai/email/campaigns/:service_id
pub async fn list_email_campaigns(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let rows = sqlx::query(
        r#"SELECT id, name, subject, status, target_segment, recipient_count,
                  sent_count, open_count, click_count, scheduled_at, sent_at, created_at
           FROM email_campaigns
           WHERE service_id = $1 AND user_id = $2
           ORDER BY created_at DESC LIMIT 50"#,
    )
    .bind(service_id)
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let campaigns: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let sent = r.try_get::<i32, _>("sent_count").unwrap_or(0);
            let opens = r.try_get::<i32, _>("open_count").unwrap_or(0);
            let clicks = r.try_get::<i32, _>("click_count").unwrap_or(0);
            serde_json::json!({
                "id": r.try_get::<i32,_>("id").unwrap_or(0),
                "name": r.try_get::<String,_>("name").unwrap_or_default(),
                "subject": r.try_get::<String,_>("subject").unwrap_or_default(),
                "status": r.try_get::<String,_>("status").unwrap_or_default(),
                "segment": r.try_get::<String,_>("target_segment").unwrap_or_default(),
                "recipient_count": r.try_get::<i32,_>("recipient_count").unwrap_or(0),
                "sent_count": sent,
                "open_rate": if sent > 0 { opens * 100 / sent } else { 0 },
                "click_rate": if sent > 0 { clicks * 100 / sent } else { 0 },
                "scheduled_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("scheduled_at").unwrap_or(None),
                "sent_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("sent_at").unwrap_or(None),
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("created_at").unwrap_or(None),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "campaigns": campaigns })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISION AI — Enrichissement catalogue depuis photo
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct EnrichProductVisionRequest {
    pub service_id: i32,
    pub product_id: Option<i32>,
    pub image_url: String,
    pub product_name: Option<String>,
}

/// POST /api/social-ai/content/enrich-product
pub async fn enrich_product_vision(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<EnrichProductVisionRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use crate::services::yukpo_openai_outbound::resolve_openai_api_key;

    let api_key = resolve_openai_api_key()
        .ok_or_else(|| AppError::Internal("OPENAI_API_KEY manquante".to_string()))?;

    let product_hint = payload.product_name.as_deref().unwrap_or("produit");

    let messages = serde_json::json!([{
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": format!(
                    "Tu es expert e-commerce africain. Analyse cette image du produit '{}'. \
                     Génère en JSON: {{\"name\": \"nom commercial attractif\", \
                     \"description\": \"description vendeuse 2-3 phrases\", \
                     \"tags\": [\"tag1\",\"tag2\",\"tag3\"], \
                     \"suggested_price_fcfa\": 0, \
                     \"category\": \"catégorie\", \
                     \"selling_points\": [\"point1\",\"point2\"]}}",
                    product_hint
                )
            },
            {
                "type": "image_url",
                "image_url": { "url": &payload.image_url, "detail": "low" }
            }
        ]
    }]);

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "model": "gpt-4o",
            "messages": messages,
            "max_tokens": 600,
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let resp_json: serde_json::Value =
        resp.json().await.map_err(|e| AppError::Internal(e.to_string()))?;

    let content_str = resp_json["choices"][0]["message"]["content"].as_str().unwrap_or("{}");
    let enriched: serde_json::Value =
        serde_json::from_str(content_str).unwrap_or(serde_json::json!({}));

    if let Some(product_id) = payload.product_id {
        let ai_desc = enriched["description"].as_str().unwrap_or("");
        let ai_tags: Vec<String> = enriched["tags"]
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let _ = sqlx::query(
            r#"UPDATE service_products
               SET ai_description = $3, ai_tags = $4, ai_enriched_at = NOW()
               WHERE id = $1 AND service_id = $2"#,
        )
        .bind(product_id)
        .bind(payload.service_id)
        .bind(ai_desc)
        .bind(&ai_tags[..])
        .execute(&state.pg)
        .await;
    }

    Ok(Json(serde_json::json!({
        "image_url": payload.image_url,
        "product_id": payload.product_id,
        "enriched": enriched,
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP PAYMENT LINKS
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CreatePaymentLinkRequest {
    pub service_id: i32,
    pub customer_phone: String,
    pub amount_fcfa: i64,
    pub description: Option<String>,
    pub thread_id: Option<i32>,
}

/// POST /api/social-ai/payment-links
pub async fn create_payment_link(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreatePaymentLinkRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let token: String = sqlx::query_scalar(
        r#"INSERT INTO whatsapp_payment_links
               (service_id, thread_id, customer_phone, amount_fcfa, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING token"#,
    )
    .bind(payload.service_id)
    .bind(payload.thread_id)
    .bind(&payload.customer_phone)
    .bind(payload.amount_fcfa)
    .bind(&payload.description)
    .fetch_one(&state.pg)
    .await?;

    let payment_url = format!("https://yukpo.cm/pay/{}", token);
    let wa_message = format!(
        "Lien de paiement Yukpo\n{} FCFA\n{}\n{}",
        payload.amount_fcfa,
        payload.description.as_deref().unwrap_or(""),
        payment_url
    );

    Ok(Json(serde_json::json!({
        "token": token,
        "payment_url": payment_url,
        "whatsapp_message": wa_message,
        "customer_phone": payload.customer_phone,
        "amount_fcfa": payload.amount_fcfa,
        "expires_in_hours": 24,
    })))
}

/// GET /api/social-ai/payment-links/:service_id
pub async fn list_payment_links(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let rows = sqlx::query(
        r#"SELECT id, customer_phone, amount_fcfa, description, token, status,
                  expires_at, paid_at, created_at
           FROM whatsapp_payment_links
           WHERE service_id = $1
           ORDER BY created_at DESC LIMIT 50"#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let links: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let tok = r
                .try_get::<String, _>("token")
                .unwrap_or_default();
            serde_json::json!({
                "id": r.try_get::<i32,_>("id").unwrap_or(0),
                "customer_phone": r.try_get::<String,_>("customer_phone").unwrap_or_default(),
                "amount_fcfa": r.try_get::<i64,_>("amount_fcfa").unwrap_or(0),
                "description": r.try_get::<Option<String>,_>("description").unwrap_or(None),
                "payment_url": format!("https://yukpo.cm/pay/{}", tok),
                "status": r.try_get::<String,_>("status").unwrap_or_default(),
                "expires_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("expires_at").unwrap_or(None),
                "paid_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("paid_at").unwrap_or(None),
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("created_at").unwrap_or(None),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "payment_links": links })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE CROSS-PARTENAIRES
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct MarketplaceQuery {
    pub region: Option<String>,
    pub category: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/social-ai/marketplace/discover
pub async fn discover_marketplace(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Query(params): Query<MarketplaceQuery>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let region = params.region.as_deref().unwrap_or("CM");
    let limit = params.limit.unwrap_or(30);

    let rows = if let Some(ref q) = params.q {
        sqlx::query(
            r#"SELECT ml.id, ml.service_id, ml.title, ml.description,
                      ml.price, ml.sale_price, ml.category, ml.image_url,
                      ml.region, ml.views, ml.orders, s.name AS shop_name
               FROM marketplace_listings ml
               JOIN services s ON s.id = ml.service_id
               WHERE ml.is_active = TRUE
                 AND (ml.region = $1 OR ml.region = 'ALL')
                 AND to_tsvector('simple', ml.title || ' ' || COALESCE(ml.description,''))
                     @@ plainto_tsquery('simple', $2)
               ORDER BY ml.orders DESC
               LIMIT $3"#,
        )
        .bind(region)
        .bind(q.as_str())
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default()
    } else if let Some(ref cat) = params.category {
        sqlx::query(
            r#"SELECT ml.id, ml.service_id, ml.title, ml.description,
                      ml.price, ml.sale_price, ml.category, ml.image_url,
                      ml.region, ml.views, ml.orders, s.name AS shop_name
               FROM marketplace_listings ml
               JOIN services s ON s.id = ml.service_id
               WHERE ml.is_active = TRUE
                 AND (ml.region = $1 OR ml.region = 'ALL')
                 AND ml.category = $2
               ORDER BY ml.orders DESC
               LIMIT $3"#,
        )
        .bind(region)
        .bind(cat.as_str())
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query(
            r#"SELECT ml.id, ml.service_id, ml.title, ml.description,
                      ml.price, ml.sale_price, ml.category, ml.image_url,
                      ml.region, ml.views, ml.orders, s.name AS shop_name
               FROM marketplace_listings ml
               JOIN services s ON s.id = ml.service_id
               WHERE ml.is_active = TRUE
                 AND (ml.region = $1 OR ml.region = 'ALL')
               ORDER BY ml.orders DESC, ml.views DESC
               LIMIT $2"#,
        )
        .bind(region)
        .bind(limit)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default()
    };

    let listings: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.try_get::<i32,_>("id").unwrap_or(0),
                "service_id": r.try_get::<i32,_>("service_id").unwrap_or(0),
                "shop_name": r.try_get::<String,_>("shop_name").unwrap_or_default(),
                "title": r.try_get::<String,_>("title").unwrap_or_default(),
                "description": r.try_get::<Option<String>,_>("description").unwrap_or(None),
                "price": r.try_get::<rust_decimal::Decimal,_>("price").map(|d| d.to_string()).unwrap_or_default(),
                "sale_price": r.try_get::<Option<rust_decimal::Decimal>,_>("sale_price").ok().flatten().map(|d| d.to_string()),
                "category": r.try_get::<Option<String>,_>("category").unwrap_or(None),
                "image_url": r.try_get::<Option<String>,_>("image_url").unwrap_or(None),
                "region": r.try_get::<String,_>("region").unwrap_or_default(),
                "views": r.try_get::<i32,_>("views").unwrap_or(0),
                "orders": r.try_get::<i32,_>("orders").unwrap_or(0),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "region": region,
        "total": listings.len(),
        "listings": listings,
    })))
}

#[derive(Deserialize)]
pub struct CreateListingRequest {
    pub service_id: i32,
    pub product_id: Option<i32>,
    pub title: String,
    pub description: Option<String>,
    pub price: i64,
    pub sale_price: Option<i64>,
    pub category: Option<String>,
    pub image_url: Option<String>,
    pub stock: Option<i32>,
    pub region: Option<String>,
}

/// POST /api/social-ai/marketplace/listings
pub async fn create_marketplace_listing(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateListingRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let id: i32 = sqlx::query_scalar(
        r#"INSERT INTO marketplace_listings
               (service_id, product_id, title, description, price, sale_price,
                category, image_url, stock, region)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id"#,
    )
    .bind(payload.service_id)
    .bind(payload.product_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.price)
    .bind(payload.sale_price)
    .bind(&payload.category)
    .bind(&payload.image_url)
    .bind(payload.stock.unwrap_or(0))
    .bind(payload.region.as_deref().unwrap_or("CM"))
    .fetch_one(&state.pg)
    .await?;

    Ok(Json(serde_json::json!({
        "listing_id": id,
        "title": payload.title,
        "status": "active",
    })))
}
