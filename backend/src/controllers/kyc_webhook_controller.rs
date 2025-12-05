// ✅ Contrôleur webhook pour recevoir résultats vérification KYC (Onfido/Jumio)

use crate::core::types::{AppError, AppResult};
use crate::services::kyc_service::{DocumentStatus, DocumentVerificationResult, KYCService};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct OnfidoWebhookPayload {
    pub payload: OnfidoWebhookData,
}

#[derive(Debug, Deserialize)]
pub struct OnfidoWebhookData {
    pub resource_type: String,
    pub action: String,
    pub object: OnfidoWebhookObject,
}

#[derive(Debug, Deserialize)]
pub struct OnfidoWebhookObject {
    pub id: String,
    pub status: String,
    pub result: Option<String>,
    pub breakdown: Option<serde_json::Value>,
    pub properties: Option<serde_json::Value>,
}

/// POST /api/kyc/webhook/onfido
/// Webhook Onfido pour recevoir résultats vérification
pub async fn onfido_webhook(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<OnfidoWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!("[onfido_webhook] Reçu webhook Onfido: action={}, resource={}", 
          payload.payload.action, payload.payload.resource_type);

    // Vérifier token webhook (optionnel mais recommandé)
    if let Some(token) = std::env::var("ONFIDO_WEBHOOK_TOKEN").ok() {
        if let Some(header_token) = headers.get("x-sha2-signature") {
            // TODO: Vérifier signature SHA-256 (voir doc Onfido)
            // Pour l'instant, on accepte
        }
    }

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    // Trouver le document correspondant au check_id
    let check_id = &payload.payload.object.id;
    
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM user_documents
        WHERE metadata->>'onfido_check_id' = $1
        LIMIT 1
        "#
    )
    .bind(check_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[onfido_webhook] Erreur recherche document: {}", e);
        AppError::Internal("Erreur recherche document".to_string())
    })?;

    let document_id = match document_id {
        Some(id) => id,
        None => {
            warn!("[onfido_webhook] ⚠️ Document non trouvé pour check_id={}", check_id);
            return Ok(Json(json!({
                "success": true,
                "message": "Document non trouvé, ignoré"
            })));
        }
    };

    // Déterminer le statut
    let status = match payload.payload.object.status.as_str() {
        "complete" => {
            match payload.payload.object.result.as_deref() {
                Some("clear") => DocumentStatus::Approved,
                Some("consider") | Some("unidentified") => DocumentStatus::Rejected,
                _ => DocumentStatus::Pending,
            }
        }
        "withdrawal" => DocumentStatus::Rejected,
        _ => DocumentStatus::Pending,
    };

    let confidence_score = payload.payload.object.breakdown
        .as_ref()
        .and_then(|b| b.get("document"))
        .and_then(|d| d.get("score"))
        .and_then(|s| s.as_f64());

    let rejection_reason = if matches!(status, DocumentStatus::Rejected) {
        payload.payload.object.result.clone()
    } else {
        None
    };

    let result = DocumentVerificationResult {
        status,
        confidence_score,
        extracted_data: payload.payload.object.properties.clone(),
        rejection_reason,
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, None).await?;

    info!("[onfido_webhook] ✅ Document ID={} vérifié: status={:?}", document_id, status);

    Ok(Json(json!({
        "success": true,
        "message": "Webhook traité avec succès"
    })))
}

#[derive(Debug, Deserialize)]
pub struct JumioWebhookPayload {
    pub event_type: String,
    pub callback_date: String,
    pub scan_reference: String,
    pub verification: JumioVerification,
}

#[derive(Debug, Deserialize)]
pub struct JumioVerification {
    pub status: String,
    pub identity_verification: Option<JumioIdentityVerification>,
}

#[derive(Debug, Deserialize)]
pub struct JumioIdentityVerification {
    pub similarity: Option<String>,
    pub validity: Option<String>,
}

/// POST /api/kyc/webhook/jumio
/// Webhook Jumio pour recevoir résultats vérification
pub async fn jumio_webhook(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<JumioWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!("[jumio_webhook] Reçu webhook Jumio: event={}, scan_ref={}", 
          payload.event_type, payload.scan_reference);

    // Vérifier token webhook (optionnel mais recommandé)
    if let Some(token) = std::env::var("JUMIO_WEBHOOK_TOKEN").ok() {
        if let Some(header_token) = headers.get("authorization") {
            // TODO: Vérifier token JWT ou signature
        }
    }

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    // Trouver le document correspondant au scan_reference
    let scan_ref = &payload.scan_reference;
    
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM user_documents
        WHERE metadata->>'jumio_transaction_reference' = $1
        LIMIT 1
        "#
    )
    .bind(scan_ref)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[jumio_webhook] Erreur recherche document: {}", e);
        AppError::Internal("Erreur recherche document".to_string())
    })?;

    let document_id = match document_id {
        Some(id) => id,
        None => {
            warn!("[jumio_webhook] ⚠️ Document non trouvé pour scan_ref={}", scan_ref);
            return Ok(Json(json!({
                "success": true,
                "message": "Document non trouvé, ignoré"
            })));
        }
    };

    // Déterminer le statut
    let status = match payload.verification.status.as_str() {
        "APPROVED_VERIFIED" => DocumentStatus::Approved,
        "DENIED_FRAUD" | "DENIED_UNSUPPORTED_ID_TYPE" | "DENIED_UNSUPPORTED_ID_COUNTRY" 
        | "DENIED_NAME_MISMATCH" | "ERROR_NOT_READABLE_ID" => DocumentStatus::Rejected,
        _ => DocumentStatus::Pending,
    };

    let confidence_score = payload.verification.identity_verification
        .as_ref()
        .and_then(|iv| iv.similarity.as_ref())
        .and_then(|s| s.parse::<f64>().ok())
        .map(|s| s / 100.0); // Convertir pourcentage en 0-1

    let rejection_reason = if matches!(status, DocumentStatus::Rejected) {
        Some(payload.verification.status.clone())
    } else {
        None
    };

    let result = DocumentVerificationResult {
        status,
        confidence_score,
        extracted_data: Some(json!(payload.verification)),
        rejection_reason,
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, None).await?;

    info!("[jumio_webhook] ✅ Document ID={} vérifié: status={:?}", document_id, status);

    Ok(Json(json!({
        "success": true,
        "message": "Webhook traité avec succès"
    })))
}

#[derive(Debug, Deserialize)]
pub struct SumsubWebhookPayload {
    pub applicant_id: String,
    pub inspection_id: String,
    pub review_status: String,
    pub review_result: Option<SumsubReviewResult>,
}

#[derive(Debug, Deserialize)]
pub struct SumsubReviewResult {
    pub review_answer: String, // "GREEN", "RED", "YELLOW"
    pub review_reject_labels: Option<Vec<String>>,
}

/// POST /api/kyc/webhook/sumsub
/// Webhook Sumsub pour recevoir résultats vérification
pub async fn sumsub_webhook(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<SumsubWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!("[sumsub_webhook] Reçu webhook Sumsub: applicant_id={}, status={}", 
          payload.applicant_id, payload.review_status);

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    let applicant_id = &payload.applicant_id;
    
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM user_documents
        WHERE metadata->>'sumsub_applicant_id' = $1
        LIMIT 1
        "#
    )
    .bind(applicant_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[sumsub_webhook] Erreur recherche document: {}", e);
        AppError::Internal("Erreur recherche document".to_string())
    })?;

    let document_id = match document_id {
        Some(id) => id,
        None => {
            warn!("[sumsub_webhook] ⚠️ Document non trouvé pour applicant_id={}", applicant_id);
            return Ok(Json(json!({
                "success": true,
                "message": "Document non trouvé, ignoré"
            })));
        }
    };

    let status = match payload.review_result.as_ref().map(|r| r.review_answer.as_str()) {
        Some("GREEN") => DocumentStatus::Approved,
        Some("RED") => DocumentStatus::Rejected,
        _ => DocumentStatus::Pending,
    };

    let rejection_reason = if matches!(status, DocumentStatus::Rejected) {
        payload.review_result
            .and_then(|r| r.review_reject_labels)
            .map(|labels| labels.join(", "))
    } else {
        None
    };

    let result = DocumentVerificationResult {
        status,
        confidence_score: None,
        extracted_data: Some(json!(payload)),
        rejection_reason,
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, None).await?;

    info!("[sumsub_webhook] ✅ Document ID={} vérifié: status={:?}", document_id, status);

    Ok(Json(json!({
        "success": true,
        "message": "Webhook traité avec succès"
    })))
}

#[derive(Debug, Deserialize)]
pub struct VeriffWebhookPayload {
    pub id: String,
    pub status: String,
    pub code: Option<i32>,
    pub verification: VeriffVerification,
}

#[derive(Debug, Deserialize)]
pub struct VeriffVerification {
    pub id: String,
    pub status: String,
    pub code: Option<i32>,
}

/// POST /api/kyc/webhook/veriff
/// Webhook Veriff pour recevoir résultats vérification
pub async fn veriff_webhook(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<VeriffWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!("[veriff_webhook] Reçu webhook Veriff: session_id={}, status={}", 
          payload.verification.id, payload.status);

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    let session_id = &payload.verification.id;
    
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM user_documents
        WHERE metadata->>'veriff_session_id' = $1
        LIMIT 1
        "#
    )
    .bind(session_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[veriff_webhook] Erreur recherche document: {}", e);
        AppError::Internal("Erreur recherche document".to_string())
    })?;

    let document_id = match document_id {
        Some(id) => id,
        None => {
            warn!("[veriff_webhook] ⚠️ Document non trouvé pour session_id={}", session_id);
            return Ok(Json(json!({
                "success": true,
                "message": "Document non trouvé, ignoré"
            })));
        }
    };

    let status = match payload.status.as_str() {
        "success" => DocumentStatus::Approved,
        "declined" | "abandoned" | "expired" => DocumentStatus::Rejected,
        _ => DocumentStatus::Pending,
    };

    let rejection_reason = if matches!(status, DocumentStatus::Rejected) {
        payload.code.map(|c| format!("Code erreur Veriff: {}", c))
    } else {
        None
    };

    let result = DocumentVerificationResult {
        status,
        confidence_score: None,
        extracted_data: Some(json!(payload)),
        rejection_reason,
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, None).await?;

    info!("[veriff_webhook] ✅ Document ID={} vérifié: status={:?}", document_id, status);

    Ok(Json(json!({
        "success": true,
        "message": "Webhook traité avec succès"
    })))
}

#[derive(Debug, Deserialize)]
pub struct PersonaWebhookPayload {
    pub data: PersonaWebhookData,
}

#[derive(Debug, Deserialize)]
pub struct PersonaWebhookData {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub attributes: PersonaAttributes,
}

#[derive(Debug, Deserialize)]
pub struct PersonaAttributes {
    pub status: String,
    pub inquiry_id: String,
}

/// POST /api/kyc/webhook/persona
/// Webhook Persona pour recevoir résultats vérification
pub async fn persona_webhook(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<PersonaWebhookPayload>,
) -> AppResult<impl IntoResponse> {
    info!("[persona_webhook] Reçu webhook Persona: inquiry_id={}, status={}", 
          payload.data.attributes.inquiry_id, payload.data.attributes.status);

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    let inquiry_id = &payload.data.attributes.inquiry_id;
    
    let document_id: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM user_documents
        WHERE metadata->>'persona_inquiry_id' = $1
        LIMIT 1
        "#
    )
    .bind(inquiry_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[persona_webhook] Erreur recherche document: {}", e);
        AppError::Internal("Erreur recherche document".to_string())
    })?;

    let document_id = match document_id {
        Some(id) => id,
        None => {
            warn!("[persona_webhook] ⚠️ Document non trouvé pour inquiry_id={}", inquiry_id);
            return Ok(Json(json!({
                "success": true,
                "message": "Document non trouvé, ignoré"
            })));
        }
    };

    let status = match payload.data.attributes.status.as_str() {
        "completed" | "approved" => DocumentStatus::Approved,
        "failed" | "declined" => DocumentStatus::Rejected,
        _ => DocumentStatus::Pending,
    };

    let result = DocumentVerificationResult {
        status,
        confidence_score: None,
        extracted_data: Some(json!(payload)),
        rejection_reason: None,
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, None).await?;

    info!("[persona_webhook] ✅ Document ID={} vérifié: status={:?}", document_id, status);

    Ok(Json(json!({
        "success": true,
        "message": "Webhook traité avec succès"
    })))
}

