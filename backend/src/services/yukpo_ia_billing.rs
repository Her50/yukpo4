//! Facturation YukpoIA : quota gratuit 24h (UTC) puis prélèvement sur `users.tokens_balance`.
//! La « commission plateforme » est modélisée par le prélèvement intégral des unités facturées
//! sur le wallet (multiplicateur configurable via `YUKPO_IA_TOKEN_MULTIPLIER`).

use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;

pub fn is_billing_enabled() -> bool {
    std::env::var("YUKPO_IA_BILLING_ENABLED")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

fn daily_free_budget() -> i64 {
    std::env::var("YUKPO_IA_DAILY_FREE_TOKEN_BUDGET")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8000)
}

/// Quota gratuit journalier (UTC) en unités d’app — défaut **8000** (`YUKPO_IA_DAILY_FREE_TOKEN_BUDGET`).
pub fn daily_free_token_budget() -> i64 {
    daily_free_budget()
}

fn token_multiplier() -> f64 {
    std::env::var("YUKPO_IA_TOKEN_MULTIPLIER")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1.0)
}

/// Unités de base facturées **une fois** par transcription Whisper (avant `YUKPO_IA_TOKEN_MULTIPLIER`).
pub fn whisper_base_units() -> i64 {
    std::env::var("YUKPO_IA_WHISPER_BILL_UNITS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(200)
        .max(1)
}

/// Unités d’application pour une transcription Whisper (même multiplicateur que le chat).
pub fn whisper_app_charge_units() -> i64 {
    let w = whisper_base_units();
    let mult = token_multiplier();
    ((w as f64 * mult).ceil() as i64).max(1)
}

/// Débit commun : quota gratuit 24h (UTC) puis `tokens_balance`. Utilisé pour le chat et pour Whisper.
pub async fn debit_yukpo_ia_units(
    pool: &PgPool,
    user_id: i32,
    app_charge: i64,
    service_name: &str,
    description: &str,
    metadata: serde_json::Value,
) -> Result<serde_json::Value, sqlx::Error> {
    let app_charge = app_charge.max(1);

    if !is_billing_enabled() {
        return Ok(json!({
            "enabled": false,
            "tokens_charged": 0,
            "from_free_quota": true,
            "daily_free_remaining": daily_free_budget(),
            "balance_after": null,
            "notice": null,
            "insufficient_balance": false,
            "service": service_name
        }));
    }

    let today = Utc::now().date_naive();
    let budget = daily_free_budget();

    let mut tx = pool.begin().await?;

    let balance: i64 = sqlx::query_scalar(
        "SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    let free_used: i64 = sqlx::query_scalar(
        "SELECT COALESCE(free_token_units_consumed, 0) FROM yukpo_ia_daily_usage WHERE user_id = $1 AND usage_date = $2",
    )
    .bind(user_id)
    .bind(today)
    .fetch_optional(&mut *tx)
    .await?
    .flatten()
    .unwrap_or(0);

    let free_remaining_slot = (budget - free_used).max(0);
    let from_free = app_charge.min(free_remaining_slot);
    let paid = app_charge.saturating_sub(from_free);
    let paid_actual = paid.min(balance.max(0));
    let new_balance = balance - paid_actual;

    if from_free > 0 {
        sqlx::query(
            r#"INSERT INTO yukpo_ia_daily_usage (user_id, usage_date, free_token_units_consumed, updated_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (user_id, usage_date) DO UPDATE SET
                 free_token_units_consumed = yukpo_ia_daily_usage.free_token_units_consumed + EXCLUDED.free_token_units_consumed,
                 updated_at = NOW()"#,
        )
        .bind(user_id)
        .bind(today)
        .bind(from_free)
        .execute(&mut *tx)
        .await?;
    }

    if paid_actual > 0 {
        sqlx::query("UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2")
            .bind(paid_actual)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            r#"INSERT INTO token_consumption_logs (user_id, service_name, amount_consumed, description, metadata)
               VALUES ($1, $2, $3, $4, $5)"#,
        )
        .bind(user_id)
        .bind(service_name)
        .bind(paid_actual)
        .bind(description)
        .bind(metadata)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let new_free_used = free_used + from_free;
    let daily_free_remaining = (budget - new_free_used).max(0);

    let notice = if from_free >= app_charge {
        format!(
            "{} : {} unité(s) sur le quota gratuit du jour (reste {}).",
            description, app_charge, daily_free_remaining
        )
    } else if paid_actual > 0 {
        format!(
            "{} : {} unité(s) sur votre solde (reste {}).",
            description, app_charge, new_balance
        )
    } else {
        format!("{} : {} unité(s).", description, app_charge)
    };

    Ok(json!({
        "enabled": true,
        "tokens_charged": app_charge,
        "from_free_quota": from_free >= app_charge,
        "daily_free_remaining": daily_free_remaining,
        "balance_after": new_balance,
        "notice": notice,
        "insufficient_balance": false,
        "recharge_required": false,
        "units_from_free": from_free,
        "units_from_wallet": paid_actual,
        "service": service_name
    }))
}

/// Retourne `Err(json)` si l’utilisateur ne peut pas lancer un appel (quota gratuit épuisé et solde nul).
pub async fn precheck_can_use_yukpo_ia(
    pool: &PgPool,
    user_id: i32,
) -> Result<Result<(), serde_json::Value>, sqlx::Error> {
    if !is_billing_enabled() {
        return Ok(Ok(()));
    }

    let today = Utc::now().date_naive();
    let budget = daily_free_budget();

    let balance: i64 =
        sqlx::query_scalar("SELECT COALESCE(tokens_balance, 0) FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?
            .flatten()
            .unwrap_or(0);

    let free_used: i64 = sqlx::query_scalar(
        "SELECT COALESCE(free_token_units_consumed, 0) FROM yukpo_ia_daily_usage WHERE user_id = $1 AND usage_date = $2",
    )
    .bind(user_id)
    .bind(today)
    .fetch_optional(pool)
    .await?
    .flatten()
    .unwrap_or(0);

    if free_used < budget {
        return Ok(Ok(()));
    }
    if balance > 0 {
        return Ok(Ok(()));
    }

    Ok(Err(json!({
        "message": "Quota YukpoIA gratuit du jour épuisé et solde de jetons insuffisant. Rechargez votre compte pour continuer.",
        "type": "text",
        "confidence": 0.0,
        "billing": {
            "enabled": true,
            "insufficient_balance": true,
            "recharge_required": true,
            "daily_free_remaining": 0,
            "balance_after": 0
        }
    })))
}

/// Après réponse OpenAI : enregistre la conso et renvoie l’objet `billing` pour le client.
pub async fn finalize_yukpo_ia_billing(
    pool: &PgPool,
    user_id: i32,
    completion_tokens: i64,
    total_tokens: i64,
) -> Result<serde_json::Value, sqlx::Error> {
    let raw = if completion_tokens > 0 {
        completion_tokens
    } else {
        total_tokens
    };
    let raw = raw.max(1);

    let mult = token_multiplier();
    let app_charge = ((raw as f64 * mult).ceil() as i64).max(1);

    let mut billing = debit_yukpo_ia_units(
        pool,
        user_id,
        app_charge,
        "yukpo_ia",
        "YukpoIA — réponse assistant",
        json!({
            "api_tokens": raw,
            "total_app_units": app_charge,
            "component": "chat_completion"
        }),
    )
    .await?;

    let billing_obj = billing.as_object_mut();
    if let Some(o) = billing_obj {
        o.insert("api_tokens".to_string(), json!(raw));
    }

    Ok(billing)
}
