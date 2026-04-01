// ✅ Service KYC vérification conducteur — CNI + selfie
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmitVerificationRequest {
    pub service_type: String,
    pub cni_front_url: Option<String>,
    pub cni_back_url: Option<String>,
    pub selfie_url: Option<String>,
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
            user_id, stype,
            req.cni_front_url, req.cni_back_url, req.selfie_url,
        ).fetch_one(&self.pool).await.map_err(|e| format!("DB: {}", e))?;

        // Auto-approve si les 3 documents sont fournis (prod: reviewer humain)
        let is_complete =
            row.cni_front_url.is_some() && row.cni_back_url.is_some() && row.selfie_url.is_some();
        if is_complete {
            let _ = sqlx::query!(
                "UPDATE driver_verifications SET status='under_review' WHERE id=$1 AND status='pending'",
                row.id
            ).execute(&self.pool).await;
        }

        Ok(VerificationStatus {
            id: row.id,
            user_id,
            service_type: stype,
            cni_front_url: row.cni_front_url,
            cni_back_url: row.cni_back_url,
            selfie_url: row.selfie_url,
            status: if is_complete {
                "under_review".to_string()
            } else {
                row.status
            },
            rejection_reason: row.rejection_reason,
            submitted_at: row.submitted_at.to_rfc3339(),
            reviewed_at: row.reviewed_at.map(|t| t.to_rfc3339()),
            is_complete,
        })
    }

    pub async fn get_status(
        &self,
        user_id: i32,
        service_type: &str,
    ) -> Result<Option<VerificationStatus>, String> {
        let row = sqlx::query!(
            r#"SELECT id, service_type, cni_front_url, cni_back_url, selfie_url,
               status, rejection_reason, submitted_at, reviewed_at
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
            }
        }))
    }

    /// Approbation admin
    pub async fn approve(&self, verif_id: i64, reviewer_id: i32) -> Result<(), String> {
        sqlx::query!(
            "UPDATE driver_verifications SET status='approved', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2",
            reviewer_id, verif_id,
        ).execute(&self.pool).await.map_err(|e| e.to_string())?;
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
            reviewer_id, reason, verif_id,
        ).execute(&self.pool).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn is_verified(&self, user_id: i32, service_type: &str) -> bool {
        sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM driver_verifications WHERE user_id=$1 AND service_type=$2 AND status='approved')",
            user_id, service_type,
        ).fetch_one(&self.pool).await.unwrap_or(Some(false)).unwrap_or(false)
    }
}
