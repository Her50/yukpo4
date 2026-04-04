// social_ai_growth.rs
// Fonctionnalités de croissance Yukpo :
// - Envoi réel campagnes email (SendGrid)
// - WhatsApp broadcast catalogue
// - Abandoned cart recovery (relance achat non converti)
// - Analytics export CSV

use axum::{
    extract::{Path, Query, State},
    http::header,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::{
    core::types::{AppError, AppResult},
    middlewares::jwt::AuthenticatedUser,
    services::email_service::{EmailContent, EmailService},
    state::AppState,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL — Envoi réel de campagne (SendGrid)
// ═══════════════════════════════════════════════════════════════════════════════

/// POST /api/social-ai/email/campaigns/:id/send
/// Envoie la campagne à tous les clients avec email + consentement
pub async fn send_email_campaign(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(campaign_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    // 1. Charger la campagne
    let campaign = sqlx::query(
        r#"SELECT id, service_id, name, subject, content_text, content_html, status, target_segment
           FROM email_campaigns
           WHERE id = $1 AND user_id = $2"#,
    )
    .bind(campaign_id)
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| AppError::NotFound("Campagne introuvable".to_string()))?;

    let status = campaign.try_get::<String, _>("status").unwrap_or_default();
    if status == "sent" || status == "sending" {
        return Ok(Json(serde_json::json!({
            "error": "Campagne déjà envoyée ou en cours"
        })));
    }

    let service_id: i32 = campaign.try_get("service_id").unwrap_or(0);
    let subject: String = campaign.try_get("subject").unwrap_or_default();
    let content_text: String = campaign.try_get("content_text").unwrap_or_default();
    let content_html: Option<String> = campaign.try_get("content_html").unwrap_or(None);
    let segment: String = campaign.try_get("target_segment").unwrap_or_else(|_| "all".to_string());

    // Marquer comme "sending"
    let _ = sqlx::query(
        "UPDATE email_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1",
    )
    .bind(campaign_id)
    .execute(&state.pg)
    .await;

    // 2. Récupérer les destinataires selon le segment
    let segment_filter = match segment.as_str() {
        "vip" => "AND is_vip = TRUE",
        "high_value" => "AND total_spent_fcfa > 10000",
        "active_7d" => "AND last_seen_at >= NOW() - INTERVAL '7 days'",
        "active_30d" => "AND last_seen_at >= NOW() - INTERVAL '30 days'",
        _ => "",
    };

    let sql = format!(
        r#"SELECT customer_email, customer_name
           FROM customer_memory
           WHERE user_id = $1 AND service_id = $2
             AND customer_email IS NOT NULL
             AND email_consent = TRUE
             AND unsubscribed_email = FALSE
           {}
           LIMIT 2000"#,
        segment_filter
    );

    let recipients = sqlx::query(&sql)
        .bind(user.id)
        .bind(service_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

    if recipients.is_empty() {
        let _ = sqlx::query(
            "UPDATE email_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1",
        )
        .bind(campaign_id)
        .execute(&state.pg)
        .await;

        return Ok(Json(serde_json::json!({
            "sent": 0,
            "failed": 0,
            "warning": "Aucun destinataire avec email + consentement. \
                       Importez des contacts ou collectez les emails via le chatbot.",
            "status": "draft"
        })));
    }

    // 3. Envoyer via SendGrid
    let email_svc = EmailService::new();
    let mut sent = 0i32;
    let mut failed = 0i32;

    for r in &recipients {
        let to: String = r.try_get("customer_email").unwrap_or_default();
        if to.is_empty() {
            continue;
        }
        let result = email_svc
            .send_email(EmailContent {
                to: to.clone(),
                subject: subject.clone(),
                text: Some(content_text.clone()),
                html: content_html.clone(),
            })
            .await;

        match result {
            Ok(res) if res.success => sent += 1,
            _ => failed += 1,
        }
    }

    // 4. Mise à jour stats
    let final_status = if failed == 0 { "sent" } else { "sent" }; // sent même si partial
    let _ = sqlx::query(
        r#"UPDATE email_campaigns
           SET status = $2, sent_count = $3, recipient_count = $4,
               sent_at = NOW(), updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(campaign_id)
    .bind(final_status)
    .bind(sent)
    .bind(sent + failed)
    .execute(&state.pg)
    .await;

    Ok(Json(serde_json::json!({
        "campaign_id": campaign_id,
        "status": final_status,
        "sent": sent,
        "failed": failed,
        "total_recipients": sent + failed,
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP BROADCAST — Envoyer catalogue/message à tous les clients
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CreateBroadcastRequest {
    pub service_id: i32,
    pub name: String,
    pub message_text: String,
    pub target_segment: Option<String>,
    pub include_catalog: Option<bool>,
}

/// POST /api/social-ai/whatsapp/broadcasts
pub async fn create_whatsapp_broadcast(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateBroadcastRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    // Charger le compte WhatsApp du service
    let wa_account = sqlx::query(
        r#"SELECT metadata->>'phone_number_id' AS phone_id,
                  metadata->>'access_token' AS access_token
           FROM social_accounts
           WHERE user_id = $1 AND platform = 'whatsapp'
           LIMIT 1"#,
    )
    .bind(user.id)
    .fetch_optional(&state.pg)
    .await?;

    let (phone_id, wa_token) = if let Some(ref acc) = wa_account {
        let pid = acc.try_get::<Option<String>, _>("phone_id").ok().flatten().unwrap_or_default();
        let tok = acc
            .try_get::<Option<String>, _>("access_token")
            .ok()
            .flatten()
            .unwrap_or_default();
        (pid, tok)
    } else {
        // Fallback env vars
        (
            std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_default(),
            std::env::var("WHATSAPP_ACCESS_TOKEN").unwrap_or_default(),
        )
    };

    // Récupérer les destinataires
    let segment = payload.target_segment.as_deref().unwrap_or("all");
    let segment_filter = match segment {
        "vip" => "AND cm.is_vip = TRUE",
        "high_value" => "AND cm.total_spent_fcfa > 10000",
        "active_7d" => "AND cm.last_seen_at >= NOW() - INTERVAL '7 days'",
        "active_30d" => "AND cm.last_seen_at >= NOW() - INTERVAL '30 days'",
        _ => "",
    };

    let sql = format!(
        r#"SELECT cm.customer_external_id, cm.customer_name
           FROM customer_memory cm
           WHERE cm.user_id = $1 AND cm.service_id = $2
             AND cm.platform = 'whatsapp'
             AND cm.unsubscribed_wa = FALSE
           {}
           LIMIT 1000"#,
        segment_filter
    );

    let recipients = sqlx::query(&sql)
        .bind(user.id)
        .bind(payload.service_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

    let total = recipients.len() as i32;

    // Créer l'enregistrement broadcast
    let broadcast_id: i32 = sqlx::query_scalar(
        r#"INSERT INTO whatsapp_broadcasts
               (service_id, user_id, name, message_text, target_segment, status, total_recipients)
           VALUES ($1, $2, $3, $4, $5, 'sending', $6)
           RETURNING id"#,
    )
    .bind(payload.service_id)
    .bind(user.id)
    .bind(&payload.name)
    .bind(&payload.message_text)
    .bind(segment)
    .bind(total)
    .fetch_one(&state.pg)
    .await?;

    if phone_id.is_empty() || wa_token.is_empty() {
        // Sans token WA réel, on simule l'envoi (mode démo)
        let _ = sqlx::query(
            r#"UPDATE whatsapp_broadcasts
               SET status = 'sent', sent_count = $2, sent_at = NOW()
               WHERE id = $1"#,
        )
        .bind(broadcast_id)
        .bind(total)
        .execute(&state.pg)
        .await;

        return Ok(Json(serde_json::json!({
            "broadcast_id": broadcast_id,
            "mode": "simulation",
            "note": "Connectez un compte WhatsApp Business pour l'envoi réel",
            "total_recipients": total,
            "status": "sent",
        })));
    }

    // Envoi réel via WhatsApp Cloud API
    let client = reqwest::Client::new();
    let api_url = format!("https://graph.facebook.com/v20.0/{}/messages", phone_id);
    let mut sent = 0i32;
    let mut failed = 0i32;

    for r in &recipients {
        let phone = r.try_get::<String, _>("customer_external_id").unwrap_or_default();
        if phone.is_empty() {
            continue;
        }
        // Normaliser le numéro (retirer + et espaces)
        let phone_clean = phone.replace('+', "").replace(' ', "");

        let body = serde_json::json!({
            "messaging_product": "whatsapp",
            "to": phone_clean,
            "type": "text",
            "text": { "body": payload.message_text }
        });

        let res = client.post(&api_url).bearer_auth(&wa_token).json(&body).send().await;

        match res {
            Ok(r) if r.status().is_success() => sent += 1,
            _ => failed += 1,
        }

        // Throttle : max 80 messages/sec WhatsApp Cloud API
        if (sent + failed) % 80 == 0 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }

    let _ = sqlx::query(
        r#"UPDATE whatsapp_broadcasts
           SET status = 'sent', sent_count = $2, failed_count = $3, sent_at = NOW()
           WHERE id = $1"#,
    )
    .bind(broadcast_id)
    .bind(sent)
    .bind(failed)
    .execute(&state.pg)
    .await;

    Ok(Json(serde_json::json!({
        "broadcast_id": broadcast_id,
        "status": "sent",
        "sent": sent,
        "failed": failed,
        "total_recipients": total,
    })))
}

/// GET /api/social-ai/whatsapp/broadcasts/:service_id
pub async fn list_whatsapp_broadcasts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT id, name, message_text, status, target_segment,
                  total_recipients, sent_count, failed_count, created_at, sent_at
           FROM whatsapp_broadcasts
           WHERE service_id = $1 AND user_id = $2
           ORDER BY created_at DESC LIMIT 30"#,
    )
    .bind(service_id)
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let broadcasts: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let total = r.try_get::<i32,_>("total_recipients").unwrap_or(0);
            let sent = r.try_get::<i32,_>("sent_count").unwrap_or(0);
            let delivery_rate = if total > 0 { sent * 100 / total } else { 0 };
            serde_json::json!({
                "id": r.try_get::<i32,_>("id").unwrap_or(0),
                "name": r.try_get::<String,_>("name").unwrap_or_default(),
                "message_preview": r.try_get::<String,_>("message_text").unwrap_or_default().chars().take(80).collect::<String>(),
                "status": r.try_get::<String,_>("status").unwrap_or_default(),
                "segment": r.try_get::<String,_>("target_segment").unwrap_or_default(),
                "total_recipients": total,
                "sent_count": sent,
                "failed_count": r.try_get::<i32,_>("failed_count").unwrap_or(0),
                "delivery_rate": delivery_rate,
                "created_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("created_at").unwrap_or(None),
                "sent_at": r.try_get::<Option<chrono::DateTime<chrono::Utc>>,_>("sent_at").unwrap_or(None),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "broadcasts": broadcasts })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABANDONED CART RECOVERY — Relance automatique achat non converti
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct TriggerRecoveryRequest {
    pub service_id: i32,
    pub delay_hours: Option<i32>,
}

/// POST /api/social-ai/crm/abandoned-cart/detect
/// Détecte les clients avec intent achat non converti et programme une relance
pub async fn detect_abandoned_carts(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<TriggerRecoveryRequest>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    let delay_hours = payload.delay_hours.unwrap_or(24);

    // Clients avec dernier_intent = purchase/order ET pas de commande récente
    let rows = sqlx::query(
        r#"SELECT cm.customer_external_id, cm.platform, cm.customer_name,
                  cm.last_intent, cm.preferred_products
           FROM customer_memory cm
           WHERE cm.user_id = $1 AND cm.service_id = $2
             AND cm.last_intent IN ('purchase_intent', 'order_inquiry', 'price_check', 'product_question')
             AND cm.last_seen_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '2 hours'
             AND cm.follow_up_needed = FALSE
             AND NOT EXISTS (
               SELECT 1 FROM abandoned_cart_jobs acj
               WHERE acj.user_id = $1 AND acj.service_id = $2
                 AND acj.customer_external_id = cm.customer_external_id
                 AND acj.status = 'pending'
                 AND acj.created_at > NOW() - INTERVAL '48 hours'
             )
           LIMIT 200"#,
    )
    .bind(user.id)
    .bind(payload.service_id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let mut created = 0i32;

    for r in &rows {
        let external_id: String = r.try_get("customer_external_id").unwrap_or_default();
        let platform: String = r.try_get("platform").unwrap_or_default();
        let product_hint: Option<Vec<String>> = r.try_get("preferred_products").ok().flatten();
        let hint_text = product_hint.as_ref().and_then(|v| v.first()).cloned();

        let recovery_msg = if let Some(ref product) = hint_text {
            format!(
                "Bonjour 😊 Vous avez regardé \"{}\" tout à l'heure. \
                 Il est encore disponible ! Tapez \"commander\" pour finaliser votre achat. 🛍️",
                product
            )
        } else {
            "Bonjour 😊 Vous avez regardé nos produits tout à l'heure. \
             Avez-vous trouvé ce que vous cherchez ? Je suis là pour vous aider ! 🛍️"
                .to_string()
        };

        let _ = sqlx::query(
            r#"INSERT INTO abandoned_cart_jobs
                   (service_id, user_id, customer_external_id, platform,
                    product_hint, recovery_message,
                    scheduled_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW() + $7 * INTERVAL '1 hour')"#,
        )
        .bind(payload.service_id)
        .bind(user.id)
        .bind(&external_id)
        .bind(&platform)
        .bind(&hint_text)
        .bind(&recovery_msg)
        .bind(delay_hours)
        .execute(&state.pg)
        .await;

        created += 1;
    }

    Ok(Json(serde_json::json!({
        "abandoned_carts_detected": rows.len(),
        "recovery_jobs_created": created,
        "scheduled_in_hours": delay_hours,
        "message": format!("{} relances programmées dans {}h", created, delay_hours),
    })))
}

/// POST /api/social-ai/crm/abandoned-cart/process
/// Exécute les relances programmées (appel cron ou manuel)
pub async fn process_abandoned_cart_jobs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    use sqlx::Row;

    // Jobs prêts à envoyer
    let jobs = sqlx::query(
        r#"SELECT acj.id, acj.service_id, acj.customer_external_id,
                  acj.platform, acj.recovery_message,
                  sa.metadata->>'phone_number_id' AS phone_id,
                  sa.metadata->>'access_token' AS wa_token
           FROM abandoned_cart_jobs acj
           LEFT JOIN social_accounts sa
             ON sa.user_id = acj.user_id AND sa.platform = 'whatsapp'
           WHERE acj.user_id = $1
             AND acj.status = 'pending'
             AND acj.scheduled_at <= NOW()
           LIMIT 50"#,
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await
    .unwrap_or_default();

    let client = reqwest::Client::new();
    let mut sent = 0i32;
    let mut failed = 0i32;

    for job in &jobs {
        let job_id: i32 = job.try_get("id").unwrap_or(0);
        let phone = job.try_get::<String, _>("customer_external_id").unwrap_or_default();
        let message = job.try_get::<String, _>("recovery_message").unwrap_or_default();
        let phone_id = job
            .try_get::<Option<String>, _>("phone_id")
            .ok()
            .flatten()
            .unwrap_or_else(|| std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_default());
        let wa_token = job
            .try_get::<Option<String>, _>("wa_token")
            .ok()
            .flatten()
            .unwrap_or_else(|| std::env::var("WHATSAPP_ACCESS_TOKEN").unwrap_or_default());

        let success = if !phone_id.is_empty() && !wa_token.is_empty() {
            let body = serde_json::json!({
                "messaging_product": "whatsapp",
                "to": phone.replace('+', "").replace(' ', ""),
                "type": "text",
                "text": { "body": message }
            });
            let url = format!("https://graph.facebook.com/v20.0/{}/messages", phone_id);
            client
                .post(&url)
                .bearer_auth(&wa_token)
                .json(&body)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false)
        } else {
            // Mode simulation si pas de token WA
            log::info!(
                "[AbandonedCart] Simulation envoi WA → {}: {}",
                phone,
                &message[..50.min(message.len())]
            );
            true
        };

        if success {
            sent += 1;
            let _ = sqlx::query(
                "UPDATE abandoned_cart_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1",
            )
            .bind(job_id)
            .execute(&state.pg)
            .await;
        } else {
            failed += 1;
            let _ = sqlx::query("UPDATE abandoned_cart_jobs SET status = 'expired' WHERE id = $1")
                .bind(job_id)
                .execute(&state.pg)
                .await;
        }
    }

    Ok(Json(serde_json::json!({
        "jobs_processed": jobs.len(),
        "sent": sent,
        "failed": failed,
    })))
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS EXPORT CSV
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
pub struct ExportQuery {
    pub export_type: Option<String>, // full | posts | customers | campaigns
}

/// GET /api/social-ai/analytics/export/:service_id
/// Génère et retourne un CSV de toutes les données analytics
pub async fn export_analytics_csv(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
    Query(params): Query<ExportQuery>,
) -> impl IntoResponse {
    use sqlx::Row;

    let export_type = params.export_type.as_deref().unwrap_or("full");
    let mut csv = String::new();

    match export_type {
        "posts" | "full" => {
            // Posts analytics
            csv.push_str("Type,Plateforme,Contenu,Likes,Commentaires,Partages,Portée,Date\n");
            let rows = sqlx::query(
                r#"SELECT p.platform, LEFT(p.content, 100) AS content,
                          COALESCE(a.likes_count, 0) AS likes,
                          COALESCE(a.comments_count, 0) AS comments,
                          COALESCE(a.shares_count, 0) AS shares,
                          COALESCE(a.reach, 0) AS reach,
                          p.created_at
                   FROM social_ai_posts p
                   LEFT JOIN social_ai_post_analytics a ON a.post_id = p.id
                   WHERE p.service_id = $1
                   ORDER BY p.created_at DESC
                   LIMIT 500"#,
            )
            .bind(service_id)
            .fetch_all(&state.pg)
            .await
            .unwrap_or_default();

            for r in &rows {
                let content =
                    r.try_get::<String, _>("content").unwrap_or_default().replace('"', "'");
                csv.push_str(&format!(
                    "Post,{},\"{}\",{},{},{},{},{}\n",
                    r.try_get::<String, _>("platform").unwrap_or_default(),
                    content,
                    r.try_get::<i32, _>("likes").unwrap_or(0),
                    r.try_get::<i32, _>("comments").unwrap_or(0),
                    r.try_get::<i32, _>("shares").unwrap_or(0),
                    r.try_get::<i32, _>("reach").unwrap_or(0),
                    r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                        .unwrap_or(None)
                        .map(|d| d.format("%Y-%m-%d").to_string())
                        .unwrap_or_default(),
                ));
            }

            if export_type == "full" {
                csv.push('\n');
            }
        }
        _ => {}
    }

    if export_type == "customers" || export_type == "full" {
        csv.push_str("Nom,Plateforme,Commandes,CA_FCFA,Sentiment,VIP,Derniere_Vue\n");
        let rows = sqlx::query(
            r#"SELECT customer_name, platform, total_orders, total_spent_fcfa,
                      sentiment_overall, is_vip, last_seen_at
               FROM customer_memory
               WHERE user_id = $1 AND service_id = $2
               ORDER BY total_spent_fcfa DESC
               LIMIT 1000"#,
        )
        .bind(user.id)
        .bind(service_id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for r in &rows {
            let name = r
                .try_get::<Option<String>, _>("customer_name")
                .unwrap_or(None)
                .unwrap_or_else(|| "Anonyme".to_string())
                .replace('"', "'");
            csv.push_str(&format!(
                "\"{}\",{},{},{},{},{},{}\n",
                name,
                r.try_get::<String, _>("platform").unwrap_or_default(),
                r.try_get::<i32, _>("total_orders").unwrap_or(0),
                r.try_get::<i64, _>("total_spent_fcfa").unwrap_or(0),
                r.try_get::<Option<String>, _>("sentiment_overall")
                    .unwrap_or(None)
                    .unwrap_or_else(|| "neutre".to_string()),
                if r.try_get::<bool, _>("is_vip").unwrap_or(false) {
                    "OUI"
                } else {
                    "NON"
                },
                r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_seen_at")
                    .unwrap_or(None)
                    .map(|d| d.format("%Y-%m-%d").to_string())
                    .unwrap_or_default(),
            ));
        }
    }

    if export_type == "campaigns" || export_type == "full" {
        if export_type == "full" {
            csv.push('\n');
        }
        csv.push_str(
            "Nom,Objet,Statut,Segment,Destinataires,Envoyes,Taux_Ouverture%,Taux_Clic%,Date\n",
        );
        let rows = sqlx::query(
            r#"SELECT name, subject, status, target_segment, recipient_count,
                      sent_count, open_count, click_count, created_at
               FROM email_campaigns
               WHERE service_id = $1 AND user_id = $2
               ORDER BY created_at DESC LIMIT 100"#,
        )
        .bind(service_id)
        .bind(user.id)
        .fetch_all(&state.pg)
        .await
        .unwrap_or_default();

        for r in &rows {
            let sent = r.try_get::<i32, _>("sent_count").unwrap_or(0);
            let opens = r.try_get::<i32, _>("open_count").unwrap_or(0);
            let clicks = r.try_get::<i32, _>("click_count").unwrap_or(0);
            let open_rate = if sent > 0 { opens * 100 / sent } else { 0 };
            let click_rate = if sent > 0 { clicks * 100 / sent } else { 0 };
            csv.push_str(&format!(
                "\"{}\",\"{}\",{},{},{},{},{},{},{}\n",
                r.try_get::<String, _>("name").unwrap_or_default().replace('"', "'"),
                r.try_get::<String, _>("subject").unwrap_or_default().replace('"', "'"),
                r.try_get::<String, _>("status").unwrap_or_default(),
                r.try_get::<String, _>("target_segment").unwrap_or_default(),
                r.try_get::<i32, _>("recipient_count").unwrap_or(0),
                sent,
                open_rate,
                click_rate,
                r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("created_at")
                    .unwrap_or(None)
                    .map(|d| d.format("%Y-%m-%d").to_string())
                    .unwrap_or_default(),
            ));
        }
    }

    let filename = format!("yukpo_analytics_{}_service_{}.csv", export_type, service_id);

    (
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                Box::leak(format!("attachment; filename=\"{}\"", filename).into_boxed_str()),
            ),
        ],
        csv,
    )
        .into_response()
}
