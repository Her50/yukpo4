// Contrôleur pour le système intelligent de matching banque de sang
// Gère les demandes de don, matching GPS, notifications push avec son

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::push_notification_service;
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

// ============================================================================
// STRUCTURES DE REQUÊTE/RÉPONSE
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateBloodDonationRequest {
    pub banque_sang_id: i32,
    pub service_id: i32,
    pub groupe_sanguin_requis: String, // O+, O-, A+, A-, B+, B-, AB+, AB-
    pub quantite_requise: Option<i32>,
    pub unite: Option<String>,
    pub is_urgent: Option<bool>,
    pub urgence_level: Option<String>, // normal, urgent, critique
    pub deadline_date: Option<String>, // Format: YYYY-MM-DD
    pub request_latitude: Option<f64>,
    pub request_longitude: Option<f64>,
    pub request_location_address: Option<String>,
    pub notes: Option<String>,
    pub patient_name: Option<String>,
    pub hospital_name: Option<String>,
    pub max_distance_km: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct BloodDonationRequestResponse {
    pub success: bool,
    pub request_id: Option<String>,
    pub matches_found: Option<i64>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMatchStatusRequest {
    pub match_id: String,
    pub new_status: String, // accepted, declined, completed
    pub declined_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NotifyDonorsRequest {
    pub request_id: String,
    pub max_donors_to_notify: Option<i32>, // Limite de donneurs à notifier
}

#[derive(Debug, Serialize)]
pub struct DonorMatchInfo {
    pub match_id: String,
    pub donor_user_id: i32,
    pub donor_name: Option<String>,
    pub donor_telephone: Option<String>,
    pub donor_whatsapp: Option<String>,
    pub groupe_sanguin: String,
    pub distance_km: Option<f64>,
    pub relevance_score: f64,
    pub match_status: String,
    pub notified_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BloodDonationRequestInfo {
    pub id: String,
    pub banque_sang_id: i32,
    pub banque_sang_nom: String,
    pub groupe_sanguin_requis: String,
    pub quantite_requise: i32,
    pub is_urgent: bool,
    pub urgence_level: String,
    pub status: String,
    pub request_location_address: Option<String>,
    pub patient_name: Option<String>,
    pub hospital_name: Option<String>,
    pub created_at: String,
    pub matches_count: i64,
    pub accepted_matches_count: i64,
}

// ============================================================================
// CRÉER DEMANDE DE DON ET TROUVER MATCHES
// ============================================================================

/// Créer une demande de don de sang et trouver automatiquement les donneurs compatibles
/// ⚠️ CRITIQUE: Ne crée une demande que si aucune banque de sang n'a le stock disponible
pub async fn create_blood_donation_request(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateBloodDonationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_blood_donation_request] User ID: {}, Banque ID: {}, Groupe: {}",
        user_id, payload.banque_sang_id, payload.groupe_sanguin_requis
    );

    // Valider le groupe sanguin
    let valid_groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
    if !valid_groups.contains(&payload.groupe_sanguin_requis.as_str()) {
        return Err(AppError::BadRequest(
            "Groupe sanguin invalide. Valeurs acceptées: O+, O-, A+, A-, B+, B-, AB+, AB-".to_string(),
        ));
    }

    // ⚠️ CRITIQUE: Vérifier d'abord si une banque de sang a le stock disponible
    let quantite_requise = payload.quantite_requise.unwrap_or(1);
    let stock_available: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT 
            COALESCE(
                SUM(
                    CASE 
                        WHEN (stocks_groupes_sanguins->>$1->>'quantite')::INTEGER >= $2 
                        THEN 1 
                        ELSE 0 
                    END
                ),
                0
            ) as available_count
        FROM banques_sang
        WHERE is_active = TRUE
            AND stocks_groupes_sanguins ? $1
            AND (stocks_groupes_sanguins->$1->>'statut')::TEXT IN ('disponible', 'moyen')
            AND (stocks_groupes_sanguins->$1->>'quantite')::INTEGER >= $2
        "#
    )
    .bind(&payload.groupe_sanguin_requis)
    .bind(quantite_requise)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_donation_request] Erreur vérification stock: {}", e);
        AppError::Internal(format!("Erreur vérification stock: {}", e))
    })?;

    // Si une banque a le stock disponible, ne pas créer de demande
    if stock_available.unwrap_or(0) > 0 {
        info!(
            "[create_blood_donation_request] ✅ Stock disponible dans {} banque(s), pas de demande nécessaire",
            stock_available.unwrap_or(0)
        );
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "stock_available": true,
                "available_banks_count": stock_available.unwrap_or(0),
                "message": format!(
                    "Le groupe sanguin {} est disponible dans {} banque(s) de sang. Aucune demande de don nécessaire.",
                    payload.groupe_sanguin_requis,
                    stock_available.unwrap_or(0)
                ),
                "request_id": null,
                "matches_found": 0
            })),
        ));
    }

    info!(
        "[create_blood_donation_request] ⚠️ Aucun stock disponible, création de demande et matching intelligent"
    );

    // Valider urgence_level si fourni
    if let Some(ref level) = payload.urgence_level {
        let valid_levels = ["normal", "urgent", "critique"];
        if !valid_levels.contains(&level.as_str()) {
            return Err(AppError::BadRequest(
                "Niveau d'urgence invalide. Valeurs acceptées: normal, urgent, critique".to_string(),
            ));
        }
    }

    // Parser deadline_date si fourni
    let deadline_date = if let Some(ref date_str) = payload.deadline_date {
        Some(
            chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .map_err(|_| AppError::BadRequest("Format date invalide (YYYY-MM-DD requis)".to_string()))?,
        )
    } else {
        None
    };

    // Appeler la fonction SQL
    let result: Value = sqlx::query_scalar(
        "SELECT create_blood_donation_request($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)"
    )
    .bind(payload.banque_sang_id)
    .bind(payload.service_id)
    .bind(user_id)
    .bind(&payload.groupe_sanguin_requis)
    .bind(payload.quantite_requise.unwrap_or(1))
    .bind(payload.unite.as_deref().unwrap_or("poches"))
    .bind(payload.is_urgent.unwrap_or(false))
    .bind(payload.urgence_level.as_deref().unwrap_or("normal"))
    .bind(deadline_date)
    .bind(payload.request_latitude)
    .bind(payload.request_longitude)
    .bind(&payload.request_location_address)
    .bind(&payload.notes)
    .bind(&payload.patient_name)
    .bind(&payload.hospital_name)
    .bind(payload.max_distance_km.unwrap_or(50.0))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_blood_donation_request] Erreur: {}", e);
        AppError::Internal(format!("Erreur création demande: {}", e))
    })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur création demande");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    let request_id = result.get("request_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    let matches_found = result.get("matches_found").and_then(|v| v.as_i64());
    let message = result.get("message").and_then(|v| v.as_str()).map(|s| s.to_string());

    // Si des matches ont été trouvés et que la demande est urgente, notifier immédiatement
    if matches_found.unwrap_or(0) > 0 && payload.is_urgent.unwrap_or(false) {
        if let Some(ref req_id) = request_id {
            // Notifier les donneurs en arrière-plan (ne pas bloquer la réponse)
            let state_clone = state.clone();
            let req_id_clone = req_id.clone();
            tokio::spawn(async move {
                // Convertir l'erreur en String pour éviter le problème Send
                match notify_donors_for_request_internal(&state_clone, &req_id_clone, Some(10)).await {
                    Ok(_) => {}
                    Err(e) => {
                        let error_msg = format!("{:?}", e);
                        error!("[create_blood_donation_request] Erreur notification donneurs: {}", error_msg);
                    }
                }
            });
        }
    }

    let response = BloodDonationRequestResponse {
        success: true,
        request_id,
        matches_found,
        message,
        error: None,
    };

    Ok((StatusCode::CREATED, Json(json!(response))))
}

// ============================================================================
// NOTIFIER LES DONNEURS POUR UNE DEMANDE
// ============================================================================

/// Notifier les donneurs potentiels pour une demande (avec push notification avec son)
#[axum::debug_handler]
pub async fn notify_donors_for_request(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<NotifyDonorsRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[notify_donors_for_request] User ID: {}, Request ID: {}",
        user_id, payload.request_id
    );

    // Vérifier que l'utilisateur est propriétaire de la banque de sang ou a créé la demande
    let is_authorized: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM blood_donation_requests bdr
            JOIN banques_sang bs ON bs.id = bdr.banque_sang_id
            JOIN services s ON s.id = bs.service_id
            WHERE bdr.id = $1
                AND (bdr.requested_by_user_id = $2 OR s.user_id = $2)
        )
        "#
    )
    .bind(&payload.request_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[notify_donors_for_request] Erreur vérification: {}", e);
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_authorized {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas autorisé à notifier pour cette demande".to_string(),
        ));
    }

    let notified_count = notify_donors_for_request_internal(
        &state,
        &payload.request_id,
        payload.max_donors_to_notify,
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "notified_count": notified_count,
            "message": format!("{} donneur(s) notifié(s)", notified_count)
        })),
    ))
}

/// Fonction interne pour notifier les donneurs (utilisée aussi en arrière-plan)
async fn notify_donors_for_request_internal(
    state: &Arc<AppState>,
    request_id: &str,
    max_donors: Option<i32>,
) -> Result<i32, AppError> {
    // Récupérer les informations de la demande
    let request_info: Option<(String, String, bool, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT 
            bdr.groupe_sanguin_requis,
            bs.nom as banque_sang_nom,
            bdr.is_urgent,
            bdr.urgence_level,
            bdr.request_location_address
        FROM blood_donation_requests bdr
        JOIN banques_sang bs ON bs.id = bdr.banque_sang_id
        WHERE bdr.id = $1 AND bdr.status = 'active'
        "#
    )
    .bind(request_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[notify_donors_for_request_internal] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération demande: {}", e))
    })?;

    let (groupe_sanguin, banque_nom, is_urgent, urgence_level, location) = match request_info {
        Some(info) => info,
        None => {
            return Err(AppError::NotFound("Demande non trouvée ou inactive".to_string()));
        }
    };

    // Récupérer les matches pending à notifier
    let matches: Vec<(String, i32, Option<f64>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT 
            bdm.id as match_id,
            bdm.donor_user_id,
            bdm.distance_km,
            u.nom_complet
        FROM blood_donation_matches bdm
        JOIN users u ON u.id = bdm.donor_user_id
        WHERE bdm.request_id = $1
            AND bdm.match_status = 'pending'
            AND bdm.notification_sent = FALSE
        ORDER BY bdm.relevance_score DESC, bdm.distance_km ASC NULLS LAST
        LIMIT $2
        "#
    )
    .bind(request_id)
    .bind(max_donors.unwrap_or(20) as i64)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[notify_donors_for_request_internal] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération matches: {}", e))
    })?;

    let mut notified_count = 0;

    for (match_id, donor_user_id, distance_km, _donor_name) in matches {
        // Construire le message de notification
        let title = if is_urgent {
            format!("🩸 URGENCE: Don de sang {} requis", groupe_sanguin)
        } else {
            format!("🩸 Demande de don de sang {}", groupe_sanguin)
        };

        let mut body = format!(
            "La banque de sang {} recherche du sang de groupe {}",
            banque_nom, groupe_sanguin
        );

        if let Some(dist) = distance_km {
            body.push_str(&format!(" (à {:.1} km de vous)", dist));
        }

        if let Some(loc) = &location {
            body.push_str(&format!(" - {}", loc));
        }

        // Données pour la notification
        let notification_data = json!({
            "type": "blood_donation_request",
            "request_id": request_id,
            "match_id": match_id,
            "groupe_sanguin": groupe_sanguin,
            "banque_sang_nom": banque_nom,
            "is_urgent": is_urgent,
            "urgence_level": urgence_level,
            "distance_km": distance_km,
            "location": location
        });

        // Son d'alerte pour urgences (critique)
        let sound = if is_urgent && urgence_level == "critique" {
            Some("alert_urgent".to_string()) // Son d'alerte spécial
        } else if is_urgent {
            Some("default".to_string())
        } else {
            Some("default".to_string())
        };

        // Envoyer la notification push avec son
        // Convertir l'erreur en String pour éviter le problème Send
        let notification_result = push_notification_service::send_push_notification(
            &state.pg,
            donor_user_id,
            title.clone(),
            body.clone(),
            Some(notification_data),
            sound,
        )
        .await
        .map_err(|e| format!("{:?}", e));
        
        match notification_result {
            Ok(_) => {
                // Marquer comme notifié
                sqlx::query(
                    r#"
                    UPDATE blood_donation_matches
                    SET match_status = 'notified',
                        notification_sent = TRUE,
                        notified_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $1
                    "#
                )
                .bind(&match_id)
                .execute(&state.pg)
                .await
                .map_err(|e| {
                    error!("[notify_donors_for_request_internal] Erreur mise à jour match: {}", e);
                })
                .ok();

                notified_count += 1;
                info!(
                    "[notify_donors_for_request_internal] ✅ Donneur {} notifié pour demande {}",
                    donor_user_id, request_id
                );
            }
            Err(e) => {
                error!(
                    "[notify_donors_for_request_internal] ❌ Erreur notification donneur {}: {}",
                    donor_user_id, format!("{:?}", e)
                );
            }
        }
    }

    Ok(notified_count)
}

// ============================================================================
// METTRE À JOUR STATUT D'UN MATCH
// ============================================================================

/// Mettre à jour le statut d'un match (accepté/refusé par le donneur)
pub async fn update_match_status(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateMatchStatusRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_match_status] User ID: {}, Match ID: {}, New Status: {}",
        user_id, payload.match_id, payload.new_status
    );

    // Vérifier que l'utilisateur est le donneur du match
    let is_donor: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM blood_donation_matches
            WHERE id = $1 AND donor_user_id = $2
        )
        "#
    )
    .bind(&payload.match_id)
    .bind(user_id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_match_status] Erreur vérification: {}", e);
        AppError::Internal(format!("Erreur vérification: {}", e))
    })?;

    if !is_donor {
        return Err(AppError::Forbidden(
            "Vous n'êtes pas le donneur de ce match".to_string(),
        ));
    }

    // Valider le statut
    let valid_statuses = ["accepted", "declined", "completed"];
    if !valid_statuses.contains(&payload.new_status.as_str()) {
        return Err(AppError::BadRequest(
            "Statut invalide. Valeurs acceptées: accepted, declined, completed".to_string(),
        ));
    }

    // Appeler la fonction SQL
    let result: Value = sqlx::query_scalar(
        "SELECT update_blood_donation_match_status($1, $2, $3)"
    )
    .bind(&payload.match_id)
    .bind(&payload.new_status)
    .bind(&payload.declined_reason)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_match_status] Erreur: {}", e);
        AppError::Internal(format!("Erreur mise à jour match: {}", e))
    })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur mise à jour match");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    // Si accepté, mettre à jour la disponibilité du donneur
    if payload.new_status == "accepted" {
        // Récupérer le groupe sanguin du donneur
        let blood_group: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT ubg.groupe_sanguin
            FROM blood_donation_matches bdm
            JOIN user_blood_groups ubg ON ubg.id = bdm.donor_blood_group_id
            WHERE bdm.id = $1
            "#
        )
        .bind(&payload.match_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| {
            error!("[update_match_status] Erreur récupération groupe: {}", e);
        })
        .ok()
        .flatten();

        if let Some((groupe_sanguin,)) = blood_group {
            // Marquer le donneur comme non disponible (sera mis à jour après le don effectif)
            sqlx::query(
                r#"
                UPDATE user_blood_groups
                SET is_available_for_donation = FALSE,
                    updated_at = NOW()
                WHERE user_id = $1 AND groupe_sanguin = $2
                "#
            )
            .bind(user_id)
            .bind(&groupe_sanguin)
            .execute(&state.pg)
            .await
            .map_err(|e| {
                warn!("[update_match_status] Erreur mise à jour disponibilité: {}", e);
            })
            .ok();
        }
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "match_id": payload.match_id,
            "new_status": payload.new_status
        })),
    ))
}

// ============================================================================
// LISTER LES DEMANDES ACTIVES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ListRequestsQuery {
    pub banque_sang_id: Option<i32>,
    pub groupe_sanguin: Option<String>,
    pub is_urgent: Option<bool>,
}

/// Lister les demandes actives de don de sang
pub async fn list_active_requests(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListRequestsQuery>,
) -> AppResult<impl IntoResponse> {
    info!("[list_active_requests] Listing demandes actives");

    // Construire la requête avec filtres optionnels
    let rows = if params.banque_sang_id.is_some() || params.groupe_sanguin.is_some() || params.is_urgent.is_some() {
        sqlx::query(
            r#"
            SELECT 
                id, banque_sang_id, banque_sang_nom, groupe_sanguin_requis,
                quantite_requise, is_urgent, urgence_level, status,
                request_location_address, patient_name, hospital_name,
                created_at, matches_count, accepted_matches_count
            FROM blood_donation_requests_active
            WHERE ($1::INTEGER IS NULL OR banque_sang_id = $1)
                AND ($2::VARCHAR IS NULL OR groupe_sanguin_requis = $2)
                AND ($3::BOOLEAN IS NULL OR is_urgent = $3)
            ORDER BY created_at DESC
            LIMIT 50
            "#
        )
        .bind(params.banque_sang_id)
        .bind(&params.groupe_sanguin)
        .bind(params.is_urgent)
        .fetch_all(&state.pg)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT 
                id, banque_sang_id, banque_sang_nom, groupe_sanguin_requis,
                quantite_requise, is_urgent, urgence_level, status,
                request_location_address, patient_name, hospital_name,
                created_at, matches_count, accepted_matches_count
            FROM blood_donation_requests_active
            ORDER BY created_at DESC
            LIMIT 50
            "#
        )
        .fetch_all(&state.pg)
        .await
    }
    .map_err(|e| {
        error!("[list_active_requests] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération demandes: {}", e))
    })?;

    let mut requests = Vec::new();
    for row in rows {
        let request = BloodDonationRequestInfo {
            id: row.get::<String, _>("id"),
            banque_sang_id: row.get::<i32, _>("banque_sang_id"),
            banque_sang_nom: row.get::<String, _>("banque_sang_nom"),
            groupe_sanguin_requis: row.get::<String, _>("groupe_sanguin_requis"),
            quantite_requise: row.get::<i32, _>("quantite_requise"),
            is_urgent: row.get::<bool, _>("is_urgent"),
            urgence_level: row.get::<Option<String>, _>("urgence_level").unwrap_or_else(|| "normal".to_string()),
            status: row.get::<Option<String>, _>("status").unwrap_or_else(|| "active".to_string()),
            request_location_address: row.get::<Option<String>, _>("request_location_address"),
            patient_name: row.get::<Option<String>, _>("patient_name"),
            hospital_name: row.get::<Option<String>, _>("hospital_name"),
            created_at: row
                .get::<chrono::DateTime<chrono::Utc>, _>("created_at")
                .to_rfc3339(),
            matches_count: row.get::<i64, _>("matches_count"),
            accepted_matches_count: row.get::<i64, _>("accepted_matches_count"),
        };
        requests.push(request);
    }

    Ok((StatusCode::OK, Json(json!({ "success": true, "requests": requests }))))
}

// ============================================================================
// LISTER LES MATCHES POUR UNE DEMANDE
// ============================================================================

/// Lister les matches (donneurs) pour une demande spécifique
pub async fn list_matches_for_request(
    State(state): State<Arc<AppState>>,
    Path(request_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    info!("[list_matches_for_request] Request ID: {}", request_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            bdm.id as match_id,
            bdm.donor_user_id,
            u.nom_complet as donor_name,
            u.telephone as donor_telephone,
            u.whatsapp as donor_whatsapp,
            ubg.groupe_sanguin,
            bdm.distance_km,
            bdm.relevance_score,
            bdm.match_status,
            bdm.notified_at
        FROM blood_donation_matches bdm
        JOIN users u ON u.id = bdm.donor_user_id
        JOIN user_blood_groups ubg ON ubg.id = bdm.donor_blood_group_id
        WHERE bdm.request_id = $1
        ORDER BY bdm.relevance_score DESC, bdm.distance_km ASC NULLS LAST
        "#
    )
    .bind(&request_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_matches_for_request] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération matches: {}", e))
    })?;

    let mut matches = Vec::new();
    for row in rows {
        let match_info = DonorMatchInfo {
            match_id: row.get::<String, _>("match_id"),
            donor_user_id: row.get::<i32, _>("donor_user_id"),
            donor_name: row.get::<Option<String>, _>("donor_name"),
            donor_telephone: row.get::<Option<String>, _>("donor_telephone"),
            donor_whatsapp: row.get::<Option<String>, _>("donor_whatsapp"),
            groupe_sanguin: row.get::<String, _>("groupe_sanguin"),
            distance_km: row.get::<Option<f64>, _>("distance_km"),
            relevance_score: row.get::<f64, _>("relevance_score"),
            match_status: row.get::<Option<String>, _>("match_status").unwrap_or_else(|| "pending".to_string()),
            notified_at: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("notified_at")
                .map(|dt| dt.to_rfc3339()),
        };
        matches.push(match_info);
    }

    Ok((StatusCode::OK, Json(json!({ "success": true, "matches": matches }))))
}

// ============================================================================
// METTRE À JOUR DATE DERNIER DON
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateLastDonationRequest {
    pub groupe_sanguin: String,
    pub donation_date: Option<String>, // Format: YYYY-MM-DD, défaut: aujourd'hui
}

/// Mettre à jour la date de dernier don (après don effectué)
pub async fn update_last_donation(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<UpdateLastDonationRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[update_last_donation] User ID: {}, Groupe: {}",
        user_id, payload.groupe_sanguin
    );

    let donation_date = if let Some(ref date_str) = payload.donation_date {
        chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map_err(|_| AppError::BadRequest("Format date invalide (YYYY-MM-DD requis)".to_string()))?
    } else {
        chrono::Utc::now().date_naive()
    };

    let result: Value = sqlx::query_scalar(
        "SELECT update_donor_last_donation($1, $2, $3)"
    )
    .bind(user_id)
    .bind(&payload.groupe_sanguin)
    .bind(donation_date)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[update_last_donation] Erreur: {}", e);
        AppError::Internal(format!("Erreur mise à jour dernier don: {}", e))
    })?;

    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if !success {
        let error_msg = result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Erreur mise à jour");
        return Err(AppError::BadRequest(error_msg.to_string()));
    }

    let next_available = result
        .get("next_donation_available_date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let message = result.get("message").and_then(|v| v.as_str()).map(|s| s.to_string());

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "next_donation_available_date": next_available,
            "message": message
        })),
    ))
}

// ============================================================================
// GESTION GROUPE SANGUIN UTILISATEUR
// ============================================================================

/// Récupérer les groupes sanguins d'un utilisateur
pub async fn get_user_blood_groups(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
) -> AppResult<impl IntoResponse> {
    info!("[get_user_blood_groups] User ID: {}", user_id);

    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            user_id,
            groupe_sanguin,
            is_available_for_donation,
            last_donation_date,
            next_donation_available_date,
            created_at,
            updated_at
        FROM user_blood_groups
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_user_blood_groups] Erreur: {}", e);
        AppError::Internal(format!("Erreur récupération groupes sanguins: {}", e))
    })?;

    let mut blood_groups = Vec::new();
    for row in rows {
        blood_groups.push(json!({
            "id": row.get::<i32, _>("id"),
            "user_id": row.get::<i32, _>("user_id"),
            "groupe_sanguin": row.get::<String, _>("groupe_sanguin"),
            "is_available_for_donation": row.get::<bool, _>("is_available_for_donation"),
            "last_donation_date": row.get::<Option<chrono::NaiveDate>, _>("last_donation_date"),
            "next_donation_available_date": row.get::<Option<chrono::NaiveDate>, _>("next_donation_available_date"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            "updated_at": row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("updated_at")
                .map(|dt| dt.to_rfc3339())
        }));
    }

    Ok((StatusCode::OK, Json(json!({ "success": true, "data": blood_groups }))))
}

#[derive(Debug, Deserialize)]
pub struct CreateOrUpdateBloodGroupRequest {
    pub groupe_sanguin: String,
    pub is_available_for_donation: Option<bool>,
}

/// Créer ou mettre à jour le groupe sanguin d'un utilisateur
pub async fn create_or_update_blood_group(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateOrUpdateBloodGroupRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[create_or_update_blood_group] User ID: {}, Groupe: {}",
        user_id, payload.groupe_sanguin
    );

    // Valider le groupe sanguin
    let valid_groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
    if !valid_groups.contains(&payload.groupe_sanguin.as_str()) {
        return Err(AppError::BadRequest(
            "Groupe sanguin invalide. Valeurs acceptées: O+, O-, A+, A-, B+, B-, AB+, AB-".to_string(),
        ));
    }

    // Créer ou mettre à jour
    let result = sqlx::query(
        r#"
        INSERT INTO user_blood_groups (user_id, groupe_sanguin, is_available_for_donation, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, groupe_sanguin)
        DO UPDATE SET
            is_available_for_donation = COALESCE($3, user_blood_groups.is_available_for_donation),
            updated_at = NOW()
        RETURNING id, groupe_sanguin, is_available_for_donation
        "#
    )
    .bind(user_id)
    .bind(&payload.groupe_sanguin)
    .bind(payload.is_available_for_donation.unwrap_or(true))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[create_or_update_blood_group] Erreur: {}", e);
        AppError::Internal(format!("Erreur sauvegarde groupe sanguin: {}", e))
    })?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "id": result.get::<i32, _>("id"),
                "groupe_sanguin": result.get::<String, _>("groupe_sanguin"),
                "is_available_for_donation": result.get::<bool, _>("is_available_for_donation")
            },
            "message": "Groupe sanguin enregistré avec succès"
        })),
    ))
}

