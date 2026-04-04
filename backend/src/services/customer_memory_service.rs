// Customer Memory Service — Yukpo
// Mémoire persistante par client pour le chatbot Community Manager IA.
// Permet de personnaliser les réponses en fonction de l'historique,
// des préférences, du statut VIP et des problèmes ouverts.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// ─── Struct principale ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CustomerMemory {
    pub id: i64,
    pub user_id: i32,
    pub service_id: i32,
    pub customer_external_id: String,
    pub platform: String,

    pub customer_name: Option<String>,
    pub language_detected: Option<String>,
    pub sentiment_overall: String,

    pub total_orders: i32,
    pub last_order_at: Option<chrono::DateTime<chrono::Utc>>,
    pub total_spent_fcfa: i64,
    pub preferred_products: Vec<String>,
    pub preferred_category: Option<String>,

    pub last_intent: Option<String>,
    pub open_issues: Vec<String>,
    pub follow_up_needed: bool,
    pub follow_up_note: Option<String>,
    pub follow_up_at: Option<chrono::DateTime<chrono::Utc>>,

    pub preferred_language: Option<String>,
    pub prefers_human: bool,
    pub is_vip: bool,
    pub vip_reason: Option<String>,

    pub conversation_count: i32,
    pub escalation_count: i32,
    pub last_seen_at: chrono::DateTime<chrono::Utc>,
    pub first_seen_at: chrono::DateTime<chrono::Utc>,
}

// ─── Champs mis à jour dans un message ───────────────────────────────────────

#[derive(Debug, Default)]
pub struct MemoryUpdate<'a> {
    pub customer_name: Option<&'a str>,
    pub language_detected: Option<&'a str>,
    pub sentiment: Option<&'a str>,
    pub last_intent: Option<&'a str>,
    pub add_open_issue: Option<&'a str>,
    pub resolve_issue: Option<&'a str>,
    pub follow_up_needed: Option<bool>,
    pub follow_up_note: Option<&'a str>,
    pub follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub prefers_human: Option<bool>,
    pub preferred_language: Option<&'a str>,
    pub increment_conversation: bool,
    pub increment_escalation: bool,
    pub mark_as_vip: Option<&'a str>,   // Some(reason) to promote
    pub order_amount_fcfa: Option<i64>, // ajouter au total_spent + incrémenter total_orders
}

// ─── load_or_create ──────────────────────────────────────────────────────────

/// Charge la mémoire existante ou crée un enregistrement vide.
pub async fn load_or_create(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    platform: &str,
    customer_external_id: &str,
) -> Result<CustomerMemory, sqlx::Error> {
    let row = sqlx::query_as::<_, CustomerMemory>(
        r#"
        INSERT INTO customer_memory
            (user_id, service_id, platform, customer_external_id, conversation_count, last_seen_at)
        VALUES ($1, $2, $3, $4, 1, NOW())
        ON CONFLICT ON CONSTRAINT uq_customer_memory DO UPDATE
            SET last_seen_at = NOW()
        RETURNING
            id, user_id, service_id, customer_external_id, platform,
            customer_name, language_detected,
            sentiment_overall,
            total_orders, last_order_at, total_spent_fcfa,
            preferred_products, preferred_category,
            last_intent, open_issues,
            follow_up_needed, follow_up_note, follow_up_at,
            preferred_language, prefers_human, is_vip, vip_reason,
            conversation_count, escalation_count,
            last_seen_at, first_seen_at
        "#,
    )
    .bind(user_id)
    .bind(service_id)
    .bind(platform)
    .bind(customer_external_id)
    .fetch_one(pg)
    .await?;

    Ok(row)
}

// ─── apply_update ─────────────────────────────────────────────────────────────

/// Applique une mise à jour partielle en SQL.
pub async fn apply_update(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
    platform: &str,
    customer_external_id: &str,
    upd: MemoryUpdate<'_>,
) -> Result<(), sqlx::Error> {
    // Construire les mises à jour non nulles
    let mut sets: Vec<String> = Vec::new();

    if let Some(name) = upd.customer_name {
        sets.push(format!("customer_name = '{}'", name.replace('\'', "''")));
    }
    if let Some(lang) = upd.language_detected {
        sets.push(format!("language_detected = '{}'", lang));
    }
    if let Some(sent) = upd.sentiment {
        sets.push(format!("sentiment_overall = '{}'", sent));
    }
    if let Some(intent) = upd.last_intent {
        sets.push(format!("last_intent = '{}'", intent.replace('\'', "''")));
    }
    if let Some(issue) = upd.add_open_issue {
        sets.push(format!(
            "open_issues = array_append(open_issues, '{}')",
            issue.replace('\'', "''")
        ));
    }
    if let Some(issue) = upd.resolve_issue {
        sets.push(format!(
            "open_issues = array_remove(open_issues, '{}')",
            issue.replace('\'', "''")
        ));
    }
    if let Some(fu) = upd.follow_up_needed {
        sets.push(format!("follow_up_needed = {}", fu));
    }
    if let Some(note) = upd.follow_up_note {
        sets.push(format!("follow_up_note = '{}'", note.replace('\'', "''")));
    }
    if let Some(at) = upd.follow_up_at {
        sets.push(format!("follow_up_at = '{}'", at.to_rfc3339()));
    }
    if let Some(ph) = upd.prefers_human {
        sets.push(format!("prefers_human = {}", ph));
    }
    if let Some(pl) = upd.preferred_language {
        sets.push(format!("preferred_language = '{}'", pl));
    }
    if upd.increment_conversation {
        sets.push("conversation_count = conversation_count + 1".to_string());
    }
    if upd.increment_escalation {
        sets.push("escalation_count = escalation_count + 1".to_string());
    }
    if let Some(reason) = upd.mark_as_vip {
        sets.push("is_vip = true".to_string());
        sets.push(format!("vip_reason = '{}'", reason.replace('\'', "''")));
    }
    if let Some(amount) = upd.order_amount_fcfa {
        sets.push("total_orders = total_orders + 1".to_string());
        sets.push(format!("total_spent_fcfa = total_spent_fcfa + {}", amount));
        sets.push("last_order_at = NOW()".to_string());
    }
    sets.push("last_seen_at = NOW()".to_string());

    if sets.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE customer_memory SET {} WHERE user_id = $1 AND service_id = $2 AND platform = $3 AND customer_external_id = $4",
        sets.join(", ")
    );

    sqlx::query(&sql)
        .bind(user_id)
        .bind(service_id)
        .bind(platform)
        .bind(customer_external_id)
        .execute(pg)
        .await?;

    Ok(())
}

// ─── get_vip_customers ────────────────────────────────────────────────────────

/// Liste les clients VIP d'un service (pour dashboard CM).
pub async fn get_vip_customers(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
) -> Result<Vec<CustomerMemory>, sqlx::Error> {
    sqlx::query_as::<_, CustomerMemory>(
        r#"
        SELECT id, user_id, service_id, customer_external_id, platform,
               customer_name, language_detected, sentiment_overall,
               total_orders, last_order_at, total_spent_fcfa,
               preferred_products, preferred_category,
               last_intent, open_issues,
               follow_up_needed, follow_up_note, follow_up_at,
               preferred_language, prefers_human, is_vip, vip_reason,
               conversation_count, escalation_count, last_seen_at, first_seen_at
        FROM customer_memory
        WHERE user_id = $1 AND service_id = $2 AND is_vip = true
        ORDER BY total_spent_fcfa DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_all(pg)
    .await
}

// ─── get_follow_ups_due ────────────────────────────────────────────────────────

/// Clients nécessitant un suivi dont la date est passée.
pub async fn get_follow_ups_due(
    pg: &PgPool,
    user_id: i32,
    service_id: i32,
) -> Result<Vec<CustomerMemory>, sqlx::Error> {
    sqlx::query_as::<_, CustomerMemory>(
        r#"
        SELECT id, user_id, service_id, customer_external_id, platform,
               customer_name, language_detected, sentiment_overall,
               total_orders, last_order_at, total_spent_fcfa,
               preferred_products, preferred_category,
               last_intent, open_issues,
               follow_up_needed, follow_up_note, follow_up_at,
               preferred_language, prefers_human, is_vip, vip_reason,
               conversation_count, escalation_count, last_seen_at, first_seen_at
        FROM customer_memory
        WHERE user_id = $1 AND service_id = $2
          AND follow_up_needed = true
          AND (follow_up_at IS NULL OR follow_up_at <= NOW())
        ORDER BY follow_up_at ASC NULLS FIRST
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .bind(service_id)
    .fetch_all(pg)
    .await
}

// ─── build_context_summary ────────────────────────────────────────────────────

/// Retourne une chaîne de contexte à injecter dans le prompt GPT-4o du chatbot.
pub fn build_context_summary(mem: &CustomerMemory) -> String {
    let mut parts: Vec<String> = Vec::new();

    if let Some(name) = &mem.customer_name {
        parts.push(format!("Client: {}", name));
    }
    if mem.is_vip {
        parts.push(format!(
            "⭐ VIP ({})",
            mem.vip_reason.as_deref().unwrap_or("client fidèle")
        ));
    }
    if mem.total_orders > 0 {
        parts.push(format!(
            "{} commandes • {} FCFA dépensés",
            mem.total_orders, mem.total_spent_fcfa
        ));
    }
    if let Some(cat) = &mem.preferred_category {
        parts.push(format!("Catégorie préférée: {}", cat));
    }
    if !mem.open_issues.is_empty() {
        parts.push(format!("Problèmes ouverts: {}", mem.open_issues.join(", ")));
    }
    if mem.follow_up_needed {
        if let Some(note) = &mem.follow_up_note {
            parts.push(format!("Suivi requis: {}", note));
        }
    }
    if let Some(lang) = &mem.preferred_language {
        parts.push(format!("Langue préférée: {}", lang));
    }
    if mem.prefers_human {
        parts.push("⚠️ Préfère un agent humain".to_string());
    }
    if mem.escalation_count > 2 {
        parts.push(format!("⚠️ {} escalades passées", mem.escalation_count));
    }

    if parts.is_empty() {
        return String::new();
    }

    format!("\n\n[MÉMOIRE CLIENT]\n{}", parts.join("\n"))
}
