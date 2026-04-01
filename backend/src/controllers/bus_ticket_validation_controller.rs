// Contrôleur pour la validation de tickets bus via QR code
// Gère l'embarquement, le suivi et la validation manuelle

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use hmac::{Hmac, Mac};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::Row;
use std::sync::Arc;

type HmacSha256 = Hmac<Sha256>;

// ============================================================================
// VÉRIFICATION HMAC-SHA256 DU QR CODE
// ============================================================================

/// Retourne la clé secrète HMAC pour les QR bus.
/// Priorité : variable d'environnement BUS_QR_HMAC_SECRET > platform_config en BDD.
async fn get_qr_secret(pg: &sqlx::PgPool) -> String {
    if let Ok(secret) = std::env::var("BUS_QR_HMAC_SECRET") {
        if !secret.is_empty() && secret != "CHANGEME_SET_VIA_ENV_QR_SECRET_MIN_32_CHARS" {
            return secret;
        }
    }
    // Fallback : lire depuis platform_config
    let db_secret: Option<String> =
        sqlx::query_scalar("SELECT value FROM platform_config WHERE key = 'qr_hmac_secret'")
            .fetch_optional(pg)
            .await
            .ok()
            .flatten();
    db_secret.unwrap_or_else(|| "CHANGEME_SET_VIA_ENV_QR_SECRET_MIN_32_CHARS".to_string())
}

/// Calcule la signature HMAC-SHA256 d'un QR code bus.
/// Payload signé : "payment_id:product_id:user_id"
pub fn compute_qr_hmac(payment_id: &str, product_id: &str, user_id: i32, secret: &str) -> String {
    let payload = format!("{}:{}:{}", payment_id, product_id, user_id);
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepte n'importe quelle taille");
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Vérifie la signature d'un QR code.
/// Retourne (is_valid, is_legacy) :
///   - is_valid=true  : signature correcte OU ticket legacy sans signature en BDD
///   - is_legacy=true : ticket créé avant l'introduction des signatures (compat)
async fn verify_qr_signature(
    pg: &sqlx::PgPool,
    qr_data: &Value,
    secret: &str,
) -> (bool, bool) {
    let sig = qr_data.get("sig").and_then(|v| v.as_str());
    let payment_id = qr_data.get("payment_id").and_then(|v| v.as_str());
    let product_id = qr_data.get("product_id").and_then(|v| v.as_str());
    let user_id = qr_data.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    // Si le QR n'a pas de champ sig, vérifier si c'est un ticket legacy (avant migration)
    if sig.is_none() {
        if let Some(pid) = payment_id {
            let stored_sig: Option<Option<String>> = sqlx::query_scalar(
                "SELECT qr_hmac_signature FROM bus_ticket_payments WHERE id = $1",
            )
            .bind(pid)
            .fetch_optional(pg)
            .await
            .ok()
            .flatten();

            if let Some(stored) = stored_sig {
                if stored.is_none() {
                    // Ticket legacy : pas de signature en BDD → autoriser avec warning
                    warn!(
                        "[verify_qr_signature] Ticket legacy sans signature: payment_id={}. \
                         Autorisation accordée (mode rétrocompatibilité).",
                        pid
                    );
                    return (true, true);
                }
                // Ticket récent mais sig absente du QR → refuser
                return (false, false);
            }
        }
        return (false, false);
    }

    // Vérifier la signature HMAC
    if let (Some(sig_val), Some(pid), Some(prid)) = (sig, payment_id, product_id) {
        let expected = compute_qr_hmac(pid, prid, user_id, secret);
        let valid = sig_val == expected;
        if !valid {
            warn!(
                "[verify_qr_signature] Signature invalide pour payment_id={}. \
                 Possible tentative de falsification.",
                pid
            );
        }
        return (valid, false);
    }

    (false, false)
}

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ValidateTicketRequest {
    pub qr_code_data: Value,        // JSON décodé du QR code
    pub product_id: Option<String>, // Optionnel, pour vérification
}

#[derive(Debug, Serialize)]
pub struct ValidateTicketResponse {
    pub success: bool,
    pub reservation_id: Option<String>,
    pub passenger_name: Option<String>,
    pub seat_id: Option<String>,
    pub seat_number: Option<i32>,
    pub validated_at: Option<String>,
    pub already_boarded: Option<bool>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BoardingSummary {
    pub total_reservations: i64,
    pub boarded_passengers: i64,
    pub pending_passengers: i64,
    pub no_show_passengers: i64,
    pub completion_percentage: f64,
    pub is_complete: bool,
}

#[derive(Debug, Serialize)]
pub struct PassengerInfo {
    pub reservation_id: String,
    pub product_id: String,
    pub user_id: i32,
    pub seat_id: String,
    pub seat_number: i32,
    pub passenger_name: Option<String>,
    pub payment_id: Option<String>,
    pub total_amount: Option<i32>,
    pub boarding_status: String,
    pub is_validated: bool,
    pub validated_at: Option<String>,
    pub validated_by: Option<i32>,
    pub validation_method: Option<String>,
    pub validator_name: Option<String>,
    pub display_status: String,
}

// ============================================================================
// VALIDER TICKET VIA QR CODE
// ============================================================================

/// Valider un ticket bus via QR code
pub async fn validate_ticket_qr(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: validator_user_id,
        ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<ValidateTicketRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[validate_ticket_qr] Validator ID: {}, Product ID: {:?}",
        validator_user_id, payload.product_id
    );

    // ── Vérification HMAC-SHA256 avant tout accès BDD ────────────────────────
    let secret = get_qr_secret(&state.pg).await;
    let (sig_valid, is_legacy) = verify_qr_signature(&state.pg, &payload.qr_code_data, &secret).await;

    if !sig_valid {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "QR code invalide ou falsifié. Présentez votre ticket original.",
                "already_boarded": false
            })),
        ));
    }

    if is_legacy {
        info!(
            "[validate_ticket_qr] Ticket legacy (avant migration HMAC) accepté pour validator={}",
            validator_user_id
        );
    }

    // Appeler la fonction SQL de validation (avec flag signature valide)
    let result: Value = sqlx::query_scalar("SELECT validate_bus_ticket($1, $2, $3, $4)")
        .bind(&payload.qr_code_data)
        .bind(validator_user_id)
        .bind(&payload.product_id)
        .bind(true) // p_signature_valid — vérifiée ci-dessus en Rust
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[validate_ticket_qr] Erreur validation: {}", e);
            AppError::Internal(format!("Erreur validation ticket: {}", e))
        })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur validation ticket");

        let already_boarded =
            result.get("already_boarded").and_then(|v| v.as_bool()).unwrap_or(false);

        let response = ValidateTicketResponse {
            success: false,
            reservation_id: result
                .get("reservation_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            passenger_name: None,
            seat_id: None,
            seat_number: None,
            validated_at: None,
            already_boarded: Some(already_boarded),
            error: Some(error_msg.to_string()),
        };

        return Ok((StatusCode::BAD_REQUEST, Json(json!(response))));
    }

    let response = ValidateTicketResponse {
        success: true,
        reservation_id: result
            .get("reservation_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        passenger_name: result
            .get("passenger_name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        seat_id: result.get("seat_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        seat_number: result.get("seat_number").and_then(|v| v.as_i64()).map(|v| v as i32),
        validated_at: result.get("validated_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
        already_boarded: Some(false),
        error: None,
    };

    Ok((StatusCode::OK, Json(json!(response))))
}

// ============================================================================
// RÉSUMÉ EMBARQUEMENT
// ============================================================================

/// Obtenir le résumé d'embarquement pour un bus
pub async fn get_boarding_summary(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_boarding_summary] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[get_boarding_summary] Erreur vérification propriété: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Appeler la fonction SQL
    let summary: Value = sqlx::query_scalar("SELECT get_bus_boarding_summary($1)")
        .bind(&product_id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| {
            error!("[get_boarding_summary] Erreur: {}", e);
            AppError::Internal(format!("Erreur récupération résumé: {}", e))
        })?;

    let boarding_summary = BoardingSummary {
        total_reservations: summary.get("total_reservations").and_then(|v| v.as_i64()).unwrap_or(0),
        boarded_passengers: summary.get("boarded_passengers").and_then(|v| v.as_i64()).unwrap_or(0),
        pending_passengers: summary.get("pending_passengers").and_then(|v| v.as_i64()).unwrap_or(0),
        no_show_passengers: summary.get("no_show_passengers").and_then(|v| v.as_i64()).unwrap_or(0),
        completion_percentage: summary
            .get("completion_percentage")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0),
        is_complete: summary.get("is_complete").and_then(|v| v.as_bool()).unwrap_or(false),
    };

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "summary": boarding_summary })),
    ))
}

// ============================================================================
// LISTE PASSAGERS
// ============================================================================

/// Obtenir la liste des passagers d'un bus avec statut embarquement
pub async fn get_bus_passengers_list(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Path(product_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_bus_passengers_list] User ID: {}, Product ID: {}",
        user_id, product_id
    );

    // Vérifier que l'utilisateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&product_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[get_bus_passengers_list] Erreur vérification propriété: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Récupérer la liste depuis la vue
    let rows = sqlx::query(
        r#"
        SELECT 
            reservation_id,
            product_id,
            user_id,
            seat_id,
            seat_number,
            passenger_name,
            payment_id,
            total_amount,
            boarding_status,
            is_validated,
            validated_at,
            validated_by,
            validation_method,
            validator_name,
            display_status
        FROM bus_passengers_with_boarding
        WHERE product_id = $1
        ORDER BY seat_number ASC
        "#,
    )
    .bind(&product_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_bus_passengers_list] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération passagers: {}", e))
    })?;

    let mut passengers = Vec::new();
    for row in rows {
        let passenger = PassengerInfo {
            reservation_id: row.get::<String, _>("reservation_id"),
            product_id: row.get::<String, _>("product_id"),
            user_id: row.get::<i32, _>("user_id"),
            seat_id: row.get::<String, _>("seat_id"),
            seat_number: row.get::<i32, _>("seat_number"),
            passenger_name: row.get::<Option<String>, _>("passenger_name"),
            payment_id: row.get::<Option<String>, _>("payment_id"),
            total_amount: row.get::<Option<i32>, _>("total_amount"),
            boarding_status: row
                .get::<Option<String>, _>("boarding_status")
                .unwrap_or_else(|| "pending".to_string()),
            is_validated: row.get::<bool, _>("is_validated"),
            validated_at: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("validated_at")
                .map(|dt| dt.to_rfc3339()),
            validated_by: row.get::<Option<i32>, _>("validated_by"),
            validation_method: row.get::<Option<String>, _>("validation_method"),
            validator_name: row.get::<Option<String>, _>("validator_name"),
            display_status: row
                .get::<Option<String>, _>("display_status")
                .unwrap_or_else(|| "pending".to_string()),
        };
        passengers.push(passenger);
    }

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "passengers": passengers })),
    ))
}

// ============================================================================
// VALIDATION MANUELLE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ManualValidationRequest {
    pub reservation_id: String,
    pub notes: Option<String>,
}

/// Valider manuellement un passager (si QR code ne fonctionne pas)
pub async fn validate_passenger_manual(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser {
        id: validator_user_id,
        ..
    }): Extension<AuthenticatedUser>,
    Json(payload): Json<ManualValidationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[validate_passenger_manual] Validator ID: {}, Reservation ID: {}",
        validator_user_id, payload.reservation_id
    );

    // Vérifier que la réservation existe et est confirmée
    let reservation: Option<(String, String)> = sqlx::query_as(
        r#"
        SELECT product_id, status
        FROM bus_reservations
        WHERE id = $1
        "#,
    )
    .bind(&payload.reservation_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[validate_passenger_manual] Erreur: {}", e);
        AppError::Internal(format!("Erreur vérification réservation: {}", e))
    })?;

    let (product_id, status) = match reservation {
        Some((pid, st)) => (pid, st),
        None => {
            return Err(AppError::NotFound("Réservation non trouvée".to_string()));
        }
    };

    if status != "confirmed" {
        return Err(AppError::BadRequest(
            "Réservation non confirmée".to_string(),
        ));
    }

    // Vérifier si le ticket est déjà validé
    let already_validated: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM bus_boarding_status
            WHERE reservation_id = $1 AND is_validated = TRUE
        )
        "#,
    )
    .bind(&payload.reservation_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[validate_passenger_manual] Erreur vérification validation: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if already_validated {
        return Err(AppError::BadRequest(
            "Ce ticket a déjà été validé et ne peut plus être utilisé".to_string(),
        ));
    }

    // Vérifier que le validateur est propriétaire de l'agence
    let is_owner: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM products p
            JOIN services s ON s.id = p.service_id
            WHERE p.id::text = $1
                AND s.user_id = $2
        )
        "#,
    )
    .bind(&product_id)
    .bind(validator_user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!(
            "[validate_passenger_manual] Erreur vérification propriété: {}",
            e
        );
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_owner {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas propriétaire de cette agence".to_string(),
        ));
    }

    // Créer ou mettre à jour le statut d'embarquement
    sqlx::query(
        r#"
        INSERT INTO bus_boarding_status (
            reservation_id,
            product_id,
            boarding_status,
            is_validated,
            validated_at,
            validated_by,
            validation_method,
            notes
        )
        VALUES ($1, $2, 'boarded', TRUE, NOW(), $3, 'manual', $4)
        ON CONFLICT (reservation_id) 
        DO UPDATE SET
            boarding_status = 'boarded',
            is_validated = TRUE,
            validated_at = NOW(),
            validated_by = $3,
            validation_method = 'manual',
            notes = $4,
            updated_at = NOW()
        "#,
    )
    .bind(&payload.reservation_id)
    .bind(&product_id)
    .bind(validator_user_id)
    .bind(&payload.notes)
    .execute(&state.pg)
    .await
    .map_err(|e| {
        error!("[validate_passenger_manual] Erreur: {}", e);
        AppError::Internal(format!("Erreur validation manuelle: {}", e))
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({ "success": true, "message": "Passager validé avec succès" })),
    ))
}
