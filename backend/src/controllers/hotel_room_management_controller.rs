// ✅ NOUVEAU: Contrôleur pour gestion des chambres/unités hôtels et meublés
// Date: 2026-01-27
// Description: Endpoints protégés avec vérification des droits (propriétaire ou membre d'équipe)

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::models::hotel_room_management::{
    CreateBlockageRequest, CreateManualReservationRequest, ScanQRCodeRequest,
};
use crate::services::hotel_room_management_service::HotelRoomManagementService;
use crate::services::real_estate_ai_service::RealEstateAIService;
use crate::state::AppState;
use crate::utils::send_notification;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono;
use log::{info, warn};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashSet;
use std::sync::Arc;
use uuid;

/// Corps de la requête de réservation côté utilisateur (client)
#[derive(Debug, Deserialize)]
pub struct UserReservationRequest {
    pub property_id: i32,
    pub unit_id: Option<i32>,
    pub date_arrivee: String,
    pub date_depart: String,
    pub nombre_adultes: i32,
    pub nombre_enfants: Option<i32>,
    pub nombre_chambres: i32,
    pub nom_client: String,
    pub telephone_client: String,
    pub email_client: Option<String>,
    pub prix_nuitee: Option<f64>,
    pub prix_total: Option<f64>,
    pub notes: Option<String>,
    pub notify_partner_push: Option<bool>,
}

async fn notify_property_managers_new_hotel_reservation(
    state: &Arc<AppState>,
    property_id: i32,
    reservation_id: i32,
    property_name: &str,
    date_arrivee: &str,
    date_depart: &str,
    unit_number: Option<&str>,
) -> usize {
    let rows = match sqlx::query(
        r#"
        SELECT DISTINCT u.user_id
        FROM (
            SELECT s.user_id
            FROM real_estate_properties p
            JOIN services s ON s.id = p.service_id
            WHERE p.id = $1
            UNION
            SELECT stm.user_id
            FROM real_estate_properties p
            JOIN service_team_members stm ON stm.service_id = p.service_id
            WHERE p.id = $1
              AND stm.is_active = TRUE
              AND stm.role_id IN ('admin', 'manager', 'editor')
        ) u
        WHERE u.user_id IS NOT NULL
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!(
                "[request_hotel_reservation] Impossible de charger managers pour push: {}",
                e
            );
            return 0;
        }
    };

    let mut recipient_ids: HashSet<i32> = HashSet::new();
    for row in rows {
        if let Ok(uid) = row.try_get::<i32, _>("user_id") {
            recipient_ids.insert(uid);
        }
    }

    let unit_label = unit_number.unwrap_or("N/A");
    let title = "Nouvelle réservation hôtel/meublé";
    let body = format!(
        "Nouvelle demande sur {} (ID #{}) du {} au {} · chambre {}",
        property_name, reservation_id, date_arrivee, date_depart, unit_label
    );

    let mut sent = 0usize;
    for uid in recipient_ids {
        let payload = json!({
            "type": "hotel_new_reservation",
            "reservation_id": reservation_id.to_string(),
            "property_id": property_id.to_string(),
            "property_name": property_name,
            "date_arrivee": date_arrivee,
            "date_depart": date_depart,
            "unit_number": unit_label,
        });
        if send_notification(state, uid, title, &body, Some(payload)).await.is_ok() {
            sent += 1;
        }
    }
    sent
}

#[derive(Debug, Deserialize)]
pub struct CreateHotelUnitRequest {
    pub unit_number: String,
    pub unit_type: Option<String>,
    pub standing: Option<String>,
    pub capacite_max_adultes: Option<i32>,
    pub capacite_max_enfants: Option<i32>,
    pub superficie_m2: Option<f64>,
    pub prix_nuitee: Option<f64>,
    pub notes: Option<String>,
    pub photos: Option<Vec<String>>,
    pub virtual_tour_url: Option<String>,
    pub video_urls: Option<Vec<String>>,
    pub virtual_tour_media: Option<Vec<String>>,
    pub floor_number: Option<i32>,
    pub room_position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHotelUnitRequest {
    pub unit_number: Option<String>,
    pub unit_type: Option<String>,
    pub standing: Option<String>,
    pub capacite_max_adultes: Option<i32>,
    pub capacite_max_enfants: Option<i32>,
    pub superficie_m2: Option<f64>,
    pub prix_nuitee: Option<f64>,
    pub notes: Option<String>,
    pub photos: Option<Vec<String>>,
    pub is_active: Option<bool>,
    pub is_available: Option<bool>,
    pub virtual_tour_url: Option<String>,
    pub video_urls: Option<Vec<String>>,
    pub virtual_tour_media: Option<Vec<String>>,
    pub floor_number: Option<i32>,
    pub room_position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AvailableUnitsQuery {
    pub date_arrivee: String,
    pub date_depart: String,
    pub nombre_adultes: Option<i32>,
    pub nombre_enfants: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UnitsPlanQuery {
    pub date_arrivee: String,
    pub date_depart: String,
}

/// Corps de la requête de paiement d'une réservation hôtel/meublé
#[derive(Debug, Deserialize)]
pub struct PayHotelReservationRequest {
    pub payment_type: String,        // "advance" ou "full"
    pub payment_method: String,      // "mobile_money", "cash", "card", etc.
    pub montant_avance: Option<f64>, // Montant de l'avance (si payment_type == "advance")
}

/// POST /api/hotel/reservations/{reservation_id}/pay
/// Traiter un paiement (avance ou solde complet) pour une réservation hôtel/meublé
pub async fn pay_hotel_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(payload): Json<PayHotelReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[pay_hotel_reservation] user_id={}, reservation_id={}, type={}, method={}",
        user_id, reservation_id, payload.payment_type, payload.payment_method
    );

    let result = HotelRoomManagementService::pay_hotel_reservation(
        &state.pg,
        user_id,
        reservation_id,
        &payload.payment_type,
        &payload.payment_method,
        payload.montant_avance,
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result
        })),
    ))
}

/// Corps optionnel pour affiner le contexte de tarification IA
#[derive(Debug, Deserialize)]
pub struct AIUnitPricingRequest {
    /// Contexte libre saisi par le gérant (saison, jours forts/faibles, concurrence, etc.)
    pub contexte: Option<String>,
}

/// Paramètres optionnels pour insights IA côté gérant
#[derive(Debug, Deserialize)]
pub struct AIPropertyInsightsQuery {
    /// Saison actuelle (haute, basse, pluie, vacances scolaires, etc.)
    pub saison: Option<String>,
}

/// POST /api/hotel/blockages/manual
/// Créer un blocage manuel d'unité (occupation hors système)
pub async fn create_manual_blockage(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateBlockageRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_manual_blockage] property_id={}, unit_id={}, user_id={}",
        request.property_id, request.unit_id, user_id
    );

    let blockage = HotelRoomManagementService::create_manual_blockage(
        &state.pg,
        user_id,
        request.property_id,
        request,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Blocage manuel créé avec succès",
            "data": blockage
        })),
    ))
}

/// POST /api/hotel/reservations/manual
/// Créer une réservation manuelle (hors application)
pub async fn create_manual_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<CreateManualReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_manual_reservation] property_id={}, user_id={}",
        request.property_id, user_id
    );

    let reservation =
        HotelRoomManagementService::create_manual_reservation(&state.pg, user_id, request).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Réservation manuelle créée avec succès",
            "data": reservation
        })),
    ))
}

/// POST /api/hotel/reservations/request
/// Créer une demande de réservation côté UTILISATEUR (client)
pub async fn request_hotel_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UserReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[request_hotel_reservation] user_id={}, property_id={}",
        user_id, payload.property_id
    );

    // Vérifier que la propriété existe
    let property =
        sqlx::query("SELECT id, service_id, titre FROM real_estate_properties WHERE id = $1")
            .bind(payload.property_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification propriété: {}", e)))?;

    let property =
        property.ok_or_else(|| AppError::NotFound("Propriété introuvable".to_string()))?;

    let property_name: String = property.get::<String, _>("titre");

    // Calculer prix total si prix nuitée fourni
    let nb_nuits = {
        let arr =
            chrono::NaiveDate::parse_from_str(&payload.date_arrivee, "%Y-%m-%d").map_err(|_| {
                AppError::BadRequest("Format date arrivée invalide (AAAA-MM-JJ)".to_string())
            })?;
        let dep =
            chrono::NaiveDate::parse_from_str(&payload.date_depart, "%Y-%m-%d").map_err(|_| {
                AppError::BadRequest("Format date départ invalide (AAAA-MM-JJ)".to_string())
            })?;
        if dep <= arr {
            return Err(AppError::BadRequest(
                "La date de départ doit être après l'arrivée".to_string(),
            ));
        }
        (dep - arr).num_days().max(1)
    };

    let prix_nuitee = payload.prix_nuitee.unwrap_or(0.0);
    let nb_chambres = payload.nombre_chambres.max(1);
    let prix_total =
        payload.prix_total.unwrap_or(prix_nuitee * nb_nuits as f64 * nb_chambres as f64);

    // Si unit_id est fourni, valider appartenance + disponibilité sur la plage.
    let mut unit_id_to_save: Option<i32> = None;
    let mut unit_number_to_save: Option<String> = None;
    if let Some(unit_id) = payload.unit_id {
        let unit_row = sqlx::query(
            r#"
            SELECT id, unit_number, capacite_max_total
            FROM hotel_meuble_units
            WHERE id = $1 AND property_id = $2 AND is_active = TRUE AND is_available = TRUE
            "#,
        )
        .bind(unit_id)
        .bind(payload.property_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification unité: {}", e)))?;

        let unit_row = unit_row
            .ok_or_else(|| AppError::BadRequest("Unité introuvable ou indisponible".to_string()))?;

        let unit_number = unit_row.get::<String, _>("unit_number");
        let capacity = unit_row.get::<i32, _>("capacite_max_total");
        let needed = payload.nombre_adultes + payload.nombre_enfants.unwrap_or(0);
        if needed > capacity {
            return Err(AppError::BadRequest(
                "La capacité de la chambre est insuffisante".to_string(),
            ));
        }

        let conflict_blockage: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM hotel_unit_blockages
                WHERE unit_id = $1
                  AND date_debut <= $3::date
                  AND date_fin >= $2::date
            )
            "#,
        )
        .bind(unit_id)
        .bind(&payload.date_arrivee)
        .bind(&payload.date_depart)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification blocages: {}", e)))?;

        if conflict_blockage {
            return Err(AppError::BadRequest(
                "Cette chambre est bloquée sur les dates sélectionnées".to_string(),
            ));
        }

        let conflict_reservation: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM hotel_meuble_reservations
                WHERE unit_id = $1
                  AND date_arrivee <= $3::date
                  AND date_depart >= $2::date
                  AND status IN ('pending', 'confirmed', 'checked_in')
            )
            "#,
        )
        .bind(unit_id)
        .bind(&payload.date_arrivee)
        .bind(&payload.date_depart)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur vérification réservations: {}", e)))?;

        if conflict_reservation {
            return Err(AppError::BadRequest(
                "Cette chambre est déjà réservée sur les dates sélectionnées".to_string(),
            ));
        }

        unit_id_to_save = Some(unit_id);
        unit_number_to_save = Some(unit_number);
    }

    // Générer QR code unique
    let qr_code = format!("HOTEL_{}_{}", payload.property_id, uuid::Uuid::new_v4());

    // Insérer dans hotel_meuble_reservations (table existante utilisée par le service)
    let reservation_id = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO hotel_meuble_reservations (
            property_id,
            unit_id, unit_number,
            date_arrivee, date_depart, nombre_adultes, nombre_enfants, nombre_chambres,
            nom_client, telephone_client, email_client,
            prix_nuitee, prix_total, montant_total,
            payment_status,
            is_manual_reservation, manual_reservation_source, manual_reservation_notes,
            qr_code, qr_code_expires_at, status, created_by
        )
        VALUES (
            $1,
            $2, $3,
            $4::date, $5::date, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14,
            'pending',
            FALSE, 'app_user', $15,
            $16, NOW() + INTERVAL '30 days', 'pending', $17
        )
        RETURNING id
        "#,
    )
    .bind(payload.property_id)
    .bind(unit_id_to_save)
    .bind(unit_number_to_save.as_deref())
    .bind(&payload.date_arrivee)
    .bind(&payload.date_depart)
    .bind(payload.nombre_adultes)
    .bind(payload.nombre_enfants.unwrap_or(0))
    .bind(nb_chambres)
    .bind(&payload.nom_client)
    .bind(&payload.telephone_client)
    .bind(&payload.email_client)
    .bind(prix_nuitee)
    .bind(prix_total)
    .bind(prix_total)
    .bind(&payload.notes)
    .bind(&qr_code)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création réservation: {}", e)))?;

    let notify_partner_push = payload.notify_partner_push.unwrap_or(true);
    let pushed_count = if notify_partner_push {
        notify_property_managers_new_hotel_reservation(
            &state,
            payload.property_id,
            reservation_id,
            &property_name,
            &payload.date_arrivee,
            &payload.date_depart,
            unit_number_to_save.as_deref(),
        )
        .await
    } else {
        0
    };

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": format!("Demande de réservation envoyée pour {}", property_name),
            "data": {
                "id": reservation_id,
                "reservation_id": reservation_id,
                "property_name": property_name,
                "unit_id": unit_id_to_save,
                "unit_number": unit_number_to_save,
                "date_arrivee": payload.date_arrivee,
                "date_depart": payload.date_depart,
                "nb_nuits": nb_nuits,
                "prix_total": prix_total,
                "qr_code": qr_code,
                "reservation_status": "pending",
                "payment_status": "pending",
                "partner_push_enabled": notify_partner_push,
                "partner_push_sent_count": pushed_count
            }
        })),
    ))
}

/// GET /api/hotel/properties/{property_id}/units
pub async fn list_property_units(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;
    let rows = sqlx::query(
        r#"
        SELECT
            id, property_id, unit_number, unit_type, standing,
            capacite_max_adultes, capacite_max_enfants, capacite_max_total,
            superficie_m2, prix_nuitee, notes, photos, is_active, is_available, equipements,
            created_at, updated_at
        FROM hotel_meuble_units
        WHERE property_id = $1
        ORDER BY unit_number ASC, id ASC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération unités: {}", e)))?;

    let units: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            let equipements: serde_json::Value = row
                .try_get::<Option<serde_json::Value>, _>("equipements")
                .ok()
                .flatten()
                .unwrap_or_else(|| json!({}));
            json!({
                "id": row.get::<i32, _>("id"),
                "property_id": row.get::<i32, _>("property_id"),
                "unit_number": row.get::<String, _>("unit_number"),
                "unit_type": row.get::<String, _>("unit_type"),
                "standing": row.get::<Option<String>, _>("standing"),
                "capacite_max_adultes": row.get::<i32, _>("capacite_max_adultes"),
                "capacite_max_enfants": row.get::<i32, _>("capacite_max_enfants"),
                "capacite_max_total": row.get::<i32, _>("capacite_max_total"),
                "superficie_m2": row.get::<Option<f64>, _>("superficie_m2"),
                "prix_nuitee": row.get::<Option<f64>, _>("prix_nuitee"),
                "notes": row.get::<Option<String>, _>("notes"),
                "photos": row.get::<Option<Vec<String>>, _>("photos"),
                "virtual_tour_url": equipements.get("virtual_tour_url").and_then(|v| v.as_str()),
                "video_urls": equipements.get("video_urls").cloned().unwrap_or_else(|| json!([])),
                "virtual_tour_media": equipements.get("virtual_tour_media").cloned().unwrap_or_else(|| json!([])),
                "floor_number": equipements.get("floor_number").and_then(|v| v.as_i64()),
                "room_position": equipements.get("room_position").and_then(|v| v.as_i64()),
                "is_active": row.get::<bool, _>("is_active"),
                "is_available": row.get::<bool, _>("is_available"),
                "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
                "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "data": units })),
    ))
}

/// POST /api/hotel/properties/{property_id}/units
pub async fn create_property_unit(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(payload): Json<CreateHotelUnitRequest>,
) -> AppResult<impl IntoResponse> {
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;
    if payload.unit_number.trim().is_empty() {
        return Err(AppError::BadRequest("unit_number est requis".to_string()));
    }
    let cap_adultes = payload.capacite_max_adultes.map(|v| v.max(1));
    let cap_enfants = payload.capacite_max_enfants.map(|v| v.max(0));
    let cap_total = match (cap_adultes, cap_enfants) {
        (Some(a), Some(e)) => Some(a + e),
        (Some(a), None) => Some(a),
        (None, Some(e)) => Some(2 + e),
        (None, None) => None,
    };
    let equipements = json!({
        "virtual_tour_url": payload.virtual_tour_url,
        "video_urls": payload.video_urls.unwrap_or_default(),
        "virtual_tour_media": payload.virtual_tour_media.unwrap_or_default(),
        "floor_number": payload.floor_number,
        "room_position": payload.room_position,
    });
    let id: i32 = sqlx::query_scalar(
        r#"
        INSERT INTO hotel_meuble_units (
            property_id, unit_number, unit_type, standing,
            capacite_max_adultes, capacite_max_enfants, capacite_max_total,
            superficie_m2, prix_nuitee, notes, photos, equipements, is_active, is_available
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11, $12::jsonb, TRUE, TRUE
        )
        RETURNING id
        "#,
    )
    .bind(property_id)
    .bind(payload.unit_number.trim())
    .bind(payload.unit_type.as_deref().unwrap_or("chambre"))
    .bind(payload.standing.as_deref().unwrap_or("standard"))
    .bind(cap_adultes.unwrap_or(2))
    .bind(cap_enfants.unwrap_or(0))
    .bind(cap_total.unwrap_or(2))
    .bind(payload.superficie_m2)
    .bind(payload.prix_nuitee)
    .bind(payload.notes.as_deref())
    .bind(payload.photos)
    .bind(&equipements)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur création unité: {}", e)))?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "id": id })),
    ))
}

/// PUT /api/hotel/units/{unit_id}
pub async fn update_property_unit(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(unit_id): Path<i32>,
    Json(payload): Json<UpdateHotelUnitRequest>,
) -> AppResult<impl IntoResponse> {
    let property_id: Option<i32> =
        sqlx::query_scalar("SELECT property_id FROM hotel_meuble_units WHERE id = $1")
            .bind(unit_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification unité: {}", e)))?;
    let property_id =
        property_id.ok_or_else(|| AppError::NotFound("Unité introuvable".to_string()))?;
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    let current_eq: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(equipements, '{}'::jsonb) FROM hotel_meuble_units WHERE id = $1",
    )
    .bind(unit_id)
    .fetch_one(&state.pg)
    .await
    .unwrap_or_else(|_| json!({}));
    let mut merged_eq = current_eq;
    if let Some(url) = &payload.virtual_tour_url {
        merged_eq["virtual_tour_url"] = json!(url);
    }
    if let Some(videos) = &payload.video_urls {
        merged_eq["video_urls"] = json!(videos);
    }
    if let Some(tours) = &payload.virtual_tour_media {
        merged_eq["virtual_tour_media"] = json!(tours);
    }
    if let Some(floor) = payload.floor_number {
        merged_eq["floor_number"] = json!(floor);
    }
    if let Some(position) = payload.room_position {
        merged_eq["room_position"] = json!(position);
    }
    let adults = payload.capacite_max_adultes.map(|v| v.max(1));
    let enfants = payload.capacite_max_enfants.map(|v| v.max(0));
    let total = match (adults, enfants) {
        (Some(a), Some(e)) => Some(a + e),
        (Some(a), None) => Some(a),
        (None, Some(e)) => Some(2 + e),
        (None, None) => None,
    };

    sqlx::query(
        r#"
        UPDATE hotel_meuble_units
        SET
            unit_number = COALESCE($1, unit_number),
            unit_type = COALESCE($2, unit_type),
            standing = COALESCE($3, standing),
            capacite_max_adultes = COALESCE($4, capacite_max_adultes),
            capacite_max_enfants = COALESCE($5, capacite_max_enfants),
            capacite_max_total = COALESCE($6, capacite_max_total),
            superficie_m2 = COALESCE($7, superficie_m2),
            prix_nuitee = COALESCE($8, prix_nuitee),
            notes = COALESCE($9, notes),
            photos = COALESCE($10, photos),
            is_active = COALESCE($11, is_active),
            is_available = COALESCE($12, is_available),
            equipements = $13::jsonb,
            updated_at = NOW()
        WHERE id = $14
        "#,
    )
    .bind(payload.unit_number.as_deref())
    .bind(payload.unit_type.as_deref())
    .bind(payload.standing.as_deref())
    .bind(adults)
    .bind(enfants)
    .bind(total)
    .bind(payload.superficie_m2)
    .bind(payload.prix_nuitee)
    .bind(payload.notes.as_deref())
    .bind(payload.photos)
    .bind(payload.is_active)
    .bind(payload.is_available)
    .bind(&merged_eq)
    .bind(unit_id)
    .execute(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur mise à jour unité: {}", e)))?;

    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

/// DELETE /api/hotel/units/{unit_id}
pub async fn delete_property_unit(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(unit_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    let property_id: Option<i32> =
        sqlx::query_scalar("SELECT property_id FROM hotel_meuble_units WHERE id = $1")
            .bind(unit_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur vérification unité: {}", e)))?;
    let property_id =
        property_id.ok_or_else(|| AppError::NotFound("Unité introuvable".to_string()))?;
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;
    sqlx::query("DELETE FROM hotel_meuble_units WHERE id = $1")
        .bind(unit_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression unité: {}", e)))?;
    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

/// GET /api/hotel/properties/{property_id}/units/available
pub async fn list_available_units_for_dates(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<AvailableUnitsQuery>,
) -> AppResult<impl IntoResponse> {
    // Endpoint JWT-protected; clients authenticated can query availability.
    let _ = user_id;
    let adults = query.nombre_adultes.unwrap_or(1).max(1);
    let enfants = query.nombre_enfants.unwrap_or(0).max(0);
    let needed = adults + enfants;
    let rows = sqlx::query(
        r#"
        SELECT
            u.id, u.unit_number, u.unit_type, u.standing, u.capacite_max_total,
            u.prix_nuitee, u.photos, u.equipements
        FROM hotel_meuble_units u
        WHERE u.property_id = $1
          AND u.is_active = TRUE
          AND u.is_available = TRUE
          AND u.capacite_max_total >= $4
          AND NOT EXISTS (
              SELECT 1 FROM hotel_unit_blockages b
              WHERE b.unit_id = u.id
                AND b.date_debut <= $3::date
                AND b.date_fin >= $2::date
          )
          AND NOT EXISTS (
              SELECT 1 FROM hotel_meuble_reservations r
              WHERE r.unit_id = u.id
                AND r.date_arrivee <= $3::date
                AND r.date_depart >= $2::date
                AND r.status IN ('pending', 'confirmed', 'checked_in')
          )
        ORDER BY u.unit_number ASC
        "#,
    )
    .bind(property_id)
    .bind(&query.date_arrivee)
    .bind(&query.date_depart)
    .bind(needed)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération disponibilités: {}", e)))?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            let eq: serde_json::Value = row
                .try_get::<Option<serde_json::Value>, _>("equipements")
                .ok()
                .flatten()
                .unwrap_or_else(|| json!({}));
            json!({
                "id": row.get::<i32, _>("id"),
                "unit_number": row.get::<String, _>("unit_number"),
                "unit_type": row.get::<String, _>("unit_type"),
                "standing": row.get::<Option<String>, _>("standing"),
                "capacite_max_total": row.get::<i32, _>("capacite_max_total"),
                "prix_nuitee": row.get::<Option<f64>, _>("prix_nuitee"),
                "photos": row.get::<Option<Vec<String>>, _>("photos"),
                "virtual_tour_url": eq.get("virtual_tour_url").and_then(|v| v.as_str()),
                "video_urls": eq.get("video_urls").cloned().unwrap_or_else(|| json!([])),
                "virtual_tour_media": eq.get("virtual_tour_media").cloned().unwrap_or_else(|| json!([])),
                "floor_number": eq.get("floor_number").and_then(|v| v.as_i64()),
                "room_position": eq.get("room_position").and_then(|v| v.as_i64()),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "data": data })),
    ))
}

/// GET /api/hotel/properties/{property_id}/units/plan
pub async fn get_units_plan_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<UnitsPlanQuery>,
) -> AppResult<impl IntoResponse> {
    let _ = user_id;
    let rows = sqlx::query(
        r#"
        SELECT
            u.id, u.unit_number, u.unit_type, u.is_available, u.equipements,
            EXISTS (
                SELECT 1 FROM hotel_unit_blockages b
                WHERE b.unit_id = u.id
                  AND b.date_debut <= $3::date
                  AND b.date_fin >= $2::date
            ) AS is_blocked,
            EXISTS (
                SELECT 1 FROM hotel_meuble_reservations r
                WHERE r.unit_id = u.id
                  AND r.date_arrivee <= $3::date
                  AND r.date_depart >= $2::date
                  AND r.status IN ('pending', 'confirmed', 'checked_in')
            ) AS is_occupied
        FROM hotel_meuble_units u
        WHERE u.property_id = $1
          AND u.is_active = TRUE
        ORDER BY u.unit_number ASC
        "#,
    )
    .bind(property_id)
    .bind(&query.date_arrivee)
    .bind(&query.date_depart)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur récupération mini-plan: {}", e)))?;

    let data: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            let eq: serde_json::Value = row
                .try_get::<Option<serde_json::Value>, _>("equipements")
                .ok()
                .flatten()
                .unwrap_or_else(|| json!({}));
            let is_blocked = row.get::<bool, _>("is_blocked");
            let is_occupied = row.get::<bool, _>("is_occupied");
            let is_available = row.get::<bool, _>("is_available");
            let status = if is_blocked {
                "blocked"
            } else if is_occupied {
                "occupied"
            } else if is_available {
                "available"
            } else {
                "disabled"
            };
            json!({
                "id": row.get::<i32, _>("id"),
                "unit_number": row.get::<String, _>("unit_number"),
                "unit_type": row.get::<String, _>("unit_type"),
                "status": status,
                "floor_number": eq.get("floor_number").and_then(|v| v.as_i64()).unwrap_or(0),
                "room_position": eq.get("room_position").and_then(|v| v.as_i64()).unwrap_or(0),
            })
        })
        .collect();

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "data": data })),
    ))
}

/// GET /api/hotel/my-properties
/// Obtenir toutes les propriétés que l'utilisateur peut gérer (propriétaire + membre d'équipe)
pub async fn get_my_properties(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_properties] user_id={}", user_id);

    let properties =
        HotelRoomManagementService::get_user_managed_properties(&state.pg, user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": properties
        })),
    ))
}

/// GET /api/hotel/reservations/my
/// Récupère toutes les réservations pour les propriétés gérées par l'utilisateur
pub async fn get_my_reservations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_reservations] user_id={}", user_id);

    let reservations =
        HotelRoomManagementService::get_user_reservations(&state.pg, user_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": reservations
        })),
    ))
}

/// GET /api/hotel/properties/:property_id/blockages/manual
/// Lister les blocages manuels d'une propriété
pub async fn list_manual_blockages(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[list_manual_blockages] property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier les permissions
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    // Récupérer les blocages manuels
    let blockages = sqlx::query(
        r#"
        SELECT 
            hub.id,
            hub.unit_id,
            hub.property_id,
            hub.date_debut,
            hub.date_fin,
            hub.heure_debut,
            hub.heure_fin,
            hub.raison,
            hub.description,
            hub.is_manual_occupation,
            hub.client_name,
            hub.client_phone,
            hub.notes_occupation,
            hub.created_by,
            hub.created_at,
            hmu.unit_number,
            hmu.unit_type
        FROM hotel_unit_blockages hub
        JOIN hotel_meuble_units hmu ON hub.unit_id = hmu.id
        WHERE hub.property_id = $1
        AND hub.is_manual_occupation = TRUE
        ORDER BY hub.date_debut DESC, hub.created_at DESC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[list_manual_blockages] Erreur: {}", e);
        AppError::Internal("Erreur récupération blocages".to_string())
    })?;

    let mut result = Vec::new();
    for row in blockages {
        result.push(json!({
            "id": row.try_get::<i32, _>("id").unwrap_or(0),
            "unit_id": row.try_get::<i32, _>("unit_id").unwrap_or(0),
            "property_id": row.try_get::<i32, _>("property_id").unwrap_or(0),
            "date_debut": row.try_get::<chrono::NaiveDate, _>("date_debut").ok().map(|d| d.to_string()),
            "date_fin": row.try_get::<chrono::NaiveDate, _>("date_fin").ok().map(|d| d.to_string()),
            "heure_debut": row.try_get::<Option<chrono::NaiveTime>, _>("heure_debut").ok().flatten().map(|t| t.to_string()),
            "heure_fin": row.try_get::<Option<chrono::NaiveTime>, _>("heure_fin").ok().flatten().map(|t| t.to_string()),
            "raison": row.try_get::<String, _>("raison").unwrap_or_default(),
            "description": row.try_get::<Option<String>, _>("description").unwrap_or(None),
            "is_manual_occupation": row.try_get::<bool, _>("is_manual_occupation").unwrap_or(false),
            "client_name": row.try_get::<Option<String>, _>("client_name").unwrap_or(None),
            "client_phone": row.try_get::<Option<String>, _>("client_phone").unwrap_or(None),
            "notes_occupation": row.try_get::<Option<String>, _>("notes_occupation").unwrap_or(None),
            "created_by": row.try_get::<Option<i32>, _>("created_by").unwrap_or(None),
            "created_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").ok().map(|d| d.to_rfc3339()),
            "unit_number": row.try_get::<Option<String>, _>("unit_number").unwrap_or(None),
            "unit_type": row.try_get::<Option<String>, _>("unit_type").unwrap_or(None),
        }));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result
        })),
    ))
}

/// DELETE /api/hotel/blockages/:blockage_id
/// Supprimer un blocage manuel
pub async fn delete_blockage(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(blockage_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[delete_blockage] blockage_id={}, user_id={}",
        blockage_id, user_id
    );

    // Récupérer le property_id du blocage
    let property_id: Option<i32> =
        sqlx::query_scalar("SELECT property_id FROM hotel_unit_blockages WHERE id = $1")
            .bind(blockage_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                log::error!("[delete_blockage] Erreur récupération property_id: {}", e);
                AppError::Internal("Erreur récupération blocage".to_string())
            })?;

    let property_id = match property_id {
        Some(id) => id,
        None => {
            return Err(AppError::NotFound("Blocage non trouvé".to_string()));
        }
    };

    // Vérifier les permissions
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    // Supprimer le blocage
    sqlx::query("DELETE FROM hotel_unit_blockages WHERE id = $1")
        .bind(blockage_id)
        .execute(&state.pg)
        .await
        .map_err(|e| {
            log::error!("[delete_blockage] Erreur suppression: {}", e);
            AppError::Internal("Erreur suppression blocage".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Blocage supprimé avec succès"
        })),
    ))
}

/// POST /api/hotel/reservations/scan-qr
/// Scanner un QR code de réservation hôtel/meublé (gérant à l'accueil)
pub async fn scan_reservation_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(request): Json<ScanQRCodeRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[scan_reservation_qr] user_id={}, qr_code={}",
        user_id, request.qr_code
    );

    let info =
        HotelRoomManagementService::scan_reservation_qr_code(&state.pg, user_id, &request.qr_code)
            .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": info
        })),
    ))
}

/// GET /api/hotel/reservations/{reservation_id}/qr-codes
/// Récupère tous les QR codes d'une réservation (principal + invités)
pub async fn get_reservation_qr_codes(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_reservation_qr_codes] reservation_id={}, user_id={}",
        reservation_id, user_id
    );

    // Vérifier que l'utilisateur a accès à cette réservation
    // (soit il est le client, soit il est gérant de la propriété)
    let reservation_check: Option<(i32, Option<i32>)> = sqlx::query_as(
        r#"
        SELECT property_id, user_id
        FROM hotel_meuble_reservations
        WHERE id = $1
        "#,
    )
    .bind(reservation_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!(
            "[get_reservation_qr_codes] Erreur vérification réservation: {}",
            e
        );
        AppError::Internal("Erreur vérification réservation".to_string())
    })?;

    let (property_id, reservation_user_id) = match reservation_check {
        Some((pid, uid)) => (pid, uid),
        None => {
            return Err(AppError::NotFound("Réservation introuvable".to_string()));
        }
    };

    // Vérifier les droits : soit client de la réservation, soit gérant de la propriété
    let has_access = if reservation_user_id == Some(user_id) {
        true // Client de la réservation
    } else {
        // Vérifier si gérant de la propriété
        HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
            .await
            .is_ok()
    };

    if !has_access {
        return Err(AppError::Forbidden(
            "Vous n'avez pas accès à cette réservation".to_string(),
        ));
    }

    let qr_data =
        HotelRoomManagementService::get_reservation_qr_codes(&state.pg, reservation_id).await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": qr_data
        })),
    ))
}

/// POST /api/hotel/reservations/{reservation_id}/check-in
/// Effectue le check-in d'une réservation
pub async fn check_in_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_in_reservation] reservation_id={}, user_id={}",
        reservation_id, user_id
    );

    HotelRoomManagementService::update_reservation_status(
        &state.pg,
        user_id,
        reservation_id,
        "checked_in",
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Check-in effectué avec succès"
        })),
    ))
}

/// POST /api/hotel/reservations/{reservation_id}/check-out
/// Effectue le check-out d'une réservation
pub async fn check_out_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[check_out_reservation] reservation_id={}, user_id={}",
        reservation_id, user_id
    );

    HotelRoomManagementService::update_reservation_status(
        &state.pg,
        user_id,
        reservation_id,
        "checked_out",
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Check-out effectué avec succès"
        })),
    ))
}

/// POST /api/hotel/reservations/{reservation_id}/guest-qr
/// Génère un QR "invité / co‑chambrier" pour une réservation existante
pub async fn generate_guest_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(body): Json<serde_json::Value>,
) -> AppResult<impl IntoResponse> {
    let guest_label = body.get("guest_label").and_then(|v| v.as_str()).map(|s| s.to_string());

    info!(
        "[generate_guest_qr] reservation_id={}, user_id={}, guest_label={:?}",
        reservation_id, user_id, guest_label
    );

    let qr_info = HotelRoomManagementService::generate_guest_qr(
        &state.pg,
        user_id,
        reservation_id,
        guest_label,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "QR invité généré avec succès",
            "data": qr_info
        })),
    ))
}

/// POST /api/hotel/units/{unit_id}/ai-pricing
/// Retourne une suggestion de tarif par nuit / heure / week-end / semaine pour une unité
pub async fn ai_unit_pricing(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(unit_id): Path<i32>,
    Json(body): Json<AIUnitPricingRequest>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;

    info!("[ai_unit_pricing] unit_id={}, user_id={}", unit_id, user_id);

    // Récupérer informations de l'unité + propriété associée
    let row = sqlx::query(
        r#"
        SELECT 
            u.property_id,
            u.unit_type,
            COALESCE(u.standing, 'standard') AS standing,
            u.capacite_max_total,
            u.prix_nuitee,
            u.prix_heure,
            p.ville,
            COALESCE(p.quartier, '') AS quartier,
            COALESCE(p.devise_principale, 'FCFA') AS devise
        FROM hotel_meuble_units u
        JOIN real_estate_properties p ON p.id = u.property_id
        WHERE u.id = $1
        "#,
    )
    .bind(unit_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!(
            "[ai_unit_pricing] Erreur récupération unité/property: {}",
            e
        );
        AppError::Internal("Erreur récupération unité".to_string())
    })?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err(AppError::NotFound(
                "Unité hôtelière introuvable".to_string(),
            ));
        }
    };

    let property_id: i32 = row.try_get("property_id").unwrap_or(0);

    // Vérifier que le gérant peut gérer cette propriété
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    let unit_type: String = row.try_get("unit_type").unwrap_or_else(|_| "chambre".to_string());
    let standing: String = row.try_get("standing").unwrap_or_else(|_| "standard".to_string());
    let capacite_max_total: i32 = row.try_get("capacite_max_total").unwrap_or(1);
    let prix_nuitee = row
        .try_get::<Option<rust_decimal::Decimal>, _>("prix_nuitee")
        .ok()
        .flatten()
        .and_then(|d| d.to_string().parse::<f64>().ok());
    let prix_heure = row
        .try_get::<Option<rust_decimal::Decimal>, _>("prix_heure")
        .ok()
        .flatten()
        .and_then(|d| d.to_string().parse::<f64>().ok());
    let ville: String = row.try_get("ville").unwrap_or_else(|_| "Ville".to_string());
    let quartier: String = row.try_get("quartier").unwrap_or_else(|_| "".to_string());
    let devise: String = row.try_get("devise").unwrap_or_else(|_| "FCFA".to_string());

    // Historique simple des réservations pour cette unité (180 derniers jours)
    let historique_rows = sqlx::query(
        r#"
        SELECT 
            date_arrivee,
            date_depart,
            status,
            COALESCE(montant_total, 0) AS montant_total
        FROM hotel_meuble_reservations
        WHERE unit_id = $1
          AND date_arrivee >= CURRENT_DATE - INTERVAL '180 days'
        ORDER BY date_arrivee DESC
        "#,
    )
    .bind(unit_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ai_unit_pricing] Erreur récupération historique: {}", e);
        AppError::Internal("Erreur récupération historique".to_string())
    })?;

    let mut historique_json = Vec::new();
    for r in historique_rows {
        let date_arrivee: chrono::NaiveDate =
            r.try_get("date_arrivee").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let date_depart: chrono::NaiveDate =
            r.try_get("date_depart").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let status: String = r.try_get("status").unwrap_or_else(|_| "pending".to_string());
        let montant_total: rust_decimal::Decimal =
            r.try_get("montant_total").unwrap_or_else(|_| rust_decimal::Decimal::ZERO);

        historique_json.push(json!({
            "date_arrivee": date_arrivee.to_string(),
            "date_depart": date_depart.to_string(),
            "status": status,
            "montant_total": montant_total.to_string(),
        }));
    }

    let historique_value = json!(historique_json);
    let prix_actuels = json!({
        "prix_nuitee_actuel": prix_nuitee,
        "prix_heure_actuel": prix_heure,
    });

    let app_ia = state.ia.clone();
    let real_estate_ai = RealEstateAIService::new(app_ia);

    let suggestion = real_estate_ai
        .suggest_unit_pricing(
            &unit_type,
            &standing,
            capacite_max_total,
            &ville,
            &quartier,
            &devise,
            body.contexte.as_deref(),
            historique_value,
            prix_actuels,
        )
        .await
        .map_err(|e| {
            log::error!("[ai_unit_pricing] Erreur IA: {}", e);
            AppError::Internal("Erreur génération suggestion IA".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "unit_id": unit_id,
                "property_id": property_id,
                "suggestion": suggestion
            }
        })),
    ))
}

/// POST /api/hotel/properties/{property_id}/ai-pricing
/// Retourne une suggestion de tarif basée sur la propriété (sans unitId, pour unités non encore créées)
pub async fn ai_property_pricing(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    Json(body): Json<AIUnitPricingRequest>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;

    info!(
        "[ai_property_pricing] property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier que le gérant peut gérer cette propriété
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    // Récupérer informations de la propriété
    let row = sqlx::query(
        r#"
        SELECT 
            p.ville,
            COALESCE(p.quartier, '') AS quartier,
            COALESCE(p.devise_principale, 'FCFA') AS devise,
            p.type_bien,
            p.standing
        FROM real_estate_properties p
        WHERE p.id = $1
        "#,
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!("[ai_property_pricing] Erreur récupération propriété: {}", e);
        AppError::Internal("Erreur récupération propriété".to_string())
    })?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err(AppError::NotFound("Propriété introuvable".to_string()));
        }
    };

    let ville: String = row.try_get("ville").unwrap_or_else(|_| "Ville".to_string());
    let quartier: String = row.try_get("quartier").unwrap_or_else(|_| "".to_string());
    let devise: String = row.try_get("devise").unwrap_or_else(|_| "FCFA".to_string());
    let _type_bien: String = row.try_get("type_bien").unwrap_or_else(|_| "hôtel".to_string());
    let standing: String = row.try_get("standing").unwrap_or_else(|_| "standard".to_string());

    // Historique agrégé des réservations de la propriété (180 derniers jours)
    let historique_rows = sqlx::query(
        r#"
        SELECT 
            date_arrivee,
            date_depart,
            status,
            COALESCE(montant_total, 0) AS montant_total,
            nombre_adultes + COALESCE(nombre_enfants, 0) AS capacite
        FROM hotel_meuble_reservations
        WHERE property_id = $1
          AND date_arrivee >= CURRENT_DATE - INTERVAL '180 days'
        ORDER BY date_arrivee DESC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!(
            "[ai_property_pricing] Erreur récupération historique: {}",
            e
        );
        AppError::Internal("Erreur récupération historique".to_string())
    })?;

    let mut historique_json = Vec::new();
    for r in historique_rows {
        let date_arrivee: chrono::NaiveDate =
            r.try_get("date_arrivee").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let date_depart: chrono::NaiveDate =
            r.try_get("date_depart").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let status: String = r.try_get("status").unwrap_or_else(|_| "pending".to_string());
        let montant_total: rust_decimal::Decimal =
            r.try_get("montant_total").unwrap_or_else(|_| rust_decimal::Decimal::ZERO);
        let capacite: i32 = r.try_get("capacite").unwrap_or(1);

        historique_json.push(json!({
            "date_arrivee": date_arrivee.to_string(),
            "date_depart": date_depart.to_string(),
            "status": status,
            "montant_total": montant_total.to_string(),
            "capacite": capacite,
        }));
    }

    // Prix moyens de la propriété (si des unités existent déjà)
    let prix_moyens: Option<(rust_decimal::Decimal, rust_decimal::Decimal)> = sqlx::query_as(
        r#"
        SELECT 
            AVG(prix_nuitee) AS prix_nuitee_moyen,
            AVG(prix_heure) AS prix_heure_moyen
        FROM hotel_meuble_units
        WHERE property_id = $1 AND is_active = TRUE
        "#,
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await
    .ok()
    .flatten();

    let historique_value = json!(historique_json);
    let prix_actuels = json!({
        "prix_nuitee_actuel": prix_moyens
            .as_ref()
            .and_then(|(p, _)| p.to_string().parse::<f64>().ok()),
        "prix_heure_actuel": prix_moyens
            .as_ref()
            .and_then(|(_, p)| p.to_string().parse::<f64>().ok()),
    });

    // Utiliser des valeurs par défaut pour l'unité (car elle n'existe pas encore)
    let unit_type = "chambre".to_string();
    let capacite_par_defaut = 2; // Valeur par défaut raisonnable

    let app_ia = state.ia.clone();
    let real_estate_ai = RealEstateAIService::new(app_ia);

    let suggestion = real_estate_ai
        .suggest_unit_pricing(
            &unit_type,
            &standing,
            capacite_par_defaut,
            &ville,
            &quartier,
            &devise,
            body.contexte.as_deref(),
            historique_value,
            prix_actuels,
        )
        .await
        .map_err(|e| {
            log::error!("[ai_property_pricing] Erreur IA: {}", e);
            AppError::Internal("Erreur génération suggestion IA".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "unit_id": null,
                "property_id": property_id,
                "suggestion": suggestion,
                "note": "Suggestion basée sur la propriété. Créez une unité pour des suggestions plus précises."
            }
        })),
    ))
}

/// GET /api/hotel/properties/{property_id}/ai-insights
/// Retourne des insights IA pour un bien hôtelier (remplissage, jours forts/faibles, promos…)
pub async fn get_property_ai_insights(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(property_id): Path<i32>,
    axum::extract::Query(query): axum::extract::Query<AIPropertyInsightsQuery>,
) -> AppResult<impl IntoResponse> {
    use sqlx::Row;

    info!(
        "[get_property_ai_insights] property_id={}, user_id={}",
        property_id, user_id
    );

    // Vérifier permissions
    HotelRoomManagementService::ensure_user_can_manage_property(&state.pg, user_id, property_id)
        .await?;

    // Récupérer info de base du bien
    let property_row = sqlx::query(
        r#"
        SELECT type_bien, ville, COALESCE(quartier, '') AS quartier
        FROM real_estate_properties
        WHERE id = $1
        "#,
    )
    .bind(property_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        log::error!(
            "[get_property_ai_insights] Erreur récupération propriété: {}",
            e
        );
        AppError::Internal("Erreur récupération propriété".to_string())
    })?;

    let property_row = match property_row {
        Some(r) => r,
        None => {
            return Err(AppError::NotFound(
                "Propriété hôtelière introuvable".to_string(),
            ));
        }
    };

    let type_bien: String =
        property_row.try_get("type_bien").unwrap_or_else(|_| "hotel".to_string());
    let ville: String = property_row.try_get("ville").unwrap_or_else(|_| "Ville".to_string());
    let quartier: String = property_row.try_get("quartier").unwrap_or_else(|_| "".to_string());

    // Historique agrégé simple des réservations de la propriété (365 derniers jours)
    let historique_rows = sqlx::query(
        r#"
        SELECT 
            date_arrivee,
            date_depart,
            status,
            COALESCE(montant_total, 0) AS montant_total
        FROM hotel_meuble_reservations
        WHERE property_id = $1
          AND date_arrivee >= CURRENT_DATE - INTERVAL '365 days'
        ORDER BY date_arrivee DESC
        "#,
    )
    .bind(property_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        log::error!(
            "[get_property_ai_insights] Erreur récupération historique: {}",
            e
        );
        AppError::Internal("Erreur récupération historique".to_string())
    })?;

    let mut historique_json = Vec::new();
    for r in historique_rows {
        let date_arrivee: chrono::NaiveDate =
            r.try_get("date_arrivee").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let date_depart: chrono::NaiveDate =
            r.try_get("date_depart").unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let status: String = r.try_get("status").unwrap_or_else(|_| "pending".to_string());
        let montant_total: rust_decimal::Decimal =
            r.try_get("montant_total").unwrap_or_else(|_| rust_decimal::Decimal::ZERO);

        historique_json.push(json!({
            "date_arrivee": date_arrivee.to_string(),
            "date_depart": date_depart.to_string(),
            "status": status,
            "montant_total": montant_total.to_string(),
        }));
    }

    let historique_value = json!(historique_json);

    let app_ia = state.ia.clone();
    let real_estate_ai = RealEstateAIService::new(app_ia);

    let insights = real_estate_ai
        .analyze_hotel_property_insights(
            &type_bien,
            &ville,
            &quartier,
            query.saison.as_deref(),
            historique_value,
        )
        .await
        .map_err(|e| {
            log::error!("[get_property_ai_insights] Erreur IA: {}", e);
            AppError::Internal("Erreur génération insights IA".to_string())
        })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "property_id": property_id,
                "insights": insights
            }
        })),
    ))
}

/// POST /api/hotel/reservations/{reservation_id}/cancel
/// Annule une réservation avec calcul des pénalités
pub async fn cancel_hotel_reservation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<i32>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let reason: Option<String> = body.get("reason").and_then(|v| v.as_str()).map(|s| s.to_string());
    let refund_amount: Option<f64> = body.get("refund_amount").and_then(|v| v.as_f64());

    let result = HotelRoomManagementService::cancel_hotel_reservation(
        &state.pg,
        user_id,
        reservation_id,
        reason,
        refund_amount,
    )
    .await
    .map_err(|e| {
        log::error!("[cancel_hotel_reservation] Erreur: {}", e);
        e
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result
        })),
    ))
}

/// GET /api/hotel/cancellations/history
/// Récupère l'historique des annulations avec pénalités
pub async fn get_cancellation_history(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    axum::extract::Query(params): axum::extract::Query<serde_json::Value>,
) -> Result<impl IntoResponse, AppError> {
    let property_id: Option<i32> = params
        .get("property_id")
        .and_then(|v| v.as_i64())
        .and_then(|i| i32::try_from(i).ok());
    let start_date_str: Option<String> =
        params.get("start_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let end_date_str: Option<String> =
        params.get("end_date").and_then(|v| v.as_str()).map(|s| s.to_string());

    let start_date = if let Some(date_str) = start_date_str {
        Some(
            chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").map_err(|_| {
                AppError::BadRequest(
                    "Format de date invalide pour start_date. Utilisez YYYY-MM-DD".to_string(),
                )
            })?,
        )
    } else {
        None
    };

    let end_date = if let Some(date_str) = end_date_str {
        Some(
            chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").map_err(|_| {
                AppError::BadRequest(
                    "Format de date invalide pour end_date. Utilisez YYYY-MM-DD".to_string(),
                )
            })?,
        )
    } else {
        None
    };

    let result = HotelRoomManagementService::get_cancellation_history(
        &state.pg,
        user_id,
        property_id,
        start_date,
        end_date,
    )
    .await
    .map_err(|e| {
        log::error!("[get_cancellation_history] Erreur: {}", e);
        e
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": result,
            "total": result.len()
        })),
    ))
}
