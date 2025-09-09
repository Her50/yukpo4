use chrono::Utc;
use sqlx::PgPool;
use crate::core::types::{AppError, AppResult};
use crate::models::history_model::ConsultationHistorique;
// use crate::services::mongo_history_service::MongoHistoryService;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::sync::Mutex;
use serde_json::json;
use chrono::DateTime;

/// Montant unique configurable pour le pr?l?vement de tokens ? chaque clic sur un service
/// Par d?faut?: 50 tokens Yukpo (valeur Yukpo = 100x valeur token IA externe)
pub static TOKEN_DEBIT_PER_CLICK: AtomicI64 = AtomicI64::new(50);

/// Conversion valeur token Yukpo ? valeur token IA externe (pour affichage ou calculs)
pub fn valeur_token_yukpo_en_token_ia(nb: i64) -> f64 {
    // 1 token Yukpo = 100 tokens IA externe
    (nb as f64) * 100.0
}

lazy_static::lazy_static! {
    static ref LAST_CLICK: Mutex<HashMap<(i32, i32), u64>> = Mutex::new(HashMap::new());
}

/// ? Enregistre une consultation dans l'historique ET d?bite le prestataire (avec protection 10min)
pub async fn enregistrer_consultation(
    pool: &PgPool,
    // mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    service_id: i32,
) -> AppResult<String> {
    // 1. Protection?: ne d?bite pas si m?me user/service < 10min
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let should_debit = {
        let mut last_click = LAST_CLICK.lock().unwrap();
        if let Some(&last) = last_click.get(&(user_id, service_id)) {
            if now - last < 600 {
                // Moins de 10min?: on enregistre la consultation mais pas de d?bit
                last_click.insert((user_id, service_id), now);
                false
            } else {
                last_click.insert((user_id, service_id), now);
                true
            }
        } else {
            last_click.insert((user_id, service_id), now);
            true
        }
    };

    // 2. Enregistrer la consultation dans MongoDB
    let _consultation_data = json!({
        "user_id": user_id,
        "service_id": service_id,
        "timestamp": Utc::now(),
        "debit_applied": should_debit,
        "token_cost": if should_debit { TOKEN_DEBIT_PER_CLICK.load(Ordering::Relaxed) } else { 0 }
    });

    // mongo_history
    //     .log_service_consultation(user_id, service_id, consultation_data)
    //     .await
    //     .map_err(|e| AppError::Internal(format!("Erreur enregistrement consultation MongoDB: {}", e)))?;

    if !should_debit {
        return Ok("Consultation enregistr?e (pas de d?bit, d?lai protection)".to_string());
    }

    // 3. R?cup?rer le service et son prestataire (PostgreSQL)
    let service = sqlx::query!("SELECT user_id FROM services WHERE id = $1", service_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Service introuvable: {}", e)))?;
    let provider_id = service.user_id;
    let cout = TOKEN_DEBIT_PER_CLICK.load(Ordering::Relaxed);

    // 4. D?biter le solde du prestataire (PostgreSQL)
    let user = sqlx::query!("SELECT tokens_balance FROM users WHERE id = $1", provider_id)
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Prestataire introuvable: {}", e)))?;
    let nouveau_solde = user.tokens_balance - cout;
    sqlx::query!("UPDATE users SET tokens_balance = $1 WHERE id = $2", nouveau_solde, provider_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur d?bit tokens: {}", e)))?;

    // 5. Si solde <= 0, d?sactiver tous les services du prestataire (PostgreSQL)
    if nouveau_solde <= 0 {
        sqlx::query!("UPDATE services SET is_active = FALSE WHERE user_id = $1", provider_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur d?sactivation services: {}", e)))?;
    }

    Ok("Consultation enregistr?e".to_string())
}

/// ? R?cup?re les 5 derni?res consultations d'un utilisateur depuis MongoDB
pub async fn get_consultations_utilisateur(
    // mongo_history: Arc<MongoHistoryService>,
    _user_id: i32,
) -> AppResult<Vec<ConsultationHistorique>> {
    let events = Vec::new(); // Placeholder for now, as MongoHistoryService is commented out
    // let events = mongo_history
    //     .get_service_consultations(user_id, Some(5))
    //     .await
    //     .map_err(|e| AppError::Internal(format!("Erreur r?cup?ration historique MongoDB: {}", e)))?;

    // Convertir les ?v?nements MongoDB en ConsultationHistorique
    let consultations: Vec<ConsultationHistorique> = events
        .into_iter()
        .map(|event: &serde_json::Value| {
            ConsultationHistorique {
                id: 0, // Placeholder
                timestamp: event.get("timestamp").and_then(|t| t.as_str()).and_then(|s| DateTime::parse_from_rfc3339(s).ok()).map(|dt| dt.with_timezone(&Utc)),
                user_id: event.get("user_id").and_then(|u| u.as_i64()).unwrap_or(0) as i32,
                service_id: event.get("service_id").and_then(|s| s.as_i64()).unwrap_or(0) as i32,
            }
        })
        .collect();

    Ok(consultations)
}

/// ?? R?cup?re les statistiques de consultation d'un service
pub async fn get_service_consultation_stats(
    // mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
    days: Option<i64>,
) -> AppResult<serde_json::Value> {
    let events = Vec::new(); // Placeholder for now, as MongoHistoryService is commented out
    // let events = mongo_history
    //     .get_service_consultations_by_service(service_id, None)
    //     .await
    //     .map_err(|e| AppError::Internal(format!("Erreur r?cup?ration stats MongoDB: {}", e)))?;

    let now = Utc::now();
    let cutoff = days.map(|d| now - chrono::Duration::days(d));

    let filtered_events: Vec<_> = if let Some(cutoff) = cutoff {
        events.into_iter()
            .filter(|event: &serde_json::Value| {
                if let Some(timestamp) = event.get("timestamp").and_then(|t| t.as_str()) {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(timestamp) {
                        dt >= cutoff
                    } else {
                        false
                    }
                } else {
                    false
                }
            })
            .collect()
    } else {
        events
    };

    let total_consultations = filtered_events.len();
    let unique_users = {
        let mut users = std::collections::HashSet::new();
        for event in &filtered_events {
            if let Some(user_id) = event.get("user_id").and_then(|u| u.as_i64()) {
                users.insert(user_id);
            }
        }
        users.len()
    };

    let total_debits = filtered_events.iter()
        .filter_map(|event| {
            event.get("data").and_then(|d| d.get("debit_applied"))
                .and_then(|v| v.as_bool())
                .filter(|&applied| applied)
                .map(|_| event.get("data").and_then(|d| d.get("token_cost")).and_then(|v| v.as_i64()).unwrap_or(0))
        })
        .sum::<i64>();

    Ok(json!({
        "service_id": service_id,
        "total_consultations": total_consultations,
        "unique_users": unique_users,
        "total_tokens_debited": total_debits,
        "period_days": days,
        "last_consultation": filtered_events.first().map(|e| {
                    if let Some(timestamp) = e.get("timestamp").and_then(|t| t.as_str()) {
                        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(timestamp) {
                            chrono::DateTime::<chrono::Utc>::from(dt)
                        } else {
                            chrono::Utc::now()
                        }
                    } else {
                        chrono::Utc::now()
                    }
                })
    }))
}
