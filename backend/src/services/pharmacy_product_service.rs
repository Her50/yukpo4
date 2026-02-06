// ✅ NOUVEAU: Service pour gestion produits de pharmacie

use crate::core::types::{AppError, AppResult};
use crate::models::pharmacy_product::{
    BudgetCalculation, BudgetCalculationItem, BudgetComparison, PharmacyProduct,
    PharmacyProductWithDistance,
};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct BulkImportResult {
    pub created: bool, // true = créé, false = mis à jour
}

pub struct PharmacyProductService {
    pool: Arc<PgPool>,
}

impl PharmacyProductService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Créer un produit
    pub async fn create_product(
        &self,
        pharmacy_service_id: i32,
        nom_produit: String,
        prix: rust_decimal::Decimal,
        stock: i32,
        unite: String,
        description: Option<String>,
        code_barre: Option<String>,
        categorie: Option<String>,
    ) -> AppResult<PharmacyProduct> {
        let product = sqlx::query_as::<_, PharmacyProduct>(
            r#"
            INSERT INTO pharmacy_products (
                pharmacy_service_id, nom_produit, description,
                prix, stock, disponible, unite, code_barre, categorie
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(pharmacy_service_id)
        .bind(nom_produit)
        .bind(description)
        .bind(prix)
        .bind(stock)
        .bind(stock > 0)
        .bind(unite)
        .bind(code_barre)
        .bind(categorie)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création produit: {}", e)))?;

        Ok(product)
    }

    /// Mettre à jour un produit
    pub async fn update_product(
        &self,
        product_id: i32,
        pharmacy_service_id: i32,
        nom_produit: Option<String>,
        prix: Option<rust_decimal::Decimal>,
        stock: Option<i32>,
        description: Option<String>,
        code_barre: Option<String>,
        categorie: Option<String>,
    ) -> AppResult<PharmacyProduct> {
        // Construire la requête dynamiquement
        let mut updates = Vec::new();
        let mut bind_index = 1;

        let nom_produit_clone = nom_produit.clone();
        if let Some(ref _nom) = nom_produit_clone {
            updates.push(format!("nom_produit = ${}", bind_index));
            bind_index += 1;
        }
        if let Some(_p) = prix {
            updates.push(format!("prix = ${}", bind_index));
            bind_index += 1;
        }
        if let Some(_stock) = stock {
            updates.push(format!("stock = ${}", bind_index));
            updates.push(format!("disponible = ${}", bind_index + 1));
            bind_index += 2;
        }
        if description.is_some() {
            updates.push(format!("description = ${}", bind_index));
            bind_index += 1;
        }
        if code_barre.is_some() {
            updates.push(format!("code_barre = ${}", bind_index));
            bind_index += 1;
        }
        if categorie.is_some() {
            updates.push(format!("categorie = ${}", bind_index));
            bind_index += 1;
        }

        if updates.is_empty() {
            return self.get_product_by_id(product_id, pharmacy_service_id).await;
        }

        let sql = format!(
            "UPDATE pharmacy_products SET {} WHERE id = ${} AND pharmacy_service_id = ${} RETURNING *",
            updates.join(", "),
            bind_index,
            bind_index + 1
        );

        let mut query = sqlx::query_as::<_, PharmacyProduct>(&sql);
        let _bind_index_reset = 1;

        if let Some(ref nom) = nom_produit_clone {
            query = query.bind(nom);
        }
        if let Some(p) = prix {
            query = query.bind(p);
        }
        if let Some(s) = stock {
            query = query.bind(s);
            query = query.bind(s > 0);
        }
        if let Some(desc) = description {
            query = query.bind(desc);
        }
        if let Some(cb) = code_barre {
            query = query.bind(cb);
        }
        if let Some(cat) = categorie {
            query = query.bind(cat);
        }

        query = query.bind(product_id);
        query = query.bind(pharmacy_service_id);

        let product = query
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur mise à jour produit: {}", e)))?;

        product.ok_or_else(|| AppError::NotFound("Produit non trouvé".to_string()))
    }

    /// Rechercher produits (toutes pharmacies)
    pub async fn search_products(
        &self,
        query: &str,
        user_lat: Option<f64>,
        user_lng: Option<f64>,
        radius_km: Option<f64>,
        min_price: Option<rust_decimal::Decimal>,
        max_price: Option<rust_decimal::Decimal>,
        only_available: bool,
        limit: Option<i32>,
    ) -> AppResult<Vec<PharmacyProductWithDistance>> {
        let search_pattern = format!("%{}%", query);

        let mut sql = String::from(
            r#"
            SELECT 
                pp.*,
                s.nom as pharmacy_nom,
                s.adresse as pharmacy_adresse,
                s.gps as pharmacy_gps,
                CASE 
                    WHEN $3 IS NOT NULL AND $4 IS NOT NULL AND s.gps IS NOT NULL
                    THEN (
                        6371 * acos(
                            cos(radians($3)) * cos(radians((s.gps->>'lat')::float))
                            * cos(radians((s.gps->>'lng')::float) - radians($4))
                            + sin(radians($3)) * sin(radians((s.gps->>'lat')::float))
                        )
                    )
                    ELSE NULL
                END as distance_km
            FROM pharmacy_products pp
            JOIN services s ON pp.pharmacy_service_id = s.id
            WHERE pp.nom_produit ILIKE $1
            "#,
        );

        if only_available {
            sql.push_str(" AND pp.disponible = true AND pp.stock > 0");
        }

        if min_price.is_some() {
            sql.push_str(" AND pp.prix >= $5");
        }

        if max_price.is_some() {
            sql.push_str(" AND pp.prix <= $6");
        }

        if user_lat.is_some() && user_lng.is_some() && radius_km.is_some() {
            sql.push_str(" AND distance_km <= $7");
        }

        sql.push_str(" ORDER BY pp.prix ASC");

        if user_lat.is_some() && user_lng.is_some() {
            sql.push_str(", distance_km ASC NULLS LAST");
        }

        if let Some(l) = limit {
            sql.push_str(&format!(" LIMIT {}", l));
        }

        let mut query_builder =
            sqlx::query(&sql).bind(&search_pattern).bind(user_lat).bind(user_lng);

        if let Some(min) = min_price {
            query_builder = query_builder.bind(min);
        }
        if let Some(max) = max_price {
            query_builder = query_builder.bind(max);
        }
        if let Some(radius) = radius_km {
            query_builder = query_builder.bind(radius);
        }

        let rows = query_builder
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur recherche produits: {}", e)))?;

        let products: Vec<PharmacyProductWithDistance> = rows
            .into_iter()
            .map(|row| {
                let product = PharmacyProduct {
                    id: row.get::<i32, _>("id"),
                    pharmacy_service_id: row.get::<i32, _>("pharmacy_service_id"),
                    nom_produit: row.get::<String, _>("nom_produit"),
                    description: row.get::<Option<String>, _>("description"),
                    prix: row.get::<rust_decimal::Decimal, _>("prix"),
                    stock: row.get::<i32, _>("stock"),
                    disponible: row.get::<bool, _>("disponible"),
                    unite: row.get::<String, _>("unite"),
                    code_barre: row.get::<Option<String>, _>("code_barre"),
                    categorie: row.get::<Option<String>, _>("categorie"),
                    created_at: row.get::<DateTime<Utc>, _>("created_at"),
                    updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
                };
                PharmacyProductWithDistance {
                    product,
                    distance_km: row.get::<Option<f64>, _>("distance_km"),
                    pharmacy_nom: row.get::<Option<String>, _>("pharmacy_nom"),
                    pharmacy_adresse: row.get::<Option<String>, _>("pharmacy_adresse"),
                    pharmacy_gps: row.get::<Option<serde_json::Value>, _>("pharmacy_gps"),
                }
            })
            .collect();

        Ok(products)
    }

    /// Calculer budget global
    pub async fn calculate_budget(
        &self,
        items: Vec<(i32, i32)>, // (product_id, quantity)
        user_lat: Option<f64>,
        user_lng: Option<f64>,
    ) -> AppResult<BudgetComparison> {
        if items.is_empty() {
            return Err(AppError::BadRequest("Liste de produits vide".to_string()));
        }

        // Récupérer tous les produits demandés
        let product_ids: Vec<i32> = items.iter().map(|(id, _)| *id).collect();
        let placeholders: String = (1..=product_ids.len())
            .map(|i| format!("${}", i))
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            r#"
            SELECT 
                pp.*,
                s.nom as pharmacy_nom,
                s.gps as pharmacy_gps,
                CASE 
                    WHEN $1 IS NOT NULL AND $2 IS NOT NULL AND s.gps IS NOT NULL
                    THEN (
                        6371 * acos(
                            cos(radians($1)) * cos(radians((s.gps->>'lat')::float))
                            * cos(radians((s.gps->>'lng')::float) - radians($2))
                            + sin(radians($1)) * sin(radians((s.gps->>'lat')::float))
                        )
                    )
                    ELSE NULL
                END as distance_km
            FROM pharmacy_products pp
            JOIN services s ON pp.pharmacy_service_id = s.id
            WHERE pp.id IN ({})
            AND pp.disponible = true AND pp.stock > 0
            ORDER BY s.id, pp.prix ASC
            "#,
            placeholders
        );

        let mut query = sqlx::query(&sql).bind(user_lat).bind(user_lng);

        for id in &product_ids {
            query = query.bind(id);
        }

        let rows = query
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur calcul budget: {}", e)))?;

        // Grouper par pharmacie et calculer le total
        use std::collections::HashMap;
        let mut pharmacy_budgets: HashMap<i32, BudgetCalculation> = HashMap::new();

        for row in rows {
            let product = PharmacyProduct {
                id: row.get::<i32, _>("id"),
                pharmacy_service_id: row.get::<i32, _>("pharmacy_service_id"),
                nom_produit: row.get::<String, _>("nom_produit"),
                description: row.get::<Option<String>, _>("description"),
                prix: row.get::<rust_decimal::Decimal, _>("prix"),
                stock: row.get::<i32, _>("stock"),
                disponible: row.get::<bool, _>("disponible"),
                unite: row.get::<String, _>("unite"),
                code_barre: row.get::<Option<String>, _>("code_barre"),
                categorie: row.get::<Option<String>, _>("categorie"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                updated_at: row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            };
            let pharmacy_nom: Option<String> = row.get::<Option<String>, _>("pharmacy_nom");
            let _gps: Option<serde_json::Value> =
                row.get::<Option<serde_json::Value>, _>("pharmacy_gps");
            let distance: Option<f64> = row.get::<Option<f64>, _>("distance_km");
            let quantity =
                items.iter().find(|(id, _)| *id == product.id).map(|(_, qty)| *qty).unwrap_or(1);

            let prix_unitaire = product.prix;
            let prix_total = prix_unitaire * rust_decimal::Decimal::from(quantity);

            let budget = pharmacy_budgets.entry(product.pharmacy_service_id).or_insert_with(|| {
                BudgetCalculation {
                    pharmacy_service_id: product.pharmacy_service_id,
                    pharmacy_nom: pharmacy_nom.clone().unwrap_or_default(),
                    items: Vec::new(),
                    total: rust_decimal::Decimal::ZERO,
                    distance_km: distance,
                    currency: "XOF".to_string(),
                }
            });

            budget.items.push(BudgetCalculationItem {
                product_id: product.id,
                nom_produit: product.nom_produit,
                quantity,
                prix_unitaire,
                prix_total,
            });

            budget.total += prix_total;
        }

        let mut all_pharmacies: Vec<BudgetCalculation> = pharmacy_budgets.into_values().collect();
        all_pharmacies.sort_by(|a, b| a.total.cmp(&b.total));

        let best_pharmacy = all_pharmacies
            .first()
            .cloned()
            .ok_or_else(|| AppError::NotFound("Aucune pharmacie trouvée".to_string()))?;

        let savings = if all_pharmacies.len() > 1 {
            let most_expensive = all_pharmacies.last().unwrap();
            Some(most_expensive.total - best_pharmacy.total)
        } else {
            None
        };

        Ok(BudgetComparison {
            best_pharmacy,
            all_pharmacies,
            savings,
        })
    }

    /// Récupérer produits d'une pharmacie
    pub async fn get_products_by_pharmacy(
        &self,
        pharmacy_service_id: i32,
    ) -> AppResult<Vec<PharmacyProduct>> {
        let products = sqlx::query_as::<_, PharmacyProduct>(
            r#"
            SELECT * FROM pharmacy_products
            WHERE pharmacy_service_id = $1
            ORDER BY nom_produit ASC
            "#,
        )
        .bind(pharmacy_service_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produits: {}", e)))?;

        Ok(products)
    }

    /// Récupérer un produit par ID
    pub async fn get_product_by_id(
        &self,
        product_id: i32,
        pharmacy_service_id: i32,
    ) -> AppResult<PharmacyProduct> {
        let product = sqlx::query_as::<_, PharmacyProduct>(
            r#"
            SELECT * FROM pharmacy_products
            WHERE id = $1 AND pharmacy_service_id = $2
            "#,
        )
        .bind(product_id)
        .bind(pharmacy_service_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération produit: {}", e)))?;

        product.ok_or_else(|| AppError::NotFound("Produit non trouvé".to_string()))
    }

    /// Import en masse d'un produit (utilisé pour bulk import)
    pub async fn bulk_import_product(
        &self,
        pharmacy_service_id: i32,
        nom_produit: String,
        prix: rust_decimal::Decimal,
        stock: i32,
        unite: String,
        description: Option<String>,
        code_barre: Option<String>,
        categorie: Option<String>,
        overwrite: bool,
    ) -> AppResult<BulkImportResult> {
        // Vérifier si le produit existe déjà (par nom ou code_barre)
        let existing: Option<(i32, i32)> = if let Some(cb) = &code_barre {
            sqlx::query_as::<_, (i32, i32)>(
                r#"
                SELECT id, stock FROM pharmacy_products
                WHERE pharmacy_service_id = $1 AND (nom_produit = $2 OR code_barre = $3)
                LIMIT 1
                "#,
            )
            .bind(pharmacy_service_id)
            .bind(&nom_produit)
            .bind(cb)
            .fetch_optional(&*self.pool)
            .await?
        } else {
            sqlx::query_as::<_, (i32, i32)>(
                r#"
                SELECT id, stock FROM pharmacy_products
                WHERE pharmacy_service_id = $1 AND nom_produit = $2
                LIMIT 1
                "#,
            )
            .bind(pharmacy_service_id)
            .bind(&nom_produit)
            .fetch_optional(&*self.pool)
            .await?
        };

        if let Some((existing_id, existing_stock)) = existing {
            if overwrite {
                // Mettre à jour le produit existant
                let _ = self
                    .update_product(
                        existing_id,
                        pharmacy_service_id,
                        Some(nom_produit),
                        Some(prix),
                        Some(stock),
                        description,
                        code_barre,
                        categorie,
                    )
                    .await?;
                return Ok(BulkImportResult { created: false });
            } else {
                // Incrémenter le stock
                let new_stock = existing_stock + stock;
                sqlx::query(
                    r#"
                    UPDATE pharmacy_products
                    SET stock = $1, disponible = ($1 > 0), updated_at = NOW()
                    WHERE id = $2
                    "#,
                )
                .bind(new_stock)
                .bind(existing_id)
                .execute(&*self.pool)
                .await?;
                return Ok(BulkImportResult { created: false });
            }
        }

        // Créer un nouveau produit
        let _ = self
            .create_product(
                pharmacy_service_id,
                nom_produit,
                prix,
                stock,
                unite,
                description,
                code_barre,
                categorie,
            )
            .await?;

        Ok(BulkImportResult { created: true })
    }

    /// Supprimer un produit
    pub async fn delete_product(&self, product_id: i32, pharmacy_service_id: i32) -> AppResult<()> {
        let result = sqlx::query(
            r#"
            DELETE FROM pharmacy_products
            WHERE id = $1 AND pharmacy_service_id = $2
            "#,
        )
        .bind(product_id)
        .bind(pharmacy_service_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression produit: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Produit non trouvé".to_string()));
        }

        Ok(())
    }
}
