// Contrôleur pour la gestion des horaires de départ par agence/ville
// Permet aux agences de définir et gérer les horaires disponibles pour chaque trajet

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::NaiveTime;
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub departure_city: String,
    pub arrival_city: String,
    pub departure_times: Vec<String>, // ["08:00", "14:00", "20:00"]
    pub day_of_week: Option<i32>,     // 0=Dimanche, 1=Lundi, ..., 6=Samedi (NULL = tous les jours)
    pub bus_model_id: Option<String>, // UUID products.id (ticket_voyage)
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub departure_times: Option<Vec<String>>,
    /// Convention PostgreSQL DOW : 0=Dimanche, 1=Lundi, 2=Mardi, 3=Mercredi,
    /// 4=Jeudi, 5=Vendredi, 6=Samedi.  NULL = actif tous les jours.
    /// Cohérent avec EXTRACT(DOW FROM ...) et naive_date_to_pg_dow() dans le cron.
    pub day_of_week: Option<i32>,
    pub is_active: Option<bool>,
    pub bus_model_id: Option<String>, // UUID products.id (ticket_voyage)
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScheduleResponse {
    pub id: String,
    pub agency_user_id: i32,
    pub departure_city: String,
    pub arrival_city: String,
    pub departure_times: Vec<String>,
    pub day_of_week: Option<i32>,
    pub bus_model_id: Option<String>,
    pub bus_model_name: Option<String>,
    pub total_seats: Option<i32>,
    pub occupied_seats: i32,
    pub available_seats: i32,
    pub next_departure_at: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct GetSchedulesQuery {
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub day_of_week: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct GetAvailableTimesQuery {
    pub from: String,         // departure_city
    pub to: String,           // arrival_city
    pub date: Option<String>, // Format YYYY-MM-DD (optionnel)
}

fn parse_optional_uuid(value: &Option<String>, field_name: &str) -> Result<Option<Uuid>, AppError> {
    match value {
        Some(raw) if !raw.trim().is_empty() => Uuid::parse_str(raw.trim())
            .map(Some)
            .map_err(|_| AppError::BadRequest(format!("{} invalide (UUID attendu)", field_name))),
        _ => Ok(None),
    }
}

// ============================================================================
// CRÉER UN HORAIRE
// ============================================================================

/// Créer un nouvel horaire pour une agence
pub async fn create_schedule(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateScheduleRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_schedule] User ID: {}, Route: {} → {}",
        user_id, payload.departure_city, payload.arrival_city
    );

    // Vérifier que l'utilisateur est une agence
    let is_agency: bool = sqlx::query_scalar("SELECT is_provider FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_schedule] Erreur vérification agence: {}", e);
            AppError::Internal(format!("Erreur vérification agence: {}", e))
        })?;

    if !is_agency {
        return Err(AppError::Forbidden(
            "Seules les agences peuvent créer des horaires".to_string(),
        ));
    }

    // Valider les horaires (format HH:MM)
    let mut validated_times: Vec<NaiveTime> = Vec::new();
    for time_str in &payload.departure_times {
        match NaiveTime::parse_from_str(time_str, "%H:%M") {
            Ok(time) => validated_times.push(time),
            Err(_) => {
                return Err(AppError::BadRequest(format!(
                    "Format d'heure invalide: {}. Format attendu: HH:MM",
                    time_str
                )));
            }
        }
    }

    if validated_times.is_empty() {
        return Err(AppError::BadRequest(
            "Au moins un horaire doit être fourni".to_string(),
        ));
    }

    // Valider day_of_week si fourni
    if let Some(day) = payload.day_of_week {
        if day < 0 || day > 6 {
            return Err(AppError::BadRequest(
                "day_of_week doit être entre 0 (Dimanche) et 6 (Samedi)".to_string(),
            ));
        }
    }

    // Convertir en TIME[] pour PostgreSQL
    let times_array: Vec<String> =
        validated_times.iter().map(|t| t.format("%H:%M:%S").to_string()).collect();
    let bus_model_uuid = parse_optional_uuid(&payload.bus_model_id, "bus_model_id")?;

    // Insérer l'horaire
    let schedule_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO agency_departure_schedules (
            agency_user_id,
            departure_city,
            arrival_city,
            departure_times,
            day_of_week,
            bus_model_id,
            notes,
            is_active
        )
        VALUES ($1, $2, $3, $4::TIME[], $5, $6, $7, TRUE)
        ON CONFLICT (agency_user_id, departure_city, arrival_city, day_of_week)
        DO UPDATE SET
            departure_times = EXCLUDED.departure_times,
            bus_model_id = COALESCE(EXCLUDED.bus_model_id, agency_departure_schedules.bus_model_id),
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&payload.departure_city)
    .bind(&payload.arrival_city)
    .bind(&times_array)
    .bind(&payload.day_of_week)
    .bind(bus_model_uuid)
    .bind(&payload.notes)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_schedule] Erreur insertion: {}", e);
        AppError::Internal(format!("Erreur création horaire: {}", e))
    })?;

    // Récupérer l'horaire créé
    let schedule = get_schedule_by_id(&state.pg, &schedule_id).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "schedule": schedule
        })),
    ))
}

// ============================================================================
// RÉCUPÉRER LES HORAIRES D'UNE AGENCE
// ============================================================================

/// Récupérer tous les horaires d'une agence (avec filtres optionnels)
pub async fn get_agency_schedules(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<GetSchedulesQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[get_agency_schedules] User ID: {}", user_id);

    let mut sql = String::from(
        r#"
        SELECT 
            ads.id,
            ads.agency_user_id,
            ads.departure_city,
            ads.arrival_city,
            ads.departure_times,
            ads.day_of_week,
            ads.bus_model_id::text AS bus_model_id,
            bp.name AS bus_model_name,
            COALESCE(occ.total_seats, bp.total_seats) AS total_seats,
            COALESCE(occ.occupied_seats, 0) AS occupied_seats,
            GREATEST(0, COALESCE(occ.total_seats, bp.total_seats, 0) - COALESCE(occ.occupied_seats, 0)) AS available_seats,
            occ.next_departure_at,
            ads.is_active,
            ads.notes,
            ads.created_at,
            ads.updated_at
        FROM agency_departure_schedules ads
        LEFT JOIN products bp ON bp.id = ads.bus_model_id
        LEFT JOIN LATERAL (
            SELECT
                p.id::text AS product_id,
                p.total_seats,
                p.date_depart AS next_departure_at,
                COALESCE((
                    SELECT COUNT(*)::INTEGER
                    FROM bus_reservations br
                    WHERE br.product_id = p.id::text
                      AND br.status IN ('pending', 'confirmed')
                      AND (br.expires_at IS NULL OR br.expires_at > NOW())
                ), 0) AS occupied_seats
            FROM products p
            WHERE p.source_schedule_id = ads.id
              AND p.type = 'ticket_voyage'
              AND p.date_depart >= NOW()
            ORDER BY p.date_depart ASC
            LIMIT 1
        ) occ ON TRUE
        WHERE ads.agency_user_id = $1
        "#,
    );

    let mut params: Vec<String> = vec![user_id.to_string()];
    let mut param_index = 2;

    if let Some(ref city) = query.departure_city {
        sql.push_str(&format!(" AND ads.departure_city = ${}", param_index));
        params.push(city.clone());
        param_index += 1;
    }

    if let Some(ref city) = query.arrival_city {
        sql.push_str(&format!(" AND ads.arrival_city = ${}", param_index));
        params.push(city.clone());
        param_index += 1;
    }

    if let Some(day) = query.day_of_week {
        sql.push_str(&format!(" AND ads.day_of_week = ${}", param_index));
        params.push(day.to_string());
        param_index += 1;
    }

    if let Some(active) = query.is_active {
        sql.push_str(&format!(" AND ads.is_active = ${}", param_index));
        params.push(active.to_string());
        param_index += 1;
    }

    // param_index est utilisé dans les format! ci-dessus pour construire la requête SQL
    let _ = param_index;

    sql.push_str(" ORDER BY ads.departure_city, ads.arrival_city, ads.day_of_week NULLS FIRST");

    // Construire la requête dynamique
    let mut query_builder = sqlx::query(&sql).bind(user_id);

    if let Some(ref city) = query.departure_city {
        query_builder = query_builder.bind(city);
    }
    if let Some(ref city) = query.arrival_city {
        query_builder = query_builder.bind(city);
    }
    if let Some(day) = query.day_of_week {
        query_builder = query_builder.bind(day);
    }
    if let Some(active) = query.is_active {
        query_builder = query_builder.bind(active);
    }

    let rows = query_builder.fetch_all(&state.pg).await.map_err(|e| {
        error!("[get_agency_schedules] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération horaires: {}", e))
    })?;

    let mut schedules = Vec::new();
    for row in rows {
        let departure_times: Vec<chrono::NaiveTime> =
            row.get::<Vec<chrono::NaiveTime>, _>("departure_times");
        let times_str: Vec<String> =
            departure_times.iter().map(|t| t.format("%H:%M").to_string()).collect();

        schedules.push(ScheduleResponse {
            id: row.get::<String, _>("id"),
            agency_user_id: row.get::<i32, _>("agency_user_id"),
            departure_city: row.get::<String, _>("departure_city"),
            arrival_city: row.get::<String, _>("arrival_city"),
            departure_times: times_str,
            day_of_week: row.get::<Option<i32>, _>("day_of_week"),
            bus_model_id: row.get::<Option<String>, _>("bus_model_id"),
            bus_model_name: row.get::<Option<String>, _>("bus_model_name"),
            total_seats: row.get::<Option<i32>, _>("total_seats"),
            occupied_seats: row.get::<i32, _>("occupied_seats"),
            available_seats: row.get::<i32, _>("available_seats"),
            next_departure_at: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("next_departure_at")
                .map(|dt| dt.to_rfc3339()),
            is_active: row.get::<bool, _>("is_active"),
            notes: row.get::<Option<String>, _>("notes"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
        });
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "schedules": schedules
        })),
    ))
}

// ============================================================================
// RÉCUPÉRER LES HORAIRES DISPONIBLES POUR UN TRAJET
// ============================================================================

/// Récupérer les horaires disponibles pour un trajet spécifique
/// Utilise la fonction SQL get_available_departure_times
pub async fn get_available_times(
    State(state): State<Arc<AppState>>,
    Path(agency_id): Path<i32>,
    Query(query): Query<GetAvailableTimesQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_available_times] Agency ID: {}, Route: {} → {}",
        agency_id, query.from, query.to
    );

    // Parser la date si fournie
    let date_param: Option<chrono::NaiveDate> = query
        .date
        .clone()
        .and_then(|d| chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok());

    // Appeler la fonction SQL
    let rows = sqlx::query(
        r#"
        SELECT 
            departure_time,
            day_of_week,
            is_specific_day
        FROM get_available_departure_times($1, $2, $3, $4)
        ORDER BY day_of_week NULLS FIRST, departure_time
        "#,
    )
    .bind(agency_id)
    .bind(&query.from)
    .bind(&query.to)
    .bind(date_param)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_available_times] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération horaires disponibles: {}", e))
    })?;

    let mut times = Vec::new();
    for row in rows {
        let time: chrono::NaiveTime = row.get::<chrono::NaiveTime, _>("departure_time");
        times.push(json!({
            "time": time.format("%H:%M").to_string(),
            "day_of_week": row.get::<Option<i32>, _>("day_of_week"),
            "is_specific_day": row.get::<bool, _>("is_specific_day")
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "agency_id": agency_id,
            "from": query.from,
            "to": query.to,
            "date": query.date,
            "available_times": times
        })),
    ))
}

// ============================================================================
// MODIFIER UN HORAIRE
// ============================================================================

/// Modifier un horaire existant
pub async fn update_schedule(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(schedule_id): Path<String>,
    Json(payload): Json<UpdateScheduleRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_schedule] User ID: {}, Schedule ID: {}",
        user_id, schedule_id
    );

    // Vérifier que l'horaire appartient à l'agence
    let schedule_agency_id: Option<i32> =
        sqlx::query_scalar("SELECT agency_user_id FROM agency_departure_schedules WHERE id = $1")
            .bind(&schedule_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[update_schedule] Erreur vérification: {}", e);
                AppError::Internal(format!("Erreur vérification horaire: {}", e))
            })?;

    match schedule_agency_id {
        Some(agency_id) if agency_id == user_id => {
            // OK, l'horaire appartient à l'agence
        }
        Some(_) => {
            return Err(AppError::Forbidden(
                "Cet horaire n'appartient pas à votre agence".to_string(),
            ));
        }
        None => {
            return Err(AppError::NotFound("Horaire non trouvé".to_string()));
        }
    }

    // Vérifier qu'au moins un champ est modifié
    if payload.departure_times.is_none()
        && payload.day_of_week.is_none()
        && payload.is_active.is_none()
        && payload.bus_model_id.is_none()
        && payload.notes.is_none()
    {
        return Err(AppError::BadRequest(
            "Aucune modification à effectuer".to_string(),
        ));
    }

    // Valider day_of_week si fourni (0=Dim … 6=Sam, cohérent avec PostgreSQL DOW)
    if let Some(day) = payload.day_of_week {
        if !(0..=6).contains(&day) {
            return Err(AppError::BadRequest(
                "day_of_week doit être entre 0 (Dimanche) et 6 (Samedi)".to_string(),
            ));
        }
    }

    // Approche simplifiée : requêtes séparées selon les champs modifiés
    if payload.departure_times.is_some()
        || payload.day_of_week.is_some()
        || payload.is_active.is_some()
        || payload.bus_model_id.is_some()
        || payload.notes.is_some()
    {
        let times_array = if let Some(ref times) = payload.departure_times {
            let mut validated_times: Vec<NaiveTime> = Vec::new();
            for time_str in times {
                match NaiveTime::parse_from_str(time_str, "%H:%M") {
                    Ok(time) => validated_times.push(time),
                    Err(_) => {
                        return Err(AppError::BadRequest(format!(
                            "Format d'heure invalide: {}",
                            time_str
                        )));
                    }
                }
            }
            Some(
                validated_times
                    .iter()
                    .map(|t| t.format("%H:%M:%S").to_string())
                    .collect::<Vec<String>>(),
            )
        } else {
            None
        };
        let bus_model_uuid = parse_optional_uuid(&payload.bus_model_id, "bus_model_id")?;

        sqlx::query(
            r#"
            UPDATE agency_departure_schedules
            SET 
                departure_times = COALESCE($1::TIME[], departure_times),
                day_of_week = COALESCE($2, day_of_week),
                is_active = COALESCE($3, is_active),
                bus_model_id = COALESCE($4, bus_model_id),
                notes = COALESCE($5, notes),
                updated_at = NOW()
            WHERE id = $6
            "#,
        )
        .bind(&times_array)
        .bind(&payload.day_of_week)
        .bind(&payload.is_active)
        .bind(bus_model_uuid)
        .bind(&payload.notes)
        .bind(&schedule_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            error!("[update_schedule] Erreur mise à jour: {}", e);
            AppError::Internal(format!("Erreur mise à jour horaire: {}", e))
        })?;
    }

    // Récupérer l'horaire mis à jour
    let schedule = get_schedule_by_id(&state.pg, &schedule_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "schedule": schedule
        })),
    ))
}

// ============================================================================
// SUPPRIMER UN HORAIRE
// ============================================================================

/// Supprimer un horaire (soft delete: is_active = FALSE)
pub async fn delete_schedule(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(schedule_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_schedule] User ID: {}, Schedule ID: {}",
        user_id, schedule_id
    );

    // Vérifier que l'horaire appartient à l'agence
    let schedule_agency_id: Option<i32> =
        sqlx::query_scalar("SELECT agency_user_id FROM agency_departure_schedules WHERE id = $1")
            .bind(&schedule_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[delete_schedule] Erreur vérification: {}", e);
                AppError::Internal(format!("Erreur vérification horaire: {}", e))
            })?;

    match schedule_agency_id {
        Some(agency_id) if agency_id == user_id => {
            // OK, soft delete
            sqlx::query(
                "UPDATE agency_departure_schedules SET is_active = FALSE, updated_at = NOW() WHERE id = $1"
            )
            .bind(&schedule_id)
            .execute(&state.pg)
            .await
            .map_err(|e| {
                error!("[delete_schedule] Erreur suppression: {}", e);
                AppError::Internal(format!("Erreur suppression horaire: {}", e))
            })?;

            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Horaire désactivé avec succès"
                })),
            ))
        }
        Some(_) => Err(AppError::Forbidden(
            "Cet horaire n'appartient pas à votre agence".to_string(),
        )),
        None => Err(AppError::NotFound("Horaire non trouvé".to_string())),
    }
}

// ============================================================================
// FONCTION HELPER
// ============================================================================

async fn get_schedule_by_id(
    pool: &sqlx::PgPool,
    schedule_id: &str,
) -> Result<ScheduleResponse, AppError> {
    let row = sqlx::query(
        r#"
        SELECT 
            ads.id,
            ads.agency_user_id,
            ads.departure_city,
            ads.arrival_city,
            ads.departure_times,
            ads.day_of_week,
            ads.bus_model_id::text AS bus_model_id,
            bp.name AS bus_model_name,
            COALESCE(occ.total_seats, bp.total_seats) AS total_seats,
            COALESCE(occ.occupied_seats, 0) AS occupied_seats,
            GREATEST(0, COALESCE(occ.total_seats, bp.total_seats, 0) - COALESCE(occ.occupied_seats, 0)) AS available_seats,
            occ.next_departure_at,
            ads.is_active,
            ads.notes,
            ads.created_at,
            ads.updated_at
        FROM agency_departure_schedules ads
        LEFT JOIN products bp ON bp.id = ads.bus_model_id
        LEFT JOIN LATERAL (
            SELECT
                p.id::text AS product_id,
                p.total_seats,
                p.date_depart AS next_departure_at,
                COALESCE((
                    SELECT COUNT(*)::INTEGER
                    FROM bus_reservations br
                    WHERE br.product_id = p.id::text
                      AND br.status IN ('pending', 'confirmed')
                      AND (br.expires_at IS NULL OR br.expires_at > NOW())
                ), 0) AS occupied_seats
            FROM products p
            WHERE p.source_schedule_id = ads.id
              AND p.type = 'ticket_voyage'
              AND p.date_depart >= NOW()
            ORDER BY p.date_depart ASC
            LIMIT 1
        ) occ ON TRUE
        WHERE ads.id = $1
        "#,
    )
    .bind(schedule_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[get_schedule_by_id] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération horaire: {}", e))
    })?;

    match row {
        Some(row) => {
            let departure_times: Vec<chrono::NaiveTime> =
                row.get::<Vec<chrono::NaiveTime>, _>("departure_times");
            let times_str: Vec<String> =
                departure_times.iter().map(|t| t.format("%H:%M").to_string()).collect();

            Ok(ScheduleResponse {
                id: row.get::<String, _>("id"),
                agency_user_id: row.get::<i32, _>("agency_user_id"),
                departure_city: row.get::<String, _>("departure_city"),
                arrival_city: row.get::<String, _>("arrival_city"),
                departure_times: times_str,
                day_of_week: row.get::<Option<i32>, _>("day_of_week"),
                bus_model_id: row.get::<Option<String>, _>("bus_model_id"),
                bus_model_name: row.get::<Option<String>, _>("bus_model_name"),
                total_seats: row.get::<Option<i32>, _>("total_seats"),
                occupied_seats: row.get::<i32, _>("occupied_seats"),
                available_seats: row.get::<i32, _>("available_seats"),
                next_departure_at: row
                    .get::<Option<chrono::DateTime<chrono::Utc>>, _>("next_departure_at")
                    .map(|dt| dt.to_rfc3339()),
                is_active: row.get::<bool, _>("is_active"),
                notes: row.get::<Option<String>, _>("notes"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
            })
        }
        None => Err(AppError::NotFound("Horaire non trouvé".to_string())),
    }
}

// ─── SUCCURSALES AGENCE ──────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct AgenceBranchRequest {
    pub nom: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
}

/// Succursale agence = agence enfant (parent_agence_id IS NOT NULL)
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AgenceBranch {
    pub id: i32,
    pub service_id: i32,
    pub parent_agence_id: Option<i32>,
    pub nom_agence: String,
    pub adresse: Option<String>,
    pub quartier: Option<String>,
    pub ville: Option<String>,
    pub gps: Option<String>,
    pub telephone: Option<String>,
    pub is_active: bool,
}

/// GET /api/agences/branches  — succursales de l'agence principale de l'utilisateur
pub async fn list_agence_branches(
    State(state): State<Arc<crate::state::AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
) -> crate::core::types::AppResult<impl axum::response::IntoResponse> {
    // Trouver l'agence principale (sans parent)
    let agence_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM agences_voyage WHERE user_id = $1 AND is_active = TRUE AND parent_agence_id IS NULL LIMIT 1",
    )
    .bind(user.id).fetch_optional(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    let Some(agence_id) = agence_id else {
        return Ok(axum::Json(
            serde_json::json!({ "success": true, "branches": [] }),
        ));
    };

    let branches: Vec<AgenceBranch> = sqlx::query_as(
        r#"SELECT id, service_id, parent_agence_id, nom_agence, adresse, quartier, ville, gps, telephone, is_active
           FROM agences_voyage
           WHERE parent_agence_id = $1 AND is_active = TRUE
           ORDER BY nom_agence ASC"#,
    ).bind(agence_id).fetch_all(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(format!("Erreur branches: {}", e)))?;

    Ok(axum::Json(
        serde_json::json!({ "success": true, "branches": branches }),
    ))
}

/// POST /api/agences/branches — crée une succursale autonome (services + agences_voyage enfant)
pub async fn create_agence_branch(
    State(state): State<Arc<crate::state::AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    axum::Json(payload): axum::Json<AgenceBranchRequest>,
) -> crate::core::types::AppResult<impl axum::response::IntoResponse> {
    let agence_id: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM agences_voyage WHERE user_id = $1 AND is_active = TRUE AND parent_agence_id IS NULL LIMIT 1",
    )
    .bind(user.id).fetch_optional(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    let agence_id = agence_id.ok_or_else(|| {
        crate::core::types::AppError::NotFound("Agence principale non trouvée".into())
    })?;

    // 1. Créer un service dédié à la succursale
    let branch_service_id: i32 = sqlx::query_scalar(
        r#"INSERT INTO services (user_id, titre_service, description, category, specialized_type, is_active, created_at, updated_at)
           VALUES ($1, $2, 'Succursale agence de voyage', 'voyage', 'agence_voyage', TRUE, NOW(), NOW())
           RETURNING id"#,
    )
    .bind(user.id).bind(&payload.nom)
    .fetch_one(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(format!("Erreur création service succursale: {}", e)))?;

    // 2. Créer l'agence enfant liée au service + parent
    let branch: AgenceBranch = sqlx::query_as(
        r#"INSERT INTO agences_voyage (service_id, user_id, nom_agence, adresse, quartier, ville, gps, telephone, is_active, parent_agence_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, NOW(), NOW())
           RETURNING id, service_id, parent_agence_id, nom_agence, adresse, quartier, ville, gps, telephone, is_active"#,
    )
    .bind(branch_service_id).bind(user.id)
    .bind(&payload.nom).bind(&payload.adresse).bind(&payload.quartier)
    .bind(&payload.ville).bind(&payload.gps).bind(&payload.telephone)
    .bind(agence_id)
    .fetch_one(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(format!("Erreur création succursale agence: {}", e)))?;

    Ok((
        axum::http::StatusCode::CREATED,
        axum::Json(serde_json::json!({ "success": true, "branch": branch })),
    ))
}

/// PATCH /api/agences/branches/{id}
pub async fn update_agence_branch(
    State(state): State<Arc<crate::state::AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    axum::extract::Path(branch_id): axum::extract::Path<i32>,
    axum::Json(payload): axum::Json<AgenceBranchRequest>,
) -> crate::core::types::AppResult<impl axum::response::IntoResponse> {
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agences_voyage WHERE id = $1 AND user_id = $2 AND parent_agence_id IS NOT NULL)"
    ).bind(branch_id).bind(user.id).fetch_one(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(crate::core::types::AppError::Forbidden(
            "Accès refusé".into(),
        ));
    }

    sqlx::query(
        "UPDATE agences_voyage SET nom_agence=$1, adresse=$2, quartier=$3, ville=$4, gps=$5, telephone=$6, updated_at=NOW() WHERE id=$7"
    )
    .bind(&payload.nom).bind(&payload.adresse).bind(&payload.quartier)
    .bind(&payload.ville).bind(&payload.gps).bind(&payload.telephone).bind(branch_id)
    .execute(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    // Synchroniser le titre du service
    sqlx::query(
        "UPDATE services SET titre_service=$1, updated_at=NOW() WHERE id = (SELECT service_id FROM agences_voyage WHERE id=$2)"
    )
    .bind(&payload.nom).bind(branch_id)
    .execute(&state.pg).await.ok();

    Ok(axum::Json(serde_json::json!({ "success": true })))
}

/// DELETE /api/agences/branches/{id}
pub async fn delete_agence_branch(
    State(state): State<Arc<crate::state::AppState>>,
    Extension(user): Extension<crate::middlewares::jwt::AuthenticatedUser>,
    axum::extract::Path(branch_id): axum::extract::Path<i32>,
) -> crate::core::types::AppResult<impl axum::response::IntoResponse> {
    let owned: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agences_voyage WHERE id = $1 AND user_id = $2 AND parent_agence_id IS NOT NULL)"
    ).bind(branch_id).bind(user.id).fetch_one(&state.pg).await
    .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;
    if !owned {
        return Err(crate::core::types::AppError::Forbidden(
            "Accès refusé".into(),
        ));
    }

    sqlx::query("UPDATE agences_voyage SET is_active=FALSE, updated_at=NOW() WHERE id=$1")
        .bind(branch_id)
        .execute(&state.pg)
        .await
        .map_err(|e| crate::core::types::AppError::Internal(e.to_string()))?;

    sqlx::query(
        "UPDATE services SET is_active=FALSE, updated_at=NOW() WHERE id=(SELECT service_id FROM agences_voyage WHERE id=$1)"
    )
    .bind(branch_id).execute(&state.pg).await.ok();

    Ok(axum::Json(serde_json::json!({ "success": true })))
}
