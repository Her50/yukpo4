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
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::info;
use serde_json::json;
use std::sync::Arc;
use serde::Deserialize;

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

    let reservation = HotelRoomManagementService::create_manual_reservation(
        &state.pg,
        user_id,
        request,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Réservation manuelle créée avec succès",
            "data": reservation
        })),
    ))
}

/// GET /api/hotel/my-properties
/// Obtenir toutes les propriétés que l'utilisateur peut gérer (propriétaire + membre d'équipe)
pub async fn get_my_properties(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_my_properties] user_id={}", user_id);

    let properties = HotelRoomManagementService::get_user_managed_properties(&state.pg, user_id)
        .await?;

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

    let reservations = HotelRoomManagementService::get_user_reservations(&state.pg, user_id)
        .await?;

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
    let property_id: Option<i32> = sqlx::query_scalar(
        "SELECT property_id FROM hotel_unit_blockages WHERE id = $1",
    )
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

    let info = HotelRoomManagementService::scan_reservation_qr_code(
        &state.pg,
        user_id,
        &request.qr_code,
    )
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
            return Err(AppError::NotFound(
                "Réservation introuvable".to_string(),
            ));
        }
    };

    // Vérifier les droits : soit client de la réservation, soit gérant de la propriété
    let has_access = if reservation_user_id == Some(user_id) {
        true // Client de la réservation
    } else {
        // Vérifier si gérant de la propriété
        HotelRoomManagementService::ensure_user_can_manage_property(
            &state.pg,
            user_id,
            property_id,
        )
        .await
        .is_ok()
    };

    if !has_access {
        return Err(AppError::Forbidden(
            "Vous n'avez pas accès à cette réservation".to_string(),
        ));
    }

    let qr_data = HotelRoomManagementService::get_reservation_qr_codes(
        &state.pg,
        reservation_id,
    )
    .await?;

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
    let guest_label = body
        .get("guest_label")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

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

    info!(
        "[ai_unit_pricing] unit_id={}, user_id={}",
        unit_id, user_id
    );

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

    let property_id: i32 = row
        .try_get("property_id")
        .unwrap_or(0);

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
    let quartier: String = row
        .try_get("quartier")
        .unwrap_or_else(|_| "".to_string());
    let devise: String = row
        .try_get("devise")
        .unwrap_or_else(|_| "FCFA".to_string());

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
        log::error!(
            "[ai_property_pricing] Erreur récupération propriété: {}",
            e
        );
        AppError::Internal("Erreur récupération propriété".to_string())
    })?;

    let row = match row {
        Some(r) => r,
        None => {
            return Err(AppError::NotFound(
                "Propriété introuvable".to_string(),
            ));
        }
    };

    let ville: String = row.try_get("ville").unwrap_or_else(|_| "Ville".to_string());
    let quartier: String = row
        .try_get("quartier")
        .unwrap_or_else(|_| "".to_string());
    let devise: String = row
        .try_get("devise")
        .unwrap_or_else(|_| "FCFA".to_string());
    let type_bien: String = row
        .try_get("type_bien")
        .unwrap_or_else(|_| "hôtel".to_string());
    let standing: String = row
        .try_get("standing")
        .unwrap_or_else(|_| "standard".to_string());

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
        log::error!("[ai_property_pricing] Erreur récupération historique: {}", e);
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

    let type_bien: String = property_row
        .try_get("type_bien")
        .unwrap_or_else(|_| "hotel".to_string());
    let ville: String = property_row
        .try_get("ville")
        .unwrap_or_else(|_| "Ville".to_string());
    let quartier: String = property_row
        .try_get("quartier")
        .unwrap_or_else(|_| "".to_string());

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

