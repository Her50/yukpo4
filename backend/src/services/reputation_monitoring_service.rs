// Reputation Monitoring Service — Yukpo
// Surveille les mentions d'un partenaire ou personnalité publique
// sur Twitter/X, Facebook, Instagram, TikTok, News, Reddit.
// Détecte le sentiment et alerte en cas de crise.

use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::yukpo_openai_outbound::resolve_openai_api_key;
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MentionResult {
    pub platform: String,
    pub mention_id: String,
    pub author_name: String,
    pub author_handle: String,
    pub content: String,
    pub url: Option<String>,
    pub likes: i32,
    pub shares: i32,
    pub replies: i32,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentResult {
    pub sentiment: String, // positive | neutral | negative | crisis
    pub score: f64,        // -1.0 à +1.0
    pub is_crisis: bool,
    pub crisis_level: i32, // 0-3
    pub key_phrases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub user_id: i32,
    pub service_id: i32,
    pub keywords: Vec<String>,
    pub monitor_platforms: Vec<String>,
    pub crisis_sentiment_threshold: f64,
    pub crisis_reach_threshold: i32,
    pub notify_whatsapp: Option<String>,
    pub notify_email: Option<String>,
}

// ─── Collecte des mentions ────────────────────────────────────────────────────

/// Point d'entrée principal : collecte les nouvelles mentions pour un partenaire
/// et les analyse. Persiste en DB et alerte si crise détectée.
pub async fn run_monitoring_cycle(
    state: &Arc<AppState>,
    config: &MonitorConfig,
) -> Result<Vec<i64>, String> {
    let client = Client::new();
    let mut saved_ids = Vec::new();

    for platform in &config.monitor_platforms {
        let mentions = match platform.as_str() {
            "twitter" | "x" => fetch_twitter_mentions(&client, &config.keywords).await,
            "news" => fetch_news_mentions(&client, &config.keywords).await,
            "reddit" => fetch_reddit_mentions(&client, &config.keywords).await,
            "instagram" => {
                // Instagram Graph API — mentions et tags sur les posts publics
                let ig_token = std::env::var("INSTAGRAM_MONITOR_TOKEN").unwrap_or_default();
                let ig_account = std::env::var("INSTAGRAM_BUSINESS_ACCOUNT_ID").unwrap_or_default();
                if !ig_token.is_empty() && !ig_account.is_empty() {
                    fetch_instagram_mentions(&client, &ig_account, &ig_token, &config.keywords)
                        .await
                } else {
                    vec![]
                }
            }
            "tiktok" => {
                // TikTok Research API — vidéos publiques mentionnant les mots-clés
                let tt_token = std::env::var("TIKTOK_CLIENT_KEY").unwrap_or_default();
                let tt_secret = std::env::var("TIKTOK_CLIENT_SECRET").unwrap_or_default();
                if !tt_token.is_empty() {
                    fetch_tiktok_mentions(&client, &tt_token, &tt_secret, &config.keywords).await
                } else {
                    vec![]
                }
            }
            _ => vec![], // autres plateformes via webhooks
        };

        for mention in mentions {
            // Analyser le sentiment
            let sentiment = analyze_sentiment(&mention.content).await;

            // Vérifier si déjà enregistrée
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM reputation_mentions WHERE mention_id = $1 AND platform = $2)",
            )
            .bind(&mention.mention_id)
            .bind(&mention.platform)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(false);

            if exists {
                continue;
            }

            // Persister la mention
            let reach = mention.likes + mention.shares * 3 + mention.replies * 2;
            let id: i64 = sqlx::query_scalar(
                r#"INSERT INTO reputation_mentions
                   (user_id, service_id, platform, mention_id, author_name, author_handle,
                    content, url, sentiment, sentiment_score, is_crisis, crisis_level,
                    likes, shares, replies, reach_estimate, keywords_matched, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                   RETURNING id"#,
            )
            .bind(config.user_id)
            .bind(config.service_id)
            .bind(&mention.platform)
            .bind(&mention.mention_id)
            .bind(&mention.author_name)
            .bind(&mention.author_handle)
            .bind(&mention.content)
            .bind(&mention.url)
            .bind(&sentiment.sentiment)
            .bind(sentiment.score)
            .bind(sentiment.is_crisis)
            .bind(sentiment.crisis_level)
            .bind(mention.likes)
            .bind(mention.shares)
            .bind(mention.replies)
            .bind(reach)
            .bind(&config.keywords[..])
            .bind(&mention.published_at)
            .fetch_one(&state.pg)
            .await
            .unwrap_or(0);

            saved_ids.push(id);

            // Déclencher une alerte si crise ou sentiment très négatif
            let is_crisis_threshold = sentiment.score < config.crisis_sentiment_threshold
                || reach >= config.crisis_reach_threshold;

            if sentiment.is_crisis || is_crisis_threshold {
                let _ = trigger_crisis_alert(state, config, id, &mention, &sentiment).await;
            }

            // Notification en app pour mentions négatives
            if sentiment.sentiment == "negative" || sentiment.is_crisis {
                log::warn!(
                    "[Reputation] ⚠️ Mention négative user={} sur {} : score={:.2} reach={}",
                    config.user_id,
                    platform,
                    sentiment.score,
                    reach
                );
            }
        }
    }

    Ok(saved_ids)
}

// ─── Sources de mentions ──────────────────────────────────────────────────────

/// Cherche les mentions sur Twitter/X via API v2 (Search Recent)
async fn fetch_twitter_mentions(client: &Client, keywords: &[String]) -> Vec<MentionResult> {
    let bearer = std::env::var("TWITTER_BEARER_TOKEN").unwrap_or_default();
    if bearer.is_empty() || keywords.is_empty() {
        return vec![];
    }

    // Construire la query Twitter : "keyword1 OR keyword2 -is:retweet lang:fr"
    let query = keywords.iter().map(|k| format!("\"{}\"", k)).collect::<Vec<_>>().join(" OR ");
    let full_query = format!("({}) -is:retweet", query);

    let url = format!(
        "https://api.twitter.com/2/tweets/search/recent\
         ?query={}&max_results=25\
         &tweet.fields=author_id,created_at,public_metrics,entities\
         &expansions=author_id\
         &user.fields=name,username",
        urlencoding::encode(&full_query)
    );

    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", bearer))
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                parse_twitter_mentions(&data)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_twitter_mentions(data: &serde_json::Value) -> Vec<MentionResult> {
    let mut results = Vec::new();
    let tweets = match data["data"].as_array() {
        Some(v) => v,
        None => return results,
    };

    // Map user_id → user info
    let empty = serde_json::json!([]);
    let users: std::collections::HashMap<String, &serde_json::Value> = data["includes"]["users"]
        .as_array()
        .unwrap_or(empty.as_array().unwrap())
        .iter()
        .filter_map(|u| u["id"].as_str().map(|id| (id.to_string(), u)))
        .collect();

    for tweet in tweets {
        let tweet_id = tweet["id"].as_str().unwrap_or("").to_string();
        let text = tweet["text"].as_str().unwrap_or("").to_string();
        let author_id = tweet["author_id"].as_str().unwrap_or("").to_string();
        let metrics = &tweet["public_metrics"];

        let (author_name, author_handle) = if let Some(user) = users.get(&author_id) {
            (
                user["name"].as_str().unwrap_or("").to_string(),
                user["username"].as_str().unwrap_or("").to_string(),
            )
        } else {
            (String::new(), String::new())
        };

        results.push(MentionResult {
            platform: "twitter".to_string(),
            mention_id: tweet_id.clone(),
            author_name,
            author_handle,
            content: text,
            url: Some(format!("https://twitter.com/i/web/status/{}", tweet_id)),
            likes: metrics["like_count"].as_i64().unwrap_or(0) as i32,
            shares: metrics["retweet_count"].as_i64().unwrap_or(0) as i32,
            replies: metrics["reply_count"].as_i64().unwrap_or(0) as i32,
            published_at: tweet["created_at"].as_str().map(|s| s.to_string()),
        });
    }
    results
}

/// Cherche les mentions dans les actualités via NewsAPI
async fn fetch_news_mentions(client: &Client, keywords: &[String]) -> Vec<MentionResult> {
    let api_key = std::env::var("NEWSAPI_KEY").unwrap_or_default();
    if api_key.is_empty() || keywords.is_empty() {
        return vec![];
    }

    let query = keywords.join(" OR ");
    let url = format!(
        "https://newsapi.org/v2/everything?q={}&sortBy=publishedAt&pageSize=20&apiKey={}",
        urlencoding::encode(&query),
        api_key
    );

    match client.get(&url).timeout(std::time::Duration::from_secs(8)).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                parse_news_mentions(&data)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_news_mentions(data: &serde_json::Value) -> Vec<MentionResult> {
    let mut results = Vec::new();
    let articles = match data["articles"].as_array() {
        Some(v) => v,
        None => return results,
    };

    for article in articles.iter().take(15) {
        let title = article["title"].as_str().unwrap_or("").to_string();
        let description = article["description"].as_str().unwrap_or("").to_string();
        let content = format!("{} {}", title, description);
        let url = article["url"].as_str().map(|s| s.to_string());
        let source = article["source"]["name"].as_str().unwrap_or("News").to_string();
        let published = article["publishedAt"].as_str().map(|s| s.to_string());

        results.push(MentionResult {
            platform: "news".to_string(),
            mention_id: url.clone().unwrap_or_else(|| format!("news_{}", results.len())),
            author_name: source.clone(),
            author_handle: source,
            content,
            url,
            likes: 0,
            shares: 0,
            replies: 0,
            published_at: published,
        });
    }
    results
}

/// Cherche les mentions sur Reddit
async fn fetch_reddit_mentions(client: &Client, keywords: &[String]) -> Vec<MentionResult> {
    if keywords.is_empty() {
        return vec![];
    }

    let query = keywords.join("+");
    let url = format!(
        "https://www.reddit.com/search.json?q={}&sort=new&limit=25&t=day",
        urlencoding::encode(&query)
    );

    match client
        .get(&url)
        .header("User-Agent", "YukpoReputationBot/1.0")
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                parse_reddit_mentions(&data)
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_reddit_mentions(data: &serde_json::Value) -> Vec<MentionResult> {
    let mut results = Vec::new();
    let children = match data["data"]["children"].as_array() {
        Some(v) => v,
        None => return results,
    };

    for child in children.iter().take(15) {
        let post = &child["data"];
        let title = post["title"].as_str().unwrap_or("").to_string();
        let selftext = post["selftext"].as_str().unwrap_or("").to_string();
        let content = format!("{} {}", title, selftext);
        let post_id = post["id"].as_str().unwrap_or("").to_string();
        let author = post["author"].as_str().unwrap_or("[deleted]").to_string();
        let permalink = post["permalink"].as_str().map(|s| format!("https://reddit.com{}", s));

        results.push(MentionResult {
            platform: "reddit".to_string(),
            mention_id: post_id,
            author_name: author.clone(),
            author_handle: author,
            content,
            url: permalink,
            likes: post["ups"].as_i64().unwrap_or(0) as i32,
            shares: 0,
            replies: post["num_comments"].as_i64().unwrap_or(0) as i32,
            published_at: None,
        });
    }
    results
}

// ─── Analyse de sentiment ─────────────────────────────────────────────────────

/// Analyse le sentiment d'un texte via GPT-4o.
/// En cas d'échec, utilise une heuristique de mots-clés.
pub async fn analyze_sentiment(text: &str) -> SentimentResult {
    // Essayer GPT-4o d'abord
    if let Some(result) = analyze_sentiment_ai(text).await {
        return result;
    }
    // Fallback heuristique
    analyze_sentiment_heuristic(text)
}

async fn analyze_sentiment_ai(text: &str) -> Option<SentimentResult> {
    let api_key = resolve_openai_api_key()?;
    let client = reqwest::Client::new();

    let prompt = format!(
        r#"Analyse le sentiment de ce texte en JSON strict :

TEXTE: "{}"

Réponds UNIQUEMENT avec ce JSON (pas de markdown) :
{{
  "sentiment": "positive|neutral|negative|crisis",
  "score": -1.0 à +1.0,
  "is_crisis": true/false,
  "crisis_level": 0-3,
  "key_phrases": ["phrase1", "phrase2"]
}}

crisis = contenu viral négatif, appel au boycott, scandale, atteinte grave à la réputation.
crisis_level: 0=aucun 1=négatif léger 2=controversé 3=crise majeure"#,
        text.chars().take(500).collect::<String>()
    );

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 200,
        "temperature": 0.1,
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .ok()?;

    let data: serde_json::Value = resp.json().await.ok()?;
    let content = data["choices"][0]["message"]["content"].as_str()?;

    // Parser le JSON retourné
    let clean = content.trim().trim_start_matches("```json").trim_end_matches("```").trim();
    let parsed: serde_json::Value = serde_json::from_str(clean).ok()?;

    Some(SentimentResult {
        sentiment: parsed["sentiment"].as_str().unwrap_or("neutral").to_string(),
        score: parsed["score"].as_f64().unwrap_or(0.0),
        is_crisis: parsed["is_crisis"].as_bool().unwrap_or(false),
        crisis_level: parsed["crisis_level"].as_i64().unwrap_or(0) as i32,
        key_phrases: parsed["key_phrases"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
    })
}

fn analyze_sentiment_heuristic(text: &str) -> SentimentResult {
    let text_lower = text.to_lowercase();

    const NEGATIVE_WORDS: &[&str] = &[
        "arnaque",
        "escroc",
        "horrible",
        "nul",
        "catastrophe",
        "honteux",
        "terrible",
        "déçu",
        "déception",
        "mensonge",
        "faux",
        "danger",
        "problème",
        "scam",
        "fraude",
        "boycott",
        "scandale",
        "refuse",
        "pire",
        "inefficace",
        "inacceptable",
        "plainte",
        "rembourse",
    ];
    const POSITIVE_WORDS: &[&str] = &[
        "excellent",
        "parfait",
        "génial",
        "bravo",
        "félicitations",
        "super",
        "top",
        "recommande",
        "satisfait",
        "qualité",
        "rapide",
        "sérieux",
        "merci",
        "magnifique",
        "incroyable",
        "fantastique",
        "professionnel",
    ];
    const CRISIS_WORDS: &[&str] = &[
        "boycott",
        "scandale",
        "escroc",
        "arnaque",
        "fraude",
        "signaler",
        "police",
        "justice",
        "tribunal",
        "viral",
        "honte",
        "scandaleux",
    ];

    let neg_count = NEGATIVE_WORDS.iter().filter(|w| text_lower.contains(*w)).count() as f64;
    let pos_count = POSITIVE_WORDS.iter().filter(|w| text_lower.contains(*w)).count() as f64;
    let crisis_count = CRISIS_WORDS.iter().filter(|w| text_lower.contains(*w)).count();

    let score = if neg_count + pos_count == 0.0 {
        0.0
    } else {
        (pos_count - neg_count * 1.5) / (pos_count + neg_count * 1.5)
    };

    let is_crisis = crisis_count >= 2;
    let crisis_level = if crisis_count >= 3 {
        3
    } else if crisis_count == 2 {
        2
    } else if crisis_count == 1 {
        1
    } else {
        0
    };

    let sentiment = if is_crisis || score < -0.5 {
        "crisis"
    } else if score < -0.1 {
        "negative"
    } else if score > 0.2 {
        "positive"
    } else {
        "neutral"
    };

    SentimentResult {
        sentiment: sentiment.to_string(),
        score,
        is_crisis,
        crisis_level,
        key_phrases: vec![],
    }
}

// ─── Alertes de crise ─────────────────────────────────────────────────────────

async fn trigger_crisis_alert(
    state: &Arc<AppState>,
    config: &MonitorConfig,
    mention_id: i64,
    mention: &MentionResult,
    sentiment: &SentimentResult,
) -> Result<(), String> {
    // 1. Créer un événement de crise en DB
    let _ = sqlx::query(
        r#"INSERT INTO crisis_events
           (user_id, service_id, title, crisis_level, status,
            trigger_mention_id, trigger_platform, trigger_content)
           VALUES ($1, $2, $3, $4, 'detected', $5, $6, $7)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(config.user_id)
    .bind(config.service_id)
    .bind(format!(
        "Mention {} sur {} — score {:.2}",
        if sentiment.is_crisis {
            "CRITIQUE"
        } else {
            "négative"
        },
        mention.platform,
        sentiment.score
    ))
    .bind(sentiment.crisis_level)
    .bind(mention_id)
    .bind(&mention.platform)
    .bind(&mention.content[..mention.content.len().min(500)])
    .execute(&state.pg)
    .await;

    // 2. Notification WhatsApp au manager si configuré
    if let Some(ref phone) = config.notify_whatsapp {
        let message = format!(
            "🚨 *Alerte Réputation Yukpo*\n\n\
             Plateforme: {}\n\
             Auteur: @{}\n\
             Sentiment: {} (score: {:.2})\n\
             Contenu: {}\n\n\
             Connectez-vous à Yukpo pour gérer cette situation.",
            mention.platform,
            mention.author_handle,
            sentiment.sentiment,
            sentiment.score,
            &mention.content[..mention.content.len().min(200)]
        );
        // Utiliser le service WhatsApp existant (send_whatsapp_text)
        let whatsapp_token = std::env::var("WHATSAPP_ACCESS_TOKEN").unwrap_or_default();
        let phone_id = std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_default();
        if !whatsapp_token.is_empty() && !phone_id.is_empty() {
            let client = reqwest::Client::new();
            let body = serde_json::json!({
                "messaging_product": "whatsapp",
                "to": phone.replace("+", "").replace(" ", ""),
                "type": "text",
                "text": { "body": message }
            });
            let _ = client
                .post(format!(
                    "https://graph.facebook.com/v19.0/{}/messages",
                    phone_id
                ))
                .bearer_auth(&whatsapp_token)
                .json(&body)
                .send()
                .await;
        }
    }

    log::warn!(
        "[Reputation] 🚨 Alerte crise user={} — {} — niveau {}",
        config.user_id,
        mention.platform,
        sentiment.crisis_level
    );

    Ok(())
}

// ─── Chargement config depuis DB ──────────────────────────────────────────────

/// Charge toutes les configurations de monitoring actives
pub async fn load_active_monitor_configs(pg: &PgPool) -> Vec<MonitorConfig> {
    use sqlx::Row;

    let rows = sqlx::query(
        r#"SELECT user_id, service_id, keywords, monitor_platforms,
                  crisis_sentiment_threshold, crisis_reach_threshold,
                  notify_whatsapp, notify_email
           FROM reputation_monitor_config
           WHERE is_active = true"#,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .filter_map(|r| {
            Some(MonitorConfig {
                user_id: r.try_get("user_id").ok()?,
                service_id: r.try_get("service_id").ok()?,
                keywords: r.try_get::<Vec<String>, _>("keywords").unwrap_or_default(),
                monitor_platforms: r
                    .try_get::<Vec<String>, _>("monitor_platforms")
                    .unwrap_or_default(),
                crisis_sentiment_threshold: r
                    .try_get::<f64, _>("crisis_sentiment_threshold")
                    .unwrap_or(-0.6),
                crisis_reach_threshold: r
                    .try_get::<i32, _>("crisis_reach_threshold")
                    .unwrap_or(1000),
                notify_whatsapp: r.try_get("notify_whatsapp").ok().flatten(),
                notify_email: r.try_get("notify_email").ok().flatten(),
            })
        })
        .collect()
}

// ─── Instagram Graph API — mentions et tags ───────────────────────────────────

/// Récupère les mentions Instagram d'un compte Business via l'API Graph.
/// Couvre : tags (@mention dans les posts publics), commentaires contenant les mots-clés.
async fn fetch_instagram_mentions(
    client: &Client,
    ig_account_id: &str,
    access_token: &str,
    keywords: &[String],
) -> Vec<MentionResult> {
    let mut results = Vec::new();

    // Recherche des médias où le compte est tagué
    let tagged_url = format!("https://graph.facebook.com/v19.0/{}/tags", ig_account_id);

    let resp = client
        .get(&tagged_url)
        .query(&[
            (
                "fields",
                "id,caption,like_count,comments_count,timestamp,permalink,username",
            ),
            ("access_token", access_token),
            ("limit", "50"),
        ])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await;

    if let Ok(r) = resp {
        if let Ok(data) = r.json::<serde_json::Value>().await {
            if let Some(items) = data["data"].as_array() {
                for item in items {
                    let caption = item["caption"].as_str().unwrap_or("").to_string();

                    // Filtrer par mots-clés si renseignés
                    let matches = keywords.is_empty()
                        || keywords
                            .iter()
                            .any(|k| caption.to_lowercase().contains(&k.to_lowercase()));

                    if !matches {
                        continue;
                    }

                    results.push(MentionResult {
                        platform: "instagram".to_string(),
                        mention_id: item["id"].as_str().unwrap_or("").to_string(),
                        author_name: item["username"].as_str().unwrap_or("").to_string(),
                        author_handle: format!("@{}", item["username"].as_str().unwrap_or("")),
                        content: caption,
                        url: item["permalink"].as_str().map(|s| s.to_string()),
                        likes: item["like_count"].as_i64().unwrap_or(0) as i32,
                        shares: 0,
                        replies: item["comments_count"].as_i64().unwrap_or(0) as i32,
                        published_at: item["timestamp"].as_str().map(|s| s.to_string()),
                    });
                }
            }
        }
    }

    // Récupérer aussi les commentaires récents sur les posts du compte
    let media_url = format!("https://graph.facebook.com/v19.0/{}/media", ig_account_id);
    let media_resp = client
        .get(&media_url)
        .query(&[
            (
                "fields",
                "id,caption,comments{text,username,timestamp},like_count,timestamp,permalink",
            ),
            ("access_token", access_token),
            ("limit", "20"),
        ])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await;

    if let Ok(r) = media_resp {
        if let Ok(data) = r.json::<serde_json::Value>().await {
            if let Some(posts) = data["data"].as_array() {
                for post in posts {
                    if let Some(comments) = post["comments"]["data"].as_array() {
                        for comment in comments {
                            let text = comment["text"].as_str().unwrap_or("").to_string();
                            let matches = keywords.is_empty()
                                || keywords
                                    .iter()
                                    .any(|k| text.to_lowercase().contains(&k.to_lowercase()));
                            if !matches {
                                continue;
                            }
                            results.push(MentionResult {
                                platform: "instagram".to_string(),
                                mention_id: comment["id"].as_str().unwrap_or("").to_string(),
                                author_name: comment["username"].as_str().unwrap_or("").to_string(),
                                author_handle: format!(
                                    "@{}",
                                    comment["username"].as_str().unwrap_or("")
                                ),
                                content: text,
                                url: post["permalink"].as_str().map(|s| s.to_string()),
                                likes: 0,
                                shares: 0,
                                replies: 0,
                                published_at: comment["timestamp"].as_str().map(|s| s.to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    log::debug!(
        "[Reputation] Instagram: {} mentions trouvées",
        results.len()
    );
    results
}

// ─── TikTok Research API — vidéos mentionnant les mots-clés ──────────────────

/// Recherche les vidéos TikTok publiques contenant les mots-clés via Research API.
/// Nécessite une approbation Research API officielle de TikTok.
async fn fetch_tiktok_mentions(
    client: &Client,
    client_key: &str,
    client_secret: &str,
    keywords: &[String],
) -> Vec<MentionResult> {
    if keywords.is_empty() {
        return vec![];
    }

    // Obtenir un access token client credentials
    let token_resp = client
        .post("https://open.tiktokapis.com/v2/oauth/token/")
        .form(&[
            ("client_key", client_key),
            ("client_secret", client_secret),
            ("grant_type", "client_credentials"),
        ])
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    let access_token = match token_resp {
        Ok(r) => {
            let data: serde_json::Value = r.json().await.unwrap_or_default();
            data["access_token"].as_str().unwrap_or("").to_string()
        }
        Err(_) => return vec![],
    };

    if access_token.is_empty() {
        return vec![];
    }

    // Recherche vidéos — TikTok Research API
    let keyword_query = keywords.join(" OR ");
    let body = serde_json::json!({
        "query": {
            "and": [
                {
                    "operation": "IN",
                    "field_name": "keyword",
                    "field_values": keywords
                }
            ]
        },
        "start_date": chrono::Utc::now()
            .checked_sub_signed(chrono::Duration::hours(24))
            .unwrap_or_else(chrono::Utc::now)
            .format("%Y%m%d")
            .to_string(),
        "end_date": chrono::Utc::now().format("%Y%m%d").to_string(),
        "max_count": 20,
        "fields": "id,create_time,username,video_description,like_count,comment_count,share_count,view_count,hashtag_names,video_url"
    });
    let _ = keyword_query;

    let search_resp = client
        .post("https://open.tiktokapis.com/v2/research/video/query/")
        .bearer_auth(&access_token)
        .json(&body)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await;

    let mut results = Vec::new();

    if let Ok(r) = search_resp {
        if let Ok(data) = r.json::<serde_json::Value>().await {
            if let Some(videos) = data["data"]["videos"].as_array() {
                for video in videos {
                    let description = video["video_description"].as_str().unwrap_or("").to_string();
                    let username = video["username"].as_str().unwrap_or("").to_string();
                    let video_id = video["id"].as_str().unwrap_or("").to_string();

                    results.push(MentionResult {
                        platform: "tiktok".to_string(),
                        mention_id: video_id.clone(),
                        author_name: username.clone(),
                        author_handle: format!("@{}", username),
                        content: description,
                        url: Some(format!(
                            "https://www.tiktok.com/@{}/video/{}",
                            username, video_id
                        )),
                        likes: video["like_count"].as_i64().unwrap_or(0) as i32,
                        shares: video["share_count"].as_i64().unwrap_or(0) as i32,
                        replies: video["comment_count"].as_i64().unwrap_or(0) as i32,
                        published_at: video["create_time"].as_i64().map(|ts| {
                            chrono::DateTime::from_timestamp(ts, 0)
                                .unwrap_or_else(|| Utc::now())
                                .to_rfc3339()
                        }),
                    });
                }
            }
        }
    }

    log::debug!("[Reputation] TikTok: {} vidéos trouvées", results.len());
    results
}
