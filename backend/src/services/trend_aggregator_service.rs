// TrendPulse Aggregator — Yukpo
// Collecte les tendances multi-sources (externe + interne Yukpo)
// Calcule le Trend Velocity Score personnalisé par utilisateur
// Sources externes : Google Trends (pytrends-like), YouTube Data API, NewsAPI, Reddit
// Sources internes : meta_ad_campaigns, social_chatbot_messages, social_publication_jobs

use chrono::{Duration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::user_context_service::{ActorType, UserCommercialContext};
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendItem {
    pub id: String,
    /// Sujet ou mot-clé tendance
    pub topic: String,
    /// Score social externe 0-100
    pub social_score: f32,
    /// Score commerce interne Yukpo 0-100 (0 si pas de données)
    pub commerce_score: f32,
    /// Score d'opportunité final 0-100
    pub opportunity_score: f32,
    /// Momentum : variation sur 24h en %
    pub momentum_pct: f32,
    /// Catégories concernées (mode, santé, alimentation, etc.)
    pub categories: Vec<String>,
    /// Régions/villes où cette tendance est active
    pub regions: Vec<String>,
    /// Sources qui ont détecté cette tendance
    pub sources: Vec<String>,
    /// Période de référence
    pub period: String,
    /// Produits utilisateur qui matchent cette tendance
    pub matching_products: Vec<MatchingProduct>,
    /// Action recommandée
    pub recommended_action: Option<RecommendedAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingProduct {
    pub product_id: i32,
    pub product_name: String,
    pub service_id: i32,
    pub service_name: String,
    pub match_score: f32,
    pub current_price: f64,
    pub is_promo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedAction {
    pub action_type: String, // "create_promo", "launch_campaign", "schedule_post", "none"
    pub title: String,
    pub description: String,
    pub estimated_roas: Option<f64>,
    pub suggested_budget_fcfa: Option<i64>,
    pub route: Option<String>,
    pub route_params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendPulseResult {
    pub region: String,
    pub period: String,
    pub generated_at: String,
    pub trends: Vec<TrendItem>,
    pub top_personalities: Vec<PersonalityTrend>,
    pub top_sectors: Vec<SectorTrend>,
    /// Trends pertinentes pour CET utilisateur (filtrées et scorées)
    pub personalized_trends: Vec<TrendItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalityTrend {
    pub name: String,
    pub mentions: i64,
    pub domain: String, // politique, sport, musique, business
    pub momentum_pct: f32,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectorTrend {
    pub sector: String,
    pub growth_pct: f32,
    pub top_topic: String,
    pub regions: Vec<String>,
}

// ─── Sources externes ─────────────────────────────────────────────────────────

/// Récupère les tendances Google Trends pour une région africaine
/// Utilise l'endpoint non-officiel Google Trends (RSS dailytrends)
async fn fetch_google_trends(client: &Client, region: &str) -> Vec<TrendItem> {
    // geo code: CM=Cameroun, SN=Sénégal, CI=Côte d'Ivoire, NG=Nigeria
    let geo = match region {
        "CM" => "CM",
        "SN" => "SN",
        "CI" => "CI",
        "NG" => "NG",
        _ => "CM",
    };

    let url = format!(
        "https://trends.google.com/trends/trendingsearches/daily/rss?geo={}",
        geo
    );

    match client.get(&url).timeout(std::time::Duration::from_secs(8)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.text().await {
                parse_google_trends_rss(&body, region)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_google_trends_rss(rss: &str, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    // Extraction simple des <title> dans les <item> RSS Google Trends
    let items: Vec<&str> = rss.split("<item>").skip(1).collect();

    for (i, item) in items.iter().take(20).enumerate() {
        let title = extract_xml_tag(item, "title");
        let traffic_str = extract_xml_tag(item, "ht:approx_traffic");
        if title.is_empty() {
            continue;
        }

        // trafic approximatif → score social
        let traffic: f32 =
            traffic_str.replace('+', "").replace(',', "").parse::<f32>().unwrap_or(0.0);
        let social_score = (traffic / 200000.0 * 100.0).min(100.0).max(5.0);

        // Score de momentum décroissant selon le rang
        let momentum = 80.0 - (i as f32 * 3.5);

        trends.push(TrendItem {
            id: format!("google-{}-{}", region, i),
            topic: title,
            social_score,
            commerce_score: 0.0, // calculé plus tard
            opportunity_score: 0.0,
            momentum_pct: momentum,
            categories: vec![],
            regions: vec![region.to_string()],
            sources: vec!["Google Trends".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

fn extract_xml_tag(xml: &str, tag: &str) -> String {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    if let (Some(start), Some(end)) = (xml.find(&open), xml.find(&close)) {
        let content = &xml[start + open.len()..end];
        // Nettoyer CDATA si présent
        content
            .trim()
            .trim_start_matches("<![CDATA[")
            .trim_end_matches("]]>")
            .trim()
            .to_string()
    } else {
        String::new()
    }
}

/// Récupère les vidéos trending YouTube pour une région
async fn fetch_youtube_trends(client: &Client, region_code: &str, api_key: &str) -> Vec<TrendItem> {
    if api_key.is_empty() {
        return vec![];
    }

    let url = format!(
        "https://www.googleapis.com/youtube/v3/videos\
         ?part=snippet,statistics\
         &chart=mostPopular\
         &regionCode={}\
         &maxResults=20\
         &key={}",
        region_code, api_key
    );

    match client.get(&url).timeout(std::time::Duration::from_secs(8)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                parse_youtube_response(&body, region_code)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_youtube_response(data: &serde_json::Value, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    let items = match data["items"].as_array() {
        Some(v) => v,
        None => return trends,
    };

    for (i, item) in items.iter().take(15).enumerate() {
        let title = item["snippet"]["title"].as_str().unwrap_or("").to_string();
        let category_id = item["snippet"]["categoryId"].as_str().unwrap_or("0").to_string();
        let view_count: f32 = item["statistics"]["viewCount"]
            .as_str()
            .unwrap_or("0")
            .parse::<f32>()
            .unwrap_or(0.0);

        if title.is_empty() {
            continue;
        }

        let social_score = (view_count / 500000.0 * 100.0).min(100.0).max(5.0);
        let category = youtube_category_name(&category_id);

        trends.push(TrendItem {
            id: format!("youtube-{}-{}", region, i),
            topic: title,
            social_score,
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: 60.0 - (i as f32 * 2.5),
            categories: vec![category],
            regions: vec![region.to_string()],
            sources: vec!["YouTube".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

fn youtube_category_name(id: &str) -> String {
    match id {
        "1" => "Film",
        "2" => "Véhicules",
        "10" => "Musique",
        "17" => "Sport",
        "20" => "Jeux vidéo",
        "22" => "People & Blogs",
        "23" => "Comédie",
        "24" => "Divertissement",
        "25" => "Actualités",
        "26" => "Tutoriels",
        "28" => "Science & Tech",
        _ => "Général",
    }
    .to_string()
}

/// Récupère les actualités depuis NewsAPI
async fn fetch_newsapi_trends(client: &Client, country: &str, api_key: &str) -> Vec<TrendItem> {
    if api_key.is_empty() {
        return vec![];
    }

    let url = format!(
        "https://newsapi.org/v2/top-headlines\
         ?country={}\
         &pageSize=20\
         &apiKey={}",
        country, api_key
    );

    match client.get(&url).timeout(std::time::Duration::from_secs(8)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                parse_newsapi_response(&body, country)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_newsapi_response(data: &serde_json::Value, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    let articles = match data["articles"].as_array() {
        Some(v) => v,
        None => return trends,
    };

    for (i, art) in articles.iter().take(15).enumerate() {
        let title = art["title"].as_str().unwrap_or("").to_string();
        let source = art["source"]["name"].as_str().unwrap_or("NewsAPI").to_string();
        if title.is_empty() || title == "[Removed]" {
            continue;
        }

        trends.push(TrendItem {
            id: format!("news-{}-{}", region, i),
            topic: title,
            social_score: 50.0 - (i as f32 * 2.0),
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: 40.0 - (i as f32 * 1.5),
            categories: vec![],
            regions: vec![region.to_string()],
            sources: vec![source],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

// ─── Sources internes Yukpo ───────────────────────────────────────────────────

/// Charge les signaux internes Yukpo : produits les plus demandés via chatbot,
/// catégories avec meilleur ROAS, hashtags qui convertissent
async fn load_yukpo_internal_signals(pg: &PgPool, region: &str) -> Vec<InternalSignal> {
    let week_ago = Utc::now() - Duration::days(7);

    // Mots-clés les plus fréquents dans les chatbots des boutiques de la région
    let region_filter = if region == "ALL" {
        "ALL".to_string()
    } else {
        format!("%{}%", region)
    };
    let keywords = sqlx::query(
        r#"SELECT
               LOWER(TRIM(REGEXP_REPLACE(m.content, '[^a-zA-ZÀ-ÿ\s]', '', 'g'))) as clean_content,
               COUNT(*) as freq
           FROM social_chatbot_messages m
           JOIN social_chatbot_threads t ON t.id = m.thread_id
           JOIN services s ON s.id = t.service_id
           WHERE m.direction = 'inbound'
             AND m.created_at >= $1
             AND (s.data->>'city' ILIKE $2 OR $2 = 'ALL')
           GROUP BY clean_content
           ORDER BY freq DESC
           LIMIT 30"#,
    )
    .bind(week_ago)
    .bind(&region_filter)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    // Catégories avec meilleur ROAS cette semaine
    // product_type est une colonne GENERATED sur service_products
    let top_roas_categories = sqlx::query(
        r#"SELECT
               COALESCE(sp.product_type, 'général') as category,
               AVG(c.roas::float8) as avg_roas,
               COUNT(*) as campaign_count
           FROM meta_ad_campaigns c
           JOIN service_products sp ON sp.service_id = c.service_id
           WHERE c.status = 'active'
             AND c.roas IS NOT NULL
             AND c.roas > 0
           GROUP BY sp.product_type
           ORDER BY avg_roas DESC
           LIMIT 10"#,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    use sqlx::Row;
    let mut signals = Vec::new();

    for kw in &keywords {
        let clean_content: Option<String> = kw.try_get("clean_content").ok().flatten();
        let freq: Option<i64> = kw.try_get("freq").ok().flatten();
        if let Some(content) = clean_content {
            if content.len() >= 4 {
                signals.push(InternalSignal {
                    keyword: content,
                    signal_type: "chatbot_demand".to_string(),
                    score: (freq.unwrap_or(0) as f32 * 2.0).min(40.0),
                    category: None,
                });
            }
        }
    }

    for cat in &top_roas_categories {
        let category: Option<String> = cat.try_get("category").ok().flatten();
        let avg_roas: Option<f64> = cat.try_get("avg_roas").ok().flatten();
        if let Some(category) = category {
            signals.push(InternalSignal {
                keyword: category.clone(),
                signal_type: "high_roas_category".to_string(),
                score: avg_roas.map(|r| (r as f32 * 10.0).min(40.0)).unwrap_or(0.0),
                category: Some(category),
            });
        }
    }

    signals
}

#[derive(Debug)]
struct InternalSignal {
    keyword: String,
    signal_type: String,
    score: f32,
    category: Option<String>,
}

// ─── Scoring personnalisé ─────────────────────────────────────────────────────

/// Calcule le commerce_score et opportunity_score d'une trend en fonction
/// des données réelles de l'utilisateur et de son type d'acteur Yukpo.
///
/// Pondération par acteur :
/// - Supermarché : volume catalogue + promos en masse (poids produits ×1.5)
/// - E-commerce  : catalogue large + potentiel livraison (boost diversité)
/// - Restaurant  : matching plats/menus + événements food (boost saisonnalité)
/// - Pharmacie   : matching médicaments + épidémies/santé (boost santé ×2)
/// - Santé       : services médicaux + actualités santé (boost services)
/// - Transport   : événements + mobilité (boost trend événementielle)
/// - Prestataire : expertise/réputation + niche (matching catégorie précis)
fn score_trend_for_user(
    trend: &mut TrendItem,
    user_ctx: &UserCommercialContext,
    internal_signals: &[InternalSignal],
) {
    let topic_lower = trend.topic.to_lowercase();
    let mut commerce_score: f32 = 0.0;
    let mut best_matches: Vec<MatchingProduct> = Vec::new();

    // Détermine le type d'acteur dominant (le premier service suffit pour orienter)
    let actor_type = user_ctx
        .services
        .first()
        .map(|s| &s.actor_type)
        .unwrap_or(&ActorType::Consommateur);

    // Pondération du score produit selon l'acteur
    let product_score_multiplier: f32 = match actor_type {
        ActorType::Supermarche => 1.5, // volume → amplifie chaque match
        ActorType::Ecommerce => 1.3,   // catalogue large
        ActorType::Pharmacie => 1.8,   // haute pertinence médicale
        ActorType::Restaurant => 1.2,  // menus ciblés
        ActorType::Sante => 1.6,       // services médicaux très ciblés
        ActorType::Transport => 1.0,
        ActorType::Prestataire => 1.0,
        ActorType::Consommateur => 0.5,
    };

    // Mots-clés spécifiques par acteur pour détecter des tendances sectorielles
    let actor_keywords: &[&str] = match actor_type {
        ActorType::Supermarche => &[
            "promotion",
            "solde",
            "alimentation",
            "épicerie",
            "supermarché",
            "marché",
            "nourriture",
            "boisson",
        ],
        ActorType::Ecommerce => &[
            "livraison",
            "commande",
            "en ligne",
            "e-commerce",
            "boutique",
            "achat",
            "shopping",
        ],
        ActorType::Restaurant => &[
            "restaurant",
            "cuisine",
            "repas",
            "menu",
            "gastronomie",
            "nourriture",
            "chef",
            "food",
        ],
        ActorType::Pharmacie => &[
            "santé",
            "médicament",
            "maladie",
            "épidémie",
            "traitement",
            "pharmacie",
            "vaccin",
            "grippe",
            "paludisme",
        ],
        ActorType::Sante => &[
            "hôpital",
            "clinique",
            "médecin",
            "consultation",
            "soin",
            "urgence",
            "santé",
        ],
        ActorType::Transport => &[
            "transport",
            "voyage",
            "déplacement",
            "taxi",
            "covoiturage",
            "mobilité",
            "fête",
            "événement",
        ],
        ActorType::Prestataire | ActorType::Consommateur => &[],
    };

    // 1. Matching avec le catalogue produits de l'utilisateur
    for service in &user_ctx.services {
        for product in &service.products {
            let name_lower = product.name.to_lowercase();
            let cat_lower = product.category.to_lowercase();

            let name_words: Vec<&str> = name_lower.split_whitespace().collect();
            let topic_words: Vec<&str> = topic_lower.split_whitespace().collect();

            let common_words =
                name_words.iter().filter(|w| w.len() >= 4 && topic_words.contains(w)).count();
            let cat_match = topic_lower.contains(&cat_lower)
                || (!cat_lower.is_empty()
                    && cat_lower.len() >= 4
                    && topic_lower.contains(&cat_lower[..cat_lower.len().min(6)]));

            let mut match_score = (common_words as f32 * 20.0) + if cat_match { 25.0 } else { 0.0 };

            match_score *= product_score_multiplier;

            if match_score > 0.0 {
                commerce_score += match_score;
                best_matches.push(MatchingProduct {
                    product_id: product.id,
                    product_name: product.name.clone(),
                    service_id: service.id,
                    service_name: service.name.clone(),
                    match_score,
                    current_price: product.price,
                    is_promo: product.is_promo,
                });
            }
        }
    }

    // 2. Boost sectoriel : si le topic correspond à des mots-clés de l'acteur
    let sector_boost: f32 =
        actor_keywords.iter().filter(|kw| topic_lower.contains(*kw)).count() as f32 * 12.0;
    commerce_score += sector_boost;

    // 3. Boost si le signal chatbot confirme la demande client
    let topic_short = &topic_lower[..topic_lower.len().min(5)];
    for signal in internal_signals {
        if signal.signal_type == "chatbot_demand"
            && (topic_lower.contains(&signal.keyword) || signal.keyword.contains(topic_short))
        {
            commerce_score += signal.score;
        }
    }

    // 4. Boost ROAS pour acteurs avec campagnes Meta Ads performantes
    let max_roas_boost: f32 = match actor_type {
        ActorType::Supermarche | ActorType::Ecommerce => 20.0,
        ActorType::Pharmacie => 18.0,
        _ => 15.0,
    };
    for ad in &user_ctx.ad_signals {
        if ad.roas.unwrap_or(0.0) > 2.5 {
            commerce_score += max_roas_boost;
            break; // un seul boost par campagne performante
        }
    }

    // 5. Normaliser et calculer le score final
    commerce_score = commerce_score.min(100.0);
    trend.commerce_score = commerce_score;

    // Pondération social/commerce selon l'acteur
    // Acteurs avec catalogue dense : commerce prime davantage
    let (social_weight, commerce_weight): (f32, f32) = match actor_type {
        ActorType::Supermarche | ActorType::Ecommerce => (0.30, 0.70),
        ActorType::Pharmacie | ActorType::Sante => (0.35, 0.65),
        ActorType::Transport => (0.55, 0.45), // très dépendant de l'événement social
        _ => (0.40, 0.60),
    };

    let base = trend.social_score * social_weight + commerce_score * commerce_weight;
    let momentum_bonus = (trend.momentum_pct / 100.0 * 15.0).min(15.0);
    trend.opportunity_score = (base + momentum_bonus).min(100.0);

    best_matches.sort_by(|a, b| b.match_score.partial_cmp(&a.match_score).unwrap());
    trend.matching_products = best_matches.into_iter().take(3).collect();

    // 6. Recommandation d'action si opportunité élevée
    let opportunity_threshold = match actor_type {
        ActorType::Supermarche | ActorType::Ecommerce => 60.0, // seuil plus bas : catalogue riche
        ActorType::Pharmacie => 55.0,
        _ => 65.0,
    };
    if trend.opportunity_score >= opportunity_threshold && !trend.matching_products.is_empty() {
        trend.recommended_action = Some(build_recommendation(trend, user_ctx));
    }
}

fn build_recommendation(trend: &TrendItem, user_ctx: &UserCommercialContext) -> RecommendedAction {
    let has_ads = user_ctx.has_meta_ads;
    let avg_roas = user_ctx
        .ad_signals
        .iter()
        .filter_map(|a| a.roas)
        .fold(0.0_f64, |acc, r| acc + r)
        / (user_ctx.ad_signals.len().max(1) as f64);

    let first_product = trend.matching_products.first();
    let service_id = first_product.map(|p| p.service_id).unwrap_or(0);

    if has_ads && avg_roas > 2.0 {
        let estimated_roas = avg_roas * 1.2; // boost trend
        let budget = 15000_i64;
        RecommendedAction {
            action_type: "launch_campaign".to_string(),
            title: format!("Lancer une campagne sur \"{}\"", trend.topic),
            description: format!(
                "Basé sur ton ROAS historique {:.1}x, un budget de {} FCFA devrait générer ~{} FCFA",
                avg_roas,
                budget,
                (budget as f64 * estimated_roas) as i64
            ),
            estimated_roas: Some(estimated_roas),
            suggested_budget_fcfa: Some(budget),
            route: Some("SocialDistribution".to_string()),
            route_params: Some(serde_json::json!({ "service_id": service_id, "tab": "ads" })),
        }
    } else if user_ctx.has_social_accounts {
        RecommendedAction {
            action_type: "schedule_post".to_string(),
            title: format!("Publier sur \"{}\"", trend.topic),
            description: "Cette tendance correspond à tes produits. Crée un post maintenant."
                .to_string(),
            estimated_roas: None,
            suggested_budget_fcfa: None,
            route: Some("SocialDistribution".to_string()),
            route_params: Some(
                serde_json::json!({ "service_id": service_id, "tab": "distribute" }),
            ),
        }
    } else {
        RecommendedAction {
            action_type: "create_promo".to_string(),
            title: format!("Créer une promo liée à \"{}\"", trend.topic),
            description: "Crée une promo flash pour capter cette demande.".to_string(),
            estimated_roas: None,
            suggested_budget_fcfa: None,
            route: Some("CreateFlashPromo".to_string()),
            route_params: Some(serde_json::json!({ "service_id": service_id })),
        }
    }
}

// ─── Twitter/X API ───────────────────────────────────────────────────────────

/// Récupère les trending topics Twitter/X pour une région africaine.
/// Nécessite TWITTER_BEARER_TOKEN (API v2 Basic — $100/mois).
/// Fallback gracieux si token absent ou quota dépassé.
async fn fetch_twitter_trends(client: &Client, region: &str, bearer_token: &str) -> Vec<TrendItem> {
    if bearer_token.is_empty() {
        return vec![];
    }

    // Twitter API v2 — trending topics par pays (WOEID)
    // Cameroun=2233 Sénégal=2245021 Côte d'Ivoire=2247252 Nigeria=2347592
    let woeid = match region {
        "CM" => "2233",
        "SN" => "2245021",
        "CI" => "2247252",
        "NG" => "2347592",
        _ => "23424760", // Afrique (worldwide fallback)
    };

    // Twitter v2 trends endpoint (nécessite OAuth 2.0 Bearer)
    let url = format!("https://api.twitter.com/2/trends/by/woeid/{}", woeid);

    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", bearer_token))
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                parse_twitter_response(&body, region)
            } else {
                vec![]
            }
        }
        Ok(resp) if resp.status().as_u16() == 429 => {
            log::warn!(
                "[TrendAggregator] Twitter rate limit atteint pour région {}",
                region
            );
            vec![]
        }
        Ok(resp) => {
            log::debug!(
                "[TrendAggregator] Twitter API status {} pour {}",
                resp.status(),
                region
            );
            vec![]
        }
        Err(e) => {
            log::debug!("[TrendAggregator] Twitter API indisponible: {}", e);
            vec![]
        }
    }
}

fn parse_twitter_response(data: &serde_json::Value, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();

    // Réponse Twitter v2 : { "data": [{ "name": "#topic", "tweet_count": 12345 }] }
    let items = match data["data"].as_array() {
        Some(v) => v,
        None => return trends,
    };

    for (i, item) in items.iter().take(20).enumerate() {
        let name = item["name"].as_str().unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }
        // Nettoyer le hashtag (#Tendance → Tendance)
        let topic = name.trim_start_matches('#').to_string();

        let tweet_count: f32 = item["tweet_count"].as_i64().unwrap_or(0) as f32;

        // Tweet count → social score (normalisé)
        let social_score = (tweet_count / 100000.0 * 100.0).min(100.0).max(5.0);
        // Twitter a un momentum très élevé (temps réel)
        let momentum = 90.0 - (i as f32 * 3.0);

        trends.push(TrendItem {
            id: format!("twitter-{}-{}", region, i),
            topic,
            social_score,
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: momentum,
            categories: vec![],
            regions: vec![region.to_string()],
            sources: vec!["Twitter/X".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

// ─── Momentum historique (snapshots DB) ──────────────────────────────────────

/// Charge le delta de momentum moyen des 3 derniers snapshots pour chaque topic.
/// Retourne une map topic_lower → momentum_bonus (0 si aucun historique).
async fn load_historical_momentum(
    pg: &sqlx::PgPool,
    region: &str,
) -> std::collections::HashMap<String, f32> {
    let rows = sqlx::query(
        r#"SELECT
               LOWER(topic) as topic,
               AVG(COALESCE(score_delta, 0))::float4 as avg_delta
           FROM trend_snapshots
           WHERE region = $1
             AND snapshot_at >= NOW() - INTERVAL '3 days'
             AND score_delta IS NOT NULL
           GROUP BY LOWER(topic)
           HAVING AVG(COALESCE(score_delta, 0)) > 2.0"#,
    )
    .bind(region)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    use sqlx::Row;
    rows.into_iter()
        .filter_map(|r| {
            let topic: Option<String> = r.try_get("topic").ok().flatten();
            let delta: Option<f32> = r.try_get("avg_delta").ok().flatten();
            let topic = topic?;
            let delta = delta.unwrap_or(0.0);
            // Bonus momentum : delta de 5 pts/jour → +15 de momentum bonus
            Some((topic, (delta * 3.0).min(20.0)))
        })
        .collect()
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

/// Collecte et agrège les tendances pour une région donnée,
/// puis les score selon le profil commercial de l'utilisateur.
pub async fn get_trend_pulse(
    state: &Arc<AppState>,
    region: &str,
    period: &str,
    user_ctx: Option<&UserCommercialContext>,
) -> TrendPulseResult {
    let client = Client::new();

    // Lire les clés API depuis la config (variables d'environnement)
    let youtube_key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    let newsapi_key = std::env::var("NEWSAPI_KEY").unwrap_or_default();

    // Pays pour NewsAPI (CM, SN, etc. → codes ISO 2)
    let newsapi_country = match region {
        "CM" => "cm",
        "SN" => "sn",
        "CI" => "ci",
        "NG" => "ng",
        _ => "fr",
    };

    // Clés API Twitter/X
    let twitter_bearer = std::env::var("TWITTER_BEARER_TOKEN").unwrap_or_default();

    // Collecte parallèle des sources externes (Google + YouTube + NewsAPI + Twitter)
    let (google_trends, youtube_trends, news_trends, twitter_trends) = tokio::join!(
        fetch_google_trends(&client, region),
        fetch_youtube_trends(&client, region, &youtube_key),
        fetch_newsapi_trends(&client, newsapi_country, &newsapi_key),
        fetch_twitter_trends(&client, region, &twitter_bearer),
    );

    // Signaux internes Yukpo
    let internal_signals = load_yukpo_internal_signals(&state.pg, region).await;

    // Historique snapshots pour enrichir le momentum multi-jours
    let historical_momentum = load_historical_momentum(&state.pg, region).await;

    // Fusionner et dédupliquer les tendances
    let mut all_trends: Vec<TrendItem> = Vec::new();
    let mut seen_topics: std::collections::HashSet<String> = std::collections::HashSet::new();

    for mut trend in google_trends
        .into_iter()
        .chain(youtube_trends.into_iter())
        .chain(news_trends.into_iter())
        .chain(twitter_trends.into_iter())
    {
        let key = trend.topic.to_lowercase();
        // Déduplique les topics très similaires (5 premiers chars)
        let short_key = key.chars().take(10).collect::<String>();
        if seen_topics.insert(short_key) {
            // Enrichir avec le momentum historique depuis les snapshots DB
            if let Some(&hist_momentum) = historical_momentum.get(&trend.topic.to_lowercase()) {
                // Bonus : si en hausse sur 3+ snapshots consécutifs, amplifier le momentum
                trend.momentum_pct = (trend.momentum_pct + hist_momentum).min(100.0);
            }
            // Enrichir avec les signaux internes
            if let Some(ctx) = user_ctx {
                score_trend_for_user(&mut trend, ctx, &internal_signals);
            }
            all_trends.push(trend);
        }
    }

    // Trier par opportunity_score décroissant (ou social_score si pas de contexte user)
    all_trends.sort_by(|a, b| {
        b.opportunity_score
            .partial_cmp(&a.opportunity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Trends personnalisées = uniquement celles avec des produits matchants
    let personalized_trends: Vec<TrendItem> = all_trends
        .iter()
        .filter(|t| !t.matching_products.is_empty())
        .take(10)
        .cloned()
        .collect();

    // Top personnalités (extraites des titres d'articles)
    let top_personalities = extract_personalities(&all_trends);

    // Top secteurs depuis les signaux internes
    let top_sectors = build_sector_trends(&internal_signals, region);

    TrendPulseResult {
        region: region.to_string(),
        period: period.to_string(),
        generated_at: Utc::now().to_rfc3339(),
        trends: all_trends.into_iter().take(30).collect(),
        top_personalities,
        top_sectors,
        personalized_trends,
    }
}

/// NER léger : extrait les noms propres fréquents à travers les topics et sources.
/// Heuristique : mots de 2+ tokens commençant par une majuscule, non-stopwords.
/// Associe un domaine (politique, sport, musique, business) selon des mots-clés voisins.
fn extract_personalities(trends: &[TrendItem]) -> Vec<PersonalityTrend> {
    // Mots non-noms-propres à exclure (titres, lieux communs, etc.)
    const EXCLUDE: &[&str] = &[
        "The",
        "Les",
        "Des",
        "Une",
        "Dans",
        "Pour",
        "Avec",
        "Sur",
        "Comment",
        "New",
        "Top",
        "Best",
        "High",
        "Big",
        "Live",
        "Now",
        "Google",
        "YouTube",
        "Facebook",
        "Twitter",
        "WhatsApp",
        "TikTok",
        "Yukpo",
        "Cameroun",
        "Sénégal",
        "Nigeria",
        "Afrique",
        "Africa",
        "International",
        "National",
        "Official",
    ];

    // Indices de domaine : mots qui apparaissent près d'un nom propre → domaine
    const SPORT_WORDS: &[&str] = &[
        "foot", "football", "soccer", "match", "goal", "cup", "ligue", "league", "joueur",
        "player", "coach", "ballon", "score", "finale", "coupe",
    ];
    const MUSIC_WORDS: &[&str] = &[
        "music",
        "musique",
        "album",
        "song",
        "chanson",
        "artiste",
        "artist",
        "concert",
        "clip",
        "rap",
        "afrobeat",
        "coupé-décalé",
        "makossa",
    ];
    const POLITICS_WORDS: &[&str] = &[
        "président",
        "president",
        "ministre",
        "minister",
        "gouvernement",
        "election",
        "parti",
        "parlement",
        "politique",
        "politique",
        "sénat",
        "assemblée",
        "vote",
        "candidat",
    ];
    const BUSINESS_WORDS: &[&str] = &[
        "ceo",
        "directeur",
        "fondateur",
        "entrepreneur",
        "startup",
        "business",
        "milliard",
        "billion",
        "entreprise",
        "company",
        "investisseur",
    ];

    let mut name_freq: std::collections::HashMap<String, (u32, Vec<String>)> =
        std::collections::HashMap::new();

    for trend in trends {
        let text = format!("{} {}", trend.topic, trend.categories.join(" "));
        let words: Vec<&str> = text.split_whitespace().collect();

        for (i, window) in words.windows(2).enumerate() {
            let w0 = window[0];
            let w1 = window[1];

            // Bi-gramme : deux mots consécutifs commençant par majuscule → nom propre candidat
            let starts_upper_0 = w0.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
            let starts_upper_1 = w1.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);

            if starts_upper_0 && starts_upper_1 && w0.len() >= 2 && w1.len() >= 2 {
                let clean0 = w0.trim_matches(|c: char| !c.is_alphabetic());
                let clean1 = w1.trim_matches(|c: char| !c.is_alphabetic());
                if EXCLUDE.contains(&clean0) || EXCLUDE.contains(&clean1) {
                    continue;
                }
                if clean0.len() >= 2 && clean1.len() >= 2 {
                    let full_name = format!("{} {}", clean0, clean1);
                    let entry = name_freq.entry(full_name).or_insert((0, vec![]));
                    entry.0 += 1;
                    // Contexte voisin pour détecter le domaine
                    let ctx_start = i.saturating_sub(3);
                    let ctx_end = (i + 5).min(words.len());
                    let ctx: Vec<String> =
                        words[ctx_start..ctx_end].iter().map(|w| w.to_lowercase()).collect();
                    entry.1.extend(ctx);
                }
            }

            // Uni-gramme : seul nom propre (connu, fréquent — ex: "Mbappé", "Beyoncé")
            if starts_upper_0 && w0.len() >= 4 {
                let clean = w0.trim_matches(|c: char| !c.is_alphabetic());
                if !EXCLUDE.contains(&clean) && clean.len() >= 4 {
                    let entry = name_freq.entry(clean.to_string()).or_insert((0, vec![]));
                    entry.0 += 1;
                }
            }
        }
    }

    // Filtrer : garder uniquement les noms vus au moins 2 fois
    let mut personalities: Vec<PersonalityTrend> = name_freq
        .into_iter()
        .filter(|(_, (freq, _))| *freq >= 2)
        .map(|(name, (freq, ctx_words))| {
            let ctx_lower: Vec<String> = ctx_words.iter().map(|w| w.to_lowercase()).collect();
            let domain = if SPORT_WORDS.iter().any(|w| ctx_lower.iter().any(|c| c.contains(w))) {
                "sport"
            } else if MUSIC_WORDS.iter().any(|w| ctx_lower.iter().any(|c| c.contains(w))) {
                "musique"
            } else if POLITICS_WORDS.iter().any(|w| ctx_lower.iter().any(|c| c.contains(w))) {
                "politique"
            } else if BUSINESS_WORDS.iter().any(|w| ctx_lower.iter().any(|c| c.contains(w))) {
                "business"
            } else {
                "général"
            };

            PersonalityTrend {
                name,
                mentions: freq as i64,
                domain: domain.to_string(),
                momentum_pct: (freq as f32 * 5.0).min(95.0),
                sources: trends
                    .iter()
                    .flat_map(|t| t.sources.iter())
                    .cloned()
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .take(3)
                    .collect(),
            }
        })
        .collect();

    // Trier par fréquence décroissante, garder top 10
    personalities.sort_by(|a, b| b.mentions.cmp(&a.mentions));
    personalities.into_iter().take(10).collect()
}

fn build_sector_trends(signals: &[InternalSignal], region: &str) -> Vec<SectorTrend> {
    let mut sector_map: std::collections::HashMap<String, f32> = std::collections::HashMap::new();

    for sig in signals {
        if sig.signal_type == "high_roas_category" {
            if let Some(cat) = &sig.category {
                *sector_map.entry(cat.clone()).or_insert(0.0) += sig.score;
            }
        }
    }

    let mut sectors: Vec<SectorTrend> = sector_map
        .into_iter()
        .map(|(sector, score)| SectorTrend {
            sector: sector.clone(),
            growth_pct: score,
            top_topic: sector,
            regions: vec![region.to_string()],
        })
        .collect();

    sectors.sort_by(|a, b| b.growth_pct.partial_cmp(&a.growth_pct).unwrap());
    sectors.into_iter().take(8).collect()
}
