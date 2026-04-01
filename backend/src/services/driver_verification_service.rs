// ✅ Service KYC vérification conducteur — CNI + selfie
// Analyse automatique via Google Cloud Vision API (document_ai_service)
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmitVerificationRequest {
    pub service_type: String,
    /// URL stockée (référence d'affichage)
    pub cni_front_url: Option<String>,
    pub cni_back_url: Option<String>,
    pub selfie_url: Option<String>,
    /// Images en base64 pour l'analyse IA (Vision API)
    pub cni_front_base64: Option<String>,
    pub cni_back_base64: Option<String>,
    pub selfie_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationStatus {
    pub id: i64,
    pub user_id: i32,
    pub service_type: String,
    pub cni_front_url: Option<String>,
    pub cni_back_url: Option<String>,
    pub selfie_url: Option<String>,
    pub status: String,
    pub rejection_reason: Option<String>,
    pub submitted_at: String,
    pub reviewed_at: Option<String>,
    pub is_complete: bool,
    // Champs IA
    pub ai_score: Option<i32>,
    pub ai_decision: Option<String>,
    pub ai_extracted_name: Option<String>,
    pub ai_extracted_id: Option<String>,
    pub ai_details: Option<String>,
}

pub struct DriverVerificationService {
    pool: PgPool,
}

impl DriverVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn submit(
        &self,
        user_id: i32,
        req: SubmitVerificationRequest,
    ) -> Result<VerificationStatus, String> {
        let stype = req.service_type.to_lowercase();
        if stype != "taxi" && stype != "covoiturage" {
            return Err("service_type doit être 'taxi' ou 'covoiturage'.".to_string());
        }

        // ── 1. Insertion / mise à jour en base ────────────────────────────────
        let row = sqlx::query!(
            r#"INSERT INTO driver_verifications
               (user_id, service_type, cni_front_url, cni_back_url, selfie_url, status)
               VALUES ($1,$2,$3,$4,$5,'pending')
               ON CONFLICT (user_id, service_type) DO UPDATE
                 SET cni_front_url = COALESCE(EXCLUDED.cni_front_url, driver_verifications.cni_front_url),
                     cni_back_url  = COALESCE(EXCLUDED.cni_back_url,  driver_verifications.cni_back_url),
                     selfie_url    = COALESCE(EXCLUDED.selfie_url,     driver_verifications.selfie_url),
                     status        = CASE WHEN driver_verifications.status = 'rejected'
                                          THEN 'pending' ELSE driver_verifications.status END,
                     submitted_at  = NOW()
               RETURNING id, status, submitted_at, reviewed_at, rejection_reason,
                         cni_front_url, cni_back_url, selfie_url"#,
            user_id,
            stype,
            req.cni_front_url,
            req.cni_back_url,
            req.selfie_url,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("DB: {}", e))?;

        let is_complete =
            row.cni_front_url.is_some() && row.cni_back_url.is_some() && row.selfie_url.is_some();

        // Passage en under_review si documents complets (sans IA)
        if is_complete {
            let _ = sqlx::query!(
                "UPDATE driver_verifications SET status='under_review' WHERE id=$1 AND status='pending'",
                row.id
            )
            .execute(&self.pool)
            .await;
        }

        let mut final_status = if is_complete {
            "under_review".to_string()
        } else {
            row.status.clone()
        };
        let mut ai_score: Option<i32> = None;
        let mut ai_decision: Option<String> = None;
        let mut ai_extracted_name: Option<String> = None;
        let mut ai_extracted_id: Option<String> = None;
        let mut ai_details_str: Option<String> = None;

        // ── 2. Analyse IA si base64 fournis ──────────────────────────────────
        if let (Some(front_b64), Some(back_b64), Some(selfie_b64)) = (
            req.cni_front_base64.as_deref(),
            req.cni_back_base64.as_deref(),
            req.selfie_base64.as_deref(),
        ) {
            use crate::services::document_ai_service::DocumentAiService;
            let ai_svc = DocumentAiService::new();

            if ai_svc.is_enabled() {
                log::info!("[KYC] Lancement analyse IA pour user_id={}", user_id);
                let result = ai_svc.analyze_kyc(front_b64, back_b64, selfie_b64).await;

                let score_i32 = result.score as i32;
                let details_json =
                    serde_json::to_string(&result.details).unwrap_or_else(|_| "[]".to_string());

                // Mise à jour DB avec résultat IA
                let _ = sqlx::query!(
                    r#"UPDATE driver_verifications
                       SET ai_score          = $1,
                           ai_decision       = $2,
                           ai_extracted_name = $3,
                           ai_extracted_id   = $4,
                           ai_details        = $5,
                           status            = $2
                       WHERE id = $6"#,
                    score_i32,
                    result.decision,
                    result.extracted_name,
                    result.extracted_id_number,
                    details_json,
                    row.id,
                )
                .execute(&self.pool)
                .await;

                log::info!(
                    "[KYC] Analyse IA terminée — user_id={}, score={}, décision={}",
                    user_id,
                    result.score,
                    result.decision
                );

                final_status = result.decision.clone();
                ai_score = Some(score_i32);
                ai_decision = Some(result.decision);
                ai_extracted_name = result.extracted_name;
                ai_extracted_id = result.extracted_id_number;
                ai_details_str = Some(details_json);
            }
        }

        Ok(VerificationStatus {
            id: row.id,
            user_id,
            service_type: stype,
            cni_front_url: row.cni_front_url,
            cni_back_url: row.cni_back_url,
            selfie_url: row.selfie_url,
            status: final_status,
            rejection_reason: row.rejection_reason,
            submitted_at: row.submitted_at.to_rfc3339(),
            reviewed_at: row.reviewed_at.map(|t| t.to_rfc3339()),
            is_complete,
            ai_score,
            ai_decision,
            ai_extracted_name,
            ai_extracted_id,
            ai_details: ai_details_str,
        })
    }

    pub async fn get_status(
        &self,
        user_id: i32,
        service_type: &str,
    ) -> Result<Option<VerificationStatus>, String> {
        let row = sqlx::query!(
            r#"SELECT id, service_type, cni_front_url, cni_back_url, selfie_url,
               status, rejection_reason, submitted_at, reviewed_at,
               ai_score, ai_decision, ai_extracted_name, ai_extracted_id, ai_details
               FROM driver_verifications WHERE user_id=$1 AND service_type=$2"#,
            user_id,
            service_type,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(row.map(|r| {
            let is_complete =
                r.cni_front_url.is_some() && r.cni_back_url.is_some() && r.selfie_url.is_some();
            VerificationStatus {
                id: r.id,
                user_id,
                service_type: r.service_type,
                cni_front_url: r.cni_front_url,
                cni_back_url: r.cni_back_url,
                selfie_url: r.selfie_url,
                status: r.status,
                rejection_reason: r.rejection_reason,
                submitted_at: r.submitted_at.to_rfc3339(),
                reviewed_at: r.reviewed_at.map(|t| t.to_rfc3339()),
                is_complete,
                ai_score: r.ai_score,
                ai_decision: r.ai_decision,
                ai_extracted_name: r.ai_extracted_name,
                ai_extracted_id: r.ai_extracted_id,
                ai_details: r.ai_details,
            }
        }))
    }

    /// Approbation manuelle par un admin
    pub async fn approve(&self, verif_id: i64, reviewer_id: i32) -> Result<(), String> {
        sqlx::query!(
            "UPDATE driver_verifications SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2",
            reviewer_id,
            verif_id,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn reject(
        &self,
        verif_id: i64,
        reviewer_id: i32,
        reason: &str,
    ) -> Result<(), String> {
        sqlx::query!(
            "UPDATE driver_verifications SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3",
            reviewer_id,
            reason,
            verif_id,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn is_verified(&self, user_id: i32, service_type: &str) -> bool {
        sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM driver_verifications WHERE user_id=$1 AND service_type=$2 AND status='approved')",
            user_id,
            service_type,
        )
        .fetch_one(&self.pool)
        .await
        .unwrap_or(Some(false))
        .unwrap_or(false)
    }
}
