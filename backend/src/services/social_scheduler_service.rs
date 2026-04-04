// Scheduler intelligent de contenu social
// Détermine les meilleures heures de publication, gère le calendrier éditorial,
// lance la génération IA et l'envoi automatique

use chrono::{DateTime, Duration, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::ai_content_service::{self, ProductContext, StoreContext};
use crate::services::facebook_publisher_service;
use crate::services::instagram_publisher_service;
use crate::state::AppState;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledSlot {
    pub datetime: DateTime<Utc>,
    pub platform: String,
    pub score: f32,     // score optimal 0.0-1.0
    pub reason: String, // "Pic d'engagement 18h-20h", "Paie du mois", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentCalendarEntry {
    pub id: i32,
    pub scheduled_at: DateTime<Utc>,
    pub platform: String,
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub caption_preview: String,
    pub status: String,
    pub tone: String,
}

// ─── Scheduler principal (lancé depuis main.rs) ───────────────────────────────

pub fn start_social_scheduler(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[Scheduler] 📅 Démarrage du scheduler de contenu social");

        // Vérifier toutes les 5 minutes les posts à publier maintenant
        let mut ticker = tokio::time::interval(tokio::time::Duration::from_secs(300));

        // Planification quotidienne à 6h
        let mut last_planning_date = chrono::Utc::now().date_naive() - Duration::days(1);

        loop {
            ticker.tick().await;

            let today = chrono::Utc::now().date_naive();
            if today > last_planning_date && chrono::Utc::now().hour() >= 6 {
                if let Err(e) = generate_daily_schedule(&state).await {
                    log::error!("[Scheduler] Erreur planification quotidienne: {}", e);
                }
                last_planning_date = today;
            }

            if let Err(e) = publish_due_posts(&state).await {
                log::error!("[Scheduler] Erreur publication posts: {}", e);
            }

            if let Err(e) = check_ab_test_winners(&state).await {
                log::error!("[Scheduler] Erreur A/B check: {}", e);
            }
        }
    });
}

/// Génère le planning du jour pour tous les partenaires avec auto-diffusion activée
async fn generate_daily_schedule(state: &Arc<AppState>) -> Result<(), String> {
    // Charger tous les partenaires avec distribution automatique activée
    let partners = sqlx::query(
        r#"SELECT DISTINCT dr.user_id, dr.service_id, dr.rules
           FROM distribution_rules dr
           WHERE (dr.rules->>'auto_distribute')::boolean = true"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    log::info!(
        "[Scheduler] Planification pour {} partenaires",
        partners.len()
    );

    for partner in partners {
        use sqlx::Row;
        let partner_user_id: i32 = partner.try_get("user_id").unwrap_or(0);
        let partner_service_id: i32 = partner.try_get("service_id").unwrap_or(0);
        let rules: serde_json::Value = partner.try_get("rules").unwrap_or(serde_json::Value::Null);

        let products_per_day = rules["products_per_day"].as_i64().unwrap_or(3) as i32;
        let schedule_hour = rules["schedule_hour"].as_i64().unwrap_or(18) as u32;
        let filter = rules["filter"].as_str().unwrap_or("all").to_string();
        let platforms: Vec<String> = rules["target_platforms"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_else(|| vec!["facebook".to_string()]);

        // Vérifier qu'il n'y a pas déjà des posts planifiés pour aujourd'hui
        let already_planned: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM social_ai_posts
               WHERE user_id = $1 AND service_id = $2
                 AND status = 'scheduled'
                 AND scheduled_at::date = CURRENT_DATE"#,
        )
        .bind(partner_user_id)
        .bind(partner_service_id)
        .fetch_one(&state.pg)
        .await
        .unwrap_or(0);

        if already_planned > 0 {
            continue;
        }

        // Récupérer les produits à planifier
        let products =
            pick_products_for_day(&state.pg, partner_service_id, products_per_day, &filter).await;

        // Charger les préférences de contenu
        let prefs =
            ai_content_service::load_preferences(&state.pg, partner_user_id, partner_service_id)
                .await;

        // Infos du service
        let service_info = sqlx::query(
            r#"SELECT s.name, s.city, s.phone,
                      COALESCE(st.name, 'commerce') as sector
               FROM services s
               LEFT JOIN service_types st ON st.id = s.service_type_id
               WHERE s.id = $1"#,
        )
        .bind(partner_service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let store = {
            use sqlx::Row;
            StoreContext {
                name: service_info
                    .as_ref()
                    .and_then(|s: &sqlx::postgres::PgRow| s.try_get::<String, _>("name").ok())
                    .unwrap_or_else(|| "Boutique".to_string()),
                sector: service_info
                    .as_ref()
                    .and_then(|s: &sqlx::postgres::PgRow| {
                        s.try_get::<Option<String>, _>("sector").ok().flatten()
                    })
                    .unwrap_or_else(|| "commerce".to_string()),
                city: service_info
                    .as_ref()
                    .and_then(|s: &sqlx::postgres::PgRow| {
                        s.try_get::<Option<String>, _>("city").ok().flatten()
                    })
                    .unwrap_or_default(),
                phone: service_info.as_ref().and_then(|s: &sqlx::postgres::PgRow| {
                    s.try_get::<Option<String>, _>("phone").ok().flatten()
                }),
                yukpo_url: format!(
                    "https://yukpomnang.com/boutique/{}?utm_source=auto_post&utm_medium=social",
                    partner_service_id
                ),
            }
        };

        // Calculer les créneaux optimaux
        let slots = compute_optimal_slots(schedule_hour, &platforms, products_per_day as usize);

        for (i, product) in products.iter().enumerate() {
            let slot = slots.get(i).cloned().unwrap_or_else(|| {
                let base =
                    Utc::now().date_naive().and_hms_opt(schedule_hour, 0, 0).unwrap().and_utc();
                ScheduledSlot {
                    datetime: base + Duration::hours(i as i64),
                    platform: platforms.first().cloned().unwrap_or_else(|| "facebook".to_string()),
                    score: 0.7,
                    reason: "Heure configurée".to_string(),
                }
            });

            // Résoudre l'image : utiliser l'image du produit ou générer via DALL-E 3
            let resolved_image_url: Option<String> = if product.image_url.is_some() {
                product.image_url.clone()
            } else {
                // Pas d'image — générer un visuel IA (DALL-E 3)
                match ai_content_service::generate_product_image(
                    &product.name,
                    &product.category,
                    &store.name,
                )
                .await
                {
                    Ok(url) => {
                        log::info!(
                            "[Scheduler] 🎨 Visuel IA généré pour \"{}\" ({})",
                            product.name,
                            slot.platform
                        );
                        Some(url)
                    }
                    Err(e) => {
                        log::warn!(
                            "[Scheduler] ⚠️ Génération visuel DALL-E échouée pour \"{}\": {}",
                            product.name,
                            e
                        );
                        None
                    }
                }
            };

            // Instagram nécessite obligatoirement une image — ignorer si aucun visuel
            if slot.platform == "instagram" && resolved_image_url.is_none() {
                log::warn!(
                    "[Scheduler] ⏭️ Post Instagram ignoré pour \"{}\" — aucun visuel disponible",
                    product.name
                );
                continue;
            }

            // Générer le contenu IA
            match ai_content_service::generate_product_post(product, &store, &prefs).await {
                Ok(content) => {
                    let _ = ai_content_service::save_generated_post(
                        &state.pg,
                        partner_user_id,
                        partner_service_id,
                        Some(product.id),
                        &slot.platform,
                        &content,
                        Some(slot.datetime),
                        None,
                        resolved_image_url.as_deref(),
                    )
                    .await;

                    log::info!(
                        "[Scheduler] Post planifié: {} sur {} à {}",
                        product.name,
                        slot.platform,
                        slot.datetime
                    );
                }
                Err(e) => {
                    log::warn!(
                        "[Scheduler] Génération IA échouée pour {}: {}",
                        product.name,
                        e
                    );
                }
            }
        }
    }

    Ok(())
}

/// Publie les posts dont l'heure de publication est passée
async fn publish_due_posts(state: &Arc<AppState>) -> Result<(), String> {
    let due_posts = sqlx::query(
        r#"SELECT p.id, p.user_id, p.service_id, p.platform, p.caption,
                  p.image_url, p.product_id, p.hashtags
           FROM social_ai_posts p
           WHERE p.status = 'scheduled'
             AND p.scheduled_at <= NOW()
             AND p.retry_count < 3
           ORDER BY p.scheduled_at ASC
           LIMIT 10
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for post in due_posts {
        use sqlx::Row;
        let post_id: i32 = post.try_get("id").unwrap_or(0);
        let post_user_id: i32 = post.try_get("user_id").unwrap_or(0);
        let post_platform: String = post.try_get("platform").unwrap_or_default();
        let post_caption: String = post.try_get("caption").unwrap_or_default();
        let post_image_url: Option<String> = post.try_get("image_url").ok();
        let post_hashtags: Option<Vec<String>> = post.try_get("hashtags").ok();

        // Marquer en cours
        let _ = sqlx::query(
            "UPDATE social_ai_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1",
        )
        .bind(post_id)
        .execute(&state.pg)
        .await;

        // Composer le caption final avec hashtags
        let hashtags_str = post_hashtags
            .as_ref()
            .map(|h| h.iter().map(|t| format!("#{}", t)).collect::<Vec<_>>().join(" "))
            .unwrap_or_default();
        let full_caption = if hashtags_str.is_empty() {
            post_caption.clone()
        } else {
            format!("{}\n\n{}", post_caption, hashtags_str)
        };

        // Publier selon la plateforme
        let publish_result = match post_platform.as_str() {
            "facebook" => {
                publish_to_facebook(
                    state,
                    post_user_id,
                    &full_caption,
                    post_image_url.as_deref(),
                )
                .await
            }
            "instagram" => {
                publish_to_instagram(
                    state,
                    post_user_id,
                    &full_caption,
                    post_image_url.as_deref(),
                )
                .await
            }
            _ => Err(format!("Plateforme non supportée: {}", post_platform)),
        };

        match publish_result {
            Ok(external_id) => {
                let _ = sqlx::query(
                    r#"UPDATE social_ai_posts
                       SET status = 'published', published_at = NOW(),
                           external_post_id = $1, updated_at = NOW()
                       WHERE id = $2"#,
                )
                .bind(&external_id)
                .bind(post_id)
                .execute(&state.pg)
                .await;

                log::info!(
                    "[Scheduler] ✅ Post {} publié sur {} (ext_id: {})",
                    post_id,
                    post_platform,
                    external_id
                );
            }
            Err(e) => {
                log::error!("[Scheduler] ❌ Erreur publication post {}: {}", post_id, e);
                let _ = sqlx::query(
                    r#"UPDATE social_ai_posts
                       SET status = CASE WHEN retry_count >= 2 THEN 'failed' ELSE 'scheduled' END,
                           retry_count = retry_count + 1,
                           error_message = $1,
                           updated_at = NOW()
                       WHERE id = $2"#,
                )
                .bind(&e)
                .bind(post_id)
                .execute(&state.pg)
                .await;
            }
        }
    }

    Ok(())
}

/// Vérifie les variantes A/B après 24h et détermine le gagnant
async fn check_ab_test_winners(state: &Arc<AppState>) -> Result<(), String> {
    let ab_posts = sqlx::query(
        r#"SELECT p.id, p.external_post_id, p.platform, p.user_id
           FROM social_ai_posts p
           WHERE p.status = 'published'
             AND p.caption_variant_b IS NOT NULL
             AND p.ab_winner IS NULL
             AND p.published_at < NOW() - INTERVAL '24 hours'"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for post in ab_posts {
        use sqlx::Row;
        let post_id: i32 = post.try_get("id").unwrap_or(0);
        let post_user_id: i32 = post.try_get("user_id").unwrap_or(0);
        let post_platform: String = post.try_get("platform").unwrap_or_default();
        let ext_id_opt: Option<String> = post.try_get("external_post_id").ok();

        if let Some(ext_id) = ext_id_opt {
            // Récupérer les métriques depuis Meta API
            if let Ok(analytics) =
                fetch_post_insights(&ext_id, post_user_id, &state.pg, &post_platform).await
            {
                let _ = ai_content_service::determine_ab_winner(
                    &state.pg,
                    post_id,
                    analytics.0,
                    analytics.1,
                )
                .await;
            }
        }
    }

    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Sélectionne les produits à planifier pour la journée
async fn pick_products_for_day(
    pg: &PgPool,
    service_id: i32,
    count: i32,
    filter: &str,
) -> Vec<ProductContext> {
    let sql = match filter {
        "promotions" => {
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true AND sale_price IS NOT NULL
               ORDER BY (price - COALESCE(sale_price, price)) / price DESC
               LIMIT $2"#
        }
        "new" => {
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true
               ORDER BY created_at DESC
               LIMIT $2"#
        }
        _ => {
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true
               ORDER BY
                 CASE WHEN sale_price IS NOT NULL THEN 0 ELSE 1 END,
                 RANDOM()
               LIMIT $2"#
        }
    };

    sqlx::query(sql)
        .bind(service_id)
        .bind(count as i64)
        .fetch_all(pg)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r: sqlx::postgres::PgRow| {
            use sqlx::Row;
            ProductContext {
                id: r.try_get("id").unwrap_or(0),
                name: r.try_get("name").unwrap_or_default(),
                price: r.try_get::<f64, _>("price").unwrap_or(0.0),
                sale_price: r.try_get("sale_price").ok(),
                category: r.try_get("category").unwrap_or_else(|_| "autres".to_string()),
                description: r.try_get("description").ok(),
                image_url: r.try_get("image_url").ok(),
                in_stock: r.try_get("is_active").unwrap_or(true),
                brand: r.try_get("brand").ok(),
            }
        })
        .collect()
}

/// Calcule les créneaux horaires optimaux pour la publication
/// Basé sur les données générales d'engagement en Afrique francophone
fn compute_optimal_slots(
    preferred_hour: u32,
    platforms: &[String],
    count: usize,
) -> Vec<ScheduledSlot> {
    // Scores d'engagement par heure (données Afrique subsaharienne)
    let hourly_scores: [f32; 24] = [
        0.1, 0.05, 0.03, 0.02, 0.02, 0.05, // 0h-5h: très faible
        0.3, 0.5, 0.65, 0.7, 0.7, 0.75, // 6h-11h: montée en puissance
        0.8, 0.75, 0.7, 0.75, 0.8, 0.85, // 12h-17h: pic du midi et après-midi
        0.95, 0.9, 0.85, 0.7, 0.5, 0.3, // 18h-23h: pic du soir (18h-20h = maximum)
    ];

    let today_base = Utc::now().date_naive().and_hms_opt(preferred_hour, 0, 0).unwrap().and_utc();

    let mut slots = Vec::new();
    let platform_iter = platforms.iter().cycle();

    for (i, platform) in platform_iter.take(count).enumerate() {
        let hour_offset = (i as u32 * 2) % 6; // espacement 2h max, cycle sur 6h
        let slot_hour = (preferred_hour + hour_offset) % 24;
        let slot_time = today_base + Duration::hours(hour_offset as i64);

        let score = hourly_scores[slot_hour as usize];
        let reason = match slot_hour {
            18..=20 => "🔥 Pic d'engagement soir (18h-20h)".to_string(),
            12..=13 => "☀️ Pause déjeuner — bon engagement".to_string(),
            7..=9 => "🌅 Matin — audience active avant le travail".to_string(),
            _ => format!("Créneau {}h configuré", slot_hour),
        };

        slots.push(ScheduledSlot {
            datetime: slot_time,
            platform: platform.clone(),
            score,
            reason,
        });
    }

    slots
}

/// Publie sur Facebook via facebook_publisher_service
async fn publish_to_facebook(
    state: &Arc<AppState>,
    user_id: i32,
    caption: &str,
    image_url: Option<&str>,
) -> Result<String, String> {
    use crate::services::meta_token_service::{
        extract_first_page_id, extract_page_access_token, load_valid_token,
    };

    let http = reqwest::Client::new();
    let token_info = load_valid_token(&state.pg, &http, user_id, "facebook")
        .await
        .map_err(|e| e.to_string())?;
    let page_id =
        extract_first_page_id(&token_info.metadata).ok_or("Aucune Page Facebook connectée")?;
    let page_token = extract_page_access_token(&token_info.metadata, &page_id)
        .ok_or("Page access token manquant")?;

    let link = "https://yukpomnang.com?utm_source=auto_post&utm_medium=social";
    facebook_publisher_service::post_product_to_page(
        &http,
        &page_token,
        &page_id,
        caption,
        link,
        image_url,
    )
    .await
    .map_err(|e| e.to_string())
}

/// Publie sur Instagram via instagram_publisher_service
async fn publish_to_instagram(
    state: &Arc<AppState>,
    user_id: i32,
    caption: &str,
    image_url: Option<&str>,
) -> Result<String, String> {
    use crate::services::meta_token_service::{
        extract_first_page_id, extract_page_access_token, load_valid_token,
    };

    let http = reqwest::Client::new();
    let token_info = load_valid_token(&state.pg, &http, user_id, "facebook")
        .await
        .map_err(|e| e.to_string())?;
    let page_id =
        extract_first_page_id(&token_info.metadata).ok_or("Aucune Page Facebook connectée")?;
    let page_token = extract_page_access_token(&token_info.metadata, &page_id)
        .ok_or("Page access token manquant")?;

    let ig_user_id =
        instagram_publisher_service::get_ig_business_account_id(&http, &page_id, &page_token)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Compte Instagram Business non lié à cette Page")?;

    let img = image_url
        .filter(|u| !u.is_empty())
        .ok_or("Instagram nécessite une image — aucun visuel disponible pour ce post")?;
    instagram_publisher_service::publish_product_image(
        &http,
        &ig_user_id,
        &page_token,
        img,
        caption,
    )
    .await
    .map_err(|e| e.to_string())
}

/// Récupère les insights d'un post publié (pour A/B test)
async fn fetch_post_insights(
    post_id: &str,
    user_id: i32,
    pg: &PgPool,
    _platform: &str,
) -> Result<(i32, i32), String> {
    // Pour simplifier: on retourne l'engagement depuis la table analytics si disponible
    // En production: appeler GET /{post_id}/insights
    let analytics = sqlx::query(
        r#"SELECT likes, comments, shares
           FROM social_ai_post_analytics a
           JOIN social_ai_posts p ON p.id = a.post_id
           WHERE p.external_post_id = $1 AND p.user_id = $2"#,
    )
    .bind(post_id)
    .bind(user_id)
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    let engagement_a = analytics
        .as_ref()
        .map(|a: &sqlx::postgres::PgRow| {
            use sqlx::Row;
            let likes: i32 = a.try_get("likes").unwrap_or(0);
            let comments: i32 = a.try_get("comments").unwrap_or(0);
            let shares: i32 = a.try_get("shares").unwrap_or(0);
            likes + comments + shares
        })
        .unwrap_or(0);

    Ok((engagement_a, 0)) // B pas encore mésuré
}

/// Charge le calendrier de contenu
pub async fn get_content_calendar(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    days_ahead: i32,
) -> Result<Vec<ContentCalendarEntry>, String> {
    let rows = sqlx::query(
        r#"SELECT p.id, p.scheduled_at, p.platform, p.product_id, p.caption, p.status, p.tone,
                  sp.name as product_name
           FROM social_ai_posts p
           LEFT JOIN service_products sp ON sp.id = p.product_id
           WHERE p.user_id = $1 AND p.service_id = $2
             AND p.scheduled_at >= NOW()
             AND p.scheduled_at <= NOW() + ($3 || ' days')::INTERVAL
             AND p.status IN ('draft', 'scheduled')
           ORDER BY p.scheduled_at ASC
           LIMIT 50"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(days_ahead.to_string())
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r: sqlx::postgres::PgRow| {
            use sqlx::Row;
            let caption: String = r.try_get("caption").unwrap_or_default();
            ContentCalendarEntry {
                id: r.try_get("id").unwrap_or(0),
                scheduled_at: r.try_get("scheduled_at").unwrap_or_else(|_| Utc::now()),
                platform: r.try_get("platform").unwrap_or_default(),
                product_id: r.try_get("product_id").ok(),
                product_name: r.try_get("product_name").ok(),
                caption_preview: caption.chars().take(80).collect(),
                status: r.try_get("status").unwrap_or_default(),
                tone: r.try_get("tone").unwrap_or_default(),
            }
        })
        .collect())
}
