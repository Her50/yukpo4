use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Service pour gérer le stock des produits
pub struct ProductStockService {
    pool: PgPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockLocation {
    pub id: i32,
    pub product_delivery_config_id: i32,
    pub storage_location_id: Option<i32>,
    pub quantity_available: i32,
    pub quantity_reserved: i32,
    pub is_available: bool,
    pub updated_at: DateTime<Utc>,
    pub updated_by: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockReservation {
    pub id: Uuid,
    pub order_id: Uuid,
    pub stock_location_id: i32,
    pub quantity: i32,
    pub reserved_at: DateTime<Utc>,
    pub released_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStockRequest {
    pub quantity_available: Option<i32>,
    pub quantity_reserved: Option<i32>,
    pub is_available: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReserveStockRequest {
    pub order_id: Uuid,
    pub quantity: i32,
    pub expires_in_minutes: i32, // Durée de validité de la réservation
}

impl ProductStockService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Récupère le stock pour un produit
    pub async fn get_stock(
        &self,
        product_delivery_config_id: i32,
    ) -> AppResult<Vec<StockLocation>> {
        let rows: Vec<StockLocation> = sqlx::query(
            r#"
            SELECT 
                id,
                product_delivery_config_id,
                storage_location_id,
                quantity_available,
                quantity_reserved,
                is_available,
                updated_at,
                updated_by
            FROM product_stock_locations
            WHERE product_delivery_config_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(product_delivery_config_id)
        .map(|row: sqlx::postgres::PgRow| StockLocation {
            id: row.get::<i32, _>("id"),
            product_delivery_config_id: row.get::<i32, _>("product_delivery_config_id"),
            storage_location_id: row.try_get("storage_location_id").ok(),
            quantity_available: row.get::<i32, _>("quantity_available"),
            quantity_reserved: row.get::<i32, _>("quantity_reserved"),
            is_available: row.get::<bool, _>("is_available"),
            updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
            updated_by: row.try_get("updated_by").ok(),
        })
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Met à jour le stock d'un produit
    pub async fn update_stock(
        &self,
        product_delivery_config_id: i32,
        storage_location_id: Option<i32>,
        request: UpdateStockRequest,
        updated_by: i32,
    ) -> AppResult<StockLocation> {
        info!(
            "[ProductStock] Mise à jour stock: config_id={}, location_id={:?}",
            product_delivery_config_id, storage_location_id
        );

        // Vérifier si l'entrée existe
        let existing_id: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM product_stock_locations
            WHERE product_delivery_config_id = $1 
            AND (storage_location_id = $2 OR (storage_location_id IS NULL AND $2 IS NULL))
            "#,
        )
        .bind(product_delivery_config_id)
        .bind(storage_location_id)
        .fetch_optional(&self.pool)
        .await?;

        let stock_id: i32 = if let Some(existing_id) = existing_id {
            // Mettre à jour l'entrée existante
            sqlx::query(
                r#"
                UPDATE product_stock_locations
                SET 
                    quantity_available = COALESCE($1, quantity_available),
                    quantity_reserved = COALESCE($2, quantity_reserved),
                    is_available = COALESCE($3, is_available),
                    updated_at = NOW(),
                    updated_by = $4
                WHERE id = $5
                RETURNING id
                "#,
            )
            .bind(request.quantity_available)
            .bind(request.quantity_reserved)
            .bind(request.is_available)
            .bind(updated_by)
            .bind(existing_id)
            .map(|row: sqlx::postgres::PgRow| row.get::<i32, _>("id"))
            .fetch_one(&self.pool)
            .await?
        } else {
            // Créer une nouvelle entrée
            sqlx::query_scalar(
                r#"
                INSERT INTO product_stock_locations (
                    product_delivery_config_id,
                    storage_location_id,
                    quantity_available,
                    quantity_reserved,
                    is_available,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
                "#,
            )
            .bind(product_delivery_config_id)
            .bind(storage_location_id)
            .bind(request.quantity_available.unwrap_or(0))
            .bind(request.quantity_reserved.unwrap_or(0))
            .bind(request.is_available.unwrap_or(true))
            .bind(updated_by)
            .fetch_one(&self.pool)
            .await?
        };

        // Récupérer l'entrée mise à jour
        let row = sqlx::query(
            r#"
            SELECT 
                id,
                product_delivery_config_id,
                storage_location_id,
                quantity_available,
                quantity_reserved,
                is_available,
                updated_at,
                updated_by
            FROM product_stock_locations
            WHERE id = $1
            "#,
        )
        .bind(stock_id)
        .map(|row: sqlx::postgres::PgRow| StockLocation {
            id: row.get::<i32, _>("id"),
            product_delivery_config_id: row.get::<i32, _>("product_delivery_config_id"),
            storage_location_id: row.try_get("storage_location_id").ok(),
            quantity_available: row.get::<i32, _>("quantity_available"),
            quantity_reserved: row.get::<i32, _>("quantity_reserved"),
            is_available: row.get::<bool, _>("is_available"),
            updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
            updated_by: row.get::<i32, _>("updated_by"),
        })
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    /// Réserve du stock pour une commande
    pub async fn reserve_stock(
        &self,
        product_delivery_config_id: i32,
        storage_location_id: Option<i32>,
        request: ReserveStockRequest,
    ) -> AppResult<StockReservation> {
        info!(
            "[ProductStock] Réservation stock: config_id={}, quantity={}, order_id={}",
            product_delivery_config_id, request.quantity, request.order_id
        );

        // Vérifier la disponibilité du stock
        let stock = sqlx::query!(
            r#"
            SELECT 
                id,
                quantity_available,
                quantity_reserved,
                is_available
            FROM product_stock_locations
            WHERE product_delivery_config_id = $1 
            AND (storage_location_id = $2 OR (storage_location_id IS NULL AND $2 IS NULL))
            "#,
            product_delivery_config_id,
            storage_location_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let stock = match stock {
            Some(s) => s,
            None => {
                return Err(AppError::NotFound(
                    "Stock non trouvé pour ce produit".to_string(),
                ));
            }
        };

        if !stock.is_available {
            return Err(AppError::BadRequest(
                "Le stock n'est pas disponible".to_string(),
            ));
        }

        let available = stock.quantity_available - stock.quantity_reserved;
        if available < request.quantity {
            return Err(AppError::BadRequest(format!(
                "Stock insuffisant: disponible={}, demandé={}",
                available, request.quantity
            )));
        }

        // Créer la réservation
        let now = Utc::now();
        let expires_at = now + chrono::Duration::minutes(request.expires_in_minutes as i64);

        let reservation_id = sqlx::query_scalar!(
            r#"
            INSERT INTO stock_reservations (
                order_id,
                stock_location_id,
                quantity,
                expires_at
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
            "#,
            request.order_id,
            stock.id,
            request.quantity,
            expires_at
        )
        .fetch_one(&self.pool)
        .await?;

        // Mettre à jour la quantité réservée
        sqlx::query!(
            r#"
            UPDATE product_stock_locations
            SET 
                quantity_reserved = quantity_reserved + $1,
                updated_at = NOW()
            WHERE id = $2
            "#,
            request.quantity,
            stock.id
        )
        .execute(&self.pool)
        .await?;

        info!(
            "[ProductStock] Stock réservé: reservation_id={}, quantity={}",
            reservation_id, request.quantity
        );

        // Récupérer la réservation créée
        let row = sqlx::query!(
            r#"
            SELECT 
                id,
                order_id,
                stock_location_id,
                quantity,
                reserved_at,
                released_at,
                expires_at
            FROM stock_reservations
            WHERE id = $1
            "#,
            reservation_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(StockReservation {
            id: row.id,
            order_id: row.order_id,
            stock_location_id: row.stock_location_id,
            quantity: row.quantity,
            reserved_at: row.reserved_at,
            released_at: row.released_at,
            expires_at: row.expires_at,
        })
    }

    /// Libère une réservation de stock
    pub async fn release_reservation(&self, reservation_id: Uuid) -> AppResult<()> {
        info!(
            "[ProductStock] Libération réservation: reservation_id={}",
            reservation_id
        );

        // Récupérer la réservation
        let reservation = sqlx::query!(
            r#"
            SELECT 
                stock_location_id,
                quantity,
                released_at
            FROM stock_reservations
            WHERE id = $1
            "#,
            reservation_id
        )
        .fetch_optional(&self.pool)
        .await?;

        let reservation = match reservation {
            Some(r) => r,
            None => {
                return Err(AppError::NotFound(
                    "Réservation non trouvée".to_string(),
                ));
            }
        };

        if reservation.released_at.is_some() {
            warn!(
                "[ProductStock] Réservation déjà libérée: reservation_id={}",
                reservation_id
            );
            return Ok(());
        }

        // Marquer la réservation comme libérée
        sqlx::query!(
            r#"
            UPDATE stock_reservations
            SET released_at = NOW()
            WHERE id = $1
            "#,
            reservation_id
        )
        .execute(&self.pool)
        .await?;

        // Mettre à jour la quantité réservée
        sqlx::query!(
            r#"
            UPDATE product_stock_locations
            SET 
                quantity_reserved = GREATEST(0, quantity_reserved - $1),
                updated_at = NOW()
            WHERE id = $2
            "#,
            reservation.quantity,
            reservation.stock_location_id
        )
        .execute(&self.pool)
        .await?;

        info!(
            "[ProductStock] Réservation libérée: reservation_id={}",
            reservation_id
        );

        Ok(())
    }

    /// Libère toutes les réservations expirées
    pub async fn release_expired_reservations(&self) -> AppResult<usize> {
        let now = Utc::now();

        // Récupérer les réservations expirées
        let expired = sqlx::query!(
            r#"
            SELECT 
                id,
                stock_location_id,
                quantity
            FROM stock_reservations
            WHERE expires_at < $1
            AND released_at IS NULL
            "#,
            now
        )
        .fetch_all(&self.pool)
        .await?;

        let count = expired.len();

        for reservation in &expired {
            // Libérer chaque réservation
            sqlx::query!(
                r#"
                UPDATE stock_reservations
                SET released_at = NOW()
                WHERE id = $1
                "#,
                reservation.id
            )
            .execute(&self.pool)
            .await?;

            // Mettre à jour la quantité réservée
            sqlx::query!(
                r#"
                UPDATE product_stock_locations
                SET 
                    quantity_reserved = GREATEST(0, quantity_reserved - $1),
                    updated_at = NOW()
                WHERE id = $2
                "#,
                reservation.quantity,
                reservation.stock_location_id
            )
            .execute(&self.pool)
            .await?;
        }

        if count > 0 {
            info!(
                "[ProductStock] {} réservations expirées libérées",
                count
            );
        }

        Ok(count)
    }

    /// Vérifie la disponibilité du stock
    pub async fn check_availability(
        &self,
        product_delivery_config_id: i32,
        quantity: i32,
    ) -> AppResult<bool> {
        let stock = sqlx::query!(
            r#"
            SELECT 
                SUM(quantity_available - quantity_reserved) as total_available
            FROM product_stock_locations
            WHERE product_delivery_config_id = $1
            AND is_available = TRUE
            "#,
            product_delivery_config_id
        )
        .fetch_one(&self.pool)
        .await?;

        let total_available = stock.total_available.unwrap_or(0);
        Ok(total_available >= quantity)
    }

    /// Supprime un lieu de stockage
    pub async fn remove_stock_location(
        &self,
        product_delivery_config_id: i32,
        storage_location_id: i32,
    ) -> AppResult<()> {
        info!(
            "[ProductStock] Suppression lieu stockage: config_id={}, location_id={}",
            product_delivery_config_id, storage_location_id
        );

        sqlx::query!(
            r#"
            DELETE FROM product_stock_locations
            WHERE product_delivery_config_id = $1
            AND storage_location_id = $2
            "#,
            product_delivery_config_id,
            storage_location_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

