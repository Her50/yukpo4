// Trend → Post Auto Worker — Yukpo
// Quand un topic atteint Opportunity Score > 80 + direction "rising",
// génère automatiquement un brouillon de post IA et notifie le partenaire.
// Fréquence : toutes les 2 heures (après chaque cycle de snapshots).

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::state::AppState;

pub fn start_trend_to_post_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[TrendToPost] 🚀 Démarrage du worker tendance → post auto");
        let mut ticker = interval(Duration::from_secs(7200)); // 2h

        loop {
            ticker.tick().await;
            if let Err(e) = run_cycle(&state).await {
                log::error!("[TrendToPost] Erreur cycle: {}", e);
            }
        }
    });
}

async fn run_cycle(state: &Arc<AppState>) -> Result<(), String> {
    use sqlx::Row;

    // 1. Trouver les tendances "rising" avec score > 80 calculées dans la dernière heure
    //    qui n'ont pas encore généré de brouillon aujourd'hui
    let hot_trends = sqlx::query(
        r#"SELECT f.region, f.topic, f.forecast_day3, f.confidence,
                  f.categories, sub.user_id, sub.min_opportunity_score
           FROM trend_forecasts f
           JOIN trend_webhook_subscriptions sub ON sub.region = f.region
           WHERE f.trend_direction = 'rising'
             AND f.forecast_day3 > sub.min_opportunity_score
             AND f.confidence > 0.6
             AND f.computed_at >= NOW() - INTERVAL '2 hours'
             AND NOT EXISTS (
               SELECT 1 FROM trend_auto_drafts tad
               WHERE tad.user_id = sub.user_id
                 AND tad.region = f.region
                 AND tad.topic = LOWER(f.topic)
                 AND tad.generated_at >= CURRENT_DATE
             )
           LIMIT 50"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    if hot_trends.is_empty() {
        return Ok(());
    }

    log::info!("[TrendToPost] {} tendances hot à traiter", hot_trends.len());

    for row in &hot_trends {
        let user_id: i32 = row.try_get("user_id").unwrap_or(0);
        let region: String = row.try_get("region").unwrap_or_default();
        let topic: String = row.try_get("topic").unwrap_or_default();
        let forecast: f64 = row.try_get::<f64, _>("forecast_day3").unwrap_or(0.0);

        // 2. Charger le service principal du partenaire
        let service_row = sqlx::query(
            "SELECT id, name, category FROM services WHERE user_id = $1 AND is_active = true ORDER BY id LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let (service_id, store_name, category) = match service_row {
            Some(r) => (
                r.try_get::<i32, _>("id").unwrap_or(0),
                r.try_get::<String, _>("name").unwrap_or_default(),
                r.try_get::<String, _>("category").unwrap_or_default(),
            ),
            None => continue,
        };

        // 3. Charger les préférences (langue, brand voice)
        let prefs_row = sqlx::query(
            "SELECT language, tone, brand_voice_summary FROM social_ai_preferences WHERE user_id = $1 AND service_id = $2",
        )
        .bind(user_id)
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .ok()
        .flatten();

        let (language, tone, brand_voice) = match prefs_row {
            Some(r) => (
                r.try_get::<String, _>("language").unwrap_or_else(|_| "fr".to_string()),
                r.try_get::<String, _>("tone").unwrap_or_else(|_| "professional".to_string()),
                r.try_get::<Option<String>, _>("brand_voice_summary").ok().flatten(),
            ),
            None => ("fr".to_string(), "professional".to_string(), None),
        };

        // 4. Générer le brouillon de post via GPT-4o
        let draft = match generate_trend_post_draft(
            &topic,
            &store_name,
            &category,
            &language,
            &tone,
            brand_voice.as_deref(),
            forecast,
        )
        .await
        {
            Ok(d) => d,
            Err(e) => {
                log::warn!("[TrendToPost] Génération échouée user={}: {}", user_id, e);
                continue;
            }
        };

        // 5. Sauvegarder le brouillon dans trend_auto_drafts
        let _ = sqlx::query(
            r#"INSERT INTO trend_auto_drafts
               (user_id, service_id, region, topic, opportunity_score, draft_caption,
                draft_instagram, draft_facebook, draft_tiktok, generated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())"#,
        )
        .bind(user_id)
        .bind(service_id)
        .bind(&region)
        .bind(&topic)
        .bind(forecast)
        .bind(&draft.caption)
        .bind(&draft.instagram)
        .bind(&draft.facebook)
        .bind(&draft.tiktok)
        .execute(&state.pg)
        .await;

        // 6. Envoyer une notification push au partenaire
        let notif_title = format!("🔥 Tendance à exploiter : {}", topic);
        let notif_body = format!(
            "Score : {:.0}/100 — Votre brouillon de post est prêt à publier !",
            forecast
        );

        let _ = crate::services::push_notification_service::send_push_to_user(
            &state.pg,
            user_id,
            &notif_title,
            &notif_body,
            Some(serde_json::json!({
                "screen": "TrendPulseDashboard",
                "topic": topic,
                "region": region,
                "has_draft": true
            })),
        )
        .await;

        log::info!(
            "[TrendToPost] ✅ Brouillon généré pour user={} topic='{}' score={:.0}",
            user_id,
            topic,
            forecast
        );

        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    Ok(())
}

// ─── Génération GPT-4o ────────────────────────────────────────────────────────

struct TrendPostDraft {
    caption: String,
    instagram: String,
    facebook: String,
    tiktok: String,
}

async fn generate_trend_post_draft(
    topic: &str,
    store_name: &str,
    category: &str,
    language: &str,
    tone: &str,
    brand_voice: Option<&str>,
    opportunity_score: f64,
) -> Result<TrendPostDraft, String> {
    let api_key = crate::services::yukpo_openai_outbound::resolve_openai_api_key()
        .ok_or("OPENAI_API_KEY manquante")?;

    let brand_voice_section = if let Some(bv) = brand_voice {
        format!("\n\nSTYLE DE LA MARQUE (respecter ABSOLUMENT) :\n{}", bv)
    } else {
        String::new()
    };

    let prompt = format!(
        r#"Tu es un expert community manager social media.

La tendance suivante est en forte hausse (score {:.0}/100) :
TOPIC TENDANCE : "{}"
SECTEUR DU PARTENAIRE : {}
NOM DE LA BOUTIQUE : {}
LANGUE : {}
TON : {}
{}

Génère 4 variantes de posts pour exploiter cette tendance maintenant :

1. CAPTION (post générique polyvalent, 150 mots max)
2. INSTAGRAM (visuel-first, 3-5 emojis, 5-8 hashtags pertinents, 120 mots max)
3. FACEBOOK (plus long, conversationnel, appel à l'action clair, 200 mots max)
4. TIKTOK (accroche FORTE en 1ère ligne, ton énergique, sons/hashtags viraux, 100 mots max)

Chaque post doit :
- Lier naturellement la tendance aux produits/services de la boutique
- Inciter à commander sur Yukpo
- Être adapté à la langue et au contexte culturel local

Réponds UNIQUEMENT en JSON valide :
{{"caption":"...","instagram":"...","facebook":"...","tiktok":"..."}}"#,
        opportunity_score, topic, category, store_name, language, tone, brand_voice_section
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1200,
        "temperature": 0.75,
        "response_format": {"type": "json_object"}
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .timeout(std::time::Duration::from_secs(25))
        .send()
        .await
        .map_err(|e| format!("[TrendToPost] GPT réseau: {}", e))?;

    if !resp.status().is_success() {
        let txt = resp.text().await.unwrap_or_default();
        return Err(format!("[TrendToPost] GPT erreur: {}", txt));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = data["choices"][0]["message"]["content"].as_str().unwrap_or("{}");

    let parsed: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("[TrendToPost] JSON parse: {}", e))?;

    Ok(TrendPostDraft {
        caption: parsed["caption"].as_str().unwrap_or("").to_string(),
        instagram: parsed["instagram"].as_str().unwrap_or("").to_string(),
        facebook: parsed["facebook"].as_str().unwrap_or("").to_string(),
        tiktok: parsed["tiktok"].as_str().unwrap_or("").to_string(),
    })
}
