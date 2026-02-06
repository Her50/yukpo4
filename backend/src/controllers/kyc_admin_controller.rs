// ✅ Contrôleur admin pour vérification manuelle KYC

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::services::kyc_service::{DocumentStatus, DocumentVerificationResult, KYCService};
use crate::state::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    response::IntoResponse,
    Json,
};
use log::{error, info};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListPendingDocumentsQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub document_type: Option<String>,
    pub user_id: Option<i32>,
    pub sort_by: Option<String>, // "confidence" | "created_at" | "document_type"
}

/// GET /api/admin/kyc/pending
/// Liste des documents en attente de vérification
pub async fn list_pending_documents(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<ListPendingDocumentsQuery>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[list_pending_documents] Admin user_id={} liste documents pending",
        admin_id
    );

    // Vérifier que l'utilisateur est admin
    let is_admin: bool = sqlx::query_scalar("SELECT role = 'admin' FROM users WHERE id = $1")
        .bind(admin_id)
        .fetch_optional(&state.pg)
        .await?
        .unwrap_or(false);

    if !is_admin {
        return Err(AppError::Forbidden("Accès admin requis".to_string()));
    }

    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * limit;

    // Construire conditions WHERE
    let mut where_conditions = vec!["status = 'pending'".to_string()];

    if let Some(ref doc_type) = query.document_type {
        where_conditions.push(format!("document_type = '{}'", doc_type.replace("'", "''")));
    }

    if let Some(user_id) = query.user_id {
        where_conditions.push(format!("user_id = {}", user_id));
    }

    let where_clause = where_conditions.join(" AND ");

    // Déterminer l'ordre de tri
    let order_by = match query.sort_by.as_deref() {
        Some("confidence") => "COALESCE((ud.metadata->'ai_analysis'->'extracted_data'->>'confidence_score')::float, 0.0) DESC, ud.created_at DESC",
        Some("document_type") => "ud.document_type ASC, ud.created_at DESC",
        _ => "ud.created_at DESC",
    };

    // Requête SQL avec metadata pour extraire résultats IA
    let documents = sqlx::query(&format!(
        r#"
        SELECT
            ud.id,
            ud.user_id,
            ud.document_type,
            ud.document_url,
            ud.document_number,
            ud.status,
            ud.metadata,
            ud.created_at,
            u.nom_complet as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar
        FROM user_documents ud
        INNER JOIN users u ON u.id = ud.user_id
        WHERE {}
        ORDER BY {}
        LIMIT {} OFFSET {}
        "#,
        where_clause, order_by, limit, offset
    ))
    .fetch_all(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_pending_documents] Erreur requête: {}", e);
        AppError::Internal(format!("Erreur récupération documents: {}", e))
    })?;

    // Compter total
    let total: i64 = sqlx::query_scalar(&format!(
        r#"
        SELECT COUNT(*)::bigint
        FROM user_documents
        WHERE {}
        "#,
        where_clause
    ))
    .fetch_one(&state.pg)
    .await
    .map_err(|e| {
        error!("[list_pending_documents] Erreur count: {}", e);
        AppError::Internal(format!("Erreur count documents: {}", e))
    })?;

    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as i64
    } else {
        0
    };

    // Convertir en JSON avec extraction résultats IA
    let mut docs_json = Vec::new();
    for row in documents {
        let metadata: Option<serde_json::Value> =
            row.get::<Option<serde_json::Value>, _>("metadata");

        // Extraire résultats IA du metadata
        // Structure: metadata.ai_analysis.extracted_data.confidence_score
        let (ai_confidence_score, ai_recommendation, has_ai_analysis) = if let Some(ref meta) =
            metadata
        {
            if let Some(ai_analysis) = meta.get("ai_analysis") {
                // Les résultats sont dans extracted_data
                if let Some(extracted_data) = ai_analysis.get("extracted_data") {
                    let confidence =
                        extracted_data.get("confidence_score").and_then(|v| v.as_f64());
                    let recommendation = extracted_data
                        .get("recommendation")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    (confidence, recommendation, true)
                } else {
                    // Fallback: chercher directement dans ai_analysis
                    let confidence = ai_analysis.get("confidence_score").and_then(|v| v.as_f64());
                    let recommendation = ai_analysis
                        .get("recommendation")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let has_ai = confidence.is_some() || recommendation.is_some();
                    (confidence, recommendation, has_ai)
                }
            } else {
                (None, None, false)
            }
        } else {
            (None, None, false)
        };

        docs_json.push(json!({
            "id": row.get::<i32, _>("id"),
            "user_id": row.get::<i32, _>("user_id"),
            "user_name": row.get::<Option<String>, _>("user_name"),
            "user_email": row.get::<Option<String>, _>("user_email"),
            "user_avatar": row.get::<Option<String>, _>("user_avatar"),
            "document_type": row.get::<String, _>("document_type"),
            "document_url": row.get::<String, _>("document_url"),
            "document_number": row.get::<Option<String>, _>("document_number"),
            "status": row.get::<String, _>("status"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "ai_confidence_score": ai_confidence_score,
            "ai_recommendation": ai_recommendation,
            "has_ai_analysis": has_ai_analysis,
        }));
    }

    info!(
        "[list_pending_documents] ✅ {} documents pending trouvés",
        docs_json.len()
    );

    Ok(Json(json!({
        "success": true,
        "data": docs_json,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct VerifyDocumentRequest {
    pub status: String, // "approved" | "rejected"
    pub rejection_reason: Option<String>,
}

/// POST /api/admin/kyc/:id/verify
/// Vérifier manuellement un document (admin)
pub async fn verify_document_manual(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Path(document_id): Path<i32>,
    Json(payload): Json<VerifyDocumentRequest>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[verify_document_manual] Admin user_id={} vérifie document ID={}, status={}",
        admin_id, document_id, payload.status
    );

    // TODO: Vérifier que l'utilisateur est admin (voir commentaire ci-dessus)

    // Validation
    if !["approved", "rejected"].contains(&payload.status.as_str()) {
        return Err(AppError::BadRequest(
            "Status doit être 'approved' ou 'rejected'".to_string(),
        ));
    }

    let kyc_service = KYCService::new(Arc::new(state.pg.clone())).await;

    let result = DocumentVerificationResult {
        status: if payload.status == "approved" {
            DocumentStatus::Approved
        } else {
            DocumentStatus::Rejected
        },
        confidence_score: None,
        extracted_data: None,
        rejection_reason: payload.rejection_reason.clone(),
        verified_at: Some(chrono::Utc::now()),
    };

    kyc_service.verify_document(document_id, result, Some(admin_id)).await?;

    info!(
        "[verify_document_manual] ✅ Document ID={} vérifié manuellement par admin ID={}",
        document_id, admin_id
    );

    Ok(Json(json!({
        "success": true,
        "message": format!("Document {} avec succès", payload.status)
    })))
}

/// GET /api/admin/kyc/:id
/// Détails d'un document
pub async fn get_document_details(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: admin_id, .. }): Extension<AuthenticatedUser>,
    Path(document_id): Path<i32>,
) -> AppResult<impl IntoResponse> {
    info!(
        "[get_document_details] Admin user_id={} récupère document ID={}",
        admin_id, document_id
    );

    let document = sqlx::query(
        r#"
        SELECT
            ud.id,
            ud.user_id,
            ud.document_type,
            ud.document_url,
            ud.document_number,
            ud.status,
            ud.verified_at,
            ud.verified_by,
            ud.rejection_reason,
            ud.expiry_date,
            ud.metadata,
            ud.created_at,
            ud.updated_at,
            u.nom_complet as user_name,
            u.email as user_email,
            u.avatar_url as user_avatar,
            u.is_verified as user_is_verified
        FROM user_documents ud
        INNER JOIN users u ON u.id = ud.user_id
        WHERE ud.id = $1
        "#,
    )
    .bind(document_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|e| {
        error!("[get_document_details] Erreur requête: {}", e);
        AppError::Internal(format!("Erreur récupération document: {}", e))
    })?;

    let doc_row = match document {
        Some(row) => row,
        None => {
            return Err(AppError::NotFound(format!(
                "Document ID {} non trouvé",
                document_id
            )));
        }
    };

    let doc_json = json!({
        "id": doc_row.get::<i32, _>("id"),
        "user_id": doc_row.get::<i32, _>("user_id"),
        "user_name": doc_row.get::<Option<String>, _>("user_name"),
        "user_email": doc_row.get::<Option<String>, _>("user_email"),
        "user_avatar": doc_row.get::<Option<String>, _>("user_avatar"),
        "user_is_verified": doc_row.get::<Option<bool>, _>("user_is_verified").unwrap_or(false),
        "document_type": doc_row.get::<String, _>("document_type"),
        "document_url": doc_row.get::<String, _>("document_url"),
        "document_number": doc_row.get::<Option<String>, _>("document_number"),
        "status": doc_row.get::<String, _>("status"),
        "verified_at": doc_row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("verified_at"),
        "verified_by": doc_row.get::<Option<i32>, _>("verified_by"),
        "rejection_reason": doc_row.get::<Option<String>, _>("rejection_reason"),
        "expiry_date": doc_row.get::<Option<chrono::NaiveDate>, _>("expiry_date"),
        "metadata": doc_row.get::<serde_json::Value, _>("metadata"),
        "created_at": doc_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "updated_at": doc_row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
    });

    Ok(Json(json!({
        "success": true,
        "data": doc_json
    })))
}
