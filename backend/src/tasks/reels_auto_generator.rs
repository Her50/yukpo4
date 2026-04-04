// Reels Auto Generator — Yukpo
// Génère automatiquement des vidéos Reels/Shorts depuis les produits trending
// en utilisant le service Remotion existant.
// Cycle : toutes les 4 heures, cible les produits avec forte vue récente.

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::state::AppState;

pub fn start_reels_auto_generator(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[ReelsGen] 🎬 Démarrage du worker génération Reels automatique");
        let mut ticker = interval(Duration::from_secs(14400)); // 4h

        loop {
            ticker.tick().await;
            if let Err(e) = run_cycle(&state).await {
                log::error!("[ReelsGen] Erreur cycle: {}", e);
            }
        }
    });
}

async fn run_cycle(state: &Arc<AppState>) -> Result<(), String> {
    use sqlx::Row;

    // 1. Trouver les produits populaires qui n'ont pas encore de Reel généré récemment
    let hot_products = sqlx::query(
        r#"
        SELECT DISTINCT
            sp.id AS product_id,
            sp.name AS product_name,
            sp.description,
            sp.price,
            sp.currency,
            sp.category,
            sp.image_urls,
            s.id AS service_id,
            s.user_id,
            s.name AS store_name,
            s.category AS store_category
        FROM service_products sp
        JOIN services s ON s.id = sp.service_id
        WHERE sp.is_active = true
          AND s.is_active = true
          AND sp.views_count >= 50
          AND NOT EXISTS (
            SELECT 1 FROM social_ai_posts sap
            WHERE sap.service_id = sp.service_id
              AND sap.platform = 'reels'
              AND sap.created_at >= NOW() - INTERVAL '24 hours'
          )
        ORDER BY sp.views_count DESC
        LIMIT 20
        "#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    if hot_products.is_empty() {
        return Ok(());
    }

    log::info!(
        "[ReelsGen] {} produits trending à transformer en Reels",
        hot_products.len()
    );

    for row in &hot_products {
        let product_id: i32 = row.try_get("product_id").unwrap_or(0);
        let product_name: String = row.try_get("product_name").unwrap_or_default();
        let service_id: i32 = row.try_get("service_id").unwrap_or(0);
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let store_name: String = row.try_get("store_name").unwrap_or_default();
        let price: Option<i64> = row.try_get("price").ok().flatten();

        // 2. Charger les préférences brand voice
        let prefs = sqlx::query(
            "SELECT tone, language FROM social_ai_preferences WHERE user_id = $1 AND service_id = $2",
        )
        .bind(user_id)
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let tone: String = prefs
            .as_ref()
            .and_then(|p| p.try_get::<String, _>("tone").ok())
            .unwrap_or_else(|| "energetic".to_string());

        let language: String = prefs
            .as_ref()
            .and_then(|p| p.try_get::<String, _>("language").ok())
            .unwrap_or_else(|| "fr".to_string());

        // 3. Générer le script/texte du Reel via GPT-4o
        let script =
            match generate_reel_script(&product_name, &store_name, price, &tone, &language).await {
                Ok(s) => s,
                Err(e) => {
                    log::warn!("[ReelsGen] Script échoué product={}: {}", product_id, e);
                    continue;
                }
            };

        // 4. Enregistrer le brouillon dans social_ai_posts (type reels, statut draft)
        let _ = sqlx::query(
            r#"
            INSERT INTO social_ai_posts
                (user_id, service_id, platform, content, status, metadata, created_at)
            VALUES ($1, $2, 'reels', $3, 'draft', $4, NOW())
            "#,
        )
        .bind(user_id)
        .bind(service_id)
        .bind(&script.caption)
        .bind(serde_json::json!({
            "product_id": product_id,
            "product_name": product_name,
            "reel_hook": script.hook,
            "reel_script": script.narration,
            "cta": script.cta,
            "hashtags": script.hashtags,
            "auto_generated": true,
        }))
        .execute(&state.pg)
        .await;

        // 5. Notifier le partenaire
        let notif_body = format!("Votre produit \"{}\" → Reel prêt à publier !", product_name);
        let _ = crate::services::push_notification_service::send_push_notification(
            &state.pg,
            user_id,
            "🎬 Nouveau Reel généré !".to_string(),
            notif_body.clone(),
            Some(serde_json::json!({
                "screen": "SocialAIDashboard",
                "service_id": service_id,
                "product_id": product_id,
            })),
            None,
        )
        .await;

        log::info!(
            "[ReelsGen] ✅ Reel brouillon créé pour product='{}' user={}",
            product_name,
            user_id
        );

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Ok(())
}

// ─── Génération script Reel via GPT-4o ───────────────────────────────────────

struct ReelScript {
    hook: String,      // accroche 1ère seconde
    narration: String, // script texte narration 15-30s
    caption: String,   // légende post
    cta: String,       // call to action
    hashtags: Vec<String>,
}

async fn generate_reel_script(
    product_name: &str,
    store_name: &str,
    price: Option<i64>,
    tone: &str,
    language: &str,
) -> Result<ReelScript, String> {
    let api_key = crate::services::yukpo_openai_outbound::resolve_openai_api_key()
        .ok_or("OPENAI_API_KEY manquante")?;

    let price_str = price
        .map(|p| format!("{} FCFA", p))
        .unwrap_or_else(|| "Prix attractif".to_string());

    let prompt = format!(
        r#"Tu es un expert créateur de contenus Reels/TikTok/Shorts pour e-commerce africain.

PRODUIT : "{}"
BOUTIQUE : {}
PRIX : {}
TON : {}
LANGUE : {}

Crée un script pour un Reel de 15-30 secondes très viral.

Réponds UNIQUEMENT en JSON :
{{"hook":"...","narration":"...","caption":"...","cta":"...","hashtags":["...","..."]}}"#,
        product_name, store_name, price_str, tone, language
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 600,
        "temperature": 0.8,
        "response_format": {"type": "json_object"}
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("[ReelsGen] GPT réseau: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = data["choices"][0]["message"]["content"].as_str().unwrap_or("{}");

    let parsed: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("[ReelsGen] JSON parse: {}", e))?;

    Ok(ReelScript {
        hook: parsed["hook"].as_str().unwrap_or("").to_string(),
        narration: parsed["narration"].as_str().unwrap_or("").to_string(),
        caption: parsed["caption"].as_str().unwrap_or("").to_string(),
        cta: parsed["cta"].as_str().unwrap_or("Commander maintenant !").to_string(),
        hashtags: parsed["hashtags"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|h| h.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default(),
    })
}
