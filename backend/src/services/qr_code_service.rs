// ✅ Service QR code pour réservations covoiturage + livraison livres
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
        let qr_code_url = format!("/api/qr/render?data={}", urlencoding::encode(&qr_code));

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

    // ========================================================================
    // QR CODES POUR LIVRAISON DE LIVRES (Bourse du Livre)
    // ========================================================================

    /// Génère un QR code pour un paquet de livres (pickup par le coursier)
    /// Le QR embarque un payload JSON avec les références de paquets et livres,
    /// permettant au libraire de retrouver rapidement les paquets physiques à remettre.
    pub async fn generate_book_package_qr(
        &self,
        package_id: i32,
        qr_type: &str, // "pickup" ou "delivery"
    ) -> AppResult<BookPackageQRInfo> {
        info!(
            "[QRCodeService] Génération QR code {} pour paquet livre: {}",
            qr_type, package_id
        );

        // Récupérer le paquet avec ses livres pour embarquer dans le QR
        let pkg_row = sqlx::query(
            "SELECT reference, livres, nombre_livres, expediteur_id, destinataire_id FROM book_delivery_packages WHERE id = $1",
        )
        .bind(package_id)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let (pkg_ref, livres_summary) = if let Some(row) = &pkg_row {
            use sqlx::Row;
            let reference: String = row.try_get("reference").unwrap_or_default();
            let livres_json: serde_json::Value =
                row.try_get("livres").unwrap_or(serde_json::json!([]));

            // Extraire un résumé compact des livres (titre + matière seulement)
            let livres_list: Vec<serde_json::Value> = livres_json
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|l| {
                    serde_json::json!({
                        "t": l.get("titre").and_then(|v| v.as_str()).unwrap_or("?"),
                        "m": l.get("matiere").and_then(|v| v.as_str()).unwrap_or(""),
                    })
                })
                .collect();

            (reference, livres_list)
        } else {
            (format!("PKG-{}", package_id), vec![])
        };

        // Le QR code contient un JSON compact lisible par l'app du libraire
        let qr_payload = serde_json::json!({
            "t": qr_type,           // type: pickup/delivery
            "p": package_id,        // package_id
            "r": pkg_ref,           // référence paquet (ex: "BL-A1B2")
            "n": livres_summary.len(), // nombre de livres
            "l": livres_summary,    // livres [{t: titre, m: matière}]
            "ts": chrono::Utc::now().timestamp(),
        });

        let qr_code = format!(
            "BK-{}-{}-{}-{}",
            qr_type.to_uppercase(),
            package_id,
            chrono::Utc::now().timestamp(),
            Uuid::new_v4().to_string().chars().take(8).collect::<String>()
        );

        let expires_at = chrono::Utc::now() + chrono::Duration::hours(48);

        // URL du QR code image — encode le JSON payload (pas juste l'identifiant)
        let qr_payload_str = qr_payload.to_string();
        let qr_data_encoded = urlencoding::encode(&qr_payload_str);
        let qr_code_url = format!(
            "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data={}",
            qr_data_encoded
        );

        sqlx::query(
            r#"
            INSERT INTO book_package_qr_codes (
                package_id, qr_code, qr_code_url, qr_type, status, expires_at
            )
            VALUES ($1, $2, $3, $4, 'pending', $5)
            ON CONFLICT (package_id, qr_type) WHERE status = 'pending'
            DO UPDATE SET qr_code = $2, qr_code_url = $3, expires_at = $5
            "#,
        )
        .bind(package_id)
        .bind(&qr_code)
        .bind(&qr_code_url)
        .bind(qr_type)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("[QRCodeService] Erreur création QR paquet livre: {}", e);
            AppError::Internal(format!("Erreur création QR paquet livre: {}", e))
        })?;

        info!(
            "[QRCodeService] ✅ QR paquet livre généré: {} (ref={}, {} livres)",
            qr_code,
            pkg_ref,
            livres_summary.len()
        );

        Ok(BookPackageQRInfo {
            package_id,
            qr_code,
            qr_code_url,
            qr_type: qr_type.to_string(),
            status: "pending".to_string(),
            expires_at,
        })
    }

    /// Valide un QR code de paquet de livres (scan par le coursier ou le destinataire)
    pub async fn validate_book_package_qr(
        &self,
        qr_code: &str,
        scanner_user_id: i32,
    ) -> AppResult<BookPackageQRValidation> {
        info!(
            "[QRCodeService] Validation QR paquet livre: {} par user {}",
            qr_code, scanner_user_id
        );

        let row = sqlx::query(
            r#"
            SELECT bq.package_id, bq.qr_type, bq.status, bq.expires_at,
                   bp.coursier_id, bp.expediteur_id, bp.destinataire_id
            FROM book_package_qr_codes bq
            JOIN book_delivery_packages bp ON bp.id = bq.package_id
            WHERE bq.qr_code = $1
            "#,
        )
        .bind(qr_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur lecture QR paquet: {}", e)))?
        .ok_or_else(|| AppError::NotFound("QR code non trouvé".to_string()))?;

        let package_id: i32 = row.get("package_id");
        let qr_type: String = row.get("qr_type");
        let status: String = row.get("status");
        let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
        let coursier_id: Option<i32> = row.get("coursier_id");
        let expediteur_id: i32 = row.get("expediteur_id");
        let destinataire_id: i32 = row.get("destinataire_id");

        if expires_at < chrono::Utc::now() {
            return Err(AppError::BadRequest("QR code expiré".to_string()));
        }

        if status != "pending" {
            return Err(AppError::BadRequest(format!(
                "QR code déjà utilisé (statut: {})",
                status
            )));
        }

        // Vérifier les permissions selon le type de QR
        // Autorisé: coursier, expéditeur, destinataire, OU membre d'équipe de l'expéditeur
        let is_team_member_of_expediteur: bool = sqlx::query_scalar(
            r#"SELECT EXISTS(
                SELECT 1 FROM libraire_team_members
                WHERE user_id = $1 AND is_active = true
                AND librairie_id IN (
                    SELECT librairie_id FROM libraire_team_members
                    WHERE user_id = $2 AND role = 'owner' AND is_active = true
                )
            )"#,
        )
        .bind(scanner_user_id)
        .bind(expediteur_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(false);

        let authorized = match qr_type.as_str() {
            "pickup" => {
                // Le coursier OU l'expéditeur OU un membre d'équipe de l'expéditeur
                coursier_id == Some(scanner_user_id)
                    || expediteur_id == scanner_user_id
                    || is_team_member_of_expediteur
            }
            "delivery" => {
                // Le destinataire OU le coursier
                destinataire_id == scanner_user_id || coursier_id == Some(scanner_user_id)
            }
            _ => false,
        };

        if !authorized {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas autorisé à scanner ce QR code".to_string(),
            ));
        }

        // Valider le QR code
        sqlx::query(
            r#"
            UPDATE book_package_qr_codes
            SET status = 'validated', validated_at = NOW(), validated_by = $1
            WHERE qr_code = $2
            "#,
        )
        .bind(scanner_user_id)
        .bind(qr_code)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur validation QR: {}", e)))?;

        // Mettre à jour le statut du paquet selon le type
        let new_package_status = match qr_type.as_str() {
            "pickup" => "en_route",
            "delivery" => "livre",
            _ => "en_route",
        };

        sqlx::query(
            "UPDATE book_delivery_packages SET statut = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(new_package_status)
        .bind(package_id)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur MAJ paquet: {}", e)))?;

        info!(
            "[QRCodeService] ✅ QR paquet livre validé: {} → paquet {} en statut '{}'",
            qr_code, package_id, new_package_status
        );

        // Récupérer les infos enrichies du paquet pour la réponse de validation
        // (le libraire/destinataire voit immédiatement quels paquets et livres sont concernés)
        let pkg_detail = sqlx::query(
            "SELECT reference, livres, nombre_livres FROM book_delivery_packages WHERE id = $1",
        )
        .bind(package_id)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let (reference, livres_list, nombre_livres) = if let Some(row) = &pkg_detail {
            use sqlx::Row;
            let reference: String = row.try_get("reference").unwrap_or_default();
            let livres_json: serde_json::Value =
                row.try_get("livres").unwrap_or(serde_json::json!([]));
            let nombre: i32 = row.try_get("nombre_livres").unwrap_or(0);

            let livres: Vec<serde_json::Value> = livres_json
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|l| {
                    serde_json::json!({
                        "titre": l.get("titre").and_then(|v| v.as_str()).unwrap_or("?"),
                        "matiere": l.get("matiere").and_then(|v| v.as_str()),
                        "valeur": l.get("valeur").and_then(|v| v.as_f64()),
                    })
                })
                .collect();

            (reference, livres, nombre)
        } else {
            (String::new(), vec![], 0)
        };

        Ok(BookPackageQRValidation {
            package_id,
            qr_type,
            validated: true,
            new_package_status: new_package_status.to_string(),
            package_reference: reference,
            nombre_livres,
            livres: livres_list,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct BookPackageQRInfo {
    pub package_id: i32,
    pub qr_code: String,
    pub qr_code_url: String,
    pub qr_type: String,
    pub status: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct BookPackageQRValidation {
    pub package_id: i32,
    pub qr_type: String,
    pub validated: bool,
    pub new_package_status: String,
    pub package_reference: String,
    pub nombre_livres: i32,
    pub livres: Vec<serde_json::Value>,
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
