// Contrôleur Social AI Engine
// Endpoints: génération contenu, chatbot config, ads, inbox, scheduler, webhooks Meta

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::{
    core::types::AppResult,
    middlewares::jwt::AuthenticatedUser,
    services::{
        ai_content_service::{self, ProductContext, StoreContext},
        meta_ads_service::{self, TargetingSpec},
        social_inbox_service, social_scheduler_service,
    },
    state::AppState,
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
    /// Hashtag tendance à injecter dans le prompt (ex: "FIFA2026")
    pub inject_trend: Option<String>,
}

/// POST /api/social-ai/content/generate
/// Génère un post IA pour un produit
pub async fn generate_post(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<GeneratePostRequest>,
) -> AppResult<Json<serde_json::Value>> {
    // Charger le produit
    let product = sqlx::query(
        r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
           FROM service_products WHERE id = $1 AND service_id = $2"#,
    )
    .bind(payload.product_id)
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?
    .ok_or(crate::core::types::AppError::NotFound(
        "Produit introuvable".to_string(),
    ))?;
    use sqlx::Row;

    let product_ctx = ProductContext {
        id: product
            .try_get("id")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        name: product
            .try_get("name")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        price: product
            .try_get::<Option<f64>, _>("price")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?
            .unwrap_or(0.0),
        sale_price: product
            .try_get::<Option<f64>, _>("sale_price")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        category: product
            .try_get::<Option<String>, _>("category")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?
            .unwrap_or_else(|| "autres".to_string()),
        description: product
            .try_get::<Option<String>, _>("description")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        image_url: product
            .try_get::<Option<String>, _>("image_url")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        in_stock: product
            .try_get("is_active")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
        brand: product
            .try_get::<Option<String>, _>("brand")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?,
    };

    // Charger les infos du service
    let service = sqlx::query(
        r#"SELECT s.name, s.city, s.phone, COALESCE(st.name, 'commerce') as sector
           FROM services s
           LEFT JOIN service_types st ON st.id = s.service_type_id
           WHERE s.id = $1"#,
    )
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let store_ctx = StoreContext {
        name: service
            .as_ref()
            .and_then(|s| s.try_get::<String, _>("name").ok())
            .unwrap_or_else(|| "Boutique".to_string()),
        sector: service
            .as_ref()
            .and_then(|s| s.try_get::<Option<String>, _>("sector").ok().flatten())
            .unwrap_or_else(|| "commerce".to_string()),
        city: service
            .as_ref()
            .and_then(|s| s.try_get::<Option<String>, _>("city").ok().flatten())
            .unwrap_or_default(),
        phone: service
            .as_ref()
            .and_then(|s| s.try_get::<Option<String>, _>("phone").ok().flatten()),
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
    // Injecter la tendance TrendPulse dans le contexte de génération
    if let Some(trend) = &payload.inject_trend {
        prefs.always_include.push(format!(
            "Intègre naturellement la tendance #{} dans le contenu",
            trend
        ));
        prefs.default_hashtags.push(trend.clone());
    }

    let content = ai_content_service::generate_product_post(&product_ctx, &store_ctx, &prefs)
        .await
        .map_err(|e| crate::core::types::AppError::Internal(e))?;

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
        product_ctx.image_url.as_deref(),
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
            .map_err(|e| crate::core::types::AppError::Internal(e))?;

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

    let posts = sqlx::query(
        r#"SELECT p.id, p.platform, p.caption, p.status, p.tone,
                  p.scheduled_at, p.published_at, p.engagement_a, p.ab_winner,
                  sp.name as product_name
           FROM social_ai_posts p
           LEFT JOIN service_products sp ON sp.id = p.product_id
           WHERE p.user_id = $1 AND p.service_id = $2
             AND ($3 = 'all' OR p.status = $3)
           ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
           LIMIT $4"#,
    )
    .bind(user.id)
    .bind(service_id)
    .bind(status)
    .bind(limit)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    use sqlx::Row;
    Ok(Json(serde_json::json!({
        "success": true,
        "posts": posts.iter().map(|p| serde_json::json!({
            "id": p.try_get::<i32, _>("id").unwrap_or(0),
            "platform": p.try_get::<String, _>("platform").unwrap_or_default(),
            "caption_preview": p.try_get::<String, _>("caption").unwrap_or_default().chars().take(100).collect::<String>(),
            "status": p.try_get::<String, _>("status").unwrap_or_default(),
            "tone": p.try_get::<String, _>("tone").unwrap_or_default(),
            "scheduled_at": p.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("scheduled_at").unwrap_or(None),
            "published_at": p.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("published_at").unwrap_or(None),
            "product_name": p.try_get::<Option<String>, _>("product_name").unwrap_or(None),
            "ab_winner": p.try_get::<Option<String>, _>("ab_winner").unwrap_or(None),
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

    sqlx::query(
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
    )
    .bind(user.id)
    .bind(service_id)
    .bind(tone)
    .bind(lang)
    .bind(payload.brand_voice)
    .bind(&forbidden)
    .bind(&always_include)
    .bind(&hashtags)
    .bind(max_posts)
    .bind(payload.sector)
    .execute(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

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

        // ── Cas 1 : messages privés (Messenger DM / Instagram DM) ─────────────
        let messagings = entry["messaging"].as_array().cloned().unwrap_or_default();
        for messaging in messagings {
            let sender_id = messaging["sender"]["id"].as_str().unwrap_or("");
            let text = messaging["message"]["text"].as_str().unwrap_or("");

            if sender_id.is_empty() || text.is_empty() {
                continue;
            }

            let partner = find_partner_by_page_id(&state, &page_id).await;
            use sqlx::Row;
            if let Some(p) = partner {
                let user_id_val: i32 = p.try_get("user_id").unwrap_or(0);
                let service_id_val: i32 = p.try_get("service_id").unwrap_or(0);
                if service_id_val > 0 {
                    let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                        &state.pg,
                        user_id_val,
                        service_id_val,
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

        // ── Cas 2 : commentaires sur posts (Facebook feed / Instagram comments) ─
        let changes = entry["changes"].as_array().cloned().unwrap_or_default();
        for change in &changes {
            let field = change["field"].as_str().unwrap_or("");

            // Facebook : commentaires sur posts de la Page (field = "feed")
            if field == "feed" {
                let value = &change["value"];
                if value["item"].as_str() == Some("comment")
                    && value["verb"].as_str() == Some("add")
                {
                    let comment_id = value["comment_id"].as_str().unwrap_or("");
                    let commenter_id = value["sender_id"]
                        .as_str()
                        .or_else(|| value["from"]["id"].as_str())
                        .unwrap_or("");
                    let comment_text = value["message"].as_str().unwrap_or("");
                    let commenter_name = value["from"]["name"].as_str();

                    if comment_id.is_empty() || comment_text.is_empty() {
                        continue;
                    }

                    let partner = find_partner_by_page_id(&state, &page_id).await;
                    use sqlx::Row;
                    if let Some(p) = partner {
                        let user_id_val: i32 = p.try_get("user_id").unwrap_or(0);
                        let service_id_val: i32 = p.try_get("service_id").unwrap_or(0);
                        if service_id_val > 0 {
                            // Enqueue comme message entrant avec contexte "comment"
                            let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                                &state.pg,
                                user_id_val,
                                service_id_val,
                                "facebook_comment",
                                commenter_id,
                                commenter_name,
                                comment_text,
                                Some(comment_id), // page_id = comment_id pour la réponse
                                &change["value"],
                            )
                            .await;

                            log::info!(
                                "[Webhook] 💬 Commentaire Facebook enqueué — page={} comment_id={} from={}",
                                page_id,
                                comment_id,
                                commenter_id
                            );
                        }
                    }
                }
                continue;
            }

            // Instagram : commentaires (field = "comments")
            if field == "comments" {
                let value = &change["value"];
                let commenter_id = value["from"]["id"].as_str().unwrap_or("");
                let comment_text = value["text"].as_str().unwrap_or("");
                let comment_id = value["id"].as_str().unwrap_or("");
                let media_id = value["media"]["id"].as_str().unwrap_or("");
                let commenter_name = value["from"]["username"].as_str();

                if comment_id.is_empty() || comment_text.is_empty() {
                    continue;
                }

                let partner = find_partner_by_page_id(&state, &page_id).await;
                use sqlx::Row;
                if let Some(p) = partner {
                    let user_id_val: i32 = p.try_get("user_id").unwrap_or(0);
                    let service_id_val: i32 = p.try_get("service_id").unwrap_or(0);
                    if service_id_val > 0 {
                        let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                            &state.pg,
                            user_id_val,
                            service_id_val,
                            "instagram_comment",
                            commenter_id,
                            commenter_name,
                            comment_text,
                            Some(comment_id),
                            &change["value"],
                        )
                        .await;

                        log::info!(
                            "[Webhook] 💬 Commentaire Instagram enqueué — media={} comment={} from={}",
                            media_id,
                            comment_id,
                            commenter_id
                        );
                    }
                }
                continue;
            }

            // Ignorer les autres champs (reactions, stories, etc.)
            if field != "messages" {
                continue;
            }
        }
    }
}

/// Trouve le partenaire Yukpo propriétaire d'une Page Facebook / Instagram.
async fn find_partner_by_page_id(
    state: &Arc<AppState>,
    page_id: &str,
) -> Option<sqlx::postgres::PgRow> {
    sqlx::query(
        r#"SELECT sa.user_id,
                  COALESCE(
                    (SELECT service_id FROM distribution_rules WHERE user_id = sa.user_id LIMIT 1),
                    0
                  ) as service_id
           FROM social_accounts sa
           WHERE sa.platform IN ('facebook', 'instagram')
             AND (sa.metadata->>'page_id' = $1
                  OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(sa.metadata->'pages') p
                    WHERE p->>'id' = $1
                  ))"#,
    )
    .bind(page_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten()
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
                if from.is_empty() {
                    continue;
                }
                let sender_name = value["contacts"][0]["profile"]["name"].as_str();
                let msg_type = msg["type"].as_str().unwrap_or("text");

                // ── Résoudre le texte : direct ou transcription audio ─────────
                let resolved_text: Option<String> = if msg_type == "text" {
                    msg["text"]["body"].as_str().map(|s| s.to_string())
                } else if msg_type == "audio" || msg_type == "voice" {
                    // Catalogue vocal : audio → Whisper → texte
                    let media_id = msg["audio"]["id"]
                        .as_str()
                        .or_else(|| msg["voice"]["id"].as_str())
                        .unwrap_or("");
                    if !media_id.is_empty() {
                        // Récupérer le token WhatsApp du compte (stocké dans social_accounts.metadata)
                        let token_row = sqlx::query(
                            r#"SELECT metadata->>'access_token' AS access_token
                               FROM social_accounts
                               WHERE platform = 'whatsapp'
                                 AND metadata->>'phone_number_id' = $1
                               LIMIT 1"#,
                        )
                        .bind(phone_number_id)
                        .fetch_optional(&state.pg)
                        .await
                        .ok()
                        .flatten();

                        let wa_token = token_row
                            .as_ref()
                            .and_then(|r| {
                                use sqlx::Row;
                                r.try_get::<Option<String>, _>("access_token").ok().flatten()
                            })
                            .unwrap_or_default();

                        if !wa_token.is_empty() {
                            transcribe_whatsapp_audio(media_id, &wa_token).await
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    // Ignorer les autres types (image, document, sticker…)
                    None
                };

                let text = match resolved_text {
                    Some(ref t) if !t.is_empty() => t.as_str(),
                    _ => continue,
                };

                // Trouver le partenaire par le phone_number_id
                let partner = sqlx::query(
                    r#"SELECT user_id,
                              COALESCE((SELECT service_id FROM distribution_rules WHERE user_id = sa2.user_id LIMIT 1), 0) as service_id
                       FROM social_accounts sa2
                       WHERE platform = 'whatsapp'
                         AND metadata->>'phone_number_id' = $1"#,
                )
                .bind(phone_number_id)
                .fetch_optional(&state.pg)
                .await
                .ok()
                .flatten();

                use sqlx::Row;
                if let Some(p) = partner {
                    let user_id_val: i32 = p.try_get("user_id").unwrap_or(0);
                    let service_id_val: i32 = p.try_get("service_id").unwrap_or(0);
                    if service_id_val > 0 {
                        let _ = crate::tasks::social_chatbot_worker::enqueue_incoming_message(
                            &state.pg,
                            user_id_val,
                            service_id_val,
                            "whatsapp",
                            from,
                            sender_name,
                            text,
                            Some(phone_number_id),
                            &msg,
                        )
                        .await;

                        if msg_type == "audio" || msg_type == "voice" {
                            log::info!(
                                "[WhatsApp Voice] 🎙️ Audio transcrit et enqueué — from={} service_id={}",
                                from, service_id_val
                            );
                        }
                    }
                }
            }
        }
    }
}

/// Télécharge un audio WhatsApp et le transcrit via OpenAI Whisper.
/// Retourne le texte transcrit ou None en cas d'erreur.
async fn transcribe_whatsapp_audio(media_id: &str, wa_token: &str) -> Option<String> {
    use crate::services::yukpo_openai_outbound::resolve_openai_api_key;
    let openai_key = resolve_openai_api_key()?;
    let client = reqwest::Client::new();

    // 1. Obtenir l'URL de téléchargement du média via Graph API
    let meta_url = format!("https://graph.facebook.com/v20.0/{}", media_id);
    let meta_resp = client.get(&meta_url).bearer_auth(wa_token).send().await.ok()?;
    let meta_json: serde_json::Value = meta_resp.json().await.ok()?;
    let download_url = meta_json["url"].as_str()?;

    // 2. Télécharger le fichier audio
    let audio_bytes = client
        .get(download_url)
        .bearer_auth(wa_token)
        .send()
        .await
        .ok()?
        .bytes()
        .await
        .ok()?;

    if audio_bytes.is_empty() {
        return None;
    }

    // 3. Envoyer à Whisper API (multipart/form-data)
    let audio_part = reqwest::multipart::Part::bytes(audio_bytes.to_vec())
        .file_name("audio.ogg")
        .mime_str("audio/ogg")
        .ok()?;
    let form = reqwest::multipart::Form::new()
        .part("file", audio_part)
        .text("model", "whisper-1")
        .text("language", "fr");

    let whisper_resp = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(&openai_key)
        .multipart(form)
        .send()
        .await
        .ok()?;

    let whisper_json: serde_json::Value = whisper_resp.json().await.ok()?;
    let transcription = whisper_json["text"].as_str()?.trim().to_string();

    if transcription.is_empty() {
        None
    } else {
        Some(transcription)
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

    sqlx::query(
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
    )
    .bind(user.id)
    .bind(service_id)
    .bind(is_active)
    .bind(bot_name)
    .bind(payload.welcome_message)
    .bind(payload.away_message)
    .bind(&trigger_words)
    .bind(business_hours)
    .bind(max_tokens)
    .bind(lang)
    .bind(delay)
    .execute(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

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
    .map_err(|e| crate::core::types::AppError::Internal(e))?;

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
        .map_err(|e| crate::core::types::AppError::Internal(e))?;

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
        .map_err(|e| crate::core::types::AppError::Internal(e))?;
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
        .map_err(|e| crate::core::types::AppError::Internal(e))?;
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
        .map_err(|e| crate::core::types::AppError::Internal(e))?;
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
        .map_err(|e| crate::core::types::AppError::Internal(e))?;
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

    sqlx::query(
        r#"INSERT INTO meta_ad_accounts
           (user_id, service_id, ad_account_id, access_token, currency, monthly_budget_fcfa, pixel_id, account_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
           ON CONFLICT (user_id, ad_account_id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             currency = EXCLUDED.currency,
             monthly_budget_fcfa = EXCLUDED.monthly_budget_fcfa,
             pixel_id = EXCLUDED.pixel_id,
             updated_at = NOW()"#,
    )
    .bind(user.id)
    .bind(payload.service_id)
    .bind(payload.ad_account_id)
    .bind(payload.access_token)
    .bind(currency)
    .bind(budget)
    .bind(payload.pixel_id)
    .execute(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    Ok(Json(
        serde_json::json!({"success": true, "message": "Compte publicitaire enregistré"}),
    ))
}

/// POST /api/social-ai/ads/account/link
/// Lie un compte pub Meta auto-découvert (token déjà en DB via OAuth) à un service.
/// Aucun token à saisir — utilise le token stocké dans meta_ad_accounts.
#[derive(Deserialize)]
pub struct AdAccountLinkRequest {
    pub service_id: i32,
    pub ad_account_id: String,
    pub monthly_budget_fcfa: Option<i64>,
}

pub async fn link_ad_account(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<AdAccountLinkRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let budget = payload.monthly_budget_fcfa.unwrap_or(50000);
    let ad_account_id = if payload.ad_account_id.starts_with("act_") {
        payload.ad_account_id.clone()
    } else {
        format!("act_{}", payload.ad_account_id)
    };

    // Mettre à jour service_id et budget sur le compte pub existant (token déjà stocké via OAuth)
    let result = sqlx::query(
        r#"UPDATE meta_ad_accounts
           SET service_id = $1, monthly_budget_fcfa = $2, updated_at = NOW()
           WHERE user_id = $3 AND ad_account_id = $4
           RETURNING id"#,
    )
    .bind(payload.service_id)
    .bind(budget)
    .bind(user.id)
    .bind(&ad_account_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    if result.is_none() {
        return Err(crate::core::types::AppError::BadRequest(
            "Compte publicitaire introuvable. Reconnectez votre compte Facebook.".into(),
        ));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Compte publicitaire lié au service",
        "ad_account_id": ad_account_id,
    })))
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
        .ok_or(crate::core::types::AppError::NotFound(
            "Compte publicitaire non configuré. Ajoutez votre Ad Account ID d'abord.".to_string(),
        ))?;

    let product = sqlx::query(
        "SELECT id, name, price, sale_price, image_url FROM service_products WHERE id = $1 AND service_id = $2",
    )
    .bind(payload.product_id)
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?
    .ok_or(crate::core::types::AppError::NotFound("Produit introuvable".to_string()))?;

    use sqlx::Row;
    let product_id_val: i32 = product
        .try_get("id")
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;
    let product_name_val: String = product
        .try_get("name")
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;
    let product_price_val: f64 = product
        .try_get::<Option<f64>, _>("price")
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?
        .unwrap_or(0.0);
    let product_sale_price_val: Option<f64> = product
        .try_get::<Option<f64>, _>("sale_price")
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;
    let product_image_url_val: Option<String> =
        product
            .try_get::<Option<String>, _>("image_url")
            .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    let service_info = sqlx::query("SELECT name FROM services WHERE id = $1")
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
    let store_name_val = service_info
        .as_ref()
        .and_then(|s| s.try_get::<String, _>("name").ok())
        .unwrap_or_else(|| "Boutique".to_string());
    let store_name = store_name_val.as_str();

    let targeting = TargetingSpec {
        countries: payload.countries.unwrap_or_else(|| vec!["CM".to_string()]),
        age_min: payload.age_min.unwrap_or(18),
        age_max: payload.age_max.unwrap_or(55),
        ..Default::default()
    };

    let yukpo_url = format!(
        "https://yukpomnang.com/produit/{}?utm_source=meta_ads&utm_medium=promo",
        product_id_val
    );

    let result = meta_ads_service::create_promo_campaign(
        &account,
        &product_name_val,
        product_image_url_val.as_deref(),
        product_price_val,
        product_sale_price_val.unwrap_or(product_price_val),
        &yukpo_url,
        payload.budget_daily_fcfa,
        &targeting,
        store_name,
    )
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e))?;

    // Enregistrer en BDD
    let ad_account_db: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM meta_ad_accounts WHERE user_id = $1 AND ad_account_id = $2",
    )
    .bind(user.id)
    .bind(&account.ad_account_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let _ = sqlx::query(
        r#"INSERT INTO meta_ad_campaigns
           (user_id, service_id, ad_account_id, external_campaign_id, name,
            objective, campaign_type, status, budget_daily_fcfa, target_product_ids)
           VALUES ($1, $2, $3, $4, $5, 'OUTCOME_SALES', 'manual', 'active', $6, $7)"#,
    )
    .bind(user.id)
    .bind(payload.service_id)
    .bind(ad_account_db)
    .bind(&result.external_campaign_id)
    .bind(format!("Promo: {}", product_name_val))
    .bind(payload.budget_daily_fcfa)
    .bind(&[product_id_val])
    .execute(&state.pg)
    .await;

    Ok(Json(serde_json::json!({
        "success": true,
        "campaign_id": result.external_campaign_id,
        "adset_id": result.adset_id,
        "ad_id": result.ad_id,
        "message": format!("Campagne créée pour '{}'", product_name_val),
    })))
}

/// GET /api/social-ai/ads/campaigns/:service_id
pub async fn list_campaigns(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    let campaigns = sqlx::query(
        r#"SELECT id, name, campaign_type, status, budget_daily_fcfa,
                  impressions, clicks, spent_fcfa, roas, conversions, created_at
           FROM meta_ad_campaigns
           WHERE user_id = $1 AND service_id = $2
           ORDER BY created_at DESC
           LIMIT 20"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    use sqlx::Row;
    let total_spent: i64 =
        campaigns.iter().map(|c| c.try_get::<i64, _>("spent_fcfa").unwrap_or(0)).sum();
    let total_conversions: i32 =
        campaigns.iter().map(|c| c.try_get::<i32, _>("conversions").unwrap_or(0)).sum();

    Ok(Json(serde_json::json!({
        "success": true,
        "campaigns": campaigns.iter().map(|c| serde_json::json!({
            "id": c.try_get::<i32, _>("id").unwrap_or(0),
            "name": c.try_get::<String, _>("name").unwrap_or_default(),
            "type": c.try_get::<String, _>("campaign_type").unwrap_or_default(),
            "status": c.try_get::<String, _>("status").unwrap_or_default(),
            "budget_daily_fcfa": c.try_get::<i64, _>("budget_daily_fcfa").unwrap_or(0),
            "impressions": c.try_get::<i64, _>("impressions").unwrap_or(0),
            "clicks": c.try_get::<i64, _>("clicks").unwrap_or(0),
            "spent_fcfa": c.try_get::<i64, _>("spent_fcfa").unwrap_or(0),
            "roas": c.try_get::<Option<f64>, _>("roas").unwrap_or(None),
            "conversions": c.try_get::<i32, _>("conversions").unwrap_or(0),
            "created_at": c.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at").unwrap_or(None),
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
        .ok_or(crate::core::types::AppError::NotFound(
            "Compte publicitaire non configuré".to_string(),
        ))?;

    let service_info = sqlx::query("SELECT name FROM services WHERE id = $1")
        .bind(payload.service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();
    use sqlx::Row;
    let store_name_dpa = service_info
        .as_ref()
        .and_then(|s| s.try_get::<String, _>("name").ok())
        .unwrap_or_else(|| "Boutique".to_string());
    let store_name = store_name_dpa.as_str();

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
    .map_err(|e| crate::core::types::AppError::Internal(e))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "campaign_id": result.external_campaign_id,
        "message": "Dynamic Product Ads créées. Le retargeting est actif.",
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULING INTELLIGENT — Meilleur créneau par région/plateforme
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/schedule/optimal?service_id=&platform=&region=
/// Retourne les 5 meilleurs créneaux de publication pour cette semaine
/// basés sur les analytics réelles du service + données d'engagement par région
pub async fn get_optimal_schedule(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;
    let service_id: i32 = params.get("service_id").and_then(|s| s.parse().ok()).unwrap_or(0);
    let platform = params.get("platform").map(|s| s.as_str()).unwrap_or("all");
    let region = params
        .get("region")
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "CM".to_string());

    // Scores d'engagement par heure — matrice région × heure (Afrique subsaharienne)
    let base_scores: [f32; 24] = [
        0.10, 0.05, 0.03, 0.02, 0.02, 0.06, // 0h–5h
        0.30, 0.52, 0.68, 0.72, 0.70, 0.76, // 6h–11h
        0.82, 0.78, 0.72, 0.75, 0.82, 0.88, // 12h–17h
        0.97, 0.93, 0.87, 0.72, 0.52, 0.32, // 18h–23h (pic 18–20h)
    ];

    // Ajustement selon la plateforme
    let platform_adjustments: std::collections::HashMap<&str, [f32; 24]> = {
        let mut m = std::collections::HashMap::new();
        // Instagram — pic 19h + matin 8–9h
        m.insert("instagram", {
            let mut a = base_scores;
            a[8] += 0.10;
            a[9] += 0.08;
            a[19] += 0.05;
            a[20] += 0.03;
            a
        });
        // Facebook — pic 13h + 19h
        m.insert("facebook", {
            let mut a = base_scores;
            a[13] += 0.12;
            a[19] += 0.05;
            a
        });
        // WhatsApp — matin 7–9h + soir 20–21h
        m.insert("whatsapp", {
            let mut a = base_scores;
            a[7] += 0.15;
            a[8] += 0.12;
            a[20] += 0.10;
            a[21] += 0.08;
            a
        });
        // TikTok — 19–22h dominant
        m.insert("tiktok", {
            let mut a = base_scores;
            a[19] += 0.08;
            a[20] += 0.12;
            a[21] += 0.10;
            a[22] += 0.07;
            a
        });
        m
    };

    // Récupérer les analytics réelles du service (quand ses posts performent le mieux)
    let real_data = sqlx::query(
        r#"SELECT EXTRACT(HOUR FROM published_at)::int AS hour,
                  AVG(COALESCE((engagement_a->>'likes')::int, 0) +
                      COALESCE((engagement_a->>'comments')::int, 0) +
                      COALESCE((engagement_a->>'shares')::int, 0)) AS avg_eng
           FROM social_ai_posts
           WHERE user_id = $1 AND service_id = $2
             AND published_at IS NOT NULL
             AND published_at >= NOW() - INTERVAL '90 days'
           GROUP BY hour
           ORDER BY avg_eng DESC"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    // Construire un boost par heure depuis les vraies données
    let mut real_boost = [0.0f32; 24];
    let max_eng: f64 = real_data
        .iter()
        .filter_map(|r| r.try_get::<f64, _>("avg_eng").ok())
        .fold(0.0f64, f64::max);
    if max_eng > 0.0 {
        for row in &real_data {
            if let (Ok(hour), Ok(eng)) = (
                row.try_get::<i32, _>("hour"),
                row.try_get::<f64, _>("avg_eng"),
            ) {
                if (0..24).contains(&hour) {
                    real_boost[hour as usize] = (eng / max_eng) as f32 * 0.3; // max +30% boost
                }
            }
        }
    }

    // Sélectionner les scores finaux
    let scores = if let Some(adj) = platform_adjustments.get(platform) {
        *adj
    } else {
        base_scores
    };

    // Top 5 heures
    let mut ranked: Vec<(usize, f32)> = scores
        .iter()
        .enumerate()
        .map(|(h, &s)| (h, (s + real_boost[h]).min(1.0)))
        .collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let top5 = &ranked[..5];

    let reason = |h: usize, _score: f32| -> String {
        let data_label = if max_eng > 0.0 && real_boost[h] > 0.05 {
            " ★ basé sur vos analytics".to_string()
        } else {
            String::new()
        };
        match h {
            18..=20 => format!("🔥 Pic du soir — engagement maximum{}", data_label),
            12..=13 => format!("☀️ Pause déjeuner — audience active{}", data_label),
            7..=9 => format!("🌅 Matin — avant le travail{}", data_label),
            19..=21 => format!("🌙 Soirée — communauté connectée{}", data_label),
            _ => format!("Créneau {}h00{}", h, data_label),
        }
    };

    // Générer les créneaux pour les 7 prochains jours
    let now = chrono::Utc::now();
    let mut slots = Vec::new();
    for (hour, score) in top5 {
        for day_offset in 0i64..7 {
            let slot_dt = (now + chrono::Duration::days(day_offset))
                .date_naive()
                .and_hms_opt(*hour as u32, 0, 0)
                .map(|ndt| {
                    chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc)
                });
            if let Some(dt) = slot_dt {
                if dt > now {
                    slots.push(serde_json::json!({
                        "datetime": dt.to_rfc3339(),
                        "hour": hour,
                        "day": dt.format("%A").to_string(),
                        "score": (score * 100.0).round() as i32,
                        "reason": reason(*hour, *score),
                        "platform": platform,
                        "region": region,
                    }));
                    break; // 1 slot par heure top
                }
            }
        }
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "platform": platform,
        "region": region,
        "has_real_data": max_eng > 0.0,
        "data_points": real_data.len(),
        "optimal_slots": slots,
        "peak_hour": top5.first().map(|(h, _)| h),
        "tip": if max_eng > 0.0 {
            format!("Basé sur {} posts publiés — vos données réelles améliorent la précision", real_data.len())
        } else {
            format!("Basé sur les données d'engagement Afrique ({}) — publiez plus pour affiner", region)
        },
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS COMPARATIFS — Benchmark secteur
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/analytics/benchmark?service_id=&sector=
/// Compare les performances du service vs la moyenne du secteur sur Yukpo
pub async fn get_benchmark(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;
    let service_id: i32 = params.get("service_id").and_then(|s| s.parse().ok()).unwrap_or(0);

    // Récupérer le secteur du service
    let service_row = sqlx::query(
        "SELECT COALESCE(st.name, 'commerce') AS sector, s.city
         FROM services s LEFT JOIN service_types st ON st.id = s.service_type_id
         WHERE s.id = $1",
    )
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let sector = service_row
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("sector").ok())
        .unwrap_or_else(|| "commerce".to_string());

    // Métriques du service (30 derniers jours)
    let my_metrics = sqlx::query(
        r#"SELECT
             COUNT(*) AS total_posts,
             AVG(COALESCE((engagement_a->>'likes')::int, 0)) AS avg_likes,
             AVG(COALESCE((engagement_a->>'comments')::int, 0)) AS avg_comments,
             AVG(COALESCE((engagement_a->>'shares')::int, 0)) AS avg_shares,
             AVG(COALESCE((engagement_a->>'reach')::int, 0)) AS avg_reach,
             COUNT(*) FILTER (WHERE ab_winner IS NOT NULL) AS ab_tests
           FROM social_ai_posts
           WHERE user_id = $1 AND service_id = $2
             AND created_at >= NOW() - INTERVAL '30 days'"#,
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    // Métriques secteur (anonymisées — moyenne de tous les services du même secteur)
    let sector_metrics = sqlx::query(
        r#"SELECT
             COUNT(DISTINCT p.service_id) AS service_count,
             AVG(COALESCE((p.engagement_a->>'likes')::int, 0)) AS avg_likes,
             AVG(COALESCE((p.engagement_a->>'comments')::int, 0)) AS avg_comments,
             AVG(COALESCE((p.engagement_a->>'shares')::int, 0)) AS avg_shares,
             AVG(COALESCE((p.engagement_a->>'reach')::int, 0)) AS avg_reach,
             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY COALESCE((p.engagement_a->>'likes')::int, 0)) AS p75_likes
           FROM social_ai_posts p
           JOIN services s ON s.id = p.service_id
           LEFT JOIN service_types st ON st.id = s.service_type_id
           WHERE COALESCE(st.name, 'commerce') = $1
             AND p.created_at >= NOW() - INTERVAL '30 days'
             AND p.service_id != $2"#,
    )
    .bind(&sector)
    .bind(service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let get_f64 = |row: &Option<sqlx::postgres::PgRow>, col: &str| -> f64 {
        row.as_ref().and_then(|r| r.try_get::<f64, _>(col).ok()).unwrap_or(0.0)
    };
    let get_i64 = |row: &Option<sqlx::postgres::PgRow>, col: &str| -> i64 {
        row.as_ref().and_then(|r| r.try_get::<i64, _>(col).ok()).unwrap_or(0)
    };

    let my_likes = get_f64(&my_metrics, "avg_likes");
    let my_comments = get_f64(&my_metrics, "avg_comments");
    let my_shares = get_f64(&my_metrics, "avg_shares");
    let my_reach = get_f64(&my_metrics, "avg_reach");
    let sec_likes = get_f64(&sector_metrics, "avg_likes");
    let sec_comments = get_f64(&sector_metrics, "avg_comments");
    let sec_shares = get_f64(&sector_metrics, "avg_shares");
    let sec_reach = get_f64(&sector_metrics, "avg_reach");

    let pct = |mine: f64, sector: f64| -> serde_json::Value {
        if sector <= 0.0 {
            return serde_json::json!(null);
        }
        let diff = ((mine - sector) / sector * 100.0).round() as i64;
        serde_json::json!({ "value": mine.round() as i64, "sector_avg": sector.round() as i64, "diff_pct": diff,
            "status": if diff >= 10 { "above" } else if diff <= -10 { "below" } else { "average" } })
    };

    Ok(Json(serde_json::json!({
        "success": true,
        "sector": sector,
        "period": "30 derniers jours",
        "service_count_in_sector": get_i64(&sector_metrics, "service_count"),
        "my_posts": get_i64(&my_metrics, "total_posts"),
        "metrics": {
            "likes":    pct(my_likes,    sec_likes),
            "comments": pct(my_comments, sec_comments),
            "shares":   pct(my_shares,   sec_shares),
            "reach":    pct(my_reach,    sec_reach),
        },
        "engagement_rate": {
            "mine":   if my_reach > 0.0 { ((my_likes + my_comments + my_shares) / my_reach * 100.0).round() } else { 0.0 },
            "sector": if sec_reach > 0.0 { ((sec_likes + sec_comments + sec_shares) / sec_reach * 100.0).round() } else { 0.0 },
        },
        "ab_tests_done": get_i64(&my_metrics, "ab_tests"),
        "insights": {
            "top_performer": my_likes > sec_likes && my_comments > sec_comments,
            "advice": if my_likes < sec_likes * 0.8 {
                "Vos likes sont en dessous de la moyenne secteur. Essayez des posts avec visuels de produits."
            } else if my_comments < sec_comments * 0.8 {
                "Posez des questions en fin de post pour stimuler les commentaires."
            } else {
                "Vos performances sont dans la moyenne secteur. TrendPulse peut vous aider à dépasser vos concurrents."
            }
        }
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPTS REELS IA — Générer un script vidéo depuis une tendance
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct ReelScriptRequest {
    pub service_id: i32,
    pub topic: String,                 // tendance TrendPulse
    pub product_id: Option<i32>,       // produit à mettre en avant (optionnel)
    pub duration_seconds: Option<i32>, // 15 | 30 | 60 (défaut: 30)
    pub style: Option<String>, // "educational" | "entertaining" | "promotional" | "storytelling"
}

/// POST /api/social-ai/content/reel-script
/// Génère un script Reels/Shorts/TikTok depuis une tendance TrendPulse
pub async fn generate_reel_script(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthenticatedUser>,
    Json(payload): Json<ReelScriptRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let api_key = crate::services::yukpo_openai_outbound::resolve_openai_api_key()
        .ok_or_else(|| crate::core::types::AppError::Internal("OPENAI_API_KEY manquante".into()))?;

    let duration = payload.duration_seconds.unwrap_or(30);
    let style = payload.style.as_deref().unwrap_or("entertaining");

    // Charger le service + produit si fourni
    let service_row = sqlx::query(
        "SELECT s.name, s.city, COALESCE(st.name,'commerce') AS sector
         FROM services s LEFT JOIN service_types st ON st.id = s.service_type_id WHERE s.id = $1",
    )
    .bind(payload.service_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let store_name = service_row
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("name").ok())
        .unwrap_or_else(|| "la boutique".into());
    let sector = service_row
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("sector").ok())
        .unwrap_or_else(|| "commerce".into());

    let product_context = if let Some(pid) = payload.product_id {
        let pr = sqlx::query(
            "SELECT name, price, description FROM service_products WHERE id = $1 AND service_id = $2"
        ).bind(pid).bind(payload.service_id).fetch_optional(&state.pg).await.ok().flatten();
        pr.map(|r| {
            format!(
                "Produit vedette : {} — {} FCFA. {}",
                r.try_get::<String, _>("name").unwrap_or_default(),
                r.try_get::<f64, _>("price").unwrap_or(0.0) as i64,
                r.try_get::<Option<String>, _>("description").ok().flatten().unwrap_or_default()
            )
        })
        .unwrap_or_default()
    } else {
        String::new()
    };

    let word_count = duration * 2; // ~2 mots/sec
    let style_instruction = match style {
        "educational" => "Format éducatif : une info clé par seconde, ton expert mais accessible.",
        "storytelling" => {
            "Format story : commence par une situation client réelle, résolution avec le produit."
        }
        "promotional" => "Format promo : urgence, offre limitée, appel à l'action fort en fin.",
        _ => "Format divertissant : accroche choc en 1ère seconde, rythme rapide, humour léger.",
    };

    let prompt = format!(
        r#"Tu es expert en création de contenu vidéo viral pour les réseaux sociaux en Afrique francophone.
Génère un script Reels/TikTok/Shorts de {duration} secondes (~{word_count} mots) pour {store_name} ({sector}).
Tendance à surfer : #{topic}
{product_context}
Style : {style_instruction}

Format de réponse JSON strict :
{{
  "hook": "Les 3 premières secondes accrochantes (texte à l'écran + voix)",
  "scenes": [
    {{"second": 0, "visual": "ce qu'on voit à l'écran", "voiceover": "texte dit", "text_overlay": "texte affiché"}}
  ],
  "cta": "Appel à l'action final (3 dernières secondes)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "music_vibe": "type de musique recommandé",
  "tips": ["conseil tournage 1", "conseil tournage 2"]
}}"#,
        duration = duration,
        word_count = word_count,
        store_name = store_name,
        sector = sector,
        topic = payload.topic,
        product_context = product_context,
        style_instruction = style_instruction,
    );

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 800,
            "temperature": 0.8,
            "response_format": {"type": "json_object"},
        }))
        .send()
        .await
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    let script_raw = json["choices"][0]["message"]["content"].as_str().unwrap_or("{}");
    let script: serde_json::Value =
        serde_json::from_str(script_raw).unwrap_or(serde_json::json!({"error": "Parsing error"}));

    Ok(Json(serde_json::json!({
        "success": true,
        "topic": payload.topic,
        "duration_seconds": duration,
        "style": style,
        "store": store_name,
        "script": script,
        "tokens_used": json["usage"]["total_tokens"].as_i64().unwrap_or(0),
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — Statut de complétion du wizard
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/social-ai/onboarding/status?service_id=
/// Retourne quelles étapes du wizard ont été complétées
pub async fn get_onboarding_status(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;
    let service_id: i32 = params.get("service_id").and_then(|s| s.parse().ok()).unwrap_or(0);

    // Étape 1 : comptes sociaux connectés ?
    let accounts_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM social_accounts WHERE user_id = $1")
            .bind(user.id)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

    // Étape 2 : chatbot configuré (persona défini) ?
    let chatbot_config = sqlx::query(
        "SELECT bot_name, account_persona FROM social_chatbot_config WHERE user_id = $1 AND service_id = $2"
    ).bind(user.id).bind(service_id).fetch_optional(&state.pg).await.ok().flatten();

    let chatbot_done = chatbot_config.is_some();
    let persona = chatbot_config
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("account_persona").ok())
        .unwrap_or_else(|| "shop".into());

    // Étape 3 : premier post généré ?
    let first_post: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM social_ai_posts WHERE user_id = $1 AND service_id = $2",
    )
    .bind(user.id)
    .bind(service_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or(0);

    let steps = serde_json::json!([
        {
            "step": 1,
            "key": "connect_accounts",
            "label": "Connecter vos comptes sociaux",
            "description": "Facebook, Instagram, WhatsApp — une connexion couvre tout",
            "done": accounts_count > 0,
            "count": accounts_count,
        },
        {
            "step": 2,
            "key": "configure_persona",
            "label": "Configurer votre assistant IA",
            "description": "Choisissez votre type de compte et personnalisez votre bot",
            "done": chatbot_done,
            "persona": persona,
        },
        {
            "step": 3,
            "key": "first_post",
            "label": "Créer votre premier post",
            "description": "Laissez YukpoIA générer du contenu adapté à votre boutique",
            "done": first_post > 0,
            "posts_count": first_post,
        },
    ]);

    let completed = [accounts_count > 0, chatbot_done, first_post > 0]
        .iter()
        .filter(|&&b| b)
        .count();

    Ok(Json(serde_json::json!({
        "success": true,
        "service_id": service_id,
        "completed_steps": completed,
        "total_steps": 3,
        "onboarding_complete": completed == 3,
        "completion_pct": (completed * 100 / 3) as i32,
        "steps": steps,
        "next_step": steps.as_array()
            .and_then(|arr| arr.iter().find(|s| s["done"] == false))
            .cloned()
            .unwrap_or(serde_json::json!(null)),
    })))
}
