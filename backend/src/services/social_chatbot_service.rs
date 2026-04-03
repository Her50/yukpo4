// Community Manager IA — Service de chatbot social
// Reçoit un message entrant, assemble le contexte depuis Yukpo,
// appelle GPT-4o/Claude, renvoie la réponse via Meta API

use chrono::{Datelike, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::yukpo_openai_outbound::resolve_openai_api_key;
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingMessage {
    pub platform: String, // messenger, instagram_dm, whatsapp
    pub external_sender_id: String,
    pub sender_name: Option<String>,
    pub page_id: String,
    pub text: String,
    pub attachments: Vec<MessageAttachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageAttachment {
    pub attachment_type: String, // image, audio, video, location
    pub url: Option<String>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotContext {
    pub store_name: String,
    pub sector: String,
    pub city: String,
    pub phone: Option<String>,
    pub yukpo_url: String,
    pub business_hours: serde_json::Value,
    pub bot_name: String,
    pub language: String,
    pub products_summary: Vec<ProductSummary>,
    pub recent_orders: Vec<OrderSummary>,
    pub active_promos: Vec<PromoSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSummary {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub sale_price: Option<f64>,
    pub category: String,
    pub in_stock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderSummary {
    pub id: i32,
    pub status: String,
    pub items_count: i32,
    pub total_fcfa: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromoSummary {
    pub product_name: String,
    pub original_price: f64,
    pub promo_price: f64,
    pub discount_pct: i32,
}

#[derive(Debug)]
pub struct BotResponse {
    pub text: String,
    pub quick_replies: Vec<QuickReply>,
    pub product_card: Option<ProductCard>,
    pub should_escalate: bool,
    pub escalation_reason: Option<String>,
    pub tokens_used: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickReply {
    pub title: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductCard {
    pub product_id: i32,
    pub title: String,
    pub subtitle: String,
    pub image_url: Option<String>,
    pub yukpo_url: String,
}

// ─── Logique principale ───────────────────────────────────────────────────────

/// Point d'entrée principal: traite un message entrant et génère une réponse bot
pub async fn process_message(
    state: &Arc<AppState>,
    user_id: i32,
    service_id: i32,
    msg: &IncomingMessage,
) -> Result<BotResponse, String> {
    // 1. Récupérer la config du bot
    let config = load_bot_config(&state.pg, user_id, service_id).await?;

    // 2. Vérifier si le bot est actif
    if !config.is_active {
        return Ok(BotResponse {
            text: config
                .away_message
                .unwrap_or_else(|| "Service temporairement indisponible.".to_string()),
            quick_replies: vec![],
            product_card: None,
            should_escalate: false,
            escalation_reason: None,
            tokens_used: 0,
        });
    }

    // 3. Vérifier horaires d'ouverture
    if !is_within_business_hours(&config.business_hours) {
        let away = config.away_message.unwrap_or_else(|| {
            "Merci pour votre message ! Nous sommes actuellement fermés. Nous vous répondrons dès notre prochaine ouverture.".to_string()
        });
        return Ok(BotResponse {
            text: away,
            quick_replies: build_default_quick_replies(),
            product_card: None,
            should_escalate: false,
            escalation_reason: None,
            tokens_used: 0,
        });
    }

    // 4. Vérifier si escalade nécessaire (mots-clés critiques)
    if should_escalate_message(&msg.text, &config.escalation_trigger_words) {
        return Ok(BotResponse {
            text: "Je transmets votre demande à notre équipe qui vous contactera très prochainement. Merci de votre patience ! 🙏".to_string(),
            quick_replies: vec![],
            product_card: None,
            should_escalate: true,
            escalation_reason: Some(format!("Message contient un mot-clé d'escalade: {}", msg.text)),
            tokens_used: 0,
        });
    }

    // 5. Assembler le contexte Yukpo
    let context =
        assemble_context(state, user_id, service_id, &msg.external_sender_id, &config).await;

    // 6. Construire l'historique de la conversation (5 derniers échanges)
    let history = load_conversation_history(
        &state.pg,
        user_id,
        &msg.platform,
        &msg.external_sender_id,
        5,
    )
    .await;

    // 7. Appeler l'IA
    let ai_response = call_ai_for_response(&msg.text, &context, &history, &config).await?;

    // 8. Détecter si un produit spécifique est mentionné pour inclure une product card
    let product_card = detect_and_build_product_card(&msg.text, &context);

    Ok(BotResponse {
        text: ai_response.0,
        quick_replies: build_contextual_quick_replies(&msg.text, &context),
        product_card,
        should_escalate: false,
        escalation_reason: None,
        tokens_used: ai_response.1,
    })
}

/// Envoie une réponse via l'API Meta appropriée
pub async fn send_meta_response(
    state: &Arc<AppState>,
    user_id: i32,
    platform: &str,
    sender_id: &str,
    page_id: &str,
    response: &BotResponse,
) -> Result<String, String> {
    // Récupérer le page_access_token depuis social_accounts
    let token = load_page_access_token(&state.pg, user_id, platform, page_id).await?;

    match platform {
        "messenger" => send_messenger_response(&token, sender_id, response).await,
        "instagram_dm" => send_instagram_dm_response(&token, sender_id, response).await,
        "whatsapp" => send_whatsapp_response(&token, sender_id, response).await,
        _ => Err(format!("Plateforme non supportée: {}", platform)),
    }
}

// ─── Envoi Messenger ──────────────────────────────────────────────────────────

async fn send_messenger_response(
    access_token: &str,
    recipient_id: &str,
    response: &BotResponse,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Message texte principal
    let mut message_obj = serde_json::json!({
        "text": response.text
    });

    // Ajouter quick replies si présents
    if !response.quick_replies.is_empty() {
        let qr: Vec<serde_json::Value> = response
            .quick_replies
            .iter()
            .map(|q| {
                serde_json::json!({
                    "content_type": "text",
                    "title": q.title,
                    "payload": q.payload
                })
            })
            .collect();
        message_obj["quick_replies"] = serde_json::json!(qr);
    }

    let body = serde_json::json!({
        "recipient": {"id": recipient_id},
        "message": message_obj,
        "messaging_type": "RESPONSE"
    });

    let resp = client
        .post("https://graph.facebook.com/v19.0/me/messages")
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Messenger send error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Messenger API error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let msg_id = json["message_id"].as_str().unwrap_or("").to_string();

    // Envoyer la product card séparément si présente (template generic)
    if let Some(card) = &response.product_card {
        let _ = send_messenger_product_template(access_token, recipient_id, card).await;
    }

    Ok(msg_id)
}

async fn send_messenger_product_template(
    access_token: &str,
    recipient_id: &str,
    card: &ProductCard,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let mut buttons = vec![serde_json::json!({
        "type": "web_url",
        "url": card.yukpo_url,
        "title": "Voir sur Yukpo"
    })];

    let body = serde_json::json!({
        "recipient": {"id": recipient_id},
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": card.title,
                        "subtitle": card.subtitle,
                        "image_url": card.image_url,
                        "buttons": buttons
                    }]
                }
            }
        }
    });

    let _ = client
        .post("https://graph.facebook.com/v19.0/me/messages")
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await;

    Ok(())
}

// ─── Envoi Instagram DM ───────────────────────────────────────────────────────

async fn send_instagram_dm_response(
    access_token: &str,
    recipient_id: &str,
    response: &BotResponse,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "recipient": {"id": recipient_id},
        "message": {"text": response.text},
        "messaging_type": "RESPONSE"
    });

    let resp = client
        .post("https://graph.facebook.com/v19.0/me/messages")
        .query(&[("access_token", access_token)])
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Instagram DM error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Instagram DM API error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json["message_id"].as_str().unwrap_or("").to_string())
}

// ─── Envoi WhatsApp ───────────────────────────────────────────────────────────

async fn send_whatsapp_response(
    access_token: &str,
    recipient_phone: &str,
    response: &BotResponse,
) -> Result<String, String> {
    // Récupérer le WABA phone_number_id depuis la config
    let phone_number_id =
        std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_else(|_| "0".to_string());

    let client = reqwest::Client::new();

    // Message texte
    let mut body = serde_json::json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_phone,
        "type": "text",
        "text": {
            "preview_url": false,
            "body": response.text
        }
    });

    let resp = client
        .post(format!(
            "https://graph.facebook.com/v19.0/{}/messages",
            phone_number_id
        ))
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("WhatsApp send error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("WhatsApp API error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let msg_id = json["messages"][0]["id"].as_str().unwrap_or("").to_string();

    // Envoyer boutons interactifs si quick_replies
    if !response.quick_replies.is_empty() && response.quick_replies.len() <= 3 {
        let _ = send_whatsapp_buttons(
            access_token,
            recipient_phone,
            &phone_number_id,
            &response.quick_replies,
        )
        .await;
    }

    // Product card via message de liste ou lien
    if let Some(card) = &response.product_card {
        let product_msg = format!(
            "🛍️ *{}*\n{}\n\n🔗 {}",
            card.title, card.subtitle, card.yukpo_url
        );
        let card_body = serde_json::json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "text",
            "text": {"body": product_msg}
        });
        let _ = client
            .post(format!(
                "https://graph.facebook.com/v19.0/{}/messages",
                phone_number_id
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .json(&card_body)
            .send()
            .await;
    }

    Ok(msg_id)
}

async fn send_whatsapp_buttons(
    access_token: &str,
    recipient_phone: &str,
    phone_number_id: &str,
    quick_replies: &[QuickReply],
) -> Result<(), String> {
    let buttons: Vec<serde_json::Value> = quick_replies
        .iter()
        .take(3)
        .map(|q| {
            serde_json::json!({
                "type": "reply",
                "reply": {
                    "id": q.payload,
                    "title": &q.title[..q.title.len().min(20)]
                }
            })
        })
        .collect();

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": "Que souhaitez-vous faire ?"},
            "action": {"buttons": buttons}
        }
    });

    let _ = client
        .post(format!(
            "https://graph.facebook.com/v19.0/{}/messages",
            phone_number_id
        ))
        .header("Authorization", format!("Bearer {}", access_token))
        .json(&body)
        .send()
        .await;

    Ok(())
}

// ─── Moteur IA ────────────────────────────────────────────────────────────────

async fn call_ai_for_response(
    user_message: &str,
    context: &BotContext,
    history: &[(String, String)], // (direction, text)
    config: &BotConfig,
) -> Result<(String, i32), String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;

    // Construire le contexte produits
    let products_text = context
        .products_summary
        .iter()
        .take(20)
        .map(|p| {
            let price = if let Some(s) = p.sale_price {
                format!("{} FCFA (promo, était {} FCFA)", s as i64, p.price as i64)
            } else {
                format!("{} FCFA", p.price as i64)
            };
            let stock = if p.in_stock {
                "✓ dispo"
            } else {
                "stock limité"
            };
            format!("- {} | {} | {} | {}", p.name, p.category, price, stock)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let promos_text = if context.active_promos.is_empty() {
        "Aucune promotion active en ce moment.".to_string()
    } else {
        context
            .active_promos
            .iter()
            .map(|p| {
                format!(
                    "- {} : {} FCFA → {} FCFA (-{}%)",
                    p.product_name, p.original_price as i64, p.promo_price as i64, p.discount_pct
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let system_prompt = format!(
        r#"Tu es {bot_name}, l'assistant virtuel de {store_name}, une boutique {sector} à {city} disponible sur l'application Yukpo.
Tu réponds aux clients sur {platform}.
Langue principale: {language}. Tu peux comprendre et répondre en wolof, lingala, malagasy si nécessaire.

INFORMATIONS BOUTIQUE:
- Nom: {store_name}
- Ville: {city}
- Contact: {phone}
- Lien pour commander: {yukpo_url}

CATALOGUE (extrait):
{products_text}

PROMOTIONS ACTIVES:
{promos_text}

RÈGLES IMPORTANTES:
1. Réponds toujours de manière naturelle et humaine (pas de style robot)
2. Maximum {max_tokens} tokens par réponse
3. Si le client veut acheter → donne le lien Yukpo: {yukpo_url}
4. Si tu ne connais pas la réponse, dis honnêtement que tu vas vérifier
5. Ne donne JAMAIS de fausses informations sur les prix ou stocks
6. Pour les réclamations complexes, annonce que tu escalades vers l'équipe
7. Utilise des emojis avec modération (max 2 par message)
8. Sois concis: 1-3 phrases maximum sauf si question complexe"#,
        bot_name = context.bot_name,
        store_name = context.store_name,
        sector = context.sector,
        city = context.city,
        phone = context.phone.as_deref().unwrap_or("disponible sur Yukpo"),
        platform = "la messagerie",
        language = config.language,
        yukpo_url = context.yukpo_url,
        products_text = products_text,
        promos_text = promos_text,
        max_tokens = config.max_ai_tokens_per_response,
    );

    let mut messages = vec![serde_json::json!({"role": "system", "content": system_prompt})];

    // Ajouter l'historique de la conversation
    for (direction, text) in history.iter().take(10) {
        let role = if direction == "inbound" {
            "user"
        } else {
            "assistant"
        };
        messages.push(serde_json::json!({"role": role, "content": text}));
    }

    // Message actuel
    messages.push(serde_json::json!({"role": "user", "content": user_message}));

    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": messages,
        "max_tokens": config.max_ai_tokens_per_response,
        "temperature": 0.7
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI error: {}", text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let response_text = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("Je n'ai pas pu traiter votre demande, veuillez réessayer.")
        .to_string();
    let tokens = json["usage"]["total_tokens"].as_i64().unwrap_or(0) as i32;

    Ok((response_text, tokens))
}

// ─── Context assembly ─────────────────────────────────────────────────────────

async fn assemble_context(
    state: &Arc<AppState>,
    user_id: i32,
    service_id: i32,
    sender_id: &str,
    config: &BotConfig,
) -> BotContext {
    let pg = &state.pg;

    // Infos service
    let service_info = sqlx::query!(
        r#"SELECT s.name, s.city, s.phone,
                  COALESCE(st.name, 'commerce') as sector
           FROM services s
           LEFT JOIN service_types st ON st.id = s.service_type_id
           WHERE s.id = $1"#,
        service_id,
    )
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    let (store_name, city, phone, sector) = service_info
        .map(|s| {
            (
                s.name,
                s.city.unwrap_or_else(|| "".to_string()),
                s.phone,
                s.sector.unwrap_or_else(|| "commerce".to_string()),
            )
        })
        .unwrap_or_else(|| {
            (
                "Boutique".to_string(),
                "".to_string(),
                None,
                "commerce".to_string(),
            )
        });

    let yukpo_url = format!(
        "https://yukpomnang.com/boutique/{}?utm_source=chatbot&utm_medium=social",
        service_id
    );

    // Produits du catalogue (top 30)
    let products = sqlx::query!(
        r#"SELECT id, name, price, sale_price, category, is_active
           FROM service_products
           WHERE service_id = $1 AND is_active = true
           ORDER BY
             CASE WHEN sale_price IS NOT NULL THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT 30"#,
        service_id,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| ProductSummary {
        id: r.id,
        name: r.name,
        price: r.price.unwrap_or(0.0),
        sale_price: r.sale_price,
        category: r.category.unwrap_or_else(|| "autres".to_string()),
        in_stock: r.is_active,
    })
    .collect::<Vec<_>>();

    // Promotions actives
    let active_promos = products
        .iter()
        .filter(|p| p.sale_price.is_some())
        .map(|p| {
            let sale = p.sale_price.unwrap();
            let discount = ((p.price - sale) / p.price * 100.0).round() as i32;
            PromoSummary {
                product_name: p.name.clone(),
                original_price: p.price,
                promo_price: sale,
                discount_pct: discount,
            }
        })
        .collect();

    BotContext {
        store_name,
        sector,
        city,
        phone,
        yukpo_url,
        business_hours: config.business_hours.clone(),
        bot_name: config.bot_name.clone(),
        language: config.language.clone(),
        products_summary: products,
        recent_orders: vec![], // TODO: charger les commandes du client si connu
        active_promos,
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn should_escalate_message(text: &str, trigger_words: &[String]) -> bool {
    let text_lower = text.to_lowercase();
    trigger_words.iter().any(|w| text_lower.contains(&w.to_lowercase()))
}

fn is_within_business_hours(hours: &serde_json::Value) -> bool {
    let now = Utc::now();
    let day_key = match now.weekday() {
        Weekday::Mon => "mon",
        Weekday::Tue => "tue",
        Weekday::Wed => "wed",
        Weekday::Thu => "thu",
        Weekday::Fri => "fri",
        Weekday::Sat => "sat",
        Weekday::Sun => "sun",
    };

    let day_hours = &hours[day_key];
    if day_hours.is_null() {
        return false; // fermé ce jour
    }

    let open_str = day_hours["open"].as_str().unwrap_or("00:00");
    let close_str = day_hours["close"].as_str().unwrap_or("00:00");

    let parse_time = |s: &str| -> (u32, u32) {
        let parts: Vec<&str> = s.split(':').collect();
        let h = parts.first().and_then(|p| p.parse().ok()).unwrap_or(0);
        let m = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
        (h, m)
    };

    let (oh, om) = parse_time(open_str);
    let (ch, cm) = parse_time(close_str);
    let current_minutes = now.hour() * 60 + now.minute();
    let open_minutes = oh * 60 + om;
    let close_minutes = ch * 60 + cm;

    current_minutes >= open_minutes && current_minutes < close_minutes
}

fn build_default_quick_replies() -> Vec<QuickReply> {
    vec![
        QuickReply {
            title: "Voir les produits".to_string(),
            payload: "BROWSE_PRODUCTS".to_string(),
        },
        QuickReply {
            title: "Nos promotions".to_string(),
            payload: "VIEW_PROMOS".to_string(),
        },
        QuickReply {
            title: "Nous contacter".to_string(),
            payload: "CONTACT".to_string(),
        },
    ]
}

fn build_contextual_quick_replies(message: &str, context: &BotContext) -> Vec<QuickReply> {
    let msg_lower = message.to_lowercase();

    if msg_lower.contains("prix") || msg_lower.contains("combien") || msg_lower.contains("coût") {
        vec![
            QuickReply {
                title: "Voir catalogue".to_string(),
                payload: "BROWSE_PRODUCTS".to_string(),
            },
            QuickReply {
                title: "Commander".to_string(),
                payload: format!("ORDER_{}", context.yukpo_url),
            },
        ]
    } else if msg_lower.contains("livraison") || msg_lower.contains("délai") {
        vec![
            QuickReply {
                title: "Commander maintenant".to_string(),
                payload: "ORDER".to_string(),
            },
            QuickReply {
                title: "Nos horaires".to_string(),
                payload: "HOURS".to_string(),
            },
        ]
    } else if msg_lower.contains("promo")
        || msg_lower.contains("offre")
        || msg_lower.contains("réduction")
    {
        vec![
            QuickReply {
                title: "Voir les promos".to_string(),
                payload: "VIEW_PROMOS".to_string(),
            },
            QuickReply {
                title: "Commander".to_string(),
                payload: "ORDER".to_string(),
            },
        ]
    } else {
        vec![
            QuickReply {
                title: "Parcourir les produits".to_string(),
                payload: "BROWSE".to_string(),
            },
            QuickReply {
                title: "Commander en ligne".to_string(),
                payload: "ORDER".to_string(),
            },
        ]
    }
}

fn detect_and_build_product_card(message: &str, context: &BotContext) -> Option<ProductCard> {
    let msg_lower = message.to_lowercase();

    // Chercher si un produit du catalogue est mentionné
    let matched = context.products_summary.iter().find(|p| {
        let name_lower = p.name.to_lowercase();
        let words: Vec<&str> = name_lower.split_whitespace().collect();
        words.iter().any(|w| w.len() > 3 && msg_lower.contains(*w))
    })?;

    let price_text = if let Some(s) = matched.sale_price {
        format!("{} FCFA (promo)", s as i64)
    } else {
        format!("{} FCFA", matched.price as i64)
    };

    Some(ProductCard {
        product_id: matched.id,
        title: matched.name.clone(),
        subtitle: format!(
            "{} · {}",
            price_text,
            if matched.in_stock {
                "En stock"
            } else {
                "Stock limité"
            }
        ),
        image_url: None,
        yukpo_url: format!(
            "{}/produit/{}?utm_source=chatbot&utm_medium=social",
            context.yukpo_url, matched.id
        ),
    })
}

async fn load_conversation_history(
    pg: &PgPool,
    user_id: i32,
    platform: &str,
    sender_id: &str,
    limit: i64,
) -> Vec<(String, String)> {
    let rows = sqlx::query!(
        r#"SELECT m.direction, m.content
           FROM social_chatbot_messages m
           JOIN social_chatbot_threads t ON t.id = m.thread_id
           WHERE t.user_id = $1 AND t.platform = $2 AND t.external_sender_id = $3
           ORDER BY m.created_at DESC
           LIMIT $4"#,
        user_id,
        platform,
        sender_id,
        limit,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    rows.into_iter().rev().map(|r| (r.direction, r.content)).collect()
}

// ─── Config ───────────────────────────────────────────────────────────────────

struct BotConfig {
    is_active: bool,
    bot_name: String,
    welcome_message: Option<String>,
    away_message: Option<String>,
    escalation_trigger_words: Vec<String>,
    business_hours: serde_json::Value,
    max_ai_tokens_per_response: i32,
    language: String,
    reply_delay_ms: i32,
}

async fn load_bot_config(pg: &PgPool, user_id: i32, service_id: i32) -> Result<BotConfig, String> {
    let row = sqlx::query!(
        r#"SELECT is_active, bot_name, welcome_message, away_message,
                  escalation_trigger_words, business_hours,
                  max_ai_tokens_per_response, language, reply_delay_ms
           FROM social_chatbot_config
           WHERE user_id = $1 AND service_id = $2"#,
        user_id,
        service_id,
    )
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(if let Some(r) = row {
        BotConfig {
            is_active: r.is_active,
            bot_name: r.bot_name,
            welcome_message: r.welcome_message,
            away_message: r.away_message,
            escalation_trigger_words: r.escalation_trigger_words.unwrap_or_default(),
            business_hours: r.business_hours,
            max_ai_tokens_per_response: r.max_ai_tokens_per_response,
            language: r.language,
            reply_delay_ms: r.reply_delay_ms,
        }
    } else {
        // Config par défaut si non configurée
        BotConfig {
            is_active: true,
            bot_name: "Assistant".to_string(),
            welcome_message: None,
            away_message: None,
            escalation_trigger_words: vec![
                "plainte".to_string(),
                "arnaque".to_string(),
                "remboursement".to_string(),
                "responsable".to_string(),
                "procès".to_string(),
            ],
            business_hours: serde_json::json!({
                "mon": {"open": "08:00", "close": "20:00"},
                "tue": {"open": "08:00", "close": "20:00"},
                "wed": {"open": "08:00", "close": "20:00"},
                "thu": {"open": "08:00", "close": "20:00"},
                "fri": {"open": "08:00", "close": "20:00"},
                "sat": {"open": "08:00", "close": "18:00"}
            }),
            max_ai_tokens_per_response: 400,
            language: "fr".to_string(),
            reply_delay_ms: 1500,
        }
    })
}

async fn load_page_access_token(
    pg: &PgPool,
    user_id: i32,
    platform: &str,
    page_id: &str,
) -> Result<String, String> {
    let account_platform = match platform {
        "messenger" | "instagram_dm" => "facebook",
        "whatsapp" => "whatsapp",
        _ => platform,
    };

    let row = sqlx::query!(
        r#"SELECT access_token, metadata
           FROM social_accounts
           WHERE user_id = $1 AND platform = $2"#,
        user_id,
        account_platform,
    )
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Compte {} non connecté", platform))?;

    // Pour Facebook/Instagram: chercher le page_access_token dans metadata
    if let Some(pages) = row.metadata.as_ref().and_then(|m| m["pages"].as_array()) {
        if let Some(page) = pages.iter().find(|p| p["id"].as_str() == Some(page_id)) {
            if let Some(token) = page["access_token"].as_str() {
                return Ok(token.to_string());
            }
        }
        // Fallback: première page
        if let Some(page) = pages.first() {
            if let Some(token) = page["access_token"].as_str() {
                return Ok(token.to_string());
            }
        }
    }

    // Pour WhatsApp: token principal
    Ok(row.access_token)
}

/// Enregistre un message (entrant ou sortant) dans la BDD + met à jour l'inbox summary
pub async fn persist_message(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    platform: &str,
    sender_id: &str,
    sender_name: Option<&str>,
    direction: &str,   // inbound / outbound
    sender_type: &str, // customer / bot / human_agent
    content: &str,
    external_message_id: Option<&str>,
    tokens_used: Option<i32>,
) -> Result<i64, String> {
    // Upsert thread
    let thread_id = sqlx::query!(
        r#"INSERT INTO social_chatbot_threads
           (user_id, service_id, platform, external_sender_id, sender_name, last_message_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id, platform, external_sender_id)
           DO UPDATE SET
             last_message_at = NOW(),
             sender_name = COALESCE(EXCLUDED.sender_name, social_chatbot_threads.sender_name),
             total_messages = social_chatbot_threads.total_messages + 1,
             bot_messages = CASE WHEN $6 = 'bot' THEN social_chatbot_threads.bot_messages + 1 ELSE social_chatbot_threads.bot_messages END,
             updated_at = NOW()
           RETURNING id"#,
        user_id, service_id, platform, sender_id, sender_name, sender_type,
    )
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?
    .id;

    // Insérer message
    let msg = sqlx::query!(
        r#"INSERT INTO social_chatbot_messages
           (thread_id, direction, sender_type, content, external_message_id, ai_tokens_used)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id"#,
        thread_id,
        direction,
        sender_type,
        content,
        external_message_id,
        tokens_used,
    )
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?
    .id;

    // Upsert inbox summary
    let preview = if content.len() > 80 {
        format!("{}...", &content[..77])
    } else {
        content.to_string()
    };
    let _ = sqlx::query!(
        r#"INSERT INTO social_inbox_summary
           (user_id, service_id, thread_id, platform, sender_name, last_message_preview, last_message_at,
            unread_count, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(),
                   CASE WHEN $7 = 'inbound' THEN 1 ELSE 0 END, NOW())
           ON CONFLICT (user_id, thread_id)
           DO UPDATE SET
             last_message_preview = EXCLUDED.last_message_preview,
             last_message_at = NOW(),
             unread_count = CASE WHEN $7 = 'inbound'
                            THEN social_inbox_summary.unread_count + 1
                            ELSE social_inbox_summary.unread_count END,
             sender_name = COALESCE(EXCLUDED.sender_name, social_inbox_summary.sender_name),
             updated_at = NOW()"#,
        user_id, service_id, thread_id, platform, sender_name, preview, direction,
    )
    .execute(pg)
    .await;

    Ok(msg)
}
