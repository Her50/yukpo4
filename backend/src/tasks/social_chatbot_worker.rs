// Worker chatbot social — traite la queue de messages entrants
// Pattern: FOR UPDATE SKIP LOCKED, retry 3x, délai réaliste avant réponse

use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::services::social_chatbot_service::{
    self, persist_message, send_meta_response, IncomingMessage,
};
use crate::state::AppState;

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
    let jobs = sqlx::query!(
        r#"SELECT id, user_id, service_id, platform, external_sender_id,
                  sender_name, raw_message, raw_payload, page_id
           FROM social_chatbot_queue
           WHERE status = 'pending' AND attempt < 3
           ORDER BY created_at ASC
           LIMIT 5
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&state.pg)
    .await
    .map_err(|e| e.to_string())?;

    for job in jobs {
        // Marquer en processing
        let _ = sqlx::query!(
            "UPDATE social_chatbot_queue SET status = 'processing', attempt = attempt + 1 WHERE id = $1",
            job.id
        )
        .execute(&state.pg)
        .await;

        let msg = IncomingMessage {
            platform: job.platform.clone(),
            external_sender_id: job.external_sender_id.clone(),
            sender_name: job.sender_name.clone(),
            page_id: job.page_id.clone().unwrap_or_default(),
            text: job.raw_message.clone(),
            attachments: vec![],
        };

        // Persister le message entrant
        let _ = persist_message(
            &state.pg,
            job.user_id,
            job.service_id,
            &job.platform,
            &job.external_sender_id,
            job.sender_name.as_deref(),
            "inbound",
            "customer",
            &job.raw_message,
            job.raw_payload["mid"].as_str(),
            None,
        )
        .await;

        // Délai réaliste (simule que quelqu'un tape)
        tokio::time::sleep(Duration::from_millis(1500)).await;

        // Générer la réponse IA
        match social_chatbot_service::process_message(state, job.user_id, job.service_id, &msg)
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
                    job.user_id,
                    &job.platform,
                    &job.external_sender_id,
                    &job.page_id.clone().unwrap_or_default(),
                    &response,
                )
                .await;

                // Persister la réponse
                let _ = persist_message(
                    &state.pg,
                    job.user_id,
                    job.service_id,
                    &job.platform,
                    &job.external_sender_id,
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
                        job.user_id,
                        job.service_id,
                        &job.platform,
                        &job.external_sender_id,
                        &job.raw_message,
                        escalation_reason.as_deref(),
                    )
                    .await;
                }

                // Marquer job comme terminé
                let _ = sqlx::query!(
                    "UPDATE social_chatbot_queue SET status = 'done', processed_at = NOW() WHERE id = $1",
                    job.id
                )
                .execute(&state.pg)
                .await;

                log::info!(
                    "[ChatbotWorker] ✅ Message {} traité — {} tokens, plateforme: {}",
                    job.id,
                    tokens,
                    job.platform
                );
            }
            Err(e) => {
                log::error!(
                    "[ChatbotWorker] ❌ Erreur traitement message {}: {}",
                    job.id,
                    e
                );

                let new_status = if job.attempt >= 2 {
                    "failed"
                } else {
                    "pending"
                };
                let _ = sqlx::query!(
                    "UPDATE social_chatbot_queue SET status = $1, error = $2 WHERE id = $3",
                    new_status,
                    e,
                    job.id
                )
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
    let _ = sqlx::query!(
        r#"UPDATE social_chatbot_threads
           SET status = 'escalated', escalation_reason = $1
           WHERE user_id = $2 AND platform = $3 AND external_sender_id = $4"#,
        reason,
        user_id,
        platform,
        sender_id,
    )
    .execute(&state.pg)
    .await;

    // Enregistrer l'événement d'escalade
    let thread_id: Option<i32> = sqlx::query_scalar!(
        "SELECT id FROM social_chatbot_threads WHERE user_id = $1 AND platform = $2 AND external_sender_id = $3",
        user_id, platform, sender_id,
    )
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    if let Some(tid) = thread_id {
        let _ = sqlx::query!(
            r#"INSERT INTO social_escalation_events
               (thread_id, user_id, reason, trigger_message)
               VALUES ($1, $2, $3, $4)"#,
            tid,
            user_id,
            reason.unwrap_or("Escalade automatique"),
            trigger_message,
        )
        .execute(&state.pg)
        .await;

        // Marquer comme escaladé dans l'inbox summary
        let _ = sqlx::query!(
            "UPDATE social_inbox_summary SET is_escalated = true WHERE user_id = $1 AND thread_id = $2",
            user_id, tid,
        )
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
    let row = sqlx::query!(
        r#"INSERT INTO social_chatbot_queue
           (user_id, service_id, platform, external_sender_id, sender_name, raw_message, raw_payload, page_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id"#,
        user_id, service_id, platform, sender_id, sender_name, message, raw_payload, page_id,
    )
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.id)
}
