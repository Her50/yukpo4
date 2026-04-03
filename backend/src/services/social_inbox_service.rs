// Inbox unifiée — gestion des conversations multi-plateformes
// Lecture threads, marquage lu, escalade, notes, réponse humaine

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Serialize, Deserialize)]
pub struct InboxThread {
    pub id: i32,
    pub thread_id: i32,
    pub platform: String,
    pub sender_name: Option<String>,
    pub last_message_preview: Option<String>,
    pub last_message_at: Option<chrono::DateTime<chrono::Utc>>,
    pub unread_count: i32,
    pub is_escalated: bool,
    pub is_starred: bool,
    pub label: Option<String>,
    pub status: String,
    pub total_messages: i32,
    pub bot_messages: i32,
    pub sentiment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationDetail {
    pub thread: InboxThread,
    pub messages: Vec<MessageItem>,
    pub notes: Vec<NoteItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageItem {
    pub id: i64,
    pub direction: String,
    pub sender_type: String,
    pub content: String,
    pub content_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub is_read: bool,
    pub ai_tokens_used: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteItem {
    pub id: i32,
    pub note: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InboxStats {
    pub total_conversations: i64,
    pub unread_conversations: i64,
    pub escalated: i64,
    pub bot_handled_today: i64,
    pub avg_response_time_ms: Option<i64>,
    pub by_platform: Vec<PlatformInboxStat>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformInboxStat {
    pub platform: String,
    pub total: i64,
    pub unread: i64,
    pub escalated: i64,
}

/// Charge la liste des threads de l'inbox (avec pagination)
pub async fn list_inbox_threads(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    filter: &str, // all, unread, escalated, starred
    platform: Option<&str>,
    page: i32,
    limit: i32,
) -> Result<Vec<InboxThread>, String> {
    let offset = (page - 1) * limit;

    let rows = sqlx::query!(
        r#"SELECT s.id, s.thread_id, s.platform, s.sender_name,
                  s.last_message_preview, s.last_message_at,
                  s.unread_count, s.is_escalated, s.is_starred, s.label,
                  t.status, t.total_messages, t.bot_messages, t.sentiment
           FROM social_inbox_summary s
           JOIN social_chatbot_threads t ON t.id = s.thread_id
           WHERE s.user_id = $1 AND s.service_id = $2
             AND ($3 = 'all'
                  OR ($3 = 'unread' AND s.unread_count > 0)
                  OR ($3 = 'escalated' AND s.is_escalated = true)
                  OR ($3 = 'starred' AND s.is_starred = true))
             AND ($4::TEXT IS NULL OR s.platform = $4)
           ORDER BY
             CASE WHEN s.is_escalated THEN 0 ELSE 1 END,
             s.last_message_at DESC NULLS LAST
           LIMIT $5 OFFSET $6"#,
        user_id,
        service_id,
        filter,
        platform,
        limit as i64,
        offset as i64,
    )
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| InboxThread {
            id: r.id,
            thread_id: r.thread_id,
            platform: r.platform,
            sender_name: r.sender_name,
            last_message_preview: r.last_message_preview,
            last_message_at: r.last_message_at,
            unread_count: r.unread_count,
            is_escalated: r.is_escalated,
            is_starred: r.is_starred,
            label: r.label,
            status: r.status,
            total_messages: r.total_messages,
            bot_messages: r.bot_messages,
            sentiment: r.sentiment,
        })
        .collect())
}

/// Charge une conversation complète avec tous ses messages
pub async fn get_conversation_detail(
    pg: &PgPool,
    user_id: i32,
    thread_id: i32,
) -> Result<ConversationDetail, String> {
    // Vérifier appartenance
    let summary = sqlx::query!(
        r#"SELECT s.id, s.platform, s.sender_name, s.last_message_preview,
                  s.last_message_at, s.unread_count, s.is_escalated, s.is_starred, s.label,
                  t.status, t.total_messages, t.bot_messages, t.sentiment, t.service_id
           FROM social_inbox_summary s
           JOIN social_chatbot_threads t ON t.id = s.thread_id
           WHERE s.user_id = $1 AND s.thread_id = $2"#,
        user_id,
        thread_id,
    )
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Thread non trouvé")?;

    let thread = InboxThread {
        id: summary.id,
        thread_id,
        platform: summary.platform,
        sender_name: summary.sender_name,
        last_message_preview: summary.last_message_preview,
        last_message_at: summary.last_message_at,
        unread_count: summary.unread_count,
        is_escalated: summary.is_escalated,
        is_starred: summary.is_starred,
        label: summary.label,
        status: summary.status,
        total_messages: summary.total_messages,
        bot_messages: summary.bot_messages,
        sentiment: summary.sentiment,
    };

    // Messages
    let messages = sqlx::query!(
        r#"SELECT id, direction, sender_type, content, content_type,
                  created_at, is_read, ai_tokens_used
           FROM social_chatbot_messages
           WHERE thread_id = $1
           ORDER BY created_at ASC
           LIMIT 100"#,
        thread_id,
    )
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|r| MessageItem {
        id: r.id,
        direction: r.direction,
        sender_type: r.sender_type,
        content: r.content,
        content_type: r.content_type,
        created_at: r.created_at,
        is_read: r.is_read,
        ai_tokens_used: r.ai_tokens_used,
    })
    .collect();

    // Notes internes
    let notes = sqlx::query!(
        "SELECT id, note, created_at FROM social_inbox_notes WHERE thread_id = $1 ORDER BY created_at ASC",
        thread_id,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| NoteItem { id: r.id, note: r.note, created_at: r.created_at })
    .collect();

    // Marquer comme lu
    let _ = mark_thread_as_read(pg, user_id, thread_id).await;

    Ok(ConversationDetail {
        thread,
        messages,
        notes,
    })
}

/// Marque tous les messages d'un thread comme lus
pub async fn mark_thread_as_read(pg: &PgPool, user_id: i32, thread_id: i32) -> Result<(), String> {
    let _ = sqlx::query!(
        "UPDATE social_chatbot_messages SET is_read = true WHERE thread_id = $1",
        thread_id,
    )
    .execute(pg)
    .await;

    let _ = sqlx::query!(
        "UPDATE social_inbox_summary SET unread_count = 0 WHERE user_id = $1 AND thread_id = $2",
        user_id,
        thread_id,
    )
    .execute(pg)
    .await;

    Ok(())
}

/// Escalade manuellement un thread vers un agent humain
pub async fn escalate_thread(
    pg: &PgPool,
    user_id: i32,
    thread_id: i32,
    reason: &str,
) -> Result<(), String> {
    let _ = sqlx::query!(
        "UPDATE social_chatbot_threads SET status = 'escalated', escalation_reason = $1 WHERE id = $2 AND user_id = $3",
        reason, thread_id, user_id,
    )
    .execute(pg)
    .await
    .map_err(|e| e.to_string())?;

    let _ = sqlx::query!(
        "UPDATE social_inbox_summary SET is_escalated = true WHERE user_id = $1 AND thread_id = $2",
        user_id,
        thread_id,
    )
    .execute(pg)
    .await;

    let _ = sqlx::query!(
        "INSERT INTO social_escalation_events (thread_id, user_id, reason) VALUES ($1, $2, $3)",
        thread_id,
        user_id,
        reason,
    )
    .execute(pg)
    .await;

    Ok(())
}

/// Résout une escalade
pub async fn resolve_escalation(
    pg: &PgPool,
    user_id: i32,
    thread_id: i32,
    resolved_by: i32,
) -> Result<(), String> {
    let _ = sqlx::query!(
        "UPDATE social_chatbot_threads SET status = 'bot' WHERE id = $1 AND user_id = $2",
        thread_id,
        user_id,
    )
    .execute(pg)
    .await;

    let _ = sqlx::query!(
        "UPDATE social_inbox_summary SET is_escalated = false WHERE user_id = $1 AND thread_id = $2",
        user_id, thread_id,
    )
    .execute(pg)
    .await;

    let _ = sqlx::query!(
        r#"UPDATE social_escalation_events
           SET resolved_at = NOW(), resolved_by = $1
           WHERE thread_id = $2 AND resolved_at IS NULL"#,
        resolved_by,
        thread_id,
    )
    .execute(pg)
    .await;

    Ok(())
}

/// Ajoute une note interne sur un thread
pub async fn add_note(
    pg: &PgPool,
    thread_id: i32,
    author_id: i32,
    note: &str,
) -> Result<i32, String> {
    let row = sqlx::query!(
        "INSERT INTO social_inbox_notes (thread_id, author_id, note) VALUES ($1, $2, $3) RETURNING id",
        thread_id, author_id, note,
    )
    .fetch_one(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.id)
}

/// Toggle étoile d'un thread
pub async fn toggle_star(pg: &PgPool, user_id: i32, thread_id: i32) -> Result<bool, String> {
    let row = sqlx::query!(
        r#"UPDATE social_inbox_summary
           SET is_starred = NOT is_starred
           WHERE user_id = $1 AND thread_id = $2
           RETURNING is_starred"#,
        user_id,
        thread_id,
    )
    .fetch_optional(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| r.is_starred).unwrap_or(false))
}

/// Charge les statistiques globales de l'inbox
pub async fn get_inbox_stats(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
) -> Result<InboxStats, String> {
    let total: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM social_inbox_summary WHERE user_id = $1 AND service_id = $2",
        user_id,
        service_id,
    )
    .fetch_one(pg)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    let unread: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM social_inbox_summary WHERE user_id = $1 AND service_id = $2 AND unread_count > 0",
        user_id, service_id,
    )
    .fetch_one(pg)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    let escalated: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM social_inbox_summary WHERE user_id = $1 AND service_id = $2 AND is_escalated = true",
        user_id, service_id,
    )
    .fetch_one(pg)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    let bot_today: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) FROM social_chatbot_threads
           WHERE user_id = $1 AND service_id = $2
             AND last_bot_response_at >= CURRENT_DATE"#,
        user_id,
        service_id,
    )
    .fetch_one(pg)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);

    let by_platform = sqlx::query!(
        r#"SELECT platform,
                  COUNT(*) as total,
                  SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread,
                  SUM(CASE WHEN is_escalated THEN 1 ELSE 0 END) as escalated
           FROM social_inbox_summary
           WHERE user_id = $1 AND service_id = $2
           GROUP BY platform"#,
        user_id,
        service_id,
    )
    .fetch_all(pg)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|r| PlatformInboxStat {
        platform: r.platform,
        total: r.total.unwrap_or(0),
        unread: r.unread.unwrap_or(0),
        escalated: r.escalated.unwrap_or(0),
    })
    .collect();

    Ok(InboxStats {
        total_conversations: total,
        unread_conversations: unread,
        escalated,
        bot_handled_today: bot_today,
        avg_response_time_ms: None,
        by_platform,
    })
}

/// Recherche dans les conversations
pub async fn search_conversations(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    query: &str,
) -> Result<Vec<InboxThread>, String> {
    let rows = sqlx::query!(
        r#"SELECT s.id, s.thread_id, s.platform, s.sender_name,
                  s.last_message_preview, s.last_message_at,
                  s.unread_count, s.is_escalated, s.is_starred, s.label,
                  t.status, t.total_messages, t.bot_messages, t.sentiment
           FROM social_inbox_summary s
           JOIN social_chatbot_threads t ON t.id = s.thread_id
           WHERE s.user_id = $1 AND s.service_id = $2
             AND (s.sender_name ILIKE $3
                  OR s.last_message_preview ILIKE $3
                  OR EXISTS (
                    SELECT 1 FROM social_chatbot_messages m
                    WHERE m.thread_id = s.thread_id AND m.content ILIKE $3
                  ))
           ORDER BY s.last_message_at DESC
           LIMIT 20"#,
        user_id,
        service_id,
        format!("%{}%", query),
    )
    .fetch_all(pg)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| InboxThread {
            id: r.id,
            thread_id: r.thread_id,
            platform: r.platform,
            sender_name: r.sender_name,
            last_message_preview: r.last_message_preview,
            last_message_at: r.last_message_at,
            unread_count: r.unread_count,
            is_escalated: r.is_escalated,
            is_starred: r.is_starred,
            label: r.label,
            status: r.status,
            total_messages: r.total_messages,
            bot_messages: r.bot_messages,
            sentiment: r.sentiment,
        })
        .collect())
}
