use crate::core::types::{AppError, AppResult};
use crate::models::history_model::{
    ConsultationHistorique, ServiceHistorySnapshot, UserHistorySnapshot,
};
use crate::services::mongo_history_service::{HistoryEvent, MongoHistoryService};
use chrono::{DateTime, Duration, Utc};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Montant unique configurable pour le prélèvement de tokens à chaque clic sur un service
/// Par défaut : 50 tokens Yukpo (valeur Yukpo = 100x valeur token IA externe)
pub static TOKEN_DEBIT_PER_CLICK: AtomicI64 = AtomicI64::new(50);

/// Conversion valeur token Yukpo → valeur token IA externe (pour affichage ou calculs)
pub fn valeur_token_yukpo_en_token_ia(nb: i64) -> f64 {
    // 1 token Yukpo = 100 tokens IA externe
    (nb as f64) * 100.0
}

lazy_static::lazy_static! {
    static ref LAST_CLICK: Mutex<HashMap<(i32, i32), u64>> = Mutex::new(HashMap::new());
}

/// Enregistre une consultation dans l'historique ET débite le prestataire (avec protection 10 min)
pub async fn enregistrer_consultation(
    pool: &PgPool,
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
    service_id: i32,
) -> AppResult<String> {
    // 1. Protection : ne débite pas si même user/service < 10 min
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let should_debit = {
        let mut last_click = LAST_CLICK.lock().unwrap();
        if let Some(&last) = last_click.get(&(user_id, service_id)) {
            if now - last < 600 {
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

    let debit_amount = if should_debit {
        TOKEN_DEBIT_PER_CLICK.load(Ordering::Relaxed)
    } else {
        0
    };

    #[derive(sqlx::FromRow)]
    struct ServiceRecordRow {
        user_id: i32,
        #[sqlx(rename = "data")]
        data: serde_json::Value,
        is_active: bool,
        category: Option<String>,
        provider_nom: Option<String>,
        provider_prenom: Option<String>,
        provider_nom_complet: Option<String>,
        provider_avatar_url: Option<String>,
        provider_tokens_balance: i64,
    }

    // 2. Charger le service et le prestataire pour construire l'événement enrichi
    let service_record: ServiceRecordRow = sqlx::query_as(
        r#"
            SELECT
                s.user_id,
                s.data,
                s.is_active,
                s.category,
                u.nom               AS provider_nom,
                u.prenom            AS provider_prenom,
                u.nom_complet       AS provider_nom_complet,
                u.avatar_url        AS provider_avatar_url,
                u.tokens_balance    AS provider_tokens_balance
            FROM services s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = $1
        "#,
    )
    .bind(service_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Service introuvable: {}", e)))?;

    let provider_id = service_record.user_id;
    let service_data: Value = service_record.data;
    let tokens_before = service_record.provider_tokens_balance;
    let tokens_after = tokens_before - debit_amount;

    let service_snapshot = build_service_snapshot(
        service_id,
        provider_id,
        &service_data,
        service_record.category.clone(),
        service_record.is_active,
    );

    let provider_snapshot = build_provider_snapshot(
        provider_id,
        service_record.provider_nom.clone(),
        service_record.provider_prenom.clone(),
        service_record.provider_nom_complet.clone(),
        service_record.provider_avatar_url.clone(),
        Some(tokens_before),
        Some(tokens_after),
    );

    let event_id = Uuid::new_v4().to_string();
    let consultation_data = json!({
        "user_id": user_id,
        "service_id": service_id,
        "timestamp": Utc::now(),
        "debit_applied": should_debit,
        "token_cost": debit_amount,
        "tokens_balance_before": tokens_before,
        "tokens_balance_after": tokens_after,
        "event_id": event_id,
    });

    let metadata = json!({
        "event_id": event_id,
        "should_debit": should_debit,
        "token_cost": debit_amount,
        "token_cost_ia_equivalent": if debit_amount > 0 {
            Some(valeur_token_yukpo_en_token_ia(debit_amount))
        } else {
            None::<f64>
        },
        "service_snapshot": service_snapshot,
        "provider_snapshot": provider_snapshot,
    });

    mongo_history
        .log_service_consultation(user_id, service_id, consultation_data, Some(metadata))
        .await
        .map_err(|e| {
            AppError::Internal(format!("Erreur enregistrement consultation MongoDB: {}", e))
        })?;

    if !should_debit {
        return Ok("Consultation enregistrée (pas de débit, délai de protection)".to_string());
    }

    // 3. Débiter le solde du prestataire (PostgreSQL)
    sqlx::query("UPDATE users SET tokens_balance = $1 WHERE id = $2")
        .bind(tokens_after)
        .bind(provider_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur débit tokens: {}", e)))?;

    // 4. Si solde <= 0, désactiver tous les services du prestataire (PostgreSQL)
    if tokens_after <= 0 {
        sqlx::query("UPDATE services SET is_active = FALSE WHERE user_id = $1")
            .bind(provider_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur désactivation services: {}", e)))?;
    }

    Ok("Consultation enregistrée".to_string())
}

/// Récupère les 5 dernières consultations d'un utilisateur depuis MongoDB
pub async fn get_consultations_utilisateur(
    pool: &PgPool,
    mongo_history: Arc<MongoHistoryService>,
    user_id: i32,
) -> AppResult<Vec<ConsultationHistorique>> {
    let events = mongo_history.get_service_consultations(user_id, Some(5)).await.map_err(|e| {
        AppError::Internal(format!("Erreur récupération historique MongoDB: {}", e))
    })?;

    let mut consultations = Vec::with_capacity(events.len());
    for event in events {
        consultations.push(enrich_history_event(pool, event).await?);
    }

    Ok(consultations)
}

/// Récupère les statistiques de consultation d'un service
pub async fn get_service_consultation_stats(
    mongo_history: Arc<MongoHistoryService>,
    service_id: i32,
    days: Option<i64>,
) -> AppResult<serde_json::Value> {
    let events = mongo_history
        .get_service_consultations_by_service(service_id, None)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération stats MongoDB: {}", e)))?;

    let now = Utc::now();
    let cutoff = days.map(|d| now - Duration::days(d));

    let filtered_events: Vec<HistoryEvent> = events
        .into_iter()
        .filter(|event| {
            if let Some(cutoff_date) = cutoff {
                event_timestamp(&event) >= cutoff_date
            } else {
                true
            }
        })
        .collect();

    let total_consultations = filtered_events.len();
    let unique_users = filtered_events
        .iter()
        .filter_map(|event| event.user_id)
        .collect::<HashSet<_>>()
        .len();
    let total_debit_tokens: i64 =
        filtered_events.iter().map(|event| extract_token_cost(&event.data)).sum();
    let debit_events = filtered_events.iter().filter(|event| debit_applied(&event.data)).count();
    let last_consultation = filtered_events
        .iter()
        .map(|event| event_timestamp(event))
        .max()
        .map(|dt| dt.to_rfc3339());

    let total_token_value_ia = if total_debit_tokens > 0 {
        Some(valeur_token_yukpo_en_token_ia(total_debit_tokens))
    } else {
        None
    };

    let recent_consultations: Vec<Value> = filtered_events
        .iter()
        .take(5)
        .map(|event| {
            let token_cost = extract_token_cost(&event.data);
            json!({
                "event_id": extract_event_id(event).unwrap_or_else(|| build_legacy_event_id(event)),
                "timestamp": event_timestamp(event).to_rfc3339(),
                "user_id": event.user_id,
                "debit_applied": debit_applied(&event.data),
                "token_cost": token_cost,
                "token_cost_ia_equivalent": if token_cost > 0 {
                    Some(valeur_token_yukpo_en_token_ia(token_cost))
                } else { None }
            })
        })
        .collect();

    Ok(json!({
        "service_id": service_id,
        "total_consultations": total_consultations,
        "unique_users": unique_users,
        "debit_events": debit_events,
        "total_token_cost": total_debit_tokens,
        "total_token_cost_ia_equivalent": total_token_value_ia,
        "period_days": days,
        "last_consultation": last_consultation,
        "recent_consultations": recent_consultations,
    }))
}

/// Récupère les statistiques globales de consultations
pub async fn get_global_consultation_stats(
    mongo_history: Arc<MongoHistoryService>,
    days: Option<i64>,
) -> AppResult<serde_json::Value> {
    let stats = mongo_history.get_global_consultation_stats(days).await.map_err(|e| {
        AppError::Internal(format!("Erreur récupération stats globales MongoDB: {}", e))
    })?;

    Ok(stats)
}

fn event_timestamp(event: &HistoryEvent) -> DateTime<Utc> {
    event.timestamp.unwrap_or_else(|| Utc::now())
}

fn extract_token_cost(data: &Value) -> i64 {
    data.get("token_cost").and_then(|v| v.as_i64()).unwrap_or(0)
}

fn debit_applied(data: &Value) -> bool {
    data.get("debit_applied").and_then(|v| v.as_bool()).unwrap_or(false)
}

fn extract_event_id(event: &HistoryEvent) -> Option<String> {
    if let Some(metadata) = &event.metadata {
        if let Some(id) = metadata.get("event_id").and_then(|v| v.as_str()) {
            return Some(id.to_string());
        }
    }

    event.data.get("event_id").and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn build_legacy_event_id(event: &HistoryEvent) -> String {
    format!(
        "legacy-{}-{}-{}",
        event_timestamp(event).timestamp_millis(),
        event.user_id.unwrap_or_default(),
        event.service_id.unwrap_or_default()
    )
}

async fn enrich_history_event(
    pool: &PgPool,
    event: HistoryEvent,
) -> AppResult<ConsultationHistorique> {
    let mut metadata = event.metadata.clone();

    let mut service_snapshot: Option<ServiceHistorySnapshot> =
        parse_snapshot_from_metadata(&metadata, "service_snapshot");
    let mut provider_snapshot: Option<UserHistorySnapshot> =
        parse_snapshot_from_metadata(&metadata, "provider_snapshot");

    if let Some(Value::Object(meta)) = metadata.as_mut() {
        meta.remove("service_snapshot");
        meta.remove("provider_snapshot");
    }

    if service_snapshot.is_none() || provider_snapshot.is_none() {
        if let Some(service_id) = event.service_id {
            match fetch_service_and_provider_snapshot(pool, service_id).await? {
                Some((service_snap, provider_snap)) => {
                    if service_snapshot.is_none() {
                        service_snapshot = Some(service_snap);
                    }
                    if provider_snapshot.is_none() {
                        provider_snapshot = Some(provider_snap);
                    }
                }
                None => {
                    if service_snapshot.is_none() {
                        service_snapshot = Some(ServiceHistorySnapshot {
                            id: service_id,
                            provider_id: provider_snapshot
                                .as_ref()
                                .map(|p| p.id)
                                .unwrap_or_default(),
                            title: None,
                            category: None,
                            short_description: None,
                            cover_media: None,
                            city: None,
                            country: None,
                            is_active: None,
                            service_deleted: Some(true),
                        });
                    } else if let Some(snapshot) = service_snapshot.as_mut() {
                        snapshot.service_deleted.get_or_insert(true);
                    }
                }
            }
        }
    }

    if let Some(snapshot) = service_snapshot.as_mut() {
        if snapshot.service_deleted.is_none() {
            snapshot.service_deleted = Some(false);
        }
    }

    let event_id = extract_event_id(&event).unwrap_or_else(|| build_legacy_event_id(&event));
    let token_cost = extract_token_cost(&event.data);
    let debit = debit_applied(&event.data);
    let token_cost_ia_equivalent = if token_cost > 0 {
        Some(valeur_token_yukpo_en_token_ia(token_cost))
    } else {
        None
    };

    if let Some(meta) = metadata.as_mut() {
        sanitize_metadata_value(meta, 512);
    }

    Ok(ConsultationHistorique {
        id: 0,
        user_id: event.user_id.unwrap_or_default(),
        service_id: event.service_id.unwrap_or_default(),
        timestamp: Some(event_timestamp(&event)),
        event_id: Some(event_id),
        debit_applied: Some(debit),
        token_cost: Some(token_cost),
        token_cost_ia_equivalent,
        metadata,
        service_snapshot,
        provider_snapshot,
    })
}

fn parse_snapshot_from_metadata<T: DeserializeOwned>(
    metadata: &Option<Value>,
    key: &str,
) -> Option<T> {
    metadata
        .as_ref()
        .and_then(|meta| meta.get(key))
        .cloned()
        .and_then(|value| serde_json::from_value::<T>(value).ok())
}

async fn fetch_service_and_provider_snapshot(
    pool: &PgPool,
    service_id: i32,
) -> AppResult<Option<(ServiceHistorySnapshot, UserHistorySnapshot)>> {
    #[derive(sqlx::FromRow)]
    struct ServiceProviderSnapshotRow {
        user_id: i32,
        #[sqlx(rename = "data")]
        data: serde_json::Value,
        is_active: bool,
        category: Option<String>,
        provider_nom: Option<String>,
        provider_prenom: Option<String>,
        provider_nom_complet: Option<String>,
        provider_avatar_url: Option<String>,
        provider_tokens_balance: i64,
    }

    let record: Option<ServiceProviderSnapshotRow> = sqlx::query_as(
        r#"
            SELECT
                s.user_id,
                s.data,
                s.is_active,
                s.category,
                u.nom               AS provider_nom,
                u.prenom            AS provider_prenom,
                u.nom_complet       AS provider_nom_complet,
                u.avatar_url        AS provider_avatar_url,
                u.tokens_balance    AS provider_tokens_balance
            FROM services s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = $1
        "#,
    )
    .bind(service_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;

    if let Some(record) = record {
        let service_data: Value = record.data;
        let service_snapshot = build_service_snapshot(
            service_id,
            record.user_id,
            &service_data,
            record.category.clone(),
            record.is_active,
        );
        let provider_snapshot = build_provider_snapshot(
            record.user_id,
            record.provider_nom.clone(),
            record.provider_prenom.clone(),
            record.provider_nom_complet.clone(),
            record.provider_avatar_url.clone(),
            Some(record.provider_tokens_balance),
            None,
        );
        Ok(Some((service_snapshot, provider_snapshot)))
    } else {
        Ok(None)
    }
}

fn build_service_snapshot(
    service_id: i32,
    provider_id: i32,
    service_data: &Value,
    category: Option<String>,
    is_active: bool,
) -> ServiceHistorySnapshot {
    let title = extract_first_string(
        service_data,
        &[
            "titre_service",
            "title",
            "nom_service",
            "name",
            "service_title",
        ],
    );
    let description = extract_first_string(
        service_data,
        &[
            "description_service",
            "description",
            "resume",
            "details",
            "short_description",
        ],
    )
    .map(|text| truncate_text(&text, 180));
    let cover_media = extract_first_string(
        service_data,
        &[
            "media_principale",
            "cover",
            "image_principale",
            "base64_image",
            "images",
            "medias",
            "video_base64",
        ],
    );
    let city = extract_first_string(
        service_data,
        &[
            "ville_service",
            "ville",
            "city",
            "localisation_ville",
            "localisation",
        ],
    );
    let country = extract_first_string(
        service_data,
        &[
            "pays_service",
            "pays",
            "country",
            "localisation_pays",
            "nation",
        ],
    );

    ServiceHistorySnapshot {
        id: service_id,
        provider_id,
        title,
        category,
        short_description: description,
        cover_media,
        city,
        country,
        is_active: Some(is_active),
        service_deleted: Some(false),
    }
}

fn build_provider_snapshot(
    provider_id: i32,
    nom: Option<String>,
    prenom: Option<String>,
    nom_complet: Option<String>,
    avatar_url: Option<String>,
    tokens_before: Option<i64>,
    tokens_after: Option<i64>,
) -> UserHistorySnapshot {
    UserHistorySnapshot {
        id: provider_id,
        nom,
        prenom,
        nom_complet,
        avatar_url,
        tokens_balance_before: tokens_before,
        tokens_balance_after: tokens_after,
    }
}

fn extract_first_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(entry) = value.get(*key) {
            if let Some(text) = entry.as_str() {
                if !text.is_empty() {
                    return Some(text.to_string());
                }
            } else if let Some(array) = entry.as_array() {
                for element in array {
                    if let Some(text) = element.as_str() {
                        if !text.is_empty() {
                            return Some(text.to_string());
                        }
                    } else if let Some(obj) = element.as_object() {
                        if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
                            if !url.is_empty() {
                                return Some(url.to_string());
                            }
                        } else if let Some(val) = obj.get("value").and_then(|v| v.as_str()) {
                            if !val.is_empty() {
                                return Some(val.to_string());
                            }
                        }
                    }
                }
            } else if let Some(obj) = entry.as_object() {
                if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        return Some(url.to_string());
                    }
                } else if let Some(val) = obj.get("value").and_then(|v| v.as_str()) {
                    if !val.is_empty() {
                        return Some(val.to_string());
                    }
                }
            }
        }
    }
    None
}

fn truncate_text(text: &str, max_len: usize) -> String {
    if text.len() <= max_len {
        text.to_string()
    } else {
        let mut truncated = text[..max_len.saturating_sub(3)].to_string();
        truncated.push_str("...");
        truncated
    }
}

fn sanitize_metadata_value(value: &mut Value, max_len: usize) {
    match value {
        Value::String(s) if s.len() > max_len => {
            s.truncate(max_len.saturating_sub(3));
            s.push_str("...");
        }
        Value::Array(arr) => {
            for item in arr {
                sanitize_metadata_value(item, max_len);
            }
        }
        Value::Object(map) => {
            for val in map.values_mut() {
                sanitize_metadata_value(val, max_len);
            }
        }
        _ => {}
    }
}
