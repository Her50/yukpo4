// Contrôleur pour la gestion des tickets bus avec agences de voyage
// Intègre le système de réservation existant avec les agences spécialisées

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// RECHERCHE TICKETS BUS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SearchBusTicketsQuery {
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub departure_date: Option<String>, // Format: YYYY-MM-DD
    pub user_lat: Option<f64>,
    pub user_lng: Option<f64>,
    pub radius_km: Option<f64>,
    pub min_seats: Option<i32>,
    pub agency_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BusTicketSearchResult {
    pub agency_id: i32,
    pub agency_service_id: i32,
    pub agency_nom: String,
    pub agency_adresse: Option<String>,
    pub agency_quartier: Option<String>,
    pub agency_ville: Option<String>,
    pub agency_gps: Option<String>,
    pub agency_telephone: Option<String>,
    pub agency_whatsapp: Option<String>,
    pub agency_email: Option<String>,

    pub product_id: String,
    pub product_name: String,
    pub bus_model_name: Option<String>,
    pub total_seats: Option<i32>,
    pub available_seats: i32,
    pub reserved_seats: i32,
    pub bus_number: Option<String>,
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub departure_date: Option<chrono::NaiveDate>,
    pub departure_time: Option<chrono::NaiveTime>,
    pub ticket_price: Option<i32>,
    pub currency: Option<String>,
    pub bus_configuration: Option<serde_json::Value>,
    pub seat_map: Option<serde_json::Value>,

    pub distance_km: Option<f64>,
    pub relevance_score: f64,
}

/// Rechercher des tickets bus avec disponibilité en temps réel
pub async fn search_bus_tickets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchBusTicketsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[search_bus_tickets] Recherche: {:?}", params);

    let departure_date = if let Some(date_str) = &params.departure_date {
        Some(
            chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").map_err(|_| {
                AppError::BadRequest("Format date invalide (YYYY-MM-DD requis)".to_string())
            })?,
        )
    } else {
        None
    };

    let query = r#"
        SELECT 
            agency_id,
            agency_service_id,
            agency_nom,
            agency_adresse,
            agency_quartier,
            agency_ville,
            agency_gps,
            agency_telephone,
            agency_whatsapp,
            agency_email,
            product_id,
            product_name,
            bus_model_name,
            total_seats,
            available_seats,
            reserved_seats,
            bus_number,
            departure_city,
            arrival_city,
            departure_date,
            departure_time,
            ticket_price,
            currency,
            bus_configuration,
            seat_map,
            distance_km,
            relevance_score
        FROM search_bus_tickets_with_availability(
            $1,  -- p_departure_city
            $2,  -- p_arrival_city
            $3,  -- p_departure_date
            $4,  -- p_user_lat
            $5,  -- p_user_lng
            $6,  -- p_radius_km
            $7,  -- p_min_seats
            $8   -- p_agency_name
        )
    "#;

    let rows = sqlx::query(query)
        .bind(&params.departure_city)
        .bind(&params.arrival_city)
        .bind(&departure_date)
        .bind(&params.user_lat)
        .bind(&params.user_lng)
        .bind(params.radius_km.unwrap_or(50.0))
        .bind(params.min_seats.unwrap_or(1))
        .bind(&params.agency_name)
        .fetch_all(&state.pg)
        .await
        .map_err(|e| {
            error!("[search_bus_tickets] Erreur recherche: {}", e);
            AppError::Internal(format!("Erreur recherche tickets bus: {}", e))
        })?;

    let mut results = Vec::new();
    for row in rows {
        let result = BusTicketSearchResult {
            agency_id: row.get::<i32, _>("agency_id"),
            agency_service_id: row.get::<i32, _>("agency_service_id"),
            agency_nom: row.get::<String, _>("agency_nom"),
            agency_adresse: row.get::<Option<String>, _>("agency_adresse"),
            agency_quartier: row.get::<Option<String>, _>("agency_quartier"),
            agency_ville: row.get::<Option<String>, _>("agency_ville"),
            agency_gps: row.get::<Option<String>, _>("agency_gps"),
            agency_telephone: row.get::<Option<String>, _>("agency_telephone"),
            agency_whatsapp: row.get::<Option<String>, _>("agency_whatsapp"),
            agency_email: row.get::<Option<String>, _>("agency_email"),
            product_id: row.get::<String, _>("product_id"),
            product_name: row.get::<String, _>("product_name"),
            bus_model_name: row.get::<Option<String>, _>("bus_model_name"),
            total_seats: row.get::<Option<i32>, _>("total_seats"),
            available_seats: row.get::<i32, _>("available_seats"),
            reserved_seats: row.get::<i32, _>("reserved_seats"),
            bus_number: row.get::<Option<String>, _>("bus_number"),
            departure_city: row.get::<Option<String>, _>("departure_city"),
            arrival_city: row.get::<Option<String>, _>("arrival_city"),
            departure_date: row.get::<Option<chrono::NaiveDate>, _>("departure_date"),
            departure_time: row.get::<Option<chrono::NaiveTime>, _>("departure_time"),
            ticket_price: row.get::<Option<i32>, _>("ticket_price"),
            currency: row.get::<Option<String>, _>("currency"),
            bus_configuration: row.get::<Option<serde_json::Value>, _>("bus_configuration"),
            seat_map: row.get::<Option<serde_json::Value>, _>("seat_map"),
            distance_km: row.get::<Option<f64>, _>("distance_km"),
            relevance_score: row.get::<f64, _>("relevance_score"),
        };
        results.push(result);
    }

    Ok((StatusCode::OK, Json(json!({ "results": results }))))
}

// ============================================================================
// DISPONIBILITÉ PLACES
// ============================================================================

#[derive(Debug, Serialize)]
pub struct SeatAvailabilityResponse {
    pub success: bool,
    pub availability: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Obtenir la disponibilité des places d'un bus en temps réel
pub async fn get_seat_availability(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!("[get_seat_availability] Product ID: {}", product_id);

    let result: serde_json::Value = sqlx::query_scalar("SELECT get_bus_seat_availability($1)")
        .bind(&product_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_seat_availability] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération disponibilité: {}", e))
        })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    let availability = result.get("availability").cloned();
    let error = result.get("error").and_then(|v| v.as_str()).map(|s| s.to_string());

    let response = SeatAvailabilityResponse {
        success,
        availability,
        error,
    };

    if success {
        Ok((StatusCode::OK, Json(json!(response))))
    } else {
        Ok((StatusCode::NOT_FOUND, Json(json!(response))))
    }
}

// ============================================================================
// CRÉER PRODUIT TICKET VOYAGE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateBusProductRequest {
    pub service_id: i32,
    pub name: String,
    #[serde(rename = "type")]
    pub product_type: String, // Doit être "ticket_voyage"
    pub total_seats: i32,
    pub bus_configuration: serde_json::Value,
    pub seat_map: serde_json::Value,
    pub price_cents: Option<i64>,
    pub currency: Option<String>,
}

/// Créer un produit de type ticket_voyage
pub async fn create_bus_product(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateBusProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_bus_product] User ID: {}, Service ID: {}, Name: {}",
        user_id, payload.service_id, payload.name
    );

    // Vérifier que le service existe et appartient à l'utilisateur
    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2 AND is_active = true",
    )
    .bind(payload.service_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_bus_product] Erreur vérification service: {}", e);
        AppError::Internal(format!("Erreur vérification service: {}", e))
    })?;

    if service_exists.is_none() {
        return Err(AppError::NotFound(
            "Service non trouvé ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // Vérifier que le type est ticket_voyage
    if payload.product_type != "ticket_voyage" {
        return Err(AppError::BadRequest(
            "Le type doit être 'ticket_voyage'".to_string(),
        ));
    }

    // Créer le produit
    let product_id: uuid::Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO products (
            service_id,
            name,
            type,
            total_seats,
            bus_configuration,
            seat_map,
            price_cents,
            currency,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(payload.service_id)
    .bind(&payload.name)
    .bind(&payload.product_type)
    .bind(payload.total_seats)
    .bind(&payload.bus_configuration)
    .bind(&payload.seat_map)
    .bind(payload.price_cents)
    .bind(payload.currency.as_deref().unwrap_or("XAF"))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_bus_product] Erreur création produit: {}", e);
        AppError::Internal(format!("Erreur création produit: {}", e))
    })?;

    // ✅ NOUVEAU: Déclencher matching automatique pour demandes de retour
    let _matched_count: Option<i32> =
        sqlx::query_scalar("SELECT auto_match_return_requests_for_product($1)")
            .bind(&product_id.to_string())
            .fetch_optional(&state.pg)
            .await
            .ok()
            .flatten();

    if let Some(count) = _matched_count {
        if count > 0 {
            info!(
                "[create_bus_product] {} demande(s) de retour matchée(s) automatiquement",
                count
            );
            // TODO: Envoyer notifications push aux utilisateurs
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "id": product_id.to_string(),
            "message": "Produit créé avec succès",
            "matched_return_requests": _matched_count.unwrap_or(0)
        })),
    ))
}

// ============================================================================
// LIER PRODUIT À AGENCE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct LinkBusProductRequest {
    pub agency_id: i32,
    pub product_id: String,
    pub nom_modele: String,
    pub classe: Option<String>,
    pub equipements: Option<Vec<String>>,
}

/// Lier un produit (ticket_voyage) à une agence de voyage
/// Récupérer tous les tickets (paiements) pour une agence
pub async fn get_agency_tickets(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_agency_tickets] User ID: {}", user_id);

    // Récupérer tous les paiements pour les produits de cette agence
    let rows = sqlx::query(
        r#"
        SELECT 
            btp.id as payment_id,
            btp.product_id,
            p.name as product_name,
            btp.bus_number,
            btp.departure_city,
            btp.arrival_city,
            btp.departure_date,
            btp.departure_time,
            btp.ticket_price,
            btp.number_of_tickets,
            btp.subtotal,
            btp.yukpo_commission,
            btp.agency_payout,
            btp.total_amount,
            btp.booking_fee,
            btp.currency,
            btp.payment_status,
            btp.ticket_pdf_url,
            btp.reservation_ids,
            btp.created_at,
            u.nom_complet as customer_name,
            u.email as customer_email,
            -- Statistiques embarquement
            (
                SELECT COUNT(*) FROM bus_boarding_status bbs
                WHERE bbs.payment_id = btp.id AND bbs.is_validated = TRUE
            ) as boarded_count
        FROM bus_ticket_payments btp
        JOIN products p ON p.id::text = btp.product_id
        JOIN services s ON s.id = p.service_id
        LEFT JOIN users u ON u.id = btp.user_id
        WHERE s.user_id = $1
        ORDER BY btp.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_agency_tickets] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération tickets: {}", e))
    })?;

    let mut tickets = Vec::new();
    for row in rows {
        let reservation_ids: Vec<String> =
            row.try_get::<Vec<String>, _>("reservation_ids").unwrap_or_default();

        let ticket = json!({
            "payment_id": row.get::<String, _>("payment_id"),
            "product_id": row.get::<String, _>("product_id"),
            "product_name": row.get::<String, _>("product_name"),
            "bus_number": row.get::<Option<String>, _>("bus_number"),
            "departure_city": row.get::<String, _>("departure_city"),
            "arrival_city": row.get::<String, _>("arrival_city"),
            "departure_date": row.get::<String, _>("departure_date"),
            "departure_time": row.get::<String, _>("departure_time"),
            "ticket_price": row.get::<i32, _>("ticket_price"),
            "number_of_tickets": row.get::<i32, _>("number_of_tickets"),
            "subtotal": row.get::<i32, _>("subtotal"),
            "yukpo_commission": row.get::<Option<i32>, _>("yukpo_commission"),
            "agency_payout": row.get::<Option<i32>, _>("agency_payout"),
            "total_amount": row.get::<i32, _>("total_amount"),
            "booking_fee": row.get::<i32, _>("booking_fee"),
            "currency": row.get::<String, _>("currency"),
            "payment_status": row.get::<String, _>("payment_status"),
            "ticket_pdf_url": row.get::<Option<String>, _>("ticket_pdf_url"),
            "reservation_ids": reservation_ids,
            "customer_name": row.get::<Option<String>, _>("customer_name"),
            "customer_email": row.get::<Option<String>, _>("customer_email"),
            "boarded_count": row.get::<i64, _>("boarded_count"),
            "created_at": row
                .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .to_rfc3339(),
        });
        tickets.push(ticket);
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "tickets": tickets })),
    ))
}

pub async fn link_bus_product_to_agency(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<LinkBusProductRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[link_bus_product] User ID: {}, Agency ID: {}, Product ID: {}",
        user_id, payload.agency_id, payload.product_id
    );

    // Vérifier que l'agence appartient à l'utilisateur
    let agency_exists: Option<i32> =
        sqlx::query_scalar("SELECT id FROM agences_voyage WHERE id = $1 AND user_id = $2")
            .bind(payload.agency_id)
            .bind(user_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[link_bus_product] Erreur vérification agence: {}", e);
                AppError::Internal(format!("Erreur vérification agence: {}", e))
            })?;

    if agency_exists.is_none() {
        return Err(AppError::NotFound(
            "Agence non trouvée ou n'appartient pas à l'utilisateur".to_string(),
        ));
    }

    // Vérifier que le produit existe et appartient à l'utilisateur
    // ✅ CORRIGÉ : products n'a pas user_id directement, il faut JOIN avec services
    let product_exists: Option<(String, i32)> = sqlx::query_as::<_, (String, i32)>(
        r#"
        SELECT p.id::text, s.user_id 
        FROM products p
        JOIN services s ON p.service_id = s.id
        WHERE p.id::text = $1 
          AND s.user_id = $2 
          AND p.type = 'ticket_voyage'
          AND s.is_active = TRUE
        "#,
    )
    .bind(&payload.product_id)
    .bind(user_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[link_bus_product] Erreur vérification produit: {}", e);
        AppError::Internal(format!("Erreur vérification produit: {}", e))
    })?;

    if product_exists.is_none() {
        return Err(AppError::NotFound(
            "Produit non trouvé ou n'est pas un ticket_voyage".to_string(),
        ));
    }

    // Récupérer la config actuelle
    let current_config: Option<serde_json::Value> =
        sqlx::query_scalar("SELECT bus_products_config FROM agences_voyage WHERE id = $1")
            .bind(payload.agency_id)
            .fetch_optional(&state.pg)
            .await
            .map_err(|e| {
                error!("[link_bus_product] Erreur récupération config: {}", e);
                AppError::Internal(format!("Erreur récupération config: {}", e))
            })?;

    // Construire le nouveau modèle
    let new_model = json!({
        "product_id": payload.product_id,
        "nom_modele": payload.nom_modele,
        "classe": payload.classe.unwrap_or_else(|| "Standard".to_string()),
        "equipements": payload.equipements.unwrap_or_default()
    });

    // Mettre à jour la config
    let updated_config = if let Some(mut config) = current_config {
        // S'assurer que modeles_bus existe
        if !config.get("modeles_bus").is_some() {
            config["modeles_bus"] = json!([]);
        }

        // Obtenir la référence mutable aux modèles
        let modeles = config
            .get_mut("modeles_bus")
            .and_then(|v| v.as_array_mut())
            .expect("modeles_bus devrait être un tableau");

        // Vérifier si le produit est déjà lié
        if let Some(existing) = modeles
            .iter_mut()
            .find(|m| m.get("product_id") == Some(&json!(payload.product_id)))
        {
            // Mettre à jour le modèle existant
            *existing = new_model;
        } else {
            // Ajouter le nouveau modèle
            modeles.push(new_model);
        }
        config
    } else {
        // Créer une nouvelle config
        json!({
            "modeles_bus": [new_model]
        })
    };

    // Sauvegarder
    sqlx::query(
        "UPDATE agences_voyage SET bus_products_config = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&updated_config)
    .bind(payload.agency_id)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[link_bus_product] Erreur mise à jour: {}", e);
        AppError::Internal(format!("Erreur mise à jour config: {}", e))
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Produit lié à l'agence avec succès",
            "config": updated_config
        })),
    ))
}

// ============================================================================
// CRÉER RÉSERVATIONS
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateReservationRequest {
    pub product_id: String,
    pub seats: Vec<SeatReservationRequest>,
    pub caution_amount: Option<i32>, // Montant caution par place (défaut 500)
}

#[derive(Debug, Deserialize)]
pub struct SeatReservationRequest {
    pub seat_id: String,
    pub seat_number: i32,
    pub passenger_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReservationResponse {
    pub reservation_id: String,
    pub seat_id: String,
    pub seat_number: i32,
    pub expires_at: String,
}

/// Créer des réservations pour des places de bus
pub async fn create_reservations(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_reservations] User ID: {}, Product ID: {}, Seats: {}",
        user_id,
        payload.product_id,
        payload.seats.len()
    );

    if payload.seats.is_empty() {
        return Err(AppError::BadRequest(
            "Aucune place sélectionnée".to_string(),
        ));
    }

    let caution_amount = payload.caution_amount.unwrap_or(500);

    // Vérifier que le produit existe
    let product_exists: Option<String> = sqlx::query_scalar(
        r#"
        SELECT p.id::text 
        FROM products p
        JOIN services s ON p.service_id = s.id
        WHERE p.id::text = $1 
          AND p.type = 'ticket_voyage' 
          AND s.is_active = TRUE
        "#,
    )
    .bind(&payload.product_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_reservations] Erreur vérification produit: {}", e);
        AppError::Internal(format!("Erreur vérification produit: {}", e))
    })?;

    if product_exists.is_none() {
        return Err(AppError::NotFound("Produit non trouvé".to_string()));
    }

    // Vérifier le solde utilisateur
    let user_balance: i64 = sqlx::query_scalar("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[create_reservations] Erreur récupération solde: {}", e);
            AppError::Internal(format!("Erreur récupération solde: {}", e))
        })?;

    let total_caution = caution_amount * payload.seats.len() as i32;
    if user_balance < total_caution as i64 {
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant. Requis: {} XAF, Disponible: {} XAF",
            total_caution, user_balance
        )));
    }

    // ✅ AMÉLIORATION: Utiliser transaction avec SELECT FOR UPDATE pour éviter conflits
    let mut tx = state.pg.begin().await.map_err(|e| {
        error!("[create_reservations] Erreur début transaction: {}", e);
        AppError::Internal(format!("Erreur début transaction: {}", e))
    })?;

    let mut reservations = Vec::new();

    // Vérifier et verrouiller toutes les places en une fois
    for seat in &payload.seats {
        // ✅ Verrouiller la place avec SELECT FOR UPDATE
        let existing: Option<String> = sqlx::query_scalar(
            r#"
            SELECT id FROM bus_reservations
            WHERE product_id = $1 AND seat_id = $2
                AND status IN ('pending', 'confirmed')
                AND (expires_at IS NULL OR expires_at > NOW())
            FOR UPDATE
            "#,
        )
        .bind(&payload.product_id)
        .bind(&seat.seat_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            error!("[create_reservations] Erreur vérification place: {}", e);
            AppError::Internal(format!("Erreur vérification place: {}", e))
        })?;

        if existing.is_some() {
            let _ = tx.rollback().await;
            return Err(AppError::BadRequest(format!(
                "La place {} est déjà réservée",
                seat.seat_id
            )));
        }
    }

    // Toutes les places sont libres, créer les réservations
    for seat in &payload.seats {
        // Créer la réservation dans la transaction
        let reservation_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO bus_reservations (
                product_id,
                user_id,
                seat_id,
                seat_number,
                passenger_name,
                caution_amount,
                status,
                payment_status,
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'caution_paid', NOW() + INTERVAL '30 minutes')
            RETURNING id
            "#
        )
            .bind(&payload.product_id)
            .bind(user_id)
            .bind(&seat.seat_id)
            .bind(seat.seat_number)
            .bind(&seat.passenger_name)
            .bind(caution_amount)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                error!("[create_reservations] Erreur création réservation: {}", e);
                AppError::Internal(format!("Erreur création réservation: {}", e))
            })?;

        // Récupérer la date d'expiration dans la transaction
        let expires_at: chrono::DateTime<chrono::Utc> =
            sqlx::query_scalar("SELECT expires_at FROM bus_reservations WHERE id = $1")
                .bind(&reservation_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| {
                    error!(
                        "[create_reservations] Erreur récupération expiration: {}",
                        e
                    );
                    AppError::Internal(format!("Erreur récupération expiration: {}", e))
                })?;

        reservations.push(ReservationResponse {
            reservation_id,
            seat_id: seat.seat_id.clone(),
            seat_number: seat.seat_number,
            expires_at: expires_at.to_rfc3339(),
        });
    }

    // Débiter le solde dans la transaction
    sqlx::query("UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2")
        .bind(total_caution)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("[create_reservations] Erreur débit solde: {}", e);
            AppError::Internal(format!("Erreur débit solde: {}", e))
        })?;

    // ✅ Commit la transaction (libère tous les verrous)
    tx.commit().await.map_err(|e| {
        error!("[create_reservations] Erreur commit transaction: {}", e);
        AppError::Internal(format!("Erreur commit transaction: {}", e))
    })?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "reservations": reservations,
            "total_caution": total_caution,
            "new_balance": user_balance - total_caution as i64
        })),
    ))
}

// ============================================================================
// ANNULATION ET REMBOURSEMENT
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CancelReservationRequest {
    pub refund_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CancelReservationResponse {
    pub success: bool,
    pub reservation_id: String,
    pub refund_percentage: f64,
    pub refund_amount: i32,
    pub new_balance: i64,
}

/// PATCH /api/bus-tickets/reservations/{id}/cancel
/// Annuler une réservation avec politique de remboursement selon délai
pub async fn cancel_reservation(
    State(_state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(reservation_id): Path<String>,
    Json(_payload): Json<CancelReservationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[cancel_reservation] User ID: {}, Reservation ID: {}",
        user_id, reservation_id
    );

    // Récupérer la réservation avec les détails du produit
    let reservation_info: Option<(
        i32,
        String,
        Option<chrono::DateTime<chrono::Utc>>,
        i32,
        Option<String>,
    )> = sqlx::query_as(
        r#"
        SELECT 
            br.user_id,
            br.product_id,
            p.departure_time,
            br.caution_amount,
            br.passenger_name
        FROM bus_reservations br
        JOIN products p ON p.id::text = br.product_id
        WHERE br.id = $1
            AND br.status IN ('pending', 'confirmed')
        "#,
    )
    .bind(&reservation_id)
    .fetch_optional(&_state.pg)
    .await
    .map_err(|e| {
        error!("[cancel_reservation] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération réservation: {}", e))
    })?;

    let (reservation_user_id, _product_id, departure_time, caution_amount, _passenger_name) =
        match reservation_info {
            Some(info) => info,
            None => {
                return Err(AppError::NotFound(
                    "Réservation non trouvée ou déjà annulée".to_string(),
                ));
            }
        };

    // Vérifier que l'utilisateur est propriétaire de la réservation
    if reservation_user_id != user_id {
        return Err(AppError::Forbidden(
            "Cette réservation ne vous appartient pas".to_string(),
        ));
    }

    // Calculer remboursement selon délai
    let now = chrono::Utc::now();
    let hours_until_departure = departure_time.map(|dt| (dt - now).num_hours()).unwrap_or(24 * 365); // Si pas de date, considérer comme lointain

    let refund_percentage = if hours_until_departure > 24 {
        100.0 // Remboursement 100% si > 24h avant départ
    } else if hours_until_departure > 12 {
        50.0 // Remboursement 50% si 12-24h avant
    } else {
        0.0 // Pas de remboursement si < 12h
    };

    let refund_amount = (caution_amount as f64 * refund_percentage / 100.0) as i32;

    // Utiliser une transaction pour garantir cohérence
    let mut tx = _state.pg.begin().await.map_err(|e| {
        error!("[cancel_reservation] Erreur début transaction: {}", e);
        AppError::Internal(format!("Erreur début transaction: {}", e))
    })?;

    // 1. Libérer le siège (mettre à jour la réservation)
    sqlx::query(
        r#"
        UPDATE bus_reservations
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(&reservation_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("[cancel_reservation] Erreur mise à jour réservation: {}", e);
        AppError::Internal(format!("Erreur annulation réservation: {}", e))
    })?;

    // 2. Rembourser si applicable
    if refund_amount > 0 {
        sqlx::query("UPDATE users SET tokens_balance = tokens_balance + $1 WHERE id = $2")
            .bind(refund_amount)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                error!("[cancel_reservation] Erreur remboursement: {}", e);
                AppError::Internal(format!("Erreur remboursement: {}", e))
            })?;
    }

    // 3. Récupérer le nouveau solde
    let new_balance: i64 = sqlx::query_scalar("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            error!("[cancel_reservation] Erreur récupération solde: {}", e);
            AppError::Internal(format!("Erreur récupération solde: {}", e))
        })?;

    // Commit transaction
    tx.commit().await.map_err(|e| {
        error!("[cancel_reservation] Erreur commit transaction: {}", e);
        AppError::Internal(format!("Erreur commit transaction: {}", e))
    })?;

    let response = CancelReservationResponse {
        success: true,
        reservation_id: reservation_id.clone(),
        refund_percentage,
        refund_amount,
        new_balance,
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": format!(
                "Réservation annulée. Remboursement: {} XAF ({}%)",
                refund_amount, refund_percentage
            ),
            "data": response
        })),
    ))
}
