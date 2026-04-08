// TrendPulse Aggregator — Yukpo (SerpAPI + YouTube + NewsAPI activés)
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

    // ✅ Priorité : SerpAPI Google Trends (contourne le blocage GCP)
    // SerpAPI route via proxies résidentiels → pas de CAPTCHA/403
    let serpapi_key = std::env::var("SERPAPI_KEY").unwrap_or_default();
    if !serpapi_key.is_empty() {
        let url = format!(
            "https://serpapi.com/search.json?engine=google_trends&q=trending&geo={}&data_type=TRENDING_SEARCHES&api_key={}",
            geo, serpapi_key
        );
        if let Ok(resp) = client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await
        {
            if resp.status().is_success() {
                if let Ok(body) = resp.text().await {
                    let parsed = parse_serpapi_trends(&body, region);
                    if !parsed.is_empty() {
                        return parsed;
                    }
                }
            }
        }
    }

    // Fallback : RSS direct (fonctionne parfois selon l'IP)
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

fn parse_serpapi_trends(json_body: &str, region: &str) -> Vec<TrendItem> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(json_body) else {
        return vec![];
    };
    let Some(searches) = v.get("trending_searches").and_then(|s| s.as_array()) else {
        return vec![];
    };
    searches
        .iter()
        .take(20)
        .enumerate()
        .filter_map(|(i, item)| {
            let topic = item.get("query")?.as_str()?.to_string();
            if topic.is_empty() {
                return None;
            }
            let traffic: f32 = item
                .get("formattedTraffic")
                .and_then(|t| t.as_str())
                .map(|s| {
                    s.replace('+', "")
                        .replace(',', "")
                        .replace('K', "000")
                        .parse::<f32>()
                        .unwrap_or(0.0)
                })
                .unwrap_or(0.0);
            let social_score = (traffic / 200000.0 * 100.0).min(100.0).max(5.0);
            Some(TrendItem {
                id: format!("serp-{}-{}", region, i),
                topic,
                social_score,
                commerce_score: 0.0,
                opportunity_score: 0.0,
                momentum_pct: (80.0 - i as f32 * 3.5).max(10.0),
                categories: vec![],
                regions: vec![region.to_string()],
                sources: vec!["Google Trends".to_string()],
                period: "24h".to_string(),
                matching_products: vec![],
                recommended_action: None,
            })
        })
        .collect()
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

// ─── Chargement depuis les snapshots DB ──────────────────────────────────────

/// Charge les tendances récentes depuis la table trend_snapshots (cache fiable).
/// Retourne None si pas de snapshots récents (< 4 heures).
async fn load_trends_from_snapshots(
    pg: &sqlx::PgPool,
    region: &str,
    period: &str,
    limit: usize,
) -> Option<Vec<TrendItem>> {
    use sqlx::Row;

    // Filtre de région : si ALL → toutes les régions connues
    let rows = if region == "ALL" {
        sqlx::query(
            r#"SELECT id, region, topic, social_score, commerce_score,
                      opportunity_score, momentum_pct, categories, sources, snapshot_at
               FROM trend_snapshots
               WHERE snapshot_at >= NOW() - INTERVAL '4 hours'
               ORDER BY social_score DESC, snapshot_at DESC
               LIMIT $1"#,
        )
        .bind(limit as i64)
        .fetch_all(pg)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query(
            r#"SELECT id, region, topic, social_score, commerce_score,
                      opportunity_score, momentum_pct, categories, sources, snapshot_at
               FROM trend_snapshots
               WHERE region = $1
                 AND snapshot_at >= NOW() - INTERVAL '4 hours'
               ORDER BY social_score DESC, snapshot_at DESC
               LIMIT $2"#,
        )
        .bind(region)
        .bind(limit as i64)
        .fetch_all(pg)
        .await
        .unwrap_or_default()
    };

    if rows.is_empty() {
        // Essayer avec une fenêtre plus large (24h) si rien de récent
        let rows_24h = if region == "ALL" {
            sqlx::query(
                r#"SELECT DISTINCT ON (topic) id, region, topic, social_score, commerce_score,
                          opportunity_score, momentum_pct, categories, sources, snapshot_at
                   FROM trend_snapshots
                   WHERE snapshot_at >= NOW() - INTERVAL '24 hours'
                   ORDER BY topic, snapshot_at DESC, social_score DESC
                   LIMIT $1"#,
            )
            .bind(limit as i64)
            .fetch_all(pg)
            .await
            .unwrap_or_default()
        } else {
            sqlx::query(
                r#"SELECT DISTINCT ON (topic) id, region, topic, social_score, commerce_score,
                          opportunity_score, momentum_pct, categories, sources, snapshot_at
                   FROM trend_snapshots
                   WHERE region = $1
                     AND snapshot_at >= NOW() - INTERVAL '24 hours'
                   ORDER BY topic, snapshot_at DESC, social_score DESC
                   LIMIT $2"#,
            )
            .bind(region)
            .bind(limit as i64)
            .fetch_all(pg)
            .await
            .unwrap_or_default()
        };

        if rows_24h.is_empty() {
            return None;
        }

        return Some(
            rows_24h
                .into_iter()
                .filter_map(|r| snapshot_row_to_trend_item(&r, period))
                .collect(),
        );
    }

    Some(
        rows.into_iter()
            .filter_map(|r| snapshot_row_to_trend_item(&r, period))
            .collect(),
    )
}

fn snapshot_row_to_trend_item(r: &sqlx::postgres::PgRow, period: &str) -> Option<TrendItem> {
    use sqlx::Row;
    let id: i32 = r.try_get("id").ok()?;
    let region: String = r.try_get("region").ok()?;
    let topic: String = r.try_get("topic").ok()?;
    if topic.is_empty() {
        return None;
    }

    let social_score: f64 = r.try_get("social_score").unwrap_or(0.0);
    let commerce_score: f64 = r.try_get("commerce_score").unwrap_or(0.0);
    let opportunity_score: f64 = r.try_get("opportunity_score").unwrap_or(0.0);
    let momentum_pct: f64 = r.try_get("momentum_pct").unwrap_or(0.0);
    let categories: Vec<String> = r.try_get::<Vec<String>, _>("categories").unwrap_or_default();
    let sources: Vec<String> = r.try_get::<Vec<String>, _>("sources").unwrap_or_default();

    Some(TrendItem {
        id: format!("snap-{}", id),
        topic,
        social_score: social_score as f32,
        commerce_score: commerce_score as f32,
        opportunity_score: opportunity_score as f32,
        momentum_pct: momentum_pct as f32,
        categories,
        regions: vec![region],
        sources,
        period: period.to_string(),
        matching_products: vec![],
        recommended_action: None,
    })
}

// ─── Fallback trends Yukpo natives ────────────────────────────────────────────

/// Génère des tendances à partir des données internes Yukpo quand les sources
/// externes (APIs tierce, snapshots DB) sont indisponibles.
/// Utilise : produits populaires, catégories actives, signaux chatbot.
async fn generate_yukpo_native_trends(
    pg: &PgPool,
    region: &str,
    internal_signals: &[InternalSignal],
    _user_ctx: Option<&UserCommercialContext>,
) -> Vec<TrendItem> {
    use sqlx::Row;
    let mut trends: Vec<TrendItem> = Vec::new();

    // 1. Produits les plus commandés récemment → topics commerce
    let top_products = sqlx::query(
        r#"SELECT sp.titre AS topic,
                  COUNT(oi.id) AS order_count,
                  AVG(oi.price_at_purchase) AS avg_price,
                  s.category
           FROM order_items oi
           JOIN service_products sp ON sp.id = oi.product_id
           JOIN services s ON s.id = sp.service_id
           WHERE oi.created_at >= NOW() - INTERVAL '7 days'
             AND sp.titre IS NOT NULL
           GROUP BY sp.titre, s.category
           ORDER BY order_count DESC
           LIMIT 15"#,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    for (i, row) in top_products.iter().enumerate() {
        let topic: String = row.try_get("topic").unwrap_or_default();
        if topic.is_empty() {
            continue;
        }
        let order_count: i64 = row.try_get("order_count").unwrap_or(1);
        let category: String = row.try_get("category").unwrap_or_else(|_| "général".to_string());
        let social_score = (50.0 + (order_count as f32).log10() * 15.0).min(95.0);
        let momentum = 60.0 - (i as f32 * 3.0);

        trends.push(TrendItem {
            id: format!("yukpo-prod-{}-{}", region, i),
            topic,
            social_score,
            commerce_score: social_score * 1.2_f32.min(100.0),
            opportunity_score: 0.0,
            momentum_pct: momentum,
            categories: vec![category],
            regions: vec![region.to_string()],
            sources: vec!["Yukpo Commerce".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }

    // 2. Signaux chatbot les plus fréquents → topics demande
    for (i, signal) in internal_signals.iter().take(10).enumerate() {
        if signal.keyword.len() < 4 {
            continue;
        }
        let social_score = (40.0 + signal.score * 2.0).min(85.0);
        trends.push(TrendItem {
            id: format!("yukpo-chat-{}-{}", region, i),
            topic: signal.keyword.clone(),
            social_score,
            commerce_score: social_score,
            opportunity_score: 0.0,
            momentum_pct: 45.0 - (i as f32 * 2.0),
            categories: vec![signal.category.clone().unwrap_or_else(|| "demande".to_string())],
            regions: vec![region.to_string()],
            sources: vec!["Yukpo Chatbots".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }

    // 3. Services les plus actifs → topics secteur
    let top_services = sqlx::query(
        r#"SELECT s.titre_service AS topic,
                  s.category,
                  COUNT(DISTINCT o.id) AS order_count
           FROM services s
           LEFT JOIN orders o ON o.service_id = s.id
             AND o.created_at >= NOW() - INTERVAL '7 days'
           WHERE s.is_active = true
             AND s.titre_service IS NOT NULL
           GROUP BY s.titre_service, s.category
           ORDER BY order_count DESC, s.created_at DESC
           LIMIT 10"#,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    for (i, row) in top_services.iter().enumerate() {
        let topic: String = row.try_get("topic").unwrap_or_default();
        if topic.is_empty() {
            continue;
        }
        let category: String = row.try_get("category").unwrap_or_else(|_| "service".to_string());
        let order_count: i64 = row.try_get("order_count").unwrap_or(0);

        // Éviter les doublons avec les produits déjà ajoutés
        if trends.iter().any(|t| t.topic.to_lowercase() == topic.to_lowercase()) {
            continue;
        }

        let social_score = (35.0 + order_count as f32 * 3.0).min(80.0);
        trends.push(TrendItem {
            id: format!("yukpo-svc-{}-{}", region, i),
            topic,
            social_score,
            commerce_score: social_score,
            opportunity_score: 0.0,
            momentum_pct: 40.0 - (i as f32 * 2.5),
            categories: vec![category],
            regions: vec![region.to_string()],
            sources: vec!["Yukpo Services".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }

    // 4. Fallback absolu : topics africains hardcodés si tout le reste est vide
    //    Ces topics sont constamment pertinents sur les marchés d'Afrique de l'Ouest.
    if trends.is_empty() {
        let hardcoded = generate_african_market_trends(region);
        trends.extend(hardcoded);
    }

    log::info!(
        "[TrendAggregator] Trends Yukpo natives générées pour {} : {} items",
        region,
        trends.len()
    );

    trends
}

/// Génère des tendances de marché africain pertinentes et universelles.
/// Utilisé uniquement quand aucune autre source (API, DB) ne retourne de données.
fn generate_african_market_trends(region: &str) -> Vec<TrendItem> {
    // Topics universellement porteurs sur les marchés d'Afrique de l'Ouest
    // Structurés par catégorie avec scores réalistes
    let base_topics: &[(&str, &str, f32, f32)] = &[
        // (topic, catégorie, social_score, momentum_pct)
        ("Téléphones Android pas cher", "tech", 88.0, 72.0),
        ("Accessoires coiffure et beauté", "beauty", 85.0, 68.0),
        ("Vêtements et pagnes africains", "fashion", 83.0, 65.0),
        ("Poulet braisé et restauration rapide", "food", 82.0, 70.0),
        ("Transfert d'argent mobile", "finance", 80.0, 60.0),
        (
            "Construction et matériaux bâtiment",
            "construction",
            78.0,
            55.0,
        ),
        ("Produits cosmétiques naturels", "beauty", 77.0, 63.0),
        ("Livraison à domicile", "services", 76.0, 58.0),
        ("Formation et cours en ligne", "education", 74.0, 52.0),
        ("Pharmacie et médicaments", "health", 73.0, 48.0),
        (
            "Agriculture et produits vivriers",
            "agriculture",
            71.0,
            44.0,
        ),
        ("Électronique et électroménager", "tech", 70.0, 50.0),
    ];

    // Topics spécifiques selon la région
    let region_bonus: Vec<(&str, &str, f32, f32)> = match region {
        "CI" => vec![
            ("Attiéké et cuisine ivoirienne", "food", 90.0, 78.0),
            ("Wax et tissus Vlisco Abidjan", "fashion", 87.0, 74.0),
            ("Orange Money Côte d'Ivoire", "finance", 84.0, 66.0),
        ],
        "CM" => vec![
            ("Ndolé et cuisine camerounaise", "food", 90.0, 76.0),
            ("Mobile Money MTN Cameroun", "finance", 85.0, 65.0),
            ("Vêtements et bazin brodé Yaoundé", "fashion", 82.0, 62.0),
        ],
        "SN" => vec![
            ("Thiéboudiène et cuisine sénégalaise", "food", 91.0, 79.0),
            (
                "Boubous et tenues cérémonielles Dakar",
                "fashion",
                88.0,
                72.0,
            ),
            ("Wave et fintech sénégal", "finance", 86.0, 68.0),
        ],
        "NG" => vec![
            ("Jollof rice et cuisine nigériane", "food", 92.0, 80.0),
            ("Ankara fashion Lagos", "fashion", 89.0, 75.0),
            ("PalmPay et fintech Nigeria", "finance", 87.0, 70.0),
        ],
        _ => vec![
            ("Cuisine locale et plats traditionnels", "food", 88.0, 72.0),
            ("Mobile Money et paiements digitaux", "finance", 84.0, 65.0),
            ("Mode africaine et pagne wax", "fashion", 82.0, 62.0),
        ],
    };

    let mut result: Vec<TrendItem> = Vec::new();

    // Insérer les topics régionaux en premier (score plus élevé)
    for (i, (topic, category, social_score, momentum)) in region_bonus.iter().enumerate() {
        let opp_score = social_score * 0.85;
        result.push(TrendItem {
            id: format!("yukpo-african-reg-{}-{}", region, i),
            topic: topic.to_string(),
            social_score: *social_score,
            commerce_score: social_score * 0.9,
            opportunity_score: opp_score,
            momentum_pct: *momentum,
            categories: vec![category.to_string()],
            regions: vec![region.to_string()],
            sources: vec!["Yukpo Marché Africain".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }

    // Puis les topics universels
    for (i, (topic, category, social_score, momentum)) in base_topics.iter().enumerate() {
        let opp_score = social_score * 0.75;
        result.push(TrendItem {
            id: format!("yukpo-african-base-{}-{}", region, i),
            topic: topic.to_string(),
            social_score: *social_score,
            commerce_score: social_score * 0.85,
            opportunity_score: opp_score,
            momentum_pct: *momentum,
            categories: vec![category.to_string()],
            regions: vec![region.to_string()],
            sources: vec!["Yukpo Marché Africain".to_string()],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }

    result
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

/// Collecte et agrège les tendances pour une région donnée,
/// puis les score selon le profil commercial de l'utilisateur.
/// Stratégie : snapshots DB en priorité (fiables), APIs externes en fallback.
pub async fn get_trend_pulse(
    state: &Arc<AppState>,
    region: &str,
    period: &str,
    user_ctx: Option<&UserCommercialContext>,
) -> TrendPulseResult {
    // ─── Priorité 1 : snapshots DB (data fiable, générée par le worker horaire) ─
    let snapshot_trends = load_trends_from_snapshots(&state.pg, region, period, 50).await;

    let mut all_trends: Vec<TrendItem> = if let Some(mut snap) = snapshot_trends {
        log::info!(
            "[TrendAggregator] {} snapshots DB chargés pour région={}",
            snap.len(),
            region
        );
        // Enrichir avec signaux internes et scoring utilisateur
        let internal_signals = load_yukpo_internal_signals(&state.pg, region).await;
        if let Some(ctx) = user_ctx {
            for trend in &mut snap {
                score_trend_for_user(trend, ctx, &internal_signals);
            }
        }
        snap
    } else {
        // ─── Priorité 2 : APIs externes en temps réel (fallback si pas de snapshots) ─
        log::warn!(
            "[TrendAggregator] Pas de snapshots récents pour {}, fallback APIs externes",
            region
        );
        let client = Client::new();

        let youtube_key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
        let newsapi_key = std::env::var("NEWSAPI_KEY").unwrap_or_default();
        let twitter_bearer = std::env::var("TWITTER_BEARER_TOKEN").unwrap_or_default();
        let tiktok_token = std::env::var("TIKTOK_ACCESS_TOKEN").unwrap_or_default();
        let newsapi_country = region_to_newsapi_country(region);

        let serpapi_key = std::env::var("SERPAPI_KEY").unwrap_or_default();

        let (
            google_trends,
            youtube_trends,
            news_trends,
            twitter_trends,
            tiktok_trends,
            reddit_trends,
            facebook_trends,
            instagram_trends,
        ) = tokio::join!(
            fetch_google_trends(&client, region),
            fetch_youtube_trends(&client, region, &youtube_key),
            fetch_newsapi_trends(&client, &newsapi_country, &newsapi_key),
            fetch_twitter_trends(&client, region, &twitter_bearer),
            fetch_tiktok_trends(&client, region, &tiktok_token),
            fetch_reddit_trends(&client, region),
            fetch_facebook_trends_via_serpapi(&client, region, &serpapi_key),
            fetch_instagram_trends_via_serpapi(&client, region, &serpapi_key),
        );

        log::info!(
            "[TrendAggregator] APIs pour {} : Google={} YT={} News={} Twitter={} TikTok={} Reddit={} Facebook={} Instagram={}",
            region, google_trends.len(), youtube_trends.len(), news_trends.len(),
            twitter_trends.len(), tiktok_trends.len(), reddit_trends.len(),
            facebook_trends.len(), instagram_trends.len()
        );

        let internal_signals = load_yukpo_internal_signals(&state.pg, region).await;
        let historical_momentum = load_historical_momentum(&state.pg, region).await;

        let mut merged: Vec<TrendItem> = Vec::new();
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

        for mut trend in google_trends
            .into_iter()
            .chain(youtube_trends)
            .chain(news_trends)
            .chain(twitter_trends)
            .chain(tiktok_trends)
            .chain(reddit_trends)
            .chain(facebook_trends)
            .chain(instagram_trends)
        {
            let short_key = trend.topic.to_lowercase().chars().take(10).collect::<String>();
            if seen.insert(short_key) {
                if let Some(&hist) = historical_momentum.get(&trend.topic.to_lowercase()) {
                    trend.momentum_pct = (trend.momentum_pct + hist).min(100.0);
                }
                if let Some(ctx) = user_ctx {
                    score_trend_for_user(&mut trend, ctx, &internal_signals);
                }
                merged.push(trend);
            }
        }

        // ─── Priorité 3 : Trends natives Yukpo (fallback si APIs externes vides) ─
        if merged.is_empty() {
            log::warn!(
                "[TrendAggregator] APIs externes vides pour {}, fallback trends Yukpo natives",
                region
            );
            let native =
                generate_yukpo_native_trends(&state.pg, region, &internal_signals, user_ctx).await;
            for mut trend in native {
                if let Some(ctx) = user_ctx {
                    score_trend_for_user(&mut trend, ctx, &internal_signals);
                }
                merged.push(trend);
            }
        }

        merged
    };

    // Trier par social_score puis opportunity_score
    all_trends.sort_by(|a, b| {
        let score_a = if a.opportunity_score > 0.0 {
            a.opportunity_score
        } else {
            a.social_score
        };
        let score_b = if b.opportunity_score > 0.0 {
            b.opportunity_score
        } else {
            b.social_score
        };
        score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Trends personnalisées = celles avec produits matchants OU haute opportunité
    // Fallback : si pas assez de trends scorées, compléter avec les top trends globales
    let mut personalized_trends: Vec<TrendItem> = all_trends
        .iter()
        .filter(|t| !t.matching_products.is_empty() || t.opportunity_score >= 40.0)
        .take(10)
        .cloned()
        .collect();
    if personalized_trends.len() < 5 {
        // Compléter avec les meilleures tendances globales (par social_score)
        let already_ids: std::collections::HashSet<&str> =
            personalized_trends.iter().map(|t| t.id.as_str()).collect();
        let extra: Vec<TrendItem> = all_trends
            .iter()
            .filter(|t| !already_ids.contains(t.id.as_str()))
            .take(10 - personalized_trends.len())
            .cloned()
            .collect();
        personalized_trends.extend(extra);
    }

    let internal_signals_for_sectors = load_yukpo_internal_signals(&state.pg, region).await;
    let top_personalities = extract_personalities(&all_trends);
    let top_sectors = build_sector_trends(&internal_signals_for_sectors, region);

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

// ─── Facebook & Instagram Trending via SerpAPI ───────────────────────────────

/// Récupère les tendances Facebook pour une région via SerpAPI.
/// SerpAPI interroge Facebook via proxies résidentiels → pas de blocage.
async fn fetch_facebook_trends_via_serpapi(
    client: &Client,
    region: &str,
    serpapi_key: &str,
) -> Vec<TrendItem> {
    if serpapi_key.is_empty() {
        return vec![];
    }
    let country = match region {
        "CM" => "cm",
        "SN" => "sn",
        "CI" => "ci",
        "NG" => "ng",
        _ => "cm",
    };
    // SerpAPI Google Trends avec filtre Facebook comme source de contenu
    let url = format!(
        "https://serpapi.com/search.json?engine=google_trends&q=facebook+trending+{}&geo={}&data_type=TIMESERIES&api_key={}",
        country, region, serpapi_key
    );
    match client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.text().await {
                parse_serpapi_social_trends(&body, region, "Facebook")
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

/// Récupère les tendances Instagram via SerpAPI (hashtags populaires).
async fn fetch_instagram_trends_via_serpapi(
    client: &Client,
    region: &str,
    serpapi_key: &str,
) -> Vec<TrendItem> {
    if serpapi_key.is_empty() {
        return vec![];
    }
    let country = match region {
        "CM" => "cm",
        "SN" => "sn",
        "CI" => "ci",
        "NG" => "ng",
        _ => "cm",
    };
    // Instagram trending hashtags via SerpAPI
    let url = format!(
        "https://serpapi.com/search.json?engine=google_trends&q=instagram+trending+{}&geo={}&data_type=TIMESERIES&api_key={}",
        country, region, serpapi_key
    );
    match client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.text().await {
                parse_serpapi_social_trends(&body, region, "Instagram")
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

/// Parse la réponse SerpAPI pour extraire des topics sociaux (Facebook/Instagram)
fn parse_serpapi_social_trends(json_body: &str, region: &str, source: &str) -> Vec<TrendItem> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(json_body) else {
        return vec![];
    };

    // SerpAPI TIMESERIES retourne interest_over_time avec des topics
    let queries = v
        .get("related_queries")
        .and_then(|q| q.get("rising"))
        .and_then(|r| r.as_array())
        .or_else(|| v.get("related_queries").and_then(|q| q.get("top")).and_then(|r| r.as_array()));

    let Some(items) = queries else {
        return vec![];
    };

    items
        .iter()
        .take(10)
        .enumerate()
        .filter_map(|(i, item)| {
            let topic = item.get("query")?.as_str()?.to_string();
            if topic.is_empty() {
                return None;
            }
            let value: f32 = item
                .get("value")
                .and_then(|v| v.as_str())
                .and_then(|s| s.replace("Breakout", "150").parse::<f32>().ok())
                .unwrap_or(50.0);
            let social_score = (value / 2.0).min(100.0).max(10.0);
            Some(TrendItem {
                id: format!("{}-{}-{}", source.to_lowercase(), region, i),
                topic,
                social_score,
                commerce_score: 0.0,
                opportunity_score: 0.0,
                momentum_pct: (70.0 - i as f32 * 5.0).max(10.0),
                categories: vec![],
                regions: vec![region.to_string()],
                sources: vec![source.to_string()],
                period: "24h".to_string(),
                matching_products: vec![],
                recommended_action: None,
            })
        })
        .collect()
}

// ─── TikTok Trending ─────────────────────────────────────────────────────────

/// Récupère les hashtags et sons trending TikTok via TikTok Research API.
/// Nécessite TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET (accès Research API).
/// Fallback gracieux vers scraping public si pas de credentials.
async fn fetch_tiktok_trends(client: &Client, region: &str, access_token: &str) -> Vec<TrendItem> {
    if access_token.is_empty() {
        // Fallback : trending hashtags publics via endpoint non-authentifié
        return fetch_tiktok_public_trending(client, region).await;
    }

    // TikTok Research API v2 — hashtags trending
    let url = "https://open.tiktokapis.com/v2/research/hashtag/query/";
    let country = tiktok_region_to_country(region);

    let body = serde_json::json!({
        "filters": {
            "region_codes": [country],
            "create_date": chrono::Utc::now().format("%Y%m%d").to_string(),
        },
        "fields": "hashtag_name,video_count,view_count,region_codes",
        "max_count": 20,
        "search_id": ""
    });

    match client
        .post(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(8))
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                parse_tiktok_response(&data, region)
            } else {
                vec![]
            }
        }
        Ok(resp) if resp.status().as_u16() == 429 => {
            log::warn!("[TrendAggregator] TikTok rate limit pour {}", region);
            vec![]
        }
        _ => fetch_tiktok_public_trending(client, region).await,
    }
}

/// Fallback TikTok : scrape la page des hashtags tendances publics
async fn fetch_tiktok_public_trending(client: &Client, region: &str) -> Vec<TrendItem> {
    let country = tiktok_region_to_country(region);
    // Endpoint TikTok Creative Center (public) — hashtags populaires
    let url = format!(
        "https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page_size=20&country_code={}",
        country
    );

    match client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; YukpoBot/1.0)")
        .timeout(std::time::Duration::from_secs(6))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                parse_tiktok_creative_center(&data, region)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_tiktok_response(data: &serde_json::Value, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    let items = match data["data"]["hashtags"].as_array().or_else(|| data["data"].as_array()) {
        Some(v) => v,
        None => return trends,
    };

    for (i, item) in items.iter().take(20).enumerate() {
        let name = item["hashtag_name"]
            .as_str()
            .or_else(|| item["name"].as_str())
            .unwrap_or("")
            .trim_start_matches('#')
            .to_string();
        if name.is_empty() {
            continue;
        }

        let view_count: f32 = item["view_count"].as_i64().unwrap_or(0) as f32;
        let video_count: f32 = item["video_count"].as_i64().unwrap_or(0) as f32;

        // Score combiné vues + vidéos
        let social_score = ((view_count / 5_000_000.0 * 60.0) + (video_count / 50_000.0 * 40.0))
            .min(100.0)
            .max(5.0);
        let momentum = 85.0 - (i as f32 * 3.5);

        trends.push(TrendItem {
            id: format!("tiktok-{}-{}", region, i),
            topic: name,
            social_score,
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: momentum,
            categories: vec!["video".to_string()],
            regions: vec![region.to_string()],
            sources: vec!["TikTok".to_string()],
            period: "7d".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

fn parse_tiktok_creative_center(data: &serde_json::Value, region: &str) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    let items = match data["data"]["list"].as_array() {
        Some(v) => v,
        None => return trends,
    };
    for (i, item) in items.iter().take(20).enumerate() {
        let name = item["hashtag_name"].as_str().unwrap_or("").trim_start_matches('#').to_string();
        if name.is_empty() {
            continue;
        }
        let publish_cnt: f32 = item["publish_cnt"].as_i64().unwrap_or(0) as f32;
        let social_score = (publish_cnt / 10_000.0 * 100.0).min(100.0).max(5.0);
        trends.push(TrendItem {
            id: format!("tiktok-cc-{}-{}", region, i),
            topic: name,
            social_score,
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: 80.0 - (i as f32 * 3.0),
            categories: vec!["video".to_string()],
            regions: vec![region.to_string()],
            sources: vec!["TikTok".to_string()],
            period: "7d".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

fn tiktok_region_to_country(region: &str) -> &'static str {
    match region {
        "CM" => "CM",
        "SN" => "SN",
        "CI" => "CI",
        "NG" => "NG",
        "GH" => "GH",
        "KE" => "KE",
        "TZ" => "TZ",
        "ET" => "ET",
        "MA" => "MA",
        "TN" => "TN",
        "EG" => "EG",
        "ZA" => "ZA",
        "CD" => "CD",
        "AO" => "AO",
        "MG" => "MG",
        "MZ" => "MZ",
        _ => "NG", // Nigeria = plus grand marché TikTok Afrique
    }
}

// ─── Reddit Trends ───────────────────────────────────────────────────────────

/// Récupère les posts trending Reddit dans les sous-reddits africains.
/// Utilise l'API publique Reddit (pas d'auth nécessaire pour le read-only).
async fn fetch_reddit_trends(client: &Client, region: &str) -> Vec<TrendItem> {
    // Sous-reddits africains par région
    let subreddits = reddit_subreddits_for_region(region);
    let mut all_trends = Vec::new();

    for subreddit in subreddits.iter().take(3) {
        let url = format!(
            "https://www.reddit.com/r/{}/hot.json?limit=25&t=day",
            subreddit
        );

        match client
            .get(&url)
            .header("User-Agent", "YukpoTrendBot/1.0 (+https://yukpomnang.com)")
            .timeout(std::time::Duration::from_secs(6))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(data) = resp.json::<serde_json::Value>().await {
                    let mut trends = parse_reddit_response(&data, region, subreddit);
                    all_trends.append(&mut trends);
                }
            }
            Ok(resp) if resp.status().as_u16() == 429 => {
                log::debug!("[TrendAggregator] Reddit rate limit pour r/{}", subreddit);
                break;
            }
            _ => {}
        }

        // Pause courte entre requêtes Reddit (respecter rate limit)
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    // Dédupliquer et prendre les 15 meilleurs
    all_trends.sort_by(|a, b| b.social_score.partial_cmp(&a.social_score).unwrap());
    all_trends.into_iter().take(15).collect()
}

fn parse_reddit_response(
    data: &serde_json::Value,
    region: &str,
    subreddit: &str,
) -> Vec<TrendItem> {
    let mut trends = Vec::new();
    let children = match data["data"]["children"].as_array() {
        Some(v) => v,
        None => return trends,
    };

    for (i, child) in children.iter().take(10).enumerate() {
        let post = &child["data"];
        let title = post["title"].as_str().unwrap_or("").to_string();
        if title.len() < 5 {
            continue;
        }

        let score: f32 = post["score"].as_i64().unwrap_or(0) as f32;
        let upvote_ratio: f32 = post["upvote_ratio"].as_f64().unwrap_or(0.5) as f32;
        let num_comments: f32 = post["num_comments"].as_i64().unwrap_or(0) as f32;

        // Score combiné : votes + engagement commentaires
        let social_score =
            ((score / 5000.0 * 50.0) + (num_comments / 200.0 * 30.0) + (upvote_ratio * 20.0))
                .min(100.0)
                .max(3.0);

        // Extraire les mots-clés principaux du titre (3 premiers mots >3 chars)
        let keywords: Vec<String> = title
            .split_whitespace()
            .filter(|w| w.len() > 3 && !w.starts_with(|c: char| c.is_ascii_punctuation()))
            .take(4)
            .map(|w| w.to_lowercase())
            .collect();
        let topic = keywords.join(" ");
        if topic.is_empty() {
            continue;
        }

        trends.push(TrendItem {
            id: format!("reddit-{}-{}-{}", subreddit, region, i),
            topic,
            social_score,
            commerce_score: 0.0,
            opportunity_score: 0.0,
            momentum_pct: upvote_ratio * 80.0,
            categories: vec![subreddit_to_category(subreddit).to_string()],
            regions: vec![region.to_string()],
            sources: vec![format!("Reddit r/{}", subreddit)],
            period: "24h".to_string(),
            matching_products: vec![],
            recommended_action: None,
        });
    }
    trends
}

fn reddit_subreddits_for_region(region: &str) -> Vec<&'static str> {
    match region {
        "NG" => vec!["Nigeria", "naija", "lagos", "afrobeats", "nigerianfood"],
        "GH" => vec!["ghana", "accra", "GhanaianFashion"],
        "KE" => vec!["Kenya", "nairobi", "kenyanfood"],
        "ZA" => vec!["southafrica", "joburg", "capetown"],
        "MA" | "TN" | "DZ" | "EG" => vec!["Morocco", "Tunisia", "algeria", "egypt"],
        "ET" => vec!["Ethiopia", "addisababa"],
        // Afrique francophone : fallback vers sub-reddits généraux + diaspora
        _ => vec!["francophonie", "africa", "afrique", "ecommerce"],
    }
}

fn subreddit_to_category(subreddit: &str) -> &'static str {
    match subreddit {
        s if s.contains("food") || s.contains("cuisine") => "alimentation",
        s if s.contains("fashion") || s.contains("mode") => "mode",
        s if s.contains("tech") || s.contains("digital") => "technologie",
        s if s.contains("music") || s.contains("afrobeat") => "musique",
        s if s.contains("sport") || s.contains("foot") => "sport",
        _ => "général",
    }
}

// ─── Expansion géographique 20 pays africains ────────────────────────────────

/// Retourne le code pays NewsAPI pour une région africaine.
/// Couvre maintenant 20 marchés clés.
/// Retourne le code NewsAPI country pour une région ISO 3166-1 alpha-2.
/// NewsAPI accepte directement les codes ISO en minuscules — universel.
pub fn region_to_newsapi_country(region: &str) -> String {
    region.to_lowercase()
}

/// Retourne le code Google Trends geo pour une région ISO 3166-1 alpha-2.
/// Google Trends accepte directement les codes ISO en majuscules — universel.
pub fn region_to_google_geo(region: &str) -> String {
    region.to_uppercase()
}

/// Retourne le WOEID Twitter pour une région.
/// Couvre l'Afrique, l'Europe, les Amériques, l'Asie, le Moyen-Orient.
pub fn region_to_twitter_woeid(region: &str) -> &'static str {
    match region {
        // ── Afrique ──────────────────────────────────────────────────────────
        "CM" => "2233",
        "SN" => "2245021",
        "CI" => "2247252",
        "NG" => "2347592",
        "GH" => "2300660",
        "KE" => "2306716",
        "TZ" => "2347005",
        "MA" => "2542353",
        "TN" => "2469060",
        "EG" => "2294718",
        "ZA" => "2294900",
        "ET" => "2287960",
        "DZ" => "2365303",
        "AO" => "2239901",
        "MG" => "2348636",
        "RW" => "2344553",
        // ── Europe ───────────────────────────────────────────────────────────
        "FR" => "23424819",
        "DE" => "23424829",
        "GB" => "23424975",
        "ES" => "23424950",
        "IT" => "23424853",
        "PT" => "23424925",
        "NL" => "23424909",
        "BE" => "23424757",
        "CH" => "23424957",
        "SE" => "23424954",
        "NO" => "23424910",
        "DK" => "23424796",
        "PL" => "23424923",
        "RU" => "23424936",
        "TR" => "23424969",
        "UA" => "23424973",
        "GR" => "23424833",
        "RO" => "23424933",
        "AT" => "23424750",
        "CZ" => "23424815",
        // ── Amériques ────────────────────────────────────────────────────────
        "US" => "23424977",
        "CA" => "23424775",
        "MX" => "23424900",
        "BR" => "23424768",
        "AR" => "23424747",
        "CO" => "23424787",
        "CL" => "23424782",
        "PE" => "23424919",
        "VE" => "23424982",
        "EC" => "23424801",
        "BO" => "23424762",
        "UY" => "23424979",
        // ── Asie-Pacifique ───────────────────────────────────────────────────
        "JP" => "23424856",
        "IN" => "23424848",
        "CN" => "23424781",
        "KR" => "23424868",
        "AU" => "23424748",
        "ID" => "23424846",
        "TH" => "23424960",
        "VN" => "23424984",
        "PH" => "23424922",
        "MY" => "23424901",
        "SG" => "23424948",
        "PK" => "23424916",
        "BD" => "23424755",
        "NZ" => "23424916",
        "TW" => "23424971",
        "HK" => "23424843",
        // ── Moyen-Orient ─────────────────────────────────────────────────────
        "SA" => "23424938",
        "AE" => "23424738",
        "QA" => "23424930",
        "KW" => "23424870",
        "IL" => "23424852",
        "IQ" => "23424855",
        "IR" => "23424851",
        "JO" => "23424860",
        _ => "1", // Worldwide (fallback global)
    }
}

/// Liste de toutes les régions supportées : Afrique + monde entier.
/// Yukpo est une plateforme à vocation internationale.
pub fn supported_regions() -> Vec<(&'static str, &'static str)> {
    vec![
        // ── Afrique ──────────────────────────────────────────────────────────
        ("CM", "Cameroun"),
        ("SN", "Sénégal"),
        ("CI", "Côte d'Ivoire"),
        ("NG", "Nigeria"),
        ("GH", "Ghana"),
        ("KE", "Kenya"),
        ("TZ", "Tanzanie"),
        ("ET", "Éthiopie"),
        ("MA", "Maroc"),
        ("TN", "Tunisie"),
        ("DZ", "Algérie"),
        ("EG", "Égypte"),
        ("ZA", "Afrique du Sud"),
        ("AO", "Angola"),
        ("MG", "Madagascar"),
        ("MZ", "Mozambique"),
        ("CD", "RD Congo"),
        ("RW", "Rwanda"),
        ("BJ", "Bénin"),
        ("TG", "Togo"),
        // ── Europe ───────────────────────────────────────────────────────────
        ("FR", "France"),
        ("DE", "Allemagne"),
        ("GB", "Royaume-Uni"),
        ("ES", "Espagne"),
        ("IT", "Italie"),
        ("PT", "Portugal"),
        ("NL", "Pays-Bas"),
        ("BE", "Belgique"),
        ("CH", "Suisse"),
        ("SE", "Suède"),
        ("PL", "Pologne"),
        ("RU", "Russie"),
        ("TR", "Turquie"),
        ("UA", "Ukraine"),
        ("AT", "Autriche"),
        // ── Amériques ────────────────────────────────────────────────────────
        ("US", "États-Unis"),
        ("CA", "Canada"),
        ("MX", "Mexique"),
        ("BR", "Brésil"),
        ("AR", "Argentine"),
        ("CO", "Colombie"),
        ("CL", "Chili"),
        ("PE", "Pérou"),
        ("VE", "Venezuela"),
        ("EC", "Équateur"),
        // ── Asie-Pacifique ───────────────────────────────────────────────────
        ("JP", "Japon"),
        ("IN", "Inde"),
        ("CN", "Chine"),
        ("KR", "Corée du Sud"),
        ("AU", "Australie"),
        ("ID", "Indonésie"),
        ("TH", "Thaïlande"),
        ("VN", "Vietnam"),
        ("PH", "Philippines"),
        ("MY", "Malaisie"),
        ("SG", "Singapour"),
        ("PK", "Pakistan"),
        ("BD", "Bangladesh"),
        ("TW", "Taïwan"),
        ("HK", "Hong Kong"),
        // ── Moyen-Orient ─────────────────────────────────────────────────────
        ("SA", "Arabie Saoudite"),
        ("AE", "Émirats Arabes Unis"),
        ("QA", "Qatar"),
        ("KW", "Koweït"),
        ("IL", "Israël"),
        ("JO", "Jordanie"),
    ]
}

/// Alias rétrocompatible — préférer supported_regions() pour couverture globale.
#[inline]
pub fn supported_african_regions() -> Vec<(&'static str, &'static str)> {
    supported_regions()
}

// ─── Forecasting tendances (Prophet-like linéaire) ───────────────────────────

/// Prédit le score d'une tendance sur les 7 prochains jours
/// en utilisant une régression linéaire pondérée sur les snapshots historiques.
/// Stocke le résultat dans trend_forecasts.
pub async fn compute_trend_forecast(
    pg: &sqlx::PgPool,
    region: &str,
    topic: &str,
) -> Option<TrendForecast> {
    use sqlx::Row;

    // Récupérer les 30 derniers snapshots pour ce topic/région
    let rows = sqlx::query(
        r#"SELECT
               EXTRACT(EPOCH FROM snapshot_at)::float8 as ts,
               combined_score::float8 as score,
               score_delta::float8 as delta
           FROM trend_snapshots
           WHERE region = $1
             AND LOWER(topic) = LOWER($2)
             AND snapshot_at >= NOW() - INTERVAL '30 days'
           ORDER BY snapshot_at ASC"#,
    )
    .bind(region)
    .bind(topic)
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    if rows.len() < 3 {
        return None; // Pas assez de données
    }

    let scores: Vec<f64> = rows.iter().filter_map(|r| r.try_get::<f64, _>("score").ok()).collect();
    let timestamps: Vec<f64> = rows.iter().filter_map(|r| r.try_get::<f64, _>("ts").ok()).collect();

    if scores.is_empty() || timestamps.is_empty() {
        return None;
    }

    // Régression linéaire pondérée (poids plus élevés pour les points récents)
    let n = scores.len() as f64;
    let weights: Vec<f64> = (0..scores.len())
        .map(|i| 1.0 + (i as f64 / scores.len() as f64) * 2.0) // poids 1x→3x
        .collect();

    let sum_w: f64 = weights.iter().sum();
    let mean_x = timestamps.iter().zip(&weights).map(|(x, w)| x * w).sum::<f64>() / sum_w;
    let mean_y = scores.iter().zip(&weights).map(|(y, w)| y * w).sum::<f64>() / sum_w;

    let numerator: f64 = timestamps
        .iter()
        .zip(scores.iter())
        .zip(weights.iter())
        .map(|((x, y), w)| w * (x - mean_x) * (y - mean_y))
        .sum();
    let denominator: f64 = timestamps
        .iter()
        .zip(weights.iter())
        .map(|(x, w)| w * (x - mean_x).powi(2))
        .sum();

    if denominator.abs() < 1e-10 {
        return None;
    }

    let slope = numerator / denominator;
    let intercept = mean_y - slope * mean_x;

    // Prédire les scores futurs
    let now_ts = chrono::Utc::now().timestamp() as f64;
    let day_secs = 86400.0_f64;

    let predict = |days: f64| -> f64 {
        let predicted = intercept + slope * (now_ts + days * day_secs);
        predicted.max(0.0).min(100.0)
    };

    let last_score = *scores.last().unwrap_or(&0.0);
    let avg_7d = if scores.len() >= 7 {
        scores[scores.len() - 7..].iter().sum::<f64>() / 7.0
    } else {
        scores.iter().sum::<f64>() / n
    };
    let avg_30d = scores.iter().sum::<f64>() / n;

    let forecast_d1 = predict(1.0);
    let forecast_d3 = predict(3.0);
    let forecast_d7 = predict(7.0);
    let forecast_d14 = predict(14.0);

    // Variance → confiance (moins de variance = plus de confiance)
    let variance = scores.iter().map(|s| (s - avg_30d).powi(2)).sum::<f64>() / n;
    let confidence = (1.0 - (variance.sqrt() / 50.0).min(1.0)).max(0.0);

    let trend_direction = if slope > 0.5 {
        "rising"
    } else if slope < -0.5 {
        "declining"
    } else if forecast_d3 >= last_score * 0.95 {
        "peak"
    } else {
        "stable"
    };

    // Persister en base
    let _ = sqlx::query(
        r#"INSERT INTO trend_forecasts
           (region, topic, forecast_day1, forecast_day3, forecast_day7, forecast_day14,
            confidence, trend_direction, data_points, last_score, avg_score_7d, avg_score_30d)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (region, topic, computed_at::date)
           DO UPDATE SET
             forecast_day1 = EXCLUDED.forecast_day1,
             forecast_day3 = EXCLUDED.forecast_day3,
             forecast_day7 = EXCLUDED.forecast_day7,
             forecast_day14 = EXCLUDED.forecast_day14,
             confidence = EXCLUDED.confidence,
             trend_direction = EXCLUDED.trend_direction,
             data_points = EXCLUDED.data_points,
             last_score = EXCLUDED.last_score,
             avg_score_7d = EXCLUDED.avg_score_7d,
             avg_score_30d = EXCLUDED.avg_score_30d,
             computed_at = NOW()"#,
    )
    .bind(region)
    .bind(topic)
    .bind(forecast_d1)
    .bind(forecast_d3)
    .bind(forecast_d7)
    .bind(forecast_d14)
    .bind(confidence)
    .bind(trend_direction)
    .bind(rows.len() as i32)
    .bind(last_score)
    .bind(avg_7d)
    .bind(avg_30d)
    .execute(pg)
    .await;

    Some(TrendForecast {
        topic: topic.to_string(),
        region: region.to_string(),
        forecast_day1: forecast_d1,
        forecast_day3: forecast_d3,
        forecast_day7: forecast_d7,
        forecast_day14: forecast_d14,
        confidence,
        trend_direction: trend_direction.to_string(),
        data_points: rows.len(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendForecast {
    pub topic: String,
    pub region: String,
    pub forecast_day1: f64,
    pub forecast_day3: f64,
    pub forecast_day7: f64,
    pub forecast_day14: f64,
    pub confidence: f64,
    pub trend_direction: String, // rising | peak | declining | stable
    pub data_points: usize,
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
