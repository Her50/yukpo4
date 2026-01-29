// ✅ NOUVEAU 2026-01-03: Service pour gestion de la table products séparée
// Ce service remplace les opérations JSONB sur services.data->'produits'->'valeur'

use crate::core::types::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Structure Product représentant un produit dans la table products
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    pub id: i32,
    pub service_id: i32,
    pub product_index: i32,
    pub product_data: Value,
    pub product_name: String,
    pub product_type: String,
    pub product_price: Option<rust_decimal::Decimal>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub auto_deactivate_at: Option<DateTime<Utc>>,
}

/// Service de gestion des produits
pub struct ProductsService {
    pool: Arc<PgPool>,
}

impl ProductsService {
    /// Crée une nouvelle instance du service
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Crée un nouveau produit
    pub async fn create_product(
        &self,
        service_id: i32,
        product_index: i32,
        product_data: &Value,
    ) -> AppResult<Product> {
        let product = sqlx::query_as::<_, Product>(
            r#"
            INSERT INTO service_products (service_id, product_index, product_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (service_id, product_index) 
            DO UPDATE SET 
                product_data = EXCLUDED.product_data,
                updated_at = NOW()
            RETURNING 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .bind(product_data)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la création du produit (service_id: {}, product_index: {}): {}",
                service_id, product_index, e
            ))
        })?;

        Ok(product)
    }

    /// Récupère un produit spécifique par service_id et product_index
    pub async fn get_product(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Option<Product>> {
        let product = sqlx::query_as::<_, Product>(
            r#"
            SELECT 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            FROM service_products
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la récupération du produit (service_id: {}, product_index: {}): {}",
                service_id, product_index, e
            ))
        })?;

        Ok(product)
    }

    /// Récupère tous les produits d'un service
    pub async fn get_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
        let products = sqlx::query_as::<_, Product>(
            r#"
            SELECT 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            FROM service_products
            WHERE service_id = $1
            ORDER BY product_index ASC
            "#,
        )
        .bind(service_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la récupération des produits (service_id: {}): {}",
                service_id, e
            ))
        })?;

        Ok(products)
    }

    /// Récupère tous les produits actifs d'un service
    pub async fn get_active_products_by_service(&self, service_id: i32) -> AppResult<Vec<Product>> {
        let products = sqlx::query_as::<_, Product>(
            r#"
            SELECT 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            FROM service_products
            WHERE service_id = $1 AND is_active = TRUE
            ORDER BY product_index ASC
            "#,
        )
        .bind(service_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la récupération des produits actifs (service_id: {}): {}",
                service_id, e
            ))
        })?;

        Ok(products)
    }

    /// Met à jour un produit
    pub async fn update_product(
        &self,
        service_id: i32,
        product_index: i32,
        product_data: &Value,
    ) -> AppResult<Product> {
        let product = sqlx::query_as::<_, Product>(
            r#"
            UPDATE service_products
            SET 
                product_data = $3,
                updated_at = NOW()
            WHERE service_id = $1 AND product_index = $2
            RETURNING 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .bind(product_data)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la mise à jour du produit (service_id: {}, product_index: {}): {}",
                service_id, product_index, e
            ))
        })?;

        Ok(product)
    }

    /// Supprime un produit (soft delete en désactivant)
    pub async fn delete_product(&self, service_id: i32, product_index: i32) -> AppResult<()> {
        sqlx::query(
            r#"
            DELETE FROM service_products
            WHERE service_id = $1 AND product_index = $2
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la suppression du produit (service_id: {}, product_index: {}): {}",
                service_id, product_index, e
            ))
        })?;

        Ok(())
    }

    /// Réindexe les produits d'un service après suppression (réduit les indices supérieurs)
    /// Par exemple, si on supprime l'index 2, les produits aux index 3, 4, 5... deviennent 2, 3, 4...
    pub async fn reindex_products(&self, service_id: i32) -> AppResult<()> {
        // Utiliser une transaction pour garantir la cohérence
        let mut tx = self.pool.begin().await.map_err(|e| {
            AppError::Internal(format!(
                "Erreur début transaction réindexation (service_id: {}): {}",
                service_id, e
            ))
        })?;

        // Récupérer tous les produits triés par index
        let products = sqlx::query(
            r#"
            SELECT id, product_index
            FROM service_products
            WHERE service_id = $1
            ORDER BY product_index ASC
            "#,
        )
        .bind(service_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur récupération produits pour réindexation (service_id: {}): {}",
                service_id, e
            ))
        })?;

        // Réindexer séquentiellement
        for (new_index, row) in products.iter().enumerate() {
            let product_id: i32 = row.get("id");
            let old_index: i32 = row.get("product_index");
            let new_index = new_index as i32;

            if old_index != new_index {
                sqlx::query(
                    r#"
                    UPDATE service_products
                    SET product_index = $1, updated_at = NOW()
                    WHERE id = $2
                    "#,
                )
                .bind(new_index)
                .bind(product_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    AppError::Internal(format!(
                        "Erreur réindexation produit id {} (service_id: {}): {}",
                        product_id, service_id, e
                    ))
                })?;
            }
        }

        tx.commit().await.map_err(|e| {
            AppError::Internal(format!(
                "Erreur commit réindexation (service_id: {}): {}",
                service_id, e
            ))
        })?;

        Ok(())
    }

    /// Duplique un produit (crée une copie avec un nouvel index)
    pub async fn duplicate_product(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<Product> {
        // Récupérer le produit source
        let source_product = self
            .get_product(service_id, product_index)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Produit source non trouvé (service_id: {}, product_index: {})",
                    service_id, product_index
                ))
            })?;

        // Trouver le prochain index disponible
        let next_index: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT COALESCE(MAX(product_index), -1) + 1
            FROM service_products
            WHERE service_id = $1
            "#,
        )
        .bind(service_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la recherche du prochain index (service_id: {}): {}",
                service_id, e
            ))
        })?;

        let new_index = next_index.unwrap_or(0);

        // Créer une copie du produit avec un nouvel index
        // Cloner product_data et modifier le nom si nécessaire pour indiquer que c'est une copie
        let mut new_product_data = source_product.product_data.clone();

        // Ajouter "(Copie)" au nom si c'est un objet avec un champ nom/nom_produit
        if let Some(obj) = new_product_data.as_object_mut() {
            if let Some(nom) = obj.get_mut("nom") {
                if let Some(nom_str) = nom.as_str() {
                    *nom = serde_json::Value::String(format!("{} (Copie)", nom_str));
                }
            } else if let Some(nom_produit) = obj.get_mut("nom_produit") {
                if let Some(nom_str) = nom_produit.as_str() {
                    *nom_produit = serde_json::Value::String(format!("{} (Copie)", nom_str));
                }
            } else if let Some(nom_obj) = obj.get_mut("nom") {
                if let Some(nom_obj_inner) = nom_obj.as_object_mut() {
                    if let Some(valeur) = nom_obj_inner.get_mut("valeur") {
                        if let Some(nom_str) = valeur.as_str() {
                            *valeur = serde_json::Value::String(format!("{} (Copie)", nom_str));
                        }
                    }
                }
            }
        }

        // Créer le nouveau produit
        let new_product = self
            .create_product(service_id, new_index, &new_product_data)
            .await?;

        Ok(new_product)
    }

    /// Récupère les produits et les formate comme l'ancien format JSONB (pour compatibilité)
    pub async fn get_products_as_jsonb_format(&self, service_id: i32) -> AppResult<Value> {
        let products = self.get_products_by_service(service_id).await?;

        let produits_array: Vec<Value> = products.into_iter().map(|p| p.product_data).collect();

        Ok(serde_json::json!({
            "type_donnee": "autocomplete",
            "valeur": produits_array,
            "separateur": ",",
            "sous_caracteristiques": {},
            "filtrable": true,
            "origine_champs": "formulaire"
        }))
    }

    /// Définit l'état actif/inactif d'un produit (désactivation/réactivation)
    pub async fn set_product_active(
        &self,
        service_id: i32,
        product_index: i32,
        is_active: bool,
        deactivation_data: Option<Value>,
    ) -> AppResult<Product> {
        // Récupérer le produit actuel
        let mut current_product = self
            .get_product(service_id, product_index)
            .await?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Produit non trouvé (service_id: {}, product_index: {})",
                    service_id, product_index
                ))
            })?;

        // Mettre à jour product_data avec les infos de désactivation/réactivation
        if let Some(obj) = current_product.product_data.as_object_mut() {
            obj.insert("is_active".to_string(), serde_json::json!(is_active));

            if is_active {
                // Réactivation: nettoyer les champs de désactivation
                obj.insert(
                    "reactivated_at".to_string(),
                    serde_json::json!(Utc::now().to_rfc3339()),
                );
                obj.remove("deactivated_at");
                obj.remove("deactivation_type");
                obj.remove("deactivation_reason");
            } else if let Some(deactivation_info) = deactivation_data {
                // Désactivation: ajouter les métadonnées
                for (key, value) in deactivation_info.as_object().unwrap() {
                    obj.insert(key.clone(), value.clone());
                }
            }
        }

        // Mettre à jour dans la base
        let product = sqlx::query_as::<_, Product>(
            r#"
            UPDATE service_products
            SET 
                is_active = $3,
                product_data = $4,
                updated_at = NOW()
            WHERE service_id = $1 AND product_index = $2
            RETURNING 
                id,
                service_id,
                product_index,
                product_data,
                product_name,
                product_type,
                product_price,
                is_active,
                created_at,
                updated_at,
                auto_deactivate_at
            "#,
        )
        .bind(service_id)
        .bind(product_index)
        .bind(is_active)
        .bind(&current_product.product_data)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Erreur lors de la mise à jour du produit (service_id: {}, product_index: {}): {}",
                service_id, product_index, e
            ))
        })?;

        Ok(product)
    }
}
