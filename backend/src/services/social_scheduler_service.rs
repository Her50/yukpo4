// Scheduler intelligent de contenu social
// Détermine les meilleures heures de publication, gère le calendrier éditorial,
// lance la génération IA et l'envoi automatique

use chrono::{DateTime, Datelike, Duration, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::services::ai_content_service::{self, ContentPreferences, ProductContext, StoreContext};
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
    let partners = sqlx::query!(
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
        let rules = &partner.rules;
        let products_per_day = rules["products_per_day"].as_i64().unwrap_or(3) as i32;
        let schedule_hour = rules["schedule_hour"].as_i64().unwrap_or(18) as u32;
        let filter = rules["filter"].as_str().unwrap_or("all");
        let platforms: Vec<String> = rules["target_platforms"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_else(|| vec!["facebook".to_string()]);

        // Vérifier qu'il n'y a pas déjà des posts planifiés pour aujourd'hui
        let already_planned: i64 = sqlx::query_scalar!(
            r#"SELECT COUNT(*) FROM social_ai_posts
               WHERE user_id = $1 AND service_id = $2
                 AND status = 'scheduled'
                 AND scheduled_at::date = CURRENT_DATE"#,
            partner.user_id,
            partner.service_id,
        )
        .fetch_one(&state.pg)
        .await
        .ok()
        .flatten()
        .unwrap_or(0);

        if already_planned > 0 {
            continue;
        }

        // Récupérer les produits à planifier
        let products =
            pick_products_for_day(&state.pg, partner.service_id, products_per_day, filter).await;

        // Charger les préférences de contenu
        let prefs =
            ai_content_service::load_preferences(&state.pg, partner.user_id, partner.service_id)
                .await;

        // Infos du service
        let service_info = sqlx::query!(
            r#"SELECT s.name, s.city, s.phone,
                      COALESCE(st.name, 'commerce') as sector
               FROM services s
               LEFT JOIN service_types st ON st.id = s.service_type_id
               WHERE s.id = $1"#,
            partner.service_id,
        )
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let store = StoreContext {
            name: service_info
                .as_ref()
                .map(|s| s.name.clone())
                .unwrap_or_else(|| "Boutique".to_string()),
            sector: service_info
                .as_ref()
                .and_then(|s| s.sector.clone())
                .unwrap_or_else(|| "commerce".to_string()),
            city: service_info.as_ref().and_then(|s| s.city.clone()).unwrap_or_default(),
            phone: service_info.as_ref().and_then(|s| s.phone.clone()),
            yukpo_url: format!(
                "https://yukpomnang.com/boutique/{}?utm_source=auto_post&utm_medium=social",
                partner.service_id
            ),
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

            // Générer le contenu IA
            match ai_content_service::generate_product_post(product, &store, &prefs).await {
                Ok(content) => {
                    let _ = ai_content_service::save_generated_post(
                        &state.pg,
                        partner.user_id,
                        partner.service_id,
                        Some(product.id),
                        &slot.platform,
                        &content,
                        Some(slot.datetime),
                        None,
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
    let due_posts = sqlx::query!(
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
        // Marquer en cours
        let _ = sqlx::query!(
            "UPDATE social_ai_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1",
            post.id,
        )
        .execute(&state.pg)
        .await;

        // Composer le caption final avec hashtags
        let hashtags_str = post
            .hashtags
            .as_ref()
            .map(|h| h.iter().map(|t| format!("#{}", t)).collect::<Vec<_>>().join(" "))
            .unwrap_or_default();
        let full_caption = if hashtags_str.is_empty() {
            post.caption.clone()
        } else {
            format!("{}\n\n{}", post.caption, hashtags_str)
        };

        // Publier selon la plateforme
        let publish_result = match post.platform.as_str() {
            "facebook" => {
                publish_to_facebook(
                    state,
                    post.user_id,
                    &full_caption,
                    post.image_url.as_deref(),
                )
                .await
            }
            "instagram" => {
                publish_to_instagram(
                    state,
                    post.user_id,
                    &full_caption,
                    post.image_url.as_deref(),
                )
                .await
            }
            _ => Err(format!("Plateforme non supportée: {}", post.platform)),
        };

        match publish_result {
            Ok(external_id) => {
                let _ = sqlx::query!(
                    r#"UPDATE social_ai_posts
                       SET status = 'published', published_at = NOW(),
                           external_post_id = $1, updated_at = NOW()
                       WHERE id = $2"#,
                    external_id,
                    post.id,
                )
                .execute(&state.pg)
                .await;

                log::info!(
                    "[Scheduler] ✅ Post {} publié sur {} (ext_id: {})",
                    post.id,
                    post.platform,
                    external_id
                );
            }
            Err(e) => {
                log::error!("[Scheduler] ❌ Erreur publication post {}: {}", post.id, e);
                let _ = sqlx::query!(
                    r#"UPDATE social_ai_posts
                       SET status = CASE WHEN retry_count >= 2 THEN 'failed' ELSE 'scheduled' END,
                           retry_count = retry_count + 1,
                           error_message = $1,
                           updated_at = NOW()
                       WHERE id = $2"#,
                    e,
                    post.id,
                )
                .execute(&state.pg)
                .await;
            }
        }
    }

    Ok(())
}

/// Vérifie les variantes A/B après 24h et détermine le gagnant
async fn check_ab_test_winners(state: &Arc<AppState>) -> Result<(), String> {
    let ab_posts = sqlx::query!(
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
        if let Some(ext_id) = post.external_post_id {
            // Récupérer les métriques depuis Meta API
            if let Ok(analytics) =
                fetch_post_insights(&ext_id, post.user_id, &state.pg, &post.platform).await
            {
                let _ = ai_content_service::determine_ab_winner(
                    &state.pg,
                    post.id,
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
    let query = match filter {
        "promotions" => sqlx::query!(
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true AND sale_price IS NOT NULL
               ORDER BY (price - COALESCE(sale_price, price)) / price DESC
               LIMIT $2"#,
            service_id, count as i64,
        ).fetch_all(pg).await,
        "new" => sqlx::query!(
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true
               ORDER BY created_at DESC
               LIMIT $2"#,
            service_id, count as i64,
        ).fetch_all(pg).await,
        _ => sqlx::query!(
            r#"SELECT id, name, price, sale_price, category, description, image_url, is_active, brand
               FROM service_products
               WHERE service_id = $1 AND is_active = true
               ORDER BY
                 CASE WHEN sale_price IS NOT NULL THEN 0 ELSE 1 END,
                 RANDOM()
               LIMIT $2"#,
            service_id, count as i64,
        ).fetch_all(pg).await,
    };

    query
        .unwrap_or_default()
        .into_iter()
        .map(|r| ProductContext {
            id: r.id,
            name: r.name,
            price: r.price.unwrap_or(0.0),
            sale_price: r.sale_price,
            category: r.category.unwrap_or_else(|| "autres".to_string()),
            description: r.description,
            image_url: r.image_url,
            in_stock: r.is_active,
            brand: r.brand,
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

    let token_info = load_valid_token(&state.pg, user_id, "facebook").await?;
    let page_id =
        extract_first_page_id(&token_info.metadata).ok_or("Aucune Page Facebook connectée")?;
    let page_token = extract_page_access_token(&token_info.metadata, &page_id)
        .ok_or("Page access token manquant")?;

    let product = facebook_publisher_service::CatalogProduct {
        id: format!("post_{}", chrono::Utc::now().timestamp()),
        name: "Post automatique".to_string(),
        price: 0,
        sale_price: None,
        image_url: image_url.unwrap_or("").to_string(),
        product_url: format!("https://yukpomnang.com?utm_source=auto_post&utm_medium=social&utm_campaign=yukpo_scheduler"),
        store_name: "".to_string(),
        in_stock: true,
    };

    facebook_publisher_service::post_product_to_page(&page_id, &page_token, &product, caption).await
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

    let token_info = load_valid_token(&state.pg, user_id, "facebook").await?;
    let page_id =
        extract_first_page_id(&token_info.metadata).ok_or("Aucune Page Facebook connectée")?;
    let page_token = extract_page_access_token(&token_info.metadata, &page_id)
        .ok_or("Page access token manquant")?;

    let ig_user_id =
        instagram_publisher_service::get_ig_business_account_id(&page_id, &page_token).await?;

    let img = image_url.unwrap_or("").to_string();
    instagram_publisher_service::publish_product_image(&ig_user_id, &page_token, &img, caption)
        .await
}

/// Récupère les insights d'un post publié (pour A/B test)
async fn fetch_post_insights(
    post_id: &str,
    user_id: i32,
    pg: &PgPool,
    platform: &str,
) -> Result<(i32, i32), String> {
    // Pour simplifier: on retourne l'engagement depuis la table analytics si disponible
    // En production: appeler GET /{post_id}/insights
    let analytics = sqlx::query!(
        r#"SELECT likes, comments, shares
           FROM social_ai_post_analytics a
           JOIN social_ai_posts p ON p.id = a.post_id
           WHERE p.external_post_id = $1 AND p.user_id = $2"#,
        post_id,
        user_id,
    )
    .fetch_optional(pg)
    .await
    .ok()
    .flatten();

    let engagement_a = analytics.as_ref().map(|a| a.likes + a.comments + a.shares).unwrap_or(0);

    Ok((engagement_a, 0)) // B pas encore mésuré
}

/// Charge le calendrier de contenu
pub async fn get_content_calendar(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    days_ahead: i32,
) -> Result<Vec<ContentCalendarEntry>, String> {
    let rows = sqlx::query!(
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
        user_id,
        service_id,
        days_ahead.to_string(),
    )
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| ContentCalendarEntry {
            id: r.id,
            scheduled_at: r.scheduled_at.unwrap_or_else(Utc::now),
            platform: r.platform,
            product_id: r.product_id,
            product_name: r.product_name,
            caption_preview: r.caption.chars().take(80).collect(),
            status: r.status,
            tone: r.tone,
        })
        .collect())
}
