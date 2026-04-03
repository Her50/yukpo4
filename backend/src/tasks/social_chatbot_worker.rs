// Worker chatbot social — traite la queue de messages entrants
// Pattern: FOR UPDATE SKIP LOCKED, retry 3x, délai réaliste avant réponse

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::services::social_chatbot_service::{
    self, persist_message, send_meta_response, IncomingMessage,
};
use crate::state::AppState;
use sqlx::Row;

pub fn start_social_chatbot_worker(state: Arc<AppState>) {
    tokio::spawn(async move {
        log::info!("[ChatbotWorker] 🤖 Démarrage du worker Community Manager IA");
        let mut ticker = interval(Duration::from_millis(2000)); // toutes les 2s
        loop {
            ticker.tick().await;
            if let Err(e) = process_pending_messages(&state).await {
                log::error!("[ChatbotWorker] Erreur: {}", e);
            }
        }
    });
}

async fn process_pending_messages(state: &Arc<AppState>) -> Result<(), String> {
    // Prendre jusqu'à 5 messages en attente (SKIP LOCKED = sécurisé multi-instance)
    let jobs = sqlx::query(
        r#"SELECT id, user_id, service_id, platform, external_sender_id,
                  sender_name, raw_message, raw_payload, page_id, attempt
           FROM social_chatbot_queue
           WHERE status = 'pending' AND attempt < 3
           ORDER BY created_at ASC
           LIMIT 5
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for job in &jobs {
        let job_id: i64 = job.try_get("id").unwrap_or(0);
        let job_user_id: i32 = job.try_get("user_id").unwrap_or(0);
        let job_service_id: i32 = job.try_get("service_id").unwrap_or(0);
        let job_platform: String = job.try_get("platform").unwrap_or_default();
        let job_external_sender_id: String = job.try_get("external_sender_id").unwrap_or_default();
        let job_sender_name: Option<String> = job.try_get("sender_name").ok().flatten();
        let job_raw_message: String = job.try_get("raw_message").unwrap_or_default();
        let job_raw_payload: serde_json::Value =
            job.try_get("raw_payload").unwrap_or(serde_json::Value::Null);
        let job_page_id: Option<String> = job.try_get("page_id").ok().flatten();
        let job_attempt: i32 = job.try_get("attempt").unwrap_or(0);

        // Marquer en processing
        let _ = sqlx::query(
            "UPDATE social_chatbot_queue SET status = 'processing', attempt = attempt + 1 WHERE id = $1",
        )
        .bind(job_id)
        .execute(&state.pg)
        .await;

        let msg = IncomingMessage {
            platform: job_platform.clone(),
            external_sender_id: job_external_sender_id.clone(),
            sender_name: job_sender_name.clone(),
            page_id: job_page_id.clone().unwrap_or_default(),
            text: job_raw_message.clone(),
            attachments: vec![],
        };

        // Persister le message entrant
        let _ = persist_message(
            &state.pg,
            job_user_id,
            job_service_id,
            &job_platform,
            &job_external_sender_id,
            job_sender_name.as_deref(),
            "inbound",
            "customer",
            &job_raw_message,
            job_raw_payload["mid"].as_str(),
            None,
        )
        .await;

        // Délai réaliste (simule que quelqu'un tape)
        tokio::time::sleep(Duration::from_millis(1500)).await;

        // Générer la réponse IA
        match social_chatbot_service::process_message(state, job_user_id, job_service_id, &msg)
            .await
        {
            Ok(response) => {
                let response_text = response.text.clone();
                let tokens = response.tokens_used;
                let should_escalate = response.should_escalate;
                let escalation_reason = response.escalation_reason.clone();

                // Envoyer la réponse via Meta
                let send_result = send_meta_response(
                    state,
                    job_user_id,
                    &job_platform,
                    &job_external_sender_id,
                    &job_page_id.clone().unwrap_or_default(),
                    &response,
                )
                .await;

                // Persister la réponse
                let _ = persist_message(
                    &state.pg,
                    job_user_id,
                    job_service_id,
                    &job_platform,
                    &job_external_sender_id,
                    None,
                    "outbound",
                    "bot",
                    &response_text,
                    send_result.as_deref().ok(),
                    Some(tokens),
                )
                .await;

                // Gérer l'escalade si nécessaire
                if should_escalate {
                    let _ = handle_escalation(
                        state,
                        job_user_id,
                        job_service_id,
                        &job_platform,
                        &job_external_sender_id,
                        &job_raw_message,
                        escalation_reason.as_deref(),
                    )
                    .await;
                }

                // Marquer job comme terminé
                let _ = sqlx::query(
                    "UPDATE social_chatbot_queue SET status = 'done', processed_at = NOW() WHERE id = $1",
                )
                .bind(job_id)
                .execute(&state.pg)
                .await;

                log::info!(
                    "[ChatbotWorker] ✅ Message {} traité — {} tokens, plateforme: {}",
                    job_id,
                    tokens,
                    job_platform
                );
            }
            Err(e) => {
                log::error!(
                    "[ChatbotWorker] ❌ Erreur traitement message {}: {}",
                    job_id,
                    e
                );

                let new_status = if job_attempt >= 2 {
                    "failed"
                } else {
                    "pending"
                };
                let _ = sqlx::query(
                    "UPDATE social_chatbot_queue SET status = $1, error = $2 WHERE id = $3",
                )
                .bind(new_status)
                .bind(&e)
                .bind(job_id)
                .execute(&state.pg)
                .await;
            }
        }
    }

    Ok(())
}

async fn handle_escalation(
    state: &Arc<AppState>,
    user_id: i32,
    service_id: i32,
    platform: &str,
    sender_id: &str,
    trigger_message: &str,
    reason: Option<&str>,
) -> Result<(), String> {
    // Mettre à jour le statut du thread
    let _ = sqlx::query(
        r#"UPDATE social_chatbot_threads
           SET status = 'escalated', escalation_reason = $1
           WHERE user_id = $2 AND platform = $3 AND external_sender_id = $4"#,
    )
    .bind(reason)
    .bind(user_id)
    .bind(platform)
    .bind(sender_id)
    .execute(&state.pg)
    .await;

    // Enregistrer l'événement d'escalade
    let thread_row = sqlx::query(
        "SELECT id FROM social_chatbot_threads WHERE user_id = $1 AND platform = $2 AND external_sender_id = $3",
    )
    .bind(user_id)
    .bind(platform)
    .bind(sender_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let thread_id: Option<i32> = thread_row.as_ref().and_then(|r| r.try_get("id").ok());

    if let Some(tid) = thread_id {
        let _ = sqlx::query(
            r#"INSERT INTO social_escalation_events
               (thread_id, user_id, reason, trigger_message)
               VALUES ($1, $2, $3, $4)"#,
        )
        .bind(tid)
        .bind(user_id)
        .bind(reason.unwrap_or("Escalade automatique"))
        .bind(trigger_message)
        .execute(&state.pg)
        .await;

        // Marquer comme escaladé dans l'inbox summary
        let _ = sqlx::query(
            "UPDATE social_inbox_summary SET is_escalated = true WHERE user_id = $1 AND thread_id = $2",
        )
        .bind(user_id)
        .bind(tid)
        .execute(&state.pg)
        .await;
    }

    // TODO: Notifier le partenaire (push notification / WhatsApp)
    log::warn!(
        "[ChatbotWorker] 🚨 Escalade pour user_id={} plateforme={}: {}",
        user_id,
        platform,
        reason.unwrap_or("raison inconnue")
    );

    Ok(())
}

/// Enregistre un message webhook entrant dans la queue (appelé depuis le controller webhook)
pub async fn enqueue_incoming_message(
    pg: &sqlx::PgPool,
    user_id: i32,
    service_id: i32,
    platform: &str,
    sender_id: &str,
    sender_name: Option<&str>,
    message: &str,
    page_id: Option<&str>,
    raw_payload: &serde_json::Value,
) -> Result<i64, String> {
    let row = sqlx::query(
        r#"INSERT INTO social_chatbot_queue
           (user_id, service_id, platform, external_sender_id, sender_name, raw_message, raw_payload, page_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id"#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(platform)
    .bind(sender_id)
    .bind(sender_name)
    .bind(message)
    .bind(raw_payload)
    .bind(page_id)
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;

    let id: i64 = row.try_get("id").map_err(|e| e.to_string())?;
    Ok(id)
}
