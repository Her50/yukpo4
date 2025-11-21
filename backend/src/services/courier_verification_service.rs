use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Duration, Utc};
use log::info;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Service pour vérifier l'identité du coursier lors du pickup
pub struct CourierVerificationService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourierVerificationCode {
    pub id: Uuid,
    pub delivery_id: Uuid,
    pub order_id: Option<Uuid>,
    pub courier_id: i32,
    pub verification_code: String,
    pub qr_code_data: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub verified_at: Option<DateTime<Utc>>,
    pub verified_by: Option<i32>,
    pub verification_method: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyCourierRequest {
    pub verification_code: String,
    pub verification_method: Option<String>, // 'qr_scan', 'pin_code', 'manual'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourierVerificationResult {
    pub is_valid: bool,
    pub courier_id: Option<i32>,
    pub courier_name: Option<String>,
    pub delivery_id: Option<Uuid>,
    pub message: String,
}

impl CourierVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Génère un code de vérification pour un coursier assigné à une livraison
    pub async fn generate_verification_code(
        &self,
        delivery_id: Uuid,
        courier_id: i32,
        order_id: Option<Uuid>,
        expires_in_hours: i32,
    ) -> AppResult<CourierVerificationCode> {
        info!(
            "[CourierVerification] Génération code vérification: delivery_id={}, courier_id={}",
            delivery_id, courier_id
        );

        // Générer un code à 6 chiffres
        let verification_code = Self::generate_pin_code();

        // Créer les données du QR code (JSON avec code + infos livraison)
        let qr_code_data = json!({
            "code": verification_code,
            "delivery_id": delivery_id,
            "courier_id": courier_id,
            "type": "courier_verification"
        })
        .to_string();

        let now = Utc::now();
        let expires_at = now + Duration::hours(expires_in_hours as i64);

        // Vérifier si un code existe déjà pour cette livraison
        let existing_id: Option<Uuid> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM courier_verification_codes
            WHERE delivery_id = $1 AND verified_at IS NULL AND expires_at > NOW()
            "#,
        )
        .bind(delivery_id)
        .fetch_optional(&self.pool)
        .await?;

        let verification_id = if let Some(existing_id) = existing_id {
            // Mettre à jour le code existant
            sqlx::query(
                r#"
                UPDATE courier_verification_codes
                SET 
                    courier_id = $1,
                    verification_code = $2,
                    qr_code_data = $3,
                    expires_at = $4,
                    order_id = $5
                WHERE id = $6
                RETURNING id
                "#,
            )
            .bind(courier_id)
            .bind(&verification_code)
            .bind(&qr_code_data)
            .bind(expires_at)
            .bind(order_id)
            .bind(existing_id)
            .map(|row: sqlx::postgres::PgRow| row.get::<Uuid, _>("id"))
            .fetch_one(&self.pool)
            .await?
        } else {
            // Créer un nouveau code
            sqlx::query_scalar(
                r#"
                INSERT INTO courier_verification_codes (
                    delivery_id,
                    order_id,
                    courier_id,
                    verification_code,
                    qr_code_data,
                    expires_at
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
                "#,
            )
            .bind(delivery_id)
            .bind(order_id)
            .bind(courier_id)
            .bind(&verification_code)
            .bind(&qr_code_data)
            .bind(expires_at)
            .fetch_one(&self.pool)
            .await?
        };

        info!(
            "[CourierVerification] Code généré: code={}, expires_at={:?}",
            verification_code, expires_at
        );

        // Récupérer le code créé
        self.get_verification_code(verification_id).await
    }

    /// Vérifie l'identité du coursier avec un code
    pub async fn verify_courier(
        &self,
        delivery_id: Uuid,
        provider_user_id: i32,
        request: VerifyCourierRequest,
    ) -> AppResult<CourierVerificationResult> {
        info!(
            "[CourierVerification] Vérification: delivery_id={}, code={}",
            delivery_id, request.verification_code
        );

        // Récupérer le code de vérification
        #[allow(dead_code)]
        struct VerificationRow {
            id: Uuid,
            delivery_id: Uuid,
            order_id: Option<Uuid>,
            courier_id: Option<i32>,
            verification_code: String,
            expires_at: Option<DateTime<Utc>>,
            verified_at: Option<DateTime<Utc>>,
            user_id: Option<i32>,
            nom_complet: Option<String>,
            nom: Option<String>,
            prenom: Option<String>,
        }
        
        let verification: Option<VerificationRow> = sqlx::query(
            r#"
            SELECT 
                vc.id,
                vc.delivery_id,
                vc.order_id,
                vc.courier_id,
                vc.verification_code,
                vc.expires_at,
                vc.verified_at,
                c.user_id,
                u.nom_complet,
                u.nom,
                u.prenom
            FROM courier_verification_codes vc
            INNER JOIN couriers c ON c.id = vc.courier_id
            INNER JOIN users u ON u.id = c.user_id
            WHERE vc.delivery_id = $1
            AND vc.verification_code = $2
            "#,
        )
        .bind(delivery_id)
        .bind(&request.verification_code)
        .map(|row: sqlx::postgres::PgRow| VerificationRow {
            id: row.get::<Uuid, _>("id"),
            delivery_id: row.get::<Uuid, _>("delivery_id"),
            order_id: row.try_get("order_id").ok(),
            courier_id: row.try_get("courier_id").ok(),
            verification_code: row.get::<String, _>("verification_code"),
            expires_at: row.try_get("expires_at").ok(),
            verified_at: row.try_get("verified_at").ok(),
            user_id: row.try_get("user_id").ok(),
            nom_complet: row.try_get("nom_complet").ok(),
            nom: row.try_get("nom").ok(),
            prenom: row.try_get("prenom").ok(),
        })
        .fetch_optional(&self.pool)
        .await?;

        let verification = match verification {
            Some(v) => v,
            None => {
                return Ok(CourierVerificationResult {
                    is_valid: false,
                    courier_id: None,
                    courier_name: None,
                    delivery_id: None,
                    message: "Code de vérification invalide".to_string(),
                });
            }
        };

        // Vérifier si le code est expiré
        if let Some(expires_at) = verification.expires_at {
            if Utc::now() > expires_at {
                return Ok(CourierVerificationResult {
                    is_valid: false,
                    courier_id: verification.courier_id,
                    courier_name: verification.nom_complet.or_else(|| {
                        match (verification.nom, verification.prenom) {
                            (Some(n), Some(p)) => Some(format!("{} {}", p, n)),
                            (Some(n), None) => Some(n),
                            (None, Some(p)) => Some(p),
                            (None, None) => None,
                        }
                    }),
                    delivery_id: Some(verification.delivery_id),
                    message: "Code de vérification expiré".to_string(),
                });
            }
        }

        // Vérifier si déjà vérifié
        if verification.verified_at.is_some() {
            return Ok(CourierVerificationResult {
                is_valid: false,
                courier_id: verification.courier_id,
                courier_name: verification.nom_complet.or_else(|| {
                    match (verification.nom, verification.prenom) {
                        (Some(n), Some(p)) => Some(format!("{} {}", p, n)),
                        (Some(n), None) => Some(n),
                        (None, Some(p)) => Some(p),
                        (None, None) => None,
                    }
                }),
                delivery_id: Some(verification.delivery_id),
                message: "Code déjà utilisé".to_string(),
            });
        }

        // Vérifier que le prestataire est bien le propriétaire de la livraison/commande
        let is_authorized = if let Some(order_id) = verification.order_id {
            // Vérifier via product_orders
            let order_provider_id: Option<i32> = sqlx::query_scalar::<_, i32>(
                r#"
                SELECT provider_user_id
                FROM product_orders
                WHERE id = $1
                "#,
            )
            .bind(order_id)
            .fetch_optional(&self.pool)
            .await?;

            order_provider_id
                .map(|id| id == provider_user_id)
                .unwrap_or(false)
        } else {
            // Vérifier via deliveries (si pas de product_order)
            let delivery_creator_id: Option<i32> = sqlx::query_scalar::<_, i32>(
                r#"
                SELECT creator_id
                FROM deliveries
                WHERE id = $1
                "#,
            )
            .bind(delivery_id)
            .fetch_optional(&self.pool)
            .await?;

            delivery_creator_id
                .map(|id| id == provider_user_id)
                .unwrap_or(false)
        };

        if !is_authorized {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas autorisé à vérifier cette livraison".to_string(),
            ));
        }

        // Marquer comme vérifié
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE courier_verification_codes
            SET 
                verified_at = $1,
                verified_by = $2,
                verification_method = $3
            WHERE id = $4
            "#,
        )
        .bind(now)
        .bind(provider_user_id)
        .bind(request.verification_method.as_deref().unwrap_or("pin_code"))
        .bind(verification.id)
        .execute(&self.pool)
        .await?;

        let courier_name = verification.nom_complet.or_else(|| {
            match (verification.nom, verification.prenom) {
                (Some(n), Some(p)) => Some(format!("{} {}", p, n)),
                (Some(n), None) => Some(n),
                (None, Some(p)) => Some(p),
                (None, None) => None,
            }
        });

        info!(
            "[CourierVerification] ✅ Coursier vérifié: courier_id={:?}, name={:?}",
            verification.courier_id, courier_name
        );

        Ok(CourierVerificationResult {
            is_valid: true,
            courier_id: verification.courier_id,
            courier_name,
            delivery_id: Some(verification.delivery_id),
            message: "Coursier vérifié avec succès".to_string(),
        })
    }

    /// Récupère le code de vérification pour une livraison
    pub async fn get_verification_code_for_delivery(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<Option<CourierVerificationCode>> {
        let row = sqlx::query(
            r#"
            SELECT 
                id,
                delivery_id,
                order_id,
                courier_id,
                verification_code,
                qr_code_data,
                expires_at,
                verified_at,
                verified_by,
                verification_method,
                created_at
            FROM courier_verification_codes
            WHERE delivery_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(delivery_id)
        .map(|row: sqlx::postgres::PgRow| CourierVerificationCode {
            id: row.get::<Uuid, _>("id"),
            delivery_id: row.get::<Uuid, _>("delivery_id"),
            order_id: row.try_get("order_id").ok(),
            courier_id: row.get::<i32, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            qr_code_data: row.try_get("qr_code_data").ok(),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
            verified_at: row.try_get("verified_at").ok(),
            verified_by: row.try_get("verified_by").ok(),
            verification_method: row.try_get("verification_method").ok(),
            created_at: row.get::<DateTime<Utc>, _>("created_at"),
        })
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    /// Récupère un code de vérification par ID
    async fn get_verification_code(&self, id: Uuid) -> AppResult<CourierVerificationCode> {
        let row = sqlx::query(
            r#"
            SELECT 
                id,
                delivery_id,
                order_id,
                courier_id,
                verification_code,
                qr_code_data,
                expires_at,
                verified_at,
                verified_by,
                verification_method,
                created_at
            FROM courier_verification_codes
            WHERE id = $1
            "#,
        )
        .bind(id)
        .map(|row: sqlx::postgres::PgRow| CourierVerificationCode {
            id: row.get::<Uuid, _>("id"),
            delivery_id: row.get::<Uuid, _>("delivery_id"),
            order_id: row.try_get("order_id").ok(),
            courier_id: row.get::<i32, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            qr_code_data: row.try_get("qr_code_data").ok(),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
            verified_at: row.try_get("verified_at").ok(),
            verified_by: row.try_get("verified_by").ok(),
            verification_method: row.try_get("verification_method").ok(),
            created_at: row.get::<DateTime<Utc>, _>("created_at"),
        })
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    /// Génère un code PIN à 6 chiffres
    fn generate_pin_code() -> String {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(100000..=999999))
    }

    /// Vérifie si un coursier est autorisé pour une livraison
    pub async fn is_courier_authorized(
        &self,
        delivery_id: Uuid,
        courier_id: i32,
    ) -> AppResult<bool> {
        let verification: Option<i32> = sqlx::query_scalar::<_, i32>(
            r#"
            SELECT courier_id
            FROM courier_verification_codes
            WHERE delivery_id = $1
            AND courier_id = $2
            AND verified_at IS NOT NULL
            ORDER BY verified_at DESC
            LIMIT 1
            "#,
        )
        .bind(delivery_id)
        .bind(courier_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(verification.is_some())
    }
}

