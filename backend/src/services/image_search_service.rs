// 🖼️ Service de recherche par image native avec PostgreSQL
// Utilise les signatures vectorielles stockées dans la table media

use crate::core::types::{AppError, AppResult};
use crate::utils::logger::{log_error, log_info, log_warn};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSearchResult {
    pub service_id: i32,
    pub media_id: i32,
    pub media_path: String,
    pub similarity_score: f32,
    pub service_data: serde_json::Value,
    pub image_metadata: Option<serde_json::Value>,
}

pub struct ImageSearchService {
    pool: Arc<PgPool>,
}

impl ImageSearchService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Rechercher des images similaires par signature vectorielle
    pub async fn search_by_image_signature(
        &self,
        image_signature: &[f32],
        similarity_threshold: f32,
        max_results: i32,
    ) -> AppResult<Vec<ImageSearchResult>> {
        log_info(&format!(
            "[ImageSearch] Recherche par signature: {} dimensions, seuil={}, max={}",
            image_signature.len(),
            similarity_threshold,
            max_results
        ));

        // Convertir la signature en JSONB pour PostgreSQL
        let signature_json = serde_json::to_value(image_signature)
            .map_err(|e| AppError::Internal(format!("Erreur conversion signature: {}", e)))?;

        let sql = r#"
            SELECT 
                m.id as media_id,
                m.service_id,
                m.path as media_path,
                calculate_image_similarity($1::jsonb, m.image_signature) as similarity_score,
                s.data as service_data,
                m.image_metadata
            FROM media m
            INNER JOIN services s ON s.id = m.service_id
            WHERE m.type = 'image'
            AND m.image_signature IS NOT NULL
            AND s.is_active = true
            AND calculate_image_similarity($1::jsonb, m.image_signature) >= $2
            ORDER BY similarity_score DESC
            LIMIT $3
        "#;

        let results = sqlx::query(sql)
            .bind(&signature_json)
            .bind(similarity_threshold)
            .bind(max_results)
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[ImageSearch] Erreur recherche par signature: {}", e));
                AppError::Internal(format!("Erreur recherche par signature: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(0.0);
            let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(serde_json::json!({}));
            let image_metadata: Option<serde_json::Value> = row.try_get("image_metadata").ok();

            search_results.push(ImageSearchResult {
                service_id,
                media_id,
                media_path,
                similarity_score,
                service_data,
                image_metadata,
            });
        }

        log_info(&format!(
            "[ImageSearch] Trouvé {} résultats similaires",
            search_results.len()
        ));

        Ok(search_results)
    }

    /// Rechercher par hash d'image (détection de doublons exacts)
    pub async fn search_by_image_hash(&self, image_hash: &str) -> AppResult<Vec<ImageSearchResult>> {
        log_info(&format!("[ImageSearch] Recherche par hash: {}", image_hash));

        let sql = r#"
            SELECT 
                m.id as media_id,
                m.service_id,
                m.path as media_path,
                1.0 as similarity_score,
                s.data as service_data,
                m.image_metadata
            FROM media m
            INNER JOIN services s ON s.id = m.service_id
            WHERE m.type = 'image'
            AND m.image_hash = $1
            AND s.is_active = true
            ORDER BY s.created_at DESC
        "#;

        let results = sqlx::query(sql)
            .bind(image_hash)
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[ImageSearch] Erreur recherche par hash: {}", e));
                AppError::Internal(format!("Erreur recherche par hash: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(1.0);
            let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(serde_json::json!({}));
            let image_metadata: Option<serde_json::Value> = row.try_get("image_metadata").ok();

            search_results.push(ImageSearchResult {
                service_id,
                media_id,
                media_path,
                similarity_score,
                service_data,
                image_metadata,
            });
        }

        log_info(&format!("[ImageSearch] Trouvé {} doublons", search_results.len()));

        Ok(search_results)
    }

    /// Rechercher dans les images de produits spécifiquement
    pub async fn search_product_images(
        &self,
        image_signature: &[f32],
        similarity_threshold: f32,
        max_results: i32,
    ) -> AppResult<Vec<ImageSearchResult>> {
        log_info(&format!(
            "[ImageSearch] Recherche dans images de produits: seuil={}, max={}",
            similarity_threshold, max_results
        ));

        let signature_json = serde_json::to_value(image_signature)
            .map_err(|e| AppError::Internal(format!("Erreur conversion signature: {}", e)))?;

        // Rechercher dans les images des produits (stockées dans data->'produits')
        let sql = r#"
            WITH product_images AS (
                SELECT 
                    s.id as service_id,
                    s.data,
                    product->>'nom' as product_name,
                    jsonb_array_elements_text(COALESCE(product->'images', '[]'::jsonb)) as image_path
                FROM services s,
                jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        ELSE '[]'::jsonb
                    END
                ) AS product
                WHERE s.is_active = true
            )
            SELECT 
                m.id as media_id,
                pi.service_id,
                m.path as media_path,
                calculate_image_similarity($1::jsonb, m.image_signature) as similarity_score,
                pi.data as service_data,
                m.image_metadata
            FROM product_images pi
            INNER JOIN media m ON m.path = pi.image_path AND m.service_id = pi.service_id
            WHERE m.type = 'image'
            AND m.image_signature IS NOT NULL
            AND calculate_image_similarity($1::jsonb, m.image_signature) >= $2
            ORDER BY similarity_score DESC
            LIMIT $3
        "#;

        let results = sqlx::query(sql)
            .bind(&signature_json)
            .bind(similarity_threshold)
            .bind(max_results)
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| {
                log_error(&format!("[ImageSearch] Erreur recherche images produits: {}", e));
                AppError::Internal(format!("Erreur recherche images produits: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(0.0);
            let service_data: serde_json::Value = row.try_get("service_data").unwrap_or(serde_json::json!({}));
            let image_metadata: Option<serde_json::Value> = row.try_get("image_metadata").ok();

            search_results.push(ImageSearchResult {
                service_id,
                media_id,
                media_path,
                similarity_score,
                service_data,
                image_metadata,
            });
        }

        log_info(&format!(
            "[ImageSearch] Trouvé {} produits avec images similaires",
            search_results.len()
        ));

        Ok(search_results)
    }

    /// Générer une signature vectorielle d'image (192 dimensions)
    /// Cette fonction devrait être appelée lors de l'upload d'une image
    pub fn generate_image_signature(image_data: &[u8]) -> AppResult<Vec<f32>> {
        // TODO: Implémenter la génération de signature avec une bibliothèque comme `image`
        // Pour l'instant, retourne une signature factice
        log_warn("[ImageSearch] Génération de signature factice - À implémenter");
        
        // Génération basique basée sur les pixels
        // Dans une vraie implémentation, utiliser un CNN ou un algorithme de hachage perceptuel
        Ok(vec![0.0; 192])
    }

    /// Calculer le hash MD5 d'une image pour détection de doublons
    pub fn calculate_image_hash(image_data: &[u8]) -> String {
        use md5::{Md5, Digest};
        let mut hasher = Md5::new();
        hasher.update(image_data);
        format!("{:x}", hasher.finalize())
    }

    /// Extraire les métadonnées d'une image
    pub fn extract_image_metadata(image_data: &[u8]) -> AppResult<serde_json::Value> {
        // TODO: Implémenter l'extraction de métadonnées avec `image` crate
        log_warn("[ImageSearch] Extraction de métadonnées factice - À implémenter");
        
        Ok(serde_json::json!({
            "width": 1920,
            "height": 1080,
            "format": "jpeg",
            "file_size": image_data.len(),
            "status": "pending_processing"
        }))
    }

    /// Recherche hybride: combinant signature, hash et métadonnées
    pub async fn hybrid_image_search(
        &self,
        image_data: &[u8],
        similarity_threshold: f32,
        max_results: i32,
    ) -> AppResult<Vec<ImageSearchResult>> {
        log_info("[ImageSearch] Recherche hybride par image");

        // 1. Générer le hash pour recherche exacte
        let image_hash = Self::calculate_image_hash(image_data);
        
        // 2. Chercher d'abord les doublons exacts
        let exact_matches = self.search_by_image_hash(&image_hash).await?;
        if !exact_matches.is_empty() {
            log_info(&format!("[ImageSearch] Trouvé {} doublons exacts", exact_matches.len()));
            return Ok(exact_matches);
        }

        // 3. Générer la signature vectorielle
        let signature = Self::generate_image_signature(image_data)?;

        // 4. Rechercher par similarité
        let similar_images = self.search_by_image_signature(&signature, similarity_threshold, max_results).await?;

        Ok(similar_images)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_hash() {
        let data = b"test image data";
        let hash = ImageSearchService::calculate_image_hash(data);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 32); // MD5 hash length
    }

    #[test]
    fn test_generate_signature() {
        let data = b"test image data";
        let signature = ImageSearchService::generate_image_signature(data).unwrap();
        assert_eq!(signature.len(), 192);
    }
}
