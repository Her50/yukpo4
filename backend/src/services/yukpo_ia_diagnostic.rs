//! Diagnostic YukpoIA - Vérification rapide de l'état du système

use chrono::Datelike;
use serde_json::json;
use sqlx::PgPool;

/// Diagnostic complet du système YukpoIA pour un utilisateur
pub async fn diagnose_yukpo_ia_system(
    pool: &PgPool,
    user_id: i32,
) -> Result<serde_json::Value, sqlx::Error> {
    let mut diagnostic = json!({
        "user_id": user_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "checks": {}
    });

    // 1. Vérifier les tables requises
    let tables = vec![
        "users",
        "yukpo_ia_daily_usage", 
        "yukpo_ia_sessions",
        "yukpo_ia_messages"
    ];

    for table in tables {
        let check_result = match sqlx::query(&format!("SELECT 1 FROM {} LIMIT 1", table))
            .fetch_one(pool)
            .await 
        {
            Ok(_) => json!({"status": "ok", "accessible": true}),
            Err(e) => json!({"status": "error", "accessible": false, "error": e.to_string()})
        };
        diagnostic["checks"][table] = check_result;
    }

    // 2. Vérifier l'utilisateur
    let user_check = match sqlx::query("SELECT id, email, tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await? 
    {
        Some(row) => {
            let id: i32 = row.get("id");
            let email: String = row.get("email");
            let balance: i64 = row.get("tokens_balance");
            
            json!({
                "status": "found",
                "id": id,
                "email": email,
                "tokens_balance": balance
            })
        }
        None => json!({"status": "not_found"})
    };
    diagnostic["checks"]["user"] = user_check;

    // 3. Vérifier l'utilisation gratuite du mois (clé = 1er jour du mois UTC)
    let today = chrono::Utc::now().date_naive();
    let month_start = chrono::NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap_or(today);
    let usage_check = match sqlx::query(
        "SELECT free_token_units_consumed FROM yukpo_ia_daily_usage WHERE user_id = $1 AND usage_date = $2"
    )
    .bind(user_id)
    .bind(month_start)
    .fetch_optional(pool)
    .await?
    {
        Some(row) => {
            let used: i64 = row.get("free_token_units_consumed");
            json!({
                "status": "found",
                "period_start": month_start.to_string(),
                "free_used": used
            })
        }
        None => json!({
            "status": "not_found",
            "period_start": month_start.to_string(),
            "free_used": 0
        })
    };
    diagnostic["checks"]["monthly_free_usage"] = usage_check;

    // 4. Variables d'environnement
    diagnostic["checks"]["environment"] = json!({
        "billing_enabled": std::env::var("YUKPO_IA_BILLING_ENABLED")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true),
        "monthly_budget": std::env::var("YUKPO_IA_MONTHLY_FREE_TOKEN_BUDGET")
            .ok()
            .and_then(|s| s.parse().ok())
            .or_else(|| {
                std::env::var("YUKPO_IA_DAILY_FREE_TOKEN_BUDGET")
                    .ok()
                    .and_then(|s| s.parse().ok())
            })
            .unwrap_or(4000),
        "token_multiplier": std::env::var("YUKPO_IA_TOKEN_MULTIPLIER")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1.0)
    });

    Ok(diagnostic)
}

/// Test rapide de connexion à la base de données
pub async fn test_database_connection(pool: &PgPool) -> Result<serde_json::Value, sqlx::Error> {
    match sqlx::query("SELECT version(), now() as timestamp")
        .fetch_one(pool)
        .await 
    {
        Ok(row) => {
            let version: String = row.get("version");
            let timestamp: chrono::NaiveDateTime = row.get("timestamp");
            Ok(json!({
                "status": "connected",
                "postgres_version": version,
                "server_time": timestamp.to_rfc3339()
            }))
        }
        Err(e) => Ok(json!({
            "status": "error",
            "error": e.to_string()
        }))
    }
}
