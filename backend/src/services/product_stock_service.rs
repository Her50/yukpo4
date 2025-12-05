// ✅ NOUVEAU 2025-01-28: Service de gestion du stock des produits
// Gère le stock depuis services.data JSON (produits[].stock ou produits[].variants[].stock)

use crate::core::types::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;

pub struct ProductStockService {
    pool: PgPool,
}

impl ProductStockService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Vérifie si un service est tarissable (produit)
    pub async fn is_tarissable(&self, service_id: i32) -> AppResult<bool> {
        let is_tarissable: Option<bool> =
            sqlx::query_scalar("SELECT is_tarissable FROM services WHERE id = $1")
                .bind(service_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(is_tarissable.unwrap_or(false))
    }

    /// Récupère le stock disponible pour un produit
    /// Le stock peut être dans:
    /// - produits[index].stock (stock global)
    /// - produits[index].variants[].stock (stock par variante)
    /// - autocomplete_combinations.stock (fallback)
    pub async fn get_available_stock(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Option<i32>> {
        // 1. Vérifier depuis services.data JSON
        let service_data: Option<Value> =
            sqlx::query_scalar("SELECT data FROM services WHERE id = $1")
                .bind(service_id)
                .fetch_optional(&self.pool)
                .await?;

        if let Some(data) = service_data {
            if let Some(produits) = data.get("produits") {
                // ✅ CORRIGÉ: Structure réelle: produits.valeur[] (array de produits)
                if let Some(produits_array) = produits.get("valeur").and_then(|v| v.as_array()) {
                    if let Some(produit) = produits_array.get(product_index as usize) {
                        // ✅ PRIORITÉ 1: Vérifier stock global du produit (stock direct)
                        if let Some(stock_val) = produit.get("stock") {
                            // Gérer différents types: number, string
                            if let Some(stock) = stock_val.as_i64() {
                                if stock > 0 {
                                    return Ok(Some(stock as i32));
                                }
                            } else if let Some(stock_str) = stock_val.as_str() {
                                if let Ok(stock) = stock_str.parse::<i32>() {
                                    if stock > 0 {
                                        return Ok(Some(stock));
                                    }
                                }
                            }
                        }

                        // ✅ PRIORITÉ 2: Vérifier quantite_disponible (alias)
                        if let Some(qty_val) = produit.get("quantite_disponible") {
                            if let Some(qty) = qty_val.as_i64() {
                                if qty > 0 {
                                    return Ok(Some(qty as i32));
                                }
                            } else if let Some(qty_str) = qty_val.as_str() {
                                if let Ok(qty) = qty_str.parse::<i32>() {
                                    if qty > 0 {
                                        return Ok(Some(qty));
                                    }
                                }
                            }
                        }

                        // ✅ PRIORITÉ 3: Vérifier stock dans variants (somme totale)
                        if let Some(variants) = produit.get("variants").and_then(|v| v.as_array()) {
                            let total_stock: i32 = variants
                                .iter()
                                .filter_map(|v| {
                                    v.get("stock")
                                        .and_then(|s| {
                                            s.as_i64().or_else(|| {
                                                s.as_str().and_then(|str| str.parse::<i64>().ok())
                                            })
                                        })
                                        .map(|s| s as i32)
                                })
                                .sum();
                            if total_stock > 0 {
                                return Ok(Some(total_stock));
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback: Vérifier depuis autocomplete_combinations
        let stock_from_combinations: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT MIN(stock)
            FROM autocomplete_combinations
            WHERE service_id = $1
                AND stock IS NOT NULL
            "#,
        )
        .bind(service_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(stock_from_combinations)
    }

    /// Décrémente le stock d'un produit
    /// Priorité: variants[].stock > stock global > autocomplete_combinations.stock
    pub async fn decrement_stock(
        &self,
        service_id: i32,
        product_index: i32,
        quantity: i32,
    ) -> AppResult<()> {
        // Récupérer le service data
        let service_data: Option<Value> =
            sqlx::query_scalar("SELECT data FROM services WHERE id = $1")
                .bind(service_id)
                .fetch_optional(&self.pool)
                .await?;

        if let Some(mut data) = service_data {
            let mut updated = false;

            if let Some(produits) = data.get_mut("produits") {
                if let Some(produits_array) =
                    produits.get_mut("valeur").and_then(|v| v.as_array_mut())
                {
                    if let Some(produit) = produits_array.get_mut(product_index as usize) {
                        let mut remaining = quantity;

                        // ✅ PRIORITÉ 1: Décrémenter stock dans variants (si existe)
                        if let Some(variants) =
                            produit.get_mut("variants").and_then(|v| v.as_array_mut())
                        {
                            for variant in variants.iter_mut() {
                                if remaining <= 0 {
                                    break;
                                }
                                if let Some(stock_val) = variant.get_mut("stock") {
                                    // Gérer number ou string
                                    let current_stock = if let Some(stock) = stock_val.as_i64() {
                                        stock as i32
                                    } else if let Some(stock_str) = stock_val.as_str() {
                                        stock_str.parse::<i32>().unwrap_or(0)
                                    } else {
                                        0
                                    };

                                    if current_stock > 0 {
                                        let decrement = remaining.min(current_stock);
                                        let new_stock = (current_stock - decrement).max(0);
                                        *stock_val = json!(new_stock);
                                        remaining -= decrement;
                                        updated = true;
                                    }
                                }
                            }
                        }

                        // ✅ PRIORITÉ 2: Décrémenter stock global du produit (si variants épuisés ou inexistants)
                        if remaining > 0 {
                            if let Some(stock_val) = produit.get_mut("stock") {
                                let current_stock = if let Some(stock) = stock_val.as_i64() {
                                    stock as i32
                                } else if let Some(stock_str) = stock_val.as_str() {
                                    stock_str.parse::<i32>().unwrap_or(0)
                                } else {
                                    0
                                };

                                if current_stock > 0 {
                                    let new_stock = (current_stock - remaining).max(0);
                                    *stock_val = json!(new_stock);
                                    updated = true;
                                }
                            } else if let Some(qty_val) = produit.get_mut("quantite_disponible") {
                                // Fallback: utiliser quantite_disponible
                                let current_qty = if let Some(qty) = qty_val.as_i64() {
                                    qty as i32
                                } else if let Some(qty_str) = qty_val.as_str() {
                                    qty_str.parse::<i32>().unwrap_or(0)
                                } else {
                                    0
                                };

                                if current_qty > 0 {
                                    let new_qty = (current_qty - remaining).max(0);
                                    *qty_val = json!(new_qty);
                                    // Synchroniser aussi avec stock
                                    if let Some(obj) = produit.as_object_mut() {
                                        obj.insert("stock".to_string(), json!(new_qty));
                                    }
                                    updated = true;
                                }
                            }
                        }
                    }
                }
            }

            if updated {
                // Mettre à jour le service
                sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
                    .bind(&data)
                    .bind(service_id)
                    .execute(&self.pool)
                    .await?;
            } else {
                // Fallback: Décrémenter depuis autocomplete_combinations
                sqlx::query(
                    r#"
                    UPDATE autocomplete_combinations
                    SET stock = GREATEST(0, stock - $1)
                    WHERE service_id = $2
                        AND stock > 0
                    LIMIT 1
                    "#,
                )
                .bind(quantity)
                .bind(service_id)
                .execute(&self.pool)
                .await?;
            }
        }

        Ok(())
    }

    /// Vérifie si le stock est épuisé (stock = 0 ou NULL)
    pub async fn is_stock_zero(&self, service_id: i32, product_index: i32) -> AppResult<bool> {
        let stock = self.get_available_stock(service_id, product_index).await?;
        Ok(stock.map(|s| s <= 0).unwrap_or(true))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStockRequest {
    pub quantity_available: Option<i32>,
    pub quantity_reserved: Option<i32>,
    pub is_available: Option<bool>,
}

impl ProductStockService {
    /// Met à jour le stock pour une configuration de livraison
    pub async fn update_stock(
        &self,
        config_id: i32,
        storage_location_id: Option<i32>,
        request: UpdateStockRequest,
        user_id: i32,
    ) -> AppResult<()> {
        // Récupérer le service_id depuis product_delivery_config
        let service_id: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT service_id
            FROM product_delivery_config
            WHERE id = $1
            "#,
        )
        .bind(config_id)
        .fetch_optional(&self.pool)
        .await?;

        let service_id = service_id.ok_or_else(|| {
            AppError::NotFound("Configuration de livraison non trouvée".to_string())
        })?;

        // Vérifier que l'utilisateur est propriétaire
        let owner_id: Option<i32> =
            sqlx::query_scalar("SELECT user_id FROM services WHERE id = $1")
                .bind(service_id)
                .fetch_optional(&self.pool)
                .await?;

        if owner_id != Some(user_id) {
            return Err(AppError::Unauthorized(
                "Vous n'êtes pas le propriétaire de ce produit".to_string(),
            ));
        }

        // Mettre à jour le stock dans services.data
        if let Some(qty) = request.quantity_available {
            // Récupérer le service data
            let service_data: Option<Value> =
                sqlx::query_scalar("SELECT data FROM services WHERE id = $1")
                    .bind(service_id)
                    .fetch_optional(&self.pool)
                    .await?;

            if let Some(mut data) = service_data {
                if let Some(produits) = data.get_mut("produits") {
                    if let Some(produits_array) =
                        produits.get_mut("valeur").and_then(|v| v.as_array_mut())
                    {
                        // Mettre à jour le stock du premier produit (ou selon product_index si disponible)
                        if let Some(produit) = produits_array.get_mut(0) {
                            if let Some(obj) = produit.as_object_mut() {
                                obj.insert("stock".to_string(), json!(qty));
                                obj.insert("quantite_disponible".to_string(), json!(qty));
                            }

                            // Mettre à jour dans la base
                            sqlx::query(
                                "UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2",
                            )
                            .bind(&data)
                            .bind(service_id)
                            .execute(&self.pool)
                            .await?;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Supprime un lieu de stock d'une configuration de produit
    pub async fn remove_stock_location(&self, config_id: i32, location_id: i32) -> AppResult<()> {
        // Récupérer la configuration
        let config_data: Option<Value> =
            sqlx::query_scalar("SELECT data FROM product_delivery_configs WHERE id = $1")
                .bind(config_id)
                .fetch_optional(&self.pool)
                .await?;

        if let Some(mut data) = config_data {
            if let Some(stock_locations) = data.get_mut("stock_locations") {
                if let Some(locations_array) = stock_locations.as_array_mut() {
                    // Retirer le lieu de stock avec l'ID donné
                    locations_array.retain(|loc| {
                        loc.get("id")
                            .and_then(|v| v.as_i64())
                            .map(|id| id != location_id as i64)
                            .unwrap_or(true)
                    });

                    // Mettre à jour dans la base
                    sqlx::query("UPDATE product_delivery_configs SET data = $1, updated_at = NOW() WHERE id = $2")
                        .bind(&data)
                        .bind(config_id)
                        .execute(&self.pool)
                        .await?;
                }
            }
        }

        Ok(())
    }
}
