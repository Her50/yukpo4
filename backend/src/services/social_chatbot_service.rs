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
    /// Sujets tendance locaux injectés dans le prompt (max 5)
    pub trending_topics: Vec<String>,
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
    let context = assemble_context(
        state,
        user_id,
        service_id,
        &msg.external_sender_id,
        &msg.text,
        &config,
    )
    .await;

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
        // Pour WhatsApp, page_id = phone_number_id du partenaire (stocké dans social_accounts.metadata)
        "whatsapp" => {
            send_whatsapp_response_with_phone_id(&token, sender_id, page_id, response).await
        }
        // Commentaires publics — page_id = comment_id dans ce contexte
        "facebook_comment" => {
            // sender_id = user PSID, page_id = comment_id à répondre
            send_facebook_comment_reply(&token, page_id, &response.text).await
        }
        "instagram_comment" => {
            // page_id = comment_id Instagram à répondre
            send_instagram_comment_reply(&token, page_id, &response.text).await
        }
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

// ─── Réponse aux commentaires Facebook ───────────────────────────────────────

/// Répond à un commentaire Facebook en publiant une réponse imbriquée.
/// Endpoint : POST /{comment_id}/comments
async fn send_facebook_comment_reply(
    access_token: &str,
    comment_id: &str,
    text: &str,
) -> Result<String, String> {
    let url = format!("https://graph.facebook.com/v19.0/{}/comments", comment_id);
    let body = serde_json::json!({ "message": text });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Facebook comment reply: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text_err = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Facebook comment reply error {}: {}",
            status, text_err
        ));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let reply_id = json["id"].as_str().unwrap_or("").to_string();
    log::info!(
        "[Chatbot] 💬 Réponse commentaire Facebook publiée: {}",
        reply_id
    );
    Ok(reply_id)
}

// ─── Réponse aux commentaires Instagram ──────────────────────────────────────

/// Répond à un commentaire Instagram via l'API Graph.
/// Endpoint : POST /{ig_comment_id}/replies
async fn send_instagram_comment_reply(
    access_token: &str,
    comment_id: &str,
    text: &str,
) -> Result<String, String> {
    let url = format!("https://graph.facebook.com/v19.0/{}/replies", comment_id);
    let body = serde_json::json!({ "message": text });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erreur réseau Instagram comment reply: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text_err = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Instagram comment reply error {}: {}",
            status, text_err
        ));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let reply_id = json["id"].as_str().unwrap_or("").to_string();
    log::info!(
        "[Chatbot] 💬 Réponse commentaire Instagram publiée: {}",
        reply_id
    );
    Ok(reply_id)
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

async fn send_whatsapp_response_with_phone_id(
    access_token: &str,
    recipient_phone: &str,
    phone_number_id: &str, // ID du numéro WhatsApp du partenaire (from social_accounts.metadata)
    response: &BotResponse,
) -> Result<String, String> {
    // Utiliser le phone_number_id du partenaire ; fallback sur la var d'env si vide
    let phone_number_id = if phone_number_id.is_empty() || phone_number_id == "0" {
        std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_else(|_| "0".to_string())
    } else {
        phone_number_id.to_string()
    };

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

    // Détecter la langue du message entrant pour adapter la réponse
    let detected_lang = detect_language(user_message);
    let response_lang_instruction = language_instruction(&detected_lang, &config.language);

    // White-label : masquer "Yukpo" si l'abonnement premium l'exige
    let platform_label = if config.white_label_enabled {
        config
            .white_label_brand_name
            .as_deref()
            .unwrap_or(&context.store_name)
            .to_string()
    } else {
        "Yukpo".to_string()
    };

    // Bloc persona : adapte l'identité et le rôle de l'assistant
    let persona_block = match config.account_persona.as_str() {
        "creator" => format!(
            "Tu es {bot_name}, l'assistant de {name}, un créateur de contenu basé à {city}.\n\
             Tu réponds aux fans et à la communauté avec authenticité et enthousiasme.\n\
             Tu n'as pas de catalogue de produits. Oriente vers les liens de collaboration ou de contact.",
            bot_name = context.bot_name,
            name = context.store_name,
            city = context.city,
        ),
        "personality" => format!(
            "Tu es {bot_name}, l'assistant officiel de {name} ({sector}) basé à {city}.\n\
             Tu représentes la marque personnelle avec professionnalisme.\n\
             Mode RP : ne confirme JAMAIS d'informations privées. Redirige vers l'attaché de presse pour les demandes médias.\n\
             Pas de catalogue produit direct : oriente vers les partenaires officiels.",
            bot_name = context.bot_name,
            name = context.store_name,
            sector = context.sector,
            city = context.city,
        ),
        "enterprise" => format!(
            "Tu es {bot_name}, l'assistant virtuel de {name}, une entreprise {sector} à {city}.\n\
             Tu réponds aux demandes B2B et grand public avec rigueur et efficacité.\n\
             Pour toute demande de devis ou de partenariat, collecte le nom, l'email et le besoin, puis transmets à l'équipe commerciale.",
            bot_name = context.bot_name,
            name = context.store_name,
            sector = context.sector,
            city = context.city,
        ),
        // "shop" (défaut)
        _ => {
            let app_ref = if config.white_label_enabled {
                String::new()
            } else {
                format!(" disponible sur {}", platform_label)
            };
            format!(
                "Tu es {bot_name}, l'assistant virtuel de {name}, une boutique {sector} à {city}{app_ref}.\n\
                 Tu réponds aux clients sur la messagerie.",
                bot_name = context.bot_name,
                name = context.store_name,
                sector = context.sector,
                city = context.city,
                app_ref = app_ref,
            )
        }
    };

    // Bloc catalogue (non affiché pour créateurs et personnalités sans produits)
    let catalogue_block = if context.products_summary.is_empty()
        || matches!(config.account_persona.as_str(), "creator" | "personality")
    {
        String::new()
    } else {
        format!(
            "\nCATALOGUE (sélection la plus pertinente) :\n{}\n\nPROMOTIONS ACTIVES :\n{}",
            products_text, promos_text
        )
    };

    // Bloc informations de contact
    let contact_block = {
        let phone_str = context.phone.as_deref().unwrap_or("non précisé");
        let order_line = if config.account_persona == "shop" && !config.white_label_enabled {
            format!("\n- Lien pour commander : {}", context.yukpo_url)
        } else if config.account_persona == "shop" {
            format!("\n- Lien boutique : {}", context.yukpo_url)
        } else {
            String::new()
        };
        format!(
            "\nINFORMATIONS :\n- Nom : {}\n- Ville : {}\n- Contact : {}{}",
            context.store_name, context.city, phone_str, order_line
        )
    };

    // Bloc TrendPulse : inject les tendances si disponibles
    let trend_block = if context.trending_topics.is_empty() {
        String::new()
    } else {
        format!(
            "\nTENDANCES ACTUELLES (utilise-les si pertinent dans ta réponse) :\n{}",
            context
                .trending_topics
                .iter()
                .map(|t| format!("- #{}", t))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };

    // Règles selon persona
    let rules_block = match config.account_persona.as_str() {
        "creator" | "personality" => format!(
            "\nRÈGLES IMPORTANTES :\n\
             1. Réponds de manière authentique, jamais en mode robot\n\
             2. Maximum {max_tokens} tokens par réponse\n\
             3. Ne révèle JAMAIS d'informations privées (adresse, numéro perso, planning)\n\
             4. Emojis bienvenus mais avec mesure (max 3)\n\
             5. Ton admiratif → valorise sans en faire trop\n\
             6. Ton agressif / haineux → réponse calme et désamorçage\n\
             7. Demande presse / interview → renvoie vers contact officiel",
            max_tokens = config.max_ai_tokens_per_response,
        ),
        "enterprise" => format!(
            "\nRÈGLES IMPORTANTES :\n\
             1. Réponses professionnelles et concises\n\
             2. Maximum {max_tokens} tokens\n\
             3. Réclamation → empathie + solution concrète + escalade si nécessaire\n\
             4. Devis → collecte nom/email/besoin sans engagement de prix\n\
             5. Emojis : 0 sauf contexte bienveillant évident\n\
             6. Ne donne JAMAIS de fausses informations",
            max_tokens = config.max_ai_tokens_per_response,
        ),
        // shop (défaut)
        _ => {
            let delivery_line = if config.white_label_enabled {
                "4. LIVRAISON → indique que l'équipe gère la livraison".to_string()
            } else {
                format!(
                    "4. LIVRAISON → indique que {} gère la livraison, contact : {}",
                    platform_label,
                    context.phone.as_deref().unwrap_or("")
                )
            };
            let order_line = if config.white_label_enabled {
                "3. ACHAT → donne le lien boutique".to_string()
            } else {
                format!(
                    "3. ACHAT → donne le lien {} : {}",
                    platform_label, context.yukpo_url
                )
            };
            format!(
                "\nRÈGLES IMPORTANTES :\n\
                 1. Réponds toujours de manière naturelle et humaine (pas de style robot)\n\
                 2. Maximum {max_tokens} tokens par réponse\n\
                 {order_line}\n\
                 {delivery_line}\n\
                 5. RÉCLAMATION → empathie d'abord, puis solution concrète\n\
                 6. Si tu ne connais pas → dis-le honnêtement, ne jamais inventer\n\
                 7. Ne donne JAMAIS de fausses informations sur les prix ou stocks\n\
                 8. Emojis avec modération (max 2 par message, 0 si client frustré)\n\
                 9. Concis : 1-3 phrases sauf question complexe",
                max_tokens = config.max_ai_tokens_per_response,
                order_line = order_line,
                delivery_line = delivery_line,
            )
        }
    };

    let system_prompt = format!(
        "{persona_block}\n{response_lang_instruction}\n\nCOMPRÉHENSION LINGUISTIQUE :\n\
         Tu comprends et réponds dans ces langues africaines et internationales :\n\
         - Français, English, Português, Español, العربية\n\
         - Langues africaines : Wolof, Lingala, Yoruba, Hausa, Malagasy, Swahili, Amharique, Twi, Bambara, Pulaar/Fulfulde, Cameroonian Pidgin\n\
         - Si le client écrit dans une langue locale, réponds dans cette même langue ou en français.\n\
         \nANALYSE D'INTENTION (NLU) :\nAvant de répondre, identifie mentalement :\n\
         - INTENTION : achat | info_produit | réclamation | livraison | paiement | disponibilité | promotion | autre\n\
         - SENTIMENT : positif | neutre | frustré | urgent | enthousiaste\n\
         - URGENCE : normale | haute (mots-clés : \"urgent\", \"vite\", \"maintenant\", \"emergency\")\
         {contact_block}{catalogue_block}{trend_block}{rules_block}",
        persona_block = persona_block,
        response_lang_instruction = response_lang_instruction,
        contact_block = contact_block,
        catalogue_block = catalogue_block,
        trend_block = trend_block,
        rules_block = rules_block,
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
    user_message: &str,
    config: &BotConfig,
) -> BotContext {
    let pg = &state.pg;

    // Infos service
    let service_info = sqlx::query(
        r#"SELECT s.name, s.city, s.phone,
                  COALESCE(st.name, 'commerce') as sector
           FROM services s
           LEFT JOIN service_types st ON st.id = s.service_type_id
           WHERE s.id = $1"#,
    )
    .bind(service_id)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    use sqlx::Row;
    let (store_name, city, phone, sector) = service_info
        .map(|s| {
            (
                s.try_get::<String, _>("name").unwrap_or_else(|_| "Boutique".to_string()),
                s.try_get::<Option<String>, _>("city")
                    .unwrap_or(None)
                    .unwrap_or_else(|| "".to_string()),
                s.try_get::<Option<String>, _>("phone").unwrap_or(None),
                s.try_get::<Option<String>, _>("sector")
                    .unwrap_or(None)
                    .unwrap_or_else(|| "commerce".to_string()),
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

    // Produits du catalogue — recherche intelligente par FTS si message non vide
    // Pour les grands catalogues (supermarchés, etc.) on retourne les 15 plus pertinents,
    // sinon les 15 produits les plus récents + promos.
    let products = {
        use sqlx::Row;
        let query_term = user_message.trim();
        let rows = if query_term.len() >= 3
            && config.account_persona != "creator"
            && config.account_persona != "personality"
        {
            // FTS : produits les plus pertinents par rapport au message
            sqlx::query(
                r#"SELECT id, name, price, sale_price, category, is_active,
                          ts_rank(
                            to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(category,'')),
                            plainto_tsquery('simple', $2)
                          ) AS rank
                   FROM service_products
                   WHERE service_id = $1 AND is_active = true
                   ORDER BY
                     rank DESC,
                     CASE WHEN sale_price IS NOT NULL THEN 0 ELSE 1 END,
                     created_at DESC
                   LIMIT 15"#,
            )
            .bind(service_id)
            .bind(query_term)
            .fetch_all(pg)
            .await
            .unwrap_or_default()
        } else {
            // Pas de FTS (créateur/personnalité ou message trop court) — top promos + récents
            sqlx::query(
                r#"SELECT id, name, price, sale_price, category, is_active
                   FROM service_products
                   WHERE service_id = $1 AND is_active = true
                   ORDER BY
                     CASE WHEN sale_price IS NOT NULL THEN 0 ELSE 1 END,
                     created_at DESC
                   LIMIT 15"#,
            )
            .bind(service_id)
            .fetch_all(pg)
            .await
            .unwrap_or_default()
        };
        rows.into_iter()
            .map(|r: sqlx::postgres::PgRow| ProductSummary {
                id: r.try_get("id").unwrap_or(0),
                name: r.try_get("name").unwrap_or_default(),
                price: r.try_get::<f64, _>("price").unwrap_or(0.0),
                sale_price: r.try_get("sale_price").ok(),
                category: r.try_get("category").unwrap_or_else(|_| "autres".to_string()),
                in_stock: r.try_get("is_active").unwrap_or(false),
            })
            .collect::<Vec<_>>()
    };

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

    // TrendPulse : top 5 tendances actives pour le secteur / la ville
    let trending_topics: Vec<String> = {
        use sqlx::Row;
        sqlx::query(
            r#"SELECT topic
               FROM social_trend_snapshots
               WHERE (city = $1 OR city IS NULL)
                 AND (sector = $2 OR sector IS NULL)
                 AND captured_at >= NOW() - INTERVAL '48 hours'
               ORDER BY score DESC
               LIMIT 5"#,
        )
        .bind(&city)
        .bind(&sector)
        .fetch_all(pg)
        .await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|r| r.try_get::<String, _>("topic").ok())
        .collect()
    };

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
        trending_topics,
        recent_orders: {
            use sqlx::Row;
            sqlx::query(
                r#"SELECT so.id, so.status::text AS status,
                          COALESCE(so.estimated_total_cents, 0)::bigint AS total_fcfa,
                          COUNT(soi.id)::int AS items_count
                   FROM shopping_orders so
                   LEFT JOIN shopping_order_items soi ON soi.shopping_order_id = so.id
                   WHERE so.service_id = $1
                   GROUP BY so.id, so.status, so.estimated_total_cents
                   ORDER BY so.created_at DESC
                   LIMIT 5"#,
            )
            .bind(service_id)
            .fetch_all(pg)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|r| OrderSummary {
                id: r.try_get("id").unwrap_or(0),
                status: r.try_get("status").unwrap_or_default(),
                items_count: r.try_get("items_count").unwrap_or(0),
                total_fcfa: r.try_get("total_fcfa").unwrap_or(0),
            })
            .collect()
        },
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
    let rows = sqlx::query(
        r#"SELECT m.direction, m.content
           FROM social_chatbot_messages m
           JOIN social_chatbot_threads t ON t.id = m.thread_id
           WHERE t.user_id = $1 AND t.platform = $2 AND t.external_sender_id = $3
           ORDER BY m.created_at DESC
           LIMIT $4"#,
    )
    .bind(user_id)
    .bind(platform)
    .bind(sender_id)
    .bind(limit)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    use sqlx::Row;
    rows.into_iter()
        .rev()
        .map(|r| {
            (
                r.try_get("direction").unwrap_or_default(),
                r.try_get("content").unwrap_or_default(),
            )
        })
        .collect()
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
    /// Persona: "shop" | "creator" | "personality" | "enterprise"
    account_persona: String,
    /// Si true → retire toutes les mentions "Yukpo" des réponses
    white_label_enabled: bool,
    /// Nom de marque alternatif quand white_label_enabled = true
    white_label_brand_name: Option<String>,
}

async fn load_bot_config(pg: &PgPool, user_id: i32, service_id: i32) -> Result<BotConfig, String> {
    let row = sqlx::query(
        r#"SELECT is_active, bot_name, welcome_message, away_message,
                  escalation_trigger_words, business_hours,
                  max_ai_tokens_per_response, language, reply_delay_ms,
                  COALESCE(account_persona, 'shop') AS account_persona,
                  COALESCE(white_label_enabled, false) AS white_label_enabled,
                  white_label_brand_name
           FROM social_chatbot_config
           WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(if let Some(r) = row {
        use sqlx::Row;
        BotConfig {
            is_active: r.try_get("is_active").unwrap_or(true),
            bot_name: r.try_get("bot_name").unwrap_or_else(|_| "Assistant".to_string()),
            welcome_message: r.try_get("welcome_message").ok(),
            away_message: r.try_get("away_message").ok(),
            escalation_trigger_words: r
                .try_get::<Vec<String>, _>("escalation_trigger_words")
                .unwrap_or_default(),
            business_hours: r.try_get("business_hours").unwrap_or(serde_json::Value::Null),
            max_ai_tokens_per_response: r.try_get("max_ai_tokens_per_response").unwrap_or(400),
            language: r.try_get("language").unwrap_or_else(|_| "fr".to_string()),
            reply_delay_ms: r.try_get("reply_delay_ms").unwrap_or(1500),
            account_persona: r.try_get("account_persona").unwrap_or_else(|_| "shop".to_string()),
            white_label_enabled: r.try_get("white_label_enabled").unwrap_or(false),
            white_label_brand_name: r.try_get("white_label_brand_name").ok().flatten(),
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
            account_persona: "shop".to_string(),
            white_label_enabled: false,
            white_label_brand_name: None,
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

    let row = sqlx::query(
        r#"SELECT access_token, metadata
           FROM social_accounts
           WHERE user_id = $1 AND platform = $2"#,
    )
    .bind(user_id)
    .bind(account_platform)
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Compte {} non connecté", platform))?;

    use sqlx::Row;
    let access_token: String = row.try_get("access_token").map_err(|e| e.to_string())?;
    let metadata: Option<serde_json::Value> = row.try_get("metadata").ok();

    // Pour Facebook/Instagram: chercher le page_access_token dans metadata
    if let Some(pages) = metadata.as_ref().and_then(|m| m["pages"].as_array()) {
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
    Ok(access_token)
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
    use sqlx::Row;
    let thread_row = sqlx::query(
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
    )
    .bind(user_id)
    .bind(service_id)
    .bind(platform)
    .bind(sender_id)
    .bind(sender_name)
    .bind(sender_type)
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;
    let thread_id: i64 = thread_row.try_get("id").map_err(|e| e.to_string())?;

    // Insérer message
    let msg_row = sqlx::query(
        r#"INSERT INTO social_chatbot_messages
           (thread_id, direction, sender_type, content, external_message_id, ai_tokens_used)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id"#,
    )
    .bind(thread_id)
    .bind(direction)
    .bind(sender_type)
    .bind(content)
    .bind(external_message_id)
    .bind(tokens_used)
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;
    let msg: i64 = msg_row.try_get("id").map_err(|e| e.to_string())?;

    // Upsert inbox summary
    let preview = if content.len() > 80 {
        format!("{}...", &content[..77])
    } else {
        content.to_string()
    };
    let _ = sqlx::query(
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
    )
    .bind(user_id)
    .bind(service_id)
    .bind(thread_id)
    .bind(platform)
    .bind(sender_name)
    .bind(preview)
    .bind(direction)
    .execute(pg)
    .await;

    Ok(msg)
}

// ─── NLU : Détection langue ───────────────────────────────────────────────────

/// Détecte la langue dominante d'un message en utilisant whatlang ou heuristiques.
fn detect_language(text: &str) -> String {
    // Utiliser whatlang si disponible (déjà importé dans app_ia.rs)
    if let Some(info) = whatlang::detect(text) {
        let lang = format!("{:?}", info.lang()).to_lowercase();
        // Mapper vers codes ISO simples
        return match lang.as_str() {
            "french" => "fr",
            "english" => "en",
            "arabic" => "ar",
            "spanish" => "es",
            "portuguese" => "pt",
            "swahili" => "sw",
            "amharic" => "am",
            "yoruba" => "yo",
            "hausa" => "ha",
            _ => "fr", // défaut
        }
        .to_string();
    }

    // Heuristiques simples si whatlang échoue
    let text_lower = text.to_lowercase();
    // Wolof (Sénégal)
    if text_lower.contains("nanga") || text_lower.contains("waaw") || text_lower.contains("dafa") {
        return "wo".to_string();
    }
    // Lingala (Congo/RDC)
    if text_lower.contains("lokola")
        || text_lower.contains("malamu")
        || text_lower.contains("nazali")
    {
        return "ln".to_string();
    }
    // Malagasy
    if text_lower.contains("misaotra")
        || text_lower.contains("azafady")
        || text_lower.contains("tsara")
    {
        return "mg".to_string();
    }
    // Bambara
    if text_lower.contains("aw ni ce") || text_lower.contains("aw bara") {
        return "bm".to_string();
    }
    // Cameroonian Pidgin
    if text_lower.contains("how na") || text_lower.contains("na so") || text_lower.contains("wey") {
        return "pcm".to_string();
    }
    // Défaut
    "fr".to_string()
}

/// Construit l'instruction de langue pour le system prompt
fn language_instruction(detected: &str, configured: &str) -> String {
    let lang_name = match detected {
        "fr" => "français",
        "en" => "anglais",
        "ar" => "arabe",
        "es" => "espagnol",
        "pt" => "portugais",
        "sw" => "swahili",
        "am" => "amharique",
        "yo" => "yoruba",
        "ha" => "haoussa",
        "wo" => "wolof",
        "ln" => "lingala",
        "mg" => "malagasy",
        "bm" => "bambara",
        "pcm" => "pidgin camerounais",
        _ => "français",
    };

    if detected != configured && detected != "fr" {
        // Le client écrit dans une langue différente de celle configurée → s'adapter
        format!(
            "Langue détectée du client : {}. Réponds dans cette langue. \
             Langue secondaire de la boutique : {}.",
            lang_name, configured
        )
    } else {
        format!("Langue de communication : {}.", lang_name)
    }
}

// ─── Escalade agent réelle ────────────────────────────────────────────────────

/// Notifie l'agent humain via WhatsApp Business quand une conversation est escaladée.
/// Utilise le token global WhatsApp (configuration boutique).
pub async fn notify_agent_escalation(
    state: &Arc<AppState>,
    user_id: i32,
    service_id: i32,
    thread_id: i64,
    sender_name: &str,
    platform: &str,
    message_preview: &str,
    escalation_reason: &str,
) {
    // Récupérer le numéro de téléphone du partenaire pour notification
    use sqlx::Row;
    let phone_row =
        sqlx::query("SELECT phone FROM services WHERE id = $1 AND user_id = $2 LIMIT 1")
            .bind(service_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    let manager_phone =
        phone_row.and_then(|r| r.try_get::<Option<String>, _>("phone").ok().flatten());

    // Enregistrer l'escalade en DB
    let _ = sqlx::query(
        r#"INSERT INTO social_escalation_events
           (user_id, service_id, thread_id, reason, escalated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(thread_id)
    .bind(escalation_reason)
    .execute(&state.pg)
    .await;

    // Marquer la conversation comme escaladée dans l'inbox
    let _ = sqlx::query(
        "UPDATE social_inbox_summary SET is_escalated = true, updated_at = NOW() WHERE thread_id = $1",
    )
    .bind(thread_id)
    .execute(&state.pg)
    .await;

    // Notification WhatsApp à l'agent si numéro disponible
    if let Some(phone) = manager_phone {
        let wa_token = std::env::var("WHATSAPP_ACCESS_TOKEN").unwrap_or_default();
        let phone_id = std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_default();

        if !wa_token.is_empty() && !phone_id.is_empty() {
            let notification = format!(
                "🔔 *Escalade Yukpo — Action requise*\n\n\
                 📱 Plateforme : {}\n\
                 👤 Client : {}\n\
                 💬 Message : {}\n\
                 ⚠️ Raison : {}\n\n\
                 Connectez-vous à Yukpo pour répondre directement.",
                platform,
                sender_name,
                &message_preview[..message_preview.len().min(150)],
                escalation_reason
            );

            let body = serde_json::json!({
                "messaging_product": "whatsapp",
                "to": phone.replace("+", "").replace(" ", "").replace("-", ""),
                "type": "text",
                "text": { "body": notification, "preview_url": false }
            });

            let client = reqwest::Client::new();
            let result = client
                .post(format!(
                    "https://graph.facebook.com/v19.0/{}/messages",
                    phone_id
                ))
                .bearer_auth(&wa_token)
                .json(&body)
                .timeout(std::time::Duration::from_secs(10))
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => {
                    log::info!(
                        "[Chatbot] ✅ Escalade notifiée via WhatsApp — thread={} manager={}",
                        thread_id,
                        phone
                    );
                }
                Ok(resp) => {
                    log::warn!(
                        "[Chatbot] Escalade WhatsApp status {} pour thread={}",
                        resp.status(),
                        thread_id
                    );
                }
                Err(e) => {
                    log::warn!("[Chatbot] Escalade WhatsApp erreur: {}", e);
                }
            }
        }
    }
}
