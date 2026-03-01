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
    pub courier_id: Uuid,
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
    pub courier_id: Option<Uuid>,
    pub courier_name: Option<String>,
    pub courier_avatar_url: Option<String>,
    pub courier_vehicle_type: Option<String>,
    pub delivery_id: Option<Uuid>,
    pub order_id: Option<Uuid>,
    pub message: String,
    pub products_to_pickup: Vec<ProductToPickup>,
    pub pickup_address: Option<String>,
    pub dropoff_address: Option<String>,
    pub client_name: Option<String>,
    pub delivery_price: Option<f64>,
    pub insurance_cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductToPickup {
    pub product_index: i32,
    pub product_name: String,
    pub product_price: Option<f64>,
    pub quantity: i32,
    pub image_url: Option<String>,
    pub notes: Option<String>,
}

impl CourierVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Génère un code de vérification pour un coursier assigné à une livraison
    pub async fn generate_verification_code(
        &self,
        delivery_id: Uuid,
        courier_id: Uuid,
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
            courier_id: Option<Uuid>,
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
            order_id: row.get::<Option<_>, _>("order_id"),
            courier_id: row.get::<Option<Uuid>, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            expires_at: row.get::<Option<_>, _>("expires_at"),
            verified_at: row.get::<Option<_>, _>("verified_at"),
            user_id: row.get::<Option<_>, _>("user_id"),
            nom_complet: row.get::<Option<_>, _>("nom_complet"),
            nom: row.get::<Option<_>, _>("nom"),
            prenom: row.get::<Option<_>, _>("prenom"),
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
                    courier_avatar_url: None,
                    courier_vehicle_type: None,
                    delivery_id: None,
                    order_id: None,
                    message: "Code de vérification non trouvé".to_string(),
                    products_to_pickup: vec![],
                    pickup_address: None,
                    dropoff_address: None,
                    client_name: None,
                    delivery_price: None,
                    insurance_cost: None,
                });
            }
        };

        // Helper pour construire le nom du coursier
        let build_courier_name = |nom_complet: Option<String>,
                                  nom: Option<String>,
                                  prenom: Option<String>|
         -> Option<String> {
            nom_complet.or_else(|| match (nom, prenom) {
                (Some(n), Some(p)) => Some(format!("{} {}", p, n)),
                (Some(n), None) => Some(n),
                (None, Some(p)) => Some(p),
                (None, None) => None,
            })
        };

        // Vérifier si le code est expiré
        if let Some(expires_at) = verification.expires_at {
            if Utc::now() > expires_at {
                return Ok(CourierVerificationResult {
                    is_valid: false,
                    courier_id: verification.courier_id,
                    courier_name: build_courier_name(
                        verification.nom_complet,
                        verification.nom,
                        verification.prenom,
                    ),
                    courier_avatar_url: None,
                    courier_vehicle_type: None,
                    delivery_id: Some(verification.delivery_id),
                    order_id: verification.order_id,
                    message: "Code déjà utilisé".to_string(),
                    products_to_pickup: vec![],
                    pickup_address: None,
                    dropoff_address: None,
                    client_name: None,
                    delivery_price: None,
                    insurance_cost: None,
                });
            }
        }

        // Vérifier si déjà vérifié
        if verification.verified_at.is_some() {
            return Ok(CourierVerificationResult {
                is_valid: false,
                courier_id: verification.courier_id,
                courier_name: build_courier_name(
                    verification.nom_complet,
                    verification.nom,
                    verification.prenom,
                ),
                courier_avatar_url: None,
                courier_vehicle_type: None,
                delivery_id: Some(verification.delivery_id),
                order_id: verification.order_id,
                message: "Code de vérification expiré".to_string(),
                products_to_pickup: vec![],
                pickup_address: None,
                dropoff_address: None,
                client_name: None,
                delivery_price: None,
                insurance_cost: None,
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

            order_provider_id.map(|id| id == provider_user_id).unwrap_or(false)
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

            delivery_creator_id.map(|id| id == provider_user_id).unwrap_or(false)
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

        let courier_name = build_courier_name(
            verification.nom_complet,
            verification.nom,
            verification.prenom,
        );

        // Récupérer les infos du coursier (avatar, véhicule)
        let courier_details: Option<(Option<String>, Option<String>)> =
            if let Some(ref cid) = verification.courier_id {
                sqlx::query(
                    r#"
                SELECT u.avatar_url, ca.engine_type
                FROM couriers c
                INNER JOIN users u ON u.id = c.user_id
                LEFT JOIN courier_assets ca ON ca.courier_id = c.id
                WHERE c.id = $1
                LIMIT 1
                "#,
                )
                .bind(cid)
                .map(|row: sqlx::postgres::PgRow| {
                    (
                        row.get::<Option<String>, _>("avatar_url"),
                        row.get::<Option<String>, _>("engine_type"),
                    )
                })
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten()
            } else {
                None
            };

        let (courier_avatar_url, courier_vehicle_type) = courier_details.unwrap_or((None, None));

        // Récupérer les produits à récupérer et les détails de la livraison
        let products_to_pickup =
            self.get_products_for_delivery(delivery_id).await.unwrap_or_default();

        // Récupérer les adresses, le nom du client et le prix de livraison
        let delivery_details: Option<(
            Option<String>,
            Option<String>,
            Option<String>,
            Option<f64>,
        )> = sqlx::query(
            r#"
            SELECT 
                d.metadata->>'pickup_address' as pickup_address,
                d.metadata->>'dropoff_address' as dropoff_address,
                u.nom_complet as client_name,
                (d.metadata->>'delivery_price')::float as delivery_price
            FROM deliveries d
            LEFT JOIN users u ON u.id = d.creator_id
            WHERE d.id = $1
            "#,
        )
        .bind(delivery_id)
        .map(|row: sqlx::postgres::PgRow| {
            (
                row.get::<Option<String>, _>("pickup_address"),
                row.get::<Option<String>, _>("dropoff_address"),
                row.get::<Option<String>, _>("client_name"),
                row.get::<Option<f64>, _>("delivery_price"),
            )
        })
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let (pickup_address, dropoff_address, client_name, delivery_price) =
            delivery_details.unwrap_or((None, None, None, None));

        // Calculer les frais d'assurance
        let insurance_cost = if delivery_price.is_some() {
            // Récupérer le type d'engin depuis les métadonnées de la livraison
            let engine_type_str: Option<String> =
                sqlx::query_scalar("SELECT metadata->>'engine_type' FROM deliveries WHERE id = $1")
                    .bind(delivery_id)
                    .fetch_optional(&self.pool)
                    .await
                    .ok()
                    .flatten();

            let engine_type = match engine_type_str.as_deref() {
                Some("bike") | Some("velo") => {
                    crate::models::delivery_model::DeliveryEngineType::VeloCargo
                }
                Some("motorcycle") | Some("moto") => {
                    crate::models::delivery_model::DeliveryEngineType::Moto
                }
                Some("scooter") => crate::models::delivery_model::DeliveryEngineType::Scooter,
                Some("tricycle") => crate::models::delivery_model::DeliveryEngineType::Tricycle,
                Some("car") | Some("voiture") => {
                    crate::models::delivery_model::DeliveryEngineType::Voiture
                }
                Some("pickup") | Some("camionnette") => {
                    crate::models::delivery_model::DeliveryEngineType::Camionnette
                }
                Some("truck") | Some("camion") => {
                    crate::models::delivery_model::DeliveryEngineType::CamionLeger
                }
                Some("walking") | Some("pieton") => {
                    crate::models::delivery_model::DeliveryEngineType::Pieton
                }
                _ => crate::models::delivery_model::DeliveryEngineType::Moto, // Par défaut
            };

            let insurance_service =
                crate::services::delivery_insurance_service::DeliveryInsuranceService::new(
                    self.pool.clone(),
                );

            let product_value = delivery_price.unwrap_or(0.0);
            insurance_service.calculate_insurance_fee(engine_type, product_value).await.ok()
        } else {
            None
        };

        info!(
            "[CourierVerification] ✅ Coursier vérifié: courier_id={:?}, name={:?}, products={}",
            verification.courier_id,
            courier_name,
            products_to_pickup.len()
        );

        Ok(CourierVerificationResult {
            is_valid: true,
            courier_id: verification.courier_id,
            courier_name,
            courier_avatar_url,
            courier_vehicle_type,
            delivery_id: Some(verification.delivery_id),
            order_id: verification.order_id,
            message: "Coursier vérifié avec succès".to_string(),
            products_to_pickup,
            pickup_address,
            dropoff_address,
            client_name,
            delivery_price,
            insurance_cost,
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
            order_id: row.get::<Option<_>, _>("order_id"),
            courier_id: row.get::<Uuid, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            qr_code_data: row.get::<Option<_>, _>("qr_code_data"),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
            verified_at: row.get::<Option<_>, _>("verified_at"),
            verified_by: row.get::<Option<_>, _>("verified_by"),
            verification_method: row.get::<Option<_>, _>("verification_method"),
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
            order_id: row.get::<Option<_>, _>("order_id"),
            courier_id: row.get::<Uuid, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            qr_code_data: row.get::<Option<_>, _>("qr_code_data"),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
            verified_at: row.get::<Option<_>, _>("verified_at"),
            verified_by: row.get::<Option<_>, _>("verified_by"),
            verification_method: row.get::<Option<_>, _>("verification_method"),
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
        courier_id: Uuid,
    ) -> AppResult<bool> {
        let verification: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
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

    /// Récupère les produits à récupérer pour une livraison
    pub async fn get_products_for_delivery(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<Vec<ProductToPickup>> {
        let rows: Vec<sqlx::postgres::PgRow> = sqlx::query(
            r#"
            SELECT 
                po.product_index,
                COALESCE(sp.name, po.metadata->>'product_name') as product_name,
                sp.price as service_product_price,
                po.product_price as order_product_price,
                po.metadata->>'price' as metadata_price,
                po.metadata,
                sp.data as product_data
            FROM product_orders po
            LEFT JOIN service_products sp ON sp.service_id = po.service_id AND sp.product_index = po.product_index
            WHERE po.delivery_id = $1
            ORDER BY po.product_index
            "#
        )
        .bind(delivery_id)
        .fetch_all(&self.pool)
        .await?;

        let mut products = Vec::new();

        for row in rows {
            let product_index: i32 = row.get("product_index");
            let product_name: String = row
                .get::<Option<String>, _>("product_name")
                .unwrap_or_else(|| format!("Produit #{}", product_index));
            // Récupérer le prix depuis plusieurs sources (par ordre de priorité)
            let product_price = row
                .get::<Option<rust_decimal::Decimal>, _>("order_product_price") // Prix au moment de la commande
                .or_else(|| row.get::<Option<rust_decimal::Decimal>, _>("service_product_price")) // Prix du catalogue
                .or_else(|| {
                    // Prix depuis metadata (string -> decimal)
                    row.get::<Option<String>, _>("metadata_price")
                        .and_then(|s| s.parse::<rust_decimal::Decimal>().ok())
                });

            let metadata: Option<serde_json::Value> = row.get("metadata");
            let product_data: Option<serde_json::Value> = row.get("product_data");

            // Extraire la quantité depuis les métadonnées de la commande
            let quantity = metadata
                .as_ref()
                .and_then(|m| m.get("quantity"))
                .and_then(|q| q.as_i64())
                .unwrap_or(1) as i32;

            // Extraire les notes
            let notes = metadata
                .as_ref()
                .and_then(|m| m.get("notes"))
                .and_then(|n| n.as_str())
                .map(|s| s.to_string());

            // Extraire la première image du produit
            let image_url = Self::extract_first_image(&product_data);

            products.push(ProductToPickup {
                product_index,
                product_name,
                product_price: product_price.map(|p| {
                    use rust_decimal::prelude::ToPrimitive;
                    p.to_f64().unwrap_or(0.0)
                }),
                quantity,
                image_url,
                notes,
            });
        }

        // Si aucun produit trouvé via product_orders, essayer via metadata de la livraison
        if products.is_empty() {
            let delivery_metadata: Option<serde_json::Value> =
                sqlx::query_scalar("SELECT metadata FROM deliveries WHERE id = $1")
                    .bind(delivery_id)
                    .fetch_optional(&self.pool)
                    .await?;

            if let Some(metadata) = delivery_metadata {
                // Extraire les items du panier shopping si c'est une livraison shopping
                if let Some(items) = metadata.get("shopping_items").and_then(|v| v.as_array()) {
                    for (idx, item) in items.iter().enumerate() {
                        products.push(ProductToPickup {
                            product_index: idx as i32,
                            product_name: item
                                .get("label")
                                .and_then(|l| l.as_str())
                                .unwrap_or("Article")
                                .to_string(),
                            product_price: item.get("estimatedPrice").and_then(|p| p.as_f64()),
                            quantity: item.get("quantity").and_then(|q| q.as_i64()).unwrap_or(1)
                                as i32,
                            image_url: item
                                .get("imageUrl")
                                .and_then(|u| u.as_str())
                                .map(|s| s.to_string()),
                            notes: item.get("note").and_then(|n| n.as_str()).map(|s| s.to_string()),
                        });
                    }
                }

                // Ou extraire depuis product_name/product_index dans metadata (commande simple)
                if products.is_empty() {
                    if let Some(product_name) =
                        metadata.get("product_name").and_then(|v| v.as_str())
                    {
                        products.push(ProductToPickup {
                            product_index: metadata
                                .get("product_index")
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0) as i32,
                            product_name: product_name.to_string(),
                            product_price: metadata.get("product_price").and_then(|v| v.as_f64()),
                            quantity: metadata.get("quantity").and_then(|v| v.as_i64()).unwrap_or(1)
                                as i32,
                            image_url: None,
                            notes: None,
                        });
                    }
                }
            }
        }

        Ok(products)
    }

    /// Extrait la première image d'un produit (gère le format {valeur: [...]})
    fn extract_first_image(product_data: &Option<serde_json::Value>) -> Option<String> {
        let data = product_data.as_ref()?;
        let images = data.get("images")?;

        // Format tableau direct
        if let Some(arr) = images.as_array() {
            return arr.first().and_then(|v| v.as_str()).map(|s| s.to_string());
        }

        // Format {valeur: [...]}
        if let Some(obj) = images.as_object() {
            if let Some(valeur) = obj.get("valeur") {
                if let Some(arr) = valeur.as_array() {
                    return arr.first().and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
        }

        None
    }

    /// Récupère le code de vérification pour un coursier (le coursier voit son propre code)
    pub async fn get_verification_code_for_courier(
        &self,
        delivery_id: Uuid,
        courier_id: Uuid,
    ) -> AppResult<Option<CourierVerificationCode>> {
        let row = sqlx::query(
            r#"
            SELECT 
                id, delivery_id, order_id, courier_id,
                verification_code, qr_code_data,
                expires_at, verified_at, verified_by,
                verification_method, created_at
            FROM courier_verification_codes
            WHERE delivery_id = $1 AND courier_id = $2
            AND verified_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(delivery_id)
        .bind(courier_id)
        .map(|row: sqlx::postgres::PgRow| CourierVerificationCode {
            id: row.get::<Uuid, _>("id"),
            delivery_id: row.get::<Uuid, _>("delivery_id"),
            order_id: row.get::<Option<_>, _>("order_id"),
            courier_id: row.get::<Uuid, _>("courier_id"),
            verification_code: row.get::<String, _>("verification_code"),
            qr_code_data: row.get::<Option<_>, _>("qr_code_data"),
            expires_at: row.get::<DateTime<Utc>, _>("expires_at"),
            verified_at: row.get::<Option<_>, _>("verified_at"),
            verified_by: row.get::<Option<_>, _>("verified_by"),
            verification_method: row.get::<Option<_>, _>("verification_method"),
            created_at: row.get::<DateTime<Utc>, _>("created_at"),
        })
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }
}
