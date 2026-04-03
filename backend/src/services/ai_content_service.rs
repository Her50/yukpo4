// Service de génération de contenu IA pour la distribution sociale
// Utilise GPT-4o via le client OpenAI partagé (yukpo_openai_outbound)
// Génère: captions, hashtags, variantes A/B, stories, carrousels

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::yukpo_openai_outbound::resolve_openai_api_key;

// ─── Structures ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductContext {
    pub id: i32,
    pub name: String,
    pub price: f64,
    pub sale_price: Option<f64>,
    pub category: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub in_stock: bool,
    pub brand: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreContext {
    pub name: String,
    pub sector: String, // supermarket, electronics, clothing, pharmacy
    pub city: String,
    pub phone: Option<String>,
    pub yukpo_url: String, // lien deep link vers la boutique Yukpo
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedContent {
    pub caption_a: String,
    pub caption_b: Option<String>, // variante A/B
    pub hashtags: Vec<String>,
    pub story_text: Option<String>, // version courte pour Stories/Status
    pub carousel_slides: Option<Vec<String>>, // pour carousel multi-produits
    pub platform_variants: PlatformVariants,
    pub tone_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformVariants {
    pub facebook: String,
    pub instagram: String,
    pub whatsapp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentPreferences {
    pub tone: String,     // professional, casual, promotional, urgent
    pub language: String, // fr, en
    pub brand_voice: Option<String>,
    pub forbidden_words: Vec<String>,
    pub always_include: Vec<String>,
    pub default_hashtags: Vec<String>,
    pub post_template: Option<String>,
}

impl Default for ContentPreferences {
    fn default() -> Self {
        Self {
            tone: "professional".to_string(),
            language: "fr".to_string(),
            brand_voice: None,
            forbidden_words: vec![],
            always_include: vec![],
            default_hashtags: vec![],
            post_template: None,
        }
    }
}

// ─── Fonctions principales ────────────────────────────────────────────────────

/// Génère un post complet (caption A/B, hashtags, variants plateforme) pour un produit
pub async fn generate_product_post(
    product: &ProductContext,
    store: &StoreContext,
    prefs: &ContentPreferences,
) -> Result<GeneratedContent, String> {
    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;

    let price_display = if let Some(sale) = product.sale_price {
        let discount_pct = ((product.price - sale) / product.price * 100.0).round() as i32;
        format!(
            "Prix promotionnel: {} FCFA (au lieu de {} FCFA, -{discount_pct}%)",
            sale as i64, product.price as i64
        )
    } else {
        format!("Prix: {} FCFA", product.price as i64)
    };

    let stock_info = if product.in_stock {
        "Disponible en stock"
    } else {
        "Stock limité"
    };
    let category_hint = sector_to_fr_hint(&store.sector);
    let tone_instruction = tone_to_instruction(&prefs.tone);
    let language = &prefs.language;

    let forbidden = if prefs.forbidden_words.is_empty() {
        String::new()
    } else {
        format!("Mots interdits: {}.", prefs.forbidden_words.join(", "))
    };

    let always_include = if prefs.always_include.is_empty() {
        String::new()
    } else {
        format!(
            "À inclure impérativement: {}.",
            prefs.always_include.join(", ")
        )
    };

    let brand_voice_hint = prefs.brand_voice.as_deref().unwrap_or("");

    let system_prompt = format!(
        r#"Tu es un expert en marketing digital et community management pour des commerces en Afrique francophone.
Tu travailles pour {store_name}, une boutique {sector_hint} qui vend en ligne via l'application Yukpo.
Langue: {language}. {tone_instruction}
{brand_voice_hint}
{forbidden}
{always_include}
Règles importantes:
- Les publications doivent créer de l'engagement et inciter à l'achat
- Toujours inclure un appel à l'action clair
- Le lien Yukpo doit être intégré naturellement
- Adapter le vocabulaire au public africain francophone
- Pas plus de 3 emojis par publication Facebook/WhatsApp, jusqu'à 5 pour Instagram
- Les hashtags doivent être pertinents et locaux (ex: #Douala #Cameroun)"#,
        store_name = store.name,
        sector_hint = category_hint,
        language = language,
        tone_instruction = tone_instruction,
        brand_voice_hint = brand_voice_hint,
        forbidden = forbidden,
        always_include = always_include,
    );

    let user_prompt = format!(
        r#"Génère du contenu marketing pour ce produit:

PRODUIT: {name}
CATÉGORIE: {category}
{price_display}
{stock_info}
{description}
LIEN BOUTIQUE: {yukpo_url}
{phone_line}

Fournis en JSON valide avec ces champs exacts:
{{
  "caption_a": "Publication principale optimisée engagement (150-300 caractères)",
  "caption_b": "Variante A/B avec angle différent (150-300 caractères)",
  "hashtags": ["hashtag1", "hashtag2", ...] (8-12 hashtags sans #),
  "story_text": "Texte court pour Story/Status WhatsApp (max 80 caractères)",
  "facebook_variant": "Version adaptée Facebook (peut être plus longue, ton communautaire)",
  "instagram_variant": "Version adaptée Instagram (visuel-first, hashtags intégrés)",
  "whatsapp_variant": "Version adaptée WhatsApp Business (direct, professionnel, lien inclus)"
}}"#,
        name = product.name,
        category = product.category,
        price_display = price_display,
        stock_info = stock_info,
        description = product
            .description
            .as_deref()
            .map(|d| format!("DESCRIPTION: {}", d))
            .unwrap_or_default(),
        yukpo_url = store.yukpo_url,
        phone_line = store.phone.as_deref().map(|p| format!("CONTACT: {}", p)).unwrap_or_default(),
    );

    let messages = serde_json::json!([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]);

    let response = call_openai_json(&api_key, messages, 600).await?;

    let caption_a = response["caption_a"].as_str().unwrap_or("").to_string();
    let caption_b = response["caption_b"].as_str().map(|s| s.to_string());
    let hashtags: Vec<String> = response["hashtags"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let story_text = response["story_text"].as_str().map(|s| s.to_string());

    let facebook = response["facebook_variant"].as_str().unwrap_or(&caption_a).to_string();
    let instagram = response["instagram_variant"].as_str().unwrap_or(&caption_a).to_string();
    let whatsapp = response["whatsapp_variant"].as_str().unwrap_or(&caption_a).to_string();

    // Ajouter les hashtags par défaut du partenaire
    let mut all_hashtags = hashtags;
    for h in &prefs.default_hashtags {
        if !all_hashtags.contains(h) {
            all_hashtags.push(h.clone());
        }
    }

    Ok(GeneratedContent {
        caption_a,
        caption_b,
        hashtags: all_hashtags,
        story_text,
        carousel_slides: None,
        platform_variants: PlatformVariants {
            facebook,
            instagram,
            whatsapp,
        },
        tone_used: prefs.tone.clone(),
    })
}

/// Génère un post carrousel pour une sélection de produits
pub async fn generate_carousel_post(
    products: &[ProductContext],
    store: &StoreContext,
    prefs: &ContentPreferences,
    title: Option<&str>,
) -> Result<GeneratedContent, String> {
    if products.is_empty() {
        return Err("Aucun produit fourni".to_string());
    }

    let api_key = resolve_openai_api_key().ok_or("OPENAI_API_KEY non configurée")?;
    let tone_instruction = tone_to_instruction(&prefs.tone);

    let products_list = products
        .iter()
        .take(10) // Max 10 slides carrousel Instagram
        .map(|p| {
            let price = if let Some(s) = p.sale_price {
                format!("{} FCFA (promo)", s as i64)
            } else {
                format!("{} FCFA", p.price as i64)
            };
            format!("- {} | {} | {}", p.name, p.category, price)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let carousel_title = title.unwrap_or("Sélection du moment");

    let user_prompt = format!(
        r#"Génère du contenu pour un carrousel de {n} produits pour {store_name}.
Thème: {title}
{tone_instruction}
Produits:
{products_list}

Lien boutique: {yukpo_url}

JSON valide avec:
{{
  "caption_a": "Texte principal du carrousel (introduction engageante)",
  "caption_b": "Variante avec angle différent",
  "hashtags": ["hashtag1", ...] (10 hashtags),
  "story_text": "Annonce Story courte pour ce carrousel",
  "slides": ["Texte slide 1 (nom + prix)", "Texte slide 2", ...] (un texte par produit),
  "facebook_variant": "...",
  "instagram_variant": "...",
  "whatsapp_variant": "..."
}}"#,
        n = products.len().min(10),
        store_name = store.name,
        title = carousel_title,
        tone_instruction = tone_instruction,
        products_list = products_list,
        yukpo_url = store.yukpo_url,
    );

    let messages = serde_json::json!([
        {"role": "system", "content": format!("Tu es un expert marketing digital pour {} en Afrique francophone. Langue: {}.", store.name, prefs.language)},
        {"role": "user", "content": user_prompt}
    ]);

    let response = call_openai_json(&api_key, messages, 800).await?;

    let caption_a = response["caption_a"].as_str().unwrap_or("").to_string();
    let caption_b = response["caption_b"].as_str().map(|s| s.to_string());
    let hashtags: Vec<String> = response["hashtags"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let story_text = response["story_text"].as_str().map(|s| s.to_string());
    let slides: Vec<String> = response["slides"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    Ok(GeneratedContent {
        caption_a,
        caption_b,
        hashtags,
        story_text,
        carousel_slides: Some(slides),
        platform_variants: PlatformVariants {
            facebook: response["facebook_variant"].as_str().unwrap_or("").to_string(),
            instagram: response["instagram_variant"].as_str().unwrap_or("").to_string(),
            whatsapp: response["whatsapp_variant"].as_str().unwrap_or("").to_string(),
        },
        tone_used: prefs.tone.clone(),
    })
}

/// Analyse les performances des variantes A/B et retourne le gagnant
pub async fn determine_ab_winner(
    pg: &PgPool,
    post_id: i32,
    engagement_a: i32,
    engagement_b: i32,
) -> Result<String, String> {
    let winner = if engagement_a >= engagement_b {
        "A"
    } else {
        "B"
    };

    sqlx::query(
        r#"UPDATE social_ai_posts
           SET ab_winner = $1, engagement_a = $2, engagement_b = $3, updated_at = NOW()
           WHERE id = $4"#,
    )
    .bind(winner)
    .bind(engagement_a)
    .bind(engagement_b)
    .bind(post_id)
    .execute(pg)
    .await
    .map_err(|e| e.to_string())?;

    log::info!(
        "[AIContent] A/B winner pour post {}: {} (A={}, B={})",
        post_id,
        winner,
        engagement_a,
        engagement_b
    );

    Ok(winner.to_string())
}

/// Récupère les préférences de contenu d'un partenaire
pub async fn load_preferences(pg: &PgPool, user_id: i32, service_id: i32) -> ContentPreferences {
    let row = sqlx::query(
        r#"SELECT default_tone, default_language, brand_voice, forbidden_words,
                  always_include, default_hashtags, post_template
           FROM social_ai_preferences
           WHERE user_id = $1 AND service_id = $2"#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    if let Some(r) = row {
        use sqlx::Row;
        ContentPreferences {
            tone: r.get("default_tone"),
            language: r.get("default_language"),
            brand_voice: r.try_get("brand_voice").ok(),
            forbidden_words: r.try_get::<Vec<String>, _>("forbidden_words").unwrap_or_default(),
            always_include: r.try_get::<Vec<String>, _>("always_include").unwrap_or_default(),
            default_hashtags: r.try_get::<Vec<String>, _>("default_hashtags").unwrap_or_default(),
            post_template: r.try_get("post_template").ok(),
        }
    } else {
        ContentPreferences::default()
    }
}

/// Sauvegarde un post généré en base (statut draft ou scheduled)
pub async fn save_generated_post(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    product_id: Option<i32>,
    platform: &str,
    content: &GeneratedContent,
    scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    generation_prompt: Option<&str>,
) -> Result<i32, String> {
    let caption = match platform {
        "facebook" => &content.platform_variants.facebook,
        "instagram" => &content.platform_variants.instagram,
        "whatsapp" => &content.platform_variants.whatsapp,
        _ => &content.caption_a,
    };

    let hashtags_arr: Vec<String> = content.hashtags.clone();
    let status = if scheduled_at.is_some() {
        "scheduled"
    } else {
        "draft"
    };

    let row = sqlx::query(
        r#"INSERT INTO social_ai_posts
           (user_id, service_id, product_id, platform, caption, caption_variant_b,
            hashtags, status, tone, scheduled_at, ai_model, generation_prompt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'gpt-4o', $11)
           RETURNING id"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(product_id)
    .bind(platform)
    .bind(caption.as_str())
    .bind(content.caption_b.as_deref())
    .bind(&hashtags_arr)
    .bind(status)
    .bind(content.tone_used.as_str())
    .bind(scheduled_at)
    .bind(generation_prompt)
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;

    use sqlx::Row;
    Ok(row.try_get::<i32, _>("id").map_err(|e| e.to_string())?)
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

async fn call_openai_json(
    api_key: &str,
    messages: serde_json::Value,
    max_tokens: u32,
) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.8,
        "response_format": {"type": "json_object"}
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {}: {}", status, text));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"].as_str().ok_or("Réponse OpenAI vide")?;

    serde_json::from_str(content)
        .map_err(|e| format!("JSON parse error: {} — contenu: {}", e, content))
}

fn tone_to_instruction(tone: &str) -> &'static str {
    match tone {
        "casual" => "Ton décontracté, proche, comme un ami qui recommande.",
        "promotional" => {
            "Ton promotionnel, urgence et bénéfices mis en avant, appel à l'action fort."
        }
        "urgent" => "Ton d'urgence maximale: stock limité, offre éphémère, ne pas rater.",
        "luxury" => "Ton haut de gamme, élégant, valorisant l'exclusivité.",
        _ => "Ton professionnel, chaleureux, crédible et inspirant confiance.",
    }
}

fn sector_to_fr_hint(sector: &str) -> &'static str {
    match sector {
        "supermarket" => "supermarché / épicerie (produits alimentaires, ménagers, hygiène)",
        "electronics" => "électronique / téléphonie (smartphones, appareils, accessoires)",
        "clothing" => "mode / vêtements (prêt-à-porter, chaussures, accessoires mode)",
        "pharmacy" => "pharmacie / santé (médicaments, parapharmacie, bien-être)",
        "restaurant" => "restauration (plats, menus, livraison de repas)",
        "beauty" => "beauté / cosmétiques (soins, maquillage, parfumerie)",
        "furniture" => "ameublement / décoration (meubles, déco, maison)",
        _ => "commerce (vente de produits et services)",
    }
}
