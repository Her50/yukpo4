//! Persistance des sessions YukpoIA : conversations, résumés, mémoire utilisateur long terme.

use chrono::{DateTime, Utc};
use log::{error, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Postgres};
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;

fn truncate_for_store(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n\n[…]", &s[..end])
}

const RECENT_TURNS_FOR_PROMPT: i64 = 8;
const SUMMARY_EVERY_N_MESSAGES: i32 = 10;
const MEMORY_EVERY_N_MESSAGES: i32 = 15;
const MAX_USER_MEMORY_ROWS: i64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IaSessionRow {
    pub id: Uuid,
    pub user_id: i32,
    pub title: Option<String>,
    pub context_screen: Option<String>,
    pub context_type: Option<String>,
    #[sqlx(json)]
    pub metadata: serde_json::Value,
    pub summary: Option<String>,
    pub message_count: i32,
    pub total_tokens_used: i64,
    pub is_archived: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_message_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IaUserMemoryRow {
    pub memory_key: String,
    pub memory_value: String,
    pub confidence: f32,
    pub updated_at: DateTime<Utc>,
}

pub async fn verify_session_owner(
    pool: &PgPool,
    user_id: i32,
    session_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let ok = sqlx::query_scalar::<Postgres, bool>(
        "SELECT EXISTS(SELECT 1 FROM yukpo_ia_sessions WHERE id = $1 AND user_id = $2)",
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(ok)
}

pub async fn create_session(
    pool: &PgPool,
    user_id: i32,
    title: Option<&str>,
    context_screen: Option<&str>,
    context_type: Option<&str>,
    metadata: serde_json::Value,
) -> Result<IaSessionRow, sqlx::Error> {
    let row = sqlx::query_as::<_, IaSessionRow>(
        r#"
        INSERT INTO yukpo_ia_sessions (user_id, title, context_screen, context_type, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, title, context_screen, context_type, metadata, summary, message_count,
                  total_tokens_used, is_archived, created_at, updated_at, last_message_at
        "#,
    )
    .bind(user_id)
    .bind(title)
    .bind(context_screen)
    .bind(context_type)
    .bind(metadata)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn list_sessions(
    pool: &PgPool,
    user_id: i32,
    limit: i64,
    offset: i64,
    include_archived: bool,
) -> Result<Vec<IaSessionRow>, sqlx::Error> {
    let rows = if include_archived {
        sqlx::query_as::<_, IaSessionRow>(
            r#"
            SELECT id, user_id, title, context_screen, context_type, metadata, summary, message_count,
                   total_tokens_used, is_archived, created_at, updated_at, last_message_at
            FROM yukpo_ia_sessions
            WHERE user_id = $1
            ORDER BY last_message_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, IaSessionRow>(
            r#"
            SELECT id, user_id, title, context_screen, context_type, metadata, summary, message_count,
                   total_tokens_used, is_archived, created_at, updated_at, last_message_at
            FROM yukpo_ia_sessions
            WHERE user_id = $1 AND is_archived = FALSE
            ORDER BY last_message_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };
    Ok(rows)
}

pub async fn get_session(
    pool: &PgPool,
    user_id: i32,
    session_id: Uuid,
) -> Result<Option<IaSessionRow>, sqlx::Error> {
    let row = sqlx::query_as::<_, IaSessionRow>(
        r#"
        SELECT id, user_id, title, context_screen, context_type, metadata, summary, message_count,
               total_tokens_used, is_archived, created_at, updated_at, last_message_at
        FROM yukpo_ia_sessions
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn update_session(
    pool: &PgPool,
    user_id: i32,
    session_id: Uuid,
    title: Option<&str>,
    is_archived: Option<bool>,
) -> Result<bool, sqlx::Error> {
    let r = sqlx::query(
        r#"
        UPDATE yukpo_ia_sessions
        SET title = COALESCE($3, title),
            is_archived = COALESCE($4, is_archived),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .bind(title)
    .bind(is_archived)
    .execute(pool)
    .await?;
    Ok(r.rows_affected() > 0)
}

pub async fn delete_session(
    pool: &PgPool,
    user_id: i32,
    session_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let r = sqlx::query("DELETE FROM yukpo_ia_sessions WHERE id = $1 AND user_id = $2")
        .bind(session_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(r.rows_affected() > 0)
}

/// Derniers messages (ordre chronologique) pour le prompt LLM.
pub async fn fetch_recent_messages_for_prompt(
    pool: &PgPool,
    session_id: Uuid,
    limit: i64,
) -> Result<Vec<(String, String)>, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT role, content
        FROM yukpo_ia_messages
        WHERE session_id = $1 AND role IN ('user', 'assistant')
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(session_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().rev().collect())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MessagePageRow {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Page de messages (ordre chronologique). `has_more` = il existe des messages plus anciens que la page.
pub async fn fetch_messages_page(
    pool: &PgPool,
    session_id: Uuid,
    before: Option<DateTime<Utc>>,
    limit: i64,
) -> Result<(Vec<MessagePageRow>, bool), sqlx::Error> {
    let lim = limit.clamp(1, 100);
    let take = lim + 1;

    let mut rows: Vec<MessagePageRow> = if let Some(ts) = before {
        sqlx::query_as(
            r#"
            SELECT id, role, content, created_at
            FROM yukpo_ia_messages
            WHERE session_id = $1 AND created_at < $2
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(session_id)
        .bind(ts)
        .bind(take)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT id, role, content, created_at
            FROM yukpo_ia_messages
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(session_id)
        .bind(take)
        .fetch_all(pool)
        .await?
    };

    let has_more = rows.len() as i64 > lim;
    if has_more {
        rows.pop();
    }
    rows.reverse();
    Ok((rows, has_more))
}

/// Préférence utilisateur : mémoire long terme (faits cross-session) activée.
/// Défaut `true` si colonne absente / erreur lecture.
pub async fn user_long_term_memory_enabled(
    pool: &PgPool,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let v: Option<bool> =
        sqlx::query_scalar("SELECT yukpo_ia_long_term_memory_enabled FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?;
    Ok(v.unwrap_or(true))
}

/// Consentement explicite enregistré (horodatage) pour la mémoire long terme.
pub async fn user_long_term_memory_consent_at(
    pool: &PgPool,
    user_id: i32,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    sqlx::query_scalar("SELECT yukpo_ia_long_term_memory_consent_at FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await
}

/// Mémoire long terme réellement utilisée : préférence activée **et** consentement explicite.
pub async fn user_long_term_memory_active(
    pool: &PgPool,
    user_id: i32,
) -> Result<bool, sqlx::Error> {
    let row: Option<(bool, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT yukpo_ia_long_term_memory_enabled, yukpo_ia_long_term_memory_consent_at FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(match row {
        Some((enabled, consent)) => enabled && consent.is_some(),
        None => false,
    })
}

pub async fn set_user_long_term_memory_enabled(
    pool: &PgPool,
    user_id: i32,
    enabled: bool,
    consent_acknowledged: Option<bool>,
) -> Result<(), sqlx::Error> {
    if consent_acknowledged == Some(true) {
        sqlx::query(
            r#"
            UPDATE users
            SET yukpo_ia_long_term_memory_enabled = $1,
                yukpo_ia_long_term_memory_consent_at = COALESCE(yukpo_ia_long_term_memory_consent_at, NOW())
            WHERE id = $2
            "#,
        )
        .bind(enabled)
        .bind(user_id)
        .execute(pool)
        .await?;
    } else {
        sqlx::query("UPDATE users SET yukpo_ia_long_term_memory_enabled = $1 WHERE id = $2")
            .bind(enabled)
            .bind(user_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IaMessageExportRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: String,
    pub content: String,
    #[sqlx(json)]
    pub attachments: serde_json::Value,
    pub tokens_used: Option<i32>,
    pub model_used: Option<String>,
    pub billing: Option<serde_json::Value>,
    #[sqlx(json)]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IaUserMemoryExportRow {
    pub id: Uuid,
    pub user_id: i32,
    pub memory_key: String,
    pub memory_value: String,
    pub source_session_id: Option<Uuid>,
    pub confidence: f32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Export RGPD : snapshot JSON des sessions, messages et mémoire utilisateur YukpoIA.
pub async fn gdpr_export_user_data_json(
    pool: &PgPool,
    user_id: i32,
) -> Result<serde_json::Value, sqlx::Error> {
    let sessions = list_sessions(pool, user_id, 10_000, 0, true).await?;
    let mut session_blocks = Vec::new();
    for s in sessions {
        let messages: Vec<IaMessageExportRow> = sqlx::query_as(
            r#"
            SELECT id, session_id, role, content, attachments, tokens_used, model_used, billing, metadata, created_at
            FROM yukpo_ia_messages
            WHERE session_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(s.id)
        .fetch_all(pool)
        .await?;
        session_blocks.push(json!({
            "session": s,
            "messages": messages,
        }));
    }
    let user_memory: Vec<IaUserMemoryExportRow> = sqlx::query_as(
        r#"
        SELECT id, user_id, memory_key, memory_value, source_session_id, confidence::real AS confidence,
               created_at, updated_at
        FROM yukpo_ia_user_memory
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(json!({
        "export_version": 1,
        "user_id": user_id,
        "exported_at": Utc::now(),
        "sessions": session_blocks,
        "user_memory": user_memory,
    }))
}

#[derive(Debug, Serialize)]
pub struct GdprWipeResult {
    pub deleted_sessions: u64,
    pub deleted_messages: u64,
    pub deleted_memory_rows: u64,
}

/// Supprime toutes les données YukpoIA personnelles (sessions, messages, mémoire long terme).
/// Ne supprime pas `yukpo_ia_daily_usage` (traçabilité facturation — traiter séparément si exigé).
pub async fn gdpr_delete_all_yukpo_ia_user_data(
    pool: &PgPool,
    user_id: i32,
) -> Result<GdprWipeResult, sqlx::Error> {
    let deleted_messages: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint FROM yukpo_ia_messages m
        INNER JOIN yukpo_ia_sessions s ON m.session_id = s.id
        WHERE s.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let deleted_memory_rows = sqlx::query("DELETE FROM yukpo_ia_user_memory WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?
        .rows_affected();

    let deleted_sessions = sqlx::query("DELETE FROM yukpo_ia_sessions WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?
        .rows_affected();

    Ok(GdprWipeResult {
        deleted_sessions,
        deleted_messages: deleted_messages as u64,
        deleted_memory_rows,
    })
}

pub async fn load_user_memory_text(pool: &PgPool, user_id: i32) -> Result<String, sqlx::Error> {
    if !user_long_term_memory_active(pool, user_id).await.unwrap_or(false) {
        return Ok(String::new());
    }
    let rows: Vec<IaUserMemoryRow> = sqlx::query_as(
        r#"
        SELECT memory_key, memory_value, confidence::real AS confidence, updated_at
        FROM yukpo_ia_user_memory
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(MAX_USER_MEMORY_ROWS)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(String::new());
    }
    let parts: Vec<String> =
        rows.iter().map(|r| format!("- {}: {}", r.memory_key, r.memory_value)).collect();
    Ok(parts.join("\n"))
}

/// Insère le tour utilisateur + assistant et met à jour la session.
pub async fn persist_chat_turn(
    pool: &PgPool,
    session_id: Uuid,
    user_id: i32,
    user_content: &str,
    assistant_content: &str,
    model_used: &str,
    assistant_tokens: i32,
    billing_snapshot: serde_json::Value,
) -> Result<i32, sqlx::Error> {
    const MAX_STORED_MSG: usize = 120_000;
    let user_content = truncate_for_store(user_content, MAX_STORED_MSG);
    let assistant_content = truncate_for_store(assistant_content, MAX_STORED_MSG);

    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO yukpo_ia_messages (session_id, role, content, tokens_used, model_used, billing, metadata)
        VALUES ($1, 'user', $2, 0, NULL, NULL, '{}')
        "#,
    )
    .bind(session_id)
    .bind(&user_content)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO yukpo_ia_messages (session_id, role, content, tokens_used, model_used, billing, metadata)
        VALUES ($1, 'assistant', $2, $3, $4, $5, '{}')
        "#,
    )
    .bind(session_id)
    .bind(assistant_content)
    .bind(assistant_tokens)
    .bind(model_used)
    .bind(billing_snapshot)
    .execute(&mut *tx)
    .await?;

    let count: i32 = sqlx::query_scalar::<Postgres, i32>(
        r#"
        UPDATE yukpo_ia_sessions
        SET message_count = message_count + 2,
            total_tokens_used = total_tokens_used + $3::bigint,
            last_message_at = NOW(),
            updated_at = NOW(),
            title = COALESCE(
                title,
                LEFT($4, 200)
            )
        WHERE id = $1 AND user_id = $2
        RETURNING message_count
        "#,
    )
    .bind(session_id)
    .bind(user_id)
    .bind(assistant_tokens as i64)
    .bind(&user_content)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(count)
}

/// Appels LLM secondaires : résumé de session + extraction mémoire (hors hot path optionnel).
pub fn spawn_session_maintenance(
    state: Arc<AppState>,
    user_id: i32,
    session_id: Uuid,
    message_count: i32,
) {
    let need_summary = message_count > 0 && message_count % SUMMARY_EVERY_N_MESSAGES == 0;
    let need_memory = message_count > 0 && message_count % MEMORY_EVERY_N_MESSAGES == 0;

    if !need_summary && !need_memory {
        return;
    }

    tokio::spawn(async move {
        if need_summary {
            if let Err(e) = refresh_session_summary(&state, user_id, session_id).await {
                warn!("[YukpoIA session] refresh summary: {}", e);
            }
        }
        if need_memory {
            if let Err(e) = extract_user_memory(&state, user_id, session_id).await {
                warn!("[YukpoIA session] extract memory: {}", e);
            }
        }
    });
}

async fn refresh_session_summary(
    state: &AppState,
    user_id: i32,
    session_id: Uuid,
) -> Result<(), String> {
    let pool = &state.pg;
    let hist = fetch_recent_messages_for_prompt(pool, session_id, 24)
        .await
        .map_err(|e| e.to_string())?;
    if hist.len() < 4 {
        return Ok(());
    }

    let transcript: String = hist
        .iter()
        .map(|(r, c)| format!("{}: {}", r, c.chars().take(2000).collect::<String>()))
        .collect::<Vec<_>>()
        .join("\n");

    let messages_vec = vec![
        json!({"role": "system", "content": "Tu résumes une conversation YukpoIA pour mémoire interne. 3 à 6 phrases en français. Inclus: sujet principal, décisions ou préférences exprimées, prochaines actions utiles. Pas de markdown, texte brut."}),
        json!({"role": "user", "content": format!("Conversation:\n\n{}", transcript)}),
    ];

    let (_model, raw, _ct, _tt) = state
        .ia
        .chat_completion_with_messages(&messages_vec, false, 400, 0.3)
        .await
        .map_err(|e| e.to_string())?;

    let summary = raw.trim().chars().take(4000).collect::<String>();
    if summary.is_empty() {
        return Ok(());
    }

    sqlx::query(
        "UPDATE yukpo_ia_sessions SET summary = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
    )
    .bind(&summary)
    .bind(session_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn extract_user_memory(
    state: &AppState,
    user_id: i32,
    session_id: Uuid,
) -> Result<(), String> {
    let pool = &state.pg;
    if !user_long_term_memory_active(pool, user_id).await.unwrap_or(false) {
        return Ok(());
    }
    let hist = fetch_recent_messages_for_prompt(pool, session_id, 30)
        .await
        .map_err(|e| e.to_string())?;
    if hist.len() < 4 {
        return Ok(());
    }

    let transcript: String = hist
        .iter()
        .map(|(r, c)| format!("{}: {}", r, c.chars().take(1500).collect::<String>()))
        .collect::<Vec<_>>()
        .join("\n");

    let messages_vec = vec![
        json!({"role": "system", "content": "Tu extrais des faits durables sur l'utilisateur (métier, ville, langue préférée, type de commerce, préférences d'usage Yukpo) à partir de la conversation. Réponds UNIQUEMENT par un objet JSON plat: {\"cle_snake_case\": \"valeur courte\", ...}. Maximum 8 entrées. Aucune donnée sensible (mots de passe, tokens, numéros de carte). Si rien d'utile: {}"}),
        json!({"role": "user", "content": transcript}),
    ];

    let (_model, raw, _ct, _tt) = state
        .ia
        .chat_completion_with_messages(&messages_vec, false, 350, 0.2)
        .await
        .map_err(|e| e.to_string())?;

    let cleaned = raw.trim();
    let cleaned = if cleaned.starts_with("```") {
        cleaned
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim()
            .trim_end_matches("```")
            .trim()
    } else {
        cleaned
    };

    let obj: serde_json::Value =
        serde_json::from_str(cleaned).map_err(|e| format!("memory JSON: {}", e))?;
    let Some(map) = obj.as_object() else {
        return Ok(());
    };

    for (k, v) in map.iter().take(12) {
        let key = k.chars().take(100).collect::<String>();
        let val = match v {
            serde_json::Value::String(s) => s.chars().take(500).collect::<String>(),
            _ => v.to_string().chars().take(500).collect::<String>(),
        };
        if key.is_empty() || val.is_empty() {
            continue;
        }

        let res = sqlx::query(
            r#"
            INSERT INTO yukpo_ia_user_memory (user_id, memory_key, memory_value, source_session_id, confidence, updated_at)
            VALUES ($1, $2, $3, $4, 0.85, NOW())
            ON CONFLICT (user_id, memory_key)
            DO UPDATE SET memory_value = EXCLUDED.memory_value, source_session_id = EXCLUDED.source_session_id,
                          updated_at = NOW()
            "#,
        )
        .bind(user_id)
        .bind(&key)
        .bind(&val)
        .bind(session_id)
        .execute(pool)
        .await;

        if let Err(e) = res {
            error!("[YukpoIA session] upsert memory {}: {}", key, e);
        }
    }

    Ok(())
}

pub fn recent_turns_limit() -> i64 {
    RECENT_TURNS_FOR_PROMPT
}
