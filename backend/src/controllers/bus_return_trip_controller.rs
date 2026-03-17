// Contrôleur pour la gestion des demandes de retour (aller-retour)
// Gère la création, le listing, et la confirmation des demandes de retour

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateReturnTripRequestPayload {
    pub outbound_payment_id: String,           // ID du paiement aller
    pub preferred_return_date: String,         // Format: DD/MM/YYYY
    pub preferred_return_time: Option<String>, // Format: HH:MM (optionnel)
    pub date_flexibility_days: Option<i32>,    // Flexibilité en jours (défaut: 1)
    pub passenger_names: Vec<String>,          // Noms des passagers
    pub number_of_seats: i32,                  // Nombre de places souhaitées
    pub already_paid: Option<bool>,            // Si payé avec l'aller (défaut: false)
    pub paid_amount: Option<i32>,              // Montant déjà payé si applicable
}

#[derive(Debug, Serialize)]
pub struct ReturnTripRequestResponse {
    pub id: String,
    pub outbound_payment_id: String,
    pub return_from: String,
    pub return_to: String,
    pub preferred_return_date: String,
    pub preferred_return_time: Option<String>,
    pub date_flexibility_days: i32,
    pub passenger_names: Vec<String>,
    pub number_of_seats: i32,
    pub status: String,
    pub matched_product_id: Option<String>,
    pub matched_at: Option<String>,
    pub notification_sent: bool,
    pub created_at: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize)]
pub struct ReturnTripRequestListItem {
    pub id: String,
    pub outbound_payment_id: String,
    pub return_from: String,
    pub return_to: String,
    pub preferred_return_date: String,
    pub preferred_return_time: Option<String>,
    pub status: String,
    pub matched_product_id: Option<String>,
    pub number_of_seats: i32,
    pub created_at: String,
}

// ============================================================================
// CRÉER UNE DEMANDE DE RETOUR
// ============================================================================

/// POST /api/bus-tickets/return-request
/// Créer une demande de retour après avoir acheté un ticket aller
pub async fn create_return_trip_request(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateReturnTripRequestPayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_return_trip_request] User ID: {}, Outbound Payment ID: {}",
        user_id, payload.outbound_payment_id
    );

    // 1. Vérifier que le paiement aller existe et appartient à l'utilisateur
    let outbound_ticket: Option<(String, String, String)> = sqlx::query(
        r#"
        SELECT 
            departure_city,
            arrival_city,
            product_id
        FROM bus_ticket_payments
        WHERE id = $1 AND user_id = $2 AND payment_status = 'completed'
        "#,
    )
    .bind(&payload.outbound_payment_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[create_return_trip_request] Erreur vérification ticket aller: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification ticket aller: {}", e))
    })?
    .map(|row| {
        use sqlx::Row;
        (
            row.get::<String, _>("departure_city"),
            row.get::<String, _>("arrival_city"),
            row.get::<String, _>("product_id"),
        )
    });

    let (departure_city, arrival_city, outbound_product_id) = match outbound_ticket {
        Some(ticket) => ticket,
        None => {
            return Err(AppError::NotFound(
                "Ticket aller non trouvé ou non payé".to_string(),
            ));
        }
    };

    // 2. Vérifier qu'il n'y a pas déjà une demande de retour active pour ce ticket
    let existing_request: Option<String> = sqlx::query_scalar(
        r#"
        SELECT id FROM return_trip_requests
        WHERE outbound_payment_id = $1 
            AND user_id = $2
            AND status IN ('pending', 'matched')
        "#,
    )
    .bind(&payload.outbound_payment_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[create_return_trip_request] Erreur vérification demande existante: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification demande existante: {}", e))
    })?;

    if existing_request.is_some() {
        return Err(AppError::Conflict(
            "Une demande de retour existe déjà pour ce ticket aller".to_string(),
        ));
    }

    // 3. Créer la demande de retour
    let request_id = Uuid::new_v4().to_string();
    let date_flexibility = payload.date_flexibility_days.unwrap_or(1);
    let already_paid = payload.already_paid.unwrap_or(false);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(90);

    // Route retour = inverse de l'aller (arrival_city -> departure_city)
    let return_from = arrival_city.clone();
    let return_to = departure_city.clone();

    sqlx::query(
        r#"
        INSERT INTO return_trip_requests (
            id,
            user_id,
            outbound_ticket_id,
            outbound_payment_id,
            return_from,
            return_to,
            preferred_return_date,
            preferred_return_time,
            date_flexibility_days,
            passenger_names,
            number_of_seats,
            already_paid,
            paid_amount,
            status,
            expires_at,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, NOW(), NOW())
        "#
    )
    .bind(&request_id)
    .bind(user_id)
    .bind(&outbound_product_id)
    .bind(&payload.outbound_payment_id)
    .bind(&return_from)
    .bind(&return_to)
    .bind(&payload.preferred_return_date)
    .bind(&payload.preferred_return_time.as_deref())
    .bind(date_flexibility)
    .bind(&payload.passenger_names)
    .bind(payload.number_of_seats)
    .bind(already_paid)
    .bind(payload.paid_amount)
    .bind(expires_at)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_return_trip_request] Erreur création demande: {}", e);
        AppError::Internal(format!("Erreur création demande: {}", e))
    })?;

    // 4. Essayer de matcher automatiquement avec des buses existants
    // Utiliser la fonction SQL existante match_return_trip_requests avec le request_id
    // Note: Le matching se fera automatiquement quand un bus retour sera créé
    // Pour l'instant, on peut simplement vérifier s'il existe déjà des buses correspondants
    let matching_result: Option<Value> = sqlx::query_scalar(
        r#"
        SELECT jsonb_build_object(
            'matched', EXISTS(
                SELECT 1 FROM products p
                WHERE p.type = 'ticket_voyage'
                    AND (p.metadata->>'departure_city')::text = $1
                    AND (p.metadata->>'arrival_city')::text = $2
                    AND (p.metadata->>'departure_date')::date BETWEEN 
                        ($3::date - INTERVAL '1 day' * $4) 
                        AND ($3::date + INTERVAL '1 day' * $4)
                    AND p.total_seats >= $5
            )
        )
        "#,
    )
    .bind(&return_from)
    .bind(&return_to)
    .bind(&payload.preferred_return_date)
    .bind(date_flexibility)
    .bind(payload.number_of_seats)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    // Si un match est trouvé, on le traitera dans un job séparé ou on notifie immédiatement
    if let Some(result) = matching_result {
        let matched = result.get("matched").and_then(|v| v.as_bool()).unwrap_or(false);
        if matched {
            info!(
                "[create_return_trip_request] Match trouvé immédiatement pour request_id: {}",
                request_id
            );
            // TODO: Envoyer notification push
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "request_id": request_id,
            "message": "Demande de retour créée avec succès. Vous serez notifié quand un bus correspondant sera disponible."
        })),
    ))
}

// ============================================================================
// LISTER LES DEMANDES DE RETOUR D'UN UTILISATEUR
// ============================================================================

/// GET /api/bus-tickets/return-requests
/// Lister toutes les demandes de retour de l'utilisateur
pub async fn list_return_trip_requests(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[list_return_trip_requests] User ID: {}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            outbound_payment_id,
            return_from,
            return_to,
            preferred_return_date,
            preferred_return_time,
            status,
            matched_product_id,
            number_of_seats,
            created_at
        FROM return_trip_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[list_return_trip_requests] Erreur récupération demandes: {}",
            e
        );
        AppError::Internal(format!("Erreur récupération demandes: {}", e))
    })?;

    let requests: Vec<ReturnTripRequestListItem> = rows
        .into_iter()
        .map(|row| ReturnTripRequestListItem {
            id: row.get::<String, _>("id"),
            outbound_payment_id: row.get::<String, _>("outbound_payment_id"),
            return_from: row.get::<String, _>("return_from"),
            return_to: row.get::<String, _>("return_to"),
            preferred_return_date: row.get::<String, _>("preferred_return_date"),
            preferred_return_time: row
                .try_get::<Option<String>, _>("preferred_return_time")
                .ok()
                .flatten(),
            status: row.get::<String, _>("status"),
            matched_product_id: row
                .try_get::<Option<String>, _>("matched_product_id")
                .ok()
                .flatten(),
            number_of_seats: row.get::<i32, _>("number_of_seats"),
            created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "requests": requests
        })),
    ))
}

// ============================================================================
// RÉCUPÉRER LES DÉTAILS D'UNE DEMANDE DE RETOUR
// ============================================================================

/// GET /api/bus-tickets/return-request/{request_id}
/// Récupérer les détails complets d'une demande de retour
pub async fn get_return_trip_request(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(request_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_return_trip_request] User ID: {}, Request ID: {}",
        user_id, request_id
    );

    let row = sqlx::query(
        r#"
        SELECT 
            id,
            outbound_payment_id,
            return_from,
            return_to,
            preferred_return_date,
            preferred_return_time,
            date_flexibility_days,
            passenger_names,
            number_of_seats,
            status,
            matched_product_id,
            matched_at,
            notification_sent,
            created_at,
            expires_at
        FROM return_trip_requests
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(&request_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[get_return_trip_request] Erreur récupération demande: {}",
            e
        );
        AppError::Internal(format!("Erreur récupération demande: {}", e))
    })?;

    match row {
        Some(row) => {
            let request = ReturnTripRequestResponse {
                id: row.get::<String, _>("id"),
                outbound_payment_id: row.get::<String, _>("outbound_payment_id"),
                return_from: row.get::<String, _>("return_from"),
                return_to: row.get::<String, _>("return_to"),
                preferred_return_date: row.get::<String, _>("preferred_return_date"),
                preferred_return_time: row
                    .try_get::<Option<String>, _>("preferred_return_time")
                    .ok()
                    .flatten(),
                date_flexibility_days: row.get::<i32, _>("date_flexibility_days"),
                passenger_names: row.get::<Vec<String>, _>("passenger_names"),
                number_of_seats: row.get::<i32, _>("number_of_seats"),
                status: row.get::<String, _>("status"),
                matched_product_id: row
                    .try_get::<Option<String>, _>("matched_product_id")
                    .ok()
                    .flatten(),
                matched_at: row
                    .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("matched_at")
                    .ok()
                    .flatten()
                    .map(|dt| dt.to_rfc3339()),
                notification_sent: row.get::<bool, _>("notification_sent"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                expires_at: row.get::<chrono::DateTime<chrono::Utc>, _>("expires_at").to_rfc3339(),
            };
            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "request": request
                })),
            ))
        }
        None => Err(AppError::NotFound(
            "Demande de retour non trouvée".to_string(),
        )),
    }
}

// ============================================================================
// CONFIRMER UN RETOUR MATCHÉ
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ConfirmReturnTripRequest {
    pub seat_ids: Vec<String>,        // IDs des sièges sélectionnés
    pub passenger_names: Vec<String>, // Noms des passagers (doivent correspondre)
}

/// POST /api/bus-tickets/return-request/{request_id}/confirm
/// Confirmer et créer les réservations pour un retour matché
pub async fn confirm_return_trip_request(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(request_id): Path<String>,
    Json(payload): Json<ConfirmReturnTripRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[confirm_return_trip_request] User ID: {}, Request ID: {}",
        user_id, request_id
    );

    // 1. Vérifier que la demande existe et est matchée
    let request_row = sqlx::query(
        r#"
        SELECT 
            matched_product_id,
            number_of_seats,
            status,
            passenger_names
        FROM return_trip_requests
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(&request_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[confirm_return_trip_request] Erreur vérification demande: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification demande: {}", e))
    })?;

    let (matched_product_id, number_of_seats, status): (Option<String>, i32, String) =
        match request_row {
            Some(row) => (
                row.try_get::<Option<String>, _>("matched_product_id").ok().flatten(),
                row.get::<i32, _>("number_of_seats"),
                row.get::<String, _>("status"),
            ),
            None => {
                return Err(AppError::NotFound(
                    "Demande de retour non trouvée".to_string(),
                ));
            }
        };

    if status != "matched" {
        return Err(AppError::BadRequest(format!(
            "La demande doit être dans l'état 'matched' pour être confirmée (état actuel: {})",
            status
        )));
    }

    let product_id = matched_product_id
        .ok_or_else(|| AppError::Internal("Aucun bus matché pour cette demande".to_string()))?;

    if payload.seat_ids.len() != number_of_seats as usize {
        return Err(AppError::BadRequest(format!(
            "Nombre de places incorrect. Attendu: {}, reçu: {}",
            number_of_seats,
            payload.seat_ids.len()
        )));
    }

    // 2. Créer les réservations pour le retour
    let mut reservation_ids = Vec::new();
    let mut tx = state.pg.begin().await.map_err(|e| {
        error!(
            "[confirm_return_trip_request] Erreur début transaction: {}",
            e
        );
        AppError::Internal(format!("Erreur début transaction: {}", e))
    })?;

    // Récupérer le seat_map du produit pour vérifier la disponibilité
    let seat_map_json: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT seat_map FROM products WHERE id::text = $1")
            .bind(&product_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| {
                error!(
                    "[confirm_return_trip_request] Erreur récupération seat_map: {}",
                    e
                );
                AppError::Internal(format!("Erreur récupération seat_map: {}", e))
            })?;

    let mut seats: Vec<serde_json::Value> = if let Some(map) = seat_map_json {
        serde_json::from_value(map).unwrap_or_default()
    } else {
        Vec::new()
    };

    for (idx, seat_id) in payload.seat_ids.iter().enumerate() {
        // Vérifier que le siège est disponible dans le seat_map
        let seat_status = seats
            .iter()
            .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(seat_id.as_str()))
            .and_then(|s| s.get("status").and_then(|v| v.as_str()));

        if seat_status != Some("available") {
            tx.rollback().await.ok();
            return Err(AppError::Conflict(format!(
                "Le siège {} n'est plus disponible",
                seat_id
            )));
        }

        // Vérifier qu'il n'y a pas déjà une réservation active
        let existing: Option<String> = sqlx::query_scalar(
            r#"
            SELECT id FROM bus_reservations
            WHERE product_id = $1 AND seat_id = $2
                AND status IN ('pending', 'confirmed')
                AND (expires_at IS NULL OR expires_at > NOW())
            FOR UPDATE
            "#,
        )
        .bind(&product_id)
        .bind(seat_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            error!(
                "[confirm_return_trip_request] Erreur vérification réservation: {}",
                e
            );
            AppError::Internal(format!("Erreur vérification réservation: {}", e))
        })?;

        if existing.is_some() {
            tx.rollback().await.ok();
            return Err(AppError::Conflict(format!(
                "Le siège {} est déjà réservé",
                seat_id
            )));
        }

        // Extraire le seat_number depuis le seat_map
        let seat_number = seats
            .iter()
            .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(seat_id.as_str()))
            .and_then(|s| s.get("number").and_then(|v| v.as_i64()))
            .unwrap_or((idx + 1) as i64) as i32;

        // Créer la réservation
        let reservation_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO bus_reservations (
                product_id, user_id, seat_id, seat_number, passenger_name,
                caution_amount, status, payment_status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, 0, 'confirmed', 'paid', NULL)
            RETURNING id
            "#,
        )
        .bind(&product_id)
        .bind(user_id)
        .bind(seat_id)
        .bind(seat_number)
        .bind(
            payload
                .passenger_names
                .get(idx)
                .cloned()
                .unwrap_or_else(|| "Passager".to_string()),
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            error!(
                "[confirm_return_trip_request] Erreur création réservation: {}",
                e
            );
            AppError::Internal(format!("Erreur création réservation: {}", e))
        })?;

        reservation_ids.push(reservation_id);

        // Marquer le siège comme réservé dans le seat_map
        if let Some(seat_val) = seats
            .iter_mut()
            .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(seat_id.as_str()))
        {
            seat_val["status"] = json!("reserved");
        }
    }

    // Mettre à jour le seat_map dans products
    let updated_map = serde_json::to_value(&seats).unwrap_or_default();
    sqlx::query("UPDATE products SET seat_map = $1::jsonb WHERE id::text = $2")
        .bind(&updated_map)
        .bind(&product_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(
                "[confirm_return_trip_request] Erreur mise à jour seat_map: {}",
                e
            );
            AppError::Internal(format!("Erreur mise à jour seat_map: {}", e))
        })?;

    // 3. Mettre à jour la demande de retour
    sqlx::query(
        r#"
        UPDATE return_trip_requests
        SET 
            reservation_completed = TRUE,
            reservation_ids = $1,
            completed_at = NOW(),
            status = 'completed',
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(&reservation_ids)
    .bind(&request_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!(
            "[confirm_return_trip_request] Erreur mise à jour demande: {}",
            e
        );
        AppError::Internal(format!("Erreur mise à jour demande: {}", e))
    })?;

    tx.commit().await.map_err(|e| {
        error!(
            "[confirm_return_trip_request] Erreur commit transaction: {}",
            e
        );
        AppError::Internal(format!("Erreur commit transaction: {}", e))
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "request_id": request_id,
            "reservation_ids": reservation_ids,
            "message": "Retour confirmé avec succès. Vos places sont réservées."
        })),
    ))
}

// ============================================================================
// VÉRIFICATION DEMANDES DE RETOUR
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReturnRequestsPayload {
    pub bus_id: String,
    pub departure_city: String,
    pub arrival_city: String,
    pub departure_date: String,
    pub departure_time: String,
}

/// Vérifier et notifier les utilisateurs en attente d'un bus retour
pub async fn check_return_requests(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CheckReturnRequestsPayload>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_return_requests] bus_id={}, {} → {}",
        payload.bus_id, payload.departure_city, payload.arrival_city
    );

    match crate::services::push_notification_service::check_and_notify_return_requests(
        &state.pg,
        &payload.bus_id,
        &payload.departure_city,
        &payload.arrival_city,
        &payload.departure_date,
        &payload.departure_time,
    )
    .await
    {
        Ok(count) => {
            info!("[check_return_requests] {} utilisateur(s) notifié(s)", count);
            Ok((
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": format!("{} utilisateur(s) notifié(s)", count),
                    "notified_count": count
                })),
            ))
        }
        Err(e) => {
            error!("[check_return_requests] Erreur: {:?}", e);
            Err(AppError::Internal(
                "Erreur vérification demandes retour".to_string(),
            ))
        }
    }
}
