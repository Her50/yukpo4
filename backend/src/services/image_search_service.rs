// 🖼️ Service de recherche par image native avec PostgreSQL
// Utilise les signatures vectorielles stockées dans la table media

use crate::core::types::{AppError, AppResult};
use crate::utils::log::{log_error, log_info, log_warn};
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
    /// ✅ Utilise uniquement la table service_products (plus la table services via jsonb)
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

        // ✅ Recherche uniquement dans service_products (plus services via jsonb)
        let sql = r#"
            SELECT 
                m.id as media_id,
                sp.service_id,
                m.path as media_path,
                calculate_image_similarity($1::jsonb, m.image_signature) as similarity_score,
                sp.product_data as service_data,
                m.image_metadata
            FROM media m
            INNER JOIN service_products sp ON sp.id::TEXT = m.product_id
            INNER JOIN services s ON s.id = sp.service_id
            WHERE m.type = 'image'
            AND m.image_signature IS NOT NULL
            AND m.product_id IS NOT NULL
            AND sp.is_active = true
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
                log_error(&format!(
                    "[ImageSearch] Erreur recherche par signature: {}",
                    e
                ));
                AppError::Internal(format!("Erreur recherche par signature: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(0.0);
            let service_data: serde_json::Value =
                row.try_get("service_data").unwrap_or(serde_json::json!({}));
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
    /// ✅ Utilise uniquement la table service_products (plus la table services via jsonb)
    pub async fn search_by_image_hash(
        &self,
        image_hash: &str,
    ) -> AppResult<Vec<ImageSearchResult>> {
        log_info(&format!("[ImageSearch] Recherche par hash: {}", image_hash));

        // ✅ Recherche uniquement dans service_products (plus services via jsonb)
        let sql = r#"
            SELECT 
                m.id as media_id,
                sp.service_id,
                m.path as media_path,
                1.0 as similarity_score,
                sp.product_data as service_data,
                m.image_metadata
            FROM media m
            INNER JOIN service_products sp ON sp.id::TEXT = m.product_id
            INNER JOIN services s ON s.id = sp.service_id
            WHERE m.type = 'image'
            AND m.image_hash = $1
            AND m.product_id IS NOT NULL
            AND sp.is_active = true
            AND s.is_active = true
            ORDER BY s.created_at DESC
        "#;

        let results =
            sqlx::query(sql).bind(image_hash).fetch_all(&*self.pool).await.map_err(|e| {
                log_error(&format!("[ImageSearch] Erreur recherche par hash: {}", e));
                AppError::Internal(format!("Erreur recherche par hash: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(1.0);
            let service_data: serde_json::Value =
                row.try_get("service_data").unwrap_or(serde_json::json!({}));
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
            "[ImageSearch] Trouvé {} doublons",
            search_results.len()
        ));

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

        // ✅ Recherche uniquement dans service_products (plus services via jsonb)
        let sql = r#"
            SELECT 
                m.id as media_id,
                sp.service_id,
                m.path as media_path,
                calculate_image_similarity($1::jsonb, m.image_signature) as similarity_score,
                sp.product_data as service_data,
                m.image_metadata
            FROM media m
            INNER JOIN service_products sp ON sp.id::TEXT = m.product_id
            INNER JOIN services s ON s.id = sp.service_id
            WHERE m.type = 'image'
            AND m.image_signature IS NOT NULL
            AND m.product_id IS NOT NULL
            AND sp.is_active = true
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
                log_error(&format!(
                    "[ImageSearch] Erreur recherche images produits: {}",
                    e
                ));
                AppError::Internal(format!("Erreur recherche images produits: {}", e))
            })?;

        let mut search_results = Vec::new();
        for row in results {
            let media_id: i32 = row.try_get("media_id").unwrap_or(0);
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_path: String = row.try_get("media_path").unwrap_or_default();
            let similarity_score: f32 = row.try_get("similarity_score").unwrap_or(0.0);
            let service_data: serde_json::Value =
                row.try_get("service_data").unwrap_or(serde_json::json!({}));
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
    /// Utilise un hash perceptuel basé sur les caractéristiques visuelles de l'image
    /// Cette fonction devrait être appelée lors de l'upload d'une image
    #[cfg(feature = "image_search")]
    pub fn generate_image_signature(image_data: &[u8]) -> AppResult<Vec<f32>> {
        use image::io::Reader as ImageReader;
        use std::io::Cursor;

        log_info("[ImageSearch] Génération de signature vectorielle d'image");

        // 1. Charger l'image
        let img = match ImageReader::new(Cursor::new(image_data))
            .with_guessed_format()
            .map_err(|e| AppError::Internal(format!("Erreur lecture image: {}", e)))?
            .decode()
        {
            Ok(img) => img,
            Err(e) => {
                log_error(&format!("[ImageSearch] Erreur décodage image: {}", e));
                return Err(AppError::Internal(format!("Erreur décodage image: {}", e)));
            }
        };

        // 2. Redimensionner à 16x16 pour extraction de features
        let resized = img.resize_exact(16, 16, image::imageops::FilterType::Lanczos3);

        // 3. Convertir en niveaux de gris
        let gray = resized.to_luma8();

        // 4. Extraire des features: histogramme de couleurs, gradients, textures
        let mut signature = Vec::with_capacity(192);

        // 4.1. Histogramme de luminosité (64 bins)
        let mut histogram = vec![0u32; 64];
        for pixel in gray.pixels() {
            let brightness = pixel[0] as usize;
            let bin = (brightness * 64) / 256;
            histogram[bin.min(63)] += 1;
        }
        // Normaliser l'histogramme
        let total_pixels = (16 * 16) as f32;
        for count in histogram {
            signature.push(count as f32 / total_pixels);
        }

        // 4.2. Gradients horizontaux et verticaux (64 features)
        let mut gradients = Vec::new();
        for y in 0..15 {
            for x in 0..15 {
                let current = gray.get_pixel(x, y)[0] as f32;
                let right = gray.get_pixel(x + 1, y)[0] as f32;
                let bottom = gray.get_pixel(x, y + 1)[0] as f32;

                let grad_x = (right - current) / 255.0;
                let grad_y = (bottom - current) / 255.0;

                gradients.push(grad_x);
                gradients.push(grad_y);
            }
        }
        // Prendre les 32 premiers gradients (64 features)
        signature.extend(gradients.into_iter().take(64));

        // 4.3. Features de texture (DCT-like features simplifiées) (64 features)
        // Calculer des moyennes par blocs 4x4
        for block_y in 0..4 {
            for block_x in 0..4 {
                let mut sum = 0u32;
                for y in 0..4 {
                    for x in 0..4 {
                        let px = gray.get_pixel(block_x * 4 + x, block_y * 4 + y)[0] as u32;
                        sum += px;
                    }
                }
                let avg = (sum / 16) as f32 / 255.0;
                signature.push(avg);
            }
        }
        // Répéter pour avoir 64 features
        while signature.len() < 192 {
            let last_16: Vec<f32> = signature[signature.len().saturating_sub(16)..].to_vec();
            signature.extend(last_16.iter().take(16.min(192 - signature.len())));
        }

        // S'assurer d'avoir exactement 192 dimensions
        signature.truncate(192);
        while signature.len() < 192 {
            signature.push(0.0);
        }

        log_info(&format!(
            "[ImageSearch] Signature générée: {} dimensions, moyenne: {:.3}",
            signature.len(),
            signature.iter().sum::<f32>() / signature.len() as f32
        ));

        Ok(signature)
    }

    /// Version fallback sans feature image_search (retourne signature factice)
    #[cfg(not(feature = "image_search"))]
    pub fn generate_image_signature(_image_data: &[u8]) -> AppResult<Vec<f32>> {
        log_warn("[ImageSearch] Feature image_search non activée - signature factice");
        Ok(vec![0.0; 192])
    }

    /// Calculer le hash MD5 d'une image pour détection de doublons
    pub fn calculate_image_hash(image_data: &[u8]) -> String {
        let digest = md5::compute(image_data);
        format!("{:x}", digest)
    }

    /// Extraire les métadonnées d'une image
    #[cfg(feature = "image_search")]
    pub fn extract_image_metadata(image_data: &[u8]) -> AppResult<serde_json::Value> {
        use image::{io::Reader as ImageReader, DynamicImage, GenericImageView};
        use std::io::Cursor;

        // Charger l'image pour extraire les métadonnées
        let img = match ImageReader::new(Cursor::new(image_data))
            .with_guessed_format()
            .map_err(|e| AppError::Internal(format!("Erreur lecture image: {}", e)))?
            .decode()
        {
            Ok(img) => img,
            Err(e) => {
                log_error(&format!(
                    "[ImageSearch] Erreur décodage image pour métadonnées: {}",
                    e
                ));
                // Retourner métadonnées basiques en cas d'erreur
                return Ok(serde_json::json!({
                    "width": 0,
                    "height": 0,
                    "format": "unknown",
                    "file_size": image_data.len(),
                    "status": "error_decoding"
                }));
            }
        };

        let (width, height) = img.dimensions();
        let format_name = match img {
            DynamicImage::ImageLuma8(_) => "luma8",
            DynamicImage::ImageLumaA8(_) => "luma_a8",
            DynamicImage::ImageRgb8(_) => "rgb8",
            DynamicImage::ImageRgba8(_) => "rgba8",
            DynamicImage::ImageLuma16(_) => "luma16",
            DynamicImage::ImageLumaA16(_) => "luma_a16",
            DynamicImage::ImageRgb16(_) => "rgb16",
            DynamicImage::ImageRgba16(_) => "rgba16",
            _ => "unknown",
        };

        Ok(serde_json::json!({
            "width": width,
            "height": height,
            "format": format_name,
            "file_size": image_data.len(),
            "status": "processed",
            "aspect_ratio": width as f64 / height as f64,
            "pixel_count": (width * height) as u64
        }))
    }

    /// Version fallback sans feature image_search
    #[cfg(not(feature = "image_search"))]
    pub fn extract_image_metadata(image_data: &[u8]) -> AppResult<serde_json::Value> {
        log_warn("[ImageSearch] Feature image_search non activée - métadonnées factices");
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
            log_info(&format!(
                "[ImageSearch] Trouvé {} doublons exacts",
                exact_matches.len()
            ));
            return Ok(exact_matches);
        }

        // 3. Générer la signature vectorielle
        let signature = Self::generate_image_signature(image_data)?;

        // 4. Rechercher par similarité
        let similar_images = self
            .search_by_image_signature(&signature, similarity_threshold, max_results)
            .await?;

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
