use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Seat {
    pub id: String,
    pub number: i32,
    pub row: i32,
    pub col: i32,
    pub status: String, // available, reserved, occupied
    #[serde(rename = "type")]
    pub seat_type: String, // standard, vip, handicapped, driver
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BusConfiguration {
    pub rows: i32,
    pub seats_per_row: i32,
    pub aisle_position: i32,
    pub first_row_seats: i32,
    pub all_seats_available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReserveSeatRequest {
    pub seat_id: String,
    pub user_id: String,
    pub product_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReservationResponse {
    pub success: bool,
    pub message: String,
    pub reservation_id: Option<String>,
    pub updated_seat_map: Option<Vec<Seat>>,
}

/// Réserver une place dans un bus
pub async fn reserve_seat(
    State(pool): State<PgPool>,
    Json(payload): Json<ReserveSeatRequest>,
) -> Result<Json<ReservationResponse>, StatusCode> {
    // Vérifier que la place existe et est disponible
    let seat_check = sqlx::query!(
        r#"
        SELECT 
            p.id,
            p.seat_map::jsonb as seat_map
        FROM products p
        WHERE p.id = $1
        "#,
        Uuid::parse_str(&payload.product_id).map_err(|_| StatusCode::BAD_REQUEST)?
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if seat_check.is_none() {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Produit non trouvé".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    let product = seat_check.unwrap();
    
    // Parser le seat_map
    let seat_map_value = product.seat_map.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut seat_map: Vec<Seat> = serde_json::from_value(seat_map_value.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Trouver la place et vérifier qu'elle est disponible
    let seat = seat_map.iter_mut().find(|s| s.id == payload.seat_id);
    
    if seat.is_none() {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Place non trouvée".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    let seat = seat.unwrap();

    if seat.status != "available" {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Cette place n'est plus disponible".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    if seat.seat_type == "driver" {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Impossible de réserver la place du chauffeur".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    // Créer la réservation
    let reservation_id = Uuid::new_v4();
    
    let result = sqlx::query!(
        r#"
        INSERT INTO bus_reservations 
            (id, product_id, user_id, seat_id, seat_number, status, created_at)
        VALUES 
            ($1, $2, $3, $4, $5, 'reserved', NOW())
        "#,
        reservation_id,
        Uuid::parse_str(&payload.product_id).unwrap(),
        Uuid::parse_str(&payload.user_id).map_err(|_| StatusCode::BAD_REQUEST)?,
        payload.seat_id.clone(),
        seat.number
    )
    .execute(&pool)
    .await;

    if result.is_err() {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Erreur lors de la création de la réservation".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    // Mettre à jour le statut de la place
    seat.status = "reserved".to_string();

    // Mettre à jour le seat_map dans la base de données
    let updated_seat_map_json = serde_json::to_value(&seat_map)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query!(
        r#"
        UPDATE products
        SET seat_map = $1
        WHERE id = $2
        "#,
        updated_seat_map_json,
        Uuid::parse_str(&payload.product_id).unwrap()
    )
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReservationResponse {
        success: true,
        message: format!("Place n°{} réservée avec succès", seat.number),
        reservation_id: Some(reservation_id.to_string()),
        updated_seat_map: Some(seat_map),
    }))
}

/// Annuler une réservation
pub async fn cancel_reservation(
    State(pool): State<PgPool>,
    Path(reservation_id): Path<String>,
) -> Result<Json<ReservationResponse>, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Récupérer la réservation
    let reservation = sqlx::query!(
        r#"
        SELECT product_id, seat_id, seat_number
        FROM bus_reservations
        WHERE id = $1 AND status = 'reserved'
        "#,
        reservation_uuid
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if reservation.is_none() {
        return Ok(Json(ReservationResponse {
            success: false,
            message: "Réservation non trouvée ou déjà annulée".to_string(),
            reservation_id: None,
            updated_seat_map: None,
        }));
    }

    let reservation = reservation.unwrap();

    // Récupérer le seat_map du produit
    let product = sqlx::query!(
        r#"
        SELECT seat_map::jsonb as seat_map
        FROM products
        WHERE id = $1
        "#,
        reservation.product_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut seat_map: Vec<Seat> = serde_json::from_value(product.seat_map.unwrap())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Libérer la place
    if let Some(seat) = seat_map.iter_mut().find(|s| s.id == reservation.seat_id) {
        seat.status = "available".to_string();
    }

    // Mettre à jour le seat_map
    let updated_seat_map_json = serde_json::to_value(&seat_map)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query!(
        r#"
        UPDATE products
        SET seat_map = $1
        WHERE id = $2
        "#,
        updated_seat_map_json,
        reservation.product_id
    )
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Marquer la réservation comme annulée
    sqlx::query!(
        r#"
        UPDATE bus_reservations
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        "#,
        reservation_uuid
    )
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReservationResponse {
        success: true,
        message: format!("Réservation de la place n°{} annulée", reservation.seat_number),
        reservation_id: Some(reservation_id),
        updated_seat_map: Some(seat_map),
    }))
}

/// Obtenir toutes les réservations d'un utilisateur
#[derive(Debug, Serialize)]
pub struct UserReservation {
    pub id: String,
    pub product_id: String,
    pub seat_number: i32,
    pub status: String,
    pub created_at: String,
}

pub async fn get_user_reservations(
    State(pool): State<PgPool>,
    Path(user_id): Path<String>,
) -> Result<Json<Vec<UserReservation>>, StatusCode> {
    let user_uuid = Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let reservations = sqlx::query!(
        r#"
        SELECT id, product_id, seat_number, status, created_at
        FROM bus_reservations
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
        user_uuid
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = reservations
        .into_iter()
        .map(|r| UserReservation {
            id: r.id.to_string(),
            product_id: r.product_id.to_string(),
            seat_number: r.seat_number,
            status: r.status,
            created_at: r.created_at.to_string(),
        })
        .collect();

    Ok(Json(result))
}

