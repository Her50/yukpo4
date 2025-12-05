use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Duration, Utc};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Service pour gérer le workflow de préparation des commandes
pub struct OrderPreparationService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    Validated,
    Preparing,
    Ready,
    CourierAssigned,
    PickedUp,
    Delivered,
    Cancelled,
    Rejected,
}

impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Pending => "pending",
            OrderStatus::Validated => "validated",
            OrderStatus::Preparing => "preparing",
            OrderStatus::Ready => "ready",
            OrderStatus::CourierAssigned => "courier_assigned",
            OrderStatus::PickedUp => "picked_up",
            OrderStatus::Delivered => "delivered",
            OrderStatus::Cancelled => "cancelled",
            OrderStatus::Rejected => "rejected",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => OrderStatus::Pending,
            "validated" => OrderStatus::Validated,
            "preparing" => OrderStatus::Preparing,
            "ready" => OrderStatus::Ready,
            "courier_assigned" => OrderStatus::CourierAssigned,
            "picked_up" => OrderStatus::PickedUp,
            "delivered" => OrderStatus::Delivered,
            "cancelled" => OrderStatus::Cancelled,
            "rejected" => OrderStatus::Rejected,
            _ => OrderStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductOrder {
    pub id: Uuid,
    pub delivery_id: Option<Uuid>,
    pub service_id: i32,
    pub product_index: i32,
    pub client_user_id: i32,
    pub provider_user_id: i32,
    pub status: String,
    pub preparation_time_minutes: Option<i32>,
    pub estimated_ready_at: Option<DateTime<Utc>>,
    pub validated_at: Option<DateTime<Utc>>,
    pub validated_by: Option<i32>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
    pub validation_deadline: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub delivery_id: Option<Uuid>,
    pub service_id: i32,
    pub product_index: i32,
    pub client_user_id: i32,
    pub provider_user_id: i32,
    pub validation_timeout_minutes: Option<i32>, // Délai pour validation (défaut: 15 min)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateOrderRequest {
    pub estimated_ready_at: Option<DateTime<Utc>>, // NULL si is_immediately_available = TRUE
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectOrderRequest {
    pub reason: String,
}

impl OrderPreparationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Crée une nouvelle commande produit
    /// Calcule automatiquement le temps de préparation si NULL
    /// ✅ NOUVEAU 2025-01-28: Vérifie le stock avant de créer la commande
    pub async fn create_order(&self, request: CreateOrderRequest) -> AppResult<ProductOrder> {
        info!(
            "[OrderPreparation] Création commande: service_id={}, product_index={}, client={}",
            request.service_id, request.product_index, request.client_user_id
        );

        // ✅ NOUVEAU 2025-01-28: Vérifier le stock avant de créer la commande (uniquement pour les produits)
        use crate::services::product_stock_service::ProductStockService;
        let stock_service = ProductStockService::new(self.pool.clone());

        let is_tarissable = stock_service.is_tarissable(request.service_id).await?;

        // Uniquement pour les produits (is_tarissable = TRUE)
        if is_tarissable {
            let available_stock = stock_service
                .get_available_stock(request.service_id, request.product_index)
                .await?;

            if let Some(stock) = available_stock {
                if stock <= 0 {
                    return Err(AppError::BadRequest(
                        "Stock épuisé. Ce produit n'est plus disponible.".to_string(),
                    ));
                }
                info!(
                    "[OrderPreparation] Stock disponible: {} unités pour service_id={}, product_index={}",
                    stock, request.service_id, request.product_index
                );
            }
        }

        // Récupérer la configuration de livraison
        #[allow(dead_code)]
        struct Config {
            preparation_time_minutes: Option<i32>,
            is_immediately_available: Option<bool>,
            max_preparation_time_minutes: Option<i32>,
        }

        let config: Option<Config> = sqlx::query(
            r#"
            SELECT 
                preparation_time_minutes,
                is_immediately_available,
                max_preparation_time_minutes
            FROM product_delivery_config
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(request.service_id)
        .bind(request.product_index)
        .map(|row: sqlx::postgres::PgRow| Config {
            preparation_time_minutes: row.get::<Option<_>, _>("preparation_time_minutes"),
            is_immediately_available: row.get::<Option<_>, _>("is_immediately_available"),
            max_preparation_time_minutes: row.get::<Option<_>, _>("max_preparation_time_minutes"),
        })
        .fetch_optional(&self.pool)
        .await?;

        let config = match config {
            Some(c) => c,
            None => {
                return Err(AppError::NotFound(format!(
                    "Configuration de livraison non trouvée pour service_id={}, product_index={}",
                    request.service_id, request.product_index
                )));
            }
        };

        let is_immediately_available = config.is_immediately_available.unwrap_or(false);
        let mut preparation_time_minutes = config.preparation_time_minutes;
        let validation_timeout_minutes = request.validation_timeout_minutes.unwrap_or(15);

        // Si preparation_time_minutes est NULL, utiliser valeur dynamique
        if preparation_time_minutes.is_none() && !is_immediately_available {
            // Récupérer la catégorie du service pour calcul dynamique
            let service_category: Option<String> = sqlx::query_scalar(
                r#"
                SELECT category
                FROM services
                WHERE id = $1
                "#,
            )
            .bind(request.service_id)
            .fetch_optional(&self.pool)
            .await?;

            if let Some(category) = service_category {
                let dynamic_service = crate::services::dynamic_preparation_time_service::DynamicPreparationTimeService::new(self.pool.clone());
                if let Ok(Some(dynamic_time)) = dynamic_service
                    .get_preparation_time_for_category(&category)
                    .await
                {
                    preparation_time_minutes = Some(dynamic_time);
                    info!(
                        "[OrderPreparation] Utilisation temps dynamique pour catégorie {}: {} min",
                        category, dynamic_time
                    );
                } else {
                    // Fallback: valeur par défaut
                    preparation_time_minutes = Some(30);
                }
            } else {
                // Pas de catégorie, utiliser valeur par défaut
                preparation_time_minutes = Some(30);
            }
        }

        // Calculer estimated_ready_at et validation_deadline
        let now = Utc::now();
        let estimated_ready_at = if is_immediately_available {
            None // Pas de délai si disponible immédiatement
        } else {
            preparation_time_minutes.map(|mins| now + Duration::minutes(mins as i64))
        };

        let validation_deadline = now + Duration::minutes(validation_timeout_minutes as i64);

        // Créer la commande
        let order_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO product_orders (
                delivery_id,
                service_id,
                product_index,
                client_user_id,
                provider_user_id,
                status,
                preparation_time_minutes,
                estimated_ready_at,
                validation_deadline,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, '{}'::jsonb)
            RETURNING id
            "#,
        )
        .bind(request.delivery_id)
        .bind(request.service_id)
        .bind(request.product_index)
        .bind(request.client_user_id)
        .bind(request.provider_user_id)
        .bind(preparation_time_minutes)
        .bind(estimated_ready_at)
        .bind(validation_deadline)
        .fetch_one(&self.pool)
        .await?;

        info!(
            "[OrderPreparation] Commande créée: order_id={}, estimated_ready_at={:?}, validation_deadline={:?}",
            order_id, estimated_ready_at, validation_deadline
        );

        // Récupérer la commande créée
        self.get_order(order_id).await
    }

    /// Valide une commande (prestataire accepte)
    /// Si is_immediately_available = TRUE, passe directement à "ready" et démarre matching
    pub async fn validate_order(
        &self,
        order_id: Uuid,
        provider_user_id: i32,
        request: ValidateOrderRequest,
    ) -> AppResult<ProductOrder> {
        info!(
            "[OrderPreparation] Validation commande: order_id={}, provider={}",
            order_id, provider_user_id
        );

        // Vérifier que la commande existe et appartient au prestataire
        let order = self.get_order(order_id).await?;

        if order.provider_user_id != provider_user_id {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le prestataire de cette commande".to_string(),
            ));
        }

        if order.status != "pending" {
            return Err(AppError::BadRequest(format!(
                "La commande n'est pas en attente de validation (statut: {})",
                order.status
            )));
        }

        // Vérifier que le délai de validation n'est pas expiré
        if let Some(deadline) = order.validation_deadline {
            if Utc::now() > deadline {
                return Err(AppError::BadRequest(
                    "Le délai de validation est expiré".to_string(),
                ));
            }
        }

        // Récupérer la configuration pour vérifier is_immediately_available
        let is_immediately_available: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT is_immediately_available
            FROM product_delivery_config
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(order.service_id)
        .bind(order.product_index)
        .fetch_optional(&self.pool)
        .await?;

        let is_immediately_available = is_immediately_available.unwrap_or(false);

        let now = Utc::now();
        let new_status = if is_immediately_available {
            // Disponible immédiatement → passer directement à "ready"
            "ready"
        } else {
            // Avec délai → passer à "validated" puis "preparing"
            "validated"
        };

        let estimated_ready_at = if is_immediately_available {
            // Pas de délai si disponible immédiatement
            None
        } else {
            // Utiliser estimated_ready_at fourni ou calculer
            request.estimated_ready_at.or_else(|| {
                order
                    .preparation_time_minutes
                    .map(|mins| now + Duration::minutes(mins as i64))
            })
        };

        // ✅ NOUVEAU 2025-01-28: Vérifier et décrémenter le stock après validation (uniquement pour les produits)
        use crate::services::product_stock_service::ProductStockService;
        let stock_service = ProductStockService::new(self.pool.clone());

        let is_tarissable = stock_service.is_tarissable(order.service_id).await?;

        if is_tarissable {
            // Décrémenter le stock
            stock_service
                .decrement_stock(order.service_id, order.product_index, 1)
                .await?;

            info!(
                "[OrderPreparation] Stock décrémenté pour service_id={}, product_index={}",
                order.service_id, order.product_index
            );

            // ✅ NOUVEAU: Vérifier si stock = 0 après décrémentation et désactiver automatiquement
            let is_zero = stock_service
                .is_stock_zero(order.service_id, order.product_index)
                .await?;

            if is_zero {
                info!(
                    "[OrderPreparation] Stock épuisé après commande - Désactivation automatique du produit service_id={}, product_index={}",
                    order.service_id, order.product_index
                );

                // Désactiver le produit dans products_lifecycle
                let _ = sqlx::query(
                    r#"
                    UPDATE products_lifecycle
                    SET 
                        is_active = FALSE,
                        updated_at = NOW(),
                        deactivation_count = deactivation_count + 1
                    WHERE service_id = $1
                        AND product_index = $2
                        AND is_active = TRUE
                    "#,
                )
                .bind(order.service_id)
                .bind(order.product_index)
                .execute(&self.pool)
                .await?;

                // Envoyer notification au prestataire
                let provider_user_id_from_order = order.provider_user_id;
                let product_nom: Option<String> = sqlx::query_scalar(
                    r#"
                    SELECT product_nom
                    FROM products_lifecycle
                    WHERE service_id = $1
                        AND product_index = $2
                    LIMIT 1
                    "#,
                )
                .bind(order.service_id)
                .bind(order.product_index)
                .fetch_optional(&self.pool)
                .await?;

                if let Some(pnom) = product_nom {
                    // Créer notification
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO notifications (
                            user_id,
                            type,
                            title,
                            message,
                            data,
                            is_read,
                            created_at
                        ) VALUES (
                            $1,
                            'product_deactivated',
                            $2,
                            $3,
                            $4,
                            FALSE,
                            NOW()
                        )
                        "#,
                    )
                    .bind(provider_user_id_from_order)
                    .bind(format!("Produit désactivé (stock épuisé): {}", pnom))
                    .bind(format!(
                        "Votre produit '{}' a été automatiquement désactivé car le stock est épuisé. Réactivez-le pour 1000 FCFA pour le rendre visible à nouveau.",
                        pnom
                    ))
                    .bind(serde_json::json!({
                        "service_id": order.service_id,
                        "product_index": order.product_index,
                        "reason": "stock_zero"
                    }))
                    .execute(&self.pool)
                    .await?;
                }
            }
        }

        // Mettre à jour la commande
        sqlx::query(
            r#"
            UPDATE product_orders
            SET 
                status = $1,
                validated_at = $2,
                validated_by = $3,
                estimated_ready_at = $4,
                updated_at = NOW()
            WHERE id = $5
            "#,
        )
        .bind(new_status)
        .bind(now)
        .bind(provider_user_id)
        .bind(estimated_ready_at)
        .bind(order_id)
        .execute(&self.pool)
        .await?;

        info!(
            "[OrderPreparation] Commande validée: order_id={}, status={}, estimated_ready_at={:?}",
            order_id, new_status, estimated_ready_at
        );

        // Si ready, démarrer le matching coursier (sera géré par delivery_service)
        if new_status == "ready" {
            info!(
                "[OrderPreparation] Commande prête immédiatement, matching coursier peut démarrer: order_id={}",
                order_id
            );
        }

        self.get_order(order_id).await
    }

    /// Rejette une commande (prestataire refuse)
    pub async fn reject_order(
        &self,
        order_id: Uuid,
        provider_user_id: i32,
        request: RejectOrderRequest,
    ) -> AppResult<ProductOrder> {
        info!(
            "[OrderPreparation] Rejet commande: order_id={}, provider={}, reason={}",
            order_id, provider_user_id, request.reason
        );

        // Vérifier que la commande existe et appartient au prestataire
        let order = self.get_order(order_id).await?;

        if order.provider_user_id != provider_user_id {
            return Err(AppError::Forbidden(
                "Vous n'êtes pas le prestataire de cette commande".to_string(),
            ));
        }

        if order.status != "pending" {
            return Err(AppError::BadRequest(format!(
                "La commande n'est pas en attente de validation (statut: {})",
                order.status
            )));
        }

        let now = Utc::now();

        // Mettre à jour la commande
        sqlx::query(
            r#"
            UPDATE product_orders
            SET 
                status = 'rejected',
                rejected_at = $1,
                rejection_reason = $2,
                updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(now)
        .bind(&request.reason)
        .bind(order_id)
        .execute(&self.pool)
        .await?;

        // Enregistrer l'annulation
        sqlx::query(
            r#"
            INSERT INTO order_cancellations (
                order_id,
                provider_user_id,
                service_id,
                product_index,
                cancellation_type,
                reason
            )
            VALUES ($1, $2, $3, $4, 'rejected', $5)
            "#,
        )
        .bind(order_id)
        .bind(provider_user_id)
        .bind(order.service_id)
        .bind(order.product_index)
        .bind(&request.reason)
        .execute(&self.pool)
        .await?;

        info!("[OrderPreparation] Commande rejetée: order_id={}", order_id);

        self.get_order(order_id).await
    }

    /// Récupère une commande par ID
    pub async fn get_order(&self, order_id: Uuid) -> AppResult<ProductOrder> {
        let row = sqlx::query(
            r#"
            SELECT 
                id,
                delivery_id,
                service_id,
                product_index,
                client_user_id,
                provider_user_id,
                status,
                preparation_time_minutes,
                estimated_ready_at,
                validated_at,
                validated_by,
                rejected_at,
                rejection_reason,
                validation_deadline,
                created_at,
                updated_at,
                metadata
            FROM product_orders
            WHERE id = $1
            "#,
        )
        .bind(order_id)
        .map(|row: sqlx::postgres::PgRow| ProductOrder {
            id: row.get::<Uuid, _>("id"),
            delivery_id: row.try_get::<Option<Uuid>, _>("delivery_id").ok().flatten(),
            service_id: row.get::<i32, _>("service_id"),
            product_index: row.get::<i32, _>("product_index"),
            client_user_id: row.get::<i32, _>("client_user_id"),
            provider_user_id: row.get::<i32, _>("provider_user_id"),
            status: row.get::<String, _>("status"),
            preparation_time_minutes: row
                .try_get::<Option<i32>, _>("preparation_time_minutes")
                .ok()
                .flatten(),
            estimated_ready_at: row
                .try_get::<Option<DateTime<Utc>>, _>("estimated_ready_at")
                .ok()
                .flatten(),
            validated_at: row
                .try_get::<Option<DateTime<Utc>>, _>("validated_at")
                .ok()
                .flatten(),
            validated_by: row.try_get::<Option<i32>, _>("validated_by").ok().flatten(),
            rejected_at: row
                .try_get::<Option<DateTime<Utc>>, _>("rejected_at")
                .ok()
                .flatten(),
            rejection_reason: row
                .try_get::<Option<String>, _>("rejection_reason")
                .ok()
                .flatten(),
            validation_deadline: row
                .try_get::<Option<DateTime<Utc>>, _>("validation_deadline")
                .ok()
                .flatten(),
            created_at: row.get::<DateTime<Utc>, _>("created_at"),
            updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
            metadata: row
                .get::<Option<serde_json::Value>, _>("metadata")
                .unwrap_or_else(|| serde_json::json!({})),
        })
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(order) => Ok(order),
            None => Err(AppError::NotFound(format!(
                "Commande {} non trouvée",
                order_id
            ))),
        }
    }

    /// Liste les commandes d'un prestataire
    pub async fn list_provider_orders(
        &self,
        provider_user_id: i32,
        status_filter: Option<&str>,
        limit: i32,
    ) -> AppResult<Vec<ProductOrder>> {
        let orders: Vec<ProductOrder> = if let Some(status) = status_filter {
            sqlx::query(
                r#"
                SELECT 
                    id,
                    delivery_id,
                    service_id,
                    product_index,
                    client_user_id,
                    provider_user_id,
                    status,
                    preparation_time_minutes,
                    estimated_ready_at,
                    validated_at,
                    validated_by,
                    rejected_at,
                    rejection_reason,
                    validation_deadline,
                    created_at,
                    updated_at,
                    metadata
                FROM product_orders
                WHERE provider_user_id = $1 AND status = $2
                ORDER BY created_at DESC
                LIMIT $3
                "#,
            )
            .bind(provider_user_id)
            .bind(status)
            .bind(limit)
            .map(|row: sqlx::postgres::PgRow| ProductOrder {
                id: row.get::<Uuid, _>("id"),
                delivery_id: row.try_get::<Option<Uuid>, _>("delivery_id").ok().flatten(),
                service_id: row.get::<i32, _>("service_id"),
                product_index: row.get::<i32, _>("product_index"),
                client_user_id: row.get::<i32, _>("client_user_id"),
                provider_user_id: row.get::<i32, _>("provider_user_id"),
                status: row.get::<String, _>("status"),
                preparation_time_minutes: row
                    .try_get::<Option<i32>, _>("preparation_time_minutes")
                    .ok()
                    .flatten(),
                estimated_ready_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("estimated_ready_at")
                    .ok()
                    .flatten(),
                validated_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("validated_at")
                    .ok()
                    .flatten(),
                validated_by: row.try_get::<Option<i32>, _>("validated_by").ok().flatten(),
                rejected_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("rejected_at")
                    .ok()
                    .flatten(),
                rejection_reason: row
                    .try_get::<Option<String>, _>("rejection_reason")
                    .ok()
                    .flatten(),
                validation_deadline: row
                    .try_get::<Option<DateTime<Utc>>, _>("validation_deadline")
                    .ok()
                    .flatten(),
                created_at: row.get::<DateTime<Utc>, _>("created_at"),
                updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
                metadata: row
                    .get::<Option<serde_json::Value>, _>("metadata")
                    .unwrap_or_else(|| serde_json::json!({})),
            })
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query(
                r#"
                SELECT 
                    id,
                    delivery_id,
                    service_id,
                    product_index,
                    client_user_id,
                    provider_user_id,
                    status,
                    preparation_time_minutes,
                    estimated_ready_at,
                    validated_at,
                    validated_by,
                    rejected_at,
                    rejection_reason,
                    validation_deadline,
                    created_at,
                    updated_at,
                    metadata
                FROM product_orders
                WHERE provider_user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                "#,
            )
            .bind(provider_user_id)
            .bind(limit)
            .map(|row: sqlx::postgres::PgRow| ProductOrder {
                id: row.get::<Uuid, _>("id"),
                delivery_id: row.try_get::<Option<Uuid>, _>("delivery_id").ok().flatten(),
                service_id: row.get::<i32, _>("service_id"),
                product_index: row.get::<i32, _>("product_index"),
                client_user_id: row.get::<i32, _>("client_user_id"),
                provider_user_id: row.get::<i32, _>("provider_user_id"),
                status: row.get::<String, _>("status"),
                preparation_time_minutes: row
                    .try_get::<Option<i32>, _>("preparation_time_minutes")
                    .ok()
                    .flatten(),
                estimated_ready_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("estimated_ready_at")
                    .ok()
                    .flatten(),
                validated_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("validated_at")
                    .ok()
                    .flatten(),
                validated_by: row.try_get::<Option<i32>, _>("validated_by").ok().flatten(),
                rejected_at: row
                    .try_get::<Option<DateTime<Utc>>, _>("rejected_at")
                    .ok()
                    .flatten(),
                rejection_reason: row
                    .try_get::<Option<String>, _>("rejection_reason")
                    .ok()
                    .flatten(),
                validation_deadline: row
                    .try_get::<Option<DateTime<Utc>>, _>("validation_deadline")
                    .ok()
                    .flatten(),
                created_at: row.get::<DateTime<Utc>, _>("created_at"),
                updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
                metadata: row
                    .get::<Option<serde_json::Value>, _>("metadata")
                    .unwrap_or_else(|| serde_json::json!({})),
            })
            .fetch_all(&self.pool)
            .await?
        };

        Ok(orders)
    }

    /// Met à jour le statut d'une commande
    pub async fn update_status(&self, order_id: Uuid, new_status: &str) -> AppResult<ProductOrder> {
        sqlx::query(
            r#"
            UPDATE product_orders
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(new_status)
        .bind(order_id)
        .execute(&self.pool)
        .await?;

        self.get_order(order_id).await
    }

    /// Marque une commande comme prête
    pub async fn mark_as_ready(&self, order_id: Uuid) -> AppResult<ProductOrder> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE product_orders
            SET 
                status = 'ready',
                estimated_ready_at = $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(now)
        .bind(order_id)
        .execute(&self.pool)
        .await?;

        info!(
            "[OrderPreparation] Commande marquée comme prête: order_id={}",
            order_id
        );

        self.get_order(order_id).await
    }
}
