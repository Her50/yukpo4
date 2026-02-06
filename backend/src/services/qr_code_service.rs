// ✅ Service QR code pour réservations covoiturage
// Date: 2025-01-29

use crate::core::types::{AppError, AppResult};
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct QRCodeService {
    pool: PgPool,
}

impl QRCodeService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Génère un QR code pour une réservation
    pub async fn generate_qr_code(
        &self,
        reservation_id: i32,
        trip_departure_time: chrono::DateTime<chrono::Utc>,
    ) -> AppResult<QRCodeInfo> {
        info!(
            "[QRCodeService] Génération QR code pour reservation_id={}",
            reservation_id
        );

        // Générer code unique
        let qr_code = format!(
            "COV-{}-{}-{}",
            reservation_id,
            chrono::Utc::now().timestamp(),
            Uuid::new_v4().to_string().chars().take(8).collect::<String>()
        );

        // Expiration : 2h après départ prévu
        let expires_at = trip_departure_time + chrono::Duration::hours(2);

        let qr_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO reservation_qr_codes (
                reservation_id, qr_code, status, expires_at
            )
            VALUES ($1, $2, 'pending', $3)
            RETURNING id
            "#,
        )
        .bind(reservation_id)
        .bind(&qr_code)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            error!("[QRCodeService] Erreur création QR code: {}", e);
            AppError::Internal(format!("Erreur création QR code: {}", e))
        })?;

        // Générer URL image QR code (à implémenter avec bibliothèque QR)
        // Pour l'instant, retourner le code texte
        let qr_code_url = format!(
            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}",
            qr_code
        );

        // Mettre à jour avec URL
        sqlx::query("UPDATE reservation_qr_codes SET qr_code_url = $1 WHERE id = $2")
            .bind(&qr_code_url)
            .bind(qr_id)
            .execute(&self.pool)
            .await
            .ok();

        info!("[QRCodeService] ✅ QR code généré: {}", qr_code);

        Ok(QRCodeInfo {
            id: qr_id,
            reservation_id,
            qr_code,
            qr_code_url,
            status: "pending".to_string(),
            expires_at,
        })
    }

    /// Valide un QR code (scan par conducteur)
    pub async fn validate_qr_code(
        &self,
        qr_code: &str,
        driver_user_id: i32,
    ) -> AppResult<QRCodeValidation> {
        info!("[QRCodeService] Validation QR code: {}", qr_code);

        // Récupérer QR code
        let qr_row = sqlx::query(
            r#"
            SELECT 
                id, reservation_id, qr_code, status, expires_at
            FROM reservation_qr_codes
            WHERE qr_code = $1
            "#,
        )
        .bind(qr_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[QRCodeService] Erreur récupération QR code: {}", e);
            AppError::Internal(format!("Erreur récupération QR code: {}", e))
        })?;

        let qr_info = qr_row.map(|row| QRCodeRow {
            id: row.get::<i32, _>("id"),
            reservation_id: row.get::<i32, _>("reservation_id"),
            qr_code: row.get::<String, _>("qr_code"),
            status: row.get::<String, _>("status"),
            expires_at: row.get::<chrono::DateTime<chrono::Utc>, _>("expires_at"),
        });

        let qr = match qr_info {
            Some(q) => q,
            None => {
                return Err(AppError::NotFound("QR code non trouvé".to_string()));
            }
        };

        // Vérifier expiration
        if qr.expires_at < chrono::Utc::now() {
            sqlx::query("UPDATE reservation_qr_codes SET status = 'expired' WHERE id = $1")
                .bind(qr.id)
                .execute(&self.pool)
                .await
                .ok();

            return Err(AppError::BadRequest("QR code expiré".to_string()));
        }

        // Vérifier que le conducteur est bien le propriétaire du trajet
        let is_valid_driver: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM specialized_reservations r
                INNER JOIN services s ON s.id = r.service_id
                INNER JOIN covoiturages c ON c.service_id = s.id
                WHERE r.id = $1 AND c.user_id = $2
            )
            "#,
        )
        .bind(qr.reservation_id)
        .bind(driver_user_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(false);

        if !is_valid_driver {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le conducteur de ce trajet".to_string(),
            ));
        }

        // Vérifier statut
        if qr.status != "pending" {
            return Err(AppError::BadRequest(format!(
                "QR code déjà validé ou annulé (status: {})",
                qr.status
            )));
        }

        // Valider
        sqlx::query(
            r#"
            UPDATE reservation_qr_codes
            SET status = 'validated', validated_at = NOW(), validated_by = $1
            WHERE id = $2
            "#,
        )
        .bind(driver_user_id)
        .bind(qr.id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[QRCodeService] Erreur validation: {}", e);
            AppError::Internal(format!("Erreur validation QR code: {}", e))
        })?;

        info!(
            "[QRCodeService] ✅ QR code validé par driver_id={}",
            driver_user_id
        );

        Ok(QRCodeValidation {
            reservation_id: qr.reservation_id,
            validated: true,
            message: "QR code validé avec succès".to_string(),
        })
    }

    /// Récupère le QR code d'une réservation
    pub async fn get_reservation_qr_code(
        &self,
        reservation_id: i32,
    ) -> AppResult<Option<QRCodeInfo>> {
        let qr_row = sqlx::query(
            r#"
            SELECT 
                id, reservation_id, qr_code, qr_code_url, status, expires_at
            FROM reservation_qr_codes
            WHERE reservation_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(reservation_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("[QRCodeService] Erreur récupération: {}", e);
            AppError::Internal(format!("Erreur récupération QR code: {}", e))
        })?;

        let qr = qr_row.map(|row| QRCodeInfo {
            id: row.get::<i32, _>("id"),
            reservation_id: row.get::<i32, _>("reservation_id"),
            qr_code: row.get::<String, _>("qr_code"),
            qr_code_url: row
                .get::<Option<String>, _>("qr_code_url")
                .unwrap_or_else(|| "".to_string()),
            status: row.get::<String, _>("status"),
            expires_at: row.get::<chrono::DateTime<chrono::Utc>, _>("expires_at"),
        });

        Ok(qr)
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QRCodeInfo {
    pub id: i32,
    pub reservation_id: i32,
    #[allow(dead_code)]
    pub qr_code: String,
    pub qr_code_url: String,
    pub status: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct QRCodeValidation {
    pub reservation_id: i32,
    pub validated: bool,
    pub message: String,
}

#[derive(Debug, sqlx::FromRow)]
struct QRCodeRow {
    id: i32,
    reservation_id: i32,
    #[allow(dead_code)]
    qr_code: String,
    status: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}

use log::{error, info};
